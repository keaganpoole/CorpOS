// ─── People Field Schema & Constants ────────────────────────────────────────
// Central source of truth for the Sonar people CRM table.

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

export const normalizeMultiSelectValue = (value) => {
  if (!Array.isArray(value)) return null;
  const normalized = value
    .map((item) => normalizeOptionValue(item))
    .filter(Boolean);
  return normalized.length > 0 ? normalized : null;
};

export const STATUS_OPTIONS = [
  { value: 'New', color: 'blue' },
  { value: 'Contacted', color: 'amber' },
  { value: 'Active', color: 'cyan' },
  { value: 'Callback Needed', color: 'orange' },
  { value: 'Booked', color: 'emerald' },
  { value: 'Transferred', color: 'fuchsia' },
  { value: 'Closed', color: 'emerald' },
  { value: 'Do Not Contact', color: 'rose' },
  { value: 'Inactive', color: 'zinc' },
];

export const SOURCE_OPTIONS = [
  { value: 'Phone', color: 'cyan' },
  { value: 'Text', color: 'emerald' },
  { value: 'Email', color: 'indigo' },
  { value: 'Website', color: 'blue' },
  { value: 'Referral', color: 'amber' },
  { value: 'Walk-In', color: 'fuchsia' },
  { value: 'Manual', color: 'zinc' },
];

export const CONTACT_METHOD_OPTIONS = [
  { value: 'Call', color: 'cyan' },
  { value: 'Text', color: 'emerald' },
  { value: 'Email', color: 'indigo' },
  { value: 'Any', color: 'zinc' },
];

export const CALL_STATUS_OPTIONS = [
  { value: 'Answered', color: 'emerald' },
  { value: 'Missed', color: 'rose' },
  { value: 'Voicemail', color: 'amber' },
  { value: 'Transferred', color: 'fuchsia' },
  { value: 'Dropped', color: 'zinc' },
];

export const OUTCOME_OPTIONS = [
  { value: 'Booked', color: 'emerald' },
  { value: 'Transferred', color: 'fuchsia' },
  { value: 'Callback Needed', color: 'orange' },
  { value: 'Voicemail Left', color: 'amber' },
  { value: 'Resolved', color: 'cyan' },
  { value: 'Unresolved', color: 'rose' },
];

export const SMS_STATUS_OPTIONS = [
  { value: 'Sent', color: 'blue' },
  { value: 'Delivered', color: 'cyan' },
  { value: 'Read', color: 'emerald' },
  { value: 'Replied', color: 'fuchsia' },
  { value: 'Failed', color: 'rose' },
];

export const EMAIL_STATUS_OPTIONS = [
  { value: 'Sent', color: 'blue' },
  { value: 'Delivered', color: 'cyan' },
  { value: 'Opened', color: 'emerald' },
  { value: 'Replied', color: 'fuchsia' },
  { value: 'Failed', color: 'rose' },
];

export const PAYMENT_STATUS_OPTIONS = [
  { value: 'None', color: 'zinc' },
  { value: 'Pending', color: 'amber' },
  { value: 'Paid', color: 'emerald' },
  { value: 'Failed', color: 'rose' },
  { value: 'Refunded', color: 'indigo' },
];

export const CALL_ROUTE_OPTIONS = [
  { value: 'Default', color: 'zinc' },
  { value: 'Front Desk', color: 'cyan' },
  { value: 'Billing', color: 'amber' },
  { value: 'Callback', color: 'fuchsia' },
  { value: 'Urgent', color: 'rose' },
  { value: 'Voicemail', color: 'indigo' },
];

export const TAG_OPTIONS = [
  'VIP',
  'Callback',
  'Spanish',
  'Urgent',
  'Billing',
  'New',
  'Follow Up',
  'Existing Customer',
  'Do Not Disturb',
];

