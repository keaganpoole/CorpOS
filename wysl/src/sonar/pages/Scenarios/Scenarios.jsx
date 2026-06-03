import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  Phone,
  User,
  Bell,
  Zap,
  Plus,
  ChevronRight,
  ChevronLeft,
  Search,
  X,
  MessageSquare,
  Calendar,
  Layers,
  DollarSign,
  Share2,
  Mail,
  Tag,
  Clock,
  Trash2,
  RefreshCw,
  Repeat,
  Target,
  Check,
  Eye,
  EyeOff,
  Pencil,
  GitBranch,
  Sparkles,
  Filter,
  Database,
  Hash,
  Code,
  ShieldCheck,
} from 'lucide-react';
import './Scenarios.css';
import AetherEdgeLogic from './AetherEdgeLogic';
import VariablesPane, { getFieldDisplayLabel, getVariableRef, parseVariables, renderVarChipsHTML, setPeopleCustomVariableFields, TABLE_COLORS, TABLE_LABELS } from './VariablesPane';
import { supabase } from '../../lib/supabase';
import { LEAD_FIELDS } from '../../lib/leadSchema';
import { fetchCustomFields, getCurrentBusinessId, isCustomFieldKey } from '../../lib/customFields';
import { getContextType, buildVariableMap, getOutputVariables } from '../../lib/fieldContexts';
import { getSmartActions, getSmartActionByKey } from './smartActions';
import googleIcon from '../../../assets/google.png';

const API_BASE_URL = window.sonar?.apiUrl || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL, window.location.origin).origin;
  } catch (error) {
    return window.location.origin;
  }
})();
const INTEGRATION_PROVIDERS = [
  {
    key: 'gmail',
    name: 'Gmail',
    subtitle: 'Google Workspace or Gmail',
    description: 'Use this inbox for scenario email.',
    icon: googleIcon,
    available: true,
  },
];
const DEFAULT_EMAIL_INTEGRATIONS = INTEGRATION_PROVIDERS.reduce((acc, provider) => {
  acc[provider.key] = {
    provider: provider.key,
    selected: false,
    status: 'not_connected',
    connectedEmail: '',
    scopes: [],
    providerMetadata: {},
    updatedAt: null,
  };
  return acc;
}, {});

const normalizeIntegrationState = (rows = []) => {
  const next = { ...DEFAULT_EMAIL_INTEGRATIONS };
  rows.forEach((row) => {
    const key = row?.provider;
    if (!key || !next[key]) return;
    next[key] = {
      ...next[key],
      ...row,
      connectedEmail: row.connected_email || row.connectedEmail || '',
      providerMetadata: row.provider_metadata || row.providerMetadata || {},
      scopes: row.scopes || [],
      updatedAt: row.updated_at || row.updatedAt || null,
    };
  });
  return next;
};

const TABLE_REF_ALIASES = {
  person: 'people',
  payment: 'payments',
  invoice: 'invoices',
  appointment: 'appointments',
  service: 'services',
  receptionist: 'hired_receptionists',
  business: 'businesses',
};

const TABLE_REF_REVERSE_ALIASES = Object.fromEntries(
  Object.entries(TABLE_REF_ALIASES).map(([alias, tableKey]) => [tableKey, alias])
);

const RECORD_ID_LABELS = {
  People: 'Person ID',
  Appointments: 'Appointment ID',
  Services: 'Service ID',
  Payments: 'Payment ID',
  Businesses: 'Business ID',
  'Hired Receptionists': 'Hired Receptionist ID',
};

const normalizeTableRefKey = (tableKey) => {
  if (!tableKey) return tableKey;
  return TABLE_REF_ALIASES[tableKey] || tableKey;
};

const getRecordIdLabelForTable = (tableName) => RECORD_ID_LABELS[tableName] || 'Record ID';

const getTableRefCandidates = (tableKey) => {
  const normalized = normalizeTableRefKey(tableKey);
  const reverseAlias = TABLE_REF_REVERSE_ALIASES[tableKey];
  return [...new Set([tableKey, normalized, reverseAlias].filter(Boolean))];
};

const RECEPTIONIST_REF_PREFIXES = new Set(['rec', 'agent', 'receptionist']);
const VARIABLE_TOKEN_REGEX = /\{\{[^}]+\}\}/;
const TABLE_ALIAS_TO_CANONICAL = {
  person: 'people',
  appointment: 'appointments',
  payment: 'payments',
  invoice: 'invoices',
  service: 'services',
  receptionist: 'hired_receptionists',
  business: 'businesses',
};

const normalizeScenarioTableKey = (tableKey) => TABLE_ALIAS_TO_CANONICAL[tableKey] || tableKey;

const getDescendantNodeIds = (startNodeId, edges) => {
  const descendants = [];
  const queue = [startNodeId];
  const visited = new Set([startNodeId]);
  while (queue.length > 0) {
    const current = queue.shift();
    edges.forEach((edge) => {
      if (edge.from !== current || !edge.to || visited.has(edge.to)) return;
      visited.add(edge.to);
      descendants.push(edge.to);
      queue.push(edge.to);
    });
  }
  return descendants;
};

const extractReceptionistRefsFromString = (value) => {
  if (!value || typeof value !== 'string') return [];
  const parsed = parseVariables(value).filter((item) => RECEPTIONIST_REF_PREFIXES.has(item.source));
  const plainMatches = [];
  const regex = /\b(rec|agent|receptionist)\.([a-z0-9_]+)\.([a-z0-9_.]+)\b/gi;
  let match;
  while ((match = regex.exec(value)) !== null) {
    plainMatches.push({
      source: match[1].toLowerCase(),
      table: normalizeScenarioTableKey(match[2].toLowerCase()),
      field: match[3],
    });
  }
  return [...parsed, ...plainMatches];
};

const iterateStringValues = (value, visitor) => {
  if (typeof value === 'string') {
    visitor(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => iterateStringValues(item, visitor));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => iterateStringValues(item, visitor));
  }
};

const inferReceptionistRequirements = (callNodeId, nodes, edges) => {
  if (!callNodeId) return [];
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const requirements = [];
  const seen = new Set();

  getDescendantNodeIds(callNodeId, edges).forEach((nodeId) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;
    iterateStringValues(node, (textValue) => {
      extractReceptionistRefsFromString(textValue).forEach((ref) => {
        const token = `${ref.table}.${ref.field}`;
        if (seen.has(token)) return;
        seen.add(token);
        requirements.push({
          table: ref.table,
          field: ref.field,
          path: token,
          label: getFieldDisplayLabel(ref.table, ref.field),
        });
      });
    });
  });

  return requirements;
};

const OPTION_ICONS = {
  phone_calls: Phone,
  text_messages: MessageSquare,
  appointments: Calendar,
  records: Layers,
  payments: DollarSign,
  text_messaging: MessageSquare,
  email: Mail,
  tags: Tag,
  wait: Clock,
  router: Share2,
  intent_router: RefreshCw,
  end_call: X,
  time_schedule: Clock,
};

// Table field definitions for Update Record
const RECORD_TABLE_FIELDS = {
  People: [
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'street_address', label: 'Street Address' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'zip_code', label: 'Zip Code' },
    { key: 'preferred_contact_method', label: 'Preferred Contact Method' },
    { key: 'source', label: 'Source' },
  ],
  Appointments: [
    { key: 'client_name', label: 'Client Name' },
    { key: 'date', label: 'Date' },
    { key: 'time', label: 'Time' },
    { key: 'status', label: 'Status' },
    { key: 'duration', label: 'Duration' },
    { key: 'assigned_receptionist', label: 'Assigned Receptionist' },
    { key: 'notes', label: 'Notes' },
    { key: 'person_id', label: 'Person ID' },
    { key: 'service_id', label: 'Service ID' },
    { key: 'business_id', label: 'Business ID' },
  ],
  Services: [
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'price_type', label: 'Price Type' },
    { key: 'price_min', label: 'Price Min' },
    { key: 'price_max', label: 'Price Max' },
    { key: 'unit', label: 'Unit' },
    { key: 'category', label: 'Category' },
    { key: 'is_active', label: 'Is Active' },
    { key: 'sort_order', label: 'Sort Order' },
  ],
  Payments: [
    { key: 'person_id', label: 'Person ID' },
    { key: 'appointment_id', label: 'Appointment ID' },
    { key: 'amount', label: 'Amount' },
    { key: 'currency', label: 'Currency' },
    { key: 'status', label: 'Status' },
    { key: 'payment_method', label: 'Payment Method' },
    { key: 'description', label: 'Description' },
    { key: 'stripe_payment_intent_id', label: 'Stripe Intent ID' },
  ],
  Businesses: [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'address', label: 'Address' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'zip', label: 'Zip' },
    { key: 'website', label: 'Website' },
    { key: 'about_us', label: 'About Us' },
    { key: 'policies', label: 'Policies' },
    { key: 'faq', label: 'FAQ' },
    { key: 'business_hours', label: 'Business Hours' },
  ],
  'Hired Receptionists': [
    { key: 'full_name', label: 'Full Name' },
    { key: 'first_name', label: 'First Name' },
    { key: 'stereotype', label: 'Role' },
    { key: 'phone_number', label: 'Phone' },
    { key: 'call_types', label: 'Call Types' },
    { key: 'status', label: 'Status' },
    { key: 'is_active', label: 'Is Active' },
    { key: 'language_model', label: 'Language Model' },
    { key: 'voice', label: 'Voice' },
  ],
};

const toRecordCustomField = (field) => ({
  key: field.key,
  label: field.label,
  type: field.type || 'text',
  custom: true,
});

const coerceCustomFieldValue = (value, type) => {
  if (value == null || value === '') return value;
  if (typeof value === 'string' && value.includes('{{')) return value;
  if (type === 'boolean') {
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['true', 'yes', '1', 'on'].includes(normalized)) return true;
    if (['false', 'no', '0', 'off'].includes(normalized)) return false;
    return value;
  }
  if (type === 'number') {
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? value : numberValue;
  }
  return value;
};

const AUTOMATION_HIERARCHY = {
  TRIGGERS: [
    {
      key: 'no_trigger',
      option: 'No Trigger',
      description: 'Use a schedule instead of an event',
      accent: '#32f0d9',
      icon: Clock,
      sub_options: [],
    },
    {
      key: 'phone_calls',
      option: 'Phone Calls',
      description: 'When something happens with a call',
      accent: '#32f0d9',
      icon: OPTION_ICONS.phone_calls,
      sub_options: [
        { key: 'incoming_call', name: 'Incoming Call', description: 'When a new call arrives' },
        { key: 'call_answered', name: 'Call Answered', description: 'When someone answers a call' },
        { key: 'missed_call', name: 'Missed Call', description: 'When a call goes unanswered' },
        { key: 'call_failed', name: 'Call Failed', description: 'When a call cannot connect' },
        { key: 'voicemail_received', name: 'Voicemail Received', description: 'When a caller leaves a voicemail' },
      ],
    },
    {
      key: 'text_messages',
      option: 'Text Messages',
      description: 'When something happens with SMS',
      accent: '#32f0d9',
      icon: OPTION_ICONS.text_messages,
      sub_options: [
        { key: 'sms_received', name: 'SMS Received', description: 'When a message is received' },
        { key: 'sms_sent', name: 'SMS Sent', description: 'When a message is sent' },
        { key: 'sms_failed', name: 'SMS Failed', description: 'When message delivery fails' },
        { key: 'customer_replied', name: 'Customer Replied', description: 'When a customer responds' },
      ],
    },
    {
      key: 'records',
      option: 'Records',
      description: 'When something happens to a record',
      accent: '#32f0d9',
      icon: OPTION_ICONS.records,
      sub_options: [
        { key: 'record_created', name: 'Record Created', description: 'When a new record is created' },
        { key: 'record_updated', name: 'Record Updated', description: 'When a record is updated' },
        { key: 'record_deleted', name: 'Record Deleted', description: 'When a record is deleted' },
      ],
    },
    {
      key: 'appointments',
      option: 'Appointments',
      description: 'When something happens with an appointment',
      accent: '#32f0d9',
      icon: OPTION_ICONS.appointments,
      sub_options: [
        { key: 'appointment_created', name: 'Appointment Created', description: 'Create a new appointment' },
        { key: 'appointment_updated', name: 'Appointment Updated', description: 'When appointment details change' },
        { key: 'appointment_cancelled', name: 'Appointment Cancelled', description: 'When an appointment is cancelled' },
        { key: 'appointment_rescheduled', name: 'Appointment Rescheduled', description: 'When an appointment time changes' },
        { key: 'appointment_confirmed', name: 'Appointment Confirmed', description: 'When an appointment gets confirmed' },
        { key: 'appointment_soon', name: 'Appointment Soon', description: 'When appointment time is near' },
        { key: 'appointment_completed', name: 'Appointment Completed', description: 'When an appointment completes' },
        { key: 'appointment_missed', name: 'Appointment Missed', description: "When a customer doesn't show" },
      ],
    },
    {
      key: 'payments',
      option: 'Payments',
      description: 'When something happens with a payment',
      accent: '#32f0d9',
      icon: OPTION_ICONS.payments,
      sub_options: [
        { key: 'invoice_created', name: 'Invoice Created', description: 'When a new invoice is created' },
        { key: 'invoice_paid', name: 'Invoice Paid', description: 'When an invoice is paid' },
        { key: 'payment_failed', name: 'Payment Failed', description: 'When a payment cannot process' },
        { key: 'payment_link_sent', name: 'Payment Link Sent', description: 'When a payment link is sent to the customer' },
        { key: 'invoice_sent', name: 'Invoice Sent', description: 'When a real invoice is sent to the customer' },
      ],
    },
    {
      key: 'time_schedule',
      option: 'Time & Schedule',
      description: 'When a scheduled time is reached',
      accent: '#32f0d9',
      icon: OPTION_ICONS.time_schedule,
      sub_options: [
        { key: 'specific_time', name: 'Specific Time', description: 'Run once at a specific date and time' },
        { key: 'recurring_daily', name: 'Recurring Daily', description: 'Run every day at a set time' },
        { key: 'recurring_weekly', name: 'Recurring Weekly', description: 'Run weekly on selected days' },
        { key: 'appointment_reminder', name: 'Appointment Reminder', description: 'Run before an upcoming appointment' },
      ],
    },
  ],
  ACTIONS: [
    {
      key: 'phone_calls',
      option: 'Phone Calls',
      description: 'Call or manage phone calls',
      accent: '#38bdf8',
      icon: OPTION_ICONS.phone_calls,
      sub_options: [
        { key: 'call_customer', name: 'Call Customer', description: 'Call an existing customer', configFields: [
          { key: 'person_id', label: 'Customer ID', type: 'person_id' },
          { key: 'main_content', label: 'Prompt', type: 'prompt_textarea', smartActions: true },
          { key: 'first_message', label: 'First Message', type: 'first_message_textarea', smartActions: true, toggleLabel: 'Override First Message' },
          { key: 'transfer_to', label: 'Transfer To (optional)', type: 'text' },
        ]},
      ],
    },
    {
      key: 'text_messaging',
      option: 'Text Messaging',
      description: 'Send or manage SMS messages',
      accent: '#38bdf8',
      icon: OPTION_ICONS.text_messaging,
      sub_options: [
        { key: 'send_to_phone_number', name: 'Send To Phone Number', description: 'Send SMS to any number', configFields: [
          { key: 'recipient', label: 'Recipient Number', type: 'text' },
          { key: 'main_content', label: 'Prompt', type: 'prompt_textarea', smartActions: true },
        ]},
        { key: 'send_to_customer', name: 'Send To Customer', description: 'Send SMS to an existing customer', configFields: [
          { key: 'person_id', label: 'Customer ID', type: 'person_id' },
          { key: 'main_content', label: 'Prompt', type: 'prompt_textarea', smartActions: true },
        ]},
      ],
    },
    {
      key: 'records',
      option: 'Records',
      description: 'Manage records in the database',
      accent: '#38bdf8',
      icon: OPTION_ICONS.records,
      sub_options: [
        { key: 'search_records', name: 'Search Records', description: 'Find records from a table', configFields: [
          { key: 'target_table', label: 'Table', type: 'select', options: ['People', 'Appointments', 'Services', 'Payments', 'Businesses', 'Hired Receptionists'] },
          { key: 'search_user_id', label: 'User ID', type: 'text' },
          { key: 'search_limit', label: 'Limit', type: 'number' },
        ]},
        { key: 'create_new_record', name: 'Create New Record', description: 'Create a new record', configFields: [
          { key: 'target_table', label: 'Table', type: 'select', options: ['People', 'Appointments', 'Services', 'Payments', 'Businesses', 'Hired Receptionists'] },
        ]},
        { key: 'update_record', name: 'Update Record', description: 'Modify an existing record', configFields: [
          { key: 'target_table', label: 'Table', type: 'select', options: ['People', 'Appointments', 'Services', 'Payments', 'Businesses', 'Hired Receptionists'] },
        ]},
        { key: 'delete_record', name: 'Delete Record', description: 'Permanently delete a record', configFields: [
          { key: 'target_table', label: 'Table', type: 'select', options: ['People', 'Appointments', 'Services', 'Payments', 'Businesses', 'Hired Receptionists'] },
        ]},
      ],
    },
    {
      key: 'appointments',
      option: 'Appointments',
      description: 'Create or manage appointments',
      accent: '#38bdf8',
      icon: OPTION_ICONS.appointments,
      sub_options: [
        { key: 'create_appointment', name: 'Create Appointment', description: 'Schedule a new appointment', configFields: [
          { key: 'person_id', label: 'Customer ID', type: 'person_id' },
          { key: 'service_id', label: 'Service ID', type: 'service_id' },
        ] },
        { key: 'update_appointment', name: 'Update Appointment', description: 'Change details of an appointment', configFields: [
          { key: 'appointment_id', label: 'Appointment ID', type: 'record_id' },
          { key: 'person_id', label: 'Customer ID', type: 'person_id' },
          { key: 'service_id', label: 'Service ID', type: 'service_id' },
          { key: 'status', label: 'Status', type: 'select', options: ['pending', 'confirmed', 'cancelled', 'completed', 'missed'] },
          { key: 'date', label: 'Date', type: 'date' },
          { key: 'time', label: 'Time', type: 'time' },
          { key: 'duration', label: 'Duration', type: 'text' },
          { key: 'notes', label: 'Notes', type: 'textarea' },
        ]},
        { key: 'delete_appointment', name: 'Delete Appointment', description: 'Cancel and remove an appointment', configFields: [
          { key: 'appointment_id', label: 'Appointment ID', type: 'text' },
        ]},
      ],
    },
    {
      key: 'payments',
      option: 'Payments',
      description: 'Process payments and manage billing',
      accent: '#38bdf8',
      icon: OPTION_ICONS.payments,
      sub_options: [
        { key: 'create_payment', name: 'Create Payment', description: 'Process a new payment', configFields: [
          { key: 'person_id', label: 'Customer ID', type: 'person_id' },
          { key: 'amount', label: 'Amount ($)', type: 'text' },
          { key: 'currency', label: 'Currency', type: 'select', options: ['usd', 'eur', 'gbp', 'cad', 'aud'] },
          { key: 'payment_method', label: 'Payment Method', type: 'select', options: ['card', 'ach', 'link'] },
          { key: 'description', label: 'Description', type: 'prompt_textarea', smartActions: true },
          { key: 'customer_name', label: 'Customer Name', type: 'text' },
          { key: 'customer_email', label: 'Customer Email', type: 'text' },
          { key: 'customer_phone', label: 'Customer Phone', type: 'text' },
        ]},
        { key: 'create_payment_profile', name: 'Create Payment Profile', description: 'Set up a Stripe customer and generate a payment link', configFields: [
          { key: 'person_id', label: 'Customer ID', type: 'person_id' },
          { key: 'amount', label: 'Amount ($)', type: 'text' },
          { key: 'currency', label: 'Currency', type: 'select', options: ['usd', 'eur', 'gbp', 'cad', 'aud'] },
          { key: 'description', label: 'Description', type: 'prompt_textarea', smartActions: true },
          { key: 'customer_name', label: 'Customer Name', type: 'text' },
          { key: 'customer_email', label: 'Customer Email', type: 'text' },
          { key: 'customer_phone', label: 'Customer Phone', type: 'text' },
        ]},
        { key: 'create_invoice', name: 'Create Invoice', description: 'Create a real Stripe invoice with line items', configFields: [
          { key: 'person_id', label: 'Customer ID', type: 'person_id' },
          { key: 'amount', label: 'Amount ($)', type: 'text' },
          { key: 'currency', label: 'Currency', type: 'select', options: ['usd', 'eur', 'gbp', 'cad', 'aud'] },
          { key: 'description', label: 'Description', type: 'prompt_textarea', smartActions: true },
          { key: 'customer_name', label: 'Customer Name', type: 'text' },
          { key: 'customer_email', label: 'Customer Email', type: 'text' },
          { key: 'customer_phone', label: 'Customer Phone', type: 'text' },
          { key: 'appointment_id', label: 'Appointment ID', type: 'text' },
          { key: 'service_id', label: 'Service ID', type: 'text' },
          { key: 'due_days', label: 'Days Until Due', type: 'text' },
        ]},
        { key: 'send_invoice', name: 'Send Invoice', description: 'Finalize and send an existing invoice', configFields: [
          { key: 'invoice_id', label: 'Invoice ID', type: 'text' },
        ]},
        { key: 'update_payment', name: 'Update Payment', description: 'Update an existing payment record', configFields: [
          { key: 'payment_id', label: 'Payment ID', type: 'text' },
          { key: 'status', label: 'Status', type: 'select', options: ['succeeded', 'failed', 'refunded', 'partial_refund', 'pending'] },
          { key: 'amount', label: 'Refund Amount ($)', type: 'text' },
          { key: 'description', label: 'Description', type: 'prompt_textarea', smartActions: true },
          { key: 'notes', label: 'Notes', type: 'prompt_textarea', smartActions: true },
        ]},
        { key: 'check_payment_status', name: 'Check Payment Status', description: 'Verify if a payment went through', configFields: [
          { key: 'search_by', label: 'Look Up By', type: 'select', options: ['Customer Name', 'Payment ID', 'Amount'] },
          { key: 'search_value', label: 'Search Value', type: 'text' },
        ]},
        { key: 'issue_refund', name: 'Issue Refund', description: 'Process a refund for a previous charge', configFields: [
          { key: 'payment_id', label: 'Payment ID', type: 'text' },
          { key: 'amount', label: 'Refund Amount ($)', type: 'text' },
          { key: 'refund_reason', label: 'Refund Reason', type: 'prompt_textarea', smartActions: true },
        ]},
      ],
    },
    {
      key: 'email',
      option: 'Email',
      description: 'Manage email',
      accent: '#38bdf8',
      icon: OPTION_ICONS.email,
      sub_options: [{ key: 'send_email', name: 'Send Email', description: 'Send an email', configFields: [
        { key: 'person_id', label: 'Customer ID', type: 'person_id' },
        { key: 'to', label: 'To', type: 'text' },
        { key: 'subject', label: 'Subject', type: 'text' },
        { key: 'body', label: 'Body', type: 'textarea' },
      ]}],
    },
  ],
  UTILITIES: [
    { key: 'wait', option: 'Wait', description: 'Pause the workflow temporarily', icon: OPTION_ICONS.wait, accent: '#f472b6' },
    { key: 'router', option: 'Router', description: 'Send flow to different paths', icon: OPTION_ICONS.router, accent: '#f472b6' },
    { key: 'intent_router', option: 'Intent Router', description: 'Re-evaluate the conversation and choose the correct path', icon: OPTION_ICONS.intent_router, accent: '#f472b6' },
    { key: 'end_call', option: 'End Call', description: 'Immediately end the current call', icon: OPTION_ICONS.end_call, accent: '#f472b6' },
  ],
};

const PANEL_CATEGORY_LABELS = {
  TRIGGERS: 'Triggers',
  ACTIONS: 'Actions',
  UTILITIES: 'Utilities',
};

const CATEGORY_META = {
  TRIGGERS: { detail: 'Trigger', type: 'trigger', icon: Bell, accent: '#32f0d9' },
  ACTIONS: { detail: 'Action', type: 'action', icon: Phone, accent: '#38bdf8' },
  UTILITIES: { detail: 'Utility', type: 'utility', icon: Zap, accent: '#f472b6' },
};

