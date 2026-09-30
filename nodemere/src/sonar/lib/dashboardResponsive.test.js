import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';
import { parse } from '@babel/parser';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('phone refinement styles cannot activate for tablet or desktop', () => {
  const css = postcss.parse(read('../dashboard-phone.css'));
  css.walkRules((rule) => {
    let parent = rule.parent;
    while (parent && parent.type !== 'atrule') parent = parent.parent;
    assert.equal(parent?.name, 'media', rule.selector);
    assert.match(parent.params, /^\(max-width: 767px\)( and \(max-height: \d+px\))?$/, rule.selector);
  });
});

test('phone CRM preserves visible-field configuration, Colorbar, and inline edits', () => {
  const records = read('../components/MobileRecords.jsx');
  assert.match(records, /visibleFields\.includes\(field\.key\)/);
  assert.match(records, /<MobileInlineRecord/);
  assert.match(records, /renderColorbar\?\.\(record\)/);
  assert.doesNotMatch(records, /Open full record/);
  const inline = read('../components/MobileInlineRecord.jsx');
  assert.match(inline, /setCustomFieldValue\(record.custom_fields, field.key, value\)/);
  assert.match(inline, /Your selections are kept/);
});

test('existing dashboard CSS overrides cannot activate at desktop widths', () => {
  const css = postcss.parse(read('../dashboard-responsive.css'));
  css.walkRules((rule) => {
    if (!rule.selector.includes('sonar-dashboard-shell') && !rule.selector.includes('body[')) return;
    let parent = rule.parent;
    while (parent && parent.type !== 'atrule') parent = parent.parent;
    assert.equal(parent?.name, 'media', rule.selector);
    assert.match(parent.params, /^\(max-width: (767|1023)px\)$/, rule.selector);
    assert.match(rule.selector, /data-(?:nodemere-)?responsive="true"/, rule.selector);
  });
});

test('mobile navigation and viewport boundaries protect the excluded Scenarios route', () => {
  const dashboard = read('../SonarDashboard.jsx');
  assert.match(dashboard, /const responsiveEnabled = currentRoute !== 'scenarios'/);
  assert.match(dashboard, /isPhone && responsiveEnabled && teamExperience === 'team' && <MobileNavigation/);
  const hook = read('../hooks/useDashboardViewport.js');
  assert.match(hook, /PHONE_QUERY = '\(max-width: 767px\)'/);
  assert.match(hook, /TOUCH_LAYOUT_QUERY = '\(max-width: 1023px\)'/);
});

test('public People demos do not opt into the mobile CRM replacement', () => {
  const table = read('../pages/LeadsTable.jsx');
  assert.match(table, /responsive = false/);
  assert.match(table, /responsive && !demoMode && <MobileRecords/);
  assert.match(table, /renderColorbar=\{renderColorbar\}/);
  assert.match(read('../pages/AppointmentsTable.jsx'), /renderColorbar=\{renderColorbar\}/);
});

test('responsive settings portals wrap only fixed dialogs, never cards or grids', () => {
  const ast = parse(read('../pages/SettingsPage.jsx'), { sourceType: 'module', plugins: ['jsx'] });
  let count = 0;
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXOpeningElement' && node.name.name === 'ResponsiveDialog') {
      count++;
      const classes = node.attributes.find((a) => a.name?.name === 'className')?.value?.value;
      assert.match(classes || '', /responsive-dialog settings-dialog fixed inset-0/);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(ast);
  assert.ok(count >= 10);
  const dialog = read('../components/ResponsiveDialog.jsx');
  assert.match(dialog, /return isCompact \? createPortal\(dialog, document.body\) : dialog/);
});
