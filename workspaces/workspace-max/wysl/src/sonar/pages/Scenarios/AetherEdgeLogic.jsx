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
} from '../../lib/leadSchema';
import {
  getFieldsForContext,
  getContextType,
  DEFAULT_FIELDS,
} from '../../lib/fieldContexts';
import { renderVarChipsHTML } from './VariablesPane';

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

// Value field is always a plain text input — no dropdowns, no options.

const normalizeValue = (field, rawValue) => {
  if (rawValue == null) return null;
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

// Value field is always a plain text input — never a dropdown.
const getValueComponent = ({ rule, onUpdateRule, onFieldFocus }) => {
  const valStr = String(rule.value || '');
  const hasChips = valStr.includes('{{');
  return (
    <>
      <input
        className="sb-input-field"
        value={rule.value ?? ''}
        onChange={(event) => onUpdateRule(rule.id, 'value', event.target.value)}
        onFocus={() => onFieldFocus?.(rule.id, 'value')}
      />
      {hasChips && (
        <div
          className="sb-var-chip-overlay"
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', padding: '7px 10px', overflow: 'hidden',
            fontSize: 12, color: '#e4e4e7', fontFamily: 'Inter, sans-serif',
            whiteSpace: 'nowrap',
          }}
          dangerouslySetInnerHTML={{ __html: renderVarChipsHTML(valStr) }}
        />
      )}
    </>
  );
};

const AetherEdgeLogic = ({
  conditions,
  onAddRule,
  onAddOrRule,
  onRemoveRule,
  onUpdateRule,
  onClose,
  onFieldFocus,
  onPositionChange,
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
      const newPos = clampPosition(
        dragRef.current.startPosTop + dy,
        dragRef.current.startPosLeft + dx,
      );
      setPosition(newPos);
      onPositionChange?.(newPos.top, newPos.left);
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
                <div className="aether-rule-row" style={{ position: 'relative' }}>
                  <input
                    className="aether-rule-select"
                    type="text"
                    value={rule.variable}
                    onChange={(event) => {
                      const nextField = getField(event.target.value, selectableFields);
                      onUpdateRule(rule.id, 'variable', event.target.value);
                      onUpdateRule(rule.id, 'operator', defaultOperatorForField(nextField));
                      onUpdateRule(rule.id, 'value', '');
                    }}
                    onFocus={() => {
                      if (typeof onFieldFocus === 'function') {
                        onFieldFocus(rule.id, 'variable');
                      }
                    }}
                  />
                  {rule.variable && (
                    <div
                      className="sb-var-chip-overlay"
                      style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        display: 'flex', alignItems: 'center', padding: '7px 10px', overflow: 'hidden',
                        fontSize: 12, color: '#e4e4e7', fontFamily: 'Inter, sans-serif',
                        whiteSpace: 'nowrap', zIndex: 1,
                      }}
                      dangerouslySetInnerHTML={{ __html: renderVarChipsHTML(rule.variable) }}
                    />
                  )}
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
                    {getValueComponent({ rule, onUpdateRule, onFieldFocus })}
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
