import { supabase } from './supabase';
import { api } from './api';

export const CUSTOM_FIELD_PREFIX = 'custom_';

export const CUSTOM_FIELD_TYPES = [
  { type: 'boolean', label: 'Yes/No', icon: 'toggle' },
  { type: 'text', label: 'Text', icon: 'type' },
  { type: 'number', label: 'Number', icon: 'hash' },
  { type: 'date', label: 'Date', icon: 'calendar' },
  { type: 'select', label: 'Single Select', icon: 'tag' },
  { type: 'multi_select', label: 'Multi Select', icon: 'layers' },
];

export const SPECIAL_FIELD_TYPES = [
  { type: 'docs', label: 'Docs', icon: 'file-text' },
];

const titleCase = (value) => String(value || '')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b\w/g, (char) => char.toUpperCase());

export const isCustomFieldKey = (key) => typeof key === 'string' && key.startsWith(CUSTOM_FIELD_PREFIX);

let businessIdRequest = null;

export const getCurrentBusinessId = async () => {
  if (businessIdRequest) return businessIdRequest;

  businessIdRequest = (async () => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('User not found');

  const { data, error } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error('Business not found');
  return data.id;
  })().finally(() => { businessIdRequest = null; });

  return businessIdRequest;
};

export const fetchCustomFields = async (businessId) => {
  const { data, error } = await supabase
    .from('people_schema')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || []).map((field) => ({
    key: field.field_key,
    label: field.label,
    description: field.config?.description || '',
    type: field.field_type,
    options: Array.isArray(field.config?.options) ? field.config.options : [],
    table: true,
    editable: true,
    tableWidth: field.config?.tableWidth || {
      boolean: '110px',
      text: '180px',
      number: '120px',
      date: '150px',
      select: '140px',
      multi_select: '220px',
      docs: '240px',
    }[field.field_type] || '160px',
    position: field.position ?? 0,
    config: field.config || {},
    id: field.id,
    createdAt: field.created_at,
  }));
};

export const createCustomField = async (type, existingFields = [], businessId) => {
  if (type === 'docs' && existingFields.some((field) => field.type === 'docs')) {
    throw new Error('The Docs column has already been added.');
  }
  const countForType = existingFields.filter((field) => field.type === type).length + 1;
  const fieldKey = `${CUSTOM_FIELD_PREFIX}${type}_${Date.now()}`;
  const label = type === 'docs' ? 'Docs' : `${titleCase(type)} Field ${countForType}`;
  const position = existingFields.length;
  const tableWidth = {
    boolean: '110px',
    text: '180px',
    number: '120px',
    date: '150px',
    select: '140px',
    multi_select: '220px',
    docs: '240px',
  }[type] || '160px';

  const { data, error } = await supabase
    .from('people_schema')
    .insert({
      business_id: businessId,
      field_key: fieldKey,
      label,
      field_type: type,
      position,
      is_active: true,
      config: { tableWidth, description: '', options: [] },
    })
    .select()
    .single();

  if (error) throw error;

  return {
    key: data.field_key,
    label: data.label,
    description: data.config?.description || '',
    type: data.field_type,
    options: Array.isArray(data.config?.options) ? data.config.options : [],
    table: true,
    editable: true,
    tableWidth,
    position: data.position ?? position,
    config: data.config || {},
    id: data.id,
    createdAt: data.created_at,
  };
};

export const updateCustomField = async (fieldKey, businessId, updates = {}) => {
  const dbUpdates = {};
  if (updates.label != null) dbUpdates.label = updates.label;
  if (updates.position != null) dbUpdates.position = updates.position;
  if (updates.config != null) dbUpdates.config = updates.config;
  if (updates.is_active != null) dbUpdates.is_active = updates.is_active;

  const { data, error } = await supabase
    .from('people_schema')
    .update(dbUpdates)
    .eq('business_id', businessId)
    .eq('field_key', fieldKey)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateCustomFieldPositions = async (businessId, orderedFieldKeys = []) => {
  await Promise.all(
    orderedFieldKeys.map((fieldKey, index) => updateCustomField(fieldKey, businessId, { position: index }))
  );
};

export const deleteCustomField = async (fieldKey, businessId) => {
  if (!fieldKey || !businessId) throw new Error('fieldKey and businessId are required');

  const { error: schemaError } = await supabase
    .from('people_schema')
    .delete()
    .eq('business_id', businessId)
    .eq('field_key', fieldKey);

  if (schemaError) throw schemaError;

  const { data: peopleRows, error: peopleError } = await supabase
    .from('people')
    .select('id,custom_fields')
    .eq('business_id', businessId);

  if (peopleError) throw peopleError;

  const updates = (peopleRows || [])
    .filter((row) => row?.custom_fields && Object.prototype.hasOwnProperty.call(row.custom_fields, fieldKey))
    .map((row) => {
      const nextCustomFields = { ...(row.custom_fields || {}) };
      delete nextCustomFields[fieldKey];
      return api.updatePerson(row.id, { custom_fields: nextCustomFields });
    });

  if (updates.length) {
    await Promise.all(updates);
  }
};

export const syncCustomFieldOptionValues = async (fieldKey, businessId, previousOptions = [], nextOptions = [], fieldType) => {
  if (!fieldKey || !businessId) throw new Error('fieldKey and businessId are required');
  if (!['select', 'multi_select'].includes(fieldType)) return;

  const renameMap = new Map();
  previousOptions.forEach((previousOption, index) => {
    const nextOption = nextOptions[index];
    if (previousOption && nextOption && previousOption !== nextOption) {
      renameMap.set(previousOption, nextOption);
    }
  });

  const allowedOptions = new Set(nextOptions.filter(Boolean));

  const { data: peopleRows, error: peopleError } = await supabase
    .from('people')
    .select('id,custom_fields')
    .eq('business_id', businessId);

  if (peopleError) throw peopleError;

  const updates = (peopleRows || []).flatMap((row) => {
    const currentValue = row?.custom_fields?.[fieldKey];
    if (currentValue == null) return [];

    let nextValue = currentValue;

    if (fieldType === 'select') {
      nextValue = renameMap.get(currentValue) || currentValue;
      if (!allowedOptions.has(nextValue)) nextValue = null;
    }

    if (fieldType === 'multi_select') {
      const currentArray = Array.isArray(currentValue) ? currentValue : [];
      const remapped = currentArray
        .map((item) => renameMap.get(item) || item)
        .filter((item) => allowedOptions.has(item));
      nextValue = remapped.length ? remapped : null;
    }

    if (JSON.stringify(nextValue) === JSON.stringify(currentValue)) return [];

    const nextCustomFields = { ...(row.custom_fields || {}) };
    if (nextValue == null || (Array.isArray(nextValue) && nextValue.length === 0)) {
      delete nextCustomFields[fieldKey];
    } else {
      nextCustomFields[fieldKey] = nextValue;
    }

    return [api.updatePerson(row.id, { custom_fields: nextCustomFields })];
  });

  if (updates.length) {
    await Promise.all(updates);
  }
};

export const getCustomValue = (rowCustomFields, fieldKey) => rowCustomFields?.[fieldKey];

export const setCustomFieldValue = (rowCustomFields, fieldKey, value) => {
  const next = { ...(rowCustomFields || {}) };
  if (value == null || value === '') {
    delete next[fieldKey];
  } else {
    next[fieldKey] = value;
  }
  return next;
};
