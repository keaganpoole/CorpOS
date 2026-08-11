// ─── Field Contexts ───────────────────────────────────────────────────────
// Maps node types to contextually relevant fields for conditions and configs.

import { LEAD_FIELDS } from './leadSchema';

// Appointment fields for appointment-related nodes
export const APPOINTMENT_FIELDS = [
  { key: 'appointment_date', label: 'Appointment Date', type: 'timestamp' },
  { key: 'appointment_time', label: 'Appointment Time', type: 'text' },
  { key: 'appointment_duration', label: 'Duration (min)', type: 'number' },
  { key: 'appointment_status', label: 'Appointment Status', type: 'select', options: [
    { value: 'Pending' }, { value: 'Confirmed' }, { value: 'Cancelled' }, { value: 'Completed' }, { value: 'No Show' }, { value: 'missed' },
  ]},
  { key: 'customer_name', label: 'Customer Name', type: 'text' },
  { key: 'service_type', label: 'Service Type', type: 'text' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

// Call fields for phone call nodes
export const CALL_FIELDS = [
  { key: 'call_status', label: 'Call Status', type: 'select', options: [
    { value: 'Answered' }, { value: 'Missed' }, { value: 'Voicemail' }, { value: 'Transferred' }, { value: 'Dropped' },
  ]},
  { key: 'call_duration', label: 'Call Duration (sec)', type: 'number' },
  { key: 'caller_number', label: 'Caller Number', type: 'phone' },
  { key: 'call_outcome', label: 'Call Outcome', type: 'select', options: [
    { value: 'Booked' }, { value: 'Transferred' }, { value: 'Callback Needed' }, { value: 'Voicemail Left' }, { value: 'Resolved' }, { value: 'Unresolved' },
  ]},
  { key: 'voicemail_received', label: 'Voicemail Received', type: 'boolean' },
];

// Record fields — uses LEAD_FIELDS
export const RECORD_FIELDS = LEAD_FIELDS.filter(f => f.key !== 'created_at' && f.key !== 'updated_at');

// SMS fields
export const SMS_FIELDS = [
  { key: 'message_content', label: 'Message Content', type: 'textarea' },
  { key: 'sms_status', label: 'SMS Status', type: 'select', options: [
    { value: 'Sent' }, { value: 'Delivered' }, { value: 'Read' }, { value: 'Replied' }, { value: 'Failed' },
  ]},
  { key: 'recipient_number', label: 'Recipient Number', type: 'phone' },
];

// Time fields for time/schedule nodes
export const TIME_FIELDS = [
  { key: 'triggered_at', label: 'Triggered At', type: 'timestamp' },
  { key: 'run_date', label: 'Run Date', type: 'timestamp' },
  { key: 'run_day', label: 'Run Day', type: 'select', options: [
    { value: 'Monday' }, { value: 'Tuesday' }, { value: 'Wednesday' }, { value: 'Thursday' }, { value: 'Friday' }, { value: 'Saturday' }, { value: 'Sunday' },
  ]},
  { key: 'minutes_until', label: 'Minutes Until Appointment', type: 'number' },
];

// Combined default fields with section headers
export const DEFAULT_FIELDS = [
  { key: '__section_appointment', label: '── Appointment ──', type: '__section' },
  ...APPOINTMENT_FIELDS,
  { key: '__section_call', label: '── Call ──', type: '__section' },
  ...CALL_FIELDS,
  { key: '__section_record', label: '── Record ──', type: '__section' },
  ...RECORD_FIELDS.slice(0, 10), // Top 10 record fields
  { key: '__section_sms', label: '── SMS ──', type: '__section' },
  ...SMS_FIELDS,
  { key: '__section_time', label: '── Time ──', type: '__section' },
  ...TIME_FIELDS,
];

// Determine context type from a node
export const getContextType = (node) => {
  if (!node) return 'default';
  
  const key = node.subOptionKey || node.label?.toLowerCase()?.replace(/\s+/g, '_') || '';
  
  // Appointment nodes
  if (key.includes('appointment') || key.includes('create_appointment') || key.includes('search_appointments') || key.includes('update_appointment')) {
    return 'appointment';
  }
  
  // Call nodes
  if (key.includes('call') || key.includes('phone_call') || key.includes('incoming_call') || key.includes('call_answered') || key.includes('missed_call') || key.includes('call_failed') || key.includes('voicemail') || key.includes('call_customer') || key.includes('call_phone')) {
    return 'call';
  }
  
  // SMS/text nodes
  if (key.includes('sms') || key.includes('text') || key.includes('send_to') || key.includes('customer_replied')) {
    return 'sms';
  }
  
  // Record nodes
  if (key.includes('record') || key.includes('search_records') || key.includes('create_new_record') || key.includes('update_record')) {
    return 'record';
  }
  
  // Time/schedule nodes
  if (key.includes('time') || key.includes('schedule') || key.includes('daily') || key.includes('weekly') || key.includes('reminder')) {
    return 'time';
  }
  
  // Check by category key in AUTOMATION_HIERARCHY
  const catKey = node.categoryKey || '';
  if (catKey === 'appointments') return 'appointment';
  if (catKey === 'phone_calls') return 'call';
  if (catKey === 'text_messages' || catKey === 'text_messaging') return 'sms';
  if (catKey === 'records') return 'record';
  if (catKey === 'time_schedule') return 'time';
  
  return 'default';
};

// Get fields for a given context type
export const getFieldsForContext = (contextType) => {
  switch (contextType) {
    case 'appointment':
      return APPOINTMENT_FIELDS;
    case 'call':
      return CALL_FIELDS;
    case 'sms':
      return SMS_FIELDS;
    case 'record':
      return RECORD_FIELDS;
    case 'time':
      return TIME_FIELDS;
    default:
      return DEFAULT_FIELDS;
  }
};

// ─── Output Variables ─────────────────────────────────────────────────────
// Each node type declares what variables it produces for downstream nodes.

const OUTPUT_VARIABLE_MAP = {
  // Appointment actions
  create_appointment: [
    { key: 'new_appointment_id', label: 'New Appointment ID', type: 'text' },
    { key: 'appointment_date', label: 'Appointment Date', type: 'timestamp' },
    { key: 'appointment_time', label: 'Appointment Time', type: 'text' },
  ],
  search_appointments: [
    { key: 'found_appointment_id', label: 'Found Appointment ID', type: 'text' },
    { key: 'appointment_date', label: 'Appointment Date', type: 'timestamp' },
    { key: 'appointment_status', label: 'Appointment Status', type: 'text' },
  ],
  update_appointment: [
    { key: 'appointment_id', label: 'Appointment ID', type: 'text' },
    { key: 'appointment_date', label: 'Updated Date', type: 'timestamp' },
  ],
  // Record actions
  create_new_record: [
    { key: 'new_record_id', label: 'New Record ID', type: 'text' },
    { key: 'customer_name', label: 'Customer Name', type: 'text' },
    { key: 'customer_phone', label: 'Customer Phone', type: 'phone' },
  ],
  search_records: [
    { key: 'found_record_id', label: 'Found Record ID', type: 'text' },
    { key: 'customer_name', label: 'Customer Name', type: 'text' },
    { key: 'customer_phone', label: 'Customer Phone', type: 'phone' },
    { key: 'customer_email', label: 'Customer Email', type: 'email' },
  ],
  update_record: [
    { key: 'record_id', label: 'Record ID', type: 'text' },
  ],
  // Call actions
  call_customer: [
    { key: 'call_outcome', label: 'Call Outcome', type: 'text' },
    { key: 'call_duration', label: 'Call Duration', type: 'number' },
  ],
  call_phone_number: [
    { key: 'call_outcome', label: 'Call Outcome', type: 'text' },
    { key: 'call_duration', label: 'Call Duration', type: 'number' },
  ],
  
  // SMS actions
  send_to_phone_number: [
    { key: 'sms_status', label: 'SMS Status', type: 'text' },
    { key: 'sms_message_id', label: 'Message ID', type: 'text' },
  ],
  send_to_customer: [
    { key: 'sms_status', label: 'SMS Status', type: 'text' },
    { key: 'sms_message_id', label: 'Message ID', type: 'text' },
  ],
  
  // Email
  send_email: [
    { key: 'email_status', label: 'Email Status', type: 'text' },
    { key: 'email_message_id', label: 'Email Message ID', type: 'text' },
  ],
  
  // Triggers
  incoming_call: [
    { key: 'caller_number', label: 'Caller Number', type: 'phone' },
    { key: 'caller_name', label: 'Caller Name', type: 'text' },
  ],
  call_answered: [
    { key: 'caller_number', label: 'Caller Number', type: 'phone' },
    { key: 'call_duration', label: 'Call Duration', type: 'number' },
  ],
  missed_call: [
    { key: 'caller_number', label: 'Caller Number', type: 'phone' },
  ],
  voicemail_received: [
    { key: 'caller_number', label: 'Caller Number', type: 'phone' },
    { key: 'voicemail_duration', label: 'Voicemail Duration', type: 'number' },
  ],
  sms_received: [
    { key: 'sender_number', label: 'Sender Number', type: 'phone' },
    { key: 'message_content', label: 'Message Content', type: 'textarea' },
  ],
  customer_replied: [
    { key: 'sender_number', label: 'Sender Number', type: 'phone' },
    { key: 'message_content', label: 'Message Content', type: 'textarea' },
  ],
  appointment_created: [
    { key: 'appointment_id', label: 'Appointment ID', type: 'text' },
    { key: 'appointment_date', label: 'Appointment Date', type: 'timestamp' },
  ],
  appointment_updated: [
    { key: 'appointment_id', label: 'Appointment ID', type: 'text' },
  ],
  appointment_cancelled: [
    { key: 'appointment_id', label: 'Appointment ID', type: 'text' },
  ],
  appointment_confirmed: [
    { key: 'appointment_id', label: 'Appointment ID', type: 'text' },
  ],
  record_created: [
    { key: 'record_id', label: 'Record ID', type: 'text' },
    { key: 'customer_name', label: 'Customer Name', type: 'text' },
  ],
  record_updated: [
    { key: 'record_id', label: 'Record ID', type: 'text' },
  ],
  
  // Time/Schedule triggers
  specific_time: [
    { key: 'triggered_at', label: 'Triggered At', type: 'timestamp' },
  ],
  recurring_daily: [
    { key: 'triggered_at', label: 'Triggered At', type: 'timestamp' },
    { key: 'run_date', label: 'Run Date', type: 'timestamp' },
  ],
  recurring_weekly: [
    { key: 'triggered_at', label: 'Triggered At', type: 'timestamp' },
    { key: 'run_day', label: 'Run Day', type: 'text' },
  ],
  appointment_reminder: [
    { key: 'appointment_id', label: 'Appointment ID', type: 'text' },
    { key: 'appointment_date', label: 'Appointment Date', type: 'timestamp' },
    { key: 'customer_name', label: 'Customer Name', type: 'text' },
    { key: 'minutes_until', label: 'Minutes Until', type: 'number' },
  ],
  create_customer: [
    { key: 'customer_id', label: 'Stripe Customer ID', type: 'text' },
    { key: 'name', label: 'Customer Name', type: 'text' },
    { key: 'email', label: 'Customer Email', type: 'email' },
    { key: 'phone', label: 'Customer Phone', type: 'phone' },
    { key: 'metadata', label: 'Metadata', type: 'text' },
  ],
  update_customer: [
    { key: 'customer_id', label: 'Stripe Customer ID', type: 'text' },
    { key: 'name', label: 'Customer Name', type: 'text' },
    { key: 'email', label: 'Customer Email', type: 'email' },
    { key: 'phone', label: 'Customer Phone', type: 'phone' },
    { key: 'metadata', label: 'Metadata', type: 'text' },
  ],
  create_payment: [
    { key: 'id', label: 'Payment Intent ID', type: 'text' },
    { key: 'object', label: 'Object', type: 'text' },
    { key: 'amount', label: 'Amount', type: 'number' },
    { key: 'amount_received', label: 'Amount Received', type: 'number' },
    { key: 'currency', label: 'Currency', type: 'text' },
    { key: 'status', label: 'Status', type: 'text' },
    { key: 'client_secret', label: 'Client Secret', type: 'text' },
    { key: 'customer', label: 'Customer ID', type: 'text' },
    { key: 'payment_method', label: 'Payment Method ID', type: 'text' },
    { key: 'description', label: 'Description', type: 'text' },
    { key: 'created', label: 'Created', type: 'timestamp' },
    { key: 'receipt_email', label: 'Receipt Email', type: 'email' },
    { key: 'latest_charge', label: 'Latest Charge ID', type: 'text' },
    { key: 'metadata', label: 'Metadata', type: 'text' },
  ],
  send_payment_link: [
    { key: 'customer_id', label: 'Stripe Customer ID', type: 'text' },
    { key: 'payment_url', label: 'Payment URL', type: 'url' },
    { key: 'payment_id', label: 'Payment ID', type: 'text' },
    { key: 'amount', label: 'Amount', type: 'number' },
    { key: 'currency', label: 'Currency', type: 'text' },
    { key: 'status', label: 'Status', type: 'text' },
    { key: 'customer_name', label: 'Customer Name', type: 'text' },
    { key: 'customer_email', label: 'Customer Email', type: 'email' },
  ],
  create_invoice: [
    { key: 'invoice_id', label: 'Invoice ID', type: 'text' },
    { key: 'id', label: 'Invoice ID', type: 'text' },
    { key: 'status', label: 'Status', type: 'text' },
    { key: 'amount_due', label: 'Amount Due', type: 'currency' },
    { key: 'currency', label: 'Currency', type: 'text' },
    { key: 'customer_id', label: 'Customer ID', type: 'text' },
    { key: 'hosted_invoice_url', label: 'Hosted Invoice URL', type: 'url' },
    { key: 'invoice_pdf', label: 'Invoice PDF', type: 'url' },
    { key: 'due_date', label: 'Due Date', type: 'timestamp' },
    { key: 'metadata', label: 'Metadata', type: 'text' },
  ],
  send_invoice: [
    { key: 'invoice_id', label: 'Invoice ID', type: 'text' },
    { key: 'id', label: 'Invoice ID', type: 'text' },
    { key: 'status', label: 'Status', type: 'text' },
    { key: 'amount_due', label: 'Amount Due', type: 'currency' },
    { key: 'currency', label: 'Currency', type: 'text' },
    { key: 'customer_id', label: 'Customer ID', type: 'text' },
    { key: 'hosted_invoice_url', label: 'Hosted Invoice URL', type: 'url' },
    { key: 'invoice_pdf', label: 'Invoice PDF', type: 'url' },
    { key: 'metadata', label: 'Metadata', type: 'text' },
  ],
  refund_payment: [
    { key: 'refund_id', label: 'Refund ID', type: 'text' },
    { key: 'payment_id', label: 'Payment ID', type: 'text' },
    { key: 'status', label: 'Status', type: 'text' },
    { key: 'amount', label: 'Amount', type: 'currency' },
    { key: 'currency', label: 'Currency', type: 'text' },
  ],
  cancel_subscription: [
    { key: 'subscription_id', label: 'Subscription ID', type: 'text' },
    { key: 'customer_id', label: 'Customer ID', type: 'text' },
    { key: 'status', label: 'Status', type: 'text' },
    { key: 'canceled_at', label: 'Canceled At', type: 'timestamp' },
  ],
  payment_received: [
    { key: 'payment_id', label: 'Payment ID', type: 'text' },
    { key: 'customer_id', label: 'Customer ID', type: 'text' },
    { key: 'amount', label: 'Amount', type: 'currency' },
    { key: 'currency', label: 'Currency', type: 'text' },
    { key: 'status', label: 'Status', type: 'text' },
  ],
  payment_failed: [
    { key: 'payment_id', label: 'Payment ID', type: 'text' },
    { key: 'status', label: 'Status', type: 'text' },
    { key: 'error_message', label: 'Error Message', type: 'text' },
  ],
  refund_issued: [
    { key: 'refund_id', label: 'Refund ID', type: 'text' },
    { key: 'payment_id', label: 'Payment ID', type: 'text' },
    { key: 'amount', label: 'Amount', type: 'currency' },
    { key: 'status', label: 'Status', type: 'text' },
  ],
  subscription_created: [
    { key: 'subscription_id', label: 'Subscription ID', type: 'text' },
    { key: 'customer_id', label: 'Customer ID', type: 'text' },
    { key: 'status', label: 'Status', type: 'text' },
  ],
};

const STRIPE_RESPONSE_ACTION_KEYS = new Set([
  'create_customer',
  'update_customer',
  'create_payment',
  'send_payment_link',
  'create_invoice',
  'send_invoice',
  'refund_payment',
  'cancel_subscription',
]);

const humanizeVariableKey = (key) => String(key || '')
  .replace(/[_-]+/g, ' ')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b\w/g, (char) => char.toUpperCase());

const inferVariableType = (key, value) => {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') {
    if (/(created|updated|due)_?at?$|_at$|date$/i.test(String(key || ''))) return 'timestamp';
    return 'number';
  }
  if (Array.isArray(value) || (value && typeof value === 'object')) return 'text';

  const normalizedKey = String(key || '').toLowerCase();
  if (normalizedKey.includes('email')) return 'email';
  if (normalizedKey.includes('url') || normalizedKey.includes('pdf')) return 'url';
  if (normalizedKey.includes('phone')) return 'phone';
  if (normalizedKey === 'date' || normalizedKey.endsWith('_date')) return 'date';
  if (normalizedKey === 'created' || normalizedKey === 'due_date' || normalizedKey.endsWith('_at')) return 'timestamp';
  return 'text';
};

