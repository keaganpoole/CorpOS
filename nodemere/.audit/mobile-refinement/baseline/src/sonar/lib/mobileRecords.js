// Presentation helpers shared by the mobile CRM views. Keep record values intact.
export const optionFor = (option) => option != null && typeof option === 'object'
  ? { value: option.value ?? option.id, label: option.label ?? option.display_name ?? option.name ?? option.value ?? option.id }
  : { value: option, label: option };

export const isEmpty = (value) => value == null || value === '' || Array.isArray(value) && value.length === 0;

export const localDateTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export const formatValue = (value, field) => {
  if (isEmpty(value)) return 'Not provided';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (field.type === 'select') return (field.options || []).map(optionFor).find((option) => String(option.value).toLowerCase() === String(value).toLowerCase())?.label || String(value);
  if (field.type === 'timestamp' || field.type === 'date') {
    const date = new Date(field.type === 'date' ? `${value}T12:00:00` : value);
    if (Number.isNaN(date.getTime())) return String(value);
    return field.type === 'date' ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : date.toLocaleString();
  }
  if (field.type === 'time') {
    const [h, m] = String(value).split(':');
    return `${Number(h) % 12 || 12}:${m || '00'} ${Number(h) >= 12 ? 'PM' : 'AM'}`;
  }
  return String(value);
};

export const matchesRecordFilter = (record, kind, filter) => filter === 'all' || (kind === 'person'
  ? record.do_not_call === (filter === 'do-not-call')
  : String(record.status).toLowerCase() === filter);
