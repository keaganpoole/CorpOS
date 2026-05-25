// ─── Field Configuration & Colorbar Rules ──────────────────────────────────
// Manages display names, icons, option colors, and colorbar rules.

import {
  STATUS_OPTIONS,
  SOURCE_OPTIONS,
  OUTCOME_OPTIONS,
  CALL_STATUS_OPTIONS,
  SMS_STATUS_OPTIONS,
  EMAIL_STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  CALL_ROUTE_OPTIONS,
} from './leadSchema';

const STORAGE_KEY = 'SONAR_field_config';
const COLORBAR_KEY = 'SONAR_colorbar_rules';

const DEFAULT_CONFIG = {
  first_name: { name: 'First Name', icon: 'user' },
  last_name: { name: 'Last Name', icon: 'user' },
  phone: { name: 'Phone', icon: 'phone' },
  email: { name: 'Email', icon: 'mail' },
  street_address: { name: 'Street Address', icon: 'map-pin' },
  city: { name: 'City', icon: 'map-pin' },
  state: { name: 'State', icon: 'map' },
  zip_code: { name: 'Zip Code', icon: 'map' },
  preferred_contact_method: { name: 'Preferred Contact Method', icon: 'compass' },
  preferred_language: { name: 'Preferred Language', icon: 'globe' },
  best_time_to_contact: { name: 'Best Time To Contact', icon: 'clock' },
  consent_sms: { name: 'Consent SMS', icon: 'shield' },
  consent_call: { name: 'Consent Call', icon: 'shield' },
  do_not_call: { name: 'Do Not Call', icon: 'shield' },
  do_not_text: { name: 'Do Not Text', icon: 'shield' },
  status: {
    name: 'Status',
    icon: 'flag',
    optionColors: {
      New: '#3b82f6',
      Contacted: '#f59e0b',
      Active: '#06b6d4',
      'Callback Needed': '#f97316',
      Booked: '#10b981',
      Transferred: '#d946ef',
      Closed: '#10b981',
      'Do Not Contact': '#f43f5e',
      Inactive: '#71717a',
    },
  },
  source: {
    name: 'Source',
    icon: 'compass',
    optionColors: {
      Phone: '#06b6d4',
      Text: '#10b981',
      Email: '#6366f1',
      Website: '#3b82f6',
      Referral: '#f59e0b',
      'Walk-In': '#d946ef',
      Manual: '#71717a',
    },
  },
  lead_source_detail: { name: 'Source Detail', icon: 'search' },
  tags: { name: 'Tags', icon: 'tag' },
  created_at: { name: 'Created', icon: 'calendar' },
  updated_at: { name: 'Updated', icon: 'clock' },
  last_inbound_call_at: { name: 'Last Inbound Call', icon: 'phone' },
  last_outbound_call_at: { name: 'Last Outbound Call', icon: 'phone' },
  last_call_status: { name: 'Last Call Status', icon: 'phone' },
  last_intent: { name: 'Last Intent', icon: 'message-square' },
  last_outcome: { name: 'Last Outcome', icon: 'target' },
  missed_call_count: { name: 'Missed Call Count', icon: 'activity' },
  last_inbound_sms_at: { name: 'Last Inbound SMS', icon: 'message-square' },
  last_outbound_sms_at: { name: 'Last Outbound SMS', icon: 'message-square' },
  last_sms_status: { name: 'Last SMS Status', icon: 'message-square' },
  last_inbound_email_at: { name: 'Last Inbound Email', icon: 'mail' },
  last_outbound_email_at: { name: 'Last Outbound Email', icon: 'mail' },
  last_email_status: { name: 'Last Email Status', icon: 'mail' },
  callback_needed: { name: 'Callback Needed', icon: 'repeat' },
  callback_due_at: { name: 'Callback Due At', icon: 'clock' },
  handoff_required: { name: 'Handoff Required', icon: 'navigation' },
  assigned_staff: { name: 'Assigned Staff', icon: 'users' },
  call_route: {
    name: 'Call Route',
    icon: 'navigation',
    optionColors: {
      Default: '#71717a',
      'Front Desk': '#06b6d4',
      Billing: '#f59e0b',
      Callback: '#d946ef',
      Urgent: '#f43f5e',
      Voicemail: '#6366f1',
    },
  },
  payment_status: {
    name: 'Payment Status',
    icon: 'dollar-sign',
    optionColors: {
      None: '#71717a',
      Pending: '#f59e0b',
      Paid: '#10b981',
      Failed: '#f43f5e',
      Refunded: '#6366f1',
    },
  },
  balance_due: { name: 'Balance Due', icon: 'dollar-sign' },
  invoice_id: { name: 'Invoice ID', icon: 'file-text' },
  notes: { name: 'Notes', icon: 'file-text' },
  special_instructions: { name: 'Special Instructions', icon: 'file-text' },
};

export const AVAILABLE_ICONS = [
  'building', 'user', 'briefcase', 'factory', 'flag', 'compass', 'target',
  'dollar-sign', 'trending-up', 'mail', 'phone', 'globe', 'map-pin', 'map',
  'calendar', 'clock', 'message-square', 'search', 'file-text', 'gauge',
  'star', 'heart', 'zap', 'shield', 'award', 'bookmark', 'tag', 'layers',
  'database', 'cpu', 'settings', 'wrench', 'package', 'truck', 'users',
  'bar-chart', 'pie-chart', 'activity', 'wifi', 'anchor', 'aperture',
  'repeat', 'navigation',
];

