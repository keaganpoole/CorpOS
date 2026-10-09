import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const page = fs.readFileSync('src/pages/VisitorsPage.jsx', 'utf8');
const app = fs.readFileSync('src/App.jsx', 'utf8');
const api = fs.readFileSync('src/lib/visitorIntelligenceApi.js', 'utf8');

test('the command center exposes the required real-data modes, filters, and connected drill-downs', () => {
  for (const label of ['Attention', 'Clicks', 'Scroll', 'Drop-off']) assert.match(page, new RegExp(`label: '${label}'`));
  for (const filter of ["range: '7d'", "device: 'all'", "segment: 'all'", "conversion: 'all'", "source: ''", "campaign: ''", "section: ''"]) assert.match(page, new RegExp(filter));
  assert.match(page, /onSection\(catalog\.id\)/);
  assert.match(page, /document\.getElementById\('visitor-table'\)/);
  assert.match(page, /click_through_rate/);
  assert.match(page, /conversion_rate/);
});

test('the visitor table, comparison, pulse, and profile timeline are present without invented geography', () => {
  for (const label of ['Visitor directory', 'New vs returning', 'Visitor Pulse', 'Visitor profile', 'Conversion journey', 'Timeline']) assert.match(page, new RegExp(label));
  for (const column of ['First seen', 'Last seen', 'Visits', 'Sessions', 'Pageviews', 'Engaged', 'Location', 'Device', 'Browser', 'Source', 'Campaign', 'Depth', 'Conversion']) assert.match(page, new RegExp(column));
  assert.match(page, /Geography is unavailable/);
  assert.match(page, /No visitors match this view/);
  assert.match(page, /No visitor activity in the last 30 minutes/);
});

test('server authorization completes before the internal interface renders', () => {
  assert.match(app, /visitorIntelligenceApi\.access\(\)/);
  assert.match(app, /access !== 'allowed'.*SplashScreen/s);
  assert.match(app, /access === 'denied'.*Navigate to="\/dashboard"/s);
  assert.match(api, /\/api\/visitor-intelligence\/access/);
  assert.doesNotMatch(api, /\.from\(['"]visitors['"]\)/);
});
