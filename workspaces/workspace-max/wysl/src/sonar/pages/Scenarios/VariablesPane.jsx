import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  User, Calendar, Phone, ChevronDown, ChevronRight, X, Zap, Sparkles, Mic, CreditCard
} from 'lucide-react';
import { getSmartActionByKey, getSmartActions } from './smartActions';

// Build a map of smart action key → name for token rendering
const SMART_ACTION_MAP = {};
try {
  // Pre-populate with known smart actions
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

// Table definitions with colors, icons, and field metadata
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
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'notes', label: 'Notes', type: 'text' },
      { key: 'special_instructions', label: 'Special Instructions', type: 'text' },
      { key: 'best_time_to_contact', label: 'Best Time to Contact', type: 'text' },
      { key: 'callback_needed', label: 'Callback Needed', type: 'text' },
      { key: 'callback_due_at', label: 'Callback Due At', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'last_call_status', label: 'Last Call Status', type: 'text' },
      { key: 'last_outcome', label: 'Last Outcome', type: 'text' },
      { key: 'consent_sms', label: 'Consent SMS', type: 'text' },
      { key: 'consent_call', label: 'Consent Call', type: 'text' },
    ],
    fetch: async () => {
      try {
        const { data } = await supabase.from('people').select('*').limit(1);
        return data?.[0] || null;
      } catch { return null; }
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
      { key: 'people_id', label: 'Customer ID', type: 'text' },
      { key: 'created_at', label: 'Created At', type: 'timestamp' },
    ],
    fetch: async () => {
      try {
        const { data } = await supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(1);
        return data?.[0] || null;
      } catch { return null; }
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
      { key: 'notes', label: 'Notes', type: 'text' },
    ],
    fetch: async () => {
      try {
        const { data } = await supabase.from('appointments').select('*').limit(1);
        return data?.[0] || null;
      } catch { return null; }
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
      { key: 'full_name', label: 'Name', type: 'text' },
      { key: 'stereotype', label: 'Role', type: 'text' },
      { key: 'phone_number', label: 'Phone', type: 'phone' },
      { key: 'call_types', label: 'Call Types', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    fetch: async () => {
      try {
        const { data } = await supabase.from('hired_receptionists').select('*').limit(1);
        return data?.[0] || null;
      } catch { return null; }
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
      { key: 'website', label: 'Website', type: 'url' },
      { key: 'address', label: 'Address', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'zip', label: 'Zip', type: 'text' },
    ],
    fetch: async () => {
      try {
        const { data } = await supabase.from('businesses').select('*').limit(1);
        return data?.[0] || null;
      } catch { return null; }
    },
  },
];

// Color lookup by table key
export const TABLE_COLORS = {
  people: '#32f0d9',
  payments: '#f472b6',
  appointments: '#38bdf8',
  hired_receptionists: '#f472b6',
  businesses: '#a1a1aa',
};

export const TABLE_LABELS = {
  people: 'People',
  payments: 'Payment',
  appointments: 'Appointment',
  hired_receptionists: 'Receptionist',
  businesses: 'Business',
};

// Default agent variables captured during calls
const DEFAULT_AGENT_VARS = [
  // Customer Record
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
  // Appointments
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

// Build variable reference from table + field
export const getVariableRef = (tableKey, fieldKey) => `{{${tableKey}.${fieldKey}}}`;

// Render a value with {{table.field}} and {smart:key} as styled chip HTML
export const renderVarChipsHTML = (value) => {
  if (!value || typeof value !== 'string') return '';
  // First replace {smart:key} tokens
  let result = value.replace(/\{smart:([^}]+)\}/g, (match, key) => {
    const action = SMART_ACTION_MAP[key];
    if (!action) return match;
    return `<span class="sb-var-chip" style="background:linear-gradient(135deg,rgba(56,189,248,0.12),rgba(168,85,247,0.12));color:#a855f7;border:1px solid rgba(168,85,247,0.25);display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap;line-height:1.7;vertical-align:middle;gap:2px;">⚡ ${action}</span>`;
  });
  // Then replace {{table.field}} and {{agent.*}} tokens
  result = result.replace(/\{\{([^}]+)\}\}/g, (match, ref) => {
    const parts = ref.split('.');
    if (parts.length !== 2) return match;
    // Agent variables (from call)
    if (parts[0] === 'agent') {
      return `<span class="sb-var-chip" style="background:rgba(50,240,217,0.12);color:#32f0d9;border:1px solid rgba(50,240,217,0.25);display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap;line-height:1.7;vertical-align:middle;">Call.${parts[1]}</span>`;
    }
    const color = TABLE_COLORS[parts[0]] || '#a78bfa';
    const tableLabel = TABLE_LABELS[parts[0]] || parts[0];
    return `<span class="sb-var-chip" style="background:${color}18;color:${color};border:1px solid ${color}25;display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600;white-space:nowrap;line-height:1.7;vertical-align:middle;">${tableLabel}.${parts[1]}</span>`;
  });
  return result;
};

// Parse variable references from a value string
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

