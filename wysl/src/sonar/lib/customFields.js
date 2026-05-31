import { supabase } from './supabase';

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

export const isCustomFieldKey = (key) => typeof key === 'string' && key.startsWith(CUSTOM_FIELD_PREFIX);

export const getCurrentBusinessId = async () => {
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
    table: true,
    editable: true,
    tableWidth: field.config?.tableWidth || {
      boolean: '110px',
      text: '180px',
      number: '120px',
      date: '150px',
    }[field.field_type] || '160px',
    position: field.position ?? 0,
    config: field.config || {},
    id: field.id,
    createdAt: field.created_at,
  }));
};

export const createCustomField = async (type, existingFields = [], businessId) => {
  const countForType = existingFields.filter((field) => field.type === type).length + 1;
  const fieldKey = `${CUSTOM_FIELD_PREFIX}${type}_${Date.now()}`;
  const label = `${titleCase(type)} Field ${countForType}`;
  const position = existingFields.length;
  const tableWidth = {
    boolean: '110px',
    text: '180px',
    number: '120px',
    date: '150px',
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
      config: { tableWidth, description: '' },
    })
    .select()
    .single();

  if (error) throw error;

  return {
    key: data.field_key,
    label: data.label,
    description: data.config?.description || '',
    type: data.field_type,
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
      return supabase
        .from('people')
        .update({ custom_fields: nextCustomFields })
        .eq('id', row.id);
    });

  if (updates.length) {
    const results = await Promise.all(updates);
    const failed = results.find(({ error }) => error);
    if (failed?.error) throw failed.error;
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
