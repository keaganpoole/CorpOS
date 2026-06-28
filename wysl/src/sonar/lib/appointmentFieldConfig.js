import { STATUS_OPTIONS, SOURCE_OPTIONS } from './appointmentSchema';
import { supabase } from './supabase';
import { getCurrentBusinessId, getCustomValue, isCustomFieldKey } from './appointmentCustomFields';

const STORAGE_KEY = 'SONAR_appointments_field_config';
const COLORBAR_KEY = 'SONAR_appointments_colorbar_rules';
const APPOINTMENTS_FIELD_CONFIG_COLUMN = 'appointments_field_config';

export const DEFAULT_FIELD_CONFIG = {
  person_id: { name: 'Customer / Person', icon: 'user' },
  client_name: { name: 'Customer Name', icon: 'user' },
  service_id: { name: 'Service', icon: 'briefcase' },
  date: { name: 'Date', icon: 'calendar' },
  time: { name: 'Start Time', icon: 'clock' },
  duration: { name: 'Duration', icon: 'activity' },
  status: {
    name: 'Status',
    icon: 'activity',
    optionColors: {
      Pending: '#f59e0b',
      Confirmed: '#06b6d4',
      Completed: '#10b981',
      Missed: '#f43f5e',
      Cancelled: '#d946ef',
    },
  },
  source: {
    name: 'Source',
    icon: 'compass',
    optionColors: {
      Phone: '#06b6d4',
      Text: '#10b981',
      Email: '#6366f1',
      Website: '#3b82f6',
      Referral: '#f59e0b',
      'Walk-In': '#d946ef',
      Manual: '#71717a',
      Scenario: '#f97316',
    },
  },
  notes: { name: 'Notes', icon: 'file-text' },
  receptionist_id: { name: 'Assigned Receptionist', icon: 'users' },
  scenario_id: { name: 'Scenario', icon: 'zap' },
  created_at: { name: 'Created At', icon: 'calendar' },
  updated_at: { name: 'Updated At', icon: 'clock' },
};

export const AVAILABLE_ICONS = [
  'building', 'user', 'briefcase', 'factory', 'flag', 'compass', 'target',
  'dollar-sign', 'trending-up', 'mail', 'phone', 'globe', 'map-pin', 'map',
  'calendar', 'clock', 'message-square', 'search', 'file-text', 'gauge',
  'star', 'heart', 'zap', 'shield', 'award', 'bookmark', 'tag', 'layers',
  'database', 'cpu', 'settings', 'wrench', 'package', 'truck', 'users',
  'bar-chart', 'pie-chart', 'activity', 'wifi', 'anchor', 'aperture',
  'repeat', 'navigation',
];

export const COLORBAR_PRESETS = [
  { name: 'Cyan Glow', gradient: ['#22d3ee', '#06b6d4'], animation: 'sweep' },
  { name: 'Emerald', gradient: ['#10b981', '#059669'], animation: 'none' },
  { name: 'Rose Fire', gradient: ['#f43f5e', '#e11d48'], animation: 'pulse' },
  { name: 'Indigo', gradient: ['#6366f1', '#4f46e5'], animation: 'none' },
  { name: 'Amber', gradient: ['#f59e0b', '#d97706'], animation: 'none' },
  { name: 'Fuchsia', gradient: ['#d946ef', '#a855f7'], animation: 'sweep' },
  { name: 'Sunset', gradient: ['#f97316', '#ef4444'], animation: 'sweep' },
  { name: 'Ocean', gradient: ['#3b82f6', '#06b6d4'], animation: 'sweep' },
  { name: 'Neon', gradient: ['#22c55e', '#a3e635'], animation: 'pulse' },
  { name: 'Midnight', gradient: ['#6366f1', '#ec4899'], animation: 'sweep' },
];

const loadLegacyFieldConfig = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_FIELD_CONFIG, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULT_FIELD_CONFIG };
};

export const loadFieldConfig = () => ({ ...DEFAULT_FIELD_CONFIG });

export const fetchBusinessFieldConfig = async (businessId) => {
  const resolvedBusinessId = businessId || await getCurrentBusinessId();
  const { data, error } = await supabase
    .from('businesses')
    .select(`id, ${APPOINTMENTS_FIELD_CONFIG_COLUMN}`)
    .eq('id', resolvedBusinessId)
    .single();

  if (error) {
    const message = String(error.message || '');
    if (message.includes(APPOINTMENTS_FIELD_CONFIG_COLUMN)) {
      return {
        businessId: resolvedBusinessId,
        config: { ...DEFAULT_FIELD_CONFIG },
        rawConfig: {},
      };
    }
    throw error;
  }

  return {
    businessId: data.id,
    config: { ...DEFAULT_FIELD_CONFIG, ...(data?.[APPOINTMENTS_FIELD_CONFIG_COLUMN] || {}) },
    rawConfig: data?.[APPOINTMENTS_FIELD_CONFIG_COLUMN] || {},
  };
};

