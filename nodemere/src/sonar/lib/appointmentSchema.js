export const titleCase = (value) => {
  if (value == null) return '';
  return String(value)
    .trim()
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export const normalizeOptionValue = (value) => {
  if (value == null || value === '') return value;
  if (typeof value !== 'string') return value;
  return titleCase(value);
};

export const STATUS_OPTIONS = [
  { value: 'Pending', color: 'amber' },
  { value: 'Confirmed', color: 'cyan' },
  { value: 'Completed', color: 'emerald' },
  { value: 'Missed', color: 'rose' },
  { value: 'Cancelled', color: 'fuchsia' },
];

export const SOURCE_OPTIONS = [
  { value: 'Phone', color: 'cyan' },
  { value: 'Text', color: 'emerald' },
  { value: 'Email', color: 'indigo' },
  { value: 'Website', color: 'blue' },
  { value: 'Referral', color: 'amber' },
  { value: 'Walk-In', color: 'fuchsia' },
  { value: 'Manual', color: 'zinc' },
  { value: 'Scenario', color: 'orange' },
];

export const APPOINTMENT_FIELDS = [
  { key: 'person_id', label: 'Customer / Person', type: 'person_lookup', required: false, table: true, tableWidth: '220px', section: 'appointment', editable: true },
  { key: 'service_id', label: 'Service', type: 'service_lookup', required: false, table: true, tableWidth: '180px', section: 'appointment', editable: true },
  { key: 'date', label: 'Date', type: 'date', required: true, table: true, tableWidth: '150px', section: 'schedule', editable: true },
  { key: 'time', label: 'Start Time', type: 'time', required: true, table: true, tableWidth: '130px', section: 'schedule', editable: true },
  { key: 'duration', label: 'Duration', type: 'number', min: 0, max: 1440, required: false, table: false, tableWidth: '120px', section: 'schedule', editable: true },
  { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, required: false, table: true, tableWidth: '140px', section: 'appointment', editable: true },
  { key: 'source', label: 'Source', type: 'select', options: SOURCE_OPTIONS, required: false, table: false, tableWidth: '140px', section: 'appointment', editable: true },
  { key: 'notes', label: 'Notes', type: 'textarea', required: false, table: true, tableWidth: '280px', section: 'notes', editable: true },
  { key: 'receptionist_id', label: 'Assigned Receptionist', type: 'receptionist_lookup', required: false, table: true, tableWidth: '190px', section: 'assignment', editable: true },
  { key: 'scenario_id', label: 'Scenario', type: 'text', required: false, table: false, tableWidth: '180px', section: 'system', editable: false },
  { key: 'created_at', label: 'Created At', type: 'timestamp', required: false, table: true, tableWidth: '160px', section: 'system', editable: false },
  { key: 'updated_at', label: 'Updated At', type: 'timestamp', required: false, table: true, tableWidth: '160px', section: 'system', editable: false },
];

export const TABLE_COLUMNS = APPOINTMENT_FIELDS.filter((field) => field.table);

export const getFieldDef = (key) => APPOINTMENT_FIELDS.find((field) => field.key === key);

export const formatTimestamp = (iso) => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
  } catch {
    return '-';
  }
};

export const formatTimestampFull = (iso) => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York',
    });
  } catch {
    return '-';
  }
};

export const formatDate = (value) => {
  if (!value) return '-';
  try {
    return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return value;
  }
};

export const formatTime = (value) => {
  if (!value) return '-';
  const [hourRaw, minuteRaw] = String(value).split(':');
  const hourNum = Number(hourRaw);
  const minuteNum = Number(minuteRaw ?? 0);
  if (!Number.isFinite(hourNum) || !Number.isFinite(minuteNum)) return value;
  const ampm = hourNum >= 12 ? 'PM' : 'AM';
  const hour12 = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
  return `${hour12}:${String(minuteNum).padStart(2, '0')} ${ampm}`;
};

export const computeEndTime = (time, duration) => {
  if (!time) return '';
  const [hoursRaw, minutesRaw] = String(time).split(':');
  const totalMinutes = (Number(hoursRaw) * 60) + Number(minutesRaw || 0) + Number(duration || 0);
  if (!Number.isFinite(totalMinutes)) return '';
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const nextHours = Math.floor(normalized / 60);
  const nextMinutes = normalized % 60;
  return `${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`;
};
