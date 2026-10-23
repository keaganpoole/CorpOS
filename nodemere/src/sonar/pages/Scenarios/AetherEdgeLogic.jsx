import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Zap, X } from 'lucide-react';
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
import { getPeopleCustomVariableFields, getTableFields, renderVarChipsHTML } from './VariablesPane';
import { APPOINTMENT_FIELDS, getFieldDef } from '../../lib/appointmentSchema';

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
  date: 'Date',
  timestamp: 'Timestamp',
};

const OPERATORS_BY_TYPE = {
  text: [
    { value: 'equals', label: 'Equal to' },
    { value: 'not_equals', label: 'Not equal to' },
    { value: 'contains', label: 'Contains' },
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'on_or_before', label: 'On or before' },
    { value: 'on_or_after', label: 'On or after' },
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
    { value: 'not_equals', label: 'Not equal to' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
  ],
  date: [
    { value: 'equals', label: 'On' },
    { value: 'not_equals', label: 'Not on' },
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'on_or_before', label: 'On or before' },
    { value: 'on_or_after', label: 'On or after' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
  ],
  timestamp: [
    { value: 'equals', label: 'On' },
    { value: 'not_equals', label: 'Not on' },
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'on_or_before', label: 'On or before' },
    { value: 'on_or_after', label: 'On or after' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
  ],
};

const normalizeValue = (field, rawValue) => {
  if (rawValue == null) return null;
  return rawValue === '' ? null : rawValue;
};

const TABLE_ALIASES = {
  person: 'people', people: 'people',
  appointment: 'appointments', appointments: 'appointments',
  service: 'services', services: 'services',
  staff: 'staff',
  business: 'businesses', businesses: 'businesses',
  receptionist: 'hired_receptionists', hired_receptionists: 'hired_receptionists',
  payment: 'payments', payments: 'payments',
  invoice: 'invoices', invoices: 'invoices',
};

const getField = (fieldKey, contextFields, availableVariables, appointmentStatusOptions, appointmentStatusColors) => {
  const normalizedFieldKey = String(fieldKey || '').trim();
  const unwrappedFieldKey = normalizedFieldKey.replace(/^\{\{\s*|\s*\}\}$/g, '');

  // First check context-specific fields
  const ctxField = contextFields.find((f) => f.key === normalizedFieldKey || f.key === unwrappedFieldKey);
  if (ctxField) {
    if (ctxField.key === 'appointment_status') {
      return { ...ctxField, type: 'select', options: appointmentStatusOptions, optionColors: appointmentStatusColors };
    }
    return ctxField;
  }

  const parts = unwrappedFieldKey.split('.');
  if (parts.length >= 2) {
    const tableKey = parts.length >= 3 ? parts[parts.length - 2] : parts[0];
    const nestedFieldKey = parts[parts.length - 1];
    const normalizedTableKey = TABLE_ALIASES[tableKey] || tableKey;
    const appointmentField = normalizedTableKey === 'appointments' ? getFieldDef(nestedFieldKey) : null;
    const tableField = (normalizedTableKey === 'appointments' ? APPOINTMENT_FIELDS : getTableFields(normalizedTableKey))
      .find((f) => f.key === nestedFieldKey);
    if (appointmentField || tableField) {
      const resolved = appointmentField || tableField;
      if (normalizedTableKey === 'appointments' && nestedFieldKey === 'status') {
        return { ...resolved, type: 'select', options: appointmentStatusOptions, optionColors: appointmentStatusColors };
      }
      if (normalizedTableKey === 'people') {
        const leadField = LEAD_FIELDS.find((f) => f.key === nestedFieldKey);
        if (leadField?.options?.length) return { ...leadField, ...resolved, type: 'select', options: leadField.options };
      }
      if (resolved.options?.length) return { ...resolved, type: 'select' };
      return resolved;
    }
  }

  const variable = availableVariables.find((item) => [item.reference, item.displayRef, item.key]
    .some((candidate) => String(candidate || '').replace(/^\{\{\s*|\s*\}\}$/g, '') === unwrappedFieldKey));
  if (variable) {
    if (String(variable.key || '').split('.').pop() === 'appointment_status') {
      return { type: 'select', options: appointmentStatusOptions, optionColors: appointmentStatusColors };
    }
    const customField = getPeopleCustomVariableFields().find((item) => item.key === variable.key);
    const variableFieldKey = String(variable.key || '').split('.').pop();
    const knownField = [...contextFields, ...DEFAULT_FIELDS, ...LEAD_FIELDS]
      .find((item) => item.key === variableFieldKey && item.type !== '__section');
    const leadField = LEAD_FIELDS.find((item) => item.key === variableFieldKey);
    const metadata = customField || leadField || knownField || variable;
    if (metadata.options?.length) return { ...metadata, type: 'select' };
    return metadata;
  }

  // Context fields include the shared CRM and communication field definitions.
  return LEAD_FIELDS.find((field) => field.key === normalizedFieldKey || field.key === unwrappedFieldKey);
};