export const COLORBAR_PRESETS = [
  { name: 'Cyan Glow', gradient: ['#22d3ee', '#06b6d4'], animation: 'sweep' },
  { name: 'Emerald', gradient: ['#10b981', '#059669'], animation: 'none' },
  { name: 'Rose Fire', gradient: ['#f43f5e', '#e11d48'], animation: 'pulse' },
  { name: 'Indigo', gradient: ['#6366f1', '#4f46e5'], animation: 'none' },
  { name: 'Amber', gradient: ['#f59e0b', '#d97706'], animation: 'none' },
  { name: 'Fuchsia', gradient: ['#d946ef', '#a855f7'], animation: 'sweep' },
  { name: 'Sunset', gradient: ['#f97316', '#ef4444'], animation: 'sweep' },
  { name: 'Ocean', gradient: ['#3b82f6', '#06b6d4'], animation: 'sweep' },
  { name: 'Neon', gradient: ['#22c55e', '#a3e635'], animation: 'pulse' },
  { name: 'Midnight', gradient: ['#6366f1', '#ec4899'], animation: 'sweep' },
];

export const loadFieldConfig = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULT_CONFIG };
};

export const saveFieldConfig = (config) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};

export const loadColorbarRules = () => {
  try {
    const stored = localStorage.getItem(COLORBAR_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
};

export const saveColorbarRules = (rules) => {
  localStorage.setItem(COLORBAR_KEY, JSON.stringify(rules));
};

export const evaluateColorbar = (lead, rules) => {
  for (const rule of rules) {
    if (!rule.enabled || !rule.conditions?.length) continue;
    const matches = rule.logic === 'and'
      ? rule.conditions.every((condition) => checkCondition(lead, condition))
      : rule.conditions.some((condition) => checkCondition(lead, condition));
    if (matches) return rule;
  }
  return null;
};

const checkCondition = (lead, condition) => {
  const { field, operator, value } = condition;
  const leadVal = lead[field];
  if (leadVal == null && operator !== 'is_empty' && operator !== 'is_not_empty') return false;

  switch (operator) {
    case 'equals':
      return String(leadVal).toLowerCase() === String(value).toLowerCase();
    case 'not_equals':
      return String(leadVal).toLowerCase() !== String(value).toLowerCase();
    case 'contains':
      return String(leadVal || '').toLowerCase().includes(String(value).toLowerCase());
    case 'greater_than':
      return parseFloat(leadVal) > parseFloat(value);
    case 'less_than':
      return parseFloat(leadVal) < parseFloat(value);
    case 'is_empty':
      return !leadVal || (Array.isArray(leadVal) && leadVal.length === 0);
    case 'is_not_empty':
      return leadVal && (!Array.isArray(leadVal) || leadVal.length > 0);
    case 'includes':
      return Array.isArray(leadVal) ? leadVal.includes(value) : String(leadVal).includes(value);
    default:
      return false;
  }
};

export const OPERATORS = {
  text: [{ v: 'equals', l: 'is' }, { v: 'not_equals', l: 'is not' }, { v: 'contains', l: 'contains' }, { v: 'is_empty', l: 'is empty' }, { v: 'is_not_empty', l: 'is not empty' }],
  number: [{ v: 'equals', l: '=' }, { v: 'greater_than', l: '>' }, { v: 'less_than', l: '<' }, { v: 'is_empty', l: 'is empty' }],
  select: [{ v: 'equals', l: 'is' }, { v: 'not_equals', l: 'is not' }, { v: 'is_empty', l: 'is empty' }, { v: 'is_not_empty', l: 'is not empty' }],
  multi_select: [{ v: 'includes', l: 'includes' }, { v: 'is_empty', l: 'is empty' }, { v: 'is_not_empty', l: 'is not empty' }],
  currency: [{ v: 'equals', l: '=' }, { v: 'greater_than', l: '>' }, { v: 'less_than', l: '<' }, { v: 'is_empty', l: 'is empty' }],
  boolean: [{ v: 'equals', l: 'is' }, { v: 'not_equals', l: 'is not' }],
};

export const CONDITIONAL_FIELDS = [
  { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS.map((opt) => opt.value) },
  { key: 'source', label: 'Source', type: 'select', options: SOURCE_OPTIONS.map((opt) => opt.value) },
  { key: 'tags', label: 'Tags', type: 'multi_select', options: ['VIP', 'Callback', 'Spanish', 'Urgent', 'Billing', 'New', 'Follow Up', 'Existing Customer', 'Do Not Disturb'] },
  { key: 'last_intent', label: 'Last Intent', type: 'text' },
  { key: 'last_outcome', label: 'Last Outcome', type: 'select', options: OUTCOME_OPTIONS.map((opt) => opt.value) },
  { key: 'last_call_status', label: 'Last Call Status', type: 'select', options: CALL_STATUS_OPTIONS.map((opt) => opt.value) },
  { key: 'last_sms_status', label: 'Last SMS Status', type: 'select', options: SMS_STATUS_OPTIONS.map((opt) => opt.value) },
  { key: 'last_email_status', label: 'Last Email Status', type: 'select', options: EMAIL_STATUS_OPTIONS.map((opt) => opt.value) },
  { key: 'callback_needed', label: 'Callback Needed', type: 'select', options: ['True', 'False'] },
  { key: 'handoff_required', label: 'Handoff Required', type: 'select', options: ['True', 'False'] },
  { key: 'payment_status', label: 'Payment Status', type: 'select', options: PAYMENT_STATUS_OPTIONS.map((opt) => opt.value) },
  { key: 'call_route', label: 'Call Route', type: 'select', options: CALL_ROUTE_OPTIONS.map((opt) => opt.value) },
  { key: 'assigned_staff', label: 'Assigned Staff', type: 'text' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'state', label: 'State', type: 'text' },
  { key: 'balance_due', label: 'Balance Due', type: 'currency' },
  { key: 'missed_call_count', label: 'Missed Call Count', type: 'number' },
];
