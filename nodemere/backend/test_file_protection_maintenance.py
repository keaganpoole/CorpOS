"""Synthetic, offline Storage maintenance tests. Never touches a real bucket."""
import json
import os
import unittest
from contextlib import ExitStack
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from backend.envelope import MAGIC, KeyUnavailable, b64, open_file
from backend.file_protection_maintenance import backfill_file
from backend.test_phase57_security import MemoryKeys

CANARY = b'SYNTHETIC_PRIVATE_FILE_CANARY'


class MemoryStorage:
    def __init__(self):
        self.objects = {}; self.uploads = []; self.reads = []; self.after_upload = None
    def from_(self, bucket):
        def download(path):
            self.reads.append((bucket,path))
            return self.objects[(bucket,path)]
        def upload(path,content,options):
            assert options['upsert'] == 'false'
            assert (bucket,path) not in self.objects
            self.objects[(bucket,path)] = content
            self.uploads.append((bucket,path))
            if self.after_upload: self.after_upload(bucket,path)
        # Intentionally no remove(): the migration must never delete a file.
        return SimpleNamespace(download=download,upload=upload)


class MemoryFiles(MemoryKeys):
    def __init__(self, row):
        super().__init__(); self.file = row; self.storage = MemoryStorage(); self.fail_commit = False
    def table(self,name):
        if name == 'business_data_keys': return super().table(name)
        return FileQuery(self)


class FileQuery:
    def __init__(self,db): self.db=db; self.filters=[]; self.values=None
    def select(self,*a): return self
    def limit(self,*a): return self
    def eq(self,k,v): self.filters.append((k,v)); return self
    def update(self,values): self.values=values; return self
    def execute(self):
        if not all(str(self.db.file.get(k))==str(v) for k,v in self.filters): return SimpleNamespace(data=[])
        if self.values:
            self.db.file.update(self.values)
            self.db.file['security_revision'] += 1
            if self.db.fail_commit: raise RuntimeError('Uncertain response after commit')
        return SimpleNamespace(data=[deepcopy(self.db.file)])


class FileMaintenanceTests(unittest.TestCase):
    def setUp(self):
        self.record = str(uuid4())
        self.source = 'business/1/person/1/original.pdf'
        self.db = MemoryFiles({'id':self.record,'business_id':1,'storage_path':self.source,
            'storage_bucket':'caller-documents','file_size':len(CANARY),'security_revision':0})
        self.db.storage.objects[('caller-documents',self.source)] = CANARY
        env = patch.dict(os.environ,{'NODEMERE_ENCRYPTION_MODE':'read-compatible',
            'NODEMERE_KEK_RING':json.dumps({'test':b64(os.urandom(32))}),'NODEMERE_ACTIVE_KEK':'test'})
        env.start(); self.addCleanup(env.stop)

    def run_file(self,**kwargs): return backfill_file(self.db,1,'people_docs',self.record,**kwargs)

    def test_preview_never_provisions_keys_or_writes(self):
        result=self.run_file()
        self.assertEqual(result['files_changed'],0); self.assertEqual(self.db.rows,[])
        self.assertEqual(self.db.storage.uploads,[]); self.assertEqual(self.db.file['storage_path'],self.source)
        self.assertNotIn(CANARY.decode(),json.dumps(result)); self.assertNotIn(self.source,json.dumps(result))

    def test_apply_copies_verifies_switches_and_keeps_original(self):
        result=self.run_file(apply=True); target=self.db.file['storage_path']
        self.assertEqual(result['files_changed'],1); self.assertNotEqual(target,self.source)
        self.assertEqual(self.db.storage.objects[('caller-documents',self.source)],CANARY)
        saved=self.db.storage.objects[('caller-documents',target)]
        self.assertTrue(saved.startswith(MAGIC)); self.assertNotIn(CANARY,saved)
        self.assertEqual(open_file(self.db,saved,business_id=1,bucket='caller-documents',path=target),CANARY)

    def test_foreign_business_or_record_cannot_download(self):
        for business,record in [(2,self.record),(1,str(uuid4()))]:
            with self.subTest(business=business),self.assertRaises(ValueError):
                backfill_file(self.db,business,'people_docs',record,apply=True)
        self.assertEqual(self.db.storage.reads,[])

    def test_wrong_bucket_rejected_before_download(self):
        self.db.file['storage_bucket']='public'
        with self.assertRaises(ValueError): self.run_file(apply=True)
        self.assertEqual(self.db.storage.reads,[])

    def test_oversized_metadata_rejected_before_download(self):
        self.db.file['file_size']=11*1024*1024
        with self.assertRaises(ValueError): self.run_file(apply=True)
        self.assertEqual(self.db.storage.reads,[])

    def test_actual_size_checked_even_if_metadata_lies(self):
        self.db.file['file_size']=0
        with patch.dict('backend.file_protection_maintenance.RESOURCES',{'people_docs':('storage_path',1)}),self.assertRaises(ValueError):
            self.run_file(apply=True)
        self.assertEqual(self.db.storage.uploads,[])

    def test_missing_key_stops_before_upload(self):
        with patch.dict(os.environ,{'NODEMERE_KEK_RING':'{}'}),self.assertRaises(KeyUnavailable): self.run_file(apply=True)
        self.assertEqual(self.db.storage.uploads,[]); self.assertEqual(self.db.file['storage_path'],self.source)

    def test_corrupt_encrypted_source_is_not_replaced(self):
        self.db.file['storage_path']=self.source+'.ndmenc'
        self.db.storage.objects[('caller-documents',self.source+'.ndmenc')]=CANARY
        with self.assertRaises(KeyUnavailable): self.run_file(apply=True)
        self.assertEqual(self.db.storage.uploads,[])

    def test_corrupt_uploaded_copy_does_not_switch_pointer(self):
        self.db.storage.after_upload=lambda bucket,path:self.db.storage.objects.update({(bucket,path):b'corrupt'})
        with self.assertRaises(KeyUnavailable): self.run_file(apply=True)
        self.assertEqual(self.db.file['storage_path'],self.source)
        self.assertEqual(self.db.storage.objects[('caller-documents',self.source)],CANARY)

    def test_source_overwrite_is_detected(self):
        self.db.storage.after_upload=lambda bucket,path:self.db.storage.objects.update({(bucket,self.source):b'newer content'})
        with self.assertRaises(ValueError): self.run_file(apply=True)
        self.assertEqual(self.db.file['storage_path'],self.source)

    def test_concurrent_pointer_change_is_not_overwritten(self):
        self.db.storage.after_upload=lambda bucket,path:self.db.file.update(storage_path='business/1/newer.pdf')
        with self.assertRaises(ValueError): self.run_file(apply=True)
        self.assertEqual(self.db.file['storage_path'],'business/1/newer.pdf')

    def test_uncertain_commit_never_deletes_referenced_copy(self):
        self.db.fail_commit=True
        with self.assertRaises(RuntimeError): self.run_file(apply=True)
        self.assertIn(('caller-documents',self.db.file['storage_path']),self.db.storage.objects)
        self.assertIn(('caller-documents',self.source),self.db.storage.objects)

    def test_encrypted_source_can_be_verified_and_reencrypted(self):
        self.run_file(apply=True); previous=self.db.file['storage_path']
        self.assertTrue(self.run_file()['source_encrypted'])
        self.run_file(apply=True)
        self.assertNotEqual(previous,self.db.file['storage_path'])
        self.assertIn(('caller-documents',previous),self.db.storage.objects)

    def test_recording_uses_revision_compare_and_swap(self):
        self.db.file['audio_storage_path']='elevenlabs/agent/conversation.mp3'
        self.db.storage.objects[('call_recordings',self.db.file['audio_storage_path'])]=CANARY
        self.db.storage.after_upload=lambda bucket,path:self.db.file.update(security_revision=1)
        with self.assertRaises(ValueError): backfill_file(self.db,1,'call_logs',self.record,apply=True)
        self.assertEqual(self.db.file['audio_storage_path'],'elevenlabs/agent/conversation.mp3')

    def test_recording_roundtrip(self):
        self.db.file['audio_storage_path']='elevenlabs/agent/conversation.mp3'
        self.db.storage.objects[('call_recordings',self.db.file['audio_storage_path'])]=CANARY
        result=backfill_file(self.db,1,'call_logs',self.record,apply=True)
        self.assertEqual(result['files_changed'],1)
        target=self.db.file['audio_storage_path']
        self.assertEqual(open_file(self.db,self.db.storage.objects[('call_recordings',target)],business_id=1,bucket='call_recordings',path=target),CANARY)


