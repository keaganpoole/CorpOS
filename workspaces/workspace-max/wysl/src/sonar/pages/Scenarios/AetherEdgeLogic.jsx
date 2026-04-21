import React, { useMemo } from 'react';
import { Database, Zap, X } from 'lucide-react';
import {
  LEAD_FIELDS,
  CONTACT_METHOD_OPTIONS,
  STATUS_OPTIONS,
  SOURCE_OPTIONS,
  CALL_STATUS_OPTIONS,
  OUTCOME_OPTIONS,
  SMS_STATUS_OPTIONS,
  EMAIL_STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  CALL_ROUTE_OPTIONS,
  TAG_OPTIONS,
  normalizeOptionValue,
} from '../../lib/leadSchema';

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

const VALUE_OPTIONS_BY_FIELD = {
  status: STATUS_OPTIONS,
  source: SOURCE_OPTIONS,
  preferred_contact_method: CONTACT_METHOD_OPTIONS,
  last_call_status: CALL_STATUS_OPTIONS,
  last_outcome: OUTCOME_OPTIONS,
  last_sms_status: SMS_STATUS_OPTIONS,
  last_email_status: EMAIL_STATUS_OPTIONS,
  payment_status: PAYMENT_STATUS_OPTIONS,
  call_route: CALL_ROUTE_OPTIONS,
  tags: TAG_OPTIONS,
};

const normalizeValue = (field, rawValue) => {
  if (rawValue == null) return null;
  if (field?.type === 'boolean') {
    if (rawValue === true || rawValue === 'true') return true;
    if (rawValue === false || rawValue === 'false') return false;
    return null;
  }
  if (field?.type === 'number' || field?.type === 'currency') {
    if (rawValue === '') return null;
    const parsed = Number(rawValue);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (field?.type === 'timestamp') {
    return rawValue || null;
  }
  if (field?.type === 'multi_select') {
    return Array.isArray(rawValue) ? rawValue : rawValue ? [normalizeOptionValue(rawValue)] : null;
  }
  return rawValue === '' ? null : rawValue;
};

const getField = (fieldKey) => LEAD_FIELDS.find((field) => field.key === fieldKey);

const getOperatorOptions = (field) => OPERATORS_BY_TYPE[field?.type] || OPERATORS_BY_TYPE.text;

const defaultOperatorForField = (field) => {
  const operators = getOperatorOptions(field);
  return operators[0]?.value || 'equals';
};

const getValueComponent = ({ field, rule, onUpdateRule }) => {
  const value = rule.value;
  const valueOptions = VALUE_OPTIONS_BY_FIELD[field?.key] || field?.options || [];

  if (field?.type === 'boolean') {
    return (
      <div className="sb-rule-value-shell">
        <select
          className="sb-input-field sb-select-field"
          value={value === true || value === 'true' ? 'true' : value === false || value === 'false' ? 'false' : ''}
          onChange={(event) => onUpdateRule(rule.id, 'value', normalizeValue(field, event.target.value))}
        >
          <option value="">Select value</option>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      </div>
    );
  }

  if (field?.type === 'number' || field?.type === 'currency') {
    return (
      <input
        className="sb-input-field"
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        onChange={(event) => onUpdateRule(rule.id, 'value', normalizeValue(field, event.target.value))}
        placeholder="Value"
      />
    );
  }

  if (field?.type === 'timestamp') {
    return (
      <input
        className="sb-input-field"
        type="datetime-local"
        value={value ?? ''}
        onChange={(event) => onUpdateRule(rule.id, 'value', normalizeValue(field, event.target.value))}
      />
    );
  }

  if (field?.type === 'select' || field?.type === 'multi_select') {
    return (
      <div className="sb-rule-value-shell">
        <select
          className="sb-input-field sb-select-field"
          value={Array.isArray(value) ? value[0] || '' : value || ''}
          onChange={(event) => onUpdateRule(rule.id, 'value', normalizeValue(field, event.target.value))}
        >
          <option value="">{field?.type === 'multi_select' ? 'Choose tag' : 'Select value'}</option>
          {valueOptions.map((opt) => {
            const optValue = typeof opt === 'string' ? opt : opt.value;
            const normalized = normalizeOptionValue(optValue);
            return (
              <option key={normalized} value={normalized}>
                {normalized}
              </option>
            );
          })}
        </select>
      </div>
    );
  }

  return (
    <input
      className="sb-input-field"
      value={value || ''}
      onChange={(event) => onUpdateRule(rule.id, 'value', normalizeValue(field, event.target.value))}
      placeholder="Value"
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

        <div className="condition-group">
          <div className="rule-stack">
            {conditions.map((rule) => {
              const field = getField(rule.variable);
              const operators = getOperatorOptions(field);
              return (
                <div className="rule-card" key={rule.id}>
                  <div className="input-container">
                    <div className="variable-input">
                      <Database size={12} className="variable-icon" />
                      <select
                        className="sb-input-field sb-select-field"
                        value={rule.variable}
                        onChange={(event) => {
                          const nextField = getField(event.target.value);
                          onUpdateRule(rule.id, 'variable', event.target.value);
                          onUpdateRule(rule.id, 'operator', defaultOperatorForField(nextField));
                          onUpdateRule(rule.id, 'value', nextField?.type === 'boolean' ? null : '');
                        }}
                      >
                        <option value="">Map variable...</option>
                        {fields.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label} ({TYPE_LABELS[option.type] || 'Text'})
                          </option>
                        ))}
                      </select>
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