export const LEAD_FIELDS = [
  // Identity
  { key: 'first_name', label: 'First Name', type: 'text', required: false, table: false, section: 'identity', editable: true },
  { key: 'last_name', label: 'Last Name', type: 'text', required: false, table: false, section: 'identity', editable: true },

  // Contact
  { key: 'phone', label: 'Phone', type: 'phone', required: false, table: true, tableWidth: '150px', section: 'contact', editable: true },
  { key: 'email', label: 'Email', type: 'email', required: false, table: true, tableWidth: '210px', section: 'contact', editable: true },
  { key: 'street_address', label: 'Street Address', type: 'text', required: false, table: false, section: 'contact', editable: true },
  { key: 'city', label: 'City', type: 'text', required: false, table: false, section: 'contact', editable: true },
  { key: 'state', label: 'State', type: 'text', required: false, table: false, section: 'contact', editable: true },
  { key: 'zip_code', label: 'Zip Code', type: 'text', required: false, table: false, section: 'contact', editable: true },

  // Preferences
  {
    key: 'preferred_contact_method',
    label: 'Preferred Contact Method',
    type: 'select',
    options: CONTACT_METHOD_OPTIONS,
    required: false,
    table: true,
    tableWidth: '150px',
    section: 'preferences',
    editable: true,
  },
  { key: 'preferred_language', label: 'Preferred Language', type: 'text', required: false, table: false, section: 'preferences', editable: true },
  { key: 'best_time_to_contact', label: 'Best Time To Contact', type: 'text', required: false, table: false, section: 'preferences', editable: true },

  // Consent
  { key: 'consent_sms', label: 'Consent SMS', type: 'boolean', required: false, table: false, section: 'consent', editable: true },
  { key: 'consent_call', label: 'Consent Call', type: 'boolean', required: false, table: false, section: 'consent', editable: true },
  { key: 'do_not_call', label: 'Do Not Call', type: 'boolean', required: false, table: false, section: 'consent', editable: true },
  { key: 'do_not_text', label: 'Do Not Text', type: 'boolean', required: false, table: false, section: 'consent', editable: true },

  // CRM
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: STATUS_OPTIONS,
    required: false,
    table: true,
    tableWidth: '140px',
    section: 'crm',
    editable: true,
  },
  {
    key: 'source',
    label: 'Source',
    type: 'select',
    options: SOURCE_OPTIONS,
    required: false,
    table: true,
    tableWidth: '120px',
    section: 'crm',
    editable: true,
  },
  { key: 'lead_source_detail', label: 'Source Detail', type: 'text', required: false, table: false, section: 'crm', editable: true },
  {
    key: 'tags',
    label: 'Tags',
    type: 'multi_select',
    options: TAG_OPTIONS,
    required: false,
    table: true,
    tableWidth: '220px',
    section: 'crm',
    editable: true,
  },
  { key: 'created_at', label: 'Created', type: 'timestamp', required: false, table: true, tableWidth: '120px', section: 'crm', editable: false },
  { key: 'updated_at', label: 'Updated', type: 'timestamp', required: false, table: false, section: 'crm', editable: false },

  // Activity
  { key: 'last_inbound_call_at', label: 'Last Inbound Call', type: 'timestamp', required: false, table: false, section: 'activity', editable: false },
  { key: 'last_outbound_call_at', label: 'Last Outbound Call', type: 'timestamp', required: false, table: false, section: 'activity', editable: false },
  {
    key: 'last_call_status',
    label: 'Last Call Status',
    type: 'select',
    options: CALL_STATUS_OPTIONS,
    required: false,
    table: true,
    tableWidth: '140px',
    section: 'activity',
    editable: true,
  },
  { key: 'last_intent', label: 'Last Intent', type: 'text', required: false, table: true, tableWidth: '180px', section: 'activity', editable: true },
  {
    key: 'last_outcome',
    label: 'Last Outcome',
    type: 'select',
    options: OUTCOME_OPTIONS,
    required: false,
    table: true,
    tableWidth: '160px',
    section: 'activity',
    editable: true,
  },
  { key: 'missed_call_count', label: 'Missed Call Count', type: 'number', min: 0, max: 999, required: false, table: false, section: 'activity', editable: true },
  { key: 'last_inbound_sms_at', label: 'Last Inbound SMS', type: 'timestamp', required: false, table: false, section: 'activity', editable: false },
  { key: 'last_outbound_sms_at', label: 'Last Outbound SMS', type: 'timestamp', required: false, table: false, section: 'activity', editable: false },
  {
    key: 'last_sms_status',
    label: 'Last SMS Status',
    type: 'select',
    options: SMS_STATUS_OPTIONS,
    required: false,
    table: false,
    section: 'activity',
    editable: true,
  },
  { key: 'last_inbound_email_at', label: 'Last Inbound Email', type: 'timestamp', required: false, table: false, section: 'activity', editable: false },
  { key: 'last_outbound_email_at', label: 'Last Outbound Email', type: 'timestamp', required: false, table: false, section: 'activity', editable: false },
  {
    key: 'last_email_status',
    label: 'Last Email Status',
    type: 'select',
    options: EMAIL_STATUS_OPTIONS,
    required: false,
    table: false,
    section: 'activity',
    editable: true,
  },

  // Routing
  { key: 'callback_needed', label: 'Callback Needed', type: 'boolean', required: false, table: false, section: 'routing', editable: true },
  { key: 'callback_due_at', label: 'Callback Due At', type: 'timestamp', required: false, table: true, tableWidth: '150px', section: 'routing', editable: true },
  { key: 'handoff_required', label: 'Handoff Required', type: 'boolean', required: false, table: false, section: 'routing', editable: true },
  { key: 'assigned_staff', label: 'Assigned Staff', type: 'text', required: false, table: true, tableWidth: '160px', section: 'routing', editable: true },
  {
    key: 'call_route',
    label: 'Call Route',
    type: 'select',
    options: CALL_ROUTE_OPTIONS,
    required: false,
    table: false,
    section: 'routing',
    editable: true,
  },

  // Financial
  {
    key: 'payment_status',
    label: 'Payment Status',
    type: 'select',
    options: PAYMENT_STATUS_OPTIONS,
    required: false,
    table: true,
    tableWidth: '130px',
    section: 'financial',
    editable: true,
  },
  { key: 'balance_due', label: 'Balance Due', type: 'currency', required: false, table: true, tableWidth: '120px', section: 'financial', editable: true },
  { key: 'invoice_id', label: 'Invoice ID', type: 'text', required: false, table: false, section: 'financial', editable: true },

  // Notes
  { key: 'notes', label: 'Notes', type: 'textarea', required: false, table: false, section: 'notes', editable: true, appendOnly: true, description: 'Append only - never replace existing notes' },
  { key: 'special_instructions', label: 'Special Instructions', type: 'textarea', required: false, table: false, section: 'notes', editable: true },
];

