#!/usr/bin/env python3
"""Preserve the local Sunny database while replacing its pre-merge foundation.

Schema comes exclusively from repository migrations in a fresh official image.
Source data/history are backed up and restored for rehearsal, never rewritten.
Only the explicit cutover/migrate actions interrupt runtime connections.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import time

import manage as db

SOURCE = "sunny"
CONTAINER = "sunny-dev-db-1"
LEGACY_FOUNDATION = "eaf86c2c3347fee441f8f630dc434f7cd4cd67d6b0956d011abeb184e9a0f36f"
SCHEMAS = ("auth", "app", "sunny_meta")


def identifier(value: str) -> str:
    if not re.fullmatch(r"[a-z][a-z0-9_]{0,62}", value):
        raise db.DBError("Unsafe database/object identifier")
    return '"' + value + '"'


def private_file(path: Path, content: bytes) -> None:
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as stream:
        stream.write(content)
        stream.flush()
        os.fsync(stream.fileno())


def save_state(directory: Path, state: dict) -> None:
    temporary = directory / ("state-" + secrets.token_hex(4) + ".tmp")
    private_file(temporary, (json.dumps(state, indent=2) + "\n").encode())
    os.replace(temporary, directory / "state.json")


def run(args: list[str], *, input_data: bytes | None = None, output: Path | None = None,
        source: Path | None = None, env: dict | None = None) -> bytes:
    # pg_restore errors may include private row values: never print raw stderr.
    with context_files(output, source) as (out, incoming):
        result = subprocess.run(args, input=input_data if incoming is None else None,
                                stdin=incoming, stdout=out or subprocess.PIPE,
                                stderr=subprocess.PIPE, env=env, timeout=180)
    if result.returncode:
        raise db.DBError("Database operation failed; private output was suppressed")
    return result.stdout or b""


@contextmanager
def context_files(output: Path | None, source: Path | None):
    out = incoming = None
    try:
        if output:
            out = os.fdopen(os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "wb")
        if source:
            incoming = source.open("rb")
        yield out, incoming
        if out:
            out.flush()
            os.fsync(out.fileno())
    finally:
        if out:
            out.close()
        if incoming:
            incoming.close()


def pg_args(container: str, program: str, database: str) -> list[str]:
    identifier(database)
    if program not in ("psql", "pg_dump", "pg_restore"):
        raise db.DBError("Unsupported PostgreSQL program")
    shell = 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec "$@"'
    return ["docker", "exec", "-i", container, "sh", "-c", shell, "sunny-upgrade",
            program, "-U", "sunny_admin", "-d", database]


def sql(database: str, query: str, container: str = CONTAINER) -> str:
    return run([*pg_args(container, "psql", database), "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
               input_data=query.encode()).decode("utf-8").strip()


def environment_check(settings: dict, *, runtime: bool = True) -> dict:
    info = json.loads(run(["docker", "inspect", CONTAINER]))[0]
    labels = info["Config"].get("Labels", {})
    port = info["NetworkSettings"]["Ports"].get("5432/tcp")
    if (labels.get("com.docker.compose.project") != "sunny-dev" or not info["State"]["Running"]
            or port != [{"HostIp": "127.0.0.1", "HostPort": settings["SUNNY_PG_PORT"]}]
            or not any(v.get("Name") == db.VOLUME for v in info["Mounts"])):
        raise db.DBError("Only the existing loopback sunny-dev development cluster is supported")
    if not info["Config"]["Image"].startswith("postgres:17-"):
        raise db.DBError("Expected PostgreSQL 17 official image")
    if sql("postgres", "SELECT session_user;") != "sunny_admin":
        raise db.DBError("Expected development administrator")
    for role in db.ROLE_KEYS if runtime else ("sunny_admin",):
        result = db.tcp_sql(settings, role, "SELECT current_user;")
        if result.returncode or result.stdout.strip() != role:
            raise db.DBError("Existing local credentials do not match the running DB")
    return {"container_id": info["Id"], "image": info["Config"]["Image"],
            "port": settings["SUNNY_PG_PORT"], "volume": db.VOLUME}


def history(database: str) -> list[dict]:
    return json.loads(sql(database, "SELECT json_agg(h ORDER BY version) FROM "
                         "(SELECT version,name,checksum FROM sunny_meta.schema_migrations) h;"))


def validate_source_history(rows: list[dict], migrations: list[db.Migration]) -> None:
    if len(rows) != len(migrations) or len(rows) != 3:
        raise db.DBError("This upgrade supports the reviewed 0001-0003 development state only")
    allowed = [{m.checksum} for m in migrations]
    allowed[0].add(LEGACY_FOUNDATION)
    for row, migration, checksums in zip(rows, migrations, allowed):
        if (row["version"] != migration.version or row["name"] != migration.name
                or row["checksum"] not in checksums):
            raise db.DBError("Unknown migration history; source database preserved")


def fingerprint(database: str, key: bytes, schemas: tuple[str, ...] = SCHEMAS) -> dict:
    schema_list = ",".join(db.quote_sql(s) for s in schemas)
    names = json.loads(sql(database, f"""SELECT COALESCE(json_agg(t ORDER BY schema,name),'[]') FROM (
        SELECT n.nspname AS schema,c.relname AS name FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ({schema_list}) AND c.relkind IN ('r','p') AND NOT c.relispartition
    ) t;"""))
    result = {}
    for table in names:
        qualified = identifier(table["schema"]) + "." + identifier(table["name"])
        data = run([*pg_args(CONTAINER, "psql", database), "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
                   input_data=(f"SET TIME ZONE 'UTC'; COPY (SELECT row_to_json(t)::text FROM {qualified} t "
                               "ORDER BY row_to_json(t)::text COLLATE \"C\") TO STDOUT;").encode())
        result[table["schema"] + "." + table["name"]] = {
            "count": int(sql(database, f"SELECT count(*) FROM {qualified};")),
            "hmac": hmac.new(key, data, hashlib.sha256).hexdigest(),
        }
    return result


def require_equal(expected: dict, actual: dict) -> None:
    if expected != actual:
        raise db.DBError("Database contents changed or failed comparison; cutover stopped")


def dump(directory: Path, name: str, database: str, container: str = CONTAINER,
         *, data_only: bool = False) -> dict:
    path = directory / name
    args = [*pg_args(container, "pg_dump", database), "--format=custom", "--lock-wait-timeout=5s"]
    if data_only:
        args += ["--data-only", "--schema=auth", "--schema=app"]
    run(args, output=path)
    return {"file": name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "bytes": path.stat().st_size}


def restore(database: str, path: Path, *, data_only: bool = False) -> None:
    args = [*pg_args(CONTAINER, "pg_restore", database), "--exit-on-error", "--single-transaction"]
    if data_only:
        args.append("--data-only")
    run(args, source=path)


def create_database(name: str) -> None:
    sql("postgres", f"CREATE DATABASE {identifier(name)} OWNER sunny_admin TEMPLATE template0;")
    sql("postgres", f"REVOKE ALL ON DATABASE {identifier(name)} FROM PUBLIC, sunny_app, sunny_auth;")


def fresh_template(directory: Path, settings: dict, image: str) -> dict:
    name = "sunny-foundation-template-" + secrets.token_hex(4)
    env = db.compose_env(settings)
    env.update(POSTGRES_DB="sunny", POSTGRES_USER="sunny_admin", POSTGRES_PASSWORD=settings[db.SECRET_KEYS[0]],
               POSTGRES_INITDB_ARGS="--auth-host=scram-sha-256 --auth-local=scram-sha-256")
    args = ["docker", "run", "--rm", "-d", "--name", name, "--network", "none",
            "--tmpfs", "/var/lib/postgresql/data:rw", "--mount",
            f"type=bind,src={db.ROOT / 'backend/postgres/init/001-roles.sh'},dst=/sunny-init/001-roles.sh,readonly"]
    for key in ("POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_INITDB_ARGS", *db.SECRET_KEYS[1:]):
        args += ["--env", key]
    entrypoint = ("set -eu; cp /sunny-init/001-roles.sh /docker-entrypoint-initdb.d/001-roles.sh; "
                  "chmod 0644 /docker-entrypoint-initdb.d/001-roles.sh; exec /usr/local/bin/docker-entrypoint.sh postgres")
    try:
        run([*args, "--entrypoint", "/bin/sh", image, "-c", entrypoint], env=env)
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            ready = subprocess.run(["docker", "exec", name, "pg_isready", "-h", "127.0.0.1",
                                    "-U", "sunny_admin", "-d", "sunny"], capture_output=True, timeout=5)
            if ready.returncode == 0:
                break
            time.sleep(0.2)
        else:
            raise db.DBError("Fresh template did not become ready")
        sql(SOURCE, db.migration_script(db.read_migrations()), name)
        return dump(directory, "new-foundation.dump", SOURCE, name)
    finally:
        subprocess.run(["docker", "stop", "--time", "10", name], capture_output=True, timeout=30)


def stage(directory: Path, settings: dict, *, runtime: bool = True) -> None:
    if directory.exists():
        raise db.DBError("State directory already exists; choose a new private directory")
    directory.mkdir(parents=True, mode=0o700)
    directory.chmod(0o700)
    state = {"phase": "preparing", **environment_check(settings, runtime=runtime)}
    migrations = db.read_migrations()
    state["source_history"] = history(SOURCE)
    validate_source_history(state["source_history"], migrations)
    if sql(SOURCE, """SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname NOT IN ('auth','app','sunny_meta','information_schema')
          AND n.nspname NOT LIKE 'pg_%' AND c.relkind IN ('r','p','m','S','f');""") != "0":
        raise db.DBError("Uncovered data objects found; source preserved")
    key = secrets.token_bytes(32)
    private_file(directory / "comparison.key", key)
    state["source"] = fingerprint(SOURCE, key)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S") + "_" + secrets.token_hex(3)
    state.update(candidate="sunny_upgrade_" + stamp, restored="sunny_restore_" + stamp,
                 archive="sunny_before_" + stamp)
    save_state(directory, state)
    state["backups"] = [dump(directory, "original-full.dump", SOURCE),
                        dump(directory, "original-data.dump", SOURCE, data_only=True)]
    require_equal(state["source"], fingerprint(SOURCE, key))
    save_state(directory, state)
    create_database(state["restored"])
    restore(state["restored"], directory / "original-full.dump")
    require_equal(state["source"], fingerprint(state["restored"], key))
    # Prove PostgreSQL supports the reversible atomic rename before touching sunny.
    restored = identifier(state["restored"])
    sql("postgres", f"BEGIN; ALTER DATABASE {restored} RENAME TO {identifier(state['restored'] + '_probe')}; ROLLBACK;")
    state["backups"].append(fresh_template(directory, settings, state["image"]))
    create_database(state["candidate"])
    restore(state["candidate"], directory / "new-foundation.dump")
    restore(state["candidate"], directory / "original-data.dump", data_only=True)
    application_data = {k: v for k, v in state["source"].items() if not k.startswith("sunny_meta.")}
    require_equal(application_data, fingerprint(state["candidate"], key, ("auth", "app")))
    db.validate_history(migrations, history(state["candidate"]))
    sql("postgres", f"""ALTER ROLE sunny_app IN DATABASE {identifier(state['candidate'])} SET search_path=pg_catalog,app;
        ALTER ROLE sunny_auth IN DATABASE {identifier(state['candidate'])} SET search_path=pg_catalog,auth;""")
    state["phase"] = "staged"
    save_state(directory, state)
    print("Backup restore and new-foundation data comparison passed; source is "
          + ("still active" if runtime else "preserved under the write pause"))
    print("Rows preserved: " + ", ".join(f"{k}={v['count']}" for k, v in application_data.items()))


def load_state(directory: Path) -> dict:
    for name in ("state.json", "comparison.key"):
        path = directory / name
        if path.is_symlink() or path.stat().st_mode & 0o077:
            raise db.DBError("Upgrade state must be private regular files")
    state = json.loads((directory / "state.json").read_text())
    for backup in state["backups"]:
        path = directory / backup["file"]
        if (path.parent != directory or path.is_symlink() or path.stat().st_mode & 0o077
                or hashlib.sha256(path.read_bytes()).hexdigest() != backup["sha256"]):
            raise db.DBError("Backup is missing, exposed or changed; cutover refused")
    for name in ("candidate", "restored", "archive"):
        identifier(state[name])
    return state


def cutover(directory: Path, settings: dict, *, runtime: bool = True) -> None:
    state = load_state(directory)
    if state["phase"] != "staged" or environment_check(settings, runtime=runtime)["container_id"] != state["container_id"]:
        raise db.DBError("Expected the staged source cluster; cutover refused")
    key = (directory / "comparison.key").read_bytes()
    candidate, archive = identifier(state["candidate"]), identifier(state["archive"])
    committed = frozen = False
    try:
        # Block new writers and disconnect only this DB's app/auth sessions.
        sql("postgres", "REVOKE CONNECT ON DATABASE sunny FROM sunny_app,sunny_auth; "
                        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='sunny' "
                        "AND usename IN ('sunny_app','sunny_auth');")
        frozen = True
        require_equal(state["source"], fingerprint(SOURCE, key))
        application_data = {k: v for k, v in state["source"].items() if not k.startswith("sunny_meta.")}
        require_equal(application_data, fingerprint(state["candidate"], key, ("auth", "app")))
        db.validate_history(db.read_migrations(), history(state["candidate"]))
        sql("postgres", f"""BEGIN;
            REVOKE CONNECT,TEMP ON DATABASE postgres,template1 FROM PUBLIC;
            ALTER DATABASE sunny RENAME TO {archive};
            ALTER DATABASE {candidate} RENAME TO sunny;
            COMMIT;""")
        committed = True
        state["phase"] = "cutover"
        save_state(directory, state)
        require_equal(application_data, fingerprint(SOURCE, key, ("auth", "app")))
        require_equal(state["source"], fingerprint(state["archive"], key))
        sql("postgres", "GRANT CONNECT ON DATABASE sunny TO sunny_app,sunny_auth;")
        db.check(settings)
        state["phase"] = "verified"
        save_state(directory, state)
        print("Cutover verified; original database, restored backup and private dumps preserved")
    except Exception:
        if committed:
            sql("postgres", "REVOKE CONNECT ON DATABASE sunny FROM sunny_app,sunny_auth; "
                            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='sunny' "
                            "AND usename IN ('sunny_app','sunny_auth');")
        raise
    finally:
        if frozen and not committed:
            sql("postgres", "GRANT CONNECT ON DATABASE sunny TO sunny_app,sunny_auth;")


def migrate(directory: Path, settings: dict) -> None:
    """Stage and switch under one runtime write pause when online data changed."""
    environment_check(settings)
    original_oid = sql("postgres", "SELECT oid FROM pg_database WHERE datname='sunny';")
    try:
        sql("postgres", "REVOKE CONNECT ON DATABASE sunny FROM sunny_app,sunny_auth; "
                        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='sunny' "
                        "AND usename IN ('sunny_app','sunny_auth');")
        stage(directory, settings, runtime=False)
        cutover(directory, settings, runtime=False)
    finally:
        # Before commit restore the old DB; a failed new DB stays blocked.
        if sql("postgres", "SELECT oid FROM pg_database WHERE datname='sunny';") == original_oid:
            sql("postgres", "GRANT CONNECT ON DATABASE sunny TO sunny_app,sunny_auth;")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("stage", "cutover", "migrate"))
    parser.add_argument("--state-dir", type=Path, required=True)
    args = parser.parse_args()
    try:
        directory = args.state_dir.absolute()
        # Backups may contain tokens: insist on the existing Git ignore namespace.
        if any(p.is_symlink() for p in (directory, *directory.parents)) or "secrets" not in directory.parts:
            raise db.DBError("Use a private ignored secrets directory without symlinks")
        {"stage": stage, "cutover": cutover, "migrate": migrate}[args.action](directory, db.load_settings())
        return 0
    except db.DBError as error:
        print(f"Upgrade stopped: {error}. Source/backup retained.", file=sys.stderr)
        return 1
    except (OSError, ValueError, subprocess.TimeoutExpired):
        print("Upgrade stopped; source/backup retained. No private database output was printed.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
