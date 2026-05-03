import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  User, Calendar, Phone, ChevronDown, ChevronRight, X, Zap, Sparkles
} from 'lucide-react';
import { getSmartActionByKey, getSmartActions } from './smartActions';

// Build a map of smart action key → name for token rendering
const SMART_ACTION_MAP = {};
try {
  // Pre-populate with known smart actions
  const _keys = ['confirm_receipt', 'verify_details', 'set_arrival_expectations', 'pre_visit_questions',
    'reschedule_appointment', 'confirm_changes', 'verify_new_time', 'understand_reason',
    'offer_reschedule', 'retain_customer', 'confirm_new_time', 'confirm_reminder',
    'confirm_appointment', 'check_satisfaction', 'identify_unresolved', 'request_review',
    'offer_additional', 'schedule_next', 'investigate_missed', 'discuss_cancellation_policy',
    'leave_voicemail', 'identify_purpose', 'take_message', 'route_call', 'return_call',
    'identify_reason', 'retry_call', 'address_voicemail', 'schedule_callback',
    'verify_identity', 'deliver_message', 'address_question', 'follow_up',
    'investigate_payment', 'offer_payment_plan', 'save_at_risk', 'confirm_billing',
    'explain_charges', 'confirm_amount', 'confirm_payment', 'welcome_customer',
    'collect_info', 'explain_services', 'verify_changes', 'confirm_deletion'];
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
const ALL_TABLE_DEFS = [
  {
    key: 'people',
    label: 'People',
    color: '#32f0d9',
    colorBg: 'rgba(50,240,217,0.08)',
    colorBorder: 'rgba(50,240,217,0.2)',
    icon: User,
    fields: [
      { key: 'first_name', label: 'First Name', type: 'text' },
      { key: 'last_name', label: 'Last Name', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'phone' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'source', label: 'Source', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'text' },
      { key: 'created_at', label: 'Created At', type: 'timestamp' },
    ],
    fetch: async () => {
      try {
        const { data } = await supabase.from('people').select('*').limit(1);
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
    key: 'services',
    label: 'Services',
    color: '#a78bfa',
    colorBg: 'rgba(167,139,250,0.08)',
    colorBorder: 'rgba(167,139,250,0.2)',
    icon: Zap,
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'price_type', label: 'Price Type', type: 'text' },
      { key: 'price_min', label: 'Price Min', type: 'number' },
      { key: 'price_max', label: 'Price Max', type: 'number' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'is_active', label: 'Active', type: 'boolean' },
    ],
    fetch: async () => {
      try {
        const { data } = await supabase.from('services').select('*').limit(1);
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
    color: '#fbbf24',
    colorBg: 'rgba(251,191,36,0.08)',
    colorBorder: 'rgba(251,191,36,0.2)',
    icon: User,
    fields: [
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
  {
    key: 'payments',
    label: 'Payments',
    color: '#34d399',
    colorBg: 'rgba(52,211,153,0.08)',
    colorBorder: 'rgba(52,211,153,0.2)',
    icon: DollarSign,
    fields: [
      { key: 'amount', label: 'Amount', type: 'number' },
      { key: 'currency', label: 'Currency', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'payment_method', label: 'Payment Method', type: 'text' },
      { key: 'stripe_payment_intent_id', label: 'Stripe ID', type: 'text' },
      { key: 'created_at', label: 'Created At', type: 'timestamp' },
    ],
    fetch: async () => {
      try {
        const { data } = await supabase.from('payments').select('*').limit(1);
        return data?.[0] || null;
      } catch { return null; }
    },
  },
];

// ─── Trigger → Runtime Table Availability ──────────────────────────────────
// Maps trigger keys to the tables that will have data at runtime.
// Based on ScenarioEngine._buildFlowContext relationships.
const TRIGGER_TABLE_MAP = {
  // Appointment triggers: appointments base + FK → people, services, businesses
  appointment_created: ['appointments', 'people', 'services', 'businesses'],
  appointment_updated: ['appointments', 'people', 'services', 'businesses'],
  appointment_cancelled: ['appointments', 'people', 'services', 'businesses'],
  appointment_rescheduled: ['appointments', 'people', 'services', 'businesses'],
  appointment_confirmed: ['appointments', 'people', 'services', 'businesses'],
  appointment_soon: ['appointments', 'people', 'services', 'businesses'],
  appointment_completed: ['appointments', 'people', 'services', 'businesses'],
  appointment_missed: ['appointments', 'people', 'services', 'businesses'],

  // Record triggers: people base + context → businesses
  record_created: ['people', 'businesses'],
  record_updated: ['people', 'businesses'],
  record_deleted: ['people', 'businesses'],

  // Phone triggers: people base (caller) + context → businesses
  incoming_call: ['people', 'businesses', 'hired_receptionists'],
  call_answered: ['people', 'businesses', 'hired_receptionists'],
  missed_call: ['people', 'businesses'],
  call_failed: ['people', 'businesses'],
  voicemail_received: ['people', 'businesses'],

  // SMS triggers: people base + context → businesses
  sms_received: ['people', 'businesses'],
  sms_sent: ['people', 'businesses'],
  sms_failed: ['people', 'businesses'],
  customer_replied: ['people', 'businesses'],

  // Payment triggers: payments base + FK → people + context → businesses
  invoice_created: ['payments', 'people', 'businesses'],
  invoice_paid: ['payments', 'people', 'businesses'],
  payment_failed: ['payments', 'people', 'businesses'],
  invoice_sent: ['payments', 'people', 'businesses'],

  // Manual trigger: everything available
  manual_trigger: ALL_TABLE_DEFS.map(t => t.key),
};

// Fetch order from ScenarioEngine._buildFlowContext (first fetched = bottom, last fetched = top)
// 1. appointments → 2. people → 3. payments → 4. businesses → 5. hired_receptionists
// services: tied to appointments via FK, rendered just above appointments
const FETCH_ORDER = {
  appointments: 1,
  services: 2,
  people: 3,
  payments: 4,
  businesses: 5,
  hired_receptionists: 6,
};
const PEOPLE_SORT_KEY = 999; // Always pinned to bottom

// Get available table defs for a given trigger key, sorted by fetch order
const getAvailableTables = (triggerKey) => {
  let tables;
  if (!triggerKey) {
    tables = [...ALL_TABLE_DEFS]; // No trigger set yet — show all
  } else {
    const availableKeys = TRIGGER_TABLE_MAP[triggerKey];
    if (!availableKeys) {
      tables = [...ALL_TABLE_DEFS]; // Unknown trigger — show all as fallback
    } else {
      tables = ALL_TABLE_DEFS.filter(t => availableKeys.includes(t.key));
    }
  }

  // Sort: bottom = foundational (people always lowest), top = most specific
  // Use ascending sort so lower FETCH_ORDER values appear at bottom
  tables.sort((a, b) => {
    const aKey = a.key === 'people' ? PEOPLE_SORT_KEY : (FETCH_ORDER[a.key] || 50);
    const bKey = b.key === 'people' ? PEOPLE_SORT_KEY : (FETCH_ORDER[b.key] || 50);
    return aKey - bKey; // Ascending: lowest order = bottom, people(-1) always last
  });

  return tables;
};

// Color lookup by table key
export const TABLE_COLORS = {
  people: '#32f0d9',
  appointments: '#38bdf8',
  services: '#a78bfa',
  hired_receptionists: '#f472b6',
  businesses: '#fbbf24',
  payments: '#34d399',
};

export const TABLE_LABELS = {
  people: 'People',
  appointments: 'Appointment',
  services: 'Service',
  hired_receptionists: 'Receptionist',
  businesses: 'Business',
  payments: 'Payment',
};

// Re-export for Scenarios.jsx to use
export { ALL_TABLE_DEFS, TRIGGER_TABLE_MAP, getAvailableTables };

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
  // Then replace {{table.field}} tokens
  result = result.replace(/\{\{([^}]+)\}\}/g, (match, ref) => {
    const parts = ref.split('.');
    if (parts.length !== 2) return match;
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

const VariablesPane = ({
  visible,
  targetFieldKey,
  fieldLabel,
  onInsertVariable,
  onInsertSmartAction,
  smartActions = [],
  onTableHover,
  onClose,
  style = {},
  triggerKey = null,
  previousNodeOutputs = [],
}) => {
  const [samples, setSamples] = useState({});
  const [expanded, setExpanded] = useState({});
  const [activeTab, setActiveTab] = useState('database');
  const paneRef = useRef(null);

  // Resolve available tables based on trigger key
  const availableTables = getAvailableTables(triggerKey);

  // Fetch sample records on mount (only for available tables)
  useEffect(() => {
    if (!visible) return;
    const fetchSamples = async () => {
      const results = {};
      for (const table of availableTables) {
        results[table.key] = await table.fetch();
      }
      setSamples(results);
      const exp = {};
      availableTables.forEach(t => { exp[t.key] = true; });
      setExpanded(exp);
    };
    fetchSamples();
  }, [visible, triggerKey]);

  // Reset tab when pane reopens
  useEffect(() => {
    if (visible) setActiveTab('database');
  }, [visible]);

  if (!visible) return null;

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

      {/* Tab bar */}
      <div className="sb-vars-tabs">
        <button
          type="button"
          className={`sb-vars-tab ${activeTab === 'database' ? 'active' : ''}`}
          onClick={() => setActiveTab('database')}
        >
          Database
        </button>
        <button
          type="button"
          className={`sb-vars-tab ${activeTab === 'scenario' ? 'active' : ''}`}
          onClick={() => setActiveTab('scenario')}
        >
          Scenario
        </button>
      </div>

      <div className="sb-vars-scroll">
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

        {activeTab === 'database' ? (
          /* ── Database Tab: trigger-filtered tables ── */
          availableTables.map((table) => {
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
          })
        ) : (
          /* ── Scenario Tab: previous node outputs ── */
          previousNodeOutputs.length === 0 ? (
            <div className="sb-vars-empty" style={{ padding: '20px 0', textAlign: 'center' }}>
              No previous node outputs available
            </div>
          ) : (
            previousNodeOutputs.map((nodeOutput) => {
              const hasRecords = nodeOutput.actionKey === 'search_records' && nodeOutput.searchResults;
              const records = hasRecords ? nodeOutput.searchResults : [];
              const isNodeExpanded = expanded[`scenario_${nodeOutput.nodeId}`];

              return (
                <div
                  key={nodeOutput.nodeId}
                  className="sb-vars-table-group"
                  style={{ '--table-color': '#f59e0b', '--table-bg': 'rgba(245,158,11,0.08)', '--table-border': 'rgba(245,158,11,0.2)' }}
                >
                  <button
                    type="button"
                    className="sb-vars-table-header"
                    onClick={() => setExpanded(prev => ({ ...prev, [`scenario_${nodeOutput.nodeId}`]: !prev[`scenario_${nodeOutput.nodeId}`] }))}
                  >
                    <span className="sb-vars-table-chevron">
                      {isNodeExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>
                    <span className="sb-vars-table-icon" style={{ color: '#f59e0b' }}>
                      <Zap size={11} />
                    </span>
                    <span className="sb-vars-table-label">{nodeOutput.nodeLabel}</span>
                  </button>

                  {isNodeExpanded && (
                    <div className="sb-vars-fields">
                      {/* Standard output fields */}
                      {Object.entries(nodeOutput.outputFields).map(([key, value]) => {
                        const varRef = `{{${nodeOutput.nodeId}.${key}}}`;
                        const displayValue = typeof value === 'object' && value !== null
                          ? JSON.stringify(value)
                          : value;
                        const hasValue = value !== null && value !== undefined;

                        return (
                          <button
                            key={key}
                            type="button"
                            className="sb-vars-field"
                            onClick={(e) => {
                              e.stopPropagation();
                              onInsertVariable?.(varRef, key, '#f59e0b');
                            }}
                            title={hasValue ? String(displayValue) : 'No value'}
                          >
                            <span className="sb-vars-field-name" style={{ color: '#f59e0b' }}>{key}</span>
                            {hasValue && (
                              <span className="sb-vars-field-value">{String(displayValue)}</span>
                            )}
                          </button>
                        );
                      })}

                      {/* Search Records: collapsible record bundles */}
                      {hasRecords && (
                        <div className="sb-search-records-section">
                          <div className="sb-search-records-label">records ({records.length})</div>
                          {records.length === 0 ? (
                            <div className="sb-vars-empty" style={{ paddingLeft: 8 }}>No records found</div>
                          ) : (
                            records.map((record, idx) => {
                              const recordKey = `scenario_${nodeOutput.nodeId}_record_${idx}`;
                              const isRecordExpanded = expanded[recordKey];
                              const isAutoExpand = records.length <= 3;

                              return (
                                <div key={idx} className="sb-record-bundle">
                                  <button
                                    type="button"
                                    className="sb-record-bundle-header"
                                    onClick={() => setExpanded(prev => ({
                                      ...prev,
                                      [recordKey]: isAutoExpand ? !(prev[recordKey] ?? true) : !prev[recordKey]
                                    }))}
                                  >
                                    <span className="sb-vars-table-chevron">
                                      {(isRecordExpanded ?? isAutoExpand) ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                    </span>
                                    <span className="sb-record-index">{idx}</span>
                                    {record.first_name && (
                                      <span className="sb-record-preview">{record.first_name}{record.last_name ? ` ${record.last_name}` : ''}</span>
                                    )}
                                    {record.name && !record.first_name && (
                                      <span className="sb-record-preview">{record.name}</span>
                                    )}
                                    {record.client_name && !record.first_name && !record.name && (
                                      <span className="sb-record-preview">{record.client_name}</span>
                                    )}
                                    {record.amount !== undefined && !record.first_name && !record.name && !record.client_name && (
                                      <span className="sb-record-preview">${record.amount}</span>
                                    )}
                                  </button>

                                  {(isRecordExpanded ?? isAutoExpand) && record && typeof record === 'object' && (
                                    <div className="sb-record-fields">
                                      {Object.entries(record).map(([fieldKey, fieldVal]) => {
                                        const varRef = `{{${nodeOutput.nodeId}.records.${idx}.${fieldKey}}}`;
                                        const displayVal = typeof fieldVal === 'object' && fieldVal !== null
                                          ? JSON.stringify(fieldVal)
                                          : fieldVal;
                                        const hasVal = fieldVal !== null && fieldVal !== undefined;

                                        return (
                                          <button
                                            key={fieldKey}
                                            type="button"
                                            className="sb-vars-field sb-record-field"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onInsertVariable?.(varRef, fieldKey, '#f59e0b');
                                            }}
                                            title={hasVal ? String(displayVal) : 'No value'}
                                          >
                                            <span className="sb-vars-field-name" style={{ color: '#f59e0b' }}>{fieldKey}</span>
                                            {hasVal && (
                                              <span className="sb-vars-field-value">{String(displayVal)}</span>
                                            )}
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
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
};

export default VariablesPane;
