import unittest
from types import SimpleNamespace
from unittest.mock import patch, Mock
from fastapi import HTTPException
from pydantic import ValidationError
from backend.voice_design import VoiceDesignRequest, VoiceSaveRequest, candidate_ticket, verify_ticket, design_voice, save_voice, _upload_preview

SECRET = 'test-only-signing-key'
DESCRIPTION = 'A warm adult receptionist with a clear American accent and thoughtful delivery.'


class MemoryDB:
    def __init__(self): self.tables = {"businesses": [{"id": 7, "name": "Acme"}]}; self.writes = []
    @property
    def rows(self): return {r["id"]: r for r in self.tables.get("created_receptionists", [])}
    def table(self, name): return Query(self, name)


class Query:
    def __init__(self, db, table): self.db=db; self.table=table; self.filters=[]; self.operation='select'; self.payload=None
    def select(self, *_): return self
    def eq(self, key, value): self.filters.append((key,value)); return self
    def order(self, *_ , **kwargs): return self
    def limit(self, *_): return self
    def insert(self, value): self.operation='insert'; self.payload=value; return self
    def update(self, value): self.operation='update'; self.payload=value; return self
    def execute(self):
        table=self.db.tables.setdefault(self.table, [])
        if self.operation=='insert':
            if self.payload.get('design_candidate_id') and any(r.get('design_candidate_id') == self.payload.get('design_candidate_id') and r.get('user_id') == self.payload.get('user_id') and r.get('business_id') == self.payload.get('business_id') for r in table):
                raise RuntimeError('duplicate')
            row=dict(self.payload, id=len(table)+1); table.append(row)
            self.db.writes.append((self.table, self.operation))
            return SimpleNamespace(data=[dict(row)])
        rows=[v for v in table if all(str(v.get(k))==str(value) for k,value in self.filters)]
        if self.operation=='update':
            for row in rows: row.update(self.payload)
            self.db.writes.append((self.table, self.operation))
        return SimpleNamespace(data=[dict(r) for r in rows])


