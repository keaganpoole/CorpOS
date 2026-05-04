import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  User, Calendar, Phone, ChevronDown, ChevronRight, ChevronUp, X, Zap, Sparkles, Mic, CreditCard, Search, Layers
} from 'lucide-react';
import { getOutputVariables } from '../../../sonar/lib/fieldContexts';
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
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const SEARCH_FIELDS = {
  people: ['first_name', 'last_name', 'email', 'notes'],
  payments: ['description', 'status', 'payment_method'],
  appointments: ['client_name', 'notes', 'status', 'date'],
  services: ['name', 'description', 'category'],
  hired_receptionists: ['full_name', 'stereotype', 'phone_number'],
  businesses: ['name', 'email', 'phone', 'address', 'city', 'state'],
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
  invoice_created: ['payments', 'people', 'businesses'],
  invoice_paid: ['payments', 'people', 'businesses'],
  payment_failed: ['payments', 'people', 'businesses'],
  invoice_sent: ['payments', 'people', 'businesses'],
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
      tables = TABLE_DEFS.filter(t => availableKeys.includes(t.key));
    }
  }

  // Sort: bottom = foundational (people always lowest), top = most specific
  tables.sort((a, b) => {
    const aKey = a.key === 'people' ? PEOPLE_SORT_KEY : (FETCH_ORDER[a.key] || 50);
    const bKey = b.key === 'people' ? PEOPLE_SORT_KEY : (FETCH_ORDER[b.key] || 50);
    return aKey - bKey;
  });

  return tables;
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
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'source', label: 'Source', type: 'text' },
      { key: 'lead_source_detail', label: 'Source Detail', type: 'text' },
      { key: 'tags', label: 'Tags', type: 'text' },
      { key: 'last_call_status', label: 'Last Call Status', type: 'text' },
      { key: 'last_intent', label: 'Last Intent', type: 'text' },
      { key: 'last_outcome', label: 'Last Outcome', type: 'text' },
      { key: 'missed_call_count', label: 'Missed Call Count', type: 'number' },
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
  appointments: '#38bdf8',
  services: '#fb923c',
  hired_receptionists: '#f472b6',
  businesses: '#a1a1aa',
};

export const TABLE_LABELS = {
  people: 'People',
  payments: 'Payment',
  appointments: 'Appointment',
  services: 'Service',
  hired_receptionists: 'Receptionist',
  businesses: 'Business',
};

const DEFAULT_AGENT_VARS = [
  { key: 'record_id', label: 'Record ID', category: 'people' },
  { key: 'first_name', label: 'First Name', category: 'people' },
  { key: 'last_name', label: 'Last Name', category: 'people' },
  { key: 'email', label: 'Email', category: 'people' },
  { key: 'notes', label: 'Notes', category: 'people' },
  { key: 'last_outcome', label: 'Outcome', category: 'people' },
  { key: 'last_call_status', label: 'Call Status', category: 'people' },
  { key: 'callback_needed', label: 'Callback Needed', category: 'people' },
  { key: 'callback_due_at', label: 'Callback Due At', category: 'people' },
  { key: 'best_time_to_contact', label: 'Best Time to Contact', category: 'people' },
  { key: 'special_instructions', label: 'Special Instructions', category: 'people' },
  { key: 'consent_sms', label: 'Consent SMS', category: 'people' },
  { key: 'consent_call', label: 'Consent Call', category: 'people' },
  { key: 'new_appt_date', label: 'Appointment Date', category: 'appointments' },
  { key: 'new_appt_time', label: 'Appointment Time', category: 'appointments' },
  { key: 'new_appt_duration', label: 'Appointment Duration', category: 'appointments' },
  { key: 'new_appt_service', label: 'Appointment Service', category: 'appointments' },
  { key: 'new_appt_client_name', label: 'Appointment Client Name', category: 'appointments' },
  { key: 'cancel_appt_id', label: 'Cancel Appointment ID', category: 'appointments' },
  { key: 'update_appt_id', label: 'Update Appointment ID', category: 'appointments' },
  { key: 'update_appt_date', label: 'Update Appointment Date', category: 'appointments' },
  { key: 'update_appt_time', label: 'Update Appointment Time', category: 'appointments' },
];

export const getVariableRef = (tableKey, fieldKey) => `{{${tableKey}.${fieldKey}}}`;