export const saveFieldConfig = async (businessId, config) => {
  const resolvedBusinessId = businessId || await getCurrentBusinessId();
  const payload = { [APPOINTMENTS_FIELD_CONFIG_COLUMN]: config };
  const { error } = await supabase
    .from('businesses')
    .update(payload)
    .eq('id', resolvedBusinessId);

  if (error) {
    const message = String(error.message || '');
    if (message.includes(APPOINTMENTS_FIELD_CONFIG_COLUMN)) return config;
    throw error;
  }
  return config;
};

export const migrateLegacyFieldConfig = async (businessId, rawRemoteConfig) => {
  const hasRemoteConfig = rawRemoteConfig && Object.keys(rawRemoteConfig).length > 0;
  if (hasRemoteConfig) return { ...DEFAULT_FIELD_CONFIG, ...rawRemoteConfig };

  const legacyConfig = loadLegacyFieldConfig();
  const hasLegacyOverrides = Object.keys(legacyConfig).some((key) => {
    const defaults = DEFAULT_FIELD_CONFIG[key] || {};
    const current = legacyConfig[key] || {};
    return JSON.stringify(defaults) !== JSON.stringify(current);
  });

  if (!hasLegacyOverrides) return { ...DEFAULT_FIELD_CONFIG };

  await saveFieldConfig(businessId, legacyConfig);
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  return legacyConfig;
};

export const loadColorbarRules = () => {
  try {
    const stored = localStorage.getItem(COLORBAR_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
};

export const saveColorbarRules = (rules) => {
  localStorage.setItem(COLORBAR_KEY, JSON.stringify(rules));
};

export const evaluateColorbar = (appointment, rules) => {
  for (const rule of rules) {
    if (!rule.enabled || !rule.conditions?.length) continue;
    const matches = rule.logic === 'and'
      ? rule.conditions.every((condition) => checkCondition(appointment, condition))
      : rule.conditions.some((condition) => checkCondition(appointment, condition));
    if (matches) return rule;
  }
  return null;
};

const checkCondition = (appointment, condition) => {
  const { field, operator, value } = condition;
  const appointmentVal = isCustomFieldKey(field) ? getCustomValue(appointment?.custom_fields, field) : appointment[field];
  if (appointmentVal == null && operator !== 'is_empty' && operator !== 'is_not_empty') return false;

  switch (operator) {
    case 'equals':
      if (typeof appointmentVal === 'boolean') return appointmentVal === value || String(appointmentVal).toLowerCase() === String(value).toLowerCase();
      return String(appointmentVal).toLowerCase() === String(value).toLowerCase();
    case 'not_equals':
      if (typeof appointmentVal === 'boolean') return appointmentVal !== value && String(appointmentVal).toLowerCase() !== String(value).toLowerCase();
      return String(appointmentVal).toLowerCase() !== String(value).toLowerCase();
    case 'contains':
      return String(appointmentVal || '').toLowerCase().includes(String(value).toLowerCase());
    case 'greater_than':
      return parseFloat(appointmentVal) > parseFloat(value);
    case 'less_than':
      return parseFloat(appointmentVal) < parseFloat(value);
    case 'is_empty':
      return !appointmentVal || (Array.isArray(appointmentVal) && appointmentVal.length === 0);
    case 'is_not_empty':
      return appointmentVal && (!Array.isArray(appointmentVal) || appointmentVal.length > 0);
    case 'includes':
      return Array.isArray(appointmentVal)
        ? appointmentVal.some((item) => String(item).toLowerCase() === String(value).toLowerCase())
        : String(appointmentVal).toLowerCase().includes(String(value).toLowerCase());
    default:
      return false;
  }
};

export const OPERATORS = {
  text: [{ v: 'equals', l: 'is' }, { v: 'not_equals', l: 'is not' }, { v: 'contains', l: 'contains' }, { v: 'is_empty', l: 'is empty' }, { v: 'is_not_empty', l: 'is not empty' }],
  number: [{ v: 'equals', l: '=' }, { v: 'greater_than', l: '>' }, { v: 'less_than', l: '<' }, { v: 'is_empty', l: 'is empty' }],
  select: [{ v: 'equals', l: 'is' }, { v: 'not_equals', l: 'is not' }, { v: 'is_empty', l: 'is empty' }, { v: 'is_not_empty', l: 'is not empty' }],
  multi_select: [{ v: 'includes', l: 'includes' }, { v: 'is_empty', l: 'is empty' }, { v: 'is_not_empty', l: 'is not empty' }],
  boolean: [{ v: 'equals', l: 'is' }, { v: 'not_equals', l: 'is not' }],
  date: [{ v: 'equals', l: 'is' }, { v: 'not_equals', l: 'is not' }, { v: 'is_empty', l: 'is empty' }, { v: 'is_not_empty', l: 'is not empty' }],
};

export const CONDITIONAL_FIELDS = [
  { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS.map((opt) => opt.value) },
  { key: 'source', label: 'Source', type: 'select', options: SOURCE_OPTIONS.map((opt) => opt.value) },
  { key: 'client_name', label: 'Customer Name', type: 'text' },
  { key: 'receptionist_id', label: 'Assigned Receptionist', type: 'text' },
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'time', label: 'Start Time', type: 'text' },
  { key: 'duration', label: 'Duration', type: 'number' },
  { key: 'service_id', label: 'Service', type: 'text' },
];
