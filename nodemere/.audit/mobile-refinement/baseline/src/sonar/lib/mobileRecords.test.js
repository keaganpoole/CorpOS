import test from 'node:test';
import assert from 'node:assert/strict';
import { formatValue, isEmpty, localDateTime, matchesRecordFilter, optionFor } from './mobileRecords.js';

test('mobile records preserve false and zero custom-field values', () => {
  assert.equal(isEmpty(false), false);
  assert.equal(isEmpty(0), false);
  assert.equal(formatValue(false, { type: 'boolean' }), 'No');
  assert.equal(formatValue(0, { type: 'number' }), '0');
  assert.equal(formatValue([], { type: 'multi_select' }), 'Not provided');
  assert.equal(formatValue(['North', 'South'], { type: 'multi_select' }), 'North, South');
});
test('mobile options support CRM lookup and custom-field schemas', () => {
  assert.deepEqual(optionFor({ id: 'a', display_name: 'Appointment owner' }), { value: 'a', label: 'Appointment owner' });
  assert.deepEqual(optionFor({ value: 0, label: 'Zero' }), { value: 0, label: 'Zero' });
  assert.deepEqual(optionFor('Manual'), { value: 'Manual', label: 'Manual' });
  assert.equal(formatValue('missed', { type: 'select', options: ['Missed'] }), 'Missed');
  assert.equal(formatValue('Legacy', { type: 'select', options: [] }), 'Legacy');
});
test('mobile time formatting handles midnight, noon, and invalid legacy dates safely', () => {
  assert.equal(formatValue('00:05:00', { type: 'time' }), '12:05 AM');
  assert.equal(formatValue('12:30', { type: 'time' }), '12:30 PM');
  assert.equal(formatValue('23:45', { type: 'time' }), '11:45 PM');
  assert.equal(localDateTime('invalid'), '');
  assert.equal(formatValue('legacy date', { type: 'timestamp' }), 'legacy date');
  assert.match(localDateTime('2026-09-29T12:00:00'), /^2026-09-29T12:00$/);
});
test('mobile filters never classify an unknown call preference as permission to call', () => {
  assert.equal(matchesRecordFilter({ do_not_call: true }, 'person', 'do-not-call'), true);
  assert.equal(matchesRecordFilter({ do_not_call: false }, 'person', 'callable'), true);
  assert.equal(matchesRecordFilter({ do_not_call: null }, 'person', 'callable'), false);
  assert.equal(matchesRecordFilter({ status: 'Missed' }, 'appointment', 'missed'), true);
  assert.equal(matchesRecordFilter({}, 'person', 'all'), true);
});