export const DETAIL_SECTIONS = [
  { key: 'identity', label: 'Identity', icon: 'user' },
  { key: 'contact', label: 'Contact', icon: 'phone' },
  { key: 'preferences', label: 'Preferences', icon: 'compass' },
  { key: 'consent', label: 'Consent', icon: 'shield' },
  { key: 'crm', label: 'CRM', icon: 'activity' },
  { key: 'activity', label: 'Activity', icon: 'clock' },
  { key: 'routing', label: 'Routing', icon: 'target' },
  { key: 'financial', label: 'Financial', icon: 'dollar' },
  { key: 'notes', label: 'Notes', icon: 'file-text' },
];

export const TABLE_COLUMNS = LEAD_FIELDS.filter((field) => field.table);

export const getFieldDef = (key) => LEAD_FIELDS.find((field) => field.key === key);
export const getSectionFields = (sectionKey) => LEAD_FIELDS.filter((field) => field.section === sectionKey);

export const formatCurrency = (val) => {
  if (val == null || val === '') return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (Number.isNaN(num)) return '—';
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export const formatTimestamp = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
  } catch {
    return '—';
  }
};

export const formatTimestampFull = (iso) => {
  if (!iso) return '—';
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
    return '—';
  }
};

export const getStatusColor = (status) => {
  const normalized = titleCase(status).toLowerCase();
  const opt = STATUS_OPTIONS.find((s) => s.value.toLowerCase() === normalized);
  return opt?.color || 'zinc';
};

export const capitalizeFirst = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const DEFAULT_STATUS = 'New';

export const getScoreColor = (score) => {
  if (score == null) return 'zinc';
  if (score < 40) return 'rose';
  if (score < 70) return 'amber';
  return 'emerald';
};
