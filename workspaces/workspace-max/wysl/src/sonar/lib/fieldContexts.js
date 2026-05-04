// ─── Field Contexts ───────────────────────────────────────────────────────
// Maps node types to contextually relevant fields for conditions and configs.

import { LEAD_FIELDS } from './leadSchema';

// Appointment fields for appointment-related nodes
export const APPOINTMENT_FIELDS = [
  { key: 'appointment_date', label: 'Appointment Date', type: 'timestamp' },
  { key: 'appointment_time', label: 'Appointment Time', type: 'text' },
  { key: 'appointment_duration', label: 'Duration (min)', type: 'number' },
  { key: 'appointment_status', label: 'Appointment Status', type: 'select', options: [
    { value: 'Pending' }, { value: 'Confirmed' }, { value: 'Cancelled' }, { value: 'Completed' }, { value: 'No Show' },
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
  if (key.includes('appointment') || key.includes('create_appointment') || key.includes('search_appointments') || key.includes('update_appointment') || key.includes('delete_appointment')) {
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
  if (key.includes('record') || key.includes('search_records') || key.includes('create_new_record') || key.includes('update_record') || key.includes('delete_record')) {
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
  delete_appointment: [
    { key: 'deleted_appointment_id', label: 'Deleted Appointment ID', type: 'text' },
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
  delete_record: [
    { key: 'deleted_record_id', label: 'Deleted Record ID', type: 'text' },
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
  update_payment: [
    { key: 'id', label: 'Payment Intent ID', type: 'text' },
    { key: 'status', label: 'Status', type: 'text' },
    { key: 'amount', label: 'Amount', type: 'number' },
  ],
  invoice_created: [
    { key: 'invoice_id', label: 'Invoice ID', type: 'text' },
    { key: 'amount', label: 'Amount', type: 'currency' },
  ],
  invoice_paid: [
    { key: 'invoice_id', label: 'Invoice ID', type: 'text' },
    { key: 'amount', label: 'Amount', type: 'currency' },
  ],
};

// Get output variables for a node
export const getOutputVariables = (node) => {
  if (!node) return [];
  
  const key = node.subOptionKey || '';
  const vars = OUTPUT_VARIABLE_MAP[key] || [];
  
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
