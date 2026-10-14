#!/usr/bin/env python3
"""Local Sunny DB tools. Python stdlib only; SQL runs through Docker/psql."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import stat
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT / "backend/.env.local"
COMPOSE_FILE = ROOT / "backend/docker-compose.yml"
MIGRATIONS = Path(__file__).resolve().parent / "migrations"
PROJECT = "sunny-dev"
VOLUME = "sunny-dev_pgdata"
SECRET_KEYS = (
    "SUNNY_PG_ADMIN_PASSWORD", "SUNNY_PG_APP_PASSWORD", "SUNNY_PG_AUTH_PASSWORD"
)
ROLE_KEYS = dict(zip(("sunny_admin", "sunny_app", "sunny_auth"), SECRET_KEYS))
FILE_PATTERN = re.compile(r"([0-9]{4})_([a-z][a-z0-9_]*)\.sql")


class DBError(Exception):
    pass


@dataclass(frozen=True)
class Migration:
    version: int
    name: str
    checksum: str
    sql: str


def read_migrations(directory: Path = MIGRATIONS) -> list[Migration]:
    migrations = []
    for path in sorted(directory.glob("*.sql")):
        match = FILE_PATTERN.fullmatch(path.name)
        if not match or path.is_symlink():
            raise DBError(f"Invalid migration file: {path.name}")
        raw = path.read_bytes()
        try:
            sql = raw.decode("utf-8")
        except UnicodeDecodeError as error:
            raise DBError(f"Migration must be UTF-8: {path.name}") from error
        if not sql.strip() or re.search(r"(?m)^\s*\\", sql):
            raise DBError(f"Migration must contain SQL only: {path.name}")
        if re.search(r"(?im)^\s*(BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION)\s*;", sql):
            raise DBError(f"Runner owns transaction boundaries: {path.name}")
        migrations.append(Migration(int(match[1]), path.name, hashlib.sha256(raw).hexdigest(), sql))
    if not migrations or [m.version for m in migrations] != list(range(1, len(migrations) + 1)):
        raise DBError("Migration versions must be unique and contiguous, starting at 0001")
    return migrations


def validate_history(migrations: list[Migration], history: list[dict]) -> None:
    expected = {m.version: m for m in migrations}
    versions = [int(row["version"]) for row in history]
    if versions != list(range(1, len(history) + 1)):
        raise DBError("Migration history is not a contiguous prefix")
    for row in history:
        migration = expected.get(int(row["version"]))
        if not migration or (row["name"], row["checksum"]) != (migration.name, migration.checksum):
            raise DBError(f"Missing or changed applied migration: {row['version']}")


def quote_sql(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def migration_script(migrations: list[Migration], lock_timeout: str = "5s") -> str:
    """Validate history under a session lock; DDL/history commit together per file."""
    if not re.fullmatch(r"[1-9][0-9]*(ms|s)", lock_timeout):
        raise DBError("Invalid lock timeout")
    manifest = ",\n".join(
        f"({m.version}, {quote_sql(m.name)}, {quote_sql(m.checksum)})" for m in migrations
    )
    parts = [rf"""\set ON_ERROR_STOP on
SET search_path = pg_catalog, pg_temp;
SET lock_timeout = '{lock_timeout}';
DO $$ BEGIN
    IF current_database() <> 'sunny' OR session_user <> 'sunny_admin' THEN
        RAISE EXCEPTION 'Only sunny development DB / sunny_admin is supported';
    END IF;
END $$;
SELECT pg_advisory_lock(20261014, 79);
CREATE TEMP TABLE migration_manifest(version integer PRIMARY KEY, name text, checksum text);
INSERT INTO migration_manifest VALUES {manifest};
SELECT to_regclass('sunny_meta.schema_migrations') IS NOT NULL AS history_exists
\gset
\if :history_exists
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM sunny_meta.schema_migrations h
        LEFT JOIN migration_manifest m USING (version)
        WHERE m.version IS NULL OR h.name <> m.name OR h.checksum <> m.checksum
    ) THEN
        RAISE EXCEPTION 'Missing or changed applied migration';
    END IF;
    IF (SELECT count(*) FROM sunny_meta.schema_migrations) <>
       COALESCE((SELECT max(version) FROM sunny_meta.schema_migrations), 0) THEN
        RAISE EXCEPTION 'Migration history is not a contiguous prefix';
    END IF;
END $$;
\endif
"""]
    for migration in migrations:
        parts.append(rf"""\if :history_exists
SELECT EXISTS (SELECT 1 FROM sunny_meta.schema_migrations WHERE version = {migration.version}) AS already_applied
\gset
\else
\set already_applied false
\endif
\if :already_applied
\echo skipped {migration.name}
\else
BEGIN;
SELECT clock_timestamp() AS migration_started_at
\gset
{migration.sql}
INSERT INTO sunny_meta.schema_migrations(version, name, checksum, execution_ms)
VALUES ({migration.version}, {quote_sql(migration.name)}, {quote_sql(migration.checksum)},
        floor(extract(epoch FROM (clock_timestamp() - :'migration_started_at'::timestamptz)) * 1000)::bigint);
