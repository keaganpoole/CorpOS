import test from 'node:test';
import assert from 'node:assert/strict';
import { buildToneDirection, composeDescription, describeToneWeights, inferLoudnessFromToneWeights } from './voiceDefinition.js';

test('guided choices become natural voice direction, never invented provider parameters', () => {
  const description=composeDescription({gender:'Female',age:'Mature',accent:'Irish',subAccent:'Dublin',toneWeights:{Calm:70,Caring:35}},'');
  for (const part of ['mature female','natural irish accent, lightly colored by dublin','led by a steady and reassuring calm','care come through as']) assert.ok(description.toLowerCase().includes(part));
  assert.ok(!description.toLowerCase().includes('calm strongly'));
  assert.ok(description.length >= 20 && description.length <= 1000);
});
test('additional direction preserves the generated definition', () => {
  const values={gender:'Male',toneWeights:{}};
  assert.equal(composeDescription(values,'  Gentle pauses.  '),composeDescription(values,'')+'\n\nGentle pauses.');
  assert.ok(composeDescription(values,'').startsWith('An adult male receptionist voice.'));
});
test('tone weights keep a compact UI summary without driving prompt prose', () => {
  assert.equal(describeToneWeights({Friendly:25,Caring:90,Calm:0,Serious:60}),'caring defining, serious leading, friendly accent');
});
test('tone direction handles leading, supporting, accent, and avoid language', () => {
  const direction=buildToneDirection({Charming:75,Friendly:45,Calm:35,Caring:20,Motivational:0});
  assert.ok(direction.includes('led by a polished and approachable charm'));
  assert.ok(direction.includes('friendliness and calm come through as supporting qualities'));
  assert.ok(direction.includes('light trace of care'));
  assert.ok(direction.includes('Avoid making the delivery feel motivational'));
});
test('tone weights infer a real ElevenLabs loudness value', () => {
  assert.equal(inferLoudnessFromToneWeights({Motivational:80,Playful:40}),.4);
  assert.equal(inferLoudnessFromToneWeights({Calm:80,Serious:40}),-.2);
  assert.equal(inferLoudnessFromToneWeights({}),.25);
});
