import test from 'node:test';
import assert from 'node:assert/strict';
import { availableDropInTemplates } from './dropInTemplateAvailability.js';

const templates = [
  { key: 'cancel', name: 'Cancel', statuses: ['pending', 'confirmed'] },
  { key: 'reschedule', name: 'Reschedule', statuses: ['pending', 'confirmed'] },
  { key: 'confirm', name: 'Confirm Appointment', statuses: ['pending'] },
  { key: 'reminder', name: 'Appointment Reminder', statuses: ['pending'] },
];

test('hides an action already present for the selected status, including longer equivalent names', () => {
  const existing = [
    { name: 'Reschedule Customer', available_on_status: 'pending' },
    { name: 'Appointment Confirmed', available_on_status: 'confirmed' },
  ];

  assert.deepEqual(availableDropInTemplates(templates, existing, 'pending').map(item => item.key),
    ['cancel', 'confirm', 'reminder']);
});

test('keeps the action available when it exists only under another status', () => {
  const existing = [{ name: 'Cancel Appointment', available_on_status: 'confirmed' }];

  assert.deepEqual(availableDropInTemplates(templates, existing, 'pending').map(item => item.key),
    ['cancel', 'reschedule', 'confirm', 'reminder']);
});