const getOperatorOptions = (field) => OPERATORS_BY_TYPE[field?.type] || OPERATORS_BY_TYPE.text;

const defaultOperatorForField = (field) => {
  const operators = getOperatorOptions(field);
  return operators[0]?.value || 'equals';
};

const DATE_OPERATORS = new Set(['before', 'after', 'on_or_before', 'on_or_after']);

const getValueComponent = ({ field, rule, onUpdateRule, onFieldFocus, mobile, menuOpen, setMenuOpen }) => {
  const valStr = String(rule.value || '');
  const hasChips = valStr.includes('{{');
  const isDisabled = rule.operator === 'is_empty' || rule.operator === 'is_not_empty';
  const isDateInput = DATE_OPERATORS.has(rule.operator) || field?.type === 'date' || field?.type === 'timestamp';
  const options = Array.isArray(field?.options) ? field.options.map((option) => ({
    value: typeof option === 'string' ? option : option?.value,
    label: typeof option === 'string' ? option : (option?.label || option?.value),
    color: typeof option === 'object' ? option?.color : undefined,
  })).filter((option) => option.value !== undefined && option.value !== null) : [];
  const selectedOption = options.find((option) => String(option.value).toLowerCase() === valStr.toLowerCase());
  const canSelect = field?.type === 'select' && options.length > 0 && !hasChips;
  const colors = { Pending: '#f59e0b', Confirmed: '#06b6d4', Completed: '#10b981', Missed: '#f97316', Cancelled: '#ef4444', ...field?.optionColors };
  const getOptionColor = (option) => option.color || colors[option.value] || colors[String(option.value).replace(/\b\w/g, (char) => char.toUpperCase())] || '#71717a';
  const inputType = !hasChips && isDateInput ? 'date' : 'text';
  return (
    <>
      {canSelect ? (
        <div className="sb-crm-select-shell aether-condition-value-select">
          <button
            type="button"
            className={`sb-crm-select-trigger ${valStr ? 'has-value' : ''}`}
            aria-label="Condition value"
            aria-expanded={Boolean(menuOpen)}
            onClick={(event) => setMenuOpen(rule.id, event.currentTarget)}
            disabled={isDisabled}
          >
            <span className="sb-crm-dot" style={{ backgroundColor: selectedOption ? getOptionColor(selectedOption) : '#71717a' }} />
            <span>{selectedOption?.label || valStr || 'Select...'}</span>
          </button>
          {menuOpen?.ruleId === rule.id && createPortal(
            <div
              className="sb-crm-menu aether-condition-value-menu"
              role="listbox"
              aria-label="Condition values"
              style={menuOpen.style}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {options.map((option) => {
                const active = String(option.value).toLowerCase() === valStr.toLowerCase();
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`sb-crm-menu-item ${active ? 'is-active' : ''}`}
                    onClick={() => { onUpdateRule(rule.id, 'value', option.value); setMenuOpen(null); }}
                  >
                    <span className="sb-crm-dot" style={{ backgroundColor: getOptionColor(option) }} />
                    {option.label}
                    {active && <Check size={11} className="sb-crm-check" />}
                  </button>
                );
              })}
            </div>,
            document.body,
          )}
        </div>
      ) : <input
        className="sb-input-field"
        type={inputType}
        aria-label="Condition value"
        placeholder={mobile ? 'Value' : undefined}
        value={rule.value ?? ''}
        onChange={(event) => onUpdateRule(rule.id, 'value', event.target.value)}
        onFocus={(event) => onFieldFocus?.(rule.id, 'value', event.target)}
        disabled={isDisabled}
        style={isDisabled ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
      />}
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
  appointmentStatusOptions = [],
  appointmentStatusColors = {},
  fallbackAction = '',
  onFallbackChange,
  isFallback = false,
  onToggleFallback,
  draggable = true,
  mobile = false,
}) => {
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startPosTop: 0, startPosLeft: 0 });
  const valueInputRefs = useRef(new Map());
  const [openValueMenu, setOpenValueMenu] = useState(null);

  useEffect(() => {
    if (!openValueMenu) return undefined;
    const closeOnOutsidePointer = (event) => {
      if (event.target.closest?.('.aether-condition-value-select, .aether-condition-value-menu')) return;
      setOpenValueMenu(null);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpenValueMenu(null);
    };
    const closeOnScroll = () => setOpenValueMenu(null);
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', closeOnScroll);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', closeOnScroll);
    };
  }, [openValueMenu]);

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
    if (!draggable) return;
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
  }, [draggable, position.top, position.left]);

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
        <div className="aether-panel-header" onPointerDown={handleHeaderPointerDown} style={{ cursor: draggable ? 'move' : 'default', userSelect: 'none' }}>
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
            const field = getField(rule.variable, selectableFields, availableVariables, appointmentStatusOptions, appointmentStatusColors);
            const operators = getOperatorOptions(field);
            return (
              <React.Fragment key={rule.id}>
                {idx > 0 && <span className={`aether-rule-logic-pill ${rule.logic === 'or' ? 'aether-rule-logic-pill--or' : ''}`}>{(rule.logic || 'and').toUpperCase()}</span>}
                <div className="aether-rule-row" style={{ position: 'relative' }}>
                  <input
                    className="aether-rule-select"
                    type="text"
                    aria-label="Condition variable"
                    placeholder={mobile ? 'Variable or {{field}}' : undefined}
                    value={rule.variable}
                    onChange={(event) => {
                      const nextField = getField(event.target.value, selectableFields);
                      onUpdateRule(rule.id, 'variable', event.target.value);
                      onUpdateRule(rule.id, 'operator', defaultOperatorForField(nextField));
                      onUpdateRule(rule.id, 'value', '');
                    }}
                    onFocus={(event) => {
                      if (typeof onFieldFocus === 'function') {
                        onFieldFocus(rule.id, 'variable', event.target);
                      }
                    }}
                  />
                  {rule.variable && rule.variable.includes('{{') && (
                    <div
                      className="sb-var-chip-overlay"
                      style={{
                        position: 'absolute', inset: 0, left: 13, pointerEvents: 'none',
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
                    onChange={(event) => {
                      const nextOperator = event.target.value;
                      onUpdateRule(rule.id, 'operator', nextOperator);
                      if (DATE_OPERATORS.has(nextOperator)) {
                        window.requestAnimationFrame(() => {
                          const input = valueInputRefs.current.get(rule.id);
                          if (!input) return;
                          input.focus();
                          if (typeof input.showPicker === 'function') {
                            try {
                              input.showPicker();
                            } catch {}
                          }
                        });
                      }
                    }}
                  >
                    {operators.map((operator) => (
                      <option key={operator.value} value={operator.value}>
                        {operator.label}
                      </option>
                    ))}
                  </select>
                  <div className="aether-rule-value">
                    {getValueComponent({
                      field,
                      rule,
                      onUpdateRule,
                      mobile,
                      onFieldFocus: (ruleId, fieldKey, inputEl) => {
                        if (fieldKey === 'value') {
                          valueInputRefs.current.set(ruleId, inputEl);
                        }
                        onFieldFocus?.(ruleId, fieldKey, inputEl);
                      },
                      menuOpen: openValueMenu,
                      setMenuOpen: (ruleId, trigger) => {
                        if (!ruleId) {
                          setOpenValueMenu(null);
                          return;
                        }
                        const current = openValueMenu;
                        if (current?.ruleId === ruleId) {
                          setOpenValueMenu(null);
                          return;
                        }
                        const rect = trigger?.getBoundingClientRect?.();
                        if (!rect) return;
                        const optionCount = field?.options?.length || 0;
                        const estimatedHeight = Math.min(optionCount * 32 + 8, window.innerHeight - 16);
                        const opensAbove = rect.bottom + estimatedHeight + 6 > window.innerHeight && rect.top > estimatedHeight + 6;
                        setOpenValueMenu({
                          ruleId,
                          style: {
                            position: 'fixed',
                            top: opensAbove ? Math.max(8, rect.top - estimatedHeight - 6) : rect.bottom + 6,
                            left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
                            width: rect.width,
                            maxHeight: 'calc(100vh - 16px)',
                          },
                        });
                      },
                    })}
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
