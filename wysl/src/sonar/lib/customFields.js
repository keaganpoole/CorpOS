const CUSTOM_FIELDS_KEY = 'SONAR_people_custom_fields';
const CUSTOM_FIELD_VALUES_KEY = 'SONAR_people_custom_field_values';

export const CUSTOM_FIELD_PREFIX = 'custom_';

export const CUSTOM_FIELD_TYPES = [
  { type: 'boolean', label: 'Boolean', icon: 'toggle' },
  { type: 'text', label: 'Text', icon: 'type' },
  { type: 'number', label: 'Number', icon: 'hash' },
  { type: 'date', label: 'Date', icon: 'calendar' },
];

const titleCase = (value) => String(value || '')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b\w/g, (char) => char.toUpperCase());

const safeParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export const loadCustomFields = () => {
  const fields = safeParse(localStorage.getItem(CUSTOM_FIELDS_KEY), []);
  return Array.isArray(fields) ? fields : [];
};

export const saveCustomFields = (fields) => {
  localStorage.setItem(CUSTOM_FIELDS_KEY, JSON.stringify(fields));
};

export const loadCustomFieldValues = () => {
  const values = safeParse(localStorage.getItem(CUSTOM_FIELD_VALUES_KEY), {});
  return values && typeof values === 'object' && !Array.isArray(values) ? values : {};
};

export const saveCustomFieldValues = (values) => {
  localStorage.setItem(CUSTOM_FIELD_VALUES_KEY, JSON.stringify(values));
};

export const isCustomFieldKey = (key) => typeof key === 'string' && key.startsWith(CUSTOM_FIELD_PREFIX);

export const createCustomField = (type, existingFields = []) => {
  const countForType = existingFields.filter((field) => field.type === type).length + 1;
  const createdAt = Date.now();
  return {
    key: `${CUSTOM_FIELD_PREFIX}${type}_${createdAt}`,
    label: `${titleCase(type)} Field ${countForType}`,
    type,
    table: true,
    editable: true,
    tableWidth: {
      boolean: '110px',
      text: '180px',
      number: '120px',
      date: '150px',
    }[type] || '160px',
    createdAt,
  };
};

export const getCustomValue = (values, leadId, fieldKey) => values?.[leadId]?.[fieldKey];

export const setCustomValue = (values, leadId, fieldKey, value) => {
  const next = { ...values };
  const rowValues = { ...(next[leadId] || {}) };

  if (value == null || value === '') {
    delete rowValues[fieldKey];
  } else {
    rowValues[fieldKey] = value;
  }

  if (Object.keys(rowValues).length === 0) {
    delete next[leadId];
  } else {
    next[leadId] = rowValues;
  }

  return next;
};
