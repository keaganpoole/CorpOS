import assert from 'node:assert/strict';
import test from 'node:test';
import { createVisitorInsights, formatDuration, mergeRecentActivity } from './visitorIntelligence.js';

test('insights stay empty until aggregate samples are meaningful', () => {
  assert.deepEqual(createVisitorInsights({ overview: { visitors: 4 }, homepage: { sections: [{ id: 'hero', label: 'Hero', unique_visitors: 4, attention_score: 99 }] }, deep: { acquisition: { sources: [] } }, comparison: {} }), []);
});

test('insights deterministically identify attention and dropoff sections', () => {
  const insights = createVisitorInsights({
    overview: { visitors: 20 },
    homepage: { sections: [
      { id: 'hero', label: 'Hero', unique_visitors: 20, attention_score: 72, reach_rate: 100, average_visible_seconds: 19, dropoff_rate: 10, dropoffs: 2 },
      { id: 'calendar', label: 'Calendar', unique_visitors: 12, attention_score: 40, reach_rate: 60, average_visible_seconds: 8, dropoff_rate: 50, dropoffs: 6 },
    ] },
    deep: { acquisition: { sources: [{ source: 'Direct', visitors: 12 }] } },
    comparison: {},
  });
  assert.equal(insights[0].section, 'hero');
  assert.equal(insights[1].section, 'calendar');
  assert.equal(insights[2].kind, 'source');
});

test('recent activity never replays duplicate event ids', () => {
  const merged = mergeRecentActivity([{ id: 'one', occurred_at: '2026-09-05T10:00:00Z' }], [
    { id: 'one', occurred_at: '2026-09-05T10:00:00Z' },
    { id: 'two', occurred_at: '2026-09-05T10:01:00Z' },
  ]);
  assert.deepEqual(merged.map((item) => item.id), ['two', 'one']);
  assert.equal(formatDuration(125), '2m 5s');
});
