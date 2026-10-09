import test from 'node:test';
import assert from 'node:assert/strict';
import { needsMfa, enrollTotp, verifyTotp, removeTotp } from './workforceSecurity.js';

test('MFA is required for an enrolled factor or mandatory business policy, including OAuth', () => {
  assert.equal(needsMfa({currentLevel:'aal1',nextLevel:'aal2'},{}),true);
  assert.equal(needsMfa({currentLevel:'aal1',nextLevel:'aal1'},{mfa_required:true}),true);
  assert.equal(needsMfa({currentLevel:'aal2',nextLevel:'aal2'},{mfa_required:true}),false);
  assert.equal(needsMfa({currentLevel:'aal1',nextLevel:'aal1'},{}),false);
});
test('enrollment delegates TOTP generation to Supabase', async () => {
  const data={id:'synthetic',totp:{secret:'synthetic-only',qr_code:'synthetic'}};
  const auth={mfa:{enroll:async args=>{assert.equal(args.factorType,'totp');return {data};}}};
  assert.equal(await enrollTotp(auth),data);
});
test('challenge ID and factor ID are bound during verification', async () => {
  const auth={mfa:{challenge:async args=>{assert.equal(args.factorId,'factor');return {data:{id:'challenge'}};},verify:async args=>{assert.deepEqual(args,{factorId:'factor',challengeId:'challenge',code:'123456'});return {data:{aal:'aal2'}};}}};
  assert.deepEqual(await verifyTotp(auth,'factor','123456'),{aal:'aal2'});
});
test('bad and expired MFA codes fail without leaking provider payloads', async () => {
  await assert.rejects(()=>verifyTotp({},'factor','123'));
  const auth={mfa:{challenge:async()=>({data:{id:'challenge'}}),verify:async()=>({error:{message:'CANARY_PRIVATE'}})}};
  await assert.rejects(()=>verifyTotp(auth,'factor','123456'),e=>!e.message.includes('CANARY_PRIVATE'));
});
test('replacement requires a verified backup factor and AAL2', async () => {
  const low={mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal1'}})}};
  await assert.rejects(()=>removeTotp(low,'one'));
  let removed=false;
  const auth={mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'}}),listFactors:async()=>({data:{totp:[{id:'one',status:'verified'}]}}),unenroll:async()=>{removed=true;return {};}}};
  await assert.rejects(()=>removeTotp(auth,'one')); assert.equal(removed,false);
  auth.mfa.listFactors=async()=>({data:{totp:[{id:'one',status:'verified'},{id:'two',status:'verified'}]}});
  await removeTotp(auth,'one'); assert.equal(removed,true);
});