const buildStripeResponseVariables = (node, fallbackVars) => {
  const outputData = node?.outputData;
  if (!outputData || Array.isArray(outputData) || typeof outputData !== 'object') return fallbackVars;

  const fallbackByKey = new Map(fallbackVars.map((item) => [item.key, item]));
  return Object.keys(outputData)
    .filter((key) => key && key !== '__proto__')
    .map((key) => {
      const fallback = fallbackByKey.get(key);
      const value = outputData[key];
      return {
        key,
        label: fallback?.label || humanizeVariableKey(key),
        type: fallback?.type || inferVariableType(key, value),
      };
    });
};

const buildDynamicOutputVariables = (outputData, fallbackVars = []) => {
  if (outputData == null) return fallbackVars;

  const fallbackByKey = new Map(fallbackVars.map((item) => [item.key, item]));
  const dynamicVars = [];
  const visited = new Set();

  const walk = (value, path = []) => {
    const joinedPath = path.join('.');

    if (value == null) {
      if (joinedPath) {
        const fallback = fallbackByKey.get(joinedPath);
        dynamicVars.push({
          key: joinedPath,
          label: fallback?.label || humanizeVariableKey(joinedPath.replace(/\./g, ' ')),
          type: fallback?.type || 'text',
        });
      }
      return;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        if (joinedPath) {
          const fallback = fallbackByKey.get(joinedPath);
          dynamicVars.push({
            key: joinedPath,
            label: fallback?.label || humanizeVariableKey(joinedPath.replace(/\./g, ' ')),
            type: fallback?.type || 'text',
          });
        }
        return;
      }

      value.forEach((item, index) => walk(item, [...path, String(index)]));
      return;
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value).filter(([key]) => key && key !== '__proto__');
      if (entries.length === 0) {
        if (joinedPath) {
          const fallback = fallbackByKey.get(joinedPath);
          dynamicVars.push({
            key: joinedPath,
            label: fallback?.label || humanizeVariableKey(joinedPath.replace(/\./g, ' ')),
            type: fallback?.type || 'text',
          });
        }
        return;
      }

      entries.forEach(([key, child]) => walk(child, [...path, key]));
      return;
    }

    if (!joinedPath || visited.has(joinedPath)) return;
    visited.add(joinedPath);

    const fallback = fallbackByKey.get(joinedPath);
    dynamicVars.push({
      key: joinedPath,
      label: fallback?.label || humanizeVariableKey(joinedPath.replace(/\./g, ' ')),
      type: fallback?.type || inferVariableType(path[path.length - 1], value),
    });
  };

  walk(outputData);

  if (dynamicVars.length === 0) return fallbackVars;

  fallbackVars.forEach((item) => {
    if (item?.key && !visited.has(item.key)) {
      dynamicVars.push(item);
    }
  });

  return dynamicVars;
};

