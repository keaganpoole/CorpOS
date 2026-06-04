import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  User, Calendar, Phone, ChevronDown, ChevronRight, ChevronUp, X, Zap, Sparkles, CreditCard, Search, Layers
} from 'lucide-react';
import { getOutputVariables, isStripeResponseNode } from '../../../sonar/lib/fieldContexts';
import { fetchCustomFields, getCurrentBusinessId, getCustomValue, isCustomFieldKey } from '../../lib/customFields';
import { getSmartActionByKey, getSmartActions } from './smartActions';

const SMART_ACTION_MAP = {};
try {
  const _keys = ['reschedule_appointment', 'leave_voicemail_callback', 'cancel_appointment', 'send_followup_sms',
    'send_confirmation_sms', 'send_reminder_call', 'send_directions_sms', 'offer_reschedule',
    'send_cancellation_confirm', 'send_new_appt_confirm', 'welcome_call', 'confirm_new_time',
    'send_reschedule_sms', 'send_prep_instructions', 'send_thank_you_sms', 'send_feedback_request',
    'answer_greet', 'route_to_dept', 'take_message', 'return_call', 'send_missed_call_sms',
    'leave_voicemail', 'return_voicemail_call', 'send_voicemail_sms', 'reply_sms',
    'continue_conversation', 'escalate_to_call', 'deliver_message', 'verify_identity',
    'retry_call', 'send_fallback_sms', 'send_payment_reminder', 'update_payment_sms',
    'send_invoice_sms', 'send_payment_followup', 'welcome_message', 'send_message', 'make_call', 'send_sms'];
  _keys.forEach(k => {
    const action = getSmartActionByKey(k);
    if (action) SMART_ACTION_MAP[k] = action.name;
  });
} catch (e) { /* ignore */ }

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

const TABLE_REF_ALIASES = {
  people: 'person',
  payments: 'payment',
  invoices: 'invoice',
  appointments: 'appointment',
  services: 'service',
  hired_receptionists: 'receptionist',
  businesses: 'business',
};

const TABLE_REF_REVERSE_ALIASES = Object.fromEntries(
  Object.entries(TABLE_REF_ALIASES).map(([tableKey, alias]) => [alias, tableKey])
);

const normalizeTableRefKey = (tableKey) => {
  if (!tableKey) return tableKey;
  return TABLE_REF_ALIASES[tableKey] || tableKey;
};

const normalizeParsedTableKey = (tableKey) => {
  if (!tableKey) return tableKey;
  return TABLE_REF_REVERSE_ALIASES[tableKey] || tableKey;
};

const getReceptionistBannerUrl = (bannerId) => (
  bannerId
    ? `https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/banners/${bannerId}.png`
    : null
);

const SEARCH_FIELDS = {
  people: ['first_name', 'last_name', 'email'],
  payments: ['description', 'status', 'payment_method'],
  appointments: ['client_name', 'notes', 'status', 'date'],
  services: ['name', 'description', 'category'],
  hired_receptionists: ['full_name', 'stereotype', 'phone_number'],
  businesses: ['name', 'email', 'phone', 'address', 'city', 'state'],
};

let peopleCustomVariableFields = [];

const toScenarioCustomField = (field) => ({
  key: field.key,
  label: field.label,
  description: field.description,
  type: field.type,
  custom: true,
});

export const setPeopleCustomVariableFields = (fields = []) => {
  peopleCustomVariableFields = fields.map(toScenarioCustomField);
};

export const getPeopleCustomVariableFields = () => peopleCustomVariableFields;

const withCustomFields = (table) => {
  if (!table || table.key !== 'people' || peopleCustomVariableFields.length === 0) return table;
  const baseKeys = new Set(table.fields.map((field) => field.key));
  const customFields = peopleCustomVariableFields.filter((field) => !baseKeys.has(field.key));
  return { ...table, fields: [...table.fields, ...customFields] };
};

export const getTableFields = (tableKey) => {
  const table = TABLE_DEFS.find((item) => item.key === tableKey);
  return withCustomFields(table)?.fields || [];
};

const getRecordFieldValue = (record, fieldKey) => {
  if (!record) return undefined;
  if (isCustomFieldKey(fieldKey)) return getCustomValue(record.custom_fields, fieldKey);
  return record[fieldKey];
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const readOutputPath = (source, path) => {
  if (!path) return source;
  return String(path)
    .split('.')
    .reduce((current, key) => {
      if (current == null) return undefined;
      if (Array.isArray(current)) {
        const index = Number(key);
        return Number.isInteger(index) ? current[index] : undefined;
      }
      return current[key];
    }, source);
};

export const getFieldDisplayLabel = (tableKey, fieldKey) => {
  const field = getTableFields(tableKey).find((item) => item.key === fieldKey);
  return field?.label || fieldKey;
};

// ─── Trigger → Runtime Table Availability ──────────────────────────────────
// Maps trigger keys to the tables that will have data at runtime.
// Based on ScenarioEngine._buildFlowContext FK relationships.
const TRIGGER_TABLE_MAP = {
  appointment_created: ['appointments', 'people', 'services', 'businesses'],
  appointment_updated: ['appointments', 'people', 'services', 'businesses'],
  appointment_cancelled: ['appointments', 'people', 'services', 'businesses'],
  appointment_rescheduled: ['appointments', 'people', 'services', 'businesses'],
  appointment_confirmed: ['appointments', 'people', 'services', 'businesses'],
  appointment_soon: ['appointments', 'people', 'services', 'businesses'],
  appointment_completed: ['appointments', 'people', 'services', 'businesses'],
  appointment_missed: ['appointments', 'people', 'services', 'businesses'],
  record_created: ['people', 'businesses'],
  record_updated: ['people', 'businesses'],
  record_deleted: ['people', 'businesses'],
  incoming_call: ['people', 'businesses', 'hired_receptionists'],
  call_answered: ['people', 'businesses', 'hired_receptionists'],
  missed_call: ['people', 'businesses'],
  call_failed: ['people', 'businesses'],
  voicemail_received: ['people', 'businesses'],
  sms_received: ['people', 'businesses'],
  sms_sent: ['people', 'businesses'],
  sms_failed: ['people', 'businesses'],
  customer_replied: ['people', 'businesses'],
  invoice_created: ['invoices', 'payments', 'people', 'businesses'],
  invoice_paid: ['invoices', 'payments', 'people', 'businesses'],
  payment_failed: ['invoices', 'payments', 'people', 'businesses'],
  payment_link_sent: ['invoices', 'payments', 'people', 'businesses'],
  invoice_sent: ['invoices', 'payments', 'people', 'businesses'],
  manual_trigger: ['people', 'payments', 'appointments', 'services', 'hired_receptionists', 'businesses'],
};

// Fetch order from ScenarioEngine._buildFlowContext (first fetched = bottom, last fetched = top)
// Visual order bottom to top: people, services, businesses
// After reverse render: array must be [businesses, services, people, ...rest]
const FETCH_ORDER = {
  businesses: 1,
  services: 2,
  people: 3,
  appointments: 10,
  payments: 11,
  invoices: 11.5,
  hired_receptionists: 12,
};
const PEOPLE_SORT_KEY = 3; // People at the very bottom after reverse

// Find parent trigger key for the current node
const findTriggerKeyForNode = (currentNodeId, nodes, edges) => {
  if (!currentNodeId || !nodes?.length) return null;
  const nodeMap = {};
  for (const n of nodes) nodeMap[n.id] = n;

  const selected = nodeMap[currentNodeId];
  if (!selected) return null;

  // If the selected node itself is a trigger, use it directly
  if (selected.categoryType === 'TRIGGERS') {
    return selected.subOptionKey || selected.triggerKey || null;
  }

  // BFS backwards to find the nearest ancestor trigger
  const visited = new Set();
  const queue = [currentNodeId];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    const parentEdge = edges.find(e => e.to === nodeId);
    if (!parentEdge) continue;
    const parentNode = nodeMap[parentEdge.from];
    if (!parentNode) continue;
    if (parentNode.categoryType === 'TRIGGERS') {
      return parentNode.subOptionKey || parentNode.triggerKey || null;
    }
    queue.push(parentEdge.from);
  }
  return null;
};

