import test from 'node:test';
import assert from 'node:assert/strict';
import { readAllPages } from './pagination.js';

test('loads more than 500 records without gaps and preserves order', async () => {
  const records = Array.from({ length: 1203 }, (_, id) => ({ id }));
  const offsets = [];
  const result = await readAllPages(async (limit, offset) => {
    offsets.push(offset);
    return records.slice(offset, offset + limit);
  });
  assert.deepEqual(result, records);
  assert.deepEqual(offsets, [0, 500, 1000]);
});

test('exact page boundaries and empty workspaces terminate correctly', async () => {
  for (const count of [0, 500, 1000]) {
    const records = Array.from({ length: count }, (_, id) => id);
    assert.deepEqual(await readAllPages(async (limit, offset) => records.slice(offset, offset + limit)), records);
  }
});

test('later-page failures reject the refresh instead of publishing truncated data', async () => {
  await assert.rejects(readAllPages(async (limit, offset) => offset ? null : Array(limit).fill({})), /Could not refresh/);
});

test('navigation away prevents further reads', async () => {
  let stopped = false;
  let calls = 0;
  await readAllPages(async limit => { calls++; stopped = true; return Array(limit).fill({}); }, () => stopped);
  assert.equal(calls, 1);
});
