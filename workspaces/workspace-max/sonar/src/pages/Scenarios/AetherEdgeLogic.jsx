import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Zap, X } from 'lucide-react';
import {
  LEAD_FIELDS,
} from '../../lib/leadSchema';
import { TABLE_COLORS, TABLE_LABELS } from './VariablesPane';

// Map field keys to their source tables
const FIELD_TO_TABLE = {
  // People fields
  first_name: 'people', last_name: 'people', phone: 'people', email: 'people',
  street_address: 'people', city: 'people', state: 'people', zip_code: 'people',
  preferred_contact_method: 'people', preferred_language: 'people', best_time_to_contact: 'people',
  consent_sms: 'people', consent_call: 'people', do_not_call: 'people', do_not_text: 'people',
  status: 'people', source: 'people', lead_source_detail: 'people', tags: 'people',
  created_at: 'people', updated_at: 'people',
  last_inbound_call_at: 'people', last_outbound_call_at: 'people', last_call_status: 'people',
  last_intent: 'people', last_outcome: 'people', missed_call_count: 'people',
  last_inbound_sms_at: 'people', last_outbound_sms_at: 'people', last_sms_status: 'people',
  last_inbound_email_at: 'people', last_outbound_email_at: 'people', last_email_status: 'people',
  callback_needed: 'people', callback_due_at: 'people', handoff_required: 'people',
  assigned_staff: 'people', call_route: 'people',
  payment_status: 'people', balance_due: 'people', invoice_id: 'people',
  notes: 'people', special_instructions: 'people',
  // Payment fields
  payment_amount: 'people', payment_status_record: 'people', payment_method: 'people',
  payment_currency: 'people', payment_description: 'people', payment_receipt_url: 'people',
  payment_created_at: 'people',
};

const VariableChip = ({ tableKey, fieldKey, fieldLabel }) => {
  const color = TABLE_COLORS[tableKey] || '#a78bfa';
  const tableLabel = TABLE_LABELS[tableKey] || tableKey;
  const label = fieldLabel || fieldKey;
  return (
    <span
      className="sb-var-chip"
      style={{
        background: `${color}18`,
        color: color,
        border: `1px solid ${color}25`,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 7px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        lineHeight: '1.7',
      }}
    >
      {tableLabel}.{label}
    </span>
  );
};

const TYPE_LABELS = {
  text: 'Text',
  phone: 'Phone',
  email: 'Email',
  url: 'URL',
  textarea: 'Text',
  select: 'Select',
  multi_select: 'Multi Select',
  boolean: 'Boolean',
  number: 'Number',
  currency: 'Currency',
  timestamp: 'Timestamp',
};