// Get available table defs for a given trigger key, sorted by fetch order
const getAvailableTables = (triggerKey) => {
  let tables;
  if (!triggerKey) {
    tables = [...TABLE_DEFS];
  } else {
    const availableKeys = TRIGGER_TABLE_MAP[triggerKey];
    if (!availableKeys) {
      tables = [...TABLE_DEFS];
    } else {
      const visibleKeys = new Set([...availableKeys, 'services']);
      tables = TABLE_DEFS.filter(t => visibleKeys.has(t.key));
    }
  }

  // Sort: bottom = foundational (people always lowest), top = most specific
  tables.sort((a, b) => {
    const aKey = a.key === 'people' ? PEOPLE_SORT_KEY : (FETCH_ORDER[a.key] || 50);
    const bKey = b.key === 'people' ? PEOPLE_SORT_KEY : (FETCH_ORDER[b.key] || 50);
    return aKey - bKey;
  });

  return tables.map(withCustomFields);
};

const TABLE_DEFS = [
  {
    key: 'people',
    label: 'People',
    color: '#32f0d9',
    colorBg: 'rgba(50,240,217,0.08)',
    colorBorder: 'rgba(50,240,217,0.2)',
    icon: User,
    fields: [
      { key: 'id', label: 'Record ID', type: 'text' },
      { key: 'first_name', label: 'First Name', type: 'text' },
      { key: 'last_name', label: 'Last Name', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'phone' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'street_address', label: 'Street Address', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'zip_code', label: 'Zip Code', type: 'text' },
      { key: 'preferred_contact_method', label: 'Preferred Contact Method', type: 'text' },
      { key: 'preferred_language', label: 'Preferred Language', type: 'text' },
      { key: 'best_time_to_contact', label: 'Best Time to Contact', type: 'text' },
      { key: 'consent_sms', label: 'Consent SMS', type: 'boolean' },
      { key: 'consent_call', label: 'Consent Call', type: 'boolean' },
      { key: 'do_not_call', label: 'Do Not Call', type: 'boolean' },
      { key: 'do_not_text', label: 'Do Not Text', type: 'boolean' },
      { key: 'source', label: 'Source', type: 'text' },
      { key: 'lead_source_detail', label: 'Source Detail', type: 'text' },
      { key: 'special_instructions', label: 'Special Instructions', type: 'text' },
      { key: 'last_call_status', label: 'Last Call Status', type: 'text' },
      { key: 'last_intent', label: 'Last Intent', type: 'text' },
      { key: 'last_outcome', label: 'Last Outcome', type: 'text' },
      { key: 'missed_call_count', label: 'Missed Call Count', type: 'number' },
      { key: 'stripe_customer_id', label: 'Stripe Customer ID', type: 'text' },
      { key: 'stripe_payment_method_id', label: 'Stripe Payment Method ID', type: 'text' },
      { key: 'created_at', label: 'Created At', type: 'timestamp' },
      { key: 'updated_at', label: 'Updated At', type: 'timestamp' },
    ],
    fetch: async () => {
      try {
        const { data } = await supabase.from('people').select('*').limit(20);
        return data || [];
      } catch { return []; }
    },
  },
  {
    key: 'payments',
    label: 'Payments',
    color: '#f472b6',
    colorBg: 'rgba(244,114,182,0.08)',
    colorBorder: 'rgba(244,114,182,0.2)',
    icon: CreditCard,
    fields: [
      { key: 'id', label: 'Payment ID', type: 'text' },
      { key: 'amount', label: 'Amount', type: 'number' },
      { key: 'currency', label: 'Currency', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'payment_method', label: 'Payment Method', type: 'text' },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'receipt_url', label: 'Receipt URL', type: 'url' },
      { key: 'stripe_payment_intent_id', label: 'Stripe Intent ID', type: 'text' },
      { key: 'stripe_session_id', label: 'Stripe Session ID', type: 'text' },
      { key: 'refunded_amount', label: 'Refunded Amount', type: 'number' },
      { key: 'error_message', label: 'Error Message', type: 'text' },
      { key: 'created_at', label: 'Created At', type: 'timestamp' },
      { key: 'updated_at', label: 'Updated At', type: 'timestamp' },
    ],
    fetch: async () => {
      try {
        const { data } = await supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(20);
        return data || [];
      } catch { return []; }
    },
  },
  {
    key: 'invoices',
    label: 'Invoices',
    color: '#f59e0b',
    colorBg: 'rgba(245,158,11,0.08)',
    colorBorder: 'rgba(245,158,11,0.2)',
    icon: CreditCard,
    fields: [
      { key: 'id', label: 'Invoice ID', type: 'text' },
      { key: 'invoice_id', label: 'Invoice ID', type: 'text' },
      { key: 'amount_due', label: 'Amount Due', type: 'number' },
      { key: 'amount_paid', label: 'Amount Paid', type: 'number' },
      { key: 'currency', label: 'Currency', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'customer_id', label: 'Customer ID', type: 'text' },
      { key: 'hosted_invoice_url', label: 'Hosted Invoice URL', type: 'url' },
      { key: 'invoice_pdf', label: 'Invoice PDF', type: 'url' },
      { key: 'due_date', label: 'Due Date', type: 'timestamp' },
      { key: 'metadata', label: 'Metadata', type: 'text' },
    ],
    fetch: async () => {
      try {
        const { data } = await supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(20);
        return data || [];
      } catch { return []; }
    },
  },
  {
    key: 'appointments',
    label: 'Appointments',
    color: '#38bdf8',
    colorBg: 'rgba(56,189,248,0.08)',
    colorBorder: 'rgba(56,189,248,0.2)',
    icon: Calendar,
    fields: [
      { key: 'id', label: 'Record ID', type: 'text' },
      { key: 'client_name', label: 'Client Name', type: 'text' },
      { key: 'date', label: 'Date', type: 'text' },
      { key: 'time', label: 'Time', type: 'text' },
      { key: 'duration', label: 'Duration', type: 'number' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'assigned_receptionist', label: 'Assigned Receptionist', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'text' },
      { key: 'created_at', label: 'Created At', type: 'timestamp' },
    ],
    fetch: async () => {
      try {
        const { data } = await supabase.from('appointments').select('*').limit(20);
        return data || [];
      } catch { return []; }
    },
  },
  {
    key: 'services',
    label: 'Services',
    color: '#fb923c',
    colorBg: 'rgba(251,146,60,0.08)',
    colorBorder: 'rgba(251,146,60,0.2)',
    icon: Zap,
    fields: [
      { key: 'id', label: 'Record ID', type: 'text' },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'price_type', label: 'Price Type', type: 'text' },
      { key: 'price_min', label: 'Price Min', type: 'number' },
      { key: 'price_max', label: 'Price Max', type: 'number' },
      { key: 'unit', label: 'Unit', type: 'text' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'is_active', label: 'Is Active', type: 'text' },
      { key: 'sort_order', label: 'Sort Order', type: 'number' },
      { key: 'created_at', label: 'Created At', type: 'timestamp' },
      { key: 'updated_at', label: 'Updated At', type: 'timestamp' },
    ],
    fetch: async () => {
      try {
        const { data } = await supabase.from('services').select('*').limit(20);
        return data || [];
      } catch { return []; }
    },
  },
  {
    key: 'hired_receptionists',
    label: 'Receptionists',
    color: '#f472b6',
    colorBg: 'rgba(244,114,182,0.08)',
    colorBorder: 'rgba(244,114,182,0.2)',
    icon: Phone,
    fields: [
      { key: 'id', label: 'Record ID', type: 'text' },
      { key: 'full_name', label: 'Full Name', type: 'text' },
      { key: 'first_name', label: 'First Name', type: 'text' },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'stereotype', label: 'Role', type: 'text' },
      { key: 'avatar', label: 'Avatar', type: 'text' },
      { key: 'voice', label: 'Voice', type: 'text' },
      { key: 'elevenlabs_voice_id', label: 'ElevenLabs Voice ID', type: 'text' },
      { key: 'age', label: 'Age', type: 'number' },
      { key: 'call_types', label: 'Call Types', type: 'text' },
      { key: 'phone_number', label: 'Phone', type: 'phone' },
      { key: 'is_active', label: 'Is Active', type: 'boolean' },
      { key: 'language_model', label: 'Language Model', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'current_activity', label: 'Current Activity', type: 'text' },
      { key: 'total_calls', label: 'Total Calls', type: 'number' },
      { key: 'inbound_calls_count', label: 'Inbound Calls', type: 'number' },
      { key: 'outbound_calls_count', label: 'Outbound Calls', type: 'number' },
      { key: 'completed_calls_count', label: 'Completed Calls', type: 'number' },
      { key: 'failed_calls_count', label: 'Failed Calls', type: 'number' },
      { key: 'missed_calls_count', label: 'Missed Calls', type: 'number' },
      { key: 'average_call_duration_seconds', label: 'Avg Call Duration Seconds', type: 'number' },
      { key: 'last_call_at', label: 'Last Call At', type: 'timestamp' },
      { key: 'hired_at', label: 'Hired At', type: 'timestamp' },
    ],
    fetch: async () => {
      try {
        const { data } = await supabase.from('hired_receptionists').select('*').limit(20);
        return data || [];
      } catch { return []; }
    },
  },
  {
    key: 'businesses',
    label: 'Business',
    color: '#a1a1aa',
    colorBg: 'rgba(161,161,170,0.08)',
    colorBorder: 'rgba(161,161,170,0.2)',
    icon: User,
    fields: [
      { key: 'id', label: 'Record ID', type: 'text' },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'phone' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'address', label: 'Address', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'zip', label: 'Zip', type: 'text' },
      { key: 'website', label: 'Website', type: 'url' },
      { key: 'about_us', label: 'About Us', type: 'text' },
      { key: 'policies', label: 'Policies', type: 'text' },
      { key: 'faq', label: 'FAQ', type: 'text' },
      { key: 'business_hours', label: 'Business Hours', type: 'text' },
      { key: 'created_at', label: 'Created At', type: 'timestamp' },
      { key: 'updated_at', label: 'Updated At', type: 'timestamp' },
    ],
    fetch: async () => {
      try {
        const { data } = await supabase.from('businesses').select('*').limit(20);
        return data || [];
      } catch { return []; }
    },
  },
];