const VariablesPane = ({ visible, targetFieldKey, fieldLabel, onInsertVariable, onInsertSmartAction, smartActions = [], onTableHover, onClose, style = {}, nodes = [], edges = [], currentNodeId = '' }) => {
  const [samples, setSamples] = useState({});
  const [expanded, setExpanded] = useState({});
  const paneRef = useRef(null);

  // Fetch sample records on mount
  useEffect(() => {
    if (!visible) return;
    const fetchSamples = async () => {
      const results = {};
      for (const table of TABLE_DEFS) {
        results[table.key] = await table.fetch();
      }
      setSamples(results);
      const exp = {};
      TABLE_DEFS.forEach(t => { exp[t.key] = true; });
      setExpanded(exp);
    };
    fetchSamples();
  }, [visible]);

  if (!visible) return null;

  // Check if there's a Call Customer node upstream of the current node
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

  // Check if current node is a phone call trigger (don't show From Call for these)
  const isPhoneCallTrigger = (() => {
    const node = nodes.find(n => n.id === currentNodeId);
    if (!node || node.categoryType !== 'TRIGGERS') return false;
    const phoneTriggers = ['incoming_call', 'call_answered', 'missed_call', 'call_failed', 'voicemail_received'];
    return phoneTriggers.includes(node.subOptionKey || node.actionConfig?._key || '');
  })();

  // Check if current node is a call action (don't show From Call for these either)
  const isCallAction = (() => {
    const node = nodes.find(n => n.id === currentNodeId);
    if (!node) return false;
    const callActions = ['call_customer', 'call_phone_number'];
    return callActions.includes(node.subOptionKey || node.actionConfig?._key || '');
  })();

  const showFromCall = hasCallNodeBefore && !isPhoneCallTrigger && !isCallAction;

  const formatValue = (value, type) => {
    if (value === null || value === undefined) return '—';
    if (type === 'timestamp') {
      try { return new Date(value).toLocaleDateString(); } catch { return String(value); }
    }
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
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
        {/* Agent Data Section — "From Call" variables (only after a Call node) */}
        {showFromCall && (
          <div className="sb-vars-table-group" style={{ '--table-color': '#32f0d9', '--table-bg': 'rgba(50,240,217,0.08)', '--table-border': 'rgba(50,240,217,0.2)' }} onMouseEnter={() => onTableHover?.('#32f0d9')} onMouseLeave={() => onTableHover?.('')}>
            <button
              type="button"
              className="sb-vars-table-header"
              onClick={() => setExpanded(prev => ({ ...prev, __agent: !prev.__agent }))}
            >
              <span className="sb-vars-table-chevron">
                {expanded.__agent ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
              <span className="sb-vars-table-icon" style={{ color: '#32f0d9' }}>
                <Mic size={11} />
              </span>
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
                            <button
                              key={field.key}
                              type="button"
                              className="sb-vars-field"
                              onClick={(e) => { e.stopPropagation(); onInsertVariable?.(varRef, field.label, '#32f0d9'); }}
                              title={`Insert ${varRef} — populated by agent during call`}
                            >
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
                          <button
                            key={field.key}
                            type="button"
                            className="sb-vars-field"
                            onClick={(e) => { e.stopPropagation(); onInsertVariable?.(varRef, field.label, '#32f0d9'); }}
                            title={`Insert ${varRef} — populated by agent during call`}
                          >
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
        
        {/* Smart Actions Section */}
        {onInsertSmartAction && smartActions.length > 0 && (
          <div className="sb-smart-actions-section">
            <div className="sb-smart-actions-header">
              <Sparkles size={12} className="sb-smart-actions-icon" />
              <span className="sb-smart-actions-title">Smart Actions</span>
            </div>
            <div className="sb-smart-actions-list">
              {smartActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  className="sb-smart-action-item"
                  onClick={(e) => { e.stopPropagation(); onInsertSmartAction(action, targetFieldKey); }}
                  title={action.description}
                >
                  <Zap size={11} className="sb-smart-action-item-icon" />
                  <span className="sb-smart-action-item-name">{action.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {TABLE_DEFS.map((table) => {
          const sample = samples[table.key];
          const isExpanded = expanded[table.key];
          const TableIcon = table.icon;

          return (
            <div key={table.key} className="sb-vars-table-group" style={{ '--table-color': table.color, '--table-bg': table.colorBg, '--table-border': table.colorBorder }} onMouseEnter={() => onTableHover?.(table.color)} onMouseLeave={() => onTableHover?.('')}>
              <button
                type="button"
                className="sb-vars-table-header"
                onClick={() => setExpanded(prev => ({ ...prev, [table.key]: !prev[table.key] }))}
              >
                <span className="sb-vars-table-chevron">
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
                <span className="sb-vars-table-icon" style={{ color: table.color }}>
                  <TableIcon size={11} />
                </span>
                <span className="sb-vars-table-label">{table.label}</span>
                {sample === null && <span className="sb-vars-no-data">No data</span>}
              </button>

              {isExpanded && sample && (
                <div className="sb-vars-fields">
                  {table.fields.map((field) => {
                    const sampleValue = sample[field.key];
                    const varRef = getVariableRef(table.key, field.key);
                    const hasValue = sampleValue !== null && sampleValue !== undefined;

                    return (
                      <button
                        key={field.key}
                        type="button"
                        className="sb-vars-field"
                        onClick={(e) => {
                          e.stopPropagation();
                          onInsertVariable?.(varRef, field.label, table.color);
                        }}
                        title={hasValue ? formatValue(sampleValue, field.type) : 'No value in sample'}
                      >
                        <span className="sb-vars-field-name" style={{ color: table.color }}>{field.label}</span>
                        {hasValue && (
                          <span className="sb-vars-field-value">{formatValue(sampleValue, field.type)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {isExpanded && !sample && (
                <div className="sb-vars-fields">
                  <div className="sb-vars-empty">No records found</div>
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
