import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  User, Calendar, Phone, ChevronDown, ChevronRight, ChevronUp, X, Zap, Sparkles, CreditCard, Search, Layers
} from 'lucide-react';
import { getOutputVariables, isStripeResponseNode } from '../../../sonar/lib/fieldContexts';
import { api } from '../../lib/api';
import { fetchCustomFields, getCurrentBusinessId, getCustomValue, isCustomFieldKey } from '../../lib/customFields';
import { getSmartActionByKey } from './smartActions';
import { renderSafeTemplateHTML } from '../../lib/safeTemplateHTML';

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
  staff: 'staff',
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

const isScenarioDebugEnabled = () => {
  if (typeof window === 'undefined') return false;
  return window.__SCENARIOS_DEBUG__ === true || window.__VARIABLES_PANE_DEBUG__ === true;
};

const scenarioLog = (level, ...args) => {
  if (!isScenarioDebugEnabled()) return;
  const logger = console[level] || console.log;
  logger(...args);
};

const findNearestUpstreamCallNode = (startNodeId, nodes, edges) => {
  if (!startNodeId || !nodes.length) return null;
  const visited = new Set();
  const queue = [startNodeId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    const node = nodes.find((entry) => entry.id === current);
    if (node && node.configured && (node.subOptionKey === 'call_customer' || node.actionConfig?._key === 'call_customer')) {
      return node;
    }

    for (const edge of edges) {
      if (edge.to === current && !visited.has(edge.from)) {
        queue.push(edge.from);
      }
    }
  }

  return null;
};

const SEARCH_FIELDS = {
  people: ['first_name', 'last_name', 'email'],
  payments: ['description', 'status', 'payment_method'],
  appointments: ['notes', 'status', 'date'],
  services: ['name', 'description', 'category'],
  staff: ['full_name', 'role', 'email', 'phone'],
  hired_receptionists: ['full_name', 'stereotype'],
  businesses: ['name', 'email', 'phone', 'address', 'city', 'state'],
};

let peopleCustomVariableFields = [];