export const TABLE_COLORS = {
  people: '#32f0d9',
  payments: '#f472b6',
  invoices: '#f59e0b',
  appointments: '#38bdf8',
  services: '#fb923c',
  hired_receptionists: '#f472b6',
  businesses: '#a1a1aa',
};

export const TABLE_LABELS = {
  people: 'People',
  person: 'Person',
  payments: 'Payments',
  payment: 'Payment',
  invoices: 'Invoices',
  invoice: 'Invoice',
  appointments: 'Appointments',
  appointment: 'Appointment',
  services: 'Services',
  service: 'Service',
  hired_receptionists: 'Receptionists',
  receptionist: 'Receptionist',
  businesses: 'Businesses',
  business: 'Business',
};

const AGENT_SOURCE_TABLES = new Set(['people', 'appointments']);

export const getAgentFieldsForTable = (tableKey) => {
  if (!AGENT_SOURCE_TABLES.has(tableKey)) return [];
  return getTableFields(tableKey);
};

const getFocusedTableKeyForNode = (node) => {
  if (!node) return null;
  const actionKey = node.actionConfig?._key || node.subOptionKey || node.triggerKey || '';
  const appointmentKey = node.appointmentConfig?.key || '';
  if (appointmentKey === 'create_appointment' || appointmentKey === 'update_appointment' || appointmentKey === 'delete_appointment') {
    return 'appointments';
  }
  if (actionKey === 'create_appointment' || actionKey === 'update_appointment' || actionKey === 'delete_appointment' || actionKey === 'search_appointments') {
    return 'appointments';
  }
  if (['create_new_record', 'update_record', 'delete_record', 'search_records'].includes(actionKey)) {
    const tableKey = (node.actionConfig?.target_table || 'people').toLowerCase().replace(/\s+/g, '_');
    return normalizeTableRefKey(tableKey);
  }
  return null;
};

export const getVariableRef = (tableKey, fieldKey, sourcePrefix = '') => {
  const normalizedTable = normalizeTableRefKey(tableKey);
  return sourcePrefix ? `{{${sourcePrefix}.${normalizedTable}.${fieldKey}}}` : `{{${normalizedTable}.${fieldKey}}}`;
};

export const renderVarChipsHTML = (value) => {
  if (!value || typeof value !== 'string') return '';
  let result = value.replace(/\{smart:([^}]+)\}/g, (match, key) => {
    const action = SMART_ACTION_MAP[key];
    if (!action) return match;
    return `<span class="sb-var-chip" style="background:linear-gradient(135deg,rgba(56,189,248,0.12),rgba(168,85,247,0.12));color:#a855f7;border:1px solid rgba(168,85,247,0.25);display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap;line-height:1.7;vertical-align:middle;gap:2px;">⚡ ${action}</span>`;
  });
  result = result.replace(/\{\{([^}]+)\}\}/g, (match, ref) => {
    const parts = ref.split('.');
    if (parts.length === 3 && (parts[0] === 'rec' || parts[0] === 'agent' || parts[0] === 'receptionist')) {
      const tableKey = normalizeParsedTableKey(parts[1]);
      const color = TABLE_COLORS[tableKey] || '#a78bfa';
      const tableLabel = TABLE_LABELS[parts[1]] || TABLE_LABELS[tableKey] || parts[1];
      const fieldLabel = getFieldDisplayLabel(tableKey, parts[2]);
      return `<span class="sb-var-chip" style="background:${color}18;color:${color};border:1px solid ${color}25;display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap;line-height:1.7;vertical-align:middle;">rec.${escapeHtml(tableLabel)}.${escapeHtml(fieldLabel)}</span>`;
    }
    if (parts.length !== 2) return match;
    if (parts[0] === 'agent' || parts[0] === 'receptionist') {
      const receptionistColor = TABLE_COLORS.appointments || '#38bdf8';
      return `<span class="sb-var-chip" style="background:${receptionistColor}18;color:${receptionistColor};border:1px solid ${receptionistColor}25;display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap;line-height:1.7;vertical-align:middle;">Receptionist.${parts[1]}</span>`;
    }
    const tableKey = normalizeParsedTableKey(parts[0]);
    const color = TABLE_COLORS[tableKey] || '#a78bfa';
    const tableLabel = TABLE_LABELS[parts[0]] || TABLE_LABELS[tableKey] || parts[0];
    const fieldLabel = getFieldDisplayLabel(tableKey, parts[1]);
    return `<span class="sb-var-chip" style="background:${color}18;color:${color};border:1px solid ${color}25;display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap;line-height:1.7;vertical-align:middle;">${escapeHtml(tableLabel)}.${escapeHtml(fieldLabel)}</span>`;
  });
  return result;
};

