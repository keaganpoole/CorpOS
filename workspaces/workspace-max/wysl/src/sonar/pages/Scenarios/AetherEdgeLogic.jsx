import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Zap, X } from 'lucide-react';
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
import {
  getFieldsForContext,
  getContextType,
  DEFAULT_FIELDS,
} from '../../lib/fieldContexts';

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
  appointment_status: [
    { value: 'Pending' }, { value: 'Confirmed' }, { value: 'Cancelled' }, { value: 'Completed' }, { value: 'No Show' },
  ],
  call_status: CALL_STATUS_OPTIONS,
  call_outcome: OUTCOME_OPTIONS,
  sms_status: SMS_STATUS_OPTIONS,
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

const getField = (fieldKey, contextFields) => {
  // First check context-specific fields
  const ctxField = contextFields.find(f => f.key === fieldKey);
  if (ctxField) return ctxField;
  // Fallback to LEAD_FIELDS
  return LEAD_FIELDS.find((field) => field.key === fieldKey);
};

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
  onAddOrRule,
  onRemoveRule,
  onUpdateRule,
  onSave,
  onClose,
  style,
  contextType = 'default',
  availableVariables = [],
  fallbackAction = '',
  onFallbackChange,
  isFallback = false,
  onToggleFallback,
}) => {
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startPosTop: 0, startPosLeft: 0 });

  // No clamping — free drag anywhere
  const clampPosition = useCallback((top, left) => {
    return { top, left };
  }, []);

  const [position, setPosition] = useState(() => clampPosition(style?.top || 100, style?.left || 100));

  // Re-clamp when style prop changes (edge clicked at new position)
  useLayoutEffect(() => {
    if (style) {
      setPosition(clampPosition(style.top, style.left));
    }
  }, [style?.top, style?.left, clampPosition]);

  // Drag handlers
  const handleHeaderPointerDown = useCallback((e) => {
    if (e.target.closest('button')) return; // don't drag when clicking buttons
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startPosTop: position.top,
      startPosLeft: position.left,
    };
    document.body.style.userSelect = 'none';
  }, [position.top, position.left]);

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!dragRef.current.dragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition(clampPosition(
        dragRef.current.startPosTop + dy,
        dragRef.current.startPosLeft + dx,
      ));
    };
    const handlePointerUp = () => {
      dragRef.current.dragging = false;
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [clampPosition]);

  // Get context-appropriate fields
  const contextFields = useMemo(() => {
    const fields = getFieldsForContext(contextType);
    return fields.filter(f => f.type !== '__section');
  }, [contextType]);

  // Get section headers for default context
  const sectionedFields = useMemo(() => {
    if (contextType !== 'default') return null;
    return getFieldsForContext('default');
  }, [contextType]);

  // Build the field list with section headers for default mode
  const displayFields = useMemo(() => {
    if (sectionedFields) return sectionedFields;
    return contextFields;
  }, [contextFields, sectionedFields]);

  // Filter non-section fields for select options
  const selectableFields = useMemo(() => displayFields.filter(f => f.type !== '__section'), [displayFields]);

  return (
    <div className="aether-logic-wrapper" style={position}>
      <div className="aether-condition-panel">
        <div className="aether-panel-header" onPointerDown={handleHeaderPointerDown} style={{ cursor: 'move', userSelect: 'none' }}>
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

        <div className="aether-rule-group">
          {conditions.map((rule, idx) => {
            const field = getField(rule.variable, selectableFields);
            const operators = getOperatorOptions(field);
            return (
              <React.Fragment key={rule.id}>
                {idx > 0 && <span className={`aether-rule-logic-pill ${rule.logic === 'or' ? 'aether-rule-logic-pill--or' : ''}`}>{(rule.logic || 'and').toUpperCase()}</span>}
                <div className="aether-rule-row">
                  <select
                    className="aether-rule-select"
                    value={rule.variable}
                    onChange={(event) => {
                      const nextField = getField(event.target.value, selectableFields);
                      onUpdateRule(rule.id, 'variable', event.target.value);
                      onUpdateRule(rule.id, 'operator', defaultOperatorForField(nextField));
                      onUpdateRule(rule.id, 'value', nextField?.type === 'boolean' ? null : '');
                    }}
                  >
                    <option value="">Variable...</option>
                    {sectionedFields ? (
                      sectionedFields.map((option) => {
                        if (option.type === '__section') {
                          return (
                            <option key={option.key} value={option.key} disabled style={{ fontWeight: 700, color: '#71717a' }}>
                              {option.label}
                            </option>
                          );
                        }
                        return (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        );
                      })
                    ) : (
                      selectableFields.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))
                    )}
                  </select>
                  <select
                    className="aether-rule-select aether-rule-select--op"
                    value={rule.operator}
                    onChange={(event) => onUpdateRule(rule.id, 'operator', event.target.value)}
                  >
                    {operators.map((operator) => (
                      <option key={operator.value} value={operator.value}>
                        {operator.label}
                      </option>
                    ))}
                  </select>
                  <div className="aether-rule-value">
                    {getValueComponent({ field, rule, onUpdateRule })}
                  </div>
                  <button
                    type="button"
                    className="aether-rule-remove"
                    onClick={() => onRemoveRule(rule.id)}
                    title="Remove rule"
                  >
                    <X size={14} />
                  </button>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        <div className="sb-action-links">
          <button type="button" className="sb-action-link" onClick={onAddRule}>
            + Add AND rule
          </button>
          <button type="button" className="sb-action-link" onClick={onAddOrRule}>
            + Add OR rule
          </button>
        </div>
      </div>
    </div>
  );
};

export default AetherEdgeLogic;
