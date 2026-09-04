import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { escapeHTML, renderSafeTemplateHTML } from './safeTemplateHTML.js';

// Execute each real renderer's function body without mounting React or making
// Supabase requests. Stub label lookups only; generated HTML is the production code.
function renderer(filename) {
  const source = readFileSync(new URL('../pages/Scenarios/' + filename, import.meta.url), 'utf8');
  const start = source.indexOf('export const renderVarChipsHTML =');
  const end = source.indexOf('export const parseVariables', start);
  assert.ok(start >= 0 && end > start);
  return vm.runInNewContext(source.slice(start, end).replace('export const', 'const') + '\nrenderVarChipsHTML;', {
    escapeHtml: escapeHTML, renderSafeTemplateHTML,
    SMART_ACTION_MAP: { send_sms: 'Send SMS' },
    TABLE_COLORS: {}, TABLE_LABELS: { people: 'People' },
    normalizeParsedTableKey: value => value,
    getFieldDisplayLabel: (_table, field) => field,
    getIteratorFieldLabel: field => field,
  });
}

for (const filename of ['VariablesPane.jsx', 'HomepageVariablesPane.jsx']) {
  const render = renderer(filename);
  test(filename + ': literal HTML cannot execute next to a variable', () => {
    const output = render('<img src=x onerror=alert(1)> Hello {{people.first_name}} <script>alert(2)</script>');
    assert.ok(output.includes('&lt;img'));
    assert.ok(output.includes('&lt;script&gt;'));
    assert.ok(output.includes('sb-var-chip'));
    assert.ok(!output.includes('<img'));
    assert.ok(!output.includes('<script'));
  });
  test(filename + ': hostile variable labels and unknown tokens are escaped', () => {
    for (const attack of [
      '{{agent.<img src=x onerror=alert(1)>}}', '{{people.<svg onload=alert(1)>}}',
      '{{rec.people.<script>alert(1)</script>}}', '{smart:<img src=x>}',
      '{{unknown.long.path.<img src=x>}}', '{{<img src=x>}}',
      '{{iterator.current.<img src=x>}}',
    ]) {
      const output = render(attack);
      assert.ok(!/<(?:img|svg|script)\b/i.test(output), output);
    }
  });
  test(filename + ': normal text and smart/variable chips preserve formatting', () => {
    assert.equal(render('A & B'), 'A &amp; B');
    assert.equal(render('plain text'), 'plain text');
    assert.equal(render(null), '');
    assert.ok(render('Hello {{people.first_name}}').includes('People.first_name</span>'));
    assert.ok(render('{smart:send_sms}').includes('Send SMS</span>'));
    assert.equal(render('{smart:unknown}'), '{smart:unknown}');
    assert.ok(render('{{agent.first_name}}').includes('Receptionist.first_name</span>'));
  });
}
