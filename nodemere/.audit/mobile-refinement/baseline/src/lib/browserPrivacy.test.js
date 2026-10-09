import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { clearLegacySensitiveStorage, readTransient, writeTransient, clearTransient } from './browserPrivacy.js';
const require=createRequire(import.meta.url);
const parser=require('@babel/parser');
const traverse=require('@babel/traverse').default;
const canary='SYNTHETIC_PHI_CANARY_amber_patient_condition';
const read=file=>fs.readFileSync(file,'utf8');

test('legacy sensitive caches removed without clearing auth or unrelated preferences',()=>{
  const entries=new Map([['nodemere:nest:history:1',canary],['sonar-onboarding2-draft',canary],['SONAR_colorbar_rules',canary],['SONAR_appointments_colorbar_rules',canary],['unrelated','keep'],['sb-test-auth-token','keep']]);
  const storage={get length(){return entries.size;},key:i=>[...entries.keys()][i],removeItem:k=>entries.delete(k)};
  clearLegacySensitiveStorage(storage);
  assert.equal(JSON.stringify([...entries]).includes(canary),false);
  assert.equal(entries.get('sb-test-auth-token'),'keep');assert.equal(entries.get('unrelated'),'keep');
});
test('disabled storage does not break sign-in',()=>{
  assert.doesNotThrow(()=>clearLegacySensitiveStorage({get length(){throw Error('disabled');}}));
});
test('temporary condition values never require browser persistence and clear on session change',()=>{
  writeTransient('rule',[canary]);assert.deepEqual(readTransient('rule'),[canary]);clearTransient();assert.deepEqual(readTransient('rule'),[]);
});
test('all application console output is static, including scenario and realtime handlers',()=>{
  function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):/\.(jsx?|tsx?)$/.test(e.name)&&!e.name.endsWith('.test.js')?[path.join(dir,e.name)]:[]);}
  let checked=0;
  for(const file of files('src')){
    const ast=parser.parse(read(file),{sourceType:'unambiguous',plugins:['jsx','typescript']});
    traverse(ast,{CallExpression(p){const n=p.node,c=n.callee;if(c.type==='MemberExpression'&&c.object.name==='console'&&['log','debug','info','warn','error','table','dir','trace'].includes(c.property.name)){
      checked++;assert.ok(n.arguments.length===1&&n.arguments[0].type==='StringLiteral',`${file}:${n.loc.start.line}`);
    }}});
  }
  assert.ok(checked>100);
});
test('NEST event history is not written to localStorage',()=>{
  const source=read('src/sonar/nest/NestRuntime.jsx');
  assert.doesNotMatch(source,/localStorage\.setItem\(historyStorageKey/);
  assert.match(source,/localStorage\.removeItem\(historyStorageKey\)/);
});
test('call search sends sensitive search text in body, not URL',()=>{
  const source=read('src/sonar/contexts/CallLogsContext.jsx');
  assert.match(source,/call-logs\/search/);assert.match(source,/JSON\.stringify/);
  assert.doesNotMatch(source,/params\.set\(['"]q/);
});
test('recording access request is in explicit play handler',()=>{
  const source=read('src/sonar/pages/CallLogsPage.jsx');
  const start=source.indexOf('const togglePlayback = async');
  const end=source.indexOf('return (',start);
  assert.match(source.slice(start,end),/\/playback/);
  assert.equal(source.match(/\/playback/g).length,1);
});
test('document object URLs are revoked and active previews sandboxed',()=>{
  const source=read('src/sonar/components/PersonDocumentsModal.jsx');
  assert.match(source,/URL\.revokeObjectURL/);assert.match(source,/sandbox=""/);
  assert.match(read('src/sonar/lib/api.js'),/URL\.createObjectURL/);
});
test('native MFA session refresh, logout cleanup, and workforce gate remain wired',()=>{
  const source=read('src/contexts/AuthContext.jsx');
  assert.match(source,/getAuthenticatorAssuranceLevel/);
  assert.match(source,/session\?\.access_token, refreshWorkforce/);
  assert.match(source,/removeAllChannels/);
  assert.match(read('src/App.jsx'),/<WorkforceGate>/);
});

test('both scenario builders select permitted invoice columns instead of raw provider data',()=>{
  for (const name of ['Scenarios','HomepageScenariosDemo']) {
    const source=read(`src/sonar/pages/Scenarios/${name}.jsx`);
    assert.match(source,/tableKey === 'invoices' \? 'id,user_id,person_id/);
    assert.match(source,/from\(tableKey\)\.select\(columns\)/);
  }
});

test('People sensitive fields are loaded through the authorized decryption API',()=>{
  const files=[
    'src/sonar/hooks/useLeads.js',
    'src/sonar/hooks/useAppointments.js',
    'src/sonar/lib/customFields.js',
    'src/sonar/pages/Scenarios/VariablesPane.jsx',
    'src/sonar/pages/Scenarios/HomepageVariablesPane.jsx',
    'src/sonar/pages/Scenarios/Scenarios.jsx',
    'src/sonar/pages/Scenarios/HomepageScenariosDemo.jsx',
  ];
  for(const file of files) assert.doesNotMatch(read(file),/\.from\(['"]people['"]\)/,file);
  const api=read('src/sonar/lib/api.js');
  assert.match(api,/getPeople:.*\/api\/sonar\/people/);
  assert.match(api,/getPerson:.*\/api\/sonar\/people\/\$\{encodeURIComponent\(id\)\}/);
  assert.match(read('src/sonar/pages/LiveMonitoringPage.jsx'),/from\('people'\)\.select\('id,created_at'\)/);
});