export const renderVarChipsHTML = (value) => {
  if (!value || typeof value !== 'string') return '';
  let result = value.replace(/\{smart:([^}]+)\}/g, (match, key) => {
    const action = SMART_ACTION_MAP[key];
    if (!action) return match;
    return `<span class="sb-var-chip" style="background:linear-gradient(135deg,rgba(56,189,248,0.12),rgba(168,85,247,0.12));color:#a855f7;border:1px solid rgba(168,85,247,0.25);display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap;line-height:1.7;vertical-align:middle;gap:2px;">⚡ ${action}</span>`;
  });
  result = result.replace(/\{\{([^}]+)\}\}/g, (match, ref) => {
    const parts = ref.split('.');
    if (parts.length !== 2) return match;
    if (parts[0] === 'agent') {
      return `<span class="sb-var-chip" style="background:rgba(50,240,217,0.12);color:#32f0d9;border:1px solid rgba(50,240,217,0.25);display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap;line-height:1.7;vertical-align:middle;">Call.${parts[1]}</span>`;
    }
    const color = TABLE_COLORS[parts[0]] || '#a78bfa';
    const tableLabel = TABLE_LABELS[parts[0]] || parts[0];
    return `<span class="sb-var-chip" style="background:${color}18;color:${color};border:1px solid ${color}25;display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap;line-height:1.7;vertical-align:middle;">${tableLabel}.${parts[1]}</span>`;
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
      matches.push({ full, table: parts[0], field: parts[1] });
    }
  }
  return matches;
};

// Sections menu for the variables panel
const SECTIONS = [
  { id: 'current', label: 'Database' },
  { id: 'previous', label: 'Scenario' },
];

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