export const isStripeResponseNode = (node) => {
  const key = node?.actionConfig?._key || node?.subOptionKey || '';
  return STRIPE_RESPONSE_ACTION_KEYS.has(key);
};

// Get output variables for a node
export const getOutputVariables = (node) => {
  if (!node) return [];
  
  const key = node.subOptionKey || '';
  const vars = OUTPUT_VARIABLE_MAP[key] || [];
  if (isStripeResponseNode(node)) {
    return buildStripeResponseVariables(node, vars);
  }

  if (node?.outputData != null) {
    return buildDynamicOutputVariables(node.outputData, vars);
  }
  
  // Also check by label for generic types
  if (vars.length === 0 && node.label) {
    const labelKey = node.label.toLowerCase().replace(/\s+/g, '_');
    return OUTPUT_VARIABLE_MAP[labelKey] || [];
  }
  
  return vars;
};

// Build a map of available variables from all previous nodes in the flow
export const buildVariableMap = (nodes, edges, currentNodeId) => {
  const variables = [];
  
  // Find all nodes that come before currentNodeId in the flow
  const visited = new Set();
  const queue = [currentNodeId];
  const ancestorIds = new Set();
  
  // BFS backwards to find ancestors
  while (queue.length > 0) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    
    for (const edge of edges) {
      if (edge.to === id && !visited.has(edge.from)) {
        ancestorIds.add(edge.from);
        queue.push(edge.from);
      }
    }
  }
  
  // Collect output variables from ancestor nodes
  for (const node of nodes) {
    if (ancestorIds.has(node.id)) {
      const nodeVars = getOutputVariables(node);
      for (const v of nodeVars) {
        variables.push({
          ...v,
          nodeId: node.id,
          nodeLabel: node.label,
          reference: `{{${node.id}.${v.key}}}`,
          displayRef: `{{${node.label?.replace(/\s+/g, '_').toLowerCase()}_${v.key}}}`,
        });
      }
    }
  }
  
  return variables;
};
