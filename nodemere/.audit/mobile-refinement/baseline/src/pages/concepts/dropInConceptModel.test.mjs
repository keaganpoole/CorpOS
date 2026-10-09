import test from 'node:test';
import assert from 'node:assert/strict';
import {seedDropIns,toConceptTree,mergeConceptTree,moveActions,deleteAction,previewGraph,validateGraph} from './dropInConceptModel.js';

test('all five statuses seed valid Drop Ins and round-trip without losing action fields',()=>{
  const rows=seedDropIns();assert.equal(validateGraph(rows),'');
  const tree=toConceptTree(rows,'completed');
  tree.children[0].children[0].name='Review invitation';
  const result=mergeConceptTree(rows,tree,'completed');
  assert.equal(result.find(n=>n.id==='a1').purpose,'Request a Google review');
  assert.deepEqual(result.filter(n=>n.available_on_status!=='completed'),rows.filter(n=>n.available_on_status!=='completed'));
});
test('moving a parent retains its subtree and rejects cycles and status crossing',()=>{
  const rows=seedDropIns();const result=moveActions(rows,['alpha'],'beta');
  assert.equal(result.find(n=>n.id==='alpha').parent_id,'beta');
  assert.equal(result.find(n=>n.id==='a1').parent_id,'alpha');
  assert.equal(validateGraph(result),'');
  assert.throws(()=>moveActions(rows,['alpha'],'a1'),/itself/);
  assert.throws(()=>moveActions(rows,['alpha'],'pending-alpha'),/same status/);
});
test('disabled ancestors hide their branch without mutating child switches',()=>{
  const rows=seedDropIns().filter(n=>n.available_on_status==='completed');
  const disabled=rows.map(n=>n.id==='alpha'?{...n,is_active:false}:n);
  const visible=previewGraph(disabled);
  assert.ok(!visible.some(n=>['alpha','a1','a2','a3'].includes(n.id)));
  assert.equal(disabled.find(n=>n.id==='a1').is_active,true);
});
test('grouping and removing a parent retain child instructions',()=>{
  const rows=seedDropIns();const tree=toConceptTree(rows,'completed');
  const [first,second,...rest]=tree.children;
  tree.children=[{id:'new-group',name:'After the visit',children:[first,second]},...rest];
  const grouped=mergeConceptTree(rows,tree,'completed');
  assert.equal(validateGraph(grouped),'');
  const restored=deleteAction(grouped,'new-group');
  assert.equal(restored.find(n=>n.id==='alpha').parent_id,null);
  assert.equal(restored.find(n=>n.id==='a1').prompt,rows.find(n=>n.id==='a1').prompt);
});
