import test from 'node:test';
import assert from 'node:assert/strict';
import { auditedRead } from './auditedRead.js';

test('existing read chains use bounded body filters and preserve projection', async () => {
  let observed;
  const result=await auditedRead('people','id,notes',async (table,body)=>{observed={table,body};return [{id:1,notes:'synthetic'}];})
    .eq('business_id',1).gte('created_at','2026-01-01').order('id',{ascending:false}).range(20,29);
  assert.equal(result.error,null); assert.equal(result.data[0].id,1);
  assert.deepEqual(observed,{table:'people',body:{columns:'id,notes',filters:[{op:'eq',field:'business_id',value:1},{op:'gte',field:'created_at',value:'2026-01-01'}],order:[{field:'id',ascending:false,nullsFirst:false}],limit:10,offset:20}});
});
test('single and optional records retain Supabase response shape',async()=>{
  assert.deepEqual(await auditedRead('appointments','*',async(_,body)=>{assert.equal(body.single,'maybeSingle');return null;}).eq('id','synthetic').maybeSingle(),{data:null,error:null});
  assert.deepEqual(await auditedRead('people','id',async(_,body)=>{assert.equal(body.single,'single');return {id:1};}).single(),{data:{id:1},error:null});
});
test('failed reads neither fall back to direct Supabase nor expose payloads',async()=>{
  const result=await auditedRead('people','*',async()=>{throw new Error('SYNTHETIC_PRIVATE_CANARY');});
  assert.equal(result.data,null); assert.ok(result.error); assert.ok(!JSON.stringify(result).includes('CANARY'));
});
test('concurrent queries keep separate routing state',async()=>{
  const one=auditedRead('people','id',async(_,body)=>body.filters).eq('id',1);
  const two=auditedRead('people','id',async(_,body)=>body.filters).eq('id',2);
  const result=await Promise.all([one,two]); assert.equal(result[0].data[0].value,1); assert.equal(result[1].data[0].value,2);
});
