import test from 'node:test';
import assert from 'node:assert/strict';
import { ancestry, builderPayload, descendants, freePosition, layoutGraph, orderByPosition, previewGraph, removeNode, validateGraph, visibleGraph } from './dropInGraph.js';
const node = (id, parent_id=null, extra={}) => ({id,parent_id,name:id,purpose:'follow up',prompt:'Ask about the visit.',is_active:true,available_on_status:'completed',sort_order:0,...extra});

test('vertical layout is compact, non-overlapping and preserves saved positions',()=>{
  const nodes=layoutGraph([node('root'),node('a','root'),node('b','root'),node('c','root'),node('d','root'),node('e','b'),node('f','b'),node('g','b')]);
  assert.equal(nodes[1].canvas_y,146); assert.equal(nodes[5].canvas_y,292);
  assert.ok(Math.max(...nodes.map(x=>x.canvas_x))-Math.min(...nodes.map(x=>x.canvas_x))<1000);
  assert.equal(layoutGraph([{...nodes[0],canvas_x:900}])[0].canvas_x,900);
});
test('all descendants and ancestors with no recursive depth limit',()=>{
  const nodes=Array.from({length:2000},(_,i)=>node(String(i),i?String(i-1):null));
  assert.equal(descendants(nodes,'0').size,1999); assert.equal(ancestry(nodes,'1999').length,1999);
  assert.equal(layoutGraph(nodes).at(-1).canvas_y,1999*146);
});
test('inactive parent hides descendants without mutating definitions',()=>{
  const nodes=[node('a',null,{is_active:false}),node('b','a'),node('c','b'),node('d')];
  assert.deepEqual(previewGraph(nodes).map(x=>x.id),['d']); assert.equal(nodes[1].is_active,true);
});
test('deleting a parent promotes children exactly one level',()=>{
  const nodes=[node('a'),node('b','a'),node('c','b'),node('d','c')];
  const result=removeNode(nodes,'b'); assert.equal(result.find(x=>x.id==='c').parent_id,'a'); assert.equal(result.find(x=>x.id==='d').parent_id,'c');
});
test('collapsed branches hide all descendants, not siblings',()=>{
  assert.deepEqual(visibleGraph([node('a'),node('b','a'),node('c'),node('d','b')],new Set(['a'])).map(x=>x.id),['a','c']);
});
test('free placement avoids existing nodes and respects parent depth',()=>{
  const nodes=layoutGraph([node('a'),node('b','a')]); const p=freePosition(nodes,'a');
  assert.ok(p.y>nodes[0].canvas_y); assert.ok(Math.abs(p.x-nodes[1].canvas_x)>212);
});
test('cycles, foreign statuses, orphan parents, invalid fields rejected',()=>{
  assert.match(validateGraph([node('a','a')]),/itself/);
  assert.match(validateGraph([node('a'),node('b','a',{available_on_status:'pending'})]),/status/);
  assert.match(validateGraph([node('a','missing')]),/status/);
  assert.match(validateGraph([node('a',null,{name:' '})]),/Complete/);
});
test('payload includes stable IDs, graph geometry and optimistic revisions',()=>{
  const baseline=[node('a',null,{updated_at:'2026-09-08T00:00:00Z'})]; const result=builderPayload(layoutGraph(baseline),baseline);
  assert.equal(result.items[0].canvas_x,0); assert.equal(result.items[0].parent_id,null);
  assert.deepEqual(result.baseline,[{id:'a',updated_at:'2026-09-08T00:00:00Z'}]);
});
test('drag ordering changes only siblings in the selected status',()=>{
  const items=[node('a',null,{canvas_x:200,canvas_y:0}),node('b',null,{canvas_x:0,canvas_y:0}),node('c',null,{available_on_status:'pending',sort_order:8,canvas_x:0,canvas_y:0})];
  const result=orderByPosition(items,'completed',null);
  assert.equal(result[0].sort_order,1);assert.equal(result[1].sort_order,0);assert.equal(result[2].sort_order,8);
});
test('a parent remains a folder when every child is inactive',()=>{
  const result=previewGraph([node('a'),node('b','a',{is_active:false})]);
  assert.equal(result.length,1);assert.equal(result[0].has_children,true);
});