const toScenarioCustomField = (field) => ({
  key: field.key,
  label: field.label,
  description: field.description,
  type: field.type,
  options: field.options || field.config?.options || [],
  optionColors: field.optionColors || field.config?.optionColors || {},
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

const getIteratorFieldLabel = (key) => {
  if (key === 'id') return 'Record ID';
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const normalizeIteratorCollectionPath = (value) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  const match = trimmed.match(/^\{\{([^}]+)\}\}$/);
  return (match?.[1] || trimmed).trim();
};

const getIteratorCollectionRef = (nodeId) => `{{${nodeId}}}`;
const getCollectionVariableRef = (tableKey) => `{{${normalizeParsedTableKey(tableKey)}.records}}`;

const getNodeArrayOutput = (node) => {
  if (Array.isArray(node?.searchResults)) return node.searchResults;
  if (Array.isArray(node?.outputData)) return node.outputData;
  if (Array.isArray(node?.outputData?.results)) return node.outputData.results;
  if (Array.isArray(node?.outputData?.records)) return node.outputData.records;
  return null;
};

const getSearchOutputTableKey = (node) => {
  const actionKey = node?.actionConfig?._key;
  if (actionKey === 'search_appointments') return 'appointments';
  if (actionKey === 'search_records') {
    const tableKey = (node.actionConfig?.target_table || 'people').toLowerCase().replace(/\s+/g, '_');
    return normalizeParsedTableKey(tableKey);
  }
  return null;
};

const getAncestorIdsInOrder = (startNodeId, nodes, edges) => {
  if (!startNodeId || !nodes.length) return [];
  const visited = new Set([startNodeId]);
  const queue = [startNodeId];
  const topoOrder = [];
  const visitedTopo = new Set();
  const topoQueue = ['node-1'];
  visitedTopo.add('node-1');

  while (queue.length > 0) {
    const current = queue.shift();
    for (const edge of edges) {
      if (edge.to === current && !visited.has(edge.from)) {
        visited.add(edge.from);
        queue.push(edge.from);
      }
    }
  }

  while (topoQueue.length > 0) {
    const current = topoQueue.shift();
    topoOrder.push(current);
    for (const edge of edges) {
      if (edge.from === current && !visitedTopo.has(edge.to)) {
        visitedTopo.add(edge.to);
        topoQueue.push(edge.to);
      }
    }
  }

  const currentIdx = topoOrder.indexOf(startNodeId);
  return currentIdx > 0 ? topoOrder.slice(0, currentIdx).reverse() : [];
};

const getUpstreamSearchOutputsByTable = (currentNodeId, nodes, edges) => {
  const outputs = {};
  const ancestorIds = getAncestorIdsInOrder(currentNodeId, nodes, edges);

  ancestorIds.forEach((nodeId) => {
    const node = nodes.find((entry) => entry.id === nodeId);
    const tableKey = getSearchOutputTableKey(node);
    const records = getNodeArrayOutput(node);
    if (!tableKey || !Array.isArray(records) || outputs[tableKey]) return;
    outputs[tableKey] = {
      nodeId,
      label: node.label || 'Search',
      records,
    };
  });

  return outputs;
};

const getUpstreamIteratorSourcesByTable = (currentNodeId, nodes, edges) => {
  const outputs = {};
  const ancestorIds = getAncestorIdsInOrder(currentNodeId, nodes, edges);

  ancestorIds.forEach((nodeId) => {
    const node = nodes.find((entry) => entry.id === nodeId);
    if (node?.actionConfig?._key !== 'iterator') return;

    const iteratorSource = getIteratorCurrentFieldsFromNode(node, nodes, edges);
    const sourceTableKey = getSearchOutputTableKey(iteratorSource.sourceNode);
    const sourceRecords = getNodeArrayOutput(iteratorSource.sourceNode) || [];
    const sampleRecord = sourceRecords.find((item) => item && typeof item === 'object' && !Array.isArray(item)) || null;
    if (!sourceTableKey || !sampleRecord || outputs[sourceTableKey]) return;

    outputs[sourceTableKey] = {
      iteratorNodeId: node.id,
      sourceNodeId: iteratorSource.sourceNode?.id || '',
      label: iteratorSource.sourceNode?.label || 'Search',
      records: [sampleRecord],
    };
  });

  return outputs;
};

const findIteratorSourceNode = (iteratorNode, nodes, edges) => {
  const collectionPath = normalizeIteratorCollectionPath(
    iteratorNode?.actionConfig?.collection_path
      || iteratorNode?.actionConfig?.collection
      || iteratorNode?.actionConfig?.array_path
      || ''
  );
  const parts = collectionPath.split('.').filter(Boolean);
  if (parts.length > 0) {
    const directNode = nodes.find((node) => node.id === parts[0]);
    if (directNode) return directNode;
  }

  const ancestorIds = getAncestorIdsInOrder(iteratorNode?.id, nodes, edges);
  return ancestorIds
    .map((nodeId) => nodes.find((node) => node.id === nodeId))
    .find((node) => Array.isArray(getNodeArrayOutput(node))) || null;
};

const getIteratorCurrentFieldsFromNode = (iteratorNode, nodes, edges) => {
  const sourceNode = findIteratorSourceNode(iteratorNode, nodes, edges);
  const records = getNodeArrayOutput(sourceNode) || [];
  const sample = records.find((item) => item && typeof item === 'object' && !Array.isArray(item)) || null;
  if (!sample) {
    return { fields: [], sourceNode };
  }

  const fields = Object.keys(sample)
    .filter((key) => key !== '__proto__' && key !== '_id')
    .map((key) => ({
      key,
      label: getIteratorFieldLabel(key),
      value: sample[key],
    }));

  return { fields, sourceNode };
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
  if (fieldKey === 'id' || fieldKey === 'record_id' || fieldKey === 'person_id' || fieldKey === 'payment_id' || fieldKey === 'invoice_id' || fieldKey === 'customer_id') {
    return 'Record ID';
  }
  const field = getTableFields(tableKey).find((item) => item.key === fieldKey);
  return field?.label || fieldKey;
};

// ─── Trigger → Runtime Table Availability ──────────────────────────────────
// Maps trigger keys to the tables that will have data at runtime.
// Based on ScenarioEngine._buildFlowContext FK relationships.
const TRIGGER_TABLE_MAP = {
  appointment_created: ['appointments', 'people', 'services', 'staff', 'businesses'],
  appointment_updated: ['appointments', 'people', 'services', 'staff', 'businesses'],
  appointment_cancelled: ['appointments', 'people', 'services', 'staff', 'businesses'],
  appointment_rescheduled: ['appointments', 'people', 'services', 'staff', 'businesses'],
  appointment_confirmed: ['appointments', 'people', 'services', 'staff', 'businesses'],
  appointment_soon: ['appointments', 'people', 'services', 'staff', 'businesses'],
  appointment_completed: ['appointments', 'people', 'services', 'staff', 'businesses'],
  appointment_missed: ['appointments', 'people', 'services', 'staff', 'businesses'],
  record_created: ['people', 'businesses'],
  record_updated: ['people', 'businesses'],
  incoming_call: ['people', 'businesses', 'hired_receptionists'],
  call_answered: ['people', 'businesses', 'hired_receptionists'],
  missed_call: ['people', 'businesses'],
  call_failed: ['people', 'businesses'],
  voicemail_received: ['people', 'businesses'],
  sms_received: ['people', 'businesses'],
  sms_sent: ['people', 'businesses'],
  sms_failed: ['people', 'businesses'],
  customer_replied: ['people', 'businesses'],
  payment_received: ['payments', 'people', 'businesses'],
  payment_failed: ['invoices', 'payments', 'people', 'businesses'],
  refund_issued: ['payments', 'people', 'businesses'],
  subscription_created: ['invoices', 'payments', 'people', 'businesses'],
  manual_trigger: ['people', 'payments', 'appointments', 'services', 'staff', 'hired_receptionists', 'businesses'],
};

// Fetch order from ScenarioEngine._buildFlowContext (first fetched = bottom, last fetched = top)
// Visual order bottom to top: people, services, businesses
// After reverse render: array must be [businesses, services, people, ...rest]
const FETCH_ORDER = {
  businesses: 1,
  staff: 1.5,
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
const getAvailableTables = (triggerKey, currentNode = null) => {
  let tables;
  if (!triggerKey) {
    tables = [...TABLE_DEFS];
  } else {
    const availableKeys = TRIGGER_TABLE_MAP[triggerKey];
    if (!availableKeys) {
      tables = [...TABLE_DEFS];
    } else {
      const visibleKeys = new Set([...availableKeys, 'services', 'staff']);
      tables = TABLE_DEFS.filter(t => visibleKeys.has(t.key));
    }
  }

  const focusedTableKey = getFocusedTableKeyForNode(currentNode);
  if (focusedTableKey === 'appointments' && !tables.some((table) => table.key === 'appointments')) {
    const appointmentTable = TABLE_DEFS.find((table) => table.key === 'appointments');
    if (appointmentTable) {
      tables = [...tables, appointmentTable];
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

const orderDisplayedTables = (tables) => {
  const reversed = tables.slice().reverse();
  const businessIndex = reversed.findIndex((table) => table.key === 'businesses');
  const staffIndex = reversed.findIndex((table) => table.key === 'staff');

  if (businessIndex === -1 || staffIndex === -1) return reversed;

  const next = reversed.slice();
  const [staffTable] = next.splice(staffIndex, 1);
  const targetIndex = next.findIndex((table) => table.key === 'businesses');
  next.splice(targetIndex, 0, staffTable);
  return next;
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
      { key: 'id', label: 'Record ID', type: 'text' },
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
      { key: 'id', label: 'Record ID', type: 'text' },
      { key: 'invoice_id', label: 'Record ID', type: 'text' },
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
        const { data } = await supabase.from('invoices').select('id,amount_due,amount_paid,currency,status,stripe_customer_id,due_date,created_at').order('created_at', { ascending: false }).limit(20);
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
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'time', label: 'Time', type: 'text' },
      { key: 'duration', label: 'Duration', type: 'number' },
      { key: 'status', label: 'Status', type: 'text' },
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
        const businessId = await getCurrentBusinessId();
        const { data } = await supabase
          .from('hired_receptionists')
          .select('*')
          .eq('business_id', businessId)
          .limit(20);
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
  {
    key: 'staff',
    label: 'Staff',
    color: '#60a5fa',
    colorBg: 'rgba(96,165,250,0.08)',
    colorBorder: 'rgba(96,165,250,0.2)',
    icon: User,
    fields: [
      { key: 'id', label: 'Record ID', type: 'text' },
      { key: 'business_id', label: 'Business ID', type: 'number' },
      { key: 'full_name', label: 'Full Name', type: 'text' },
      { key: 'first_name', label: 'First Name', type: 'text' },
      { key: 'last_name', label: 'Last Name', type: 'text' },
      { key: 'role', label: 'Role', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'phone' },
      { key: 'avatar', label: 'Avatar', type: 'text' },
      { key: 'is_active', label: 'Is Active', type: 'boolean' },
      { key: 'working_hours', label: 'Working Hours', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'text' },
      { key: 'created_at', label: 'Created At', type: 'timestamp' },
      { key: 'updated_at', label: 'Updated At', type: 'timestamp' },
    ],
    fetch: async () => {
      try {
        const businessId = await getCurrentBusinessId();
        const { data } = await supabase
          .from('staff')
          .select('*')
          .eq('business_id', businessId)
          .limit(20);
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
  staff: '#60a5fa',
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
  staff: 'Staff',
  hired_receptionists: 'Receptionists',
  receptionist: 'Receptionist',
  businesses: 'Businesses',
  business: 'Business',
};

const AGENT_SOURCE_TABLES = new Set(TABLE_DEFS.map((table) => table.key));

export const getAgentFieldsForTable = (tableKey) => {
  if (!AGENT_SOURCE_TABLES.has(tableKey)) return [];
  return getTableFields(tableKey);
};

const normalizeReceptionistDirection = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'incoming') return 'inbound';
  if (normalized === 'outgoing') return 'outbound';
  if (normalized === 'off' || normalized === 'disabled') return 'none';
  return normalized;
};

const isOutboundReceptionistEligible = (receptionist) => {
  if (!receptionist || receptionist.is_active === false) return false;
  const status = String(receptionist.raw_status || receptionist.status || '').trim().toLowerCase();
  if (['archived', 'deleted', 'terminated', 'disabled', 'inactive'].includes(status)) return false;

  const direction = normalizeReceptionistDirection(receptionist.direction);
  if (direction) return direction === 'outbound' || direction === 'all';

  const callTypes = String(receptionist.call_types || 'both').trim().toLowerCase();
  return callTypes === 'both' || callTypes === 'outbound' || callTypes === 'all';
};

const getFocusedTableKeyForNode = (node) => {
  if (!node) return null;
  const actionKey = node.actionConfig?._key || node.subOptionKey || node.triggerKey || '';
  const appointmentKey = node.appointmentConfig?.key || '';
  if (appointmentKey === 'create_appointment' || appointmentKey === 'update_appointment' || appointmentKey === 'cancel_appointment') {
    return 'appointments';
  }
  if (actionKey === 'create_appointment' || actionKey === 'update_appointment' || actionKey === 'cancel_appointment' || actionKey === 'search_appointments') {
    return 'appointments';
  }
  if (['create_new_record', 'update_record', 'search_records'].includes(actionKey)) {
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
  return renderSafeTemplateHTML(value, { smart: (match, key) => {
    const action = escapeHtml(SMART_ACTION_MAP[key]);
    if (!action) return match;
    return `<span class="sb-var-chip" style="background:linear-gradient(135deg,rgba(56,189,248,0.12),rgba(168,85,247,0.12));color:#a855f7;border:1px solid rgba(168,85,247,0.25);display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap;line-height:1.7;vertical-align:middle;gap:2px;">⚡ ${action}</span>`;
  }, variable: (match, ref) => {
    const parts = ref.split('.');
    if (parts.length === 1) {
      const tableKey = normalizeParsedTableKey(parts[0]);
      const color = TABLE_COLORS[tableKey] || TABLE_COLORS[parts[0]] || '#32f0d9';
      const tableLabel = TABLE_LABELS[parts[0]] || parts[0];
      return `<span class="sb-var-chip" style="background:${color}18;color:${color};border:1px solid ${color}25;display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap;line-height:1.7;vertical-align:middle;">${escapeHtml(tableLabel)}.records</span>`;
    }
    if (parts.length >= 2 && parts[0] === 'iterator' && parts[1] === 'current') {
      const color = TABLE_COLORS.iterator || '#f472b6';
      const fieldLabel = getIteratorFieldLabel(parts.slice(2).join('.'));
      return `<span class="sb-var-chip" style="background:${color}18;color:${color};border:1px solid ${color}25;display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap;line-height:1.7;vertical-align:middle;">Iterator.Current Bundle.${escapeHtml(fieldLabel)}</span>`;
    }
    if (parts.length >= 3 && /^\d+$/.test(parts[1])) {
      const tableKey = normalizeParsedTableKey(parts[0]);
      const color = TABLE_COLORS[tableKey] || '#a78bfa';
      const tableLabel = TABLE_LABELS[parts[0]] || TABLE_LABELS[tableKey] || parts[0];
      const fieldLabel = getFieldDisplayLabel(tableKey, parts.slice(2).join('.'));
      return `<span class="sb-var-chip" style="background:${color}18;color:${color};border:1px solid ${color}25;display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap;line-height:1.7;vertical-align:middle;">${escapeHtml(tableLabel)}.${escapeHtml(fieldLabel)}</span>`;
    }
    if (parts.length === 3 && (parts[0] === 'rec' || parts[0] === 'agent' || parts[0] === 'receptionist')) {
      const tableKey = normalizeParsedTableKey(parts[1]);
      const color = TABLE_COLORS[tableKey] || '#a78bfa';
      const tableLabel = TABLE_LABELS[parts[1]] || TABLE_LABELS[tableKey] || parts[1];
      const fieldLabel = getFieldDisplayLabel(tableKey, parts[2]);
      return `<span class="sb-var-chip" style="background:${color}18;color:${color};border:1px solid ${color}25;display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap;line-height:1.7;vertical-align:middle;">rec.${escapeHtml(tableLabel)}.${escapeHtml(fieldLabel)}</span>`;
    }
    if (parts.length >= 3 && parts[0] === 'iterator' && parts[1] === 'current') {
      const color = '#f472b6';
      const fieldLabel = getIteratorFieldLabel(parts.slice(2).join('.'));
      return `<span class="sb-var-chip" style="background:${color}18;color:${color};border:1px solid ${color}25;display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap;line-height:1.7;vertical-align:middle;">Iterator.Current Bundle.${escapeHtml(fieldLabel)}</span>`;
    }
    if (parts.length !== 2) return match;
    if (parts[1] === 'records') {
      const tableKey = normalizeParsedTableKey(parts[0]);
      const color = TABLE_COLORS[tableKey] || TABLE_COLORS[parts[0]] || '#32f0d9';
      const tableLabel = TABLE_LABELS[parts[0]] || TABLE_LABELS[tableKey] || parts[0];
      return `<span class="sb-var-chip" style="background:${color}18;color:${color};border:1px solid ${color}25;display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap;line-height:1.7;vertical-align:middle;">${escapeHtml(tableLabel)}.records</span>`;
    }
    if (parts[0] === 'agent' || parts[0] === 'receptionist') {
      const receptionistColor = TABLE_COLORS.appointments || '#38bdf8';
      return `<span class="sb-var-chip" style="background:${receptionistColor}18;color:${receptionistColor};border:1px solid ${receptionistColor}25;display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap;line-height:1.7;vertical-align:middle;">Receptionist.${escapeHtml(parts[1])}</span>`;
    }
    const tableKey = normalizeParsedTableKey(parts[0]);
    const color = TABLE_COLORS[tableKey] || '#a78bfa';
    const tableLabel = TABLE_LABELS[parts[0]] || TABLE_LABELS[tableKey] || parts[0];
    const fieldLabel = getFieldDisplayLabel(tableKey, parts[1]);
    return `<span class="sb-var-chip" style="background:${color}18;color:${color};border:1px solid ${color}25;display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap;line-height:1.7;vertical-align:middle;">${escapeHtml(tableLabel)}.${escapeHtml(fieldLabel)}</span>`;
  }});
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
    } else if (parts.length >= 3 && parts[0] === 'iterator' && parts[1] === 'current') {
      matches.push({ full, source: 'iterator', table: 'current', field: parts.slice(2).join('.') });
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
  scenarioLog('log', '[SearchRecordsOutput] Found nodes:', searchNodes.length, searchNodes.map(n => ({ id: n.nodeId, hasResults: !!n.records, recordCount: n.records?.length })));

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
            style={{ '--table-color': '#32f0d9', '--table-bg': 'rgba(50,240,217,0.08)', '--table-border': 'rgba(50,240,217,0.2)' }}
            onMouseEnter={() => onTableHover?.(color)}
            onMouseLeave={() => onTableHover?.('')}
          >
            <div className="sb-vars-table-header" style={{ cursor: 'default' }}>
              <span className="sb-vars-table-icon" style={{ color }}><Layers size={11} /></span>
              <span className="sb-vars-table-label" style={{ textAlign: 'left', flex: 1 }}>{node.label}</span>
              {hasResults && <span className="sb-vars-table-badge">{records.length} records</span>}
            </div>
            <div className="sb-vars-fields">
              <button
                type="button"
                className="sb-vars-field"
                onClick={(e) => { e.stopPropagation(); onInsertVariable?.(getIteratorCollectionRef(node.nodeId), `${node.label} records`, '#32f0d9'); }}
                title={`Insert {{${node.nodeId}}}`}
                style={{ fontWeight: 700 }}
              >
                <span className="sb-vars-field-name" style={{ color: '#32f0d9' }}>All records</span>
                <span className="sb-vars-field-value">{hasResults ? `${records.length} item${records.length === 1 ? '' : 's'}` : 'List output'}</span>
              </button>
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
      const isTriggerNode = node.categoryType === 'TRIGGERS' || (!!node.triggerKey && !node.actionConfig);
      if (isTriggerNode) return null;
      if (getSearchOutputTableKey(node)) return null;
      const display = getNodeDisplay(node.categoryType);
      const label = node.label || display.defaultLabel;
      const isIteratorNode = node.actionConfig?._key === 'iterator';
      const outputVars = isIteratorNode ? [] : getOutputVariables(node);
      const outputData = node.outputData || null;
      if (!isIteratorNode && outputData == null && outputVars.length === 0) return null;
      const isStripeResponse = isStripeResponseNode(node);
      return { nodeId, label, categoryType: node.categoryType, icon: display.icon, outputVars, outputData, isStripeResponse, isIteratorNode };
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
        const isPeopleVariableSet = String(prev.label || '').toLowerCase() === 'people';
        const color = isPeopleVariableSet ? '#32f0d9' : (prev.isIteratorNode ? '#f472b6' : '#a78bfa');
        const responseBg = isPeopleVariableSet ? 'rgba(50,240,217,0.08)' : 'rgba(167,139,250,0.08)';
        const responseBorder = isPeopleVariableSet ? 'rgba(50,240,217,0.2)' : 'rgba(167,139,250,0.2)';
        const isExpanded = expandedNodes[prev.nodeId] !== false;
        const hasOutput = prev.outputData != null;
        const sourceName = prev.isStripeResponse ? 'Stripe' : null;
        const iteratorSource = prev.isIteratorNode ? getIteratorCurrentFieldsFromNode(nodes.find((n) => n.id === prev.nodeId), nodes, edges) : { fields: [], sourceNode: null };
        const iteratorCurrentFields = iteratorSource.fields;
        const iteratorSourceLabel = iteratorSource.sourceNode?.label || null;

        return (
          <div
            key={prev.nodeId}
            className="sb-vars-table-group sb-vars-table-group--response"
            style={{
              '--table-color': color,
              '--table-bg': responseBg,
              '--table-border': responseBorder,
            }}
            onMouseEnter={() => onTableHover?.(color)}
            onMouseLeave={() => onTableHover?.('')}
          >
            <button
              type="button"
              className="sb-vars-table-header sb-vars-table-header--response"
              style={prev.isIteratorNode ? {
                background: 'rgba(244,114,182,0.08)',
                borderColor: 'rgba(244,114,182,0.2)',
                boxShadow: 'none',
              } : {
                background: responseBg,
                borderColor: responseBorder,
                boxShadow: `inset 0 0 0 1px ${responseBorder}, inset 3px 0 0 ${color}`,
              }}
              onClick={() => setExpandedNodes(p => ({ ...p, [prev.nodeId]: !isExpanded }))}
            >
              <span className="sb-vars-table-chevron">
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
              <span className="sb-vars-table-icon" style={{ color }}><NodeIcon size={11} /></span>
              <span className="sb-vars-table-label" style={{ textAlign: 'left', flex: 1 }}>{prev.isIteratorNode ? 'Iterator' : prev.label}</span>
              {prev.isIteratorNode && iteratorSourceLabel && (
                <span
                  className="sb-vars-table-badge sb-vars-table-badge--iterator sb-vars-table-source-name sb-vars-table-source-name--sweep"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'rgba(244,114,182,0.10)',
                    color: '#f472b6',
                    borderColor: 'rgba(244,114,182,0.24)',
                  }}
                >
                  <Layers size={10} />
                  <span>{iteratorSourceLabel}</span>
                </span>
              )}
              {sourceName && (
                <span className="sb-vars-table-source">
                  <span className="sb-vars-table-source-prefix">via</span>
                  <span className="sb-vars-table-source-name" style={{ color }}>{sourceName}</span>
                </span>
              )}
            </button>

            {isExpanded && (
              <div className="sb-vars-fields">
                {prev.isIteratorNode ? (
                  <>
                    {iteratorCurrentFields.length === 0 ? (
                      <div className="sb-vars-empty">
                        Run the upstream bundle source first to inspect the current bundle fields.
                      </div>
                    ) : iteratorCurrentFields.map((field) => (
                      (() => {
                        const displayVal = field.value == null
                          ? ''
                          : (typeof field.value === 'object'
                              ? JSON.stringify(field.value)
                              : String(field.value));
                        return (
                          <button
                            key={field.key}
                            type="button"
                            className="sb-vars-field"
                            onClick={(e) => { e.stopPropagation(); onInsertVariable?.(`{{iterator.current.${field.key}}}`, field.label, color); }}
                            title={`Insert {{iterator.current.${field.key}}}`}
                          >
                            <span className="sb-vars-field-name" style={{ color }}>{field.label}</span>
                            {displayVal && (
                              <span className="sb-vars-field-value">{displayVal.length > 40 ? `${displayVal.slice(0, 40)}…` : displayVal}</span>
                            )}
                          </button>
                        );
                      })()
                    ))}
                  </>
                ) : prev.outputVars.length === 0 ? (
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
                        title={displayVal || varRef}
                      >
                        <span className="sb-vars-field-name" style={{ color }}>{field.label}</span>
                        {hasOutput && displayVal && <span className="sb-vars-field-value">{displayVal}</span>}
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


const VariablesPane = ({ visible, fieldLabel, onInsertVariable, onTableHover, onClose, style = {}, nodes = [], edges = [], currentNodeId = '' }) => {
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
        scenarioLog('warn', '[VariablesPane] Could not load custom people fields:', error?.message || error);
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
    const available = getAvailableTables(triggerKey, currentNode || null);
    const fetchAll = async () => {
      const fetched = await Promise.all(available.map(async (table) => [table.key, await table.fetch()]));
      const results = Object.fromEntries(fetched);
      const indices = Object.fromEntries(available.map((table) => [table.key, 0]));
      setRecords(results);
      setActiveIndex(indices);
      setExpanded((prev) => {
        const next = { ...prev };
        available.forEach((table) => {
          if (typeof next[table.key] !== 'boolean') {
            next[table.key] = true;
          }
        });
        return next;
      });
    };
    fetchAll();
  }, [visible, currentNodeId, customFieldsReady, findTriggerKeyForNode(currentNodeId, nodes, edges), focusedTableKey]);

  const receptionistSelectionKey = [
    currentNodeId,
    findNearestUpstreamCallNode(currentNodeId, nodes, edges)?.actionConfig?.assigned_receptionist || '',
  ].join(':');

  useEffect(() => {
    let cancelled = false;
    if (!visible) return undefined;

    const loadActiveReceptionist = async () => {
      try {
        scenarioLog('log', '[VariablesPane] loadActiveReceptionist:start', {
          currentNodeId,
          visible,
        });

        const { data: authData } = await supabase.auth.getUser();
        if (cancelled) return;

        const userId = authData?.user?.id;
        if (!userId) {
          scenarioLog('warn', '[VariablesPane] loadActiveReceptionist:no-user');
          setActiveReceptionist(null);
          return;
        }

        const businessId = await getCurrentBusinessId().catch(() => null);
        if (cancelled) return;
        scenarioLog('log', '[VariablesPane] loadActiveReceptionist:scope', {
          userId,
          businessId,
        });

        const agents = await api.getAgents();
        scenarioLog('log', '[VariablesPane] loadActiveReceptionist:agents', agents);

        const activeAgents = Array.isArray(agents)
          ? agents.filter(isOutboundReceptionistEligible)
          : [];

        if (activeAgents.length > 0) {
          const upstreamCallNode = findNearestUpstreamCallNode(currentNodeId, nodes, edges);
          const assignedReceptionist = String(upstreamCallNode?.actionConfig?.assigned_receptionist || '').trim().toLowerCase();
          const preferredAgent = assignedReceptionist
            ? activeAgents.find((agent) => {
                const id = String(agent.id || '').trim().toLowerCase();
                const fullName = String(agent.full_name || agent.name || '').trim().toLowerCase();
                const firstName = String(agent.first_name || '').trim().toLowerCase();
                return assignedReceptionist === id || assignedReceptionist === fullName || assignedReceptionist === firstName;
              }) || activeAgents[0]
            : activeAgents[0];

          let bannerId = preferredAgent?.banner_id || null;
          if (!bannerId && preferredAgent?.catalog_id) {
            const { data: catalogRow } = await supabase
              .from('receptionist_catalog')
              .select('banner_id')
              .eq('id', preferredAgent.catalog_id)
              .maybeSingle();
            if (!cancelled) {
              bannerId = catalogRow?.banner_id || null;
            }
          }

          if (cancelled) return;

          const nextReceptionist = {
            ...preferredAgent,
            full_name: preferredAgent.full_name || preferredAgent.name || '',
            first_name: preferredAgent.first_name || preferredAgent.name || '',
            banner_id: bannerId,
            banner_url: preferredAgent.banner_url || getReceptionistBannerUrl(bannerId) || preferredAgent.avatar || null,
          };
          scenarioLog('log', '[VariablesPane] loadActiveReceptionist:resolved-from-agents', nextReceptionist);
          setActiveReceptionist(nextReceptionist);
          return;
        }

        let receptionistQuery = supabase
          .from('hired_receptionists')
          .select('id, full_name, first_name, avatar, status, user_id, business_id, catalog_id, call_types, direction')
          .eq('is_active', true)
          .limit(10);

        if (businessId) {
          receptionistQuery = receptionistQuery.eq('business_id', businessId);
        } else {
          receptionistQuery = receptionistQuery.eq('user_id', userId);
        }

        let { data: rows } = await receptionistQuery;
        scenarioLog('log', '[VariablesPane] loadActiveReceptionist:initial-rows', rows);

        if ((!rows || rows.length === 0) && businessId) {
          const fallbackResponse = await supabase
            .from('hired_receptionists')
            .select('id, full_name, first_name, avatar, status, user_id, business_id, catalog_id, call_types, direction')
            .eq('user_id', userId)
            .eq('is_active', true)
            .limit(10);
          rows = fallbackResponse.data || [];
          scenarioLog('log', '[VariablesPane] loadActiveReceptionist:fallback-rows', rows);
        }

        if (cancelled) return;

        const eligibleRows = (rows || []).filter(isOutboundReceptionistEligible);

        const upstreamCallNode = findNearestUpstreamCallNode(currentNodeId, nodes, edges);
        const assignedReceptionist = String(upstreamCallNode?.actionConfig?.assigned_receptionist || '').trim().toLowerCase();
        scenarioLog('log', '[VariablesPane] loadActiveReceptionist:selection-input', {
          upstreamCallNodeId: upstreamCallNode?.id || null,
          assignedReceptionist,
          totalRows: (rows || []).length,
          eligibleRows,
        });
        const preferred = assignedReceptionist
          ? eligibleRows.find((row) => {
              const id = String(row.id || '').trim().toLowerCase();
              const fullName = String(row.full_name || '').trim().toLowerCase();
              const firstName = String(row.first_name || '').trim().toLowerCase();
              return assignedReceptionist === id || assignedReceptionist === fullName || assignedReceptionist === firstName;
            }) || eligibleRows[0] || null
          : eligibleRows[0] || null;

        if (!preferred) {
          scenarioLog('warn', '[VariablesPane] loadActiveReceptionist:no-preferred');
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
            scenarioLog('log', '[VariablesPane] loadActiveReceptionist:catalog', {
              catalogId: preferred.catalog_id,
              bannerId,
            });
          }
        }

        if (cancelled) return;

        const nextReceptionist = {
          ...preferred,
          banner_id: bannerId,
          banner_url: getReceptionistBannerUrl(bannerId),
        };
        scenarioLog('log', '[VariablesPane] loadActiveReceptionist:resolved', nextReceptionist);
        setActiveReceptionist(nextReceptionist);
      } catch (error) {
        scenarioLog('error', '[VariablesPane] loadActiveReceptionist:error', error);
        if (!cancelled) setActiveReceptionist(null);
      }
    };

    loadActiveReceptionist();
    return () => { cancelled = true; };
  }, [visible, receptionistSelectionKey]);

  useEffect(() => {
    if (!visible || !customFieldsReady) return;
    const currentTriggerKey = findTriggerKeyForNode(currentNodeId, nodes, edges);
    const tables = orderDisplayedTables(getAvailableTables(currentTriggerKey));
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
    if (!visible) return;
    scenarioLog('log', '[VariablesPane] activeReceptionist:state', activeReceptionist);
  }, [visible, activeReceptionist]);

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
  const searchOutputsByTable = useMemo(
    () => getUpstreamSearchOutputsByTable(currentNodeId, nodes, edges),
    [currentNodeId, nodes, edges]
  );
  const iteratorSourcesByTable = useMemo(
    () => getUpstreamIteratorSourcesByTable(currentNodeId, nodes, edges),
    [currentNodeId, nodes, edges]
  );

  if (!visible) return null;

  const getVisibleTableRecords = (tableKey) => {
    const activeSource = activeSources[sourceStateKey(tableKey)] || (
      iteratorSourcesByTable[tableKey]
        ? 'search'
        : searchOutputsByTable[tableKey]
        ? 'search'
        : (showFromCall && getAgentFieldsForTable(tableKey).length > 0 ? 'agent' : 'trigger')
    );
    if (activeSource === 'search') {
      return iteratorSourcesByTable[tableKey]?.records || searchOutputsByTable[tableKey]?.records || [];
    }
    return records[tableKey] || [];
  };

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
      const tableRecords = getVisibleTableRecords(tableKey);
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
    const tableRecords = getVisibleTableRecords(tableKey);
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
    const tableRecords = getVisibleTableRecords(tableKey);
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

  const sourceStateKey = (tableKey) => `${currentNodeId || 'none'}::${tableKey}`;
  const availableTables = (() => {
    const baseTables = orderDisplayedTables(getAvailableTables(findTriggerKeyForNode(currentNodeId, nodes, edges), currentNode || null));
    const byKey = new Map(baseTables.map((table) => [table.key, table]));
    [...new Set([...Object.keys(searchOutputsByTable), ...Object.keys(iteratorSourcesByTable)])].forEach((tableKey) => {
      if (!byKey.has(tableKey)) {
        const table = TABLE_DEFS.find((item) => item.key === tableKey);
        if (table) byKey.set(tableKey, withCustomFields(table));
      }
    });
    const tables = Array.from(byKey.values());
    return tables.sort((a, b) => {
      const aSearch = (searchOutputsByTable[a.key] || iteratorSourcesByTable[a.key]) ? 0 : 1;
      const bSearch = (searchOutputsByTable[b.key] || iteratorSourcesByTable[b.key]) ? 0 : 1;
      if (aSearch !== bSearch) return aSearch - bSearch;
      return 0;
    });
  })();

  const getSourceCycleOrder = (tableKey) => {
    const hasAgentFields = showFromCall && getAgentFieldsForTable(tableKey).length > 0;
    const order = [];
    if (searchOutputsByTable[tableKey] || iteratorSourcesByTable[tableKey]) order.push('search');
    if (hasAgentFields) order.push('agent');
    order.push('trigger');
    return order;
  };

  const cycleTableSource = (tableKey) => {
    const sourceOrder = getSourceCycleOrder(tableKey);
    if (sourceOrder.length <= 1) return;
    setActiveSources(prev => {
      const key = sourceStateKey(tableKey);
      const current = prev[key] || (
        (searchOutputsByTable[tableKey] || iteratorSourcesByTable[tableKey])
          ? 'search'
          : (showFromCall && getAgentFieldsForTable(tableKey).length > 0 ? 'agent' : 'trigger')
      );
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
        <PreviousNodeVars
          currentNodeId={currentNodeId}
          nodes={nodes}
          edges={edges}
          onInsertVariable={onInsertVariable}
          onTableHover={onTableHover}
        />

        {availableTables.map((table) => {
          const isExpanded = expanded[table.key];
          const query = searchQueries[table.key] || '';
          const isSearching = searchStates[table.key] || false;
          const editing = editingTables[table.key] || false;
          const TableIcon = table.icon;
          const agentFields = getAgentFieldsForTable(table.key);
          const hasAgentData = showFromCall && agentFields.length > 0;
          const searchSource = iteratorSourcesByTable[table.key] || searchOutputsByTable[table.key] || null;
          const activeSource = activeSources[sourceStateKey(table.key)] || (searchSource ? 'search' : (hasAgentData ? 'agent' : 'trigger'));
          const showingAgent = activeSource === 'agent';
          const sourceColor = table.color;
          const sourceBg = table.colorBg;
          const sourceBorder = table.colorBorder;
          const receptionistName = activeReceptionist?.first_name?.trim() || activeReceptionist?.full_name?.trim();
          const sourceLabel = activeSource === 'search'
            ? 'Search'
            : showingAgent
              ? (receptionistName || 'Receptionist')
              : 'Trigger';
          const tableRecords = activeSource === 'search'
            ? (searchSource?.records || [])
            : (records[table.key] || []);
          const idx = Math.min(activeIndex[table.key] || 0, Math.max(tableRecords.length - 1, 0));
          const currentRecord = tableRecords[idx] || null;
          const resultCount = getCount(table.key);
          const matchedFields = getMatchedFields(table.key, currentRecord);
          if (table.key === 'people' && showingAgent) {
            scenarioLog('log', '[VariablesPane] render:agent-source-label', {
              tableKey: table.key,
              activeSource,
              receptionistName,
              sourceLabel,
              activeReceptionist,
            });
          }
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
                className={`sb-vars-table-header ${editing ? 'sb-vars-header-searching' : ''} ${(hasAgentData || searchSource) ? 'sb-vars-table-header--cycle' : ''} ${showReceptionistArt ? 'sb-vars-table-header--receptionist' : ''}`}
                style={editing ? { padding: '4px 6px' } : undefined}
                onClick={() => cycleTableSource(table.key)}
                onKeyDown={(e) => {
                  if (!hasAgentData && !searchSource) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    cycleTableSource(table.key);
                  }
                }}
                role={(hasAgentData || searchSource) ? 'button' : undefined}
                tabIndex={(hasAgentData || searchSource) ? 0 : undefined}
                title={(hasAgentData || searchSource) ? 'Click to switch source' : undefined}
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
                    {(hasAgentData || searchSource) && (
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
                    <>
                      {activeSource === 'search' && searchSource && (
                        <button
                          type="button"
                          className="sb-vars-field"
                          onClick={(e) => {
                            e.stopPropagation();
                            onInsertVariable?.(getCollectionVariableRef(table.key), `${table.label} records`, sourceColor);
                          }}
                          title={`Insert {{${normalizeParsedTableKey(table.key)}.records}}`}
                        >
                          <span className="sb-vars-field-name" style={{ color: sourceColor }}>All records</span>
                          <span className="sb-vars-field-value">{tableRecords.length} item{tableRecords.length === 1 ? '' : 's'}</span>
                        </button>
                      )}
                      {table.fields.map((field) => {
                        const sampleValue = getRecordFieldValue(currentRecord, field.key);
                        const varRef = activeSource === 'search' && searchSource?.iteratorNodeId
                          ? `{{iterator.current.${field.key}}}`
                          : activeSource === 'search' && searchSource
                            ? getVariableRef(table.key, `${idx}.${field.key}`)
                          : getVariableRef(table.key, field.key);
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
                      })}
                    </>
                  ) : null}
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
