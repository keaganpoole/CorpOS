// ─── Lead Field Schema & Constants ──────────────────────────────────────────
// Central source of truth for all lead field definitions, validation rules,
// select options, and display configuration. Keep this file in sync with the
// Supabase `leads` table schema.

export const STATUS_OPTIONS = [
  { value: 'Analyzing',        color: 'blue' },
  { value: 'Won',              color: 'emerald' },
  { value: 'Interested',       color: 'green' },
  { value: 'Aware',            color: 'amber' },
  { value: 'Contacted',        color: 'yellow' },
  { value: 'Not contacted',    color: 'zinc' },
  { value: 'Not interested',   color: 'rose' },
  { value: 'DNC',              color: 'red' },
];

export const SOURCE_OPTIONS = [
  { value: 'LinkedIn',           color: 'blue' },
  { value: 'Google Search',      color: 'blue' },
  { value: 'Google Maps',        color: 'blue' },
  { value: 'Manual Web Search',  color: 'blue' },
];

export const OPPORTUNITY_OPTIONS = [
  'Outdated Website',
  'Ugly Website',
  'Poor Functionality',
  'Limited Features',
  'No Website',
  'Not Mobile Friendly',
];

// ─── Field Definitions ─────────────────────────────────────────────────────
// type:       controls which input/widget renders
// key:        Supabase column name (snake_case)
// label:      Display name
// required:   Whether the field must be filled before save
// table:      Whether this column appears in the main table view
// tableWidth: CSS width hint for table column (if table: true)
// section:    Which section of the detail panel this belongs to
// editable:   Whether the field can be edited (some are restricted)
// appendOnly: If true, edits append to existing text rather than replace

export const LEAD_FIELDS = [
  // ── Identity ──
  {
    key: 'company',
    label: 'Company',
    type: 'text',
    required: true,
    table: true,
    tableWidth: 'minmax(160px, 1.5fr)',
    section: 'identity',
    editable: true,
  },
  {
    key: 'first_name',
    label: 'First Name',
    type: 'text',
    required: false,
    table: false,
    section: 'identity',
    editable: true,
  },
  {
    key: 'last_name',
    label: 'Last Name',
    type: 'text',
    required: false,
    table: false,
    section: 'identity',
    editable: true,
  },
  {
    key: 'position',
    label: 'Position',
    type: 'text',
    required: false,
    table: false,
    section: 'identity',
    editable: true,
  },
  {
    key: 'industry',
    label: 'Industry',
    type: 'text',
    required: false,
    table: true,
    tableWidth: '110px',
    section: 'identity',
    editable: true,
  },

  // ── Pipeline ──
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: STATUS_OPTIONS,
    required: false,
    table: true,
    tableWidth: '120px',
    section: 'pipeline',
    editable: true,
  },
  {
    key: 'source',
    label: 'Source',
    type: 'select',
    options: SOURCE_OPTIONS,
    required: false,
    table: true,
    tableWidth: '140px',
    section: 'pipeline',
    editable: true,
  },
  {
    key: 'opportunity',
    label: 'Opportunity',
    type: 'multi_select',
    options: OPPORTUNITY_OPTIONS,
    required: false,
    table: true,
    tableWidth: '180px',
    section: 'pipeline',
    editable: true,
  },
  {
    key: 'page_quality_score',
    label: 'Page Score',
    type: 'number',
    min: 0,
    max: 100,
    required: false,
    table: true,
    tableWidth: '90px',
    section: 'pipeline',
    editable: true,
  },

  // ── Financial ──
  {
    key: 'proposal_value',
    label: 'Proposal Value',
    type: 'currency',
    required: false,
    table: true,
    tableWidth: '110px',
    section: 'financial',
    editable: true,
  },
  {
    key: 'revenue',
    label: 'Revenue',
    type: 'currency',
    required: false,
    table: true,
    tableWidth: '110px',
    section: 'financial',
    editable: true,
  },

  // ── Contact ──
  {
    key: 'email',
    label: 'Email',
    type: 'email',
    required: false,
    table: true,
    tableWidth: '180px',
    section: 'contact',
    editable: true,
  },
  {
    key: 'phone',
    label: 'Phone',
    type: 'phone',
    required: false,
    table: true,
    tableWidth: '130px',
    section: 'contact',
    editable: true,
  },
  {
    key: 'website',
    label: 'Website',
    type: 'url',
    required: false,
    table: false,
    section: 'contact',
    editable: true,
  },
  {
    key: 'city',
    label: 'City',
    type: 'text',
    required: false,
    table: true,
    tableWidth: '110px',
    section: 'contact',
    editable: true,
  },
  {
    key: 'state',
    label: 'State',
    type: 'text',
    required: false,
    table: true,
    tableWidth: '55px',
    section: 'contact',
    editable: true,
  },

  // ── Activity ──
  {
    key: 'date_created',
    label: 'Date Created',
    type: 'timestamp',
    required: false,
    table: true,
    tableWidth: '100px',
    section: 'activity',
    editable: false,
  },
  {
    key: 'last_contacted',
    label: 'Last Contacted',
    type: 'timestamp',
    required: false,
    table: false,
    section: 'activity',
    editable: true,
  },
  {
    key: 'last_responded',
    label: 'Last Responded',
    type: 'timestamp',
    required: false,
    table: false,
    section: 'activity',
    editable: true,
  },
  {
    key: 'last_interaction',
    label: 'Last Interaction',
    type: 'textarea',
    required: false,
    table: false,
    section: 'activity',
    editable: true,
  },

  // ── Intel ──
  {
    key: 'discovery',
    label: 'Discovery',
    type: 'textarea',
    required: false,
    table: true,
    tableWidth: '200px',
    section: 'intel',
    editable: true,
    description: 'Research team findings only',
  },
  {
    key: 'notes',
    label: 'Notes',
    type: 'textarea',
    required: false,
    table: false,
    section: 'intel',
    editable: true,
    appendOnly: true,
    description: 'Append only — never replace existing notes',
  },
];

// Detail panel sections
export const DETAIL_SECTIONS = [
  { key: 'identity',  label: 'Identity',   icon: 'user' },
  { key: 'pipeline',  label: 'Pipeline',   icon: 'activity' },
  { key: 'financial', label: 'Financials',  icon: 'dollar' },
  { key: 'contact',   label: 'Contact',     icon: 'mail' },
  { key: 'activity',  label: 'Activity',    icon: 'clock' },
  { key: 'intel',     label: 'Intel',       icon: 'eye' },
];

// Table columns (fields where table: true)
export const TABLE_COLUMNS = LEAD_FIELDS.filter(f => f.table);

// Lookup helpers
export const getFieldDef = (key) => LEAD_FIELDS.find(f => f.key === key);
export const getSectionFields = (sectionKey) => LEAD_FIELDS.filter(f => f.section === sectionKey);

// ─── Formatting Helpers ────────────────────────────────────────────────────
export const formatCurrency = (val) => {
  if (val == null || val === '') return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '—';
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
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
      timeZone: 'America/New_York',
    });
  } catch {
    return '—';
  }
};

export const getStatusColor = (status) => {
  const opt = STATUS_OPTIONS.find(s => s.value.toLowerCase() === (status || '').toLowerCase());
  return opt?.color || 'zinc';
};

// Add "analyzing" to the default status when creating new leads
export const DEFAULT_STATUS = 'analyzing';

// Score color: red < 40, amber < 70, emerald >= 70
export const getScoreColor = (score) => {
  if (score == null) return 'zinc';
  if (score < 40) return 'rose';
  if (score < 70) return 'amber';
  return 'emerald';
};
