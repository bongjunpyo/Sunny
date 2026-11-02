"""Safety gates for the one-time data-preserving development DB upgrade."""
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import upgrade_foundation as upgrade


class UpgradeTests(unittest.TestCase):
    def test_database_names_cannot_inject_commands(self):
        for name in ('sunny; DROP DATABASE sunny', 'a"b', '../secret', 'A', 'x' * 64, ''):
            with self.subTest(name=name), self.assertRaises(upgrade.db.DBError):
                upgrade.identifier(name)
        self.assertEqual(upgrade.identifier('sunny_upgrade_20261102_ab12'), '"sunny_upgrade_20261102_ab12"')

    def test_only_reviewed_legacy_history_or_current_history_is_accepted(self):
        migrations = upgrade.db.read_migrations()
        rows = [dict(version=m.version, name=m.name, checksum=m.checksum) for m in migrations]
        upgrade.validate_source_history(rows, migrations)
        rows[0]['checksum'] = upgrade.LEGACY_FOUNDATION
        upgrade.validate_source_history(rows, migrations)
        for changed in (rows[:2], [*rows, rows[-1]],
                        [rows[0], {**rows[1], 'checksum':'0'*64}, rows[2]],
                        [{**rows[0], 'name':'0001_other.sql'}, *rows[1:]]):
            with self.subTest(rows=changed), self.assertRaises(upgrade.db.DBError):
                upgrade.validate_source_history(changed, migrations)

    def test_row_count_or_content_difference_stops_cutover(self):
        expected = {'auth.session':{'count':7, 'hmac':'original'}}
        for changed in ({}, {'auth.session':{'count':6, 'hmac':'original'}},
                        {'auth.session':{'count':7, 'hmac':'different'}}):
            with self.subTest(changed=changed), self.assertRaises(upgrade.db.DBError):
                upgrade.require_equal(expected, changed)

    def test_private_backups_and_tampered_archive_detection(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            upgrade.private_file(directory/'comparison.key', b'synthetic-key')
            archive = directory/'original-full.dump'
            upgrade.private_file(archive, b'synthetic-archive')
            state = dict(candidate='sunny_upgrade_test',restored='sunny_restore_test',archive='sunny_before_test',
                         backups=[dict(file=archive.name,sha256=hashlib.sha256(archive.read_bytes()).hexdigest())])
            upgrade.save_state(directory, state)
            self.assertEqual(upgrade.load_state(directory), state)
            self.assertEqual(os.stat(archive).st_mode & 0o777, 0o600)
            archive.write_bytes(b'changed')
            with self.assertRaisesRegex(upgrade.db.DBError,'Backup'):
                upgrade.load_state(directory)

    def test_changed_source_restores_original_connect_privileges_without_rename(self):
        state = dict(phase='staged',container_id='id',candidate='sunny_upgrade_test',archive='sunny_before_test',
                     source={'auth.user':{'count':1,'hmac':'original'}})
        with tempfile.TemporaryDirectory() as temporary:
            directory=Path(temporary)
            upgrade.private_file(directory/'comparison.key',b'synthetic-key')
            with patch.object(upgrade,'load_state',return_value=state), \
                    patch.object(upgrade,'environment_check',return_value={'container_id':'id'}), \
                    patch.object(upgrade,'fingerprint',return_value={}), patch.object(upgrade,'sql') as sql:
                with self.assertRaisesRegex(upgrade.db.DBError,'contents changed'):
                    upgrade.cutover(directory,{})
                queries=[call.args[1] for call in sql.call_args_list]
                self.assertTrue(queries[0].startswith('REVOKE CONNECT'))
                self.assertEqual(queries[-1],'GRANT CONNECT ON DATABASE sunny TO sunny_app,sunny_auth;')
                self.assertFalse(any('RENAME' in query for query in queries))

    def test_write_pause_failure_restores_access_without_switching_database(self):
        with patch.object(upgrade,'environment_check'), patch.object(upgrade,'sql') as sql, \
                patch.object(upgrade,'stage',side_effect=upgrade.db.DBError('synthetic failure')), \
                patch.object(upgrade,'cutover') as cutover:
            with self.assertRaisesRegex(upgrade.db.DBError,'synthetic failure'):
                upgrade.migrate(Path('/synthetic/secrets/state'),{})
            cutover.assert_not_called()
            self.assertEqual(sql.call_args_list[-1].args[1],
                             'GRANT CONNECT ON DATABASE sunny TO sunny_app,sunny_auth;')

    def test_failure_after_database_switch_does_not_reopen_unverified_database(self):
        with patch.object(upgrade,'environment_check'), \
                patch.object(upgrade,'sql') as sql, patch.object(upgrade,'stage'), \
                patch.object(upgrade,'cutover',side_effect=upgrade.db.DBError('verification failed')):
            sql.side_effect=['old-oid','', 'new-oid']
            with self.assertRaisesRegex(upgrade.db.DBError,'verification failed'):
                upgrade.migrate(Path('/synthetic/secrets/state'),{})
            self.assertFalse(any(call.args[1].startswith('GRANT CONNECT') for call in sql.call_args_list))


if __name__ == '__main__':
    unittest.main()