const OPERATORS_BY_TYPE = {
  text: [
    { value: 'equals', label: 'Equal to' },
    { value: 'not_equals', label: 'Not equal to' },
    { value: 'contains', label: 'Contains' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
  ],
  phone: [
    { value: 'equals', label: 'Equal to' },
    { value: 'contains', label: 'Contains' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
  ],
  email: [
    { value: 'equals', label: 'Equal to' },
    { value: 'contains', label: 'Contains' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
  ],
  url: [
    { value: 'equals', label: 'Equal to' },
    { value: 'contains', label: 'Contains' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
  ],
  textarea: [
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does not contain' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
  ],
  select: [
    { value: 'equals', label: 'Is' },
    { value: 'not_equals', label: 'Is not' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
  ],
  multi_select: [
    { value: 'includes', label: 'Includes' },
    { value: 'does_not_include', label: 'Does not include' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
  ],
  boolean: [
    { value: 'equals', label: 'Is' },
    { value: 'not_equals', label: 'Is not' },
  ],
  number: [
    { value: 'equals', label: 'Equal to' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' },
    { value: 'is_empty', label: 'Is empty' },
  ],
  currency: [
    { value: 'equals', label: 'Equal to' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' },
    { value: 'is_empty', label: 'Is empty' },
  ],
  timestamp: [
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
  ],
};

const getField = (fieldKey) => LEAD_FIELDS.find((field) => field.key === fieldKey);

const getOperatorOptions = (field) => OPERATORS_BY_TYPE[field?.type] || OPERATORS_BY_TYPE.text;

const defaultOperatorForField = (field) => {
  const operators = getOperatorOptions(field);
  return operators[0]?.value || 'equals';
};

// Parse value string into text + chip parts
const parseValueWithChips = (rawValue) => {
  if (!rawValue || typeof rawValue !== 'string') return [];
  const varRegex = /\{\{([^}]+)\}\}/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = varRegex.exec(rawValue)) !== null) {
    const idx = match.index;
    if (idx > lastIndex) {
      parts.push({ type: 'text', content: rawValue.slice(lastIndex, idx) });
    }
    const ref = match[1];
    const dotIdx = ref.indexOf('.');
    const tableKey = dotIdx > -1 ? ref.slice(0, dotIdx) : '';
    const fieldKey = dotIdx > -1 ? ref.slice(dotIdx + 1) : ref;
    const fieldDef = LEAD_FIELDS.find(f => f.key === fieldKey);
    parts.push({ type: 'chip', tableKey, fieldKey, fieldLabel: fieldDef?.label || fieldKey });
    lastIndex = idx + match[0].length;
  }
  if (lastIndex < rawValue.length) {
    parts.push({ type: 'text', content: rawValue.slice(lastIndex) });
  }
  return parts;
};

const TextValueWithChips = ({ value, onChange, field, placeholder }) => {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef(null);
  const rawValue = value || '';
  const parts = parseValueWithChips(rawValue);
  const hasChips = parts.some(p => p.type === 'chip');

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
    }
  }, [editing]);

  if (hasChips && !editing) {
    return (
      <div
        className="sb-input-field sb-var-chip-display"
        tabIndex={0}
        onClick={() => setEditing(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setEditing(true); }}
        style={{ cursor: 'text', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', minHeight: '20px' }}
      >
        {parts.map((part, i) =>
          part.type === 'chip' ? (
            <VariableChip key={i} tableKey={part.tableKey} fieldKey={part.fieldKey} fieldLabel={part.fieldLabel} />
          ) : (
            <span key={i} style={{ color: '#fff', fontSize: '13px' }}>{part.content}</span>
          )
        )}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      className="sb-input-field"
      value={rawValue}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
      placeholder={placeholder}
    />
  );
};

const getValueComponent = ({ field, rule, onUpdateRule }) => {
  const value = rule.value;

  return (
    <input
      className="sb-input-field"
      value={value || ''}
      onChange={(event) => onUpdateRule(rule.id, 'value', event.target.value)}
      placeholder=""
    />
  );
};

const AetherEdgeLogic = ({
  conditions,
  onAddRule,
  onRemoveRule,
  onUpdateRule,
  onSave,
  onClose,
  style,
}) => {
  const fields = useMemo(() => LEAD_FIELDS.filter((field) => field.key !== 'created_at' && field.key !== 'updated_at'), []);

  return (
    <div className="aether-logic-wrapper" style={style}>
      <div className="aether-condition-panel">
        <div className="aether-panel-header">
          <span className="condition-label">
            <Zap size={14} /> Condition
          </span>
          <div className="aether-header-actions">
            <button type="button" className="aether-save" onClick={onSave}>
              Save
            </button>
            <button type="button" className="aether-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="condition-group" style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: -20, left: 0, background: '#ff0', color: '#000', fontSize: 11, padding: '2px 6px', zIndex: 9999, borderRadius: 3, fontWeight: 700 }}>
            DEBUG: ACTIVE CONDITION MODAL FILE = AetherEdgeLogic.jsx
          </div>
          <div className="rule-stack">
            {conditions.map((rule) => {
              const field = getField(rule.variable);
              const operators = getOperatorOptions(field);
              return (
                <div className="rule-card" key={rule.id}>
                  <div style={{ fontSize: 9, color: '#ff0', marginBottom: 4, fontWeight: 700 }}>
                    KEY FIELD COMPONENT = TextValueWithChips | OPERATOR FIELD COMPONENT = select | VALUE FIELD COMPONENT = getValueComponent (plain input)
                  </div>
                  <div className="input-container">
                    <div className="variable-input">
                      <TextValueWithChips
                        value={rule.variable ? `{{${FIELD_TO_TABLE[rule.variable] || 'people'}.${rule.variable}}}` : ''}
                        onChange={(val) => {
                          const varMatch = val.match(/^\{\{([^}]+)\}\}$/);
                          if (varMatch) {
                            const ref = varMatch[1];
                            const dotIdx = ref.indexOf('.');
                            const fieldKey = dotIdx > -1 ? ref.slice(dotIdx + 1) : ref;
                            const nextField = getField(fieldKey);
                            if (nextField) {
                              onUpdateRule(rule.id, 'variable', fieldKey);
                              onUpdateRule(rule.id, 'operator', defaultOperatorForField(nextField));
                              onUpdateRule(rule.id, 'value', nextField?.type === 'boolean' ? null : '');
                            }
                          } else if (val === '') {
                            onUpdateRule(rule.id, 'variable', '');
                            onUpdateRule(rule.id, 'operator', '');
                            onUpdateRule(rule.id, 'value', '');
                          }
                        }}
                        field={{ type: 'text' }}
                        placeholder=""
                      />
                    </div>
                    <button
                      type="button"
                      className="sb-remove-btn"
                      onClick={() => onRemoveRule(rule.id)}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="select-wrapper">
                    <select
                      className="sb-select-field"
                      value={rule.operator}
                      onChange={(event) => onUpdateRule(rule.id, 'operator', event.target.value)}
                    >
                      {operators.map((operator) => (
                        <option key={operator.value} value={operator.value}>
                          {operator.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {getValueComponent({ field, rule, onUpdateRule })}
                </div>
              );
            })}
          </div>

          <div className="sb-action-links">
            <button type="button" className="sb-action-link" onClick={onAddRule}>
              + Add AND rule
            </button>
            <button type="button" className="sb-action-link" onClick={onAddRule}>
              + Add OR rule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AetherEdgeLogic;