// Search Records Output — shows runtime output from Search Records nodes in Scenario tab
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
                  const entries = Object.entries(record).filter(([k]) => k !== '_id' && k !== '__proto__');
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
                          {entries.map(([fieldKey, fieldValue]) => {
                            const varRef = getVariableRef(node.nodeId, `records.${idx}.${fieldKey}`);
                            const displayVal = fieldValue == null ? '—' : (typeof fieldValue === 'object' ? JSON.stringify(fieldValue) : String(fieldValue));
                            return (
                              <button
                                key={fieldKey}
                                type="button"
                                className="sb-vars-field"
                                onClick={(e) => { e.stopPropagation(); onInsertVariable?.(varRef, fieldKey, color); }}
                                title={`Insert {{${node.nodeId}.records.${idx}.${fieldKey}}}`}
                              >
                                <span className="sb-vars-field-name" style={{ color }}>{fieldKey}</span>
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
      return { nodeId, label, categoryType: node.categoryType, icon: display.icon, outputVars, outputData };
    }).filter(Boolean);
  };

  const prevNodes = getPreviousNodes();

  if (prevNodes.length === 0) {
    return (
      <div className="sb-vars-empty" style={{ padding: '20px 12px' }}>
        No previous nodes found
      </div>
    );
  }

  return (
    <>
      {prevNodes.map((prev) => {
        const NodeIcon = prev.icon;
        const color = '#a78bfa';
        const isExpanded = expandedNodes[prev.nodeId] !== false;
        const hasOutput = prev.outputData != null;

        return (
          <div
            key={prev.nodeId}
            className="sb-vars-table-group"
            style={{ '--table-color': color, '--table-bg': 'rgba(167,139,250,0.08)', '--table-border': 'rgba(167,139,250,0.2)' }}
            onMouseEnter={() => onTableHover?.(color)}
            onMouseLeave={() => onTableHover?.('')}
          >
            <button
              type="button"
              className="sb-vars-table-header"
              onClick={() => setExpandedNodes(p => ({ ...p, [prev.nodeId]: !isExpanded }))}
            >
              <span className="sb-vars-table-chevron">
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
              <span className="sb-vars-table-icon" style={{ color }}><NodeIcon size={11} /></span>
              <span className="sb-vars-table-label" style={{ textAlign: 'left', flex: 1 }}>{prev.label}</span>
              {hasOutput && <span className="sb-vars-table-badge">RUN</span>}
            </button>

            {isExpanded && (
              <div className="sb-vars-fields">
                {prev.outputVars.length === 0 ? (
                  <div className="sb-vars-empty">No output variables</div>
                ) : (
                  prev.outputVars.map((field) => {
                    const varRef = getVariableRef(prev.nodeId, field.key);
                    const rawValue = hasOutput ? (prev.outputData?.[field.key]) : undefined;
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
  const [activeSection, setActiveSection] = useState('current');
  const searchTimers = useRef({});
  const searchInputRefs = useRef({});
  const paneRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
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
    const node = nodes.find(n => n.id === currentNodeId);
    if (!node || node.categoryType !== 'TRIGGERS') return false;
    const phoneTriggers = ['incoming_call', 'call_answered', 'missed_call', 'call_failed', 'voicemail_received'];
    return phoneTriggers.includes(node.subOptionKey || node.actionConfig?._key || '');
  })();

  const isCallAction = (() => {
    const node = nodes.find(n => n.id === currentNodeId);
    if (!node) return false;
    const callActions = ['call_customer', 'call_phone_number'];
    return callActions.includes(node.subOptionKey || node.actionConfig?._key || '');
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
          const val = record[field];
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
        const val = record[field];
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
        const val = record[field];
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
      const val = record[field];
      if (val != null && String(val).toLowerCase().includes(lowerQuery)) {
        matched.add(field);
      }
    }
    return matched;
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

      {/* Section menu */}
      <div className="sb-vars-section-menu">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className={`sb-vars-section-tab ${activeSection === section.id ? 'sb-vars-section-tab--active' : ''}`}
            onClick={() => setActiveSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className="sb-vars-scroll">
        {activeSection === 'current' && (
        <>
        {showFromCall && (
          <div className="sb-vars-table-group" style={{ '--table-color': '#32f0d9', '--table-bg': 'rgba(50,240,217,0.08)', '--table-border': 'rgba(50,240,217,0.2)' }} onMouseEnter={() => onTableHover?.('#32f0d9')} onMouseLeave={() => onTableHover?.('')}>
            <button type="button" className="sb-vars-table-header" onClick={() => setExpanded(prev => ({ ...prev, __agent: !prev.__agent }))}>
              <span className="sb-vars-table-chevron">{expanded.__agent ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
              <span className="sb-vars-table-icon" style={{ color: '#32f0d9' }}><Mic size={11} /></span>
              <span className="sb-vars-table-label">From Call</span>
              <span className="sb-vars-table-badge">Agent Data</span>
            </button>
            {expanded.__agent && (
              <div className="sb-vars-fields">
                {(() => {
                  const currentNode = nodes.find(n => n.id === currentNodeId);
                  const nodeCategory = currentNode?.categoryKey || '';
                  const isAppointmentNode = nodeCategory === 'appointments' || nodeCategory === 'appointment_scheduling';
                  if (isAppointmentNode) {
                    return (
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#32f0d9', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 0 2px 8px', opacity: 0.7 }}>Appointments</div>
                        {DEFAULT_AGENT_VARS.filter(f => f.category === 'appointments').map((field) => {
                          const varRef = `{{agent.${field.key}}}`;
                          return (
                            <button key={field.key} type="button" className="sb-vars-field" onClick={(e) => { e.stopPropagation(); onInsertVariable?.(varRef, field.label, '#32f0d9'); }} title={`Insert ${varRef}`}>
                              <span className="sb-vars-field-name" style={{ color: '#32f0d9' }}>{field.label}</span>
                              <span className="sb-vars-field-value" style={{ color: '#666', fontStyle: 'italic' }}>to be collected</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  }
                  return (
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#32f0d9', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 0 2px 8px', opacity: 0.7 }}>Customer Record</div>
                      {DEFAULT_AGENT_VARS.filter(f => f.category === 'people').map((field) => {
                        const varRef = `{{agent.${field.key}}}`;
                        return (
                          <button key={field.key} type="button" className="sb-vars-field" onClick={(e) => { e.stopPropagation(); onInsertVariable?.(varRef, field.label, '#32f0d9'); }} title={`Insert ${varRef}`}>
                            <span className="sb-vars-field-name" style={{ color: '#32f0d9' }}>{field.label}</span>
                            <span className="sb-vars-field-value" style={{ color: '#666', fontStyle: 'italic' }}>to be collected</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

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

        {getAvailableTables(findTriggerKeyForNode(currentNodeId, nodes, edges)).slice().reverse().map((table) => {
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

          return (
            <div key={table.key} className={`sb-vars-table-group ${isSearching ? 'sb-vars-group-searching' : ''}`} style={{ '--table-color': table.color, '--table-bg': table.colorBg, '--table-border': table.colorBorder }} onMouseEnter={() => onTableHover?.(table.color)} onMouseLeave={() => onTableHover?.('')}>
              <div type="button" className={`sb-vars-table-header ${editing ? 'sb-vars-header-searching' : ''}`} style={editing ? { padding: '4px 6px' } : undefined}>
                {editing ? (
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 4 }}>
                    <Search size={11} style={{ color: table.color, flexShrink: 0, opacity: 0.7 }} />
                    <input
                      ref={(el) => { searchInputRefs.current[table.key] = el; }}
                      type="text"
                      className="sb-vars-search-input"
                      value={query}
                      onChange={(e) => handleSearch(table.key, e.target.value)}
                      onBlur={() => handleExit(table.key)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleExit(table.key); else if (e.key === 'Escape') { handleClear(table.key); handleExit(table.key); } }}
                      placeholder={`Search ${table.label.toLowerCase()}...`}
                      style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 11, fontFamily: 'inherit', padding: '2px 0', minWidth: 0 }}
                    />
                    {resultCount > 0 && (
                      <>
                        <span style={{ fontSize: 9, fontWeight: 600, color: table.color, textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap', opacity: 0.8 }}>{resultCount} found</span>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', margin: '0 2px' }}>|</span>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); navigateMatched(table.key, -1); }} style={{ background: 'none', border: 'none', color: table.color, cursor: 'pointer', padding: '0 1px', display: 'flex', flexShrink: 0, opacity: 0.7 }}><ChevronUp size={10} /></button>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{getMatchedIndices(table.key).indexOf(idx) + 1}/{resultCount}</span>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); navigateMatched(table.key, 1); }} style={{ background: 'none', border: 'none', color: table.color, cursor: 'pointer', padding: '0 1px', display: 'flex', flexShrink: 0, opacity: 0.7 }}><ChevronDown size={10} /></button>
                      </>
                    )}
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleClear(table.key); searchInputRefs.current[table.key]?.focus(); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}><X size={11} /></button>
                  </div>
                ) : (
                  <>
                    <button type="button" className="sb-vars-table-chevron" onClick={(e) => { e.stopPropagation(); setExpanded(prev => ({ ...prev, [table.key]: !prev[table.key] })); }}>
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                    <span className="sb-vars-table-icon" style={{ color: table.color }}><TableIcon size={11} /></span>
                    <span className="sb-vars-table-label" style={{ textAlign: 'left', flex: 1 }}>{table.label}</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleStart(table.key); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '0 2px', display: 'flex', flexShrink: 0, opacity: 0.6 }}>
                      <Search size={11} />
                    </button>
                    {tableRecords.length === 0 && <span className="sb-vars-no-data">No data</span>}
                  </>
                )}
              </div>

              {isExpanded && currentRecord && (
                <div className={`sb-vars-fields ${isSearching ? 'sb-vars-fields-tuning' : ''}`} style={{ position: 'relative' }}>
                  {editing && (
                    <div className="sb-vars-varbar" style={{ '--varbar-color': table.color }} />
                  )}
                  {table.fields.map((field) => {
                    const sampleValue = currentRecord[field.key];
                    const varRef = getVariableRef(table.key, field.key);
                    const hasValue = sampleValue !== null && sampleValue !== undefined;
                    const isMatched = matchedFields.has(field.key);
                    return (
                      <button key={field.key} type="button" className={`sb-vars-field ${isSearching ? 'sb-vars-field-tuning' : ''} ${isMatched ? 'sb-vars-field-matched' : ''}`} onClick={(e) => { e.stopPropagation(); onInsertVariable?.(varRef, field.label, table.color); }} title={hasValue ? formatValue(sampleValue, field.type) : 'No value'}>
                        <span className="sb-vars-field-name" style={{ color: table.color }}>{field.label}</span>
                        {hasValue && <span className="sb-vars-field-value">{formatValue(sampleValue, field.type)}</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {isExpanded && !currentRecord && (
                <div className="sb-vars-fields"><div className="sb-vars-empty">No records found</div></div>
              )}
            </div>
          );
        })}
        </> /* end activeSection === 'current' */
        )}

        {activeSection === 'previous' && (
          <>
            <SearchRecordsOutput
              currentNodeId={currentNodeId}
              nodes={nodes}
              edges={edges}
              onInsertVariable={onInsertVariable}
              onTableHover={onTableHover}
            />
            <PreviousNodeVars
              currentNodeId={currentNodeId}
              nodes={nodes}
              edges={edges}
              onInsertVariable={onInsertVariable}
              onTableHover={onTableHover}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default VariablesPane;