export const parseVariables = (value) => {
  if (!value || typeof value !== 'string') return [];
  const matches = [];
  const regex = /\{\{([^}]+)\}\}/g;
  let match;
  while ((match = regex.exec(value)) !== null) {
    const [full, ref] = match;
    const parts = ref.split('.');
    if (parts.length === 2) {
      matches.push({ full, source: null, table: normalizeParsedTableKey(parts[0]), field: parts[1] });
    } else if (parts.length >= 3 && (parts[0] === 'rec' || parts[0] === 'agent' || parts[0] === 'receptionist')) {
      matches.push({ full, source: parts[0], table: normalizeParsedTableKey(parts[1]), field: parts.slice(2).join('.') });
    }
  }
  return matches;
};

// Node type → icon and display label mapping
const NODE_DISPLAY = {
  trigger: { icon: Zap, defaultLabel: 'Trigger' },
  action: { icon: Sparkles, defaultLabel: 'Action' },
  condition: { icon: ChevronRight, defaultLabel: 'Condition' },
  router: { icon: ChevronRight, defaultLabel: 'Router' },
  default: { icon: Zap, defaultLabel: 'Node' },
};

// Get display config for a node type
const getNodeDisplay = (categoryType) => {
  return NODE_DISPLAY[categoryType] || NODE_DISPLAY.default;
};

// Traverse graph backwards from current node, return ordered array of previous node data
const getPreviousNodeData = (currentNodeId, nodes, edges) => {
  if (!currentNodeId || !nodes.length) return [];

  // Backwards BFS from current node
  const visited = new Set([currentNodeId]);
  const queue = [currentNodeId];
  const predecessors = new Map();

  while (queue.length > 0) {
    const current = queue.shift();
    for (const edge of edges) {
      if (edge.to === current && !visited.has(edge.from)) {
        visited.add(edge.from);
        queue.push(edge.from);
        if (!predecessors.has(edge.to)) predecessors.set(edge.to, []);
        predecessors.get(edge.to).push(edge.from);
      }
    }
  }

  // Topological order (BFS from intro)
  const topoOrder = [];
  const visitedTopo = new Set();
  const introNode = nodes.find(n => n.id === 'node-1');
  if (!introNode) return [];

  const topoQueue = ['node-1'];
  visitedTopo.add('node-1');
  while (topoQueue.length > 0) {
    const curr = topoQueue.shift();
    topoOrder.push(curr);
    for (const edge of edges) {
      if (edge.from === curr && !visitedTopo.has(edge.to)) {
        visitedTopo.add(edge.to);
        topoQueue.push(edge.to);
      }
    }
  }

  // Filter to only previous nodes (before current), exclude current, reverse for most-recent-first
  const currentIdx = topoOrder.indexOf(currentNodeId);
  const previousIds = currentIdx > 0 ? topoOrder.slice(0, currentIdx).reverse() : [];

  // Build node data — exclude Search Records nodes (their runtime output is shown separately)
  return previousIds.map(nodeId => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return null;
    // Skip Search Records nodes — their output is shown via SearchRecordsOutput
    if (node.actionConfig?._key === 'search_records') return null;
    const display = getNodeDisplay(node.categoryType);
    const label = node.label || display.defaultLabel;
    const data = {};

    // Extract data from node configs
    if (node.actionConfig && typeof node.actionConfig === 'object') {
      Object.entries(node.actionConfig).forEach(([key, val]) => {
        if (val != null && key !== '_key') data[key] = val;
      });
    }
    if (node.appointmentConfig && typeof node.appointmentConfig === 'object') {
      Object.entries(node.appointmentConfig).forEach(([key, val]) => {
        if (val != null && key !== '_key') data[key] = val;
      });
    }
    if (node.scheduleConfig && typeof node.scheduleConfig === 'object') {
      Object.entries(node.scheduleConfig).forEach(([key, val]) => {
        if (val != null && key !== '_key') data[key] = val;
      });
    }
    // Also include node-level fields
    if (node.detail) data['detail'] = node.detail;
    if (node.triggerKey) data['trigger'] = node.triggerKey;

    return { nodeId, label, categoryType: node.categoryType, icon: display.icon, data };
  }).filter(Boolean);
};

// Format a value for display
const formatValue = (value, type) => {
  if (value === null || value === undefined) return '—';
  if (type === 'timestamp') {
    try { return new Date(value).toLocaleDateString(); } catch { return String(value); }
  }
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
};

