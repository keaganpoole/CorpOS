import test from 'node:test';
import assert from 'node:assert/strict';
import { receptionistHirePayload } from './receptionistHirePayload.js';

test('private creations use their creation identifier, never the shared catalog', () => {
  assert.deepEqual(receptionistHirePayload({ id: 'created:7', catalog_id: 'created:7', source: 'created_receptionist', created_receptionist_id: 7 }),
    { source: 'created_receptionist', created_receptionist_id: 7 });
});

test('voice clones retain their custom voice routing', () => {
  assert.deepEqual(receptionistHirePayload({ id: 'voice-clone:voice', source: 'voice_clone', custom_voice_id: 'voice' }),
    { source: 'voice_clone', custom_voice_id: 'voice' });
});

test('stock catalog identifiers and scalar callers retain their routing', () => {
  assert.deepEqual(receptionistHirePayload({ id: 12, catalog_id: 9 }), { catalog_id: 9, id: 9, source: undefined });
  assert.deepEqual(receptionistHirePayload(9), { catalog_id: 9 });
});
