"""Use SUNNY_DB_TESTS=1 for tests against the dedicated local Sunny DB."""

import importlib.util
import json
import os
from pathlib import Path
import subprocess
import secrets
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
MODULE = Path(__file__).resolve().parents[1] / "manage.py"
spec = importlib.util.spec_from_file_location("sunny_db_manage", MODULE)
db = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = db
spec.loader.exec_module(db)


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.directory = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)

    def write(self, name, text="SELECT 1;\n"):
        path = self.directory / name
        path.write_text(text, encoding="utf-8")
        return path

    def test_duplicate_versions_rejected(self):
        self.write("0001_first.sql")
        self.write("0001_other.sql")
        with self.assertRaises(db.DBError):
            db.read_migrations(self.directory)

    def test_gaps_and_missing_first_version_rejected(self):
        self.write("0002_second.sql")
        with self.assertRaises(db.DBError):
            db.read_migrations(self.directory)

    def test_non_sql_psql_commands_and_transaction_control_rejected(self):
        for text in ("\\! echo unsafe\n", "COMMIT;\n", ""):
            self.write("0001_first.sql", text)
            with self.subTest(text=text), self.assertRaises(db.DBError):
                db.read_migrations(self.directory)

    def test_applied_sql_edit_changes_checksum(self):
        path = self.write("0001_first.sql")
        before = db.read_migrations(self.directory)
        history = [dict(version=1, name=before[0].name, checksum=before[0].checksum)]
        db.validate_history(before, history)
        path.write_text("SELECT 2;\n")
        with self.assertRaises(db.DBError):
            db.validate_history(db.read_migrations(self.directory), history)

    def test_unknown_renamed_and_incomplete_history_rejected(self):
        self.write("0001_first.sql")
        self.write("0002_second.sql")
        migrations = db.read_migrations(self.directory)
        for history in (
            [dict(version=2, name=migrations[1].name, checksum=migrations[1].checksum)],
            [dict(version=1, name="0001_renamed.sql", checksum=migrations[0].checksum)],
            [dict(version=1, name=migrations[0].name, checksum=migrations[0].checksum),
             dict(version=2, name=migrations[1].name, checksum=migrations[1].checksum),
             dict(version=3, name="0003_unknown.sql", checksum="0" * 64)],
        ):
            with self.subTest(history=history), self.assertRaises(db.DBError):
                db.validate_history(migrations, history)

    def test_local_file_wins_over_ambient_shell_settings(self):
        settings = {"SUNNY_PG_PORT": "5434", **{key: "local-only" for key in db.SECRET_KEYS}}
        with patch.dict(os.environ, {"SUNNY_PG_APP_PASSWORD": "shell-value", "COMPOSE_FILE": "other.yml",
                                      "PGOPTIONS": "unsafe", "KEEP_ME": "yes"}):
            env = db.compose_env(settings)
        self.assertEqual(env["SUNNY_PG_APP_PASSWORD"], "local-only")
        self.assertNotIn("COMPOSE_FILE", env)
        self.assertNotIn("PGOPTIONS", env)
        self.assertEqual(env["KEEP_ME"], "yes")

    def test_secrets_redacted_from_error_detail(self):
        settings = {key: "secret-value" for key in db.SECRET_KEYS}
        self.assertEqual(db.redacted("failed secret-value", settings), "failed [REDACTED]")

    def test_prepare_preserves_unrelated_local_values_and_existing_password(self):
        env_file = self.directory / ".env.local"
        env_file.write_text("OTHER_SETTING=preserve\nSUNNY_PG_APP_PASSWORD=existing-password\n")
        env_file.chmod(0o600)
        with patch.object(db, "ENV_FILE", env_file), patch.object(db, "command") as run:
            run.return_value = subprocess.CompletedProcess([], 0, stdout="", stderr="")
            # load_settings's default path is fixed at definition; use the same parser with the test file.
            original_loader = db.load_settings
            with patch.object(db, "load_settings", side_effect=lambda: original_loader(env_file)):
                db.prepare()
        values = db.read_env(env_file)
        self.assertEqual(values["OTHER_SETTING"], "preserve")
        self.assertEqual(values["SUNNY_PG_APP_PASSWORD"], "existing-password")
        self.assertTrue(values["SUNNY_PG_ADMIN_PASSWORD"])
        self.assertTrue(values["SUNNY_PG_AUTH_PASSWORD"])

    def test_existing_volume_without_credentials_does_not_generate_passwords(self):
        env_file = self.directory / ".env.local"
        env_file.write_text("OTHER_SETTING=preserve\n")
        env_file.chmod(0o600)
        before = env_file.read_bytes()
        with patch.object(db, "ENV_FILE", env_file), patch.object(db, "command") as run:
            run.side_effect = [subprocess.CompletedProcess([], 0, stdout="", stderr=""),
                               subprocess.CompletedProcess([], 0, stdout=db.VOLUME + "\n", stderr="")]
            with self.assertRaises(db.DBError):
                db.prepare()
        self.assertEqual(env_file.read_bytes(), before)