// Search Records Output — shows runtime output from Search Records nodes in the variables pane
const SearchRecordsOutput = ({ currentNodeId, nodes, edges, onInsertVariable, onTableHover }) => {
  const [expandedRecords, setExpandedRecords] = useState({});

  // Find ALL Search Records nodes reachable from currentNodeId (backwards), run or not
  const getSearchRecordsNodes = () => {
    if (!currentNodeId || !nodes.length) return [];
    const visited = new Set([currentNodeId]);
    const queue = [currentNodeId];
    const results = [];

    while (queue.length > 0) {
      const current = queue.shift();
      for (const edge of edges) {
        if (edge.to === current && !visited.has(edge.from)) {
          visited.add(edge.from);
          queue.push(edge.from);
          const node = nodes.find(n => n.id === edge.from);
          if (node?.actionConfig?._key === 'search_records') {
            results.push({
              nodeId: node.id,
              label: node.label || 'Search Records',
              table: node.actionConfig?.target_table || '',
              records: node.searchResults || null,
            });
          }
        }
      }
    }
    return results.reverse(); // Most recent first
  };

  const searchNodes = getSearchRecordsNodes();
  console.log('[SearchRecordsOutput] Found nodes:', searchNodes.length, searchNodes.map(n => ({ id: n.nodeId, hasResults: !!n.records, recordCount: n.records?.length })));

  if (searchNodes.length === 0) return null;

  const toggleRecord = (nodeId, idx) => {
    const key = `${nodeId}-${idx}`;
    setExpandedRecords(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      {searchNodes.map((node) => {
        const color = '#32f0d9';
        const hasResults = node.records && Array.isArray(node.records);
        const records = hasResults ? node.records : [];
        const isMany = records.length > 3;

        return (
          <div key={node.nodeId} className="sb-vars-table-group"
            style={{ '--table-color': color, '--table-bg': 'rgba(50,240,217,0.08)', '--table-border': 'rgba(50,240,217,0.2)' }}
            onMouseEnter={() => onTableHover?.(color)}
            onMouseLeave={() => onTableHover?.('')}
          >
            <div className="sb-vars-table-header" style={{ cursor: 'default' }}>
              <span className="sb-vars-table-icon" style={{ color }}><Layers size={11} /></span>
              <span className="sb-vars-table-label" style={{ textAlign: 'left', flex: 1 }}>{node.label}</span>
              {hasResults && <span className="sb-vars-table-badge">{records.length} records</span>}
            </div>
            <div className="sb-vars-fields">
              {!hasResults ? (
                <div className="sb-vars-empty" style={{ padding: '12px 8px' }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Run node to generate output</span>
                </div>
              ) : records.length === 0 ? (
                <div className="sb-vars-empty">No records returned</div>
              ) : (
                records.map((record, idx) => {
                  const key = `${node.nodeId}-${idx}`;
                  const isExpanded = isMany ? (expandedRecords[key] === true) : (expandedRecords[key] !== false);
                  const baseEntries = Object.entries(record)
                    .filter(([k]) => k !== '_id' && k !== '__proto__' && k !== 'custom_fields')
                    .map(([entryKey, entryValue]) => ({ key: entryKey, label: entryKey, value: entryValue }));
                  const customEntries = String(node.table || '').toLowerCase() === 'people'
                    ? peopleCustomVariableFields.map((field) => ({
                        key: field.key,
                        label: field.label,
                        value: getCustomValue(record.custom_fields, field.key),
                      }))
                    : [];
                  const entries = [...baseEntries, ...customEntries];
                  return (
                    <div key={idx} className="sb-search-record-bundle">
                      <div
                        className="sb-vars-table-header"
                        style={{ padding: '4px 8px', minHeight: 'auto', cursor: 'pointer' }}
                        onClick={() => toggleRecord(node.nodeId, idx)}
                      >
                        <span className="sb-vars-table-chevron" style={{ opacity: 0.5 }}>
                          {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                        </span>
                        <span className="sb-vars-table-index" style={{ color, fontFamily: 'monospace', fontSize: 10, fontWeight: 600 }}>
                          {idx}
                        </span>
                      </div>
                      {isExpanded && (
                        <div className="sb-vars-fields" style={{ paddingLeft: 18 }}>
                          {entries.map(({ key: fieldKey, label, value: fieldValue }) => {
                            const varRef = getVariableRef(node.nodeId, `records.${idx}.${fieldKey}`);
                            const displayVal = fieldValue == null ? '—' : (typeof fieldValue === 'object' ? JSON.stringify(fieldValue) : String(fieldValue));
                            return (
                              <button
                                key={fieldKey}
                                type="button"
                                className="sb-vars-field"
                                onClick={(e) => { e.stopPropagation(); onInsertVariable?.(varRef, label, color); }}
                                title={`Insert {{${node.nodeId}.records.${idx}.${fieldKey}}}`}
                              >
                                <span className="sb-vars-field-name" style={{ color }}>{label}</span>
                                <span className="sb-vars-field-value">{displayVal.length > 40 ? displayVal.slice(0, 40) + '…' : displayVal}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </>
  );
};

// Previous Node Variables — shows output variables from previous nodes in the flow
const PreviousNodeVars = ({ currentNodeId, nodes, edges, onInsertVariable, onTableHover }) => {
  const [expandedNodes, setExpandedNodes] = useState({});

  // Find previous nodes in execution order
  const getPreviousNodes = () => {
    if (!currentNodeId || !nodes.length) return [];
    const visited = new Set([currentNodeId]);
    const queue = [currentNodeId];
    const predecessors = new Map();
    while (queue.length > 0) {
      const current = queue.shift();
      for (const edge of edges) {
        if (edge.to === current && !visited.has(edge.from)) {
          visited.add(edge.from);
          queue.push(edge.from);
          if (!predecessors.has(edge.to)) predecessors.set(edge.to, []);
          predecessors.get(edge.to).push(edge.from);
        }
      }
    }
    // Topological order (BFS from intro)
    const topoOrder = [];
    const visitedTopo = new Set();
    const topoQueue = ['node-1'];
    visitedTopo.add('node-1');
    while (topoQueue.length > 0) {
      const curr = topoQueue.shift();
      topoOrder.push(curr);
      for (const edge of edges) {
        if (edge.from === curr && !visitedTopo.has(edge.to)) {
          visitedTopo.add(edge.to);
          topoQueue.push(edge.to);
        }
      }
    }
    const currentIdx = topoOrder.indexOf(currentNodeId);
    const previousIds = currentIdx > 0 ? topoOrder.slice(0, currentIdx).reverse() : [];
    return previousIds.map(nodeId => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return null;
      if (node.actionConfig?._key === 'search_records') return null;
      const display = getNodeDisplay(node.categoryType);
      const label = node.label || display.defaultLabel;
      const outputVars = getOutputVariables(node);
      const outputData = node.outputData || null;
      if (outputData == null) return null;
      const isStripeResponse = isStripeResponseNode(node);
      return { nodeId, label, categoryType: node.categoryType, icon: display.icon, outputVars, outputData, isStripeResponse };
    }).filter(Boolean);
  };

  const prevNodes = getPreviousNodes();

  if (prevNodes.length === 0) {
    return null;
  }

  return (
    <>
      {prevNodes.map((prev) => {
        const NodeIcon = prev.icon;
        const color = '#a78bfa';
        const isExpanded = expandedNodes[prev.nodeId] !== false;
        const hasOutput = prev.outputData != null;
        const sourceName = prev.isStripeResponse ? 'Stripe' : null;

        return (
          <div
            key={prev.nodeId}
            className="sb-vars-table-group sb-vars-table-group--response"
            style={{ '--table-color': color, '--table-bg': 'rgba(167,139,250,0.08)', '--table-border': 'rgba(167,139,250,0.2)' }}
            onMouseEnter={() => onTableHover?.(color)}
            onMouseLeave={() => onTableHover?.('')}
          >
            <button
              type="button"
              className="sb-vars-table-header sb-vars-table-header--response"
              onClick={() => setExpandedNodes(p => ({ ...p, [prev.nodeId]: !isExpanded }))}
            >
              <span className="sb-vars-table-chevron">
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
              <span className="sb-vars-table-icon" style={{ color }}><NodeIcon size={11} /></span>
              <span className="sb-vars-table-label" style={{ textAlign: 'left', flex: 1 }}>{prev.label}</span>
              {sourceName && (
                <span className="sb-vars-table-source">
                  <span className="sb-vars-table-source-prefix">via</span>
                  <span className="sb-vars-table-source-name" style={{ color }}>{sourceName}</span>
                </span>
              )}
            </button>

            {isExpanded && (
              <div className="sb-vars-fields">
                {prev.outputVars.length === 0 ? (
                  <div className="sb-vars-empty">No output variables</div>
                ) : (
                  prev.outputVars.map((field) => {
                    const varRef = getVariableRef(prev.nodeId, field.key);
                    const rawValue = hasOutput ? readOutputPath(prev.outputData, field.key) : undefined;
                    const displayVal = hasOutput ? formatValue(rawValue, field.type) : '';
                    return (
                      <button
                        key={field.key}
                        type="button"
                        className="sb-vars-field"
                        onClick={(e) => { e.stopPropagation(); onInsertVariable?.(varRef, field.label, color); }}
                        title={displayVal || `{{${prev.nodeId}.${field.key}}}`}
                      >
                        <span className="sb-vars-field-name" style={{ color }}>{field.label}</span>
                        {hasOutput && displayVal && <span className="sb-vars-field-value">{displayVal}</span>}
                        {!hasOutput && <span className="sb-vars-field-type" style={{ opacity: 0.4 }}>—</span>}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};


const VariablesPane = ({ visible, targetFieldKey, fieldLabel, onInsertVariable, onInsertSmartAction, smartActions = [], onTableHover, onClose, style = {}, nodes = [], edges = [], currentNodeId = '' }) => {
  const [records, setRecords] = useState({});
  const [activeIndex, setActiveIndex] = useState({});
  const [expanded, setExpanded] = useState({});
  const [searchQueries, setSearchQueries] = useState({});
  const [searchStates, setSearchStates] = useState({});
  const [editingTables, setEditingTables] = useState({});
  const [activeSources, setActiveSources] = useState({});
  const [activeReceptionist, setActiveReceptionist] = useState(null);
  const [customFieldsReady, setCustomFieldsReady] = useState(false);
  const searchTimers = useRef({});
  const searchInputRefs = useRef({});
  const seenSourceLabelsRef = useRef(new Set());
  const paneRef = useRef(null);
  const currentNode = nodes.find(n => n.id === currentNodeId);
  const focusedTableKey = getFocusedTableKeyForNode(currentNode);

  useEffect(() => {
    let cancelled = false;

    const loadCustomFields = async () => {
      try {
        const businessId = await getCurrentBusinessId();
        const fields = await fetchCustomFields(businessId);
        if (!cancelled) setPeopleCustomVariableFields(fields);
      } catch (error) {
        console.warn('[VariablesPane] Could not load custom people fields:', error?.message || error);
        if (!cancelled) setPeopleCustomVariableFields([]);
      } finally {
        if (!cancelled) setCustomFieldsReady(true);
      }
    };

    loadCustomFields();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!visible || !customFieldsReady) return;
    // Determine trigger key for filtering available tables
    const triggerKey = findTriggerKeyForNode(currentNodeId, nodes, edges);
    const available = getAvailableTables(triggerKey);
    const fetchAll = async () => {
      const results = {};
      const indices = {};
      for (const table of available) {
        const data = await table.fetch();
        results[table.key] = data;
        indices[table.key] = 0;
      }
      setRecords(results);
      setActiveIndex(indices);
      const exp = {};
      available.forEach(t => { exp[t.key] = true; });
      setExpanded(exp);
    };
    fetchAll();
  }, [visible, currentNodeId, nodes, edges, customFieldsReady]);

  useEffect(() => {
    let cancelled = false;
    if (!visible) return undefined;

    const loadActiveReceptionist = async () => {
      try {
        const { data: user } = await supabase.from('users').select('id').limit(1).single();
        if (cancelled) return;

        const userId = user?.id;
        if (!userId) {
          setActiveReceptionist(null);
          return;
        }

        const { data: settings } = await supabase
          .from('account_settings')
          .select('call_routing')
          .limit(1)
          .maybeSingle();

        const callRouting = String(settings?.call_routing || 'all').toLowerCase();
        if (!['outbound', 'all'].includes(callRouting)) {
          setActiveReceptionist(null);
          return;
        }

        const { data: rows } = await supabase
          .from('hired_receptionists')
          .select('id, full_name, first_name, avatar, status, user_id, catalog_id')
          .eq('user_id', userId)
          .eq('is_active', true)
          .limit(10);

        if (cancelled) return;

        const preferred = (rows || [])[0] || null;

        if (!preferred) {
          setActiveReceptionist(null);
          return;
        }

        let bannerId = null;
        if (preferred.catalog_id) {
          const { data: catalogRow } = await supabase
            .from('receptionist_catalog')
            .select('banner_id')
            .eq('id', preferred.catalog_id)
            .single();
          if (!cancelled) {
            bannerId = catalogRow?.banner_id || null;
          }
        }

        if (cancelled) return;

        setActiveReceptionist({
          ...preferred,
          banner_id: bannerId,
          banner_url: getReceptionistBannerUrl(bannerId),
        });
      } catch {
        if (!cancelled) setActiveReceptionist(null);
      }
    };

    loadActiveReceptionist();
    return () => { cancelled = true; };
  }, [visible]);

  useEffect(() => {
    if (!visible || !customFieldsReady) return;
    const currentTriggerKey = findTriggerKeyForNode(currentNodeId, nodes, edges);
    const tables = getAvailableTables(currentTriggerKey).slice().reverse();
    const hasCallNodeBeforeLocal = (() => {
      if (!currentNodeId || !nodes.length) return false;
      const callNodeIds = nodes
        .filter(n => n.configured && (n.subOptionKey === 'call_customer' || n.actionConfig?._key === 'call_customer'))
        .map(n => n.id);
      if (callNodeIds.length === 0) return false;
      const visited = new Set();
      const queue = [currentNodeId];
      while (queue.length > 0) {
        const current = queue.shift();
        if (callNodeIds.includes(current)) return true;
        if (visited.has(current)) continue;
        visited.add(current);
        for (const edge of edges) {
          if (edge.to === current && !visited.has(edge.from)) {
            queue.push(edge.from);
          }
        }
      }
      return false;
    })();

    tables.forEach((table) => {
      const agentFields = getAgentFieldsForTable(table.key);
      const hasAgentData = hasCallNodeBeforeLocal && agentFields.length > 0;
      const activeSource = activeSources[sourceStateKey(table.key)] || (hasAgentData ? 'agent' : 'trigger');
      seenSourceLabelsRef.current.add(`${sourceStateKey(table.key)}::${activeSource}`);
    });
  }, [visible, currentNodeId, nodes, edges, activeSources, customFieldsReady]);

  useEffect(() => {
    const panel = paneRef.current;
    if (!visible || !panel || typeof window === 'undefined' || window.innerWidth < 1024) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    const defaultRot = { x: 0, y: 6 };
    let currentRot = { ...defaultRot };
    let targetRot = { ...defaultRot };
    let frameId = null;

    const animate = () => {
      currentRot.x += (targetRot.x - currentRot.x) * 0.1;
      currentRot.y += (targetRot.y - currentRot.y) * 0.1;

      panel.style.setProperty('--sb-pane-rotate-x', `${currentRot.x.toFixed(3)}deg`);
      panel.style.setProperty('--sb-pane-rotate-y', `${currentRot.y.toFixed(3)}deg`);

      frameId = window.requestAnimationFrame(animate);
    };

    const handleMouseMove = (event) => {
      const rect = panel.getBoundingClientRect();
      const xPercent = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const yPercent = ((event.clientY - rect.top) / rect.height - 0.5) * -2;

      targetRot.y = 6 - (xPercent * 3.6);
      targetRot.x = yPercent * -2.8;
    };

    const handleMouseLeave = () => {
      targetRot = { ...defaultRot };
    };

    frameId = window.requestAnimationFrame(animate);
    panel.addEventListener('mousemove', handleMouseMove);
    panel.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      panel.removeEventListener('mousemove', handleMouseMove);
      panel.removeEventListener('mouseleave', handleMouseLeave);
      panel.style.removeProperty('--sb-pane-rotate-x');
      panel.style.removeProperty('--sb-pane-rotate-y');
    };
  }, [visible]);

  if (!visible) return null;

  const hasCallNodeBefore = (() => {
    if (!currentNodeId || !nodes.length) return false;
    const callNodeIds = nodes
      .filter(n => n.configured && (n.subOptionKey === 'call_customer' || n.actionConfig?._key === 'call_customer'))
      .map(n => n.id);
    if (callNodeIds.length === 0) return false;
    const visited = new Set();
    const queue = [currentNodeId];
    while (queue.length > 0) {
      const current = queue.shift();
      if (callNodeIds.includes(current)) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const edge of edges) {
        if (edge.to === current && !visited.has(edge.from)) {
          queue.push(edge.from);
        }
      }
    }
    return false;
  })();

  const isPhoneCallTrigger = (() => {
    if (!currentNode || currentNode.categoryType !== 'TRIGGERS') return false;
    const phoneTriggers = ['incoming_call', 'call_answered', 'missed_call', 'call_failed', 'voicemail_received'];
    return phoneTriggers.includes(currentNode.subOptionKey || currentNode.actionConfig?._key || '');
  })();

  const isCallAction = (() => {
    if (!currentNode) return false;
    const callActions = ['call_customer', 'call_phone_number'];
    return callActions.includes(currentNode.subOptionKey || currentNode.actionConfig?._key || '');
  })();

  const showFromCall = hasCallNodeBefore && !isPhoneCallTrigger && !isCallAction;

  const handleSearch = (tableKey, query) => {
    setSearchQueries(prev => ({ ...prev, [tableKey]: query }));
    if (searchTimers.current[tableKey]) clearTimeout(searchTimers.current[tableKey]);
    if (!query.trim()) {
      setActiveIndex(prev => ({ ...prev, [tableKey]: 0 }));
      setSearchStates(prev => ({ ...prev, [tableKey]: false }));
      return;
    }
    setSearchStates(prev => ({ ...prev, [tableKey]: true }));
    searchTimers.current[tableKey] = setTimeout(() => {
      const tableRecords = records[tableKey] || [];
      const searchFields = SEARCH_FIELDS[tableKey] || [];
      const lowerQuery = query.toLowerCase();
      let matchIndex = 0;
      let found = false;
      for (let i = 0; i < tableRecords.length; i++) {
        const record = tableRecords[i];
        for (const field of searchFields) {
          const val = getRecordFieldValue(record, field);
          if (val != null && String(val).toLowerCase().includes(lowerQuery)) {
            matchIndex = i;
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (found) setActiveIndex(prev => ({ ...prev, [tableKey]: matchIndex }));
    }, 250);
  };

  const handleClear = (tableKey) => {
    setSearchQueries(prev => ({ ...prev, [tableKey]: '' }));
    setActiveIndex(prev => ({ ...prev, [tableKey]: 0 }));
    setSearchStates(prev => ({ ...prev, [tableKey]: false }));
    if (searchTimers.current[tableKey]) clearTimeout(searchTimers.current[tableKey]);
  };

  const handleExit = (tableKey) => {
    setSearchStates(prev => ({ ...prev, [tableKey]: false }));
    setEditingTables(prev => ({ ...prev, [tableKey]: false }));
  };

  const handleStart = (tableKey) => {
    setEditingTables(prev => ({ ...prev, [tableKey]: true }));
    setTimeout(() => searchInputRefs.current[tableKey]?.focus(), 0);
  };

  const getCount = (tableKey) => {
    const query = searchQueries[tableKey];
    if (!query || !query.trim()) return 0;
    const tableRecords = records[tableKey] || [];
    const searchFields = SEARCH_FIELDS[tableKey] || [];
    const lowerQuery = query.toLowerCase();
    let count = 0;
    for (const record of tableRecords) {
      for (const field of searchFields) {
        const val = getRecordFieldValue(record, field);
        if (val != null && String(val).toLowerCase().includes(lowerQuery)) { count++; break; }
      }
    }
    return count;
  };

  // Returns array of record indices that match the search query
  const getMatchedIndices = (tableKey) => {
    const query = searchQueries[tableKey];
    if (!query || !query.trim()) return [];
    const tableRecords = records[tableKey] || [];
    const searchFields = SEARCH_FIELDS[tableKey] || [];
    const lowerQuery = query.toLowerCase();
    const indices = [];
    for (let i = 0; i < tableRecords.length; i++) {
      const record = tableRecords[i];
      for (const field of searchFields) {
        const val = getRecordFieldValue(record, field);
        if (val != null && String(val).toLowerCase().includes(lowerQuery)) {
          indices.push(i);
          break;
        }
      }
    }
    return indices;
  };

  const navigateMatched = (tableKey, direction) => {
    const indices = getMatchedIndices(tableKey);
    if (indices.length <= 1) return;
    const currentIdx = activeIndex[tableKey] || 0;
    const posInMatched = indices.indexOf(currentIdx);
    const nextPos = posInMatched === -1 ? 0 : (posInMatched + direction + indices.length) % indices.length;
    setActiveIndex(prev => ({ ...prev, [tableKey]: indices[nextPos] }));
  };

  // Returns a Set of field keys whose value matches the search query for the current record
  const getMatchedFields = (tableKey, record) => {
    const query = searchQueries[tableKey];
    if (!query || !query.trim() || !record) return new Set();
    const searchFields = SEARCH_FIELDS[tableKey] || [];
    const lowerQuery = query.toLowerCase();
    const matched = new Set();
    for (const field of searchFields) {
      const val = getRecordFieldValue(record, field);
      if (val != null && String(val).toLowerCase().includes(lowerQuery)) {
        matched.add(field);
      }
    }
    return matched;
  };

  const availableTables = getAvailableTables(findTriggerKeyForNode(currentNodeId, nodes, edges)).slice().reverse();
  const sourceStateKey = (tableKey) => `${currentNodeId || 'none'}::${tableKey}`;

  const getSourceCycleOrder = (tableKey) => {
    const hasAgentFields = showFromCall && getAgentFieldsForTable(tableKey).length > 0;
    return hasAgentFields ? ['agent', 'trigger'] : ['trigger'];
  };

  const cycleTableSource = (tableKey) => {
    const sourceOrder = getSourceCycleOrder(tableKey);
    if (sourceOrder.length <= 1) return;
    setActiveSources(prev => {
      const key = sourceStateKey(tableKey);
      const current = prev[key] || (showFromCall && getAgentFieldsForTable(tableKey).length > 0 ? 'agent' : 'trigger');
      const currentIndex = sourceOrder.indexOf(current);
      const next = sourceOrder[(currentIndex + 1) % sourceOrder.length];
      return { ...prev, [key]: next };
    });
  };

  return (
    <div
      className="sb-variables-pane"
      ref={paneRef}
      style={style}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="sb-vars-header">
        <span className="sb-vars-title">Variables</span>
        {fieldLabel && <span className="sb-vars-field-label">for {fieldLabel}</span>}
      </div>

      <div className="sb-vars-scroll">
        {onInsertSmartAction && smartActions.length > 0 && (
          <div className="sb-smart-actions-section">
            <div className="sb-smart-actions-header">
              <Sparkles size={12} className="sb-smart-actions-icon" />
              <span className="sb-smart-actions-title">Smart Actions</span>
            </div>
            <div className="sb-smart-actions-list">
              {smartActions.map((action) => (
                <button key={action.key} type="button" className="sb-smart-action-item" onClick={(e) => { e.stopPropagation(); onInsertSmartAction(action, targetFieldKey); }} title={action.description}>
                  <Zap size={11} className="sb-smart-action-item-icon" />
                  <span className="sb-smart-action-item-name">{action.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <PreviousNodeVars
          currentNodeId={currentNodeId}
          nodes={nodes}
          edges={edges}
          onInsertVariable={onInsertVariable}
          onTableHover={onTableHover}
        />

        <SearchRecordsOutput
          currentNodeId={currentNodeId}
          nodes={nodes}
          edges={edges}
          onInsertVariable={onInsertVariable}
          onTableHover={onTableHover}
        />

        {availableTables.map((table) => {
          const tableRecords = records[table.key] || [];
          const idx = activeIndex[table.key] || 0;
          const currentRecord = tableRecords[idx] || null;
          const isExpanded = expanded[table.key];
          const query = searchQueries[table.key] || '';
          const isSearching = searchStates[table.key] || false;
          const editing = editingTables[table.key] || false;
          const resultCount = getCount(table.key);
          const matchedFields = getMatchedFields(table.key, currentRecord);
          const TableIcon = table.icon;
          const agentFields = getAgentFieldsForTable(table.key);
          const hasAgentData = showFromCall && agentFields.length > 0;
          const activeSource = activeSources[sourceStateKey(table.key)] || (hasAgentData ? 'agent' : 'trigger');
          const showingAgent = activeSource === 'agent';
          const sourceColor = table.color;
          const sourceBg = table.colorBg;
          const sourceBorder = table.colorBorder;
          const receptionistName = activeReceptionist?.first_name?.trim() || activeReceptionist?.full_name?.trim();
          const sourceLabel = showingAgent
            ? (receptionistName || 'Receptionist')
            : 'Trigger';
          const sourceSweepKey = `${sourceStateKey(table.key)}::${activeSource}`;
          const shouldSweepSource = !seenSourceLabelsRef.current.has(sourceSweepKey);
          const showReceptionistArt = showingAgent && !!activeReceptionist?.banner_url;

          return (
            <div
              key={table.key}
              className={`sb-vars-table-group ${isSearching ? 'sb-vars-group-searching' : ''}`}
              style={{
                '--table-color': sourceColor,
                '--table-bg': sourceBg,
                '--table-border': sourceBorder,
              }}
              onMouseEnter={() => onTableHover?.(sourceColor)}
              onMouseLeave={() => onTableHover?.('')}
            >
              <div
                className={`sb-vars-table-header ${editing ? 'sb-vars-header-searching' : ''} ${hasAgentData ? 'sb-vars-table-header--cycle' : ''} ${showReceptionistArt ? 'sb-vars-table-header--receptionist' : ''}`}
                style={editing ? { padding: '4px 6px' } : undefined}
                onClick={() => cycleTableSource(table.key)}
                onKeyDown={(e) => {
                  if (!hasAgentData) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    cycleTableSource(table.key);
                  }
                }}
                role={hasAgentData ? 'button' : undefined}
                tabIndex={hasAgentData ? 0 : undefined}
                title={hasAgentData ? 'Click to switch source' : undefined}
              >
                {showReceptionistArt && (
                  <span
                    className="sb-vars-table-art"
                    style={{ backgroundImage: `url(${activeReceptionist.banner_url})` }}
                    aria-hidden="true"
                  />
                )}
                {editing ? (
                  <div
                    style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 4 }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <Search size={11} style={{ color: sourceColor, flexShrink: 0, opacity: 0.7 }} />
                    <input
                      ref={(el) => { searchInputRefs.current[table.key] = el; }}
                      type="text"
                      className="sb-vars-search-input"
                      value={query}
                      onChange={(e) => handleSearch(table.key, e.target.value)}
                      onBlur={() => handleExit(table.key)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleExit(table.key); else if (e.key === 'Escape') { handleClear(table.key); handleExit(table.key); } }}
                      placeholder={`Search ${table.label.toLowerCase()}...`}
                      onClick={(e) => e.stopPropagation()}
                      style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 11, fontFamily: 'inherit', padding: '2px 0', minWidth: 0 }}
                    />
                    {resultCount > 0 && (
                      <>
                        <span style={{ fontSize: 9, fontWeight: 600, color: sourceColor, textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap', opacity: 0.8 }}>{resultCount} found</span>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', margin: '0 2px' }}>|</span>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); navigateMatched(table.key, -1); }} style={{ background: 'none', border: 'none', color: sourceColor, cursor: 'pointer', padding: '0 1px', display: 'flex', flexShrink: 0, opacity: 0.7 }}><ChevronUp size={10} /></button>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{getMatchedIndices(table.key).indexOf(idx) + 1}/{resultCount}</span>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); navigateMatched(table.key, 1); }} style={{ background: 'none', border: 'none', color: sourceColor, cursor: 'pointer', padding: '0 1px', display: 'flex', flexShrink: 0, opacity: 0.7 }}><ChevronDown size={10} /></button>
                      </>
                    )}
                    {hasAgentData && (
                      <span className="sb-vars-table-source">
                        <span className="sb-vars-table-source-prefix">via</span>
                        <span
                          className={`sb-vars-table-source-name${shouldSweepSource ? ' sb-vars-table-source-name--sweep' : ''}`}
                          style={{ color: sourceColor }}
                        >
                          {sourceLabel}
                        </span>
                      </span>
                    )}
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleClear(table.key); searchInputRefs.current[table.key]?.focus(); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}><X size={11} /></button>
                  </div>
                ) : (
                  <>
                    <button type="button" className="sb-vars-table-chevron" onClick={(e) => { e.stopPropagation(); setExpanded(prev => ({ ...prev, [table.key]: !prev[table.key] })); }}>
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                    <span className="sb-vars-table-icon" style={{ color: sourceColor }}><TableIcon size={11} /></span>
                    <span className="sb-vars-table-label" style={{ textAlign: 'left', flex: 1 }}>{table.label}</span>
                    <span className="sb-vars-table-source">
                      <span className="sb-vars-table-source-prefix">via</span>
                      <span
                        className={`sb-vars-table-source-name${shouldSweepSource ? ' sb-vars-table-source-name--sweep' : ''}`}
                        style={{ color: sourceColor }}
                      >
                        {sourceLabel}
                      </span>
                    </span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleStart(table.key); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '0 2px', display: 'flex', flexShrink: 0, opacity: 0.6 }}>
                      <Search size={11} />
                    </button>
                    {tableRecords.length === 0 && <span className="sb-vars-no-data">No data</span>}
                  </>
                )}
              </div>

              {isExpanded && (
                <div
                  key={`${table.key}-${activeSource}`}
                  className={`sb-vars-fields sb-vars-source-panel ${isSearching ? 'sb-vars-fields-tuning' : ''} ${showingAgent ? 'sb-vars-source-panel--agent' : ''}`}
                  style={{ position: 'relative' }}
                >
                  {editing && !showingAgent && (
                    <div className="sb-vars-varbar" style={{ '--varbar-color': sourceColor }} />
                  )}

                  {showingAgent ? (
                    <>
                      {agentFields.map((field) => {
                        const varRef = getVariableRef(table.key, field.key, 'rec');
                        return (
                          <button
                            key={field.key}
                            type="button"
                            className="sb-vars-field sb-vars-field-agent"
                            onClick={(e) => { e.stopPropagation(); onInsertVariable?.(varRef, field.label, sourceColor); }}
                            title={`Insert ${varRef}`}
                          >
                            <span className="sb-vars-field-name" style={{ color: sourceColor }}>{field.label}</span>
                            <span className="sb-vars-field-value">to be collected</span>
                          </button>
                        );
                      })}
                    </>
                  ) : currentRecord ? (
                    table.fields.map((field) => {
                      const sampleValue = getRecordFieldValue(currentRecord, field.key);
                      const varRef = getVariableRef(table.key, field.key);
                      const hasValue = sampleValue !== null && sampleValue !== undefined;
                      const isMatched = matchedFields.has(field.key);
                      return (
                        <button
                          key={field.key}
                          type="button"
                          className={`sb-vars-field ${isSearching ? 'sb-vars-field-tuning' : ''} ${isMatched ? 'sb-vars-field-matched' : ''}`}
                          onClick={(e) => { e.stopPropagation(); onInsertVariable?.(varRef, field.label, sourceColor); }}
                          title={hasValue ? formatValue(sampleValue, field.type) : 'No value'}
                        >
                          <span className="sb-vars-field-name" style={{ color: sourceColor }}>{field.label}</span>
                          {hasValue && <span className="sb-vars-field-value">{formatValue(sampleValue, field.type)}</span>}
                        </button>
                      );
                    })
                  ) : (
                    <div className="sb-vars-empty">No records found</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VariablesPane;