class VoiceDesignTests(unittest.TestCase):
    def test_boundaries_and_script_validation(self):
        for body in ({'voice_description':'short','auto_generate_text':True},
                     {'voice_description':DESCRIPTION},
                     {'voice_description':DESCRIPTION,'auto_generate_text':True,'loudness':1.1},
                     {'voice_description':DESCRIPTION,'auto_generate_text':True,'seed':-1},
                     {'voice_description':DESCRIPTION,'auto_generate_text':True,'quality':0},
                     {'voice_description':DESCRIPTION,'auto_generate_text':True,'guidance_scale':float('nan')},
                     {'voice_description':DESCRIPTION,'auto_generate_text':True,'invented_pitch':5}):
            with self.assertRaises(ValidationError): VoiceDesignRequest(**body)

    def test_save_accepts_catalog_sized_trait_set(self):
        payload = VoiceSaveRequest(ticket=candidate_ticket('candidate',DESCRIPTION,'owner',SECRET), voice_name='Avery', traits=['one','two','three','four','five','six'])
        self.assertEqual(len(payload.traits), 6)
        with self.assertRaises(ValidationError):
            VoiceSaveRequest(ticket=candidate_ticket('candidate',DESCRIPTION,'owner',SECRET), voice_name='Avery', traits=['one','two','three','four','five','six','seven'])

    def test_ticket_is_owned_signed_and_expiring(self):
        ticket=candidate_ticket('candidate',DESCRIPTION,'owner',SECRET,now=100)
        self.assertEqual(verify_ticket(ticket,'owner',SECRET,now=200)['id'],'candidate')
        for token,owner,now in [(ticket,'other',200),(ticket+'a','owner',200),(ticket,'owner',4000)]:
            with self.assertRaises(HTTPException): verify_ticket(token,owner,SECRET,now=now)

    @patch('backend.voice_design.provider_post')
    def test_candidate_count_and_ids_follow_provider(self, post):
        post.return_value={'text':'provider text','previews':[{'generated_voice_id':str(i),'audio_base_64':'YWJj'} for i in range(2)]}
        result=design_voice(VoiceDesignRequest(voice_description=DESCRIPTION,auto_generate_text=True),api_key=SECRET,owner_id='owner')
        self.assertEqual(len(result['previews']),2)
        self.assertEqual(result['text'],'provider text')
        self.assertNotIn('text',post.call_args.args[1])
        self.assertEqual(post.call_args.kwargs.get('params'), {'output_format': 'mp3_44100_128'})
        self.assertEqual(verify_ticket(result['previews'][1]['ticket'],'owner',SECRET)['id'],'1')

    @patch('backend.voice_design.provider_post')
    def test_empty_provider_result_does_not_fake_success(self,post):
        post.return_value={'previews':[]}
        with self.assertRaises(HTTPException): design_voice(VoiceDesignRequest(voice_description=DESCRIPTION,auto_generate_text=True),api_key=SECRET,owner_id='owner')

    def payload(self):
        return VoiceSaveRequest(ticket=candidate_ticket('candidate',DESCRIPTION,'owner',SECRET),voice_name='Avery',traits=['Thoughtful'])

    @patch('backend.voice_design.provider_post')
    def test_save_is_idempotent_and_uses_generated_description(self,post):
        post.return_value={'voice_id':'voice-1','preview_url':'https://example.com/preview.mp3'}
        db=MemoryDB(); args=dict(db=db,api_key=SECRET,owner_id='owner',business_id=7)
        first=save_voice(self.payload(),**args); second=save_voice(self.payload(),**args)
        self.assertEqual(first,second); self.assertEqual(post.call_count,1)
        self.assertTrue(post.call_args.args[1]['voice_description'].startswith(DESCRIPTION))
        self.assertIn('Acme', post.call_args.args[1]['voice_description'])
        row=next(iter(db.rows.values())); self.assertEqual(row['status'],'ready'); self.assertEqual(row['design_candidate_id'],'candidate')
        self.assertEqual(row['voice_preview_url'], 'https://example.com/preview.mp3')
        self.assertEqual(first['created_receptionist_id'], row['id'])
        self.assertTrue(all(table == 'created_receptionists' for table, operation in db.writes))

    @patch('backend.voice_design.provider_post')
    def test_uncertain_save_never_reissues_provider_creation(self,post):
        post.side_effect=HTTPException(504,'timeout')
        db=MemoryDB(); args=dict(db=db,api_key=SECRET,owner_id='owner',business_id=7)
        with self.assertRaises(HTTPException): save_voice(self.payload(),**args)
        with self.assertRaises(HTTPException) as error: save_voice(self.payload(),**args)
        self.assertEqual(error.exception.status_code,409); self.assertEqual(post.call_count,1)

    @patch('backend.voice_design.provider_post')
    def test_definitive_rejection_can_retry(self,post):
        error=HTTPException(502,'no slots'); error.provider_rejected=True
        post.side_effect=[error,{'voice_id':'voice-2'}]
        db=MemoryDB(); args=dict(db=db,api_key=SECRET,owner_id='owner',business_id=7)
        with self.assertRaises(HTTPException): save_voice(self.payload(),**args)
        self.assertEqual(save_voice(self.payload(),**args)['voice_id'],'voice-2')

    @patch('backend.voice_design.provider_post')
    def test_other_owner_cannot_save_candidate(self,post):
        with self.assertRaises(HTTPException): save_voice(self.payload(),db=MemoryDB(),api_key=SECRET,owner_id='other',business_id=8)
        post.assert_not_called()

    @patch('backend.voice_design._upload_preview', return_value='https://example.com/audition.mp3')
    @patch('backend.voice_design.upload_portrait', return_value='https://example.com/generated.png')
    @patch('backend.voice_design.provider_post', return_value={'voice_id': 'voice-portrait'})
    def test_save_preserves_generated_portrait_and_playable_audition_without_hiring(self, post, portrait, preview):
        db = MemoryDB()
        result = save_voice(self.payload(), db=db, api_key=SECRET, owner_id='owner', business_id=7)
        row = db.rows[result['created_receptionist_id']]
        self.assertEqual(row['selected_portrait_url'], 'https://example.com/generated.png')
        self.assertEqual(row['voice_preview_url'], 'https://example.com/audition.mp3')
        self.assertEqual(row['voice_id'], 'voice-portrait')
        self.assertEqual(db.tables.get('hired_receptionists', []), [])
        self.assertEqual(db.tables.get('receptionist_catalog', []), [])

    def test_preview_uses_audio_bucket_and_rejects_invalid_data(self):
        db = Mock()
        db.storage.from_.return_value.get_public_url.return_value = 'https://example.com/preview.mp3'
        self.assertEqual(_upload_preview(db, 'YWJj', owner_id='owner', candidate_id='candidate'), 'https://example.com/preview.mp3')
        db.storage.from_.assert_called_once_with('voices')
        self.assertEqual(db.storage.from_.return_value.upload.call_args.args[2]['content-type'], 'audio/mpeg')
        with self.assertRaises(HTTPException): _upload_preview(db, '!invalid!', owner_id='owner', candidate_id='candidate')


if __name__=='__main__': unittest.main()
