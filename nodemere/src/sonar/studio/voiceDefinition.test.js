import test from 'node:test';
import assert from 'node:assert/strict';
import { composeDescription } from './voiceDefinition.js';

test('guided choices are audible direction, never invented provider parameters', () => {
  const description=composeDescription({gender:'Feminine',age:'Mature',accent:'Irish',tone:'Calm',personality:['Direct','Thoughtful']},'');
  for (const part of ['mature feminine','Irish accent','calm','direct, thoughtful']) assert.ok(description.includes(part));
  assert.ok(description.length >= 20 && description.length <= 1000);
});
test('additional direction preserves the generated definition', () => {
  const values={gender:'Androgynous',personality:[]};
  assert.equal(composeDescription(values,'  Gentle pauses.  '),composeDescription(values,'')+'\n\nGentle pauses.');
});
