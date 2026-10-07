import test from 'node:test';
import assert from 'node:assert/strict';
import { groupDropIns, stabilizeDropInGroups } from './dropInGrouping.js';

const makeItem = (id, status, overrides = {}) => ({
  id, available_on_status: status, name: 'Confirm', purpose: 'confirm',
  prompt: 'Ask the customer to confirm.', sort_order: 0, ...overrides,
});

test('matching drop-ins across statuses share one card', () => {
  const groups = groupDropIns([
    makeItem('completed-copy', 'completed'),
    makeItem('pending-copy', 'pending'),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].byStatus.pending.id, 'pending-copy');
  assert.equal(groups[0].byStatus.completed.id, 'completed-copy');
});

test('different content and duplicate rows in one status remain separate cards', () => {
  const groups = groupDropIns([
    makeItem('one', 'pending'),
    makeItem('two', 'pending'),
    makeItem('three', 'completed', { prompt: 'Different prompt' }),
  ]);
  assert.equal(groups.length, 3);
});

test('adding an earlier-status copy does not move or remount its card', () => {
  const confirm = makeItem('confirm', 'pending', { name: 'Confirm', sort_order: 0 });
  const reschedule = makeItem('reschedule', 'cancelled', { name: 'Reschedule', sort_order: 0 });
  const initial = stabilizeDropInGroups(groupDropIns([confirm, reschedule]));
  const added = makeItem('completed-copy', 'completed', { name: 'Reschedule', sort_order: 0 });
  const updated = stabilizeDropInGroups(groupDropIns([confirm, reschedule, added]), initial);
  const before = initial.find(group => group.primary.name === 'Reschedule');
  const after = updated.find(group => group.primary.name === 'Reschedule');
  assert.equal(after.id, before.id);
  assert.equal(after.position, before.position);
  assert.deepEqual(updated.sort((a, b) => a.position - b.position).map(group => group.primary.name), ['Confirm', 'Reschedule']);
});

test('temporary server IDs do not change a new card position', () => {
  const optimistic = stabilizeDropInGroups(groupDropIns([makeItem('pending-temp', 'pending')]));
  const saved = stabilizeDropInGroups(groupDropIns([makeItem('server-id', 'pending')]), optimistic);
  assert.equal(saved[0].id, optimistic[0].id);
  assert.equal(saved[0].position, optimistic[0].position);
});

test('removing the first status copy keeps the remaining card in place', () => {
  const initial = stabilizeDropInGroups(groupDropIns([
    makeItem('pending-copy', 'pending'),
    makeItem('completed-copy', 'completed'),
  ]));
  const updated = stabilizeDropInGroups(groupDropIns([makeItem('completed-copy', 'completed')]), initial);
  assert.equal(updated[0].id, initial[0].id);
  assert.equal(updated[0].position, initial[0].position);
});