const PANEL_CATEGORIES = ['TRIGGERS', 'ACTIONS', 'UTILITIES'];

const INITIAL_NODE = { id: 'node-1', x: 200, y: 300, configured: false, label: 'Start Flow' };

const sbLabelStyle = { fontSize: 9, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 4, display: 'block' };
const sbInputStyle = { width: '100%', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: '#e4e4e7', outline: 'none', boxSizing: 'border-box' };
const sbModeToggleStyle = {
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(0,0,0,0.45)',
  color: '#71717a',
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  padding: '4px 8px',
  borderRadius: 999,
  cursor: 'pointer',
  transition: 'all 0.18s ease',
  lineHeight: 1,
  whiteSpace: 'nowrap',
};
const sbModeToggleActiveStyle = {
  color: '#e4e4e7',
  borderColor: 'rgba(255,255,255,0.12)',
  background: 'rgba(24,24,27,0.9)',
};

export default function ScenariosPage() {
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'builder'
  const { session } = useAuth();
  const userId = session?.user?.id || null;
  const [scenarios, setScenarios] = useState([]); // List of saved scenarios
  const [nodes, setNodes] = useState([INITIAL_NODE]);
  const [edges, setEdges] = useState([]);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [viewportReady, setViewportReady] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState('node-1');
  const [panelStyle, setPanelStyle] = useState({ top: 0, left: 0 });
  const panelDragRef = useRef({ dragging: false, startX: 0, startY: 0, startTop: 0, startLeft: 0 });
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [panelSearch, setPanelSearch] = useState('');
  const [panelStage, setPanelStage] = useState('options');
  const [activeOption, setActiveOption] = useState(null);
  const [panelCategory, setPanelCategory] = useState('TRIGGERS');
  const [panelIntent, setPanelIntent] = useState(false);
  const [initialPulse, setInitialPulse] = useState(true);
  const [initialFocusSet, setInitialFocusSet] = useState(false);
  const [initialNodeShifted, setInitialNodeShifted] = useState(false);
  const [logicPanel, setLogicPanel] = useState(null);
  const [logicPanelDragPos, setLogicPanelDragPos] = useState(null);
  const [logicContextType, setLogicContextType] = useState('default');
  const [logicAvailableVars, setLogicAvailableVars] = useState([]);
  const [logicFallbackAction, setLogicFallbackAction] = useState('');
  const [logicIsFallback, setLogicIsFallback] = useState(false);
  const [activeConditionField, setActiveConditionField] = useState(null); // { ruleId, field }
  const activeConditionInputRef = useRef(null); // tracks the focused input element
  const [appointmentConfig, setAppointmentConfig] = useState({});
  const [scheduleConfig, setScheduleConfig] = useState({});
  const [triggerFilter, setTriggerFilter] = useState({});
  const triggerFilterSourceNodeRef = useRef(null);
  const [varsPane, setVarsPane] = useState({ visible: false, fieldKey: '', fieldLabel: '', fieldType: 'text' });
  const [hoveredTableColor, setHoveredTableColor] = useState('');
  const [actionConfig, setActionConfig] = useState(null);
  const [peopleCustomFields, setPeopleCustomFields] = useState([]);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, nodeId }
  const [runNodeModal, setRunNodeModal] = useState(null);
  const [nodeRunStates, setNodeRunStates] = useState({});
  const runNodeTargetRef = useRef(null);
  const nodeRunTimersRef = useRef({});
  const [edgeRules, setEdgeRules] = useState([
    { id: 1, variable: '', operator: 'equals', value: '', logic: 'and' },
  ]);
  const edgeRulesRef = useRef(edgeRules);
  const restoringFromNodeRef = useRef(false);

  // Trigger quantum orbit rings on an unconfigured node
  const triggerQuantumOrbit = useCallback((nodeId) => {
    const rings = Array.from({ length: 8 }, (_, i) => ({
      id: Date.now() + i,
      size: 140 + i * 18,
      delay: i * 0.05,
    }));
    setQuantumOrbits(prev => ({ ...prev, [nodeId]: rings }));
    setTimeout(() => {
      setQuantumOrbits(prev => {
        const next = { ...prev };
        delete next[nodeId];
        return next;
      });
    }, 1500);
  }, []);
  
  // Save scenario modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioDescription, setScenarioDescription] = useState('');
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);
  
  // Track currently loaded scenario
  const [currentScenario, setCurrentScenario] = useState(null);
  
  // Bottom toolbar state
  const [noTriggerActive, setNoTriggerActive] = useState(false);
  const [scenarioIsActive, setScenarioIsActive] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [showIntegrationsModal, setShowIntegrationsModal] = useState(false);
  const [integrationStep, setIntegrationStep] = useState(0);
  const [recurringSchedule, setRecurringSchedule] = useState({ frequency: 'once', interval: 1, time: '09:00' });
  const [scenarioNotes, setScenarioNotes] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState('');
  const [emailIntegrations, setEmailIntegrations] = useState(DEFAULT_EMAIL_INTEGRATIONS);
  const [integrationLoading, setIntegrationLoading] = useState(false);
  const [integrationSaving, setIntegrationSaving] = useState(false);
  const [integrationPopupPending, setIntegrationPopupPending] = useState(false);
  const [integrationError, setIntegrationError] = useState('');
  const [selectedIntegrationProvider, setSelectedIntegrationProvider] = useState(INTEGRATION_PROVIDERS[0]?.key || 'gmail');
  
  // Fade-in animation state
  const [nodesOpacity, setNodesOpacity] = useState(1);
  const [quantumOrbits, setQuantumOrbits] = useState({}); // { [nodeId]: [ring configs] }

  // Fetch scenarios from Supabase on mount
  useEffect(() => {
    const fetchScenarios = async () => {
      try {
        const { data, error } = await supabase
          .from('scenarios')
          .select('*')
          .order('updated_at', { ascending: false });
        
        if (error) {
          // Handle case where table doesn't exist yet
          if (error.code === 'PGRST205') {
            console.log('[Scenarios] Table not found. Run SQL in Supabase to create scenarios table.');
            setScenarios([]);
          } else {
            console.error('[Scenarios] Error fetching scenarios:', error);
          }
          return;
        }
        
        if (data) {
          setScenarios(data);
          console.log('[Scenarios] Loaded', data.length, 'scenarios');
        }
      } catch (err) {
        console.error('[Scenarios] Exception fetching scenarios:', err);
      }
    };
    
    fetchScenarios();
  }, []);

  const refreshPeopleCustomFields = useCallback(async () => {
    try {
      const businessId = await getCurrentBusinessId();
      const fields = await fetchCustomFields(businessId);
      setPeopleCustomFields(fields);
      setPeopleCustomVariableFields(fields);
    } catch (error) {
      console.warn('[Scenarios] Could not load custom people fields:', error?.message || error);
      setPeopleCustomFields([]);
      setPeopleCustomVariableFields([]);
    }
  }, []);

  useEffect(() => {
    refreshPeopleCustomFields();
  }, [refreshPeopleCustomFields]);

  useEffect(() => {
    const handleFocus = () => refreshPeopleCustomFields();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshPeopleCustomFields]);

  useEffect(() => {
    if (varsPane.visible) refreshPeopleCustomFields();
  }, [varsPane.visible, refreshPeopleCustomFields]);

  const builderRef = useRef(null);
  const canvasRef = useRef(null);
  const nodeRefs = useRef({});
  const introCircleRef = useRef(null);
  const circleRefs = useRef({}); // per-node circle element refs

  const dragRef = useRef({ id: null, moved: false, startX: 0, startY: 0, nodeX: 0, nodeY: 0, scale: 1 });
  const panRef = useRef(null);
  const nodeIdCounter = useRef(1);
  const edgeIdCounter = useRef(1);
  
  // Keep ref in sync with state
  useEffect(() => {
    edgeRulesRef.current = edgeRules;
  }, [edgeRules]);

  // Auto-save edge rules to edges whenever rules change (while panel is open)
  useEffect(() => {
    if (!logicPanel || !logicPanel.edgeId) return;
    setEdges((prevEdges) =>
      prevEdges.map((edge) => {
        if (edge.id !== logicPanel.edgeId) return edge;
        const hasValidRules = edgeRules.some(rule => {
          if (!rule.variable || !rule.operator) return false;
          const noValueOperators = ['is_empty', 'is_not_empty'];
          if (noValueOperators.includes(rule.operator)) return true;
          return rule.value !== '' && rule.value !== null && rule.value !== undefined;
        });
        return { ...edge, filter: hasValidRules ? { label: 'Condition', rules: edgeRules } : null };
      })
    );
  }, [edgeRules, logicPanel]);

  // Auto-save config to node on every field change
  useEffect(() => {
    if (restoringFromNodeRef.current) { restoringFromNodeRef.current = false; return; }
    if (!selectedNodeId || !actionConfig) return;
    setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, actionConfig: { ...actionConfig } } : n));
  }, [actionConfig]);

  useEffect(() => {
    if (restoringFromNodeRef.current) { restoringFromNodeRef.current = false; return; }
    if (!selectedNodeId || !appointmentConfig?.key) return;
    setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, appointmentConfig: { ...appointmentConfig } } : n));
  }, [appointmentConfig]);

  useEffect(() => {
    if (restoringFromNodeRef.current) { restoringFromNodeRef.current = false; return; }
    if (!selectedNodeId || !scheduleConfig?.key) return;
    setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, scheduleConfig: { ...scheduleConfig } } : n));
  }, [scheduleConfig]);

  useEffect(() => {
    if (restoringFromNodeRef.current) { restoringFromNodeRef.current = false; return; }
    if (!selectedNodeId || !triggerFilter?.key) return;
    if (triggerFilterSourceNodeRef.current !== selectedNodeId) return;
    if (selectedNode?.subOptionKey !== 'appointment_soon' && selectedNode?.triggerFilter?.key !== 'appointment_soon') return;
    setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, triggerFilter: normalizeAppointmentSoonFilter(triggerFilter) } : n));
  }, [triggerFilter, selectedNodeId]);

  const nodeMap = useMemo(() => nodes.reduce((acc, node) => ({ ...acc, [node.id]: node }), {}), [nodes]);
  const selectedNode = selectedNodeId ? nodeMap[selectedNodeId] : null;

  const isPrimaryNode = selectedNodeId === INITIAL_NODE.id;

  useEffect(() => {
    if (!selectedNodeId) return;
    const defaultCategory = isPrimaryNode ? selectedNode?.categoryType || 'TRIGGERS' : 'ACTIONS';
    const node = nodeMap[selectedNodeId];
    const hasSavedConfig = node?.configured || node?.appointmentConfig?.key || node?.scheduleConfig?.key || node?.triggerFilter?.key;
    // If node has saved config, let openSelectionPanel restore it — preserve config stages
    if (hasSavedConfig) {
      setPanelStage(prev => {
        if (prev === 'runNode') {
          if (runNodeTargetRef.current === selectedNodeId) return prev;
          return node?.actionConfig?._key ? 'actionConfig' : 'options';
        }
        if (['actionConfig'].includes(prev)) {
          // Only preserve actionConfig if the new node actually has one
          if (node?.actionConfig?._key) return prev;
          return 'options';
        }
        if (['appointmentConfig', 'scheduleConfig'].includes(prev)) return prev;
        if (prev === 'triggerFilter') {
          if (node?.triggerFilter?.key === 'appointment_soon') return prev;
          return 'options';
        }
        return 'options';
      });
    } else {
      // New/unconfigured node — clear stale config from previous node
      setActionConfig(null);
      setAppointmentConfig({});
      setScheduleConfig({});
      setTriggerFilter({});
      triggerFilterSourceNodeRef.current = null;
      setPanelStage('options');
    }
    setActiveOption(null);
    setPanelSearch('');
    setPanelCategory(defaultCategory);
  }, [selectedNodeId, selectedNode?.categoryType, isPrimaryNode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialPulse(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const authorizedApiFetch = useCallback(async (path, options = {}) => {
    if (!session?.access_token) {
      throw new Error('You need to be logged in to manage integrations.');
    }
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${session.access_token}`);
    return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  }, [session?.access_token]);

  const refreshIntegrations = useCallback(async () => {
    if (!session?.access_token) {
      setEmailIntegrations(DEFAULT_EMAIL_INTEGRATIONS);
      return;
    }
    setIntegrationLoading(true);
    try {
      const response = await authorizedApiFetch('/users/me/integrations');
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.detail || 'Failed to load integrations.');
      }
      setEmailIntegrations(normalizeIntegrationState(result));
    } catch (error) {
      console.warn('[Scenarios] Failed to load integrations:', error?.message || error);
      setIntegrationError(error?.message || 'Failed to load integrations.');
    } finally {
      setIntegrationLoading(false);
    }
  }, [authorizedApiFetch, session?.access_token]);

  useEffect(() => {
    refreshIntegrations();
  }, [refreshIntegrations]);

  useEffect(() => {
    const handleMessage = async (event) => {
      if (event.origin !== window.location.origin && event.origin !== API_ORIGIN) return;
      if (event.data?.type !== 'sonar.integration.oauth_complete') return;
      setIntegrationPopupPending(false);
      if (event.data?.success) {
        setIntegrationError('');
        await refreshIntegrations();
        setIntegrationStep(1);
      } else {
        setIntegrationError(event.data?.message || 'Integration failed.');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refreshIntegrations]);

  useLayoutEffect(() => {
    if (initialFocusSet) return;
    setView({ x: 0, y: 0, scale: 1 });
    setInitialFocusSet(true);
    setViewportReady(true);
  }, [initialFocusSet]);

  // Fire orbit rings once as intro — rings FIRST, then circle fades in
  useEffect(() => {
    if (nodes.length === 1 && !nodes[0].configured) {
      const timer = setTimeout(() => triggerQuantumOrbit(nodes[0].id), 200);
      return () => clearTimeout(timer);
    }
  }, [nodes.length]);

  const formatScheduleDisplay = (config) => {
    const { frequency, interval, time, daysOfWeek } = config;
    const timeStr = time ? ` at ${time}` : '';
    switch (frequency) {
      case 'once': return 'Run once';
      case 'hourly': return `Every ${interval}h`;
      case 'daily': return `Every ${interval}d${timeStr}`;
      case 'weekly': {
        const days = daysOfWeek?.length ? ` (${daysOfWeek.join(', ')})` : '';
        return `Every ${interval}w${days}${timeStr}`;
      }
      case 'monthly': return `Every ${interval}mo${timeStr}`;
      default: return 'Run once';
    }
  };

  const handleToggleRecurring = async () => {
    const newActive = !scenarioIsActive;
    setScenarioIsActive(newActive);
    // Persist to Supabase if editing existing scenario
    if (currentScenario?.id) {
      await supabase.from('scenarios').update({ is_active: newActive }).eq('id', currentScenario.id);
    }
  };

  const optionsForCategory = AUTOMATION_HIERARCHY[panelCategory] || [];
  const normalizedPanelSearch = panelSearch.trim().toLowerCase();
  const filteredOptions = useMemo(
    () =>
      optionsForCategory.filter((option) => {
        const optionLabel = option.option.toLowerCase();
        return !normalizedPanelSearch || optionLabel.includes(normalizedPanelSearch);
      }),
    [normalizedPanelSearch, optionsForCategory]
  );
  const filteredSubOptions = useMemo(
    () =>
      (activeOption?.sub_options ?? []).filter((sub) => {
        const subLabel = sub.name.toLowerCase();
        return !normalizedPanelSearch || subLabel.includes(normalizedPanelSearch);
      }),
    [activeOption, normalizedPanelSearch]
  );
  const categoryMeta = CATEGORY_META[panelCategory] || CATEGORY_META.TRIGGERS;
  const hasConfiguredTrigger = nodes.some(n => n.categoryType === 'TRIGGERS' && n.configured);
  const visibleCategories = !hasConfiguredTrigger
    ? ['TRIGGERS']
    : isPrimaryNode
      ? PANEL_CATEGORIES
      : PANEL_CATEGORIES.filter((category) => category !== 'TRIGGERS');
  const BannerIcon = activeOption?.icon || categoryMeta.icon;
  const bannerCategoryLabel = (PANEL_CATEGORY_LABELS[panelCategory] || panelCategory).toUpperCase();
  const showNodeConfigText = !['subOptions', 'actionConfig', 'appointmentConfig', 'scheduleConfig', 'triggerFilter', 'runNode'].includes(panelStage);
  const appointmentDateInputMode = appointmentConfig.date_input_mode || 'picker';
  const appointmentTimeInputMode = appointmentConfig.time_input_mode || 'picker';
  const scheduleDateInputMode = scheduleConfig.date_input_mode || 'picker';
  const scheduleTimeInputMode = scheduleConfig.time_input_mode || 'picker';
  const selectedProviderConfig = INTEGRATION_PROVIDERS.find((provider) => provider.key === selectedIntegrationProvider) || INTEGRATION_PROVIDERS[0];
  const selectedIntegration = emailIntegrations[selectedIntegrationProvider] || DEFAULT_EMAIL_INTEGRATIONS[selectedIntegrationProvider] || DEFAULT_EMAIL_INTEGRATIONS.gmail;
  const gmailIntegration = emailIntegrations.gmail || DEFAULT_EMAIL_INTEGRATIONS.gmail;
  const hasConnectedEmailIntegration = Object.values(emailIntegrations).some((integration) => integration?.status === 'connected');
  const gmailStatusLabel = gmailIntegration.status === 'connected'
    ? 'Gmail connected'
    : gmailIntegration.selected
      ? 'Gmail selected'
      : 'No email connected';
  const integrationSteps = [
    {
      id: 'provider',
      eyebrow: 'Step 1',
      title: 'Pick your email provider',
      helper: 'Choose which inbox scenarios should use.',
    },
    {
      id: 'connect',
      eyebrow: 'Step 2',
      title: 'Connect your provider',
      helper: '',
    },
  ];
  const integrationMeta = integrationSteps[integrationStep] || integrationSteps[0];

  useEffect(() => {
    if (selectedIntegration?.status !== 'connected') return;
    setIntegrationPopupPending(false);
    setIntegrationError('');
    if (showIntegrationsModal) {
      setIntegrationStep(1);
    }
  }, [selectedIntegration?.status, showIntegrationsModal]);

  useEffect(() => {
    if (!integrationPopupPending || selectedIntegration?.status === 'connected') return;

    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      if (cancelled) return;
      try {
        await refreshIntegrations();
      } catch (error) {
        console.warn('[Scenarios] Integration poll failed:', error?.message || error);
      }
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [integrationPopupPending, refreshIntegrations, selectedIntegration?.status]);

  // Handle variable insertion — inserts {{table.field}} syntax for rendering
  const handleInsertVariable = (varRef, fieldLabel, color) => {
    if (!varsPane.fieldKey) return;
    const applyInsert = (setter) => {
      setter(prev => {
        const base = prev || {};
        const current = base[varsPane.fieldKey] || '';
        const newVal = current ? `${current} ${varRef}` : varRef;
        return { ...base, [varsPane.fieldKey]: newVal };
      });
    };

    if (panelStage === 'appointmentConfig') {
      applyInsert(setAppointmentConfig);
      return;
    }

    if (panelStage === 'scheduleConfig') {
      applyInsert(setScheduleConfig);
      return;
    }

    applyInsert(setActionConfig);
  };

  // Find the trigger key from parent node for smart actions
  const findParentTriggerKey = useCallback((nodeId) => {
    const parentEdge = edges.find(e => e.to === nodeId);
    if (!parentEdge) return null;
    const parentNode = nodeMap[parentEdge.from];
    if (!parentNode || parentNode.categoryType !== 'TRIGGERS') return null;
    const allTriggers = AUTOMATION_HIERARCHY.TRIGGERS.flatMap(t => t.sub_options || []);
    const trigger = allTriggers.find(t => t.name === parentNode.label);
    return trigger?.key || null;
  }, [edges, nodeMap]);

  // Get the action key from the current action config
  const currentActionKey = actionConfig?._key || null;
  const inferredReceptionistRequirements = useMemo(() => {
    if (currentActionKey !== 'call_customer') return [];
    return inferReceptionistRequirements(selectedNodeId, nodes, edges);
  }, [currentActionKey, selectedNodeId, nodes, edges]);

  // Handle smart action insertion — inserts delimited token into raw value,
  // overlay renders the display text as a styled chip
  const handleInsertSmartAction = (smartAction, fieldKey) => {
    const token = `{smart:${smartAction.key}}`;
    setActionConfig(prev => {
      const base = prev || {};
      const current = base[fieldKey] || '';
      const newVal = current ? `${current} \x1E${smartAction.instruction}\x1E` : `\x1E${smartAction.instruction}\x1E`;
      return { ...base, [fieldKey]: newVal };
    });
  };


  // Convert smart action display text back to tokens before saving
  // Uses sequential parsing to handle adjacent delimited strings correctly
  const syncFieldTokens = (fieldKey) => {
    setActionConfig(prev => {
      const val = prev[fieldKey];
      if (!val || typeof val !== 'string') return prev;
      const triggerKey = findParentTriggerKey(selectedNodeId);
      const actions = getSmartActions(triggerKey, currentActionKey);
      const lookup = {};
      actions.forEach(a => { lookup[a.instruction] = a.key; });

      let result = '';
      let i = 0;
      while (i < val.length) {
        if (val.charCodeAt(i) === 0x1E) {
          const end = val.indexOf('\x1E', i + 1);
          if (end !== -1) {
            const displayText = val.substring(i + 1, end);
            result += lookup[displayText] ? `{smart:${lookup[displayText]}}` : displayText;
            i = end + 1;
          } else { result += val[i]; i++; }
        } else { result += val[i]; i++; }
      }
      return { ...prev, [fieldKey]: result };
    });
  };

  // Simple HTML escape for chip display text
  const escapeHTML = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  // Render chips for prompt_textarea fields — sequential parsing for correct handling
  const renderFieldChipsHTML = (value) => {
    if (!value || typeof value !== 'string') return '';
    const triggerKey = findParentTriggerKey(selectedNodeId);
    const actions = getSmartActions(triggerKey, currentActionKey);
    const tokenLookup = {};
    actions.forEach(a => { tokenLookup[`{smart:${a.key}}`] = a.instruction; });

    let result = '';
    let i = 0;
    while (i < value.length) {
      if (value.charCodeAt(i) === 0x1E) {
        const end = value.indexOf('\x1E', i + 1);
        if (end !== -1) {
          result += escapeHTML(value.substring(i + 1, end));
          i = end + 1;
        } else { result += escapeHTML(value[i]); i++; }
      } else if (value.substring(i, i + 7) === '{smart:') {
        const end = value.indexOf('}', i);
        if (end !== -1) {
          const token = value.substring(i, end + 1);
          const instruction = tokenLookup[token];
          result += instruction
            ? escapeHTML(instruction)
            : escapeHTML(token);
          i = end + 1;
        } else { result += escapeHTML(value[i]); i++; }
      } else if (value.substring(i, i + 2) === '{{') {
        const end = value.indexOf('}}', i);
        if (end !== -1) {
          const ref = value.substring(i + 2, end);
          const parts = ref.split('.');
          if (parts.length === 2) {
            const color = TABLE_COLORS[parts[0]] || '#a78bfa';
            const tableLabel = TABLE_LABELS[parts[0]] || parts[0];
            result += `<span class="sb-var-chip" style="background:${color}18;color:${color};border:1px solid ${color}25;display:inline;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600;line-height:1.6;vertical-align:baseline;">${tableLabel}.${parts[1]}</span>`;
          } else { result += escapeHTML(value.substring(i, end + 2)); }
          i = end + 2;
        } else { result += escapeHTML(value[i]); i++; }
      } else {
        // Handle newlines as <br> for the overlay
        if (value[i] === '\n') { result += '<br>'; }
        else { result += escapeHTML(value[i]); }
        i++;
      }
    }
    return result;
  };

  const repositionPanel = useCallback(() => {
    if (!selectedNodeId) {
      setIsPanelVisible(false);
      setPanelIntent(false);
      return;
    }
    const nodeEl = nodeRefs.current[selectedNodeId];
    const pageRect = builderRef.current?.getBoundingClientRect();
    if (!nodeEl || !pageRect) {
      setIsPanelVisible(false);
      setPanelIntent(false);
      return;
    }
    const rect = nodeEl.getBoundingClientRect();
    const panelWidth = 400;
    const panelHeight = 640;
    
    let left = rect.right - pageRect.left - rect.width * 0.13;
    if (left + panelWidth > pageRect.width) {
      left = rect.left - pageRect.left - panelWidth - 40;
    }
    
    const top = Math.max(
      20,
      Math.min(pageRect.height - panelHeight - 20, rect.top - pageRect.top + rect.height / 2 - panelHeight / 2)
    );
    setPanelStyle({ top, left });
    if (panelIntent) {
      setIsPanelVisible(true);
    } else {
      setIsPanelVisible(false);
    }
  }, [selectedNodeId, panelIntent]);

  useLayoutEffect(() => {
    repositionPanel();
  }, [selectedNodeId, nodes, view.x, view.y, repositionPanel]);

  // Measure each node's actual circle center in canvas coordinates (no state mutation)
  const circleCenterRef = useRef({});
  useLayoutEffect(() => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    nodes.forEach(node => {
      const circleEl = circleRefs.current[node.id];
      if (!circleEl) return;
      const rect = circleEl.getBoundingClientRect();
      circleCenterRef.current[node.id] = {
        cx: (rect.left + rect.width / 2 - canvasRect.left - view.x) / view.scale,
        cy: (rect.top + rect.height / 2 - canvasRect.top - view.y) / view.scale,
        r: (rect.height / 2) / view.scale,
      };
    });
  }, [nodes, nodesOpacity, view.x, view.y, view.scale]);

  const openSelectionPanel = useCallback(
    (nodeId) => {
      setPanelIntent(true);
      // If this is the initial node and it's still unconfigured (in CSS overlay),
      // use the intro circle element's center for positioning — not the full wrapper
      // which includes arrow + CTA text
      if (nodeId === INITIAL_NODE.id && !nodeMap[nodeId]?.configured) {
        let circleCenterX, circleCenterY;
        if (introCircleRef.current) {
          const circleRect = introCircleRef.current.getBoundingClientRect();
          circleCenterX = circleRect.left + circleRect.width / 2;
          circleCenterY = circleRect.top + circleRect.height / 2;
        } else {
          const builderRect = builderRef.current?.getBoundingClientRect();
          circleCenterX = builderRect ? builderRect.left + builderRect.width / 2 : window.innerWidth / 2;
          circleCenterY = builderRect ? builderRect.top + builderRect.height / 2 : window.innerHeight / 2;
        }
        // Convert circle center to canvas coordinates (undo viewport transform)
        const canvasX = (circleCenterX - view.x) / view.scale;
        const canvasY = (circleCenterY - view.y) / view.scale;
        setNodes((prev) =>
          prev.map((node) =>
            node.id === INITIAL_NODE.id ? { ...node, x: canvasX, y: canvasY } : node
          )
        );
        setInitialNodeShifted(true);
      }
      setSelectedNodeId(nodeId);
      setLogicPanel(null);
      
      // If this node has a schedule config, show the schedule config form
      const node = nodeMap[nodeId];
      if (node?.scheduleConfig) {
        restoringFromNodeRef.current = true;
        setScheduleConfig({ ...node.scheduleConfig });
        setPanelStage('scheduleConfig');
      }
      // If this node has an appointment config, show the config form
      else if (node?.appointmentConfig) {
        restoringFromNodeRef.current = true;
        setAppointmentConfig({ ...node.appointmentConfig });
        setPanelStage('appointmentConfig');
      }
      // If this node has an appointment soon filter, show the trigger filter form
      else if (node?.triggerFilter?.key === 'appointment_soon') {
        restoringFromNodeRef.current = true;
        triggerFilterSourceNodeRef.current = nodeId;
        setTriggerFilter(normalizeAppointmentSoonFilter(node.triggerFilter));
        setPanelStage('triggerFilter');
      }
      // If this node has an action config, show the action config form
      else if (node?.configured && node?.actionConfig?._key) {
        restoringFromNodeRef.current = true;
        setActionConfig({ ...node.actionConfig });
        setPanelStage('actionConfig');
      }
    },
    [initialNodeShifted, nodeMap, view.x, view.y]
  );

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (panelDragRef.current.dragging) {
        const dx = event.clientX - panelDragRef.current.startX;
        const dy = event.clientY - panelDragRef.current.startY;
        setPanelStyle({
          top: panelDragRef.current.startTop + dy,
          left: panelDragRef.current.startLeft + dx,
        });
        return;
      }

      if (dragRef.current.id) {
        event.preventDefault();
        const node = nodeMap[dragRef.current.id];
        if (!node) return;
        const dx = (event.clientX - dragRef.current.startX) / dragRef.current.scale;
        const dy = (event.clientY - dragRef.current.startY) / dragRef.current.scale;
        setNodes((prev) =>
          prev.map((n) =>
            n.id === dragRef.current.id
              ? { ...n, x: dragRef.current.nodeX + dx, y: dragRef.current.nodeY + dy }
              : n
          )
        );
        if (Math.abs(event.clientX - dragRef.current.startX) > 3 || Math.abs(event.clientY - dragRef.current.startY) > 3) {
          dragRef.current.moved = true;
        }
        return;
      }

      if (!panRef.current) return;
      const dx = event.clientX - panRef.current.startX;
      const dy = event.clientY - panRef.current.startY;
      setView((prev) => ({
        ...prev,
        x: panRef.current.originX + dx,
        y: panRef.current.originY + dy,
      }));
    };

    const handlePointerUp = () => {
      if (panelDragRef.current.dragging) {
        panelDragRef.current.dragging = false;
        document.body.style.userSelect = '';
        return;
      }
      if (dragRef.current.id) {
        if (!dragRef.current.moved) {
          openSelectionPanel(dragRef.current.id);
        }
        dragRef.current = { id: null, moved: false, startX: 0, startY: 0, nodeX: 0, nodeY: 0, scale: 1 };
      }
      panRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [nodeMap, openSelectionPanel, view.x, view.y, view.scale, triggerQuantumOrbit]);

  const handleNodePointerDown = (nodeId, event) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    const node = nodeMap[nodeId];
    if (!node) return;
    dragRef.current = {
      id: nodeId,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      nodeX: node.x,
      nodeY: node.y,
      scale: view.scale,
    };
  };

  const handleCanvasPointerDown = (event) => {
    if (event.button !== 0) return;
    if (event.target.closest('.sb-builder-node')) return;
    event.preventDefault();
    panRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y,
    };
  };

  const handleWheel = (event) => {
    event.preventDefault();
    const rate = -event.deltaY / 500;
    setView((prev) => {
      const scale = Math.min(1.4, Math.max(0.6, prev.scale + rate));
      return { ...prev, scale };
    });
  };

  const canAddChild = (node) => {
    if (!node.configured) return false;
    if (node.type === 'router') return true;
    return !edges.some((edge) => edge.from === node.id);
  };

  const handleAddNode = (nodeId) => {
    const parent = nodeMap[nodeId];
    if (!parent) return;
    if (!canAddChild(parent)) return;
    const nextId = `node-${nodeIdCounter.current + 1}`;
    nodeIdCounter.current += 1;
    const siblingCount = edges.filter((edge) => edge.from === nodeId).length;
    const yOffset = siblingCount * 120 - (parent.type === 'router' ? 60 : 0);
    // Configured nodes have the sphere at the top of the node div (above label + connector).
    // The node div center (parent.y) is below the sphere center by ~54px.
    // Offset so the child's node div center aligns with the parent's sphere center.
    // Use the parent node's measured circle center Y (from useLayoutEffect)
    // instead of node.div.center (parent.y) which doesn't match the sphere center
    const measured = circleCenterRef.current[nodeId];
    const parentCircleY = measured ? measured.cy : parent.y;
    const newNode = {
      id: nextId,
      x: parent.x + 280,
      y: parentCircleY + yOffset,
      configured: false,
      label: 'New Step',
    };
    const nextEdgeId = `edge-${edgeIdCounter.current + 1}`;
    edgeIdCounter.current += 1;
    setNodes((prev) => [...prev, newNode]);
    setEdges((prev) => [...prev, { id: nextEdgeId, from: nodeId, to: nextId, filter: null }]);
    setSelectedNodeId(nextId);
    setLogicPanel(null);
  };

  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((prev) => prev.filter((node) => node.id !== selectedNodeId));
    setEdges((prev) =>
      prev.filter((edge) => edge.from !== selectedNodeId && edge.to !== selectedNodeId)
    );
    setSelectedNodeId(null);
    setIsPanelVisible(false);
    setPanelIntent(false);
    setPanelStage('options');
    setActiveOption(null);
    setActionConfig(null);
    setAppointmentConfig({});
    setScheduleConfig({});
    setTriggerFilter({});
    triggerFilterSourceNodeRef.current = null;
    setEdgeRules([{ id: 1, variable: '', operator: 'equals', value: '', logic: 'and' }]);
  }, [selectedNodeId]);

  const addEdgeRule = useCallback((logicType = 'and') => {
    setEdgeRules((prev) => [
      ...prev,
      { id: Date.now(), variable: '', operator: 'equals', value: '', logic: logicType },
    ]);
  }, []);

  const removeEdgeRule = useCallback((ruleId) => {
    setEdgeRules((prev) => prev.filter((rule) => rule.id !== ruleId));
  }, []);

  const updateEdgeRule = useCallback((ruleId, field, value) => {
    setEdgeRules((prev) =>
      prev.map((rule) => (rule.id === ruleId ? { ...rule, [field]: value } : rule))
    );
  }, []);

  const saveLogicPanel = useCallback(() => {
    const currentEdgeRules = edgeRulesRef.current;
    setEdges((prevEdges) => {
      if (logicPanel && logicPanel.edgeId) {
        // Handle fallback edge save
        if (logicIsFallback) {
          return prevEdges.map((edge) =>
            edge.id === logicPanel.edgeId
              ? { ...edge, filter: { type: 'fallback', fallbackAction: logicFallbackAction, label: 'Fallback' } }
              : edge
          );
        }
        
        // Check if rule has variable and operator, and value is required (not empty string for operators that need values)
        const hasValidRules = currentEdgeRules.some(rule => {
          if (!rule.variable || !rule.operator) return false;
          // Operators that don't require a value
          const noValueOperators = ['is_empty', 'is_not_empty'];
          if (noValueOperators.includes(rule.operator)) return true;
          // Other operators require a value
          return rule.value !== '' && rule.value !== null && rule.value !== undefined;
        });
        return prevEdges.map((edge) =>
          edge.id === logicPanel.edgeId
            ? { ...edge, filter: hasValidRules ? { label: 'Condition', rules: currentEdgeRules } : null }
            : edge
        );
      }
      return prevEdges;
    });
    setLogicPanel(null);
    setLogicIsFallback(false);
    setLogicFallbackAction('');
  }, [logicPanel, logicIsFallback, logicFallbackAction]);

  const closeLogicPanel = useCallback(() => {
    setLogicPanel(null);
  }, []);

  // Snap the intro node from overlay center to matching canvas position
  const snapIntroNodePosition = useCallback(() => {
    if (!introCircleRef.current) return;
    const circleRect = introCircleRef.current.getBoundingClientRect();
    const cx = circleRect.left + circleRect.width / 2;
    const cy = circleRect.top + circleRect.height / 2;
    const canvasX = (cx - view.x) / view.scale;
    const canvasY = (cy - view.y) / view.scale;
    setNodes(prev => prev.map(n =>
      n.id === INITIAL_NODE.id ? { ...n, x: canvasX, y: canvasY } : n
    ));
  }, [view.x, view.y, view.scale]);

  const finalizeSelection = (label, detail, icon, categoryType, accentColor) => {
    if (!selectedNodeId) return;
    const meta = CATEGORY_META[categoryType] || CATEGORY_META.TRIGGERS;
    const nodeType =
      categoryType === 'UTILITIES'
        ? label.toLowerCase() === 'router'
          ? 'router'
          : label.toLowerCase() === 'end call'
            ? 'end_call'
          : 'utility'
        : meta.type;
    // Snap intro node to overlay center before configuring
    if (selectedNodeId === INITIAL_NODE.id) {
      snapIntroNodePosition();
    }
    setNodes((prev) =>
      prev.map((node) =>
        node.id === selectedNodeId
          ? {
              ...node,
              configured: true,
              label,
              detail: detail || meta.detail,
              icon: icon || meta.icon,
              type: nodeType,
              category: meta.detail,
              accent: accentColor || meta.accent,
              categoryType,
            }
          : node
      )
    );
    setSelectedNodeId(null);
    setIsPanelVisible(false);
    setPanelIntent(false);
    // Show toolbar for "No Trigger" option
    if (label === 'No Trigger') {
      setNoTriggerActive(true);
    }
  };

  const handleOptionClick = (option) => {
    const optionIcon = option.icon || categoryMeta.icon;
    const optionAccent = option.accent || categoryMeta.accent;
    if (option.sub_options?.length) {
      setActiveOption({ ...option, accent: optionAccent });
      setPanelStage('subOptions');
      return;
    }
    finalizeSelection(option.option, option.description, optionIcon, panelCategory, optionAccent);
  };

  const APPOINTMENT_CONFIG_ACTIONS = new Set([
    'create_appointment', 'update_appointment', 'delete_appointment',
  ]);
  const TIME_CONFIG_ACTIONS = new Set([
    'specific_time', 'recurring_daily', 'recurring_weekly', 'appointment_reminder',
  ]);
  const TRIGGER_FILTER_ACTIONS = new Set([
    'appointment_soon',
  ]);

  const normalizeAppointmentSoonFilter = (value = {}) => {
    const hours = Math.max(0, Number(value.hours) || 0);
    const minutes = Math.max(0, Number(value.minutes) || 0);
    return {
      key: 'appointment_soon',
      hours,
      minutes,
      offsetMinutes: hours * 60 + minutes,
    };
  };

  const handleSubOptionClick = (subOption) => {
    const subIcon = activeOption?.icon || categoryMeta.icon;
    const subAccent = activeOption?.accent || categoryMeta.accent;
    const meta = CATEGORY_META[panelCategory] || CATEGORY_META.TRIGGERS;
    const currentNodeId = selectedNodeId; // Capture before finalizeSelection clears it
    const currentNode = nodeMap[currentNodeId];

    if (TRIGGER_FILTER_ACTIONS.has(subOption.key)) {
      const triggerFilterConfig = normalizeAppointmentSoonFilter(
        currentNode?.triggerFilter?.key === 'appointment_soon'
          ? currentNode.triggerFilter
          : { key: subOption.key, hours: 0, minutes: 0 }
      );
      setNodes((prev) =>
        prev.map((node) =>
          node.id === currentNodeId
            ? {
                ...node,
                configured: true,
                label: subOption.name,
                detail: subOption.description,
                icon: subIcon,
                type: meta.type,
                category: meta.detail,
                accent: subAccent,
                categoryType: panelCategory,
                subOptionKey: subOption.key,
                categoryKey: activeOption?.key || '',
                triggerFilter: triggerFilterConfig,
              }
            : node
        )
      );
      restoringFromNodeRef.current = true;
      triggerFilterSourceNodeRef.current = currentNodeId;
      setActiveOption(null);
      setPanelSearch('');
      setTriggerFilter(triggerFilterConfig);
      setPanelStage('triggerFilter');
      return;
    }
    
    // Check if this action needs config BEFORE finalizing
    const needsAppointmentConfig = APPOINTMENT_CONFIG_ACTIONS.has(subOption.key);
    const needsActionConfig = subOption.configFields && subOption.configFields.length > 0;
    
    if (needsAppointmentConfig || needsActionConfig) {
      // Snap intro node to overlay center before configuring
      if (currentNodeId === INITIAL_NODE.id) {
        snapIntroNodePosition();
      }
      // Configure the node but DON'T close the panel yet
      const nodeType = 'action';
      setNodes((prev) =>
        prev.map((node) =>
          node.id === currentNodeId
            ? {
                ...node,
                configured: true,
                label: subOption.name,
                detail: subOption.description,
                icon: subIcon,
                type: nodeType,
                category: meta.detail,
                accent: subAccent,
                categoryType: panelCategory,
                subOptionKey: subOption.key,
                categoryKey: activeOption?.key || '',
              }
            : node
        )
      );
      
      if (needsAppointmentConfig) {
        const initApptConfig = {
          key: subOption.key,
          client_name: '',
          date: '',
          time: '',
          duration: '30',
          date_input_mode: 'picker',
          time_input_mode: 'picker',
          status: 'pending',
          assigned_receptionist: '',
          notes: '',
        };
        restoringFromNodeRef.current = true;
        setAppointmentConfig(initApptConfig);
        setNodes(prev => prev.map(n => n.id === currentNodeId ? { ...n, appointmentConfig: initApptConfig } : n));
        setPanelStage('appointmentConfig');
      } else if (TIME_CONFIG_ACTIONS.has(subOption.key)) {
        const initSchedConfig = {
          key: subOption.key,
          date: '',
          time: '09:00',
          days_of_week: [],
          reminder_minutes: 30,
          timezone: 'America/New_York',
        };
        restoringFromNodeRef.current = true;
        setScheduleConfig(initSchedConfig);
        setNodes(prev => prev.map(n => n.id === currentNodeId ? { ...n, scheduleConfig: initSchedConfig } : n));
        setPanelStage('scheduleConfig');
      } else {
        const initialConfig = { _key: subOption.key, _fields: subOption.configFields };
        subOption.configFields.forEach(f => { initialConfig[f.key] = ''; });
        restoringFromNodeRef.current = true;
        setActionConfig(initialConfig);
        setNodes(prev => prev.map(n => n.id === currentNodeId ? { ...n, actionConfig: initialConfig } : n));
        setPanelStage('actionConfig');
      }
      // Keep panel open — don't call finalizeSelection
      return;
    }
    
    // No config needed — finalize normally (closes panel)
    finalizeSelection(subOption.name, subOption.description, subIcon, panelCategory, subAccent);
    
    // Store subOptionKey and categoryKey on node
    setNodes((prev) =>
      prev.map((node) =>
        node.id === currentNodeId
          ? { ...node, subOptionKey: subOption.key, categoryKey: activeOption?.key || '' }
          : node
      )
    );
  };

  const handleBackToOptions = () => {
    setPanelStage('options');
    setActiveOption(null);
  };

  const handleEdgeLogicClick = (edge, event) => {
    event.stopPropagation();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    const from = nodeMap[edge.from];
    const to = nodeMap[edge.to];
    if (!from || !to) return;
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const top = canvasRect.top + 32;
    const left = canvasRect.left + view.x + midX * view.scale;
    
    // Determine context type from source node
    const ctxType = getContextType(from);
    setLogicContextType(ctxType);
    
    // Build available variables from previous nodes
    const vars = buildVariableMap(nodes, edges, edge.from);
    setLogicAvailableVars(vars);
    
    // Check if this is a fallback edge
    const isFallbackEdge = edge.filter?.type === 'fallback';
    setLogicIsFallback(isFallbackEdge);
    setLogicFallbackAction(edge.filter?.fallbackAction || '');
    
    // Load existing filter rules into edgeRules state
    const newRules = edge.filter && edge.filter.rules 
      ? edge.filter.rules.map(r => ({ ...r, logic: r.logic || 'and' }))
      : [{ id: Date.now(), variable: '', operator: 'equals', value: '', logic: 'and' }];
    
    // Update the ref immediately
    edgeRulesRef.current = newRules;
    setEdgeRules(newRules);
    
    setLogicPanel({ edgeId: edge.id, top, left });
    setLogicPanelDragPos(null);
  };

  const handlePagePointerDown = (event) => {
    if (
      event.target.closest('.sb-selection-panel') ||
      event.target.closest('.aether-logic-wrapper') ||
      event.target.closest('.sb-node-add') ||
      event.target.closest('.sb-variables-pane') ||
      event.target.closest('.sb-vars-field')
    )
      return;
    if (!event.target.closest('.sb-builder-node')) {
      setSelectedNodeId(null);
      setIsPanelVisible(false);
      setPanelIntent(false);
    }
    setLogicPanel(null);
    setVarsPane(prev => ({ ...prev, visible: false }));
  };

  const handleCreateScenario = () => {
    // Reset builder state to initial state
    setEdges([]);
    setView({ x: 0, y: 0, scale: 1 });
    setSelectedNodeId('node-1');
    setEdgeRules([{ id: 1, variable: '', operator: 'equals', value: '', logic: 'and' }]);
    setLogicPanel(null);
    setIsPanelVisible(false);
    setPanelIntent(false);
    setPanelStage('options');
    setActiveOption(null);
    setInitialFocusSet(false);
    setViewportReady(false);
    
    // Clear current scenario
    setCurrentScenario(null);
    
    // Clear current scenario ID
    window.selectedScenarioForDelete = null;
    
    // Switch to builder view
    setViewMode('builder');
    setNodes([INITIAL_NODE]);
    setNodesOpacity(1);
    
    // Reset toolbar state
    setNoTriggerActive(false);
    setScenarioIsActive(true);
    setRecurringSchedule({ frequency: 'once', interval: 1, time: '09:00' });
    setScenarioNotes('');
    setTriggerFilter({});
  };

  const handleBackToList = () => {
    setViewMode('list');
  };

  const openIntegrationsModal = () => {
    setSelectedIntegrationProvider(gmailIntegration.connectedEmail ? 'gmail' : selectedIntegrationProvider);
    setIntegrationStep(gmailIntegration.selected || gmailIntegration.status === 'connected' ? 1 : 0);
    setIntegrationError('');
    setShowIntegrationsModal(true);
  };

  const selectIntegrationProvider = async (providerKey) => {
    setSelectedIntegrationProvider(providerKey);
    setIntegrationError('');
    setIntegrationSaving(true);
    try {
      const response = await authorizedApiFetch(`/users/me/integrations/${providerKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected: true, status: 'selected' }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.detail || 'Failed to save provider.');
      }
      setEmailIntegrations((prev) => normalizeIntegrationState([
        ...Object.values(prev).map((entry) => ({
          provider: entry.provider,
          selected: entry.selected,
          status: entry.status,
          connected_email: entry.connectedEmail,
          scopes: entry.scopes,
          provider_metadata: entry.providerMetadata,
          updated_at: entry.updatedAt,
        })).filter((entry) => entry.provider !== providerKey),
        result,
      ]));
      setIntegrationStep(1);
    } catch (error) {
      setIntegrationError(error?.message || 'Failed to save provider.');
    } finally {
      setIntegrationSaving(false);
    }
  };

  const connectSelectedProvider = async () => {
    if (!selectedProviderConfig?.key) return;
    setIntegrationPopupPending(true);
    setIntegrationError('');
    try {
      const response = await authorizedApiFetch(
        `/users/me/integrations/${selectedProviderConfig.key}/authorize?return_to=${encodeURIComponent(window.location.href)}`,
      );
      const result = await response.json();
      if (!response.ok || !result?.authorization_url) {
        throw new Error(result?.detail || 'Failed to start integration.');
      }
      const popup = window.open(result.authorization_url, 'sonar-integration-auth', 'width=540,height=720');
      if (!popup) {
        setIntegrationPopupPending(false);
        throw new Error('Popup blocked. Allow popups and try again.');
      }
    } catch (error) {
      setIntegrationPopupPending(false);
      setIntegrationError(error?.message || 'Failed to start integration.');
    }
  };

  const disconnectSelectedProvider = async () => {
    if (!selectedProviderConfig?.key) return;
    setIntegrationSaving(true);
    setIntegrationError('');
    try {
      const response = await authorizedApiFetch(`/users/me/integrations/${selectedProviderConfig.key}/disconnect`, {
        method: 'POST',
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.detail || 'Failed to disconnect integration.');
      }
      await refreshIntegrations();
      setIntegrationStep(0);
    } catch (error) {
      setIntegrationError(error?.message || 'Failed to disconnect integration.');
    } finally {
      setIntegrationSaving(false);
      setIntegrationPopupPending(false);
    }
  };

  const handleLoadScenario = (scenario) => {
    try {
      // Parse nodes and edges from JSON
      const nodesData = typeof scenario.nodes_data === 'string' 
        ? JSON.parse(scenario.nodes_data) 
        : scenario.nodes_data;
      const edgesData = typeof scenario.edges_data === 'string' 
        ? JSON.parse(scenario.edges_data) 
        : scenario.edges_data;
      
      // Set nodes and edges from scenario data
      setNodes(nodesData || [INITIAL_NODE]);
      setEdges(edgesData || []);

      // Reconstruct _fields for each node's actionConfig from AUTOMATION_HIERARCHY
      if (nodesData) {
        nodesData.forEach(node => {
          if (node.actionConfig?._key && !node.actionConfig?._fields?.length) {
            const key = node.actionConfig._key;
            // Search all categories and sub_options for matching config fields
            for (const category of Object.values(AUTOMATION_HIERARCHY)) {
              if (!Array.isArray(category)) continue;
              for (const item of category) {
                const match = (item.sub_options || []).find(so => so.key === key);
                if (match?.configFields) {
                  node.actionConfig._fields = match.configFields;
                  return;
                }
              }
            }
          }
        });
      }
      
      // Calculate center position for nodes
      if (nodesData && nodesData.length > 0) {
        // Calculate bounding box
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        nodesData.forEach(node => {
          minX = Math.min(minX, node.x);
          maxX = Math.max(maxX, node.x);
          minY = Math.min(minY, node.y);
          maxY = Math.max(maxY, node.y);
        });
        
        // Calculate center offset
        const nodesWidth = maxX - minX + 220; // Include node width
        const nodesHeight = maxY - minY + 80; // Include node height
        const centerX = nodesWidth / 2;
        const centerY = nodesHeight / 2;
        
        // Center the view on the nodes (adjusted for live pulse panel)
        const viewX = -centerX + window.innerWidth / 2;
        const viewY = -centerY + window.innerHeight / 2;
        
        setView({ x: viewX, y: viewY, scale: 1 });
      } else {
        setView({ x: 0, y: 0, scale: 1 });
      }
      
      setSelectedNodeId(nodesData?.[0]?.id || 'node-1');
      setLogicPanel(null);
      setIsPanelVisible(false);
      setPanelIntent(false);
      
      // Track current scenario for save logic
      setCurrentScenario(scenario);
      setScenarioName(scenario.name || '');
      
      // Load toolbar state
      if (scenario.schedule_config) {
        setRecurringSchedule(scenario.schedule_config);
      }
      setScenarioNotes(scenario.notes || '');
      setScenarioIsActive(scenario.is_active !== false); // default true
      // Show toolbar only if trigger node is "No Trigger"
      const hasNoTrigger = nodesData?.some(n => n.label === 'No Trigger');
      setNoTriggerActive(hasNoTrigger);
      
      // Switch to builder view
      setViewMode('builder');
      
      // Trigger fade-in animation
      setNodesOpacity(0);
      setTimeout(() => {
        setNodesOpacity(1);
      }, 50);
      
      console.log('[Scenarios] Loaded scenario:', scenario.name);
    } catch (err) {
      console.error('[Scenarios] Error loading scenario:', err);
    }
  };

  const handleSaveScenario = () => {
    // If editing existing scenario, save directly without modal
    if (currentScenario) {
      handleConfirmSaveScenario();
      return;
    }
    
    // If creating new scenario, show modal
    setScenarioName(`Scenario ${scenarios.length + 1}`);
    setScenarioDescription('');
    setShowSaveModal(true);
  };

  const handleConfirmSaveScenario = async () => {
    const normalizedScenarioName = scenarioName?.trim()
      ? scenarioName.trim().charAt(0).toUpperCase() + scenarioName.trim().slice(1)
      : '';
    const resolvedScenarioName = currentScenario
      ? (normalizedScenarioName || currentScenario.name)
      : (normalizedScenarioName || `Scenario ${scenarios.length + 1}`);
    const resolvedDescription = scenarioDescription
      ? scenarioDescription.charAt(0).toUpperCase() + scenarioDescription.slice(1)
      : '';
    const activeCustomFieldKeys = new Set(peopleCustomFields.map((field) => field.key));
    const sanitizeActionConfig = (config) => {
      if (!config) return null;
      return Object.fromEntries(Object.entries(config).filter(([key]) => {
        if (key === '_fields') return false;
        if (key.startsWith('field_custom_')) {
          return activeCustomFieldKeys.has(key.replace(/^field_/, ''));
        }
        return true;
      }));
    };
    const scenarioData = {
      user_id: userId,
      created_by: currentScenario?.created_by || userId,
      name: resolvedScenarioName,
      description: resolvedDescription,
      nodes_data: nodes.map(n => ({
        id: n.id,
        x: n.x,
        y: n.y,
        type: n.type,
        label: n.label,
        detail: n.detail,
        configured: n.configured,
        accent: n.accent,
        icon: n.icon?.name,
        appointmentConfig: n.appointmentConfig || null,
        scheduleConfig: n.scheduleConfig || null,
        triggerFilter: n.triggerFilter || null,
        actionConfig: sanitizeActionConfig(n.actionConfig),
        subOptionKey: n.subOptionKey || null,
        categoryKey: n.categoryKey || null,
        categoryType: n.categoryType || null,
      })),
      edges_data: edges.map(e => ({
        id: e.id,
        from: e.from,
        to: e.to,
        filter: e.filter
      })),
      status: 'active',
      is_active: scenarioIsActive,
      schedule_config: recurringSchedule,
      notes: scenarioNotes,
    };
    
    let result;
    
    if (currentScenario) {
      // Update existing scenario
      const { data, error } = await supabase
        .from('scenarios')
        .update(scenarioData)
        .eq('id', currentScenario.id)
        .select()
        .single();
      
      result = { data, error };
    } else {
      // Insert new scenario
      const { data, error } = await supabase
        .from('scenarios')
        .insert(scenarioData)
        .select();
      
      result = { data: data?.[0], error };
    }
    
    const { data, error } = result;
    
    if (error) {
      console.error('[Scenarios] Error saving scenario:', error);
      setShowSaveModal(false);
      return;
    }
    
    console.log('[Scenarios] Scenario saved:', data);
    
    // Refresh the scenarios list
    const { data: updatedScenarios } = await supabase
      .from('scenarios')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (updatedScenarios) {
      setScenarios(updatedScenarios);
    }

    try {
      await fetch(`${API_BASE_URL}/api/scenarios/reload`, { method: 'POST' });
    } catch (reloadError) {
      console.warn('[Scenarios] Scenario saved, but backend reload failed:', reloadError?.message || reloadError);
    }
    
    // Close modal and switch back to list view
    setShowSaveModal(false);
    setScenarioName('');
    setScenarioDescription('');
    setCurrentScenario(null);
    setViewMode('list');
  };

  const handleCancelSaveScenario = () => {
    setShowSaveModal(false);
    setScenarioName('');
    setScenarioDescription('');
  };

  // ─── Resolve Variable References (reads from resultsMap for live data) ──
  const peopleCustomFieldMap = useMemo(
    () => new globalThis.Map(peopleCustomFields.map((field) => [field.key, field])),
    [peopleCustomFields]
  );

  const getRecordFieldsForTable = useCallback((tableName) => {
    const baseFields = RECORD_TABLE_FIELDS[tableName] || [];
    if (tableName !== 'People' || peopleCustomFields.length === 0) return baseFields;

    const baseKeys = new Set(baseFields.map((field) => field.key));
    const customFields = peopleCustomFields
      .filter((field) => !baseKeys.has(field.key))
      .map(toRecordCustomField);

    return [...baseFields, ...customFields];
  }, [peopleCustomFields]);

  const readRuntimePath = (source, path) => {
    let current = source;

    for (const key of path) {
      if (current == null) return undefined;
      if (Array.isArray(current)) {
        if (key === 'records') continue;
        const index = Number(key);
        if (Number.isInteger(index)) {
          current = current[index];
          continue;
        }
        current = current[0];
        if (current == null) return undefined;
      }
      if (isCustomFieldKey(key) && current.custom_fields && Object.prototype.hasOwnProperty.call(current.custom_fields, key)) {
        current = current.custom_fields[key];
      } else {
        current = current[key];
      }
    }

    return current;
  };

  const resolveVariableRefs = (value, resultsMap) => {
    if (typeof value !== 'string' || !value.includes('{{')) return value;
    return value.replace(/\{\{([^}]+)\}\}/g, (match, ref) => {
      const parts = ref.split('.');
      if (parts.length < 2) { console.log(`[Resolve] ❌ Bad format: ${ref}`); return match; }
      const isSourcePrefixed = parts[0] === 'rec' || parts[0] === 'agent' || parts[0] === 'receptionist';
      const nodeId = isSourcePrefixed ? parts[1] : parts[0];
      const fieldPath = isSourcePrefixed ? parts.slice(2) : parts.slice(1);
      if (fieldPath.length === 0) { console.log(`[Resolve] ❌ Bad format: ${ref}`); return match; }
      const lookupKeys = isSourcePrefixed ? getTableRefCandidates(nodeId) : [nodeId];
      let outputData = null;
      for (const key of lookupKeys) {
        if (resultsMap[key] != null) {
          outputData = resultsMap[key];
          break;
        }
      }
      if (!outputData) { console.log(`[Resolve] ❌ No outputData for ${nodeId}`); return match; }
      const current = readRuntimePath(outputData, fieldPath);
      if (current == null) { console.log(`[Resolve] ❌ Final value is null for ${ref}`); return match; }
      console.log(`[Resolve] ✅ ${ref} → ${String(current).slice(0, 80)}`);
      return String(current);
    });
  };

  const resolveTableVariableRefs = (value, resultsMap) => {
    if (typeof value !== 'string' || !value.includes('{{')) return value;
    return value.replace(/\{\{([^}]+)\}\}/g, (match, ref) => {
      const parts = ref.split('.');
      if (parts.length < 2) return match;
      const isSourcePrefixed = parts[0] === 'rec' || parts[0] === 'agent' || parts[0] === 'receptionist';
      const tableKey = isSourcePrefixed ? parts[1] : parts[0];
      const fieldPath = isSourcePrefixed ? parts.slice(2) : parts.slice(1);
      if (fieldPath.length === 0) return match;
      const tableCandidates = getTableRefCandidates(tableKey);

      for (const candidate of tableCandidates) {
        const outputData = resultsMap[candidate];
        if (!outputData) continue;

        const current = readRuntimePath(outputData, fieldPath);

        if (current != null) {
          return String(current);
        }
      }

      return match;
    });
  };

  const hasUnresolvedVariableToken = (value) => (
    typeof value === 'string' && VARIABLE_TOKEN_REGEX.test(value)
  );

  const resolveRunFieldValue = (configValue, resultsMap, manualValueProvided, manualValue) => {
    if (manualValueProvided) return manualValue;
    return resolveVariableRefs(resolveTableVariableRefs(configValue, resultsMap), resultsMap);
  };

  const getUnresolvedRunFields = (node, resultsMap) => {
    const config = node?.actionConfig;
    const fields = Array.isArray(config?._fields) ? config._fields : [];

    return fields
      .filter((field) => hasUnresolvedVariableToken(config?.[field.key]))
      .filter((field) => {
        const resolvedValue = resolveRunFieldValue(config[field.key], resultsMap, false, undefined);
        return hasUnresolvedVariableToken(resolvedValue);
      });
  };

  const buildFlowResultsMap = (targetNodeId) => {
    if (!targetNodeId || !nodes?.length) return {};

    const visited = new Set(['node-1']);
    const queue = ['node-1'];
    const topoOrder = ['node-1'];

    while (queue.length > 0) {
      const current = queue.shift();
      for (const edge of edges) {
        if (edge.from === current && !visited.has(edge.to)) {
          visited.add(edge.to);
          queue.push(edge.to);
          topoOrder.push(edge.to);
        }
      }
    }

    const currentIdx = topoOrder.indexOf(targetNodeId);
    const priorIds = currentIdx > 0 ? topoOrder.slice(0, currentIdx) : [];
    const resultsMap = {};

    for (const nodeId of priorIds) {
      const node = nodeMap[nodeId];
      if (!node || node.outputData == null) continue;

      resultsMap[nodeId] = node.outputData;

      const actionKey = node.actionConfig?._key;
      const tableKey = normalizeTableRefKey((node.actionConfig?.target_table || '').toLowerCase().replace(/\s+/g, '_'));

      if (actionKey === 'search_records' || actionKey === 'update_record' || actionKey === 'create_new_record') {
        if (tableKey) {
          resultsMap[tableKey] = node.outputData;
          const alias = TABLE_REF_REVERSE_ALIASES[tableKey];
          if (alias) resultsMap[alias] = node.outputData;
        }
      }

      if (actionKey === 'create_payment' || actionKey === 'create_payment_profile' || actionKey === 'update_payment') {
        resultsMap.payment = node.outputData;
        resultsMap.payments = node.outputData;
      }

      if (actionKey === 'create_invoice' || actionKey === 'send_invoice') {
        resultsMap.invoice = node.outputData;
        resultsMap.invoices = node.outputData;
      }
    }

    return resultsMap;
  };

  const hasMeaningfulNodeResponse = (value) => {
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  };

  const setNodeRunState = useCallback((nodeId, status) => {
    if (nodeRunTimersRef.current[nodeId]) {
      clearTimeout(nodeRunTimersRef.current[nodeId]);
      delete nodeRunTimersRef.current[nodeId];
    }
    setNodeRunStates((prev) => ({
      ...prev,
      [nodeId]: {
        status,
        revision: (prev[nodeId]?.revision || 0) + 1,
      },
    }));

    if (status === 'empty') {
      nodeRunTimersRef.current[nodeId] = setTimeout(() => {
        setNodeRunStates((prev) => {
          if (!prev[nodeId]) return prev;
          const next = { ...prev };
          delete next[nodeId];
          return next;
        });
        delete nodeRunTimersRef.current[nodeId];
      }, 3200);
    }
  }, []);

  const executeRunnableNode = async (nodeId, manualValues = {}) => {
    const node = nodeMap[nodeId];
    if (!node?.actionConfig) return;

    const config = node.actionConfig;
    const actionKey = config._key;
    console.log('[Run Node] Starting executeRunnableNode', { nodeId, actionKey, manualValues });
    const flowResultsMap = buildFlowResultsMap(nodeId);
    const hasManualValue = (fieldKey) => Object.prototype.hasOwnProperty.call(manualValues, fieldKey);
    const getValue = (fieldKey) => resolveRunFieldValue(
      config[fieldKey],
      flowResultsMap,
      hasManualValue(fieldKey),
      manualValues[fieldKey]
    );
    const runStartedAt = Date.now();
    const finishNodeRun = (result) => {
      const complete = () => setNodeRunState(nodeId, hasMeaningfulNodeResponse(result) ? 'success' : 'empty');
      const elapsed = Date.now() - runStartedAt;
      const remaining = Math.max(0, 900 - elapsed);
      if (remaining > 0) {
        setTimeout(complete, remaining);
      } else {
        complete();
      }
      return result;
    };

    setNodeRunState(nodeId, 'running');

    try {
      if (actionKey === 'search_records') {
        const tableKey = (config.target_table || 'people').toLowerCase().replace(/\s+/g, '_');
        const limit = config.search_limit || 10;
        console.log('[Run Node] search_records request', { nodeId, tableKey, limit });
        let query = supabase.from(tableKey).select('*').limit(limit);
        const searchUserId = getValue('search_user_id');
        if (searchUserId) query = query.eq('user_id', searchUserId);
        const { data, error } = await query;
        if (error) throw new Error(error.message || 'Search failed');
        const result = data || [];
        setNodes(prev => prev.map(n => n.id === nodeId
          ? { ...n, searchResults: result, outputData: result }
          : n
        ));
        return finishNodeRun(result);
      }

      if (actionKey === 'create_payment') {
        const amountCents = Math.round(Number(getValue('amount') || 0) * 100);
        console.log('[Run Node] create_payment request', { nodeId, amountCents });
        const resp = await fetch('/api/sonar/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: amountCents,
            currency: getValue('currency') || 'usd',
            payment_method_type: getValue('payment_method') || 'card',
            description: getValue('description') || '',
            person_id: getValue('person_id') || null,
            appointment_id: getValue('appointment_id') || null,
          }),
        });
        const result = await resp.json();
        if (!resp.ok || result.error || result.detail) throw new Error(result.error || result.detail || 'Create payment failed');
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, outputData: result } : n));
        return finishNodeRun(result);
      }

      if (actionKey === 'create_payment_profile') {
        const amountCents = Math.round(Number(getValue('amount') || 0) * 100);
        console.log('[Run Node] create_payment_profile request', { nodeId, amountCents });
        const resp = await fetch('/api/sonar/create-payment-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: amountCents,
            currency: getValue('currency') || 'usd',
            description: getValue('description') || '',
            person_id: getValue('person_id') || null,
            customer_name: getValue('customer_name') || '',
            customer_email: getValue('customer_email') || '',
            customer_phone: getValue('customer_phone') || '',
          }),
        });
        const result = await resp.json();
        if (!resp.ok || result.error || result.detail) throw new Error(result.error || result.detail || 'Create payment profile failed');
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, outputData: result } : n));
        return finishNodeRun(result);
      }

      if (actionKey === 'create_invoice') {
        const amountCents = Math.round(Number(getValue('amount') || 0) * 100);
        console.log('[Run Node] create_invoice request', { nodeId, amountCents });
        const resp = await fetch('/api/sonar/create-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: amountCents,
            currency: getValue('currency') || 'usd',
            description: getValue('description') || '',
            person_id: getValue('person_id') || null,
            customer_name: getValue('customer_name') || '',
            customer_email: getValue('customer_email') || '',
            customer_phone: getValue('customer_phone') || '',
            appointment_id: getValue('appointment_id') || null,
            service_id: getValue('service_id') || null,
            due_days: getValue('due_days') || 7,
          }),
        });
        const result = await resp.json();
        if (!resp.ok || result.error || result.detail) throw new Error(result.error || result.detail || 'Create invoice failed');
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, outputData: result } : n));
        return finishNodeRun(result);
      }

      if (actionKey === 'send_invoice') {
        console.log('[Run Node] send_invoice request', { nodeId, invoiceId: getValue('invoice_id') || null });
        const resp = await fetch('/api/sonar/send-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoice_id: getValue('invoice_id') || null,
          }),
        });
        const result = await resp.json();
        if (!resp.ok || result.error || result.detail) throw new Error(result.error || result.detail || 'Send invoice failed');
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, outputData: result } : n));
        return finishNodeRun(result);
      }

      if (actionKey === 'send_email') {
        if (!session?.access_token) throw new Error('You need to be logged in to send email.');
        const body = {
          to: getValue('to') || '',
          subject: getValue('subject') || '',
          body: getValue('body') || '',
        };
        console.log('[Run Node] send_email request', { nodeId, body });
        const resp = await fetch(`${API_BASE_URL}/api/sonar/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
        });
        const result = await resp.json();
        if (!resp.ok || result.error || result.detail) throw new Error(result.error || result.detail || 'Send email failed');
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, outputData: result } : n));
        return finishNodeRun(result);
      }

      if (actionKey === 'update_record' || actionKey === 'create_new_record') {
        const tableKey = (config.target_table || 'people').toLowerCase().replace(/\s+/g, '_');
        const resolvedRecordId = getValue('record_id') || null;
        const updateData = {};

        Object.entries(config).forEach(([key, value]) => {
          if (key.startsWith('_') || key === 'target_table' || key === 'record_id' || key === 'record_lookup_value') return;
          if (!key.startsWith('field_')) return;
          const actualKey = key.replace(/^field_/, '');
          const resolvedValue = resolveRunFieldValue(value, flowResultsMap, hasManualValue(key), manualValues[key]);
          if (resolvedValue !== '' && resolvedValue !== undefined) {
            updateData[actualKey] = resolvedValue;
          }
        });

        console.log('[Run Node] record request', { nodeId, actionKey, tableKey, resolvedRecordId, updateData });

        let result;
        if (actionKey === 'update_record' && resolvedRecordId) {
          const { data, error } = await supabase
            .from(tableKey)
            .update(updateData)
            .eq('id', resolvedRecordId)
            .select()
            .single();
          if (error) throw new Error(error.message || 'Update record failed');
          result = data;
        } else if (actionKey === 'create_new_record') {
          const { data, error } = await supabase
            .from(tableKey)
            .insert(updateData)
            .select()
            .single();
          if (error) throw new Error(error.message || 'Create record failed');
          result = data;
        } else {
          throw new Error('Record ID is required to update a record.');
        }

        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, outputData: result } : n));
        return finishNodeRun(result);
      }

      throw new Error(`Run Node is not implemented for "${actionKey}".`);
    } catch (error) {
      console.error('[Run Node] executeRunnableNode failed', { nodeId, actionKey, error: error?.message || error });
      const elapsed = Date.now() - runStartedAt;
      const remaining = Math.max(0, 900 - elapsed);
      if (remaining > 0) {
        setTimeout(() => setNodeRunState(nodeId, 'empty'), remaining);
      } else {
        setNodeRunState(nodeId, 'empty');
      }
      throw error;
    }
  };

  const handleRunNodeRequest = async (nodeId) => {
    const node = nodeMap[nodeId];
    if (!node?.actionConfig) return;
    setSelectedNodeId(nodeId);

    const unresolvedFields = getUnresolvedRunFields(node, buildFlowResultsMap(nodeId));
    if (unresolvedFields.length > 0) {
      runNodeTargetRef.current = nodeId;
      setRunNodeModal({
        nodeId,
        nodeLabel: node.label || 'Run Node',
        actionKey: node.actionConfig._key,
        fields: unresolvedFields,
        values: Object.fromEntries(unresolvedFields.map((field) => [field.key, ''])),
        isSubmitting: false,
        error: '',
      });
      openSelectionPanel(nodeId);
      setActionConfig(node.actionConfig ? { ...node.actionConfig } : null);
      setPanelCategory(node.categoryType === 'TRIGGERS' ? 'TRIGGERS' : 'ACTIONS');
      setPanelStage('runNode');
      return;
    }

    await executeRunnableNode(nodeId);
  };

  // ─── Run Entire Scenario ─────────────────────────────────────────────
  const runScenario = async () => {
    if (isRunning) return;
    setIsRunning(true);
    const log = (msg) => { console.log(`[Scenario Run] ${msg}`); setRunProgress(msg); };
    log('▶ Starting...');

    const triggerNode = nodes.find(n => n.categoryType === 'TRIGGERS');
    if (!triggerNode) { log('❌ No trigger found'); setIsRunning(false); return; }

    // Build execution order via BFS
    const visited = new Set([triggerNode.id]);
    const queue = [triggerNode.id];
    const execOrder = [triggerNode];
    while (queue.length > 0) {
      const current = queue.shift();
      for (const edge of edges) {
        if (edge.from === current && !visited.has(edge.to)) {
          visited.add(edge.to);
          queue.push(edge.to);
          const node = nodes.find(n => n.id === edge.to);
          if (node) execOrder.push(node);
        }
      }
    }

    // Mutable map — stores outputData per node ID for variable resolution
    const resultsMap = {};
    log(`📋 Execution order: ${execOrder.map(n => n.label || n.id).join(' → ')}`);

    for (let i = 0; i < execOrder.length; i++) {
      const node = execOrder[i];
      const step = `[${i + 1}/${execOrder.length}]`;

      if (!node.configured) { log(`⏭ ${step} ${node.label || node.id} — skipped (not configured)`); continue; }
      const actionKey = node.actionConfig?._key;
      if (!actionKey) { log(`⏭ ${step} ${node.label || node.id} — skipped (no action)`); continue; }

      log(`⚙ ${step} ${node.label} — running...`);

      try {
        if (actionKey === 'search_records') {
          const config = node.actionConfig;
          const tableKey = (config.target_table || 'people').toLowerCase().replace(/\s+/g, '_');
          const limit = config.search_limit || 10;
          const userId = resolveVariableRefs(resolveTableVariableRefs(config.search_user_id, resultsMap), resultsMap) || config.search_user_id;
          console.log(`[Scenario Run]   ├ Query: ${tableKey} | limit: ${limit} | user_id: ${userId || '(default)'}`);
          let query = supabase.from(tableKey).select('*').limit(limit);
          if (userId) query = query.eq('user_id', userId);
          const { data, error } = await query;
          if (!error) {
            const resultData = data || [];
            setNodes(prev => prev.map(n => n.id === node.id ? { ...n, searchResults: resultData, outputData: resultData } : n));
            resultsMap[node.id] = resultData;
            resultsMap[tableKey] = resultData;
            resultsMap[normalizeTableRefKey(tableKey)] = resultData;
            log(`✅ ${step} ${node.label} — ${resultData.length} records found`);
            console.log(`[Scenario Run]   └ ${tableKey} → ${resultData.length} rows`);
          } else {
            log(`❌ ${step} ${node.label} — error: ${error.message}`);
            console.error(`[Scenario Run]   └ Error:`, error.message);
          }
        } else if (actionKey === 'create_payment') {
          const config = node.actionConfig;
          const amountCents = Math.round(Number(resolveVariableRefs(resolveTableVariableRefs(config.amount, resultsMap), resultsMap) || config.amount || 0) * 100);
          const body = {
            amount: amountCents,
            currency: config.currency || 'usd',
            payment_method_type: config.payment_method || 'card',
            description: resolveVariableRefs(resolveTableVariableRefs(config.description, resultsMap), resultsMap) || config.description || '',
            person_id: resolveVariableRefs(resolveTableVariableRefs(config.person_id, resultsMap), resultsMap) || config.person_id || null,
          };
          console.log(`[Scenario Run]   ├ POST /api/sonar/create-payment | amount: ${amountCents} | person: ${body.person_id || '(none)'}`);
          const resp = await fetch('/api/sonar/create-payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          const result = await resp.json();
          if (!result.error) {
            setNodes(prev => prev.map(n => n.id === node.id ? { ...n, outputData: result } : n));
            resultsMap[node.id] = result;
            resultsMap.payment = result;
            resultsMap.payments = result;
            log(`✅ ${step} ${node.label} — status: ${result.status} | intent: ${result.id}`);
            console.log(`[Scenario Run]   └ PaymentIntent: ${result.id} | status: ${result.status}`);
          } else {
            log(`❌ ${step} ${node.label} — error: ${result.error}`);
            console.error(`[Scenario Run]   └ Error:`, result.error);
          }
        } else if (actionKey === 'create_payment_profile') {
          const config = node.actionConfig;
          const amountCents = Math.round(Number(resolveVariableRefs(resolveTableVariableRefs(config.amount, resultsMap), resultsMap) || config.amount || 0) * 100);
          const body = {
            amount: amountCents,
            currency: config.currency || 'usd',
            description: resolveVariableRefs(resolveTableVariableRefs(config.description, resultsMap), resultsMap) || config.description || '',
            person_id: resolveVariableRefs(resolveTableVariableRefs(config.person_id, resultsMap), resultsMap) || config.person_id || null,
            customer_name: resolveVariableRefs(resolveTableVariableRefs(config.customer_name, resultsMap), resultsMap) || config.customer_name || '',
            customer_email: resolveVariableRefs(resolveTableVariableRefs(config.customer_email, resultsMap), resultsMap) || config.customer_email || '',
          };
          console.log(`[Scenario Run]   ├ POST /api/sonar/create-payment-profile | person: ${body.person_id || '(none)'}`);
          const resp = await fetch('/api/sonar/create-payment-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          const result = await resp.json();
          if (!result.error) {
            setNodes(prev => prev.map(n => n.id === node.id ? { ...n, outputData: result } : n));
            resultsMap[node.id] = result;
            resultsMap.payment = result;
            resultsMap.payments = result;
            log(`✅ ${step} ${node.label} — customer: ${result.customer_id} | payment URL: ${result.payment_url ? 'yes' : 'no'}`);
            console.log(`[Scenario Run]   ├ Customer: ${result.customer_id}`);
            console.log(`[Scenario Run]   ├ SetupIntent: ${result.setup_intent_id}`);
            console.log(`[Scenario Run]   └ Payment URL: ${result.payment_url || result.checkout_error || 'none'}`);
          } else {
            log(`❌ ${step} ${node.label} — error: ${result.error}`);
            console.error(`[Scenario Run]   └ Error:`, result.error);
          }
        } else if (actionKey === 'create_invoice') {
          const config = node.actionConfig;
          const amountCents = Math.round(Number(resolveVariableRefs(resolveTableVariableRefs(config.amount, resultsMap), resultsMap) || config.amount || 0) * 100);
          const body = {
            amount: amountCents,
            currency: config.currency || 'usd',
            description: resolveVariableRefs(resolveTableVariableRefs(config.description, resultsMap), resultsMap) || config.description || '',
            person_id: resolveVariableRefs(resolveTableVariableRefs(config.person_id, resultsMap), resultsMap) || config.person_id || null,
            customer_name: resolveVariableRefs(resolveTableVariableRefs(config.customer_name, resultsMap), resultsMap) || config.customer_name || '',
            customer_email: resolveVariableRefs(resolveTableVariableRefs(config.customer_email, resultsMap), resultsMap) || config.customer_email || '',
            customer_phone: resolveVariableRefs(resolveTableVariableRefs(config.customer_phone, resultsMap), resultsMap) || config.customer_phone || '',
            appointment_id: resolveVariableRefs(resolveTableVariableRefs(config.appointment_id, resultsMap), resultsMap) || config.appointment_id || null,
            service_id: resolveVariableRefs(resolveTableVariableRefs(config.service_id, resultsMap), resultsMap) || config.service_id || null,
            due_days: resolveVariableRefs(resolveTableVariableRefs(config.due_days, resultsMap), resultsMap) || config.due_days || 7,
          };
          console.log(`[Scenario Run]   ├ POST /api/sonar/create-invoice | amount: ${amountCents} | person: ${body.person_id || '(none)'}`);
          const resp = await fetch('/api/sonar/create-invoice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          const result = await resp.json();
          if (!result.error) {
            setNodes(prev => prev.map(n => n.id === node.id ? { ...n, outputData: result } : n));
            resultsMap[node.id] = result;
            resultsMap.invoice = result;
            resultsMap.invoices = result;
            log(`✅ ${step} ${node.label} — invoice: ${result.invoice_id || result.id} | status: ${result.status || 'draft'}`);
            console.log(`[Scenario Run]   └ Invoice: ${result.invoice_id || result.id} | status: ${result.status || 'draft'}`);
          } else {
            log(`❌ ${step} ${node.label} — error: ${result.error}`);
            console.error(`[Scenario Run]   └ Error:`, result.error);
          }
        } else if (actionKey === 'send_invoice') {
          const config = node.actionConfig;
          const body = {
            invoice_id: resolveVariableRefs(resolveTableVariableRefs(config.invoice_id, resultsMap), resultsMap) || config.invoice_id || null,
          };
          console.log(`[Scenario Run]   ├ POST /api/sonar/send-invoice | invoice: ${body.invoice_id || '(none)'}`);
          const resp = await fetch('/api/sonar/send-invoice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          const result = await resp.json();
          if (!result.error) {
            setNodes(prev => prev.map(n => n.id === node.id ? { ...n, outputData: result } : n));
            resultsMap[node.id] = result;
            resultsMap.invoice = result;
            resultsMap.invoices = result;
            log(`✅ ${step} ${node.label} — invoice: ${result.invoice_id || result.id} | status: ${result.status || 'sent'}`);
            console.log(`[Scenario Run]   └ Invoice: ${result.invoice_id || result.id} | status: ${result.status || 'sent'}`);
          } else {
            log(`❌ ${step} ${node.label} — error: ${result.error}`);
            console.error(`[Scenario Run]   └ Error:`, result.error);
          }
        } else if (actionKey === 'send_email') {
          if (!session?.access_token) {
            log(`❌ ${step} ${node.label} — error: login required`);
            continue;
          }
          const config = node.actionConfig;
          const body = {
            to: resolveVariableRefs(resolveTableVariableRefs(config.to, resultsMap), resultsMap) || config.to || '',
            subject: resolveVariableRefs(resolveTableVariableRefs(config.subject, resultsMap), resultsMap) || config.subject || '',
            body: resolveVariableRefs(resolveTableVariableRefs(config.body, resultsMap), resultsMap) || config.body || '',
          };
          console.log(`[Scenario Run]   ├ POST /api/sonar/send-email | to: ${body.to || '(none)'}`);
          const resp = await fetch(`${API_BASE_URL}/api/sonar/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(body),
          });
          const result = await resp.json();
          if (!result.error && !result.detail) {
            setNodes(prev => prev.map(n => n.id === node.id ? { ...n, outputData: result } : n));
            resultsMap[node.id] = result;
            log(`✅ ${step} ${node.label} — email sent`);
            console.log(`[Scenario Run]   └ Email: ${result.id} | provider: ${result.provider}`);
          } else {
            log(`❌ ${step} ${node.label} — error: ${result.error || result.detail}`);
            console.error(`[Scenario Run]   └ Error:`, result.error || result.detail);
          }
        } else if (actionKey === 'update_record' || actionKey === 'create_new_record') {
          const config = node.actionConfig;
          const tableKey = (config.target_table || 'people').toLowerCase().replace(/\s+/g, '_');
          const resolvedRecordId = resolveVariableRefs(config.record_id, resultsMap) || config.record_id;
          // Build update payload — skip meta keys, strip field_ prefix for actual column names
          const skipKeys = (key) => key.startsWith('_') || key === 'target_table' || key === 'record_id' || key === 'record_lookup_value';
          const updateData = {};
          for (const [key, value] of Object.entries(config)) {
            if (skipKeys(key)) continue;
            if (value == null || value === '') continue;
            // Strip "field_" prefix — it's used for form keys but the actual Supabase column is the name after "field_"
            const columnKey = key.startsWith('field_') ? key.slice(6) : key;
            updateData[columnKey] = resolveVariableRefs(resolveTableVariableRefs(value, resultsMap), resultsMap);
          }
          console.log(`[Scenario Run]   ├ Resolved update data:`, JSON.stringify(updateData));
          console.log(`[Scenario Run]   ├ ${actionKey === 'update_record' ? 'PATCH' : 'POST'} /api/sonar/${tableKey} | data:`, JSON.stringify(updateData));
          if (tableKey === 'people') {
            const customUpdates = {};
            Object.keys(updateData).forEach((columnKey) => {
              if (!isCustomFieldKey(columnKey)) return;
              const customField = peopleCustomFieldMap.get(columnKey);
              customUpdates[columnKey] = coerceCustomFieldValue(updateData[columnKey], customField?.type);
              delete updateData[columnKey];
            });

            if (Object.keys(customUpdates).length > 0) {
              let existingCustomFields = {};
              if (actionKey === 'update_record' && resolvedRecordId) {
                const { data } = await supabase
                  .from('people')
                  .select('custom_fields')
                  .eq('id', resolvedRecordId)
                  .single();
                existingCustomFields = data?.custom_fields || {};
              }
              updateData.custom_fields = { ...existingCustomFields, ...customUpdates };
            }
          }

          if (actionKey === 'update_record' && resolvedRecordId) {
            // Update existing record via Supabase
            const { data, error } = await supabase.from(tableKey).update(updateData).eq('id', resolvedRecordId).select().single();
            if (!error) {
              setNodes(prev => prev.map(n => n.id === node.id ? { ...n, outputData: data } : n));
              resultsMap[node.id] = data;
              resultsMap[tableKey] = data;
              resultsMap[normalizeTableRefKey(tableKey)] = data;
              log(`✅ ${step} ${node.label} — updated ${tableKey} record ${resolvedRecordId}`);
              console.log(`[Scenario Run]   └ Updated: ${JSON.stringify(updateData)}`);
            } else {
              log(`❌ ${step} ${node.label} — error: ${error.message}`);
              console.error(`[Scenario Run]   └ Error:`, error.message);
            }
          } else if (actionKey === 'create_new_record') {
            // Create new record via Supabase
            const { data, error } = await supabase.from(tableKey).insert(updateData).select().single();
            if (!error) {
              setNodes(prev => prev.map(n => n.id === node.id ? { ...n, outputData: data } : n));
              resultsMap[node.id] = data;
              resultsMap[tableKey] = data;
              resultsMap[normalizeTableRefKey(tableKey)] = data;
              log(`✅ ${step} ${node.label} — created ${tableKey} record ${data.id}`);
              console.log(`[Scenario Run]   └ Created: ${data.id}`);
            } else {
              log(`❌ ${step} ${node.label} — error: ${error.message}`);
              console.error(`[Scenario Run]   └ Error:`, error.message);
            }
          }
        } else {
          log(`⏭ ${step} ${node.label} — no executor for "${actionKey}" (skipped)`);
          console.log(`[Scenario Run]   └ Node has no run executor. Type: ${actionKey}`);
        }
      } catch (err) {
        log(`❌ ${step} ${node.label} — failed: ${err.message}`);
        console.error(`[Scenario Run]   └ Exception:`, err);
      }

      await new Promise(r => setTimeout(r, 300));
    }

    setTimeout(() => {
      log('✅ Scenario complete!');
      setIsRunning(false);
      setTimeout(() => setRunProgress(''), 5000);
    }, 500);
  };

  useEffect(() => {
    // Scenario execution now lives in the FastAPI backend.
    // Keep manual testing in the UI, but avoid double-running flows from
    // frontend realtime subscriptions and backend trigger execution.
    return undefined;
  }, [nodes, isRunning]);

  const handleEditScenario = (scenario) => {
    // Load scenario and show save modal with current values
    handleLoadScenario(scenario);
    setScenarioName(scenario.name);
    setScenarioDescription(scenario.description || '');
    setShowSaveModal(true);
  };

  const handleDeleteScenario = (scenario) => {
    // Show custom confirmation modal
    console.log('[Scenarios] Deleting scenario:', scenario.name);
    window.selectedScenarioForDelete = scenario;
    setDeleteConfirmModal(true);
  };

  const handleCancelDelete = () => {
    setDeleteConfirmModal(false);
    window.selectedScenarioForDelete = null;
  };

  const handleConfirmDelete = async () => {
    const scenario = window.selectedScenarioForDelete;
    if (!scenario) return;

    let deleteQuery = supabase.from('scenarios').delete().eq('id', scenario.id);
    if (userId) {
      deleteQuery = deleteQuery.or(`user_id.eq.${userId},created_by.eq.${userId}`);
    }
    const { error } = await deleteQuery;
    
    if (error) {
      console.error('[Scenarios] Error deleting scenario:', error);
      setDeleteConfirmModal(false);
      return;
    }
    
    console.log('[Scenarios] Deleted scenario:', scenario.name);
    
    // Refresh the scenarios list
    const { data: updatedScenarios } = await supabase
      .from('scenarios')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (updatedScenarios) {
      setScenarios(updatedScenarios);
    }
    
    // If we deleted the currently loaded scenario, go back to list
    if (currentScenario?.id === scenario.id) {
      setCurrentScenario(null);
      setViewMode('list');
    }
    
    setDeleteConfirmModal(false);
    window.selectedScenarioForDelete = null;
  };

  const handleToggleScenarioStatus = async (scenario) => {
    const newStatus = scenario.status === 'active' ? 'disabled' : 'active';
    
    const { error } = await supabase
      .from('scenarios')
      .update({ status: newStatus })
      .eq('id', scenario.id);
    
    if (error) {
      console.error('[Scenarios] Error updating scenario status:', error);
      return;
    }
    
    console.log('[Scenarios] Updated scenario status:', scenario.name, '->', newStatus);
    
    // Refresh the scenarios list
    const { data: updatedScenarios } = await supabase
      .from('scenarios')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (updatedScenarios) {
      setScenarios(updatedScenarios);
    }
  };

  // List View Component
  const renderListView = () => (
    <div className="scenario-list-page">
      <div className="scenario-list-header">
        <div className="scenario-list-title-group">
          <h1 className="scenario-list-title">Scenarios</h1>
          <p className="scenario-list-subtitle">Automate your workflows with conditional logic</p>
        </div>
        <div className="scenario-list-actions">
          <button className="create-scenario-btn" onClick={handleCreateScenario}>
            <Plus size={18} />
            Create Scenario
          </button>
        </div>
      </div>
      
      <div className="scenario-list-content">
        {scenarios.length === 0 ? (
          <div className="scenario-empty-state">
            <div className="scenario-empty-icon">
              <Target size={48} />
            </div>
            <h3 className="scenario-empty-title">No scenarios yet</h3>
            <p className="scenario-empty-description">
              Create your first scenario to automate workflows based on lead conditions.
            </p>
            <button className="create-scenario-btn" onClick={handleCreateScenario}>
              <Plus size={18} />
              Create Your First Scenario
            </button>
          </div>
        ) : (
          <div className="scenario-grid">
            {scenarios.map((scenario) => (
              <div 
                key={scenario.id} 
                className={`scenario-card ${scenario.status === 'disabled' ? 'scenario-disabled' : ''}`}
              >
                <div 
                  className="scenario-card-content"
                  onClick={() => handleLoadScenario(scenario)}
                >
                  <div className="scenario-card-header">
                    <h3 className="scenario-card-title">{scenario.name}</h3>
                    <span className={`scenario-card-status ${scenario.status}`}>
                      {scenario.status === 'active' ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="scenario-card-description">{scenario.description}</p>
                  <div className="scenario-card-footer">
                    <span className="scenario-card-date">
                      {new Date(scenario.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="scenario-card-actions">
                  <button 
                    className="scenario-action-btn toggle"
                    onClick={(e) => { e.stopPropagation(); handleToggleScenarioStatus(scenario); }}
                    title={scenario.status === 'active' ? 'Disable scenario' : 'Enable scenario'}
                  >
                    {scenario.status === 'active' ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button 
                    className="scenario-action-btn edit"
                    onClick={(e) => { e.stopPropagation(); handleEditScenario(scenario); }}
                    title="Edit scenario"
                  >
                    <Pencil size={14} />
                  </button>
                  <button 
                    className="scenario-action-btn delete"
                    onClick={(e) => { e.stopPropagation(); handleDeleteScenario(scenario); }}
                    title="Delete scenario"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderBuilderView = () => (
    <div className="scenario-builder-page" ref={builderRef} onPointerDown={handlePagePointerDown}>
      <div className="sb-canvas-wrapper">
        <div
          className="sb-canvas"
          ref={canvasRef}
          onPointerDown={handleCanvasPointerDown}
          onWheel={handleWheel}
        >
          <div className="sb-canvas-grid" />
          
          {/* Quantum Reveal label — shown when initial node is unconfigured */}
          {nodes.length === 1 && !nodes[0].configured && (
            <>
            </>
          )}
          <div
            className="sb-canvas-viewport"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
              opacity: viewportReady ? 1 : 0,
              transition: 'opacity 0.15s ease',
            }}
          >
            <svg className="sb-canvas-connections">
              <defs>
                <marker id="sb-arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="rgba(255,255,255,0.2)" />
                </marker>
              </defs>
              {edges.map((edge) => {
                const from = nodeMap[edge.from];
                const to = nodeMap[edge.to];
                if (!from || !to) return null;
                const isDraft = !nodeMap[edge.to]?.configured;
                const isFallback = edge.filter?.type === 'fallback';
                // For unconfigured nodes, edge should target circle bottom (center + radius)
                // Configured nodes already have node.y near sphere bottom due to label+connector below
                const fromMeasured = circleCenterRef.current[edge.from];
                const toMeasured = circleCenterRef.current[edge.to];
                const fromY = !from.configured && fromMeasured ? fromMeasured.cy + fromMeasured.r : from.y;
                const toY = !to.configured && toMeasured ? toMeasured.cy + toMeasured.r : to.y;
                const dx = to.x - from.x;
                const path = `M ${from.x} ${fromY} C ${from.x + dx/2} ${fromY}, ${from.x + dx/2} ${toY}, ${to.x} ${toY}`;

                return (
                  <path
                    key={edge.id}
                    d={path}
                    className={`sb-edge-line ${isDraft ? 'sb-edge-draft' : ''} ${isFallback ? 'sb-edge-fallback' : ''}`}
                    fill="none"
                    markerEnd={!isDraft ? "url(#sb-arrowhead)" : ""}
                    style={isFallback ? { stroke: '#f59e0b', strokeDasharray: '8 4', strokeWidth: '2px' } : {}}
                  />
                );
              })}
            </svg>
            
            {edges.map((edge) => {
              const from = nodeMap[edge.from];
              const to = nodeMap[edge.to];
              if (!from || !to) return null;
              const fromMeasuredPin = circleCenterRef.current[edge.from];
              const toMeasuredPin = circleCenterRef.current[edge.to];
              const fromYPin = !from.configured && fromMeasuredPin ? fromMeasuredPin.cy + fromMeasuredPin.r : from.y;
              const toYPin = !to.configured && toMeasuredPin ? toMeasuredPin.cy + toMeasuredPin.r : to.y;
              const midX = (from.x + to.x) / 2;
              const midY = (fromYPin + toYPin) / 2;
              const isFallback = edge.filter?.type === 'fallback';
              return (
                <div
                  key={`filter-${edge.id}`}
                  className={`sb-filter-pin ${edge.filter ? 'has-filter' : ''} ${isFallback ? 'sb-filter-fallback' : ''}`}
                  style={{ left: midX, top: midY }}
                  onClick={(event) => { setVarsPane(prev => ({ ...prev, visible: false })); handleEdgeLogicClick(edge, event); }}
                >
                  <div className="sb-filter-label">
                    {isFallback ? (
                      <><GitBranch size={10} /> Fallback</>
                    ) : edge.filter ? (
                      <Zap size={10} />
                    ) : (
                      <Filter size={12} />
                    )}
                  </div>
                  <div className="sb-filter-dot" />
                </div>
              );
            })}
            
            {nodes.map((node) => {
              // Skip initial unconfigured node — rendered in centering overlay
              if (node.id === INITIAL_NODE.id && !node.configured) return null;
              const Icon = node.icon || null;
              const isActive = selectedNodeId === node.id;
              const accent = node.accent || '#e11d48';
              const hasOutgoingNode = edges.some((edge) => edge.from === node.id);
              const nodeRunState = nodeRunStates[node.id]?.status || null;
              return (
                <div
                  key={node.id}
                  ref={(el) => {
                    if (el) nodeRefs.current[node.id] = el;
                    else delete nodeRefs.current[node.id];
                  }}
                  className={`sb-builder-node ${node.type === 'router' ? 'router-node' : ''} ${
                    isActive ? 'sb-active-node' : ''
                  } ${node.configured ? 'sb-is-configured' : 'sb-is-placeholder'}`}
                  style={{ left: node.x, top: node.y, opacity: nodesOpacity, transition: 'opacity 0.3s ease' }}
                  onPointerDown={(event) => handleNodePointerDown(node.id, event)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    if ((node.actionConfig?._key === 'search_records' || node.actionConfig?._key === 'create_payment' || node.actionConfig?._key === 'create_payment_profile' || node.actionConfig?._key === 'create_invoice' || node.actionConfig?._key === 'send_invoice' || node.actionConfig?._key === 'send_email') && node.configured) {
                      setRunNodeModal(null);
                      setIsPanelVisible(false);
                      setPanelIntent(false);
                      setLogicPanel(null);
                      setVarsPane((prev) => ({ ...prev, visible: false }));
                      setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
                    }
                  }}
                >
                  {node.configured ? (
                    <>
                      <div className="sb-node-inner-wrap" ref={(el) => { if (el) circleRefs.current[node.id] = el.querySelector('.sb-node-sphere') || el; }}>
                        {/* Outer Ring / Aura — exact from concepts.txt */}
                        <div className={`sb-node-aura ${accent ? 'sb-node-custom-gradient' : ''}`}
                          style={accent ? { '--node-accent-color': accent } : {}}
                        />

                        {/* Outer Boundary Stroke — Concentric design */}
                        <div className="sb-node-ring" />

                        {/* The Primary Gradient Sphere */}
                        <div
                          className={`sb-node-sphere ${isActive ? 'sb-sphere-active' : ''} ${nodeRunState ? `is-${nodeRunState}` : ''}`}
                          style={{ '--node-accent-color': accent }}
                        >
                          {nodeRunState === 'running' && (
                            <div className="sb-node-run-overlay" aria-hidden="true">
                              <span className="sb-node-run-wave w1" />
                              <span className="sb-node-run-wave w2" />
                              <span className="sb-node-run-wave w3" />
                            </div>
                          )}
                          {(nodeRunState === 'success' || nodeRunState === 'empty') && (
                            <div className={`sb-node-run-resolve is-${nodeRunState}`} aria-hidden="true" />
                          )}
                          <div className="sb-node-specular" />
                          <div className="sb-node-dots">
                            <svg width="100%" height="100%">
                              <pattern id={`grid-${node.id}`} width="12" height="12" patternUnits="userSpaceOnUse">
                                <circle cx="1" cy="1" r="0.6" fill="white" />
                              </pattern>
                              <rect width="100%" height="100%" fill={`url(#grid-${node.id})`} />
                            </svg>
                          </div>
                          <div className="sb-node-core-shadow" />
                        </div>

                        {/* Icon Container with Glassmorphism */}
                        <div className={`sb-node-icon-glass ${nodeRunState ? `is-${nodeRunState}` : ''}`}>
                          <div className={`sb-node-icon-glyph ${nodeRunState === 'success' ? 'is-hidden' : ''}`}>
                            {Icon ? <Icon size={42} className="text-white" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }} strokeWidth={1.5} /> : <Plus size={42} className="text-white" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }} strokeWidth={1.5} />}
                          </div>
                          {nodeRunState === 'success' && (
                            <div className="sb-node-run-status is-success" aria-hidden="true">
                              <Check size={42} strokeWidth={2.8} />
                            </div>
                          )}
                          {nodeRunState === 'empty' && (
                            <div className="sb-node-run-status is-empty" aria-hidden="true">
                              <span>?</span>
                            </div>
                          )}
                        </div>

                        {/* Pulse Effect for Activity */}
                        <div className="sb-node-pulse-dot" />

                        {/* Add button */}
                        {!hasOutgoingNode && (
                          <button className="sb-node-add" type="button" onClick={() => handleAddNode(node.id)}>
                            <Plus size={13} />
                          </button>
                        )}
                      </div>

                      {/* Label below — typography from concepts.txt */}
                      <div className="sb-node-label-below">
                        <h3 className="sb-node-below-title">{node.label}</h3>
                        {node.detail && <p className="sb-node-below-desc">{node.detail}</p>}
                      </div>

                      {/* Connecting Line Indicator */}
                      <div className="sb-node-connector-line" />
                    </>
                  ) : (
                    <div className="sb-node-inner-wrap" ref={(el) => { if (el) circleRefs.current[node.id] = el.querySelector('.sb-quantum-circle') || el; }}>
                      <div className="sb-quantum-circle" style={{ width: '100%', height: '100%', opacity: 1, transform: 'scale(1)', animation: 'quantum-breathe 6s 1.6s cubic-bezier(0.45, 0, 0.55, 1) infinite' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Centered overlay for initial unconfigured node */}
          {nodes.length === 1 && !nodes[0].configured && (
            <div className="sb-quantum-centering">
              <div className="sb-quantum-container-fade">
              <div
                className={`sb-builder-node ${selectedNodeId === nodes[0].id ? 'sb-active-node' : ''}`}
                ref={(el) => { if (el) nodeRefs.current[nodes[0].id] = el; }}
                onPointerDown={(event) => handleNodePointerDown(nodes[0].id, event)}
              >
                <div className="sb-quantum-composition">
                  <div className="sb-quantum-orbits">
                    {(quantumOrbits[nodes[0].id] || []).map(ring => (
                      <div key={ring.id} className="sb-quantum-orbit-ring"
                        style={{ width: ring.size, height: ring.size, animationDelay: `${ring.delay}s` }} />
                    ))}
                  </div>
                  <div className="sb-quantum-circle" ref={introCircleRef} />
                  <div className="sb-quantum-arrow" />
                  <div className="sb-quantum-cta-text">Click it. Click it real good.</div>
                </div>
              </div>
              </div>
            </div>
          )}
        </div>

        {isPanelVisible && selectedNodeId && (
          <div className="sb-selection-panel" style={panelStyle}>
            <div className="sb-panel-inner">
              <div className="sb-panel-header" onPointerDown={(e) => {
                if (e.target.closest('button')) return;
                e.preventDefault();
                panelDragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, startTop: panelStyle.top, startLeft: panelStyle.left };
                document.body.style.userSelect = 'none';
              }} style={{ cursor: 'move' }}>
                <div>
                  {showNodeConfigText && (
                    <>
                      <p className="sb-panel-label">Node Config</p>
                      <h3 className="sb-panel-title">Add Component</h3>
                    </>
                  )}
                </div>
                <div className="sb-panel-header-controls">
                  <button type="button" className="sb-panel-delete" onClick={handleDeleteNode}>
                    <Trash2 size={16} />
                  </button>
                  <button
                    type="button"
                    className="sb-panel-close"
                    onClick={() => {
                      runNodeTargetRef.current = null;
                      setRunNodeModal(null);
                      setSelectedNodeId(null);
                      setIsPanelVisible(false);
                      setPanelIntent(false);
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
                {panelStage === 'subOptions' && activeOption && (
                  <>
                  <div
                    className="sb-active-banner sleek-cyber"
                    style={{ borderLeft: `4px solid ${categoryMeta.accent}` }}
                  >
                    <div className="sb-cyber-inner">
                      <div className="sb-cyber-header">
                        <div
                          className="sb-cyber-pill"
                          style={{ backgroundColor: `${categoryMeta.accent}20`, color: categoryMeta.accent }}
                        >
                          {bannerCategoryLabel}
                        </div>
                        <button type="button" className="sb-cyber-back" onClick={handleBackToOptions}>
                          <ChevronLeft size={14} /> Change Selection
                        </button>
                      </div>
                      <div className="sb-cyber-main">
                        <div
                          className="sb-cyber-icon-box"
                          style={{
                            background: `linear-gradient(135deg, ${categoryMeta.accent}40, transparent)`,
                          }}
                        >
                          <BannerIcon size={24} style={{ color: categoryMeta.accent }} />
                        </div>
                        <div className="sb-cyber-title-group">
                          <h2 className="sb-cyber-title">{activeOption.option}</h2>
                          <p className="sb-cyber-desc">{activeOption.description}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="sb-panel-subheader">Select an action for {activeOption.option}</p>
                </>
              )}
              {!['actionConfig', 'appointmentConfig', 'scheduleConfig', 'triggerFilter', 'runNode'].includes(panelStage) && (
                <>
                  <div className="sb-panel-search">
                    <Search className="sb-panel-search-icon" size={16} />
                    <input
                      type="text"
                      value={panelSearch}
                      onChange={(event) => setPanelSearch(event.target.value)}
                    />
                  </div>
                  <div className="sb-panel-tabs">
                    {visibleCategories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        className={`sb-panel-tab ${panelCategory === category ? 'active' : ''}`}
                        onClick={() => {
                          setPanelCategory(category);
                          setPanelStage('options');
                          setActiveOption(null);
                        }}
                      >
                        {PANEL_CATEGORY_LABELS[category] || category}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {/* Action banner — persists across all config stages */}
              {['actionConfig', 'appointmentConfig', 'scheduleConfig', 'triggerFilter', 'runNode'].includes(panelStage) && selectedNode && (
                <div
                  className="sb-active-banner sleek-cyber"
                  style={{ borderLeft: `4px solid ${selectedNode.accent || categoryMeta.accent}` }}
                >
                  <div className="sb-cyber-inner">
                    <div className="sb-cyber-header">
                      <div
                        className="sb-cyber-pill"
                        style={{ backgroundColor: `${selectedNode.accent || categoryMeta.accent}20`, color: selectedNode.accent || categoryMeta.accent }}
                      >
                        {selectedNode.category || categoryMeta.detail}
                      </div>
                      <button
                        type="button"
                        className="sb-cyber-back"
                        onClick={() => {
                          runNodeTargetRef.current = null;
                          if (panelStage === 'runNode') {
                            setRunNodeModal(null);
                            setPanelStage(selectedNode?.actionConfig?._key ? 'actionConfig' : 'options');
                            return;
                          }
                          setPanelStage('options');
                        }}
                      >
                        <ChevronLeft size={14} /> Back
                      </button>
                    </div>
                    <div className="sb-cyber-main">
                      <div
                        className="sb-cyber-icon-box"
                        style={{
                          background: `linear-gradient(135deg, ${selectedNode.accent || categoryMeta.accent}40, transparent)`,
                        }}
                      >
                        {selectedNode.icon && typeof selectedNode.icon === 'function'
                          ? <selectedNode.icon size={24} style={{ color: selectedNode.accent || categoryMeta.accent }} />
                          : <Phone size={24} style={{ color: selectedNode.accent || categoryMeta.accent }} />}
                      </div>
                      <div className="sb-cyber-title-group">
                        <h2 className="sb-cyber-title">{selectedNode.label}</h2>
                        <p className="sb-cyber-desc">Configure {selectedNode.label}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="sb-panel-actions">
                {panelStage === 'triggerFilter' && triggerFilter ? (
                  <div className="sb-action-config-form">
                    <div className="sb-action-config-header">
                      <h4 className="sb-action-config-title">Filter</h4>
                      <button type="button" className="sb-action-config-close" onClick={() => { setPanelStage('options'); }}>
                        <X size={14} />
                      </button>
                    </div>
                    <div className="sb-trigger-filter-copy">
                      Only fire this trigger when the current time matches the selected offset before the appointment.
                    </div>
                    <div className="sb-trigger-filter-section">
                      <div className="sb-trigger-filter-rail" />
                      <div className="sb-trigger-filter-body">
                        <div className="sb-trigger-filter-kicker">Before appointment</div>
                        <div className="sb-action-config-fields">
                          <div className="sb-action-config-field">
                            <label className="sb-action-field-label">Hours</label>
                            <input
                              type="number"
                              min="0"
                              className="sb-input-field"
                              value={triggerFilter.hours ?? 0}
                              onChange={(event) => {
                                const hours = Math.max(0, parseInt(event.target.value, 10) || 0);
                                setTriggerFilter(normalizeAppointmentSoonFilter({ ...triggerFilter, hours }));
                              }}
                            />
                          </div>
                          <div className="sb-action-config-field">
                            <label className="sb-action-field-label">Minutes</label>
                            <input
                              type="number"
                              min="0"
                              max="59"
                              className="sb-input-field"
                              value={triggerFilter.minutes ?? 0}
                              onChange={(event) => {
                                const minutes = Math.max(0, Math.min(59, parseInt(event.target.value, 10) || 0));
                                setTriggerFilter(normalizeAppointmentSoonFilter({ ...triggerFilter, minutes }));
                              }}
                            />
                          </div>
                        </div>
                        <div className="sb-trigger-filter-summary">
                          This trigger fires when the current time is {triggerFilter.hours || 0} hour{(triggerFilter.hours || 0) === 1 ? '' : 's'} {triggerFilter.minutes || 0} minute{(triggerFilter.minutes || 0) === 1 ? '' : 's'} before the appointment starts.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {panelStage === 'runNode' && runNodeModal ? (
                  <div className="sb-action-config-form">
                    <div className="sb-action-config-header">
                      <div>
                        <h4 className="sb-action-config-title">Run Node</h4>
                        <div className="sb-run-node-panel-subtitle">{runNodeModal.nodeLabel}</div>
                      </div>
                      <button
                        type="button"
                        className="sb-action-config-close"
                        onClick={() => {
                          runNodeTargetRef.current = null;
                          setRunNodeModal(null);
                          setPanelStage(selectedNode?.actionConfig?._key ? 'actionConfig' : 'options');
                        }}
                        disabled={runNodeModal.isSubmitting}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="sb-run-node-panel-copy">
                      Enter values for the fields that still depend on scenario variables before this node can run.
                    </div>
                    <div className="sb-action-config-fields">
                      {runNodeModal.fields.map((field) => {
                        const value = runNodeModal.values[field.key] || '';
                        return (
                          <div key={field.key} className="sb-action-config-field">
                            <label className="sb-action-field-label">{field.label}</label>
                            {field.type === 'select' ? (
                              <select
                                className="sb-input-field sb-select-field"
                                value={value}
                                onChange={(e) => setRunNodeModal((prev) => ({ ...prev, values: { ...prev.values, [field.key]: e.target.value } }))}
                              >
                                <option value="">Select...</option>
                                {(field.options || []).map((opt) => {
                                  const optionValue = typeof opt === 'string' ? opt : opt?.value;
                                  const optionLabel = typeof opt === 'string' ? opt : (opt?.label || opt?.value);
                                  return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
                                })}
                              </select>
                            ) : field.type === 'textarea' || field.type === 'prompt_textarea' || field.type === 'first_message_textarea' ? (
                              <textarea
                                className="sb-input-field sb-run-node-panel-textarea"
                                value={value}
                                rows={field.type === 'prompt_textarea' ? 4 : 3}
                                onChange={(e) => setRunNodeModal((prev) => ({ ...prev, values: { ...prev.values, [field.key]: e.target.value } }))}
                              />
                            ) : (
                              <input
                                className="sb-input-field"
                                type={field.type === 'number' ? 'number' : 'text'}
                                value={value}
                                onChange={(e) => setRunNodeModal((prev) => ({ ...prev, values: { ...prev.values, [field.key]: e.target.value } }))}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {runNodeModal.error && (
                      <div className="sb-run-node-panel-error">{runNodeModal.error}</div>
                    )}
                    <div className="sb-run-node-panel-actions">
                      <button
                        type="button"
                        className="sb-schedule-cancel-btn"
                        onClick={() => {
                          runNodeTargetRef.current = null;
                          setRunNodeModal(null);
                          setPanelStage(selectedNode?.actionConfig?._key ? 'actionConfig' : 'options');
                        }}
                        disabled={runNodeModal.isSubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="sb-action-config-save sb-run-node-panel-run"
                        disabled={runNodeModal.isSubmitting}
                        onClick={async () => {
                          const { nodeId, values } = runNodeModal;
                          setRunNodeModal((prev) => ({ ...prev, isSubmitting: true, error: '' }));
                          try {
                            await executeRunnableNode(nodeId, values);
                            runNodeTargetRef.current = null;
                            setRunNodeModal(null);
                            setIsPanelVisible(false);
                            setPanelIntent(false);
                            setPanelStage('options');
                          } catch (err) {
                            setRunNodeModal((prev) => ({ ...prev, isSubmitting: false, error: err.message || 'Run failed' }));
                          }
                        }}
                      >
                        {runNodeModal.isSubmitting ? 'Running…' : 'Run'}
                      </button>
                    </div>
                  </div>
                ) : null}

                {panelStage === 'actionConfig' && actionConfig ? (
                  /* Staged Action Config Form */
                  <div className="sb-action-config-form">
                    {!(actionConfig._key === 'send_email' && !hasConnectedEmailIntegration) && (
                      <div className="sb-action-config-header">
                        <h4 className="sb-action-config-title">Configure Action</h4>
                        <button type="button" className="sb-action-config-close" onClick={() => { setPanelStage('options'); setActionConfig(null); }}>
                          <X size={14} />
                        </button>
                      </div>
                    )}
                    {actionConfig._key === 'send_email' && !hasConnectedEmailIntegration ? (
                      <div className="sb-panel-empty-state">
                        <div className="sb-panel-empty-kicker">Email integration required</div>
                        <div className="sb-panel-empty-title">Connect your email</div>
                        <p className="sb-panel-empty-copy">
                          Connect your email to trigger powerful automations and workflows.
                        </p>
                        <button
                          type="button"
                          className="sb-panel-empty-cta"
                          onClick={openIntegrationsModal}
                        >
                          Connect your Email
                        </button>
                      </div>
                    ) : (
                    <div className="sb-action-config-fields">
                      {actionConfig._fields.map((field) => {
                        const rawVal = actionConfig[field.key] || '';

                        return (
                          <div key={field.key} className="sb-action-config-field">
                            <label className="sb-action-field-label">
                              {field.key === 'target_table' && <Database size={11} style={{ marginRight: 4, opacity: 0.5, display: 'inline', verticalAlign: -1 }} />}
                              {field.label}
                            </label>
                            {field.type === 'select' ? (
                              <select
                                className="sb-input-field sb-select-field"
                                value={actionConfig[field.key] || ''}
                                onChange={e => setActionConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                              >
                                <option value="">Select...</option>
                                {(field.options || []).map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : field.type === 'prompt_textarea' ? (
                              /* Prompt textarea — no toggle, suggested smart actions above */
                              <div className="sb-prompt-textarea-wrap">
                                {/* Suggested smart actions row */}
                                <div className="sb-suggested-actions-row">
                                  {getSmartActions(findParentTriggerKey(selectedNodeId), currentActionKey).map(action => (
                                    <button
                                      key={action.key}
                                      type="button"
                                      className="sb-suggested-action-chip"
                                      onClick={() => handleInsertSmartAction(action, field.key)}
                                      title={action.description}
                                    >
                                      <Sparkles size={10} />
                                      {action.name}
                                    </button>
                                  ))}
                                </div>
                                <div style={{ position: 'relative' }}>
                                  <textarea
                                    className={`sb-input-field${varsPane.visible && hoveredTableColor && field.key === varsPane.fieldKey ? ' sb-input-glow' : ''}`}
                                    value={rawVal}
                                    onChange={e => setActionConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                                    onFocus={() => setVarsPane({ visible: true, fieldKey: field.key, fieldLabel: field.label, fieldType: field.type })}

                                    rows={4}
                                    style={{
                                      resize: 'none',
                                      ...(rawVal.includes('{{') || rawVal.includes('\x1E') ? { color: 'transparent' } : {}),
                                      ...(varsPane.visible && hoveredTableColor && field.key === varsPane.fieldKey ? {
                                        borderColor: hoveredTableColor,
                                        boxShadow: `0 0 0 1px ${hoveredTableColor}40`,
                                        '--hover-glow-color': `${hoveredTableColor}20`,
                                        '--hover-glow-color-strong': `${hoveredTableColor}40`,
                                      } : {}),
                                    }}
                                  />
                                  {/* Chip overlay */}
                                  {(rawVal.includes('{{') || rawVal.includes('\x1E')) && (
                                    <div
                                      className="sb-var-chip-overlay"
                                      style={{
                                        position: 'absolute', inset: 0, pointerEvents: 'none',
                                        display: 'flex', alignItems: 'flex-start', padding: '10px 14px',
                                        fontSize: 12, color: '#e4e4e7', overflow: 'hidden',
                                        fontFamily: 'Inter, sans-serif', lineHeight: '1.5', wordBreak: 'break-word',
                                        whiteSpace: 'pre-wrap',
                                      }}
                                      dangerouslySetInnerHTML={{ __html: renderFieldChipsHTML(rawVal.replace(/\n$/, '')) }}
                                    />
                                  )}
                                </div>
                              </div>
                            ) : field.type === 'first_message_textarea' ? (
                              /* First Message — hidden behind a toggle */
                              <div className="sb-first-message-wrap">
                                <label className="sb-first-message-toggle">
                                  <input
                                    type="checkbox"
                                    checked={!!actionConfig[`${field.key}_enabled`]}
                                    onChange={e => setActionConfig(prev => ({ ...prev, [`${field.key}_enabled`]: e.target.checked }))}
                                  />
                                  <span className="sb-first-message-toggle-label">{field.toggleLabel || 'Override First Message'}</span>
                                </label>
                                {actionConfig[`${field.key}_enabled`] && (
                                  <div style={{ marginTop: 8 }}>
                                    {/* Business variable buttons */}
                                    <div className="sb-suggested-actions-row" style={{ marginBottom: 6 }}>
                                      {['name', 'city', 'state'].map(fKey => (
                                        <button
                                          key={fKey}
                                          type="button"
                                          className="sb-suggested-action-chip sb-chip-grey"
                                          onClick={() => {
                                            const varRef = `{{businesses.${fKey}}}`;
                                            setActionConfig(prev => {
                                              const current = prev[field.key] || '';
                                              return { ...prev, [field.key]: current ? `${current} ${varRef}` : varRef };
                                            });
                                          }}
                                        >
                                          {{ name: 'Name', city: 'City', state: 'State' }[fKey]}
                                        </button>
                                      ))}
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                      <textarea
                                        className={`sb-input-field${varsPane.visible && hoveredTableColor && field.key === varsPane.fieldKey ? ' sb-input-glow' : ''}`}
                                        value={rawVal}
                                        onChange={e => setActionConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                                        onFocus={() => setVarsPane({ visible: true, fieldKey: field.key, fieldLabel: field.label, fieldType: field.type })}
                                        rows={3}
                                        style={{
                                          resize: 'none',
                                          ...(rawVal.includes('{{') ? { color: 'transparent' } : {}),
                                          ...(varsPane.visible && hoveredTableColor && field.key === varsPane.fieldKey ? {
                                            borderColor: hoveredTableColor,
                                            boxShadow: `0 0 0 1px ${hoveredTableColor}40`,
                                          } : {}),
                                        }}
                                      />
                                      {rawVal.includes('{{') && (
                                        <div
                                          className="sb-var-chip-overlay"
                                          style={{
                                            position: 'absolute', inset: 0, pointerEvents: 'none',
                                            display: 'flex', alignItems: 'flex-start', padding: '10px 14px',
                                            fontSize: 12, color: '#e4e4e7', overflow: 'hidden',
                                            fontFamily: 'Inter, sans-serif', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                          }}
                                          dangerouslySetInnerHTML={{ __html: renderVarChipsHTML(rawVal) }}
                                        />
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : field.type === 'textarea' ? (
                              <div style={{ position: 'relative' }}>
                                <textarea
                                  className={`sb-input-field${varsPane.visible && hoveredTableColor && field.key === varsPane.fieldKey ? ' sb-input-glow' : ''}`}
                                  value={rawVal}
                                  onChange={e => setActionConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                                  onFocus={() => setVarsPane({ visible: true, fieldKey: field.key, fieldLabel: field.label, fieldType: field.type })}
                                  rows={3}
                                  style={{
                                    resize: 'none',
                                    ...(rawVal.includes('{{') ? { color: 'transparent' } : {}),
                                    ...(varsPane.visible && hoveredTableColor && field.key === varsPane.fieldKey ? {
                                      borderColor: hoveredTableColor,
                                      boxShadow: `0 0 0 1px ${hoveredTableColor}40`,
                                      '--hover-glow-color': `${hoveredTableColor}20`,
                                      '--hover-glow-color-strong': `${hoveredTableColor}40`,
                                    } : {}),
                                  }}
                                />
                                {rawVal.includes('{{') && (
                                  <div
                                    className="sb-var-chip-overlay"
                                    style={{
                                      position: 'absolute', inset: 0, pointerEvents: 'none',
                                      display: 'flex', alignItems: 'flex-start', padding: '10px 14px',
                                      fontSize: 12, color: '#e4e4e7', overflow: 'hidden',
                                      fontFamily: 'Inter, sans-serif', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                    }}
                                    dangerouslySetInnerHTML={{ __html: renderVarChipsHTML(rawVal) }}
                                  />
                                )}
                              </div>
                            ) : (
                              <div style={{ position: 'relative' }}>
                                <input
                                  className={`sb-input-field${varsPane.visible && hoveredTableColor && field.key === varsPane.fieldKey ? ' sb-input-glow' : ''}`}
                                  type="text"
                                  value={rawVal}
                                  onChange={e => setActionConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                                  onFocus={() => setVarsPane({ visible: true, fieldKey: field.key, fieldLabel: field.label, fieldType: field.type })}
                                  style={{
                                    ...(rawVal.includes('{{') ? { color: 'transparent' } : {}),
                                    ...(varsPane.visible && hoveredTableColor && field.key === varsPane.fieldKey ? {
                                      borderColor: hoveredTableColor,
                                      boxShadow: `0 0 0 1px ${hoveredTableColor}40`,
                                      '--hover-glow-color': `${hoveredTableColor}20`,
                                      '--hover-glow-color-strong': `${hoveredTableColor}40`,
                                    } : {}),
                                  }}
                                />
                                {rawVal.includes('{{') && (
                                  <div
                                    className="sb-var-chip-overlay"
                                    style={{
                                      position: 'absolute', inset: 0, pointerEvents: 'none',
                                      display: 'flex', alignItems: 'center', padding: '0 10px',
                                      fontSize: 12, color: '#e4e4e7', overflow: 'hidden',
                                      whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif',
                                    }}
                                    dangerouslySetInnerHTML={{ __html: renderVarChipsHTML(rawVal) }}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {currentActionKey === 'call_customer' && (
                        <div
                          className="sb-action-config-field"
                          style={{
                            border: '1px solid rgba(56,189,248,0.16)',
                            background: 'rgba(56,189,248,0.06)',
                            borderRadius: 14,
                            padding: '12px 14px',
                          }}
                        >
                          <div
                            className="sb-action-field-label"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
                          >
                            <span>Receptionist Must Collect</span>
                            <span style={{ fontSize: 10, color: 'rgba(228,228,231,0.6)', fontWeight: 600 }}>
                              inferred from downstream `rec.*`
                            </span>
                          </div>
                          {inferredReceptionistRequirements.length > 0 ? (
                            <>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                                {inferredReceptionistRequirements.map((requirement) => (
                                  <span
                                    key={requirement.path}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      borderRadius: 999,
                                      padding: '5px 10px',
                                      background: 'rgba(56,189,248,0.14)',
                                      border: '1px solid rgba(56,189,248,0.2)',
                                      color: '#d9f4ff',
                                      fontSize: 11,
                                      fontWeight: 600,
                                    }}
                                  >
                                    <span>{requirement.label}</span>
                                    <span style={{ color: 'rgba(217,244,255,0.55)', fontWeight: 500 }}>
                                      {TABLE_LABELS[requirement.table] || requirement.table}
                                    </span>
                                  </span>
                                ))}
                              </div>
                              <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(228,228,231,0.64)', lineHeight: 1.5 }}>
                                The outbound prompt will automatically tell the receptionist these fields are mandatory before the call ends.
                              </div>
                            </>
                          ) : (
                            <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(228,228,231,0.64)', lineHeight: 1.5 }}>
                              No downstream receptionist variables were detected. This call will follow only the prompt unless a later node uses {'{{rec.people.field}}'} or {'{{rec.appointments.field}}'}.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    )}

                    {/* Table-specific fields — dynamic based on selected table */}
                    {actionConfig.target_table && (
                      <div className="sb-record-fields-section">
                        {/* Record ID — shown for update/delete actions */}
                        {(actionConfig._key === 'update_record' || actionConfig._key === 'delete_record') && (
                          <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <label className="sb-record-label" style={{ display: 'block' }}><Hash size={11} className="sb-record-label-icon" style={{ marginRight: 4, display: 'inline', verticalAlign: -1 }} />{getRecordIdLabelForTable(actionConfig.target_table)}</label>
                          <div style={{ position: 'relative' }}>
                            <input
                              className="sb-input-field"
                              type="text"
                              value={actionConfig.record_id || ''}
                              onChange={e => setActionConfig(prev => ({ ...prev, record_id: e.target.value }))}
                              onFocus={() => setVarsPane({ visible: true, fieldKey: 'record_id', fieldLabel: getRecordIdLabelForTable(actionConfig.target_table), fieldType: 'text' })}
                              style={{
                                ...(actionConfig.record_id?.includes('{{') ? { color: 'transparent' } : {}),
                                ...(varsPane.visible && hoveredTableColor && 'record_id' === varsPane.fieldKey ? {
                                  borderColor: hoveredTableColor,
                                  boxShadow: `0 0 0 1px ${hoveredTableColor}40`,
                                } : {}),
                              }}
                            />
                            {(actionConfig.record_id || '').includes('{{') && (
                              <div
                                className="sb-var-chip-overlay"
                                style={{
                                  position: 'absolute', inset: 0, pointerEvents: 'none',
                                  display: 'flex', alignItems: 'center', padding: '0 10px',
                                  fontSize: 12, color: '#e4e4e7', overflow: 'hidden',
                                  whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif',
                                }}
                                dangerouslySetInnerHTML={{ __html: renderVarChipsHTML(actionConfig.record_id) }}
                              />
                            )}
                          </div>
                          </div>
                        )}

                        {/* Field inputs — shown for create and update actions */}
                        {(actionConfig._key === 'update_record' || actionConfig._key === 'create_new_record') && (
                        <div className="sb-record-fields-grid">
                          {getRecordFieldsForTable(actionConfig.target_table).map((field) => {
                            const fieldKey = `field_${field.key}`;
                            const val = actionConfig[fieldKey] || '';
                            const isBooleanCustomField = field.custom && field.type === 'boolean';
                            return (
                              <div key={field.key} className="sb-record-field">
                                <label className="sb-record-label">{field.label}</label>
                                {isBooleanCustomField && (
                                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                    {['true', 'false'].map((option) => (
                                      <button
                                        key={option}
                                        type="button"
                                        onClick={() => setActionConfig(prev => ({ ...prev, [fieldKey]: option }))}
                                        style={{
                                          border: `1px solid ${val === option ? 'rgba(50,240,217,0.45)' : 'rgba(255,255,255,0.08)'}`,
                                          background: val === option ? 'rgba(50,240,217,0.12)' : 'rgba(255,255,255,0.03)',
                                          color: val === option ? '#32f0d9' : 'rgba(255,255,255,0.62)',
                                          borderRadius: 999,
                                          padding: '4px 9px',
                                          fontSize: 10,
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                          textTransform: 'capitalize',
                                        }}
                                      >
                                        {option}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <div style={{ position: 'relative' }}>
                                  <input
                                    className="sb-input-field"
                                    type="text"
                                    value={val}
                                    onChange={e => setActionConfig(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                                    onFocus={() => setVarsPane({ visible: true, fieldKey, fieldLabel: field.label, fieldType: field.type || 'text' })}
                                    placeholder={isBooleanCustomField ? 'true, false, or variable' : undefined}
                                    style={{
                                      ...(val.includes('{{') ? { color: 'transparent' } : {}),
                                      ...(varsPane.visible && hoveredTableColor && fieldKey === varsPane.fieldKey ? {
                                        borderColor: hoveredTableColor,
                                        boxShadow: `0 0 0 1px ${hoveredTableColor}40`,
                                      } : {}),
                                    }}
                                  />
                                  {val.includes('{{') && (
                                    <div
                                      className="sb-var-chip-overlay"
                                      style={{
                                        position: 'absolute', inset: 0, pointerEvents: 'none',
                                        display: 'flex', alignItems: 'center', padding: '0 10px',
                                        fontSize: 12, color: '#e4e4e7', overflow: 'hidden',
                                        whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif',
                                      }}
                                      dangerouslySetInnerHTML={{ __html: renderVarChipsHTML(val) }}
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        )}
                      </div>
                    )}

                    {/* Config auto-saves to node on every field change — no Save button needed */}
                  </div>
                ) : panelStage === 'appointmentConfig' ? (
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <h4 style={{ fontSize: 12, fontWeight: 800, color: '#fff', margin: 0 }}>Configure Appointment</h4>
                      <button type="button" onClick={() => { setPanelStage('options'); setAppointmentConfig({}); }}
                        style={{ background: 'none', border: 'none', color: '#52525b', cursor: 'pointer' }}>
                        <X size={14} />
                      </button>
                    </div>
                    <div style={{ fontSize: 10, color: '#71717a', marginBottom: 14, fontWeight: 600 }}>
                      {appointmentConfig.key === 'create_appointment' && 'Set up the appointment details.'}
                      {appointmentConfig.key === 'update_appointment' && 'Update appointment fields.'}
                      {appointmentConfig.key === 'delete_appointment' && 'Set cancellation criteria.'}
                    </div>
                    <div className="sb-record-fields-grid">
                      {/* Customer ID — for create and update_appointment (person_id field) */}
                      {(appointmentConfig.key === 'create_appointment' || appointmentConfig.key === 'update_appointment') && (
                        <div className="sb-record-field">
                          <label className="sb-record-label"><User size={11} style={{ marginRight: 4, opacity: 0.5, display: 'inline', verticalAlign: -1 }} />Customer ID</label>
                          <div style={{ position: 'relative' }}>
                            <input
                              className="sb-input-field"
                              type="text"
                              value={appointmentConfig.person_id || ''}
                              onChange={e => setAppointmentConfig({ ...appointmentConfig, person_id: e.target.value })}
                              onFocus={() => setVarsPane({ visible: true, fieldKey: 'person_id', fieldLabel: 'Customer ID', fieldType: 'person_id' })}
                              style={{
                                ...(appointmentConfig.person_id?.includes('{{') ? { color: 'transparent' } : {}),
                                ...(varsPane.visible && hoveredTableColor && varsPane.fieldKey === 'person_id' ? {
                                  borderColor: hoveredTableColor,
                                  boxShadow: `0 0 0 1px ${hoveredTableColor}40`,
                                } : {}),
                              }}
                            />
                            {(appointmentConfig.person_id || '').includes('{{') && (
                              <div className="sb-var-chip-overlay"
                                style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 12, color: '#e4e4e7', overflow: 'hidden', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' }}
                                dangerouslySetInnerHTML={{ __html: renderVarChipsHTML(appointmentConfig.person_id) }} />
                            )}
                          </div>
                        </div>
                      )}
                      {/* Service ID — for create and update_appointment */}
                      {(appointmentConfig.key === 'create_appointment' || appointmentConfig.key === 'update_appointment') && (
                        <div className="sb-record-field">
                          <label className="sb-record-label">Service ID</label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type="text"
                              className="sb-input-field"
                              value={appointmentConfig.service_id || ''}
                              onChange={e => setAppointmentConfig({ ...appointmentConfig, service_id: e.target.value })}
                              onFocus={() => setVarsPane({ visible: true, fieldKey: 'service_id', fieldLabel: 'Service ID', fieldType: 'service_id' })}
                              style={{
                                ...(appointmentConfig.service_id?.includes('{{') ? { color: 'transparent' } : {}),
                                ...(varsPane.visible && hoveredTableColor && varsPane.fieldKey === 'service_id' ? {
                                  borderColor: hoveredTableColor,
                                  boxShadow: `0 0 0 1px ${hoveredTableColor}40`,
                                } : {}),
                              }}
                            />
                            {(appointmentConfig.service_id || '').includes('{{') && (
                              <div
                                className="sb-var-chip-overlay"
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  pointerEvents: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '0 10px',
                                  fontSize: 12,
                                  color: '#e4e4e7',
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap',
                                  fontFamily: 'Inter, sans-serif',
                                }}
                                dangerouslySetInnerHTML={{ __html: renderVarChipsHTML(appointmentConfig.service_id) }}
                              />
                            )}
                          </div>
                        </div>
                      )}
                      {/* Appointment ID — for update/delete_appointment (first field) */}
                      {(appointmentConfig.key === 'update_appointment' || appointmentConfig.key === 'delete_appointment') && (
                        <div className="sb-record-field">
                          <label className="sb-record-label"><Hash size={11} style={{ marginRight: 4, opacity: 0.5, display: 'inline', verticalAlign: -1 }} />Appointment ID</label>
                          <div style={{ position: 'relative' }}>
                            <input
                              className="sb-input-field"
                              type="text"
                              value={appointmentConfig.appointment_id || ''}
                              onChange={e => setAppointmentConfig({ ...appointmentConfig, appointment_id: e.target.value })}
                              onFocus={() => setVarsPane({ visible: true, fieldKey: 'appointment_id', fieldLabel: 'Appointment ID', fieldType: 'text' })}
                              style={{
                                ...(appointmentConfig.appointment_id?.includes('{{') ? { color: 'transparent' } : {}),
                                ...(varsPane.visible && hoveredTableColor && varsPane.fieldKey === 'appointment_id' ? {
                                  borderColor: hoveredTableColor,
                                  boxShadow: `0 0 0 1px ${hoveredTableColor}40`,
                                } : {}),
                              }}
                            />
                            {(appointmentConfig.appointment_id || '').includes('{{') && (
                              <div className="sb-var-chip-overlay"
                                style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 12, color: '#e4e4e7', overflow: 'hidden', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' }}
                                dangerouslySetInnerHTML={{ __html: renderVarChipsHTML(appointmentConfig.appointment_id) }} />
                            )}
                          </div>
                        </div>
                      )}
                      {/* Status — for update_appointment (second field) */}
                      {appointmentConfig.key === 'update_appointment' && (
                        <div className="sb-record-field">
                          <label className="sb-record-label">Status</label>
                          <select className="sb-input-field sb-select-field" value={appointmentConfig.status || ''}
                            onChange={e => setAppointmentConfig({ ...appointmentConfig, status: e.target.value })}>
                            <option value="">Select...</option>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      )}
                      {/* Date — for create and update_appointment */}
                      {(appointmentConfig.key === 'create_appointment' || appointmentConfig.key === 'update_appointment') && (
                        <div className="sb-record-field">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                            <label className="sb-record-label" style={{ marginBottom: 0 }}>Date</label>
                            <button
                              type="button"
                              onClick={() => setAppointmentConfig({ ...appointmentConfig, date_input_mode: appointmentDateInputMode === 'text' ? 'picker' : 'text' })}
                              style={{ ...sbModeToggleStyle, ...(appointmentDateInputMode === 'text' ? sbModeToggleActiveStyle : {}) }}
                            >
                          {appointmentDateInputMode === 'picker' ? 'Picker' : 'Text'}
                            </button>
                          </div>
                          <div style={{ position: 'relative' }}>
                            {appointmentDateInputMode === 'picker' ? (
                              <input
                                type="date"
                                className="sb-input-field"
                                value={appointmentConfig.date || ''}
                                onChange={e => setAppointmentConfig({ ...appointmentConfig, date: e.target.value })}
                                style={{ colorScheme: 'dark' }}
                              />
                            ) : (
                              <input
                                type="text"
                                className="sb-input-field"
                                value={appointmentConfig.date || ''}
                                onChange={e => setAppointmentConfig({ ...appointmentConfig, date: e.target.value })}
                                onFocus={() => setVarsPane({ visible: true, fieldKey: 'date', fieldLabel: 'Date', fieldType: 'text' })}
                                style={{
                                  ...(String(appointmentConfig.date || '').includes('{{') ? { color: 'transparent' } : {}),
                                }}
                              />
                            )}
                            {appointmentConfig.date_input_mode !== 'picker' && (appointmentConfig.date || '').includes('{{') && (
                              <div
                                className="sb-var-chip-overlay"
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  pointerEvents: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '0 10px',
                                  fontSize: 12,
                                  color: '#e4e4e7',
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap',
                                  fontFamily: 'Inter, sans-serif',
                                }}
                                dangerouslySetInnerHTML={{ __html: renderVarChipsHTML(appointmentConfig.date) }}
                              />
                            )}
                          </div>
                        </div>
                      )}
                      {/* Time — for create and update_appointment */}
                      {(appointmentConfig.key === 'create_appointment' || appointmentConfig.key === 'update_appointment') && (
                        <div className="sb-record-field">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                            <label className="sb-record-label" style={{ marginBottom: 0 }}>Time</label>
                            <button
                              type="button"
                              onClick={() => setAppointmentConfig({ ...appointmentConfig, time_input_mode: appointmentTimeInputMode === 'text' ? 'picker' : 'text' })}
                              style={{ ...sbModeToggleStyle, ...(appointmentTimeInputMode === 'text' ? sbModeToggleActiveStyle : {}) }}
                            >
                              {appointmentTimeInputMode === 'picker' ? 'Picker' : 'Text'}
                            </button>
                          </div>
                          <div style={{ position: 'relative' }}>
                            {appointmentTimeInputMode === 'picker' ? (
                              <input
                                type="time"
                                className="sb-input-field"
                                value={appointmentConfig.time || ''}
                                onChange={e => setAppointmentConfig({ ...appointmentConfig, time: e.target.value })}
                                style={{ colorScheme: 'dark' }}
                              />
                            ) : (
                              <input
                                type="text"
                                className="sb-input-field"
                                value={appointmentConfig.time || ''}
                                onChange={e => setAppointmentConfig({ ...appointmentConfig, time: e.target.value })}
                                onFocus={() => setVarsPane({ visible: true, fieldKey: 'time', fieldLabel: 'Time', fieldType: 'text' })}
                                style={{
                                  ...(String(appointmentConfig.time || '').includes('{{') ? { color: 'transparent' } : {}),
                                }}
                              />
                            )}
                            {appointmentConfig.time_input_mode !== 'picker' && (appointmentConfig.time || '').includes('{{') && (
                              <div
                                className="sb-var-chip-overlay"
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  pointerEvents: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '0 10px',
                                  fontSize: 12,
                                  color: '#e4e4e7',
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap',
                                  fontFamily: 'Inter, sans-serif',
                                }}
                                dangerouslySetInnerHTML={{ __html: renderVarChipsHTML(appointmentConfig.time) }}
                              />
                            )}
                          </div>
                        </div>
                      )}
                      {/* Duration */}
                      {(appointmentConfig.key === 'create_appointment' || appointmentConfig.key === 'update_appointment') && (
                        <div className="sb-record-field">
                          <label className="sb-record-label">Duration</label>
                          {(() => {
                            const durationValue = appointmentConfig.duration == null ? '' : String(appointmentConfig.duration);
                            return (
                          <div style={{ position: 'relative' }}>
                            <input
                              type="text"
                              className="sb-input-field"
                              value={durationValue}
                              onChange={e => setAppointmentConfig({ ...appointmentConfig, duration: e.target.value })}
                              onFocus={() => setVarsPane({ visible: true, fieldKey: 'duration', fieldLabel: 'Duration', fieldType: 'text' })}
                              style={{
                                ...(durationValue.includes('{{') ? { color: 'transparent' } : {}),
                              }}
                            />
                            {durationValue.includes('{{') && (
                              <div
                                className="sb-var-chip-overlay"
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  pointerEvents: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '0 10px',
                                  fontSize: 12,
                                  color: '#e4e4e7',
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap',
                                  fontFamily: 'Inter, sans-serif',
                                }}
                                dangerouslySetInnerHTML={{ __html: renderVarChipsHTML(durationValue) }}
                              />
                            )}
                          </div>
                            );
                          })()}
                        </div>
                      )}
                      {/* Notes */}
                      {(appointmentConfig.key === 'create_appointment' || appointmentConfig.key === 'update_appointment') && (
                        <div className="sb-record-field">
                          <label className="sb-record-label">Notes</label>
                          <div style={{ position: 'relative' }}>
                            <textarea
                              className="sb-input-field"
                              value={appointmentConfig.notes || ''}
                              onChange={e => setAppointmentConfig({ ...appointmentConfig, notes: e.target.value })}
                              onFocus={() => setVarsPane({ visible: true, fieldKey: 'notes', fieldLabel: 'Notes', fieldType: 'textarea' })}
                              rows={2}
                              style={{
                                resize: 'none',
                                ...(appointmentConfig.notes?.includes('{{') ? { color: 'transparent' } : {}),
                                ...(varsPane.visible && hoveredTableColor && varsPane.fieldKey === 'notes' ? {
                                  borderColor: hoveredTableColor,
                                  boxShadow: `0 0 0 1px ${hoveredTableColor}40`,
                                } : {}),
                              }}
                            />
                            {(appointmentConfig.notes || '').includes('{{') && (
                              <div className="sb-var-chip-overlay"
                                style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'flex-start', padding: '10px 14px', fontSize: 12, color: '#e4e4e7', overflow: 'hidden', fontFamily: 'Inter, sans-serif', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                dangerouslySetInnerHTML={{ __html: renderVarChipsHTML(appointmentConfig.notes) }} />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Config auto-saves to node on every field change — no Save button needed */}
                  </div>
                ) : panelStage === 'scheduleConfig' ? (
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <h4 style={{ fontSize: 12, fontWeight: 800, color: '#fff', margin: 0 }}>Schedule</h4>
                      <button type="button" onClick={() => { setPanelStage('options'); setScheduleConfig({}); }}
                        style={{ background: 'none', border: 'none', color: '#52525b', cursor: 'pointer' }}>
                        <X size={14} />
                      </button>
                    </div>
                    <div style={{ fontSize: 10, color: '#71717a', marginBottom: 14, fontWeight: 600 }}>
                      {scheduleConfig.key === 'specific_time' && 'Set a specific date and time to trigger this flow once.'}
                      {scheduleConfig.key === 'recurring_daily' && 'This flow will run every day at the specified time.'}
                      {scheduleConfig.key === 'recurring_weekly' && 'Select days of the week and a time to run this flow.'}
                      {scheduleConfig.key === 'appointment_reminder' && 'Trigger this flow a set number of minutes before an appointment.'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Date picker for specific_time */}
                      {scheduleConfig.key === 'specific_time' && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                            <label style={{ ...sbLabelStyle, marginBottom: 0 }}>Date</label>
                            <button
                              type="button"
                              onClick={() => setScheduleConfig({ ...scheduleConfig, date_input_mode: scheduleDateInputMode === 'text' ? 'picker' : 'text' })}
                              style={{ ...sbModeToggleStyle, ...(scheduleDateInputMode === 'text' ? sbModeToggleActiveStyle : {}) }}
                            >
                              {scheduleDateInputMode === 'picker' ? 'Picker' : 'Text'}
                            </button>
                          </div>
                          {scheduleDateInputMode === 'picker' ? (
                            <input type="date" value={scheduleConfig.date || ''}
                              onChange={e => setScheduleConfig({ ...scheduleConfig, date: e.target.value })}
                              style={{ ...sbInputStyle, colorScheme: 'dark' }} />
                          ) : (
                            <div style={{ position: 'relative' }}>
                              <input
                                type="text"
                                value={scheduleConfig.date || ''}
                                onChange={e => setScheduleConfig({ ...scheduleConfig, date: e.target.value })}
                                onFocus={() => setVarsPane({ visible: true, fieldKey: 'date', fieldLabel: 'Date', fieldType: 'text' })}
                                style={sbInputStyle}
                              />
                              {(scheduleConfig.date || '').includes('{{') && (
                                <div
                                  className="sb-var-chip-overlay"
                                  style={{
                                  position: 'absolute',
                                  inset: 0,
                                  pointerEvents: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '0 10px',
                                  fontSize: 12,
                                  color: '#e4e4e7',
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap',
                                  fontFamily: 'Inter, sans-serif',
                                  }}
                                  dangerouslySetInnerHTML={{ __html: renderVarChipsHTML(scheduleConfig.date) }}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Time picker for all except appointment_reminder */}
                      {scheduleConfig.key !== 'appointment_reminder' && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                            <label style={{ ...sbLabelStyle, marginBottom: 0 }}>Time</label>
                            <button
                              type="button"
                              onClick={() => setScheduleConfig({ ...scheduleConfig, time_input_mode: scheduleTimeInputMode === 'text' ? 'picker' : 'text' })}
                              style={{ ...sbModeToggleStyle, ...(scheduleTimeInputMode === 'text' ? sbModeToggleActiveStyle : {}) }}
                            >
                              {scheduleTimeInputMode === 'picker' ? 'Picker' : 'Text'}
                            </button>
                          </div>
                          {scheduleTimeInputMode === 'picker' ? (
                            <input type="time" value={scheduleConfig.time || '09:00'}
                              onChange={e => setScheduleConfig({ ...scheduleConfig, time: e.target.value })}
                              style={{ ...sbInputStyle, colorScheme: 'dark' }} />
                          ) : (
                            <div style={{ position: 'relative' }}>
                              <input
                                type="text"
                                value={scheduleConfig.time || '09:00'}
                                onChange={e => setScheduleConfig({ ...scheduleConfig, time: e.target.value })}
                                onFocus={() => setVarsPane({ visible: true, fieldKey: 'time', fieldLabel: 'Time', fieldType: 'text' })}
                                style={sbInputStyle}
                              />
                              {(scheduleConfig.time || '').includes('{{') && (
                                <div
                                  className="sb-var-chip-overlay"
                                  style={{
                                    position: 'absolute',
                                    inset: 0,
                                  pointerEvents: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '0 10px',
                                  fontSize: 12,
                                  color: '#e4e4e7',
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap',
                                  fontFamily: 'Inter, sans-serif',
                                }}
                                dangerouslySetInnerHTML={{ __html: renderVarChipsHTML(scheduleConfig.time) }}
                              />
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Timezone */}
                      {scheduleConfig.key !== 'appointment_reminder' && (
                        <div>
                          <label style={sbLabelStyle}>Timezone</label>
                          <select value={scheduleConfig.timezone || 'America/New_York'}
                            onChange={e => setScheduleConfig({ ...scheduleConfig, timezone: e.target.value })}
                            style={sbInputStyle}>
                            <option value="America/New_York">Eastern Time</option>
                            <option value="America/Chicago">Central Time</option>
                            <option value="America/Denver">Mountain Time</option>
                            <option value="America/Los_Angeles">Pacific Time</option>
                          </select>
                        </div>
                      )}
                      {/* Days of week for recurring_weekly */}
                      {scheduleConfig.key === 'recurring_weekly' && (
                        <div>
                          <label style={sbLabelStyle}>Days</label>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                              const isSelected = (scheduleConfig.days_of_week || []).includes(day);
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => {
                                    const current = scheduleConfig.days_of_week || [];
                                    const updated = isSelected
                                      ? current.filter(d => d !== day)
                                      : [...current, day];
                                    setScheduleConfig({ ...scheduleConfig, days_of_week: updated });
                                  }}
                                  style={{
                                    padding: '6px 10px',
                                    borderRadius: 6,
                                    border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                                    background: isSelected ? 'rgba(56,189,248,0.15)' : 'rgba(0,0,0,0.4)',
                                    color: isSelected ? '#38bdf8' : '#71717a',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                  }}
                                >
                                  {day}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {/* Minutes before for appointment_reminder */}
                      {scheduleConfig.key === 'appointment_reminder' && (
                        <div>
                          <label style={sbLabelStyle}>Minutes Before Appointment</label>
                          <select value={scheduleConfig.reminder_minutes || 30}
                            onChange={e => setScheduleConfig({ ...scheduleConfig, reminder_minutes: Number(e.target.value) })}
                            style={sbInputStyle}>
                            <option value={15}>15 minutes</option>
                            <option value={30}>30 minutes</option>
                            <option value={60}>1 hour</option>
                            <option value={120}>2 hours</option>
                            <option value={1440}>1 day</option>
                          </select>
                        </div>
                      )}
                    </div>
                    {/* Config auto-saves to node on every field change — no Save button needed */}
                  </div>
                ) : panelStage === 'options' ? (
                  filteredOptions.length === 0 ? (
                    null
                  ) : (
                    filteredOptions.map((option, index) => {
                      const hasChildren = option.sub_options?.length > 0;
                      const OptionIcon = option.icon || categoryMeta.icon;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          className="sb-panel-action-card"
                          style={{ animationDelay: `${index * 0.04}s` }}
                          onClick={() => handleOptionClick(option)}
                        >
                          <div
                            className="sb-panel-action-icon"
                            style={{ backgroundColor: `${categoryMeta.accent}15`, color: categoryMeta.accent }}
                          >
                            <OptionIcon size={20} />
                          </div>
                          <div className="sb-panel-action-info">
                            <strong className="sb-panel-action-label">{option.option}</strong>
                            <span className="sb-panel-action-detail">{option.description}</span>
                          </div>
                          {hasChildren && <ChevronRight size={18} style={{ opacity: 0.4, marginLeft: 'auto' }} />}
                        </button>
                      );
                    })
                  )
                ) : activeOption?.key === 'email' && !hasConnectedEmailIntegration ? (
                  <div className="sb-panel-empty-state">
                    <div className="sb-panel-empty-kicker">Email integration required</div>
                    <div className="sb-panel-empty-title">Connect your email</div>
                    <p className="sb-panel-empty-copy">
                      Once Gmail is connected, this panel will show the available email actions.
                    </p>
                    <button
                      type="button"
                      className="sb-panel-empty-cta"
                      onClick={openIntegrationsModal}
                    >
                      Open Integrations
                    </button>
                  </div>
                ) : filteredSubOptions.length === 0 ? (
                  null
                ) : (
                  filteredSubOptions.map((subOption, index) => {
                    const SubIcon = activeOption?.icon || categoryMeta.icon;
                    return (
                      <button
                        key={subOption.key}
                        type="button"
                        className="sb-panel-action-card"
                        style={{ animationDelay: `${index * 0.04}s` }}
                        onClick={() => handleSubOptionClick(subOption)}
                      >
                        <div
                        className="sb-panel-action-icon"
                        style={{ backgroundColor: `${categoryMeta.accent}15`, color: categoryMeta.accent }}
                      >
                        <SubIcon size={20} />
                      </div>
                      <div className="sb-panel-action-info">
                        <strong className="sb-panel-action-label">{subOption.name}</strong>
                        <span className="sb-panel-action-detail">{subOption.description}</span>
                      </div>
                      <ChevronRight size={18} style={{ opacity: 0.4, marginLeft: 'auto' }} />
                    </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Variables pane — rendered outside selection panel (overflow: hidden clips it otherwise) */}
        {['actionConfig', 'appointmentConfig', 'scheduleConfig'].includes(panelStage) && (
          <VariablesPane
            visible={varsPane.visible}
            targetFieldKey={varsPane.fieldKey}
            fieldLabel={varsPane.fieldLabel}
            onInsertVariable={handleInsertVariable}
            onInsertSmartAction={handleInsertSmartAction}
            smartActions={getSmartActions(findParentTriggerKey(selectedNodeId), currentActionKey)}
            onTableHover={(color) => setHoveredTableColor(color)}
            onClose={() => { setVarsPane({ visible: false, fieldKey: '', fieldLabel: '', fieldType: 'text' }); setHoveredTableColor(''); }}
            nodes={nodes}
            edges={edges}
            currentNodeId={selectedNodeId}
            style={{
              position: 'absolute',
              top: panelStyle.top,
              left: Math.max(10, (panelStyle.left || 0) - 272 - 8),
              height: 640,
            }}
          />
        )}

        {logicPanel && (
          <>
            <VariablesPane
              visible={true}
              currentNodeId={(() => {
                const edge = edges.find(e => e.id === logicPanel.edgeId);
                return edge?.from || currentNodeId;
              })()}
              targetFieldKey={activeConditionField?.ruleId || ''}
              fieldLabel="Condition"
              onInsertVariable={(varRef, label, color) => {
                // If a condition field has focus, insert the variable at cursor position
                if (activeConditionField) {
                  const { ruleId, field } = activeConditionField;
                  const inputEl = activeConditionInputRef.current;
                  const currentRule = edgeRules.find(r => r.id === ruleId);
                  const currentVal = (field === 'variable' ? currentRule?.variable : currentRule?.value) || '';
                  const pos = inputEl?.selectionStart ?? currentVal.length;
                  const newVal = currentVal.slice(0, pos) + varRef + currentVal.slice(pos);
                  updateEdgeRule(ruleId, field, newVal);
                  return;
                }

                // Fallback: insert at end of last rule's variable field
                if (edgeRules.length === 0) {
                  addEdgeRule('and');
                }
                const lastRule = edgeRules[edgeRules.length - 1];
                if (lastRule) {
                  updateEdgeRule(lastRule.id, 'variable', varRef);
                }
              }}
              onInsertSmartAction={null}
              smartActions={[]}
              onTableHover={(color) => setHoveredTableColor(color)}
              onClose={() => setVarsPane({ visible: false, fieldKey: '', fieldLabel: '', fieldType: 'text' })}
              nodes={nodes}
              edges={edges}
              currentNodeId={(() => {
                const edge = edges.find(e => e.id === logicPanel.edgeId);
                return edge?.from || selectedNodeId;
              })()}
              style={{
                position: 'absolute',
                top: logicPanelDragPos?.top ?? logicPanel.top,
                left: Math.max(10, (logicPanelDragPos?.left ?? (logicPanel.left || 0)) - 272 - 8),
                height: 640,
              }}
            />
            <AetherEdgeLogic
              onPositionChange={(top, left) => setLogicPanelDragPos({ top, left })}
              style={{ top: logicPanel.top, left: Math.max(10, (logicPanel.left || 0) - 272 - 8) + 272 + 8 }}
              conditions={edgeRules}
              onAddRule={() => addEdgeRule('and')}
              onAddOrRule={() => addEdgeRule('or')}
              onRemoveRule={removeEdgeRule}
              onUpdateRule={updateEdgeRule}
              onClose={closeLogicPanel}
              onFieldFocus={(ruleId, field, inputEl) => {
                setActiveConditionField({ ruleId, field });
                activeConditionInputRef.current = inputEl;
              }}
              contextType={logicContextType}
              availableVariables={logicAvailableVars}
              fallbackAction={logicFallbackAction}
              onFallbackChange={(val) => setLogicFallbackAction(val)}
              isFallback={logicIsFallback}
              onToggleFallback={(val) => setLogicIsFallback(val)}
            />
          </>
        )}
        
        {/* Back button for builder view */}
        <div className="sb-builder-topbar">
          <div className="sb-builder-topbar-group">
            <button 
              className="back-to-list-btn" 
              onClick={handleBackToList}
            >
              <ChevronLeft size={16} />
              Back to Scenarios
            </button>
          </div>
          <button 
            className="save-scenario-btn" 
            onClick={handleSaveScenario}
          >
            <Check size={16} />
            {currentScenario ? 'Save' : 'Save Scenario'}
          </button>
        </div>
        
        {/* Bottom Toolbar — shown after intro node is configured */}
        {nodes[0]?.configured && (
          <div className="sb-bottom-toolbar">
            <div className="sb-toolbar-inner">
            {/* Power toggle */}
            <div className="sb-toolbar-toggle-group">
              <button
                type="button"
                className={`sb-toolbar-switch ${scenarioIsActive ? 'active' : ''}`}
                onClick={handleToggleRecurring}
              >
                <div className="sb-toolbar-switch-thumb" />
              </button>
            </div>
            
            {/* Schedule — greyed out when trigger is not "No Trigger" */}
            <button
              type="button"
              className={`sb-toolbar-schedule ${!noTriggerActive ? 'sb-toolbar-schedule-disabled' : ''}`}
              onClick={() => noTriggerActive && setShowScheduleModal(true)}
              disabled={!noTriggerActive}
            >
              <Clock size={10} />
              <span>{formatScheduleDisplay(recurringSchedule)}</span>
            </button>
            
            {/* Notes */}
            <button
              type="button"
              className="sb-toolbar-icon-btn"
              onClick={() => setShowNotesModal(true)}
              title="Notes"
            >
              <Pencil size={13} />
            </button>

            {/* JSON viewer */}
            <button
              type="button"
              className="sb-toolbar-icon-btn"
              onClick={() => setShowJsonModal(true)}
              title="View JSON"
            >
              <Code size={13} />
            </button>

          </div>
        </div>
        )}

        {showIntegrationsModal && (
          <div className="sb-integrations-overlay" onClick={() => setShowIntegrationsModal(false)}>
            <div className="sb-integrations-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sb-integrations-sidebar">
                <div className="sb-integrations-sidebar-inner">
                  <div className="sb-integrations-kicker">Email Integrations</div>
                  <h2 className="sb-integrations-title">Set up email for scenarios.</h2>
                  <p className="sb-integrations-lead">
                    Gmail is the first supported provider. We’ll keep the setup explicit so you always know what’s configured, what still needs approval, and what scenarios will be able to do next.
                  </p>
                </div>
              </div>

              <div className="sb-integrations-main">
                <div className="sb-integrations-main-header">
                  <div>
                    <div className="sb-integrations-eyebrow">{integrationMeta.eyebrow}</div>
                    <h3 className="sb-integrations-panel-title">{integrationMeta.title}</h3>
                    {integrationMeta.helper ? (
                      <p className="sb-integrations-panel-helper">{integrationMeta.helper}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="sb-integrations-close"
                    onClick={() => setShowIntegrationsModal(false)}
                  >
                    <X size={16} />
                  </button>
                </div>

                {integrationStep === 0 ? (
                  <div className="sb-integrations-provider-grid">
                    {INTEGRATION_PROVIDERS.map((provider) => {
                      const providerState = emailIntegrations[provider.key] || DEFAULT_EMAIL_INTEGRATIONS[provider.key];
                      const isSelected = selectedIntegrationProvider === provider.key;
                      return (
                        <button
                          key={provider.key}
                          type="button"
                          className={`sb-integrations-provider-card ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => setSelectedIntegrationProvider(provider.key)}
                        >
                          <div className="sb-integrations-provider-top">
                            <div className="sb-integrations-provider-brand">
                              <img src={provider.icon} alt={provider.name} className="sb-integrations-provider-logo" />
                              <div>
                                <div className="sb-integrations-provider-name">{provider.name}</div>
                                <div className="sb-integrations-provider-subtitle">{provider.subtitle}</div>
                              </div>
                            </div>
                            {(providerState.selected || providerState.status === 'connected') && (
                              <span className="sb-integrations-provider-check">
                                <Check size={12} />
                              </span>
                            )}
                          </div>
                          <p className="sb-integrations-provider-body">{provider.description}</p>
                          <div className="sb-integrations-provider-meta">
                            <span>{providerState.status === 'connected' ? 'Connected' : 'Available now'}</span>
                            {providerState.connectedEmail && <span>{providerState.connectedEmail}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="sb-integrations-review">
                    <div className="sb-integrations-provider-identity">
                      <div className="sb-integrations-provider-brand">
                        <img src={selectedProviderConfig?.icon} alt={selectedProviderConfig?.name} className="sb-integrations-provider-logo" />
                        <div>
                          <div className="sb-integrations-provider-name">{selectedProviderConfig?.name}</div>
                          <div className="sb-integrations-provider-subtitle">{selectedProviderConfig?.subtitle}</div>
                        </div>
                      </div>
                      <span className={`sb-integrations-status-pill ${selectedIntegration.status === 'connected' ? 'is-active' : ''}`}>
                        {selectedIntegration.status === 'connected'
                          ? 'Connected'
                          : selectedIntegration.selected
                            ? 'Selected'
                            : 'Not connected'}
                      </span>
                    </div>

                    <div className="sb-integrations-summary sb-integrations-summary--minimal">
                      <div className="sb-integrations-summary-row">
                        <span>Provider</span>
                        <strong>{selectedProviderConfig?.name || 'Gmail'}</strong>
                      </div>
                      <div className="sb-integrations-summary-row">
                        <span>Status</span>
                        <strong>{selectedIntegration.status === 'connected' ? 'Connected for scenario email' : 'Selected for scenario email'}</strong>
                      </div>
                      <div className="sb-integrations-summary-row">
                        <span>Mailbox</span>
                        <strong>{selectedIntegration.connectedEmail || session?.user?.email || 'Will use the connected Google mailbox'}</strong>
                      </div>
                    </div>

                    {integrationPopupPending && (
                      <div className="sb-integrations-inline-note">Waiting for Google to finish connecting…</div>
                    )}
                    {integrationError && (
                      <div className="sb-integrations-error">{integrationError}</div>
                    )}
                  </div>
                )}

                <div className="sb-integrations-actions">
                  {integrationStep > 0 ? (
                    <button
                      type="button"
                      className="sb-integrations-secondary"
                      onClick={() => setIntegrationStep((prev) => Math.max(0, prev - 1))}
                    >
                      <ChevronLeft size={14} />
                      Back
                    </button>
                  ) : <span />}

                  <div className="sb-integrations-action-group">
                    <button
                      type="button"
                      className="sb-integrations-secondary"
                      onClick={() => setShowIntegrationsModal(false)}
                    >
                      {integrationStep === 1 && selectedIntegration.status === 'connected'
                        ? 'Close'
                        : integrationStep === 1
                          ? 'Done'
                          : 'Not now'}
                    </button>

                    {integrationStep === 0 && (
                      <button
                        type="button"
                        className="sb-integrations-primary"
                        onClick={() => selectIntegrationProvider(selectedIntegrationProvider)}
                        disabled={integrationSaving || integrationLoading}
                      >
                        Continue
                        <ChevronRight size={15} />
                      </button>
                    )}

                    {integrationStep === 1 && (
                      <>
                        {selectedIntegration.status === 'connected' ? (
                          <button
                            type="button"
                            className="sb-integrations-secondary"
                            onClick={disconnectSelectedProvider}
                            disabled={integrationSaving || integrationPopupPending}
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="sb-integrations-primary"
                            onClick={connectSelectedProvider}
                            disabled={integrationSaving || integrationPopupPending}
                          >
                            Connect
                            <ChevronRight size={15} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Modal */}
        {showScheduleModal && (
          <div className="sb-schedule-modal-overlay" onClick={() => setShowScheduleModal(false)}>
            <div className="sb-schedule-modal" onClick={e => e.stopPropagation()}>
              <div className="sb-schedule-modal-header">
                <div className="sb-schedule-modal-title">
                  <Clock size={11} />
                  Schedule
                </div>
                <button type="button" className="sb-schedule-modal-close" onClick={() => setShowScheduleModal(false)}>
                  <X size={14} />
                </button>
              </div>
              
              <div className="sb-schedule-modal-body">
                {/* Frequency dropdown */}
                <div className="sb-schedule-field">
                  <label className="sb-schedule-label">Frequency</label>
                  <select
                    className="sb-input-field sb-select-field"
                    value={recurringSchedule.frequency}
                    onChange={e => setRecurringSchedule(prev => ({ ...prev, frequency: e.target.value }))}
                  >
                    <option value="once">Run Once</option>
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                
                {/* Scheduling options — hidden for "Run Once" */}
                {recurringSchedule.frequency !== 'once' && (
                <>
                {/* Interval */}
                <div className="sb-schedule-field">
                  <label className="sb-schedule-label">
                    Every
                  </label>
                  <div className="sb-schedule-input-row">
                    <input
                      className="sb-input-field sb-schedule-num-input"
                      type="number"
                      min={1}
                      max={recurringSchedule.frequency === 'hourly' ? 24 : recurringSchedule.frequency === 'daily' ? 365 : 52}
                      value={recurringSchedule.interval}
                      onChange={e => setRecurringSchedule(prev => ({ ...prev, interval: Math.max(1, parseInt(e.target.value) || 1) }))}
                    />
                    <span className="sb-schedule-unit">
                      {recurringSchedule.frequency === 'hourly' ? 'hours' :
                       recurringSchedule.frequency === 'daily' ? 'days' :
                       recurringSchedule.frequency === 'weekly' ? 'weeks' :
                       'months'}
                    </span>
                  </div>
                </div>
                
                {/* Time picker (not for hourly) */}
                {recurringSchedule.frequency !== 'hourly' && (
                  <div className="sb-schedule-field">
                    <label className="sb-schedule-label">Time</label>
                    <input
                      className="sb-input-field"
                      type="time"
                      value={recurringSchedule.time}
                      onChange={e => setRecurringSchedule(prev => ({ ...prev, time: e.target.value }))}
                    />
                  </div>
                )}
                
                {/* Days of week (weekly only) */}
                {recurringSchedule.frequency === 'weekly' && (
                  <div className="sb-schedule-field">
                    <label className="sb-schedule-label">Days</label>
                    <div className="sb-schedule-days">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                        const isSelected = (recurringSchedule.daysOfWeek || []).includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            className={`sb-schedule-day-btn ${isSelected ? 'active' : ''}`}
                            onClick={() => {
                              setRecurringSchedule(prev => {
                                const current = prev.daysOfWeek || [];
                                const updated = isSelected ? current.filter(d => d !== day) : [...current, day];
                                return { ...prev, daysOfWeek: updated };
                              });
                            }}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                </>
                )}
              </div>
              
              <div className="sb-schedule-modal-footer">
                <button className="sb-schedule-cancel-btn" onClick={() => setShowScheduleModal(false)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Notes Modal */}
        {showNotesModal && (
          <div className="sb-notes-modal-overlay" onClick={() => setShowNotesModal(false)}>
            <div className="sb-notes-modal" onClick={e => e.stopPropagation()}>
              <div className="sb-notes-modal-header">
                <div className="sb-notes-modal-title">
                  <Pencil size={14} />
                  Notes
                </div>
                <button type="button" className="sb-notes-modal-close" onClick={() => setShowNotesModal(false)}>
                  <X size={14} />
                </button>
              </div>
              
              <div className="sb-notes-modal-body">
                <textarea
                  className="sb-input-field sb-notes-textarea"
                  value={scenarioNotes}
                  onChange={e => setScenarioNotes(e.target.value)}
                  rows={6}
                />
              </div>
              
              <div className="sb-notes-modal-footer">
                <button className="sb-schedule-cancel-btn" onClick={() => setShowNotesModal(false)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
        {showJsonModal && (
          <div className="sb-json-modal-overlay" onClick={() => setShowJsonModal(false)}>
            <div className="sb-json-modal" onClick={e => e.stopPropagation()}>
              <div className="sb-json-modal-header">
                <h3 className="sb-json-modal-title">Scenario JSON</h3>
                <button type="button" className="sb-json-modal-close" onClick={() => setShowJsonModal(false)}>
                  <X size={16} />
                </button>
              </div>
              <div className="sb-json-modal-body">
                <pre className="sb-json-content">
                  {JSON.stringify({
                    name: scenarioName || currentScenario?.name || '',
                    description: scenarioDescription || currentScenario?.description || '',
                    nodes_data: nodes.map(n => ({
                      id: n.id,
                      x: n.x,
                      y: n.y,
                      type: n.type,
                      label: n.label,
                      detail: n.detail,
                      configured: n.configured,
                      accent: n.accent,
                      icon: n.icon?.name || n.icon,
                      appointmentConfig: n.appointmentConfig || null,
                      triggerFilter: n.triggerFilter || null,
                      isCommunication: n.isCommunication || false,
                      firstMessage: n.firstMessage || '',
                      mainBox: n.mainBox || '',
                      focus: n.focus || 'prompt',
                      actionConfig: n.actionConfig ? Object.fromEntries(Object.entries(n.actionConfig).filter(([k]) => k !== '_fields')) : null,
                      subOptionKey: n.subOptionKey || null,
                      categoryKey: n.categoryKey || null,
                      categoryType: n.categoryType || null,
                    })),
                    edges_data: edges.map(e => ({
                      id: e.id,
                      from: e.from,
                      to: e.to,
                      filter: e.filter,
                    })),
                    schedule_config: recurringSchedule,
                    notes: scenarioNotes,
                    is_active: scenarioIsActive,
                  }, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
        {showSaveModal && (
          <div className="save-scenario-modal-overlay">
            <div className="save-scenario-modal">
              <div className="save-scenario-modal-header">
                <h3>Save Scenario</h3>
                <button className="modal-close-btn" onClick={handleCancelSaveScenario}>
                  <X size={18} />
                </button>
              </div>
              
              <div className="save-scenario-modal-body">
                <div className="form-group">
                  <label htmlFor="scenario-name">Scenario Name</label>
                  <input
                    id="scenario-name"
                    type="text"
                    className="sb-input-field"
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    autoFocus
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="scenario-description">Description (optional)</label>
                  <textarea
                    id="scenario-description"
                    className="sb-input-field"
                    value={scenarioDescription}
                    onChange={(e) => setScenarioDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="save-scenario-modal-footer">
                <button className="modal-cancel-btn" onClick={handleCancelSaveScenario}>
                  Cancel
                </button>
                <button className="modal-save-btn" onClick={handleConfirmSaveScenario}>
                  <Check size={16} />
                  Save Scenario
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="scenarios-container">
      {viewMode === 'list' ? renderListView() : renderBuilderView()}

      {/* Right-click context menu for Search Records Run Node */}
      {contextMenu && (
        <div
          className="sb-context-menu-overlay"
          onClick={() => setContextMenu(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200 }}
        >
          <div
            className="sb-context-menu"
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              zIndex: 201,
            }}
            onClick={async (e) => {
              e.stopPropagation();
              const { nodeId } = contextMenu;
              setContextMenu(null);
              try {
                await handleRunNodeRequest(nodeId);
              } catch (err) {
                console.error('[Run Node] Request failed:', err.message);
              }
            }}
          >
            <div className="sb-context-menu-action">
              <Zap size={13} />
              <span>Run Node</span>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal - Rendered at root level */}
      {deleteConfirmModal && (
        <div className="delete-confirm-overlay" onClick={handleCancelDelete}>
          <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-header">
              <div className="delete-confirm-icon">
                <Trash2 size={20} />
              </div>
              <h3 className="delete-confirm-title">Delete Scenario</h3>
            </div>
            
            <p className="delete-confirm-message">
              Are you sure you want to delete "{window.selectedScenarioForDelete?.name}"? 
              This action cannot be undone.
            </p>
            
            <div className="delete-confirm-actions">
              <button className="delete-cancel-btn" onClick={handleCancelDelete}>
                Cancel
              </button>
              <button className="delete-confirm-btn" onClick={handleConfirmDelete}>
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