@unittest.skipUnless(os.environ.get("SUNNY_DB_TESTS") == "1", "opt-in local DB integration")
class DatabaseIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.settings = db.load_settings()
        cls.migrations = db.read_migrations()
        cls.initial_history = db.history(cls.settings)
        db.validate_history(cls.migrations, cls.initial_history)
        if not cls.initial_history:
            raise RuntimeError("Apply the foundation migration first")

    def test_repeat_apply_preserves_history(self):
        output = db.sql(self.settings, db.migration_script(self.migrations))
        self.assertIn("skipped 0001_database_foundation.sql", output)
        self.assertEqual(db.history(self.settings), self.initial_history)

    def test_changed_applied_sql_is_rejected_by_database(self):
        first = self.migrations[0]
        changed = db.Migration(first.version, first.name, "0" * 64, first.sql)
        with self.assertRaisesRegex(db.DBError, "changed applied migration"):
            db.sql(self.settings, db.migration_script([changed, *self.migrations[1:]]))
        self.assertEqual(db.history(self.settings), self.initial_history)

    def test_failed_migration_rolls_back_ddl_and_history(self):
        probe = db.Migration(len(self.migrations) + 1, "0002_rollback_probe.sql", "1" * 64,
                             "CREATE TABLE app.rollback_probe(id integer); SELECT 1 / 0;")
        with self.assertRaisesRegex(db.DBError, "division by zero"):
            db.sql(self.settings, db.migration_script([*self.migrations, probe]))
        self.assertEqual(db.sql(self.settings, "SELECT to_regclass('app.rollback_probe') IS NULL;"), "t")
        self.assertEqual(db.history(self.settings), self.initial_history)

    def test_session_lock_serializes_migrators(self):
        command = [*db.compose_args(), "exec", "-T", "db", "sh", "-c",
                   'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql -X -qAt '
                   '-v ON_ERROR_STOP=1 -U sunny_admin -d sunny']
        with subprocess.Popen(command, env=db.compose_env(self.settings), stdin=subprocess.PIPE,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) as holder:
            holder.stdin.write("SELECT pg_advisory_lock(20261014, 79); SELECT 'locked'; SELECT pg_sleep(3);\n")
            holder.stdin.flush()
            while True:
                line = holder.stdout.readline()
                if line.strip() == "locked":
                    break
                if not line:
                    self.fail("Could not acquire migration lock")
            started = time.monotonic()
            with self.assertRaisesRegex(db.DBError, "lock timeout"):
                db.sql(self.settings, db.migration_script(self.migrations, lock_timeout="500ms"))
            self.assertGreaterEqual(time.monotonic() - started, 0.4)
            holder.stdin.close()
            self.assertEqual(holder.wait(timeout=10), 0)
        self.assertEqual(db.history(self.settings), self.initial_history)

    def test_fresh_official_image_initializes_roles_with_actual_compose_entrypoint(self):
        # Capture resolved config privately; never print its secret environment.
        config = json.loads(db.compose(self.settings, "config", "--format", "json").stdout)
        service = config["services"]["db"]
        name = "sunny-dev-init-test-" + secrets.token_hex(4)
        env = db.compose_env(self.settings)
        env.update(service["environment"])
        args = ["docker", "run", "--rm", "-d", "--name", name, "--network", "none",
                "--tmpfs", "/var/lib/postgresql/data:rw"]
        for key in service["environment"]:
            args.extend(["--env", key])
        for volume in service["volumes"]:
            if volume["type"] == "bind":
                args.extend(["--mount", "type=bind,src=" + volume["source"] +
                             ",dst=" + volume["target"] + ",readonly"])
        args.extend(["--entrypoint", service["entrypoint"][0], service["image"],
                     *service["entrypoint"][1:]])
        db.command(args, settings=self.settings, env=env)
        try:
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                ready = db.command(["docker", "exec", name, "pg_isready", "-h", "127.0.0.1",
                                    "-U", "sunny_admin", "-d", "sunny"], allowed_failure=True)
                if ready.returncode == 0:
                    break
                time.sleep(0.2)
            else:
                self.fail("Fresh initialization did not reach final TCP readiness")
            result = db.command(["docker", "exec", "-i", name, "sh", "-c",
                                 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql -X -qAt '
                                 '-v ON_ERROR_STOP=1 -U sunny_admin -d sunny'],
                                settings=self.settings, input_sql="SELECT count(*) FROM pg_roles "
                                "WHERE rolname IN ('sunny_owner','sunny_app','sunny_auth');")
            self.assertEqual(result.stdout.strip(), "3")
        finally:
            # Only this test's no-network container and tmpfs are discarded.
            db.command(["docker", "stop", "--time", "10", name], allowed_failure=True)


if __name__ == "__main__":
    unittest.main()
