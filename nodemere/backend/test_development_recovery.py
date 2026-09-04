"""Windows development backup protection, with no environment-file mutation."""
import os
import unittest
from unittest.mock import patch
from backend.development_key_setup import protect, setup


@unittest.skipUnless(os.name=='nt','Windows DPAPI development setup')
class DevelopmentRecoveryTests(unittest.TestCase):
    def test_protected_backup_roundtrip(self):
        content=b'SYNTHETIC_DEVELOPMENT_RECOVERY_CANARY'+os.urandom(32)
        blob=protect(content)
        self.assertNotIn(content,blob)
        self.assertEqual(protect(blob,decrypt=True),content)

    def test_damaged_backup_is_rejected(self):
        blob=bytearray(protect(b'SYNTHETIC_RECOVERY'));blob[-1]^=1
        with self.assertRaises(RuntimeError):protect(bytes(blob),decrypt=True)

    def test_production_setup_refused_before_writes(self):
        values={'SUPABASE_URL':'https://grpgmhhtmfiwukncucaq.supabase.co','NODEMERE_ENV':'production'}
        with patch('backend.development_key_setup.dotenv_values',return_value=values),patch('backend.development_key_setup.private_directory') as directory:
            with self.assertRaises(RuntimeError):setup()
            directory.assert_not_called()