class DocumentUploadRecoveryTests(unittest.TestCase):
    def upload(self, *, uncertain_insert=False, failed_completion=False):
        from backend import document_service
        db=MagicMock(); saved=[]
        people=MagicMock(); people.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data=[{'id':1}]
        documents=MagicMock()
        def insert(row):
            def execute():
                saved.append(row)
                if uncertain_insert: raise TimeoutError('SYNTHETIC_SENSITIVE_PROVIDER_ERROR')
                return SimpleNamespace(data=[])
            return SimpleNamespace(execute=execute)
        documents.insert.side_effect=insert
        db.table.side_effect=lambda name:people if name=='people' else documents
        with ExitStack() as stack:
            stack.enter_context(patch.object(document_service,'load_request_by_token',return_value={'id':str(uuid4()),'status':'pending','person_id':1,'business_id':1}))
            stack.enter_context(patch('backend.request_service.expire_if_needed',side_effect=lambda db,row:row))
            stack.enter_context(patch.object(document_service,'encryption_required',return_value=False))
            stack.enter_context(patch.object(document_service,'seal_file',side_effect=lambda db,content,**kwargs:content))
            complete=stack.enter_context(patch.object(document_service,'complete_request',return_value={'completed_at':'synthetic'}))
            if failed_completion: complete.side_effect=TimeoutError('SYNTHETIC_SENSITIVE_PROVIDER_ERROR')
            result=document_service.store_document(db,token='synthetic-token',filename='test.txt',content_type='text/plain',content=CANARY,notice_accepted=True)
        db.storage.from_.return_value.remove.assert_not_called()
        self.assertNotIn('SYNTHETIC_SENSITIVE_PROVIDER_ERROR',json.dumps(result))
        return result,saved

    def test_timeout_after_insert_never_deletes_committed_file(self):
        result,saved=self.upload(uncertain_insert=True)
        self.assertEqual(len(saved),1); self.assertEqual(result['status'],'upload_unconfirmed')

    def test_request_completion_failure_preserves_saved_file(self):
        result,saved=self.upload(failed_completion=True)
        self.assertFalse(result['success']); self.assertEqual(len(saved),1)

    def test_empty_insert_representation_still_returns_real_document_id(self):
        result,saved=self.upload()
        self.assertTrue(result['success']); self.assertEqual(result['document_id'],saved[0]['id'])


if __name__=='__main__': unittest.main()