COMMIT;
\set history_exists true
\echo applied {migration.name}
\endif
""")
    parts.append("SELECT pg_advisory_unlock(20261014, 79);\n")
    return "\n".join(parts)


def read_env(path: Path) -> dict[str, str]:
    if not path.is_file() or path.is_symlink():
        raise DBError("Run prepare first; no regular backend/.env.local found")
    if os.name != "nt" and stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise DBError("backend/.env.local must have permission 0600")
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "=" not in stripped:
            raise DBError("Invalid environment file line")
        key, value = stripped.split("=", 1)
        if key in values:
            raise DBError(f"Duplicate environment key: {key}")
        values[key] = value
    return values


def load_settings(path: Path = ENV_FILE) -> dict[str, str]:
    values = read_env(path)
    for key in SECRET_KEYS:
        if not values.get(key) or any(c in values[key] for c in "\r\n\x00"):
            raise DBError(f"Missing or invalid {key}; values are never printed")
    port = values.get("SUNNY_PG_PORT", "5434")
    if not port.isdigit() or not 1024 <= int(port) <= 65535:
        raise DBError("SUNNY_PG_PORT must be between 1024 and 65535")
    values["SUNNY_PG_PORT"] = port
    return {key: values[key] for key in ("SUNNY_PG_PORT", *SECRET_KEYS)}


def redacted(value: str, settings: dict[str, str]) -> str:
    for key in SECRET_KEYS:
        secret = settings.get(key)
        if secret:
            value = value.replace(secret, "[REDACTED]")
    return value


def command(args: list[str], *, settings: dict[str, str] | None = None,
            input_sql: str | None = None, env: dict | None = None,
            allowed_failure: bool = False) -> subprocess.CompletedProcess:
    result = subprocess.run(args, cwd=ROOT, env=env, input=input_sql,
                            text=True, capture_output=True, timeout=180)
    if result.returncode and not allowed_failure:
        detail = redacted(result.stderr.strip(), settings or {})
        raise DBError(detail or "Command failed")
    return result


def compose_args() -> list[str]:
    return ["docker", "compose", "--project-name", PROJECT, "--env-file", str(ENV_FILE),
            "-f", str(COMPOSE_FILE)]


def compose_env(settings: dict[str, str]) -> dict[str, str]:
    # Explicit local settings win over ambient shell variables without printing them.
    env = {key: value for key, value in os.environ.items()
           if not key.startswith(("SUNNY_PG_", "COMPOSE_", "PG"))}
    env.update(settings)
    return env


def compose(settings: dict[str, str], *args: str) -> subprocess.CompletedProcess:
    return command([*compose_args(), *args], settings=settings, env=compose_env(settings))


def sql(settings: dict[str, str], query: str) -> str:
    # Secret remains in the container environment; it is never an argv value.
    result = command([*compose_args(), "exec", "-T", "db", "sh", "-c",
                      'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql -X -qAt '
                      '-v ON_ERROR_STOP=1 -U sunny_admin -d sunny'],
                     settings=settings, env=compose_env(settings), input_sql=query)
    return result.stdout.strip()


def tcp_sql(settings: dict[str, str], role: str, query: str, *, wrong_password: bool = False) -> subprocess.CompletedProcess:
    if role not in ROLE_KEYS:
        raise DBError("Unknown runtime role")
    if not shutil.which("psql"):
        raise DBError("Host TCP check needs psql in PATH; DBeaver can also check TCP")
    env = compose_env(settings)
    env.update(PGPASSWORD="intentionally-wrong-test-password" if wrong_password else settings[ROLE_KEYS[role]],
               PGCONNECT_TIMEOUT="5", PGSSLMODE="disable")
    return command(["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1",
                    "-p", settings["SUNNY_PG_PORT"], "-U", role, "-d", "sunny"],
                   settings=settings, input_sql=query, env=env, allowed_failure=True)


def prepare() -> None:
    ignored = command(["git", "check-ignore", "-q", "backend/.env.local"], allowed_failure=True)
    if ignored.returncode:
        raise DBError("Local credential file is not ignored by Git")
    existing = read_env(ENV_FILE) if ENV_FILE.exists() else {}
    missing = [key for key in SECRET_KEYS if not existing.get(key)]
    if not missing:
        load_settings()
        print("Existing local credentials preserved")
        return
    volume = command(["docker", "volume", "ls", "--format", "{{.Name}}"])
    if VOLUME in volume.stdout.splitlines():
        raise DBError("Existing Sunny volume found; restore its credentials before prepare")
    additions = {key: secrets.token_hex(32) for key in missing}
    if not existing.get("SUNNY_PG_PORT"):
        additions["SUNNY_PG_PORT"] = "5434"
    original = ENV_FILE.read_bytes() if ENV_FILE.exists() else None
    lines = original.decode("utf-8").splitlines() if original is not None else []
    content = [line for line in lines if line.strip().split("=", 1)[0] not in additions]
    content.extend(["", "# Sunny independent development DB. Do not commit."])
    content.extend(f"{key}={value}" for key, value in additions.items())
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n",
                                         dir=ENV_FILE.parent, prefix=".env.local.", delete=False) as file:
            temp_path = Path(file.name)
            os.chmod(temp_path, 0o600)
            file.write("\n".join(content) + "\n")
        current = ENV_FILE.read_bytes() if ENV_FILE.exists() else None
        if current != original:
            raise DBError("Local settings changed during prepare; no file was replaced")
        os.replace(temp_path, ENV_FILE)
        load_settings()
    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink()
    print("Prepared ignored backend/.env.local (0600); existing values preserved, secrets not displayed")


def up(settings: dict[str, str]) -> None:
    compose(settings, "config", "-q")
    managed = compose(settings, "ps", "-q", "db").stdout.strip()
    if not managed:
        with socket.socket() as check:
            try:
                check.bind(("127.0.0.1", int(settings["SUNNY_PG_PORT"])))
            except OSError as error:
                raise DBError("Requested DB port is in use; existing service was preserved") from error
    result = compose(settings, "up", "-d", "--wait", "--wait-timeout", "90", "db")
    print("\n".join(line for line in redacted(result.stderr, settings).splitlines()
                    if line.startswith((" Container ", " Volume ", " Network ", " Image "))))
    if sql(settings, "SELECT count(*) FROM pg_roles WHERE rolname IN ('sunny_owner','sunny_app','sunny_auth');") != "3":
        raise DBError("DB is running but role initialization is incomplete; preserve volume and review init logs")
    print("PostgreSQL healthy; run migrate and check for schema/authentication validation")


def history(settings: dict[str, str]) -> list[dict]:
    if sql(settings, "SELECT to_regclass('sunny_meta.schema_migrations') IS NOT NULL;") != "t":
        return []
    return json.loads(sql(settings, "SELECT COALESCE(json_agg(h ORDER BY version), '[]'::json) "
                         "FROM (SELECT version, name, checksum FROM sunny_meta.schema_migrations) h;"))


def migrate(settings: dict[str, str]) -> None:
    output = sql(settings, migration_script(read_migrations()))
    print("\n".join(line for line in output.splitlines() if line.startswith(("applied ", "skipped "))))


def status(settings: dict[str, str]) -> None:
    migrations = read_migrations()
    applied = history(settings)
    validate_history(migrations, applied)
    for migration in migrations:
        state = "applied" if migration.version <= len(applied) else "pending"
        print(f"{state}: {migration.name}")


def check(settings: dict[str, str]) -> None:
    status(settings)
    for role in ROLE_KEYS:
        result = tcp_sql(settings, role, "SELECT current_database() || ':' || current_user; SELECT 1;")
        if result.returncode or result.stdout.strip() != f"sunny:{role}\n1":
            raise DBError(f"TCP authentication/SELECT 1 failed for {role}")
        if tcp_sql(settings, role, "SELECT 1;", wrong_password=True).returncode == 0:
            raise DBError(f"Wrong-password connection unexpectedly succeeded for {role}")
        print(f"TCP authenticated and wrong password rejected: {role}")
    for role, schema, forbidden in (("sunny_app", "app", "auth"), ("sunny_auth", "auth", "app")):
        flags = tcp_sql(settings, role, f"""SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls
            OR pg_has_role(current_user, 'sunny_owner', 'MEMBER')
            OR has_database_privilege(current_user, 'sunny', 'CREATE')
            OR has_database_privilege(current_user, 'sunny', 'TEMP')
            OR has_schema_privilege(current_user, '{schema}', 'CREATE')
            OR has_schema_privilege(current_user, '{forbidden}', 'USAGE')
            OR has_schema_privilege(current_user, 'sunny_meta', 'USAGE')
            FROM pg_roles WHERE rolname = current_user;""")
        if flags.returncode or flags.stdout.strip() != "f":
            raise DBError(f"Unexpected runtime privilege: {role}")
        for query in (f"BEGIN; CREATE TABLE {schema}.permission_probe(id integer); ROLLBACK;",
                      "BEGIN; SET ROLE sunny_owner; ROLLBACK;",
                      "SELECT * FROM sunny_meta.schema_migrations;"):
            result = tcp_sql(settings, role, query)
            if result.returncode == 0 or "permission denied" not in result.stderr:
                raise DBError(f"Runtime permission check failed for {role}")
        print(f"Runtime DDL, owner role and migration history access denied: {role}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("prepare", "up", "migrate", "status", "check", "down"))
    args = parser.parse_args()
    try:
        if args.action == "prepare":
            prepare()
        else:
            settings = load_settings()
            if args.action == "down":
                compose(settings, "down")
                print("Sunny DB stopped; named volume preserved")
            else:
                {"up": up, "migrate": migrate, "status": status, "check": check}[args.action](settings)
        return 0
    except (DBError, OSError, subprocess.TimeoutExpired) as error:
        print(f"DB operation failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
