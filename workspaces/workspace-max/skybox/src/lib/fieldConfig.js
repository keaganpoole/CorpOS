// ─── Field Configuration & Colorbar Rules ──────────────────────────────────
// Manages display names, icons, option colors, and colorbar rules.
// Persists to localStorage. Supabase column keys are NEVER modified.

const STORAGE_KEY = 'skybox_field_config';
const COLORBAR_KEY = 'skybox_colorbar_rules';

const DEFAULT_CONFIG = {
  company:       { name: 'Company',       icon: 'building' },
  first_name:    { name: 'First Name',    icon: 'user' },
  last_name:     { name: 'Last Name',     icon: 'user' },
  position:      { name: 'Position',      icon: 'briefcase' },
  industry:      { name: 'Industry',      icon: 'factory' },
  status: {
    name: 'Status', icon: 'flag',
    optionColors: {
      'Analyzing':      '#3b82f6',
      'Won':            '#10b981',
      'Interested':     '#10b981',
      'Aware':          '#f59e0b',
      'Contacted':      '#eab308',
      'Not contacted':  '#71717a',
      'Not interested': '#f43f5e',
      'DNC':            '#ef4444',
    },
  },
  source: {
    name: 'Source', icon: 'compass',
    optionColors: {
      'LinkedIn':          '#3b82f6',
      'Google Search':     '#6366f1',
      'Google Maps':       '#8b5cf6',
      'Manual Web Search': '#a855f7',
    },
  },
  opportunity:   { name: 'Opportunity',   icon: 'target' },
  proposal_value:{ name: 'Proposal Value',icon: 'dollar-sign' },
  revenue:       { name: 'Revenue',       icon: 'trending-up' },
  email:         { name: 'Email',         icon: 'mail' },
  phone:         { name: 'Phone',         icon: 'phone' },
  website:       { name: 'Website',       icon: 'globe' },
  city:          { name: 'City',          icon: 'map-pin' },
  state:         { name: 'State',         icon: 'map' },
  date_created:  { name: 'Created',       icon: 'calendar' },
  last_contacted:{ name: 'Last Contacted',icon: 'clock' },
  last_responded:{ name: 'Last Responded',icon: 'clock' },
  last_interaction:{ name: 'Last Interaction', icon: 'message-square' },
  discovery:     { name: 'Discovery',     icon: 'search' },
  notes:         { name: 'Notes',         icon: 'file-text' },
  page_quality_score: { name: 'Page Score', icon: 'gauge' },
};

export const AVAILABLE_ICONS = [
  'building', 'user', 'briefcase', 'factory', 'flag', 'compass', 'target',
  'dollar-sign', 'trending-up', 'mail', 'phone', 'globe', 'map-pin', 'map',
  'calendar', 'clock', 'message-square', 'search', 'file-text', 'gauge',
  'star', 'heart', 'zap', 'shield', 'award', 'bookmark', 'tag', 'layers',
  'database', 'cpu', 'settings', 'wrench', 'package', 'truck', 'users',
  'bar-chart', 'pie-chart', 'activity', 'wifi', 'anchor', 'aperture',
];

export const COLORBAR_PRESETS = [
  { name: 'Cyan Glow', gradient: ['#22d3ee', '#06b6d4'], animation: 'sweep' },
  { name: 'Emerald',   gradient: ['#10b981', '#059669'], animation: 'none' },
  { name: 'Rose Fire', gradient: ['#f43f5e', '#e11d48'], animation: 'pulse' },
  { name: 'Indigo',    gradient: ['#6366f1', '#4f46e5'], animation: 'none' },
  { name: 'Amber',     gradient: ['#f59e0b', '#d97706'], animation: 'none' },
  { name: 'Fuchsia',   gradient: ['#d946ef', '#a855f7'], animation: 'sweep' },
  { name: 'Sunset',    gradient: ['#f97316', '#ef4444'], animation: 'sweep' },
  { name: 'Ocean',     gradient: ['#3b82f6', '#06b6d4'], animation: 'sweep' },
  { name: 'Neon',      gradient: ['#22d523', '#a3e635'], animation: 'pulse' },
  { name: 'Midnight',  gradient: ['#6366f1', '#ec4899'], animation: 'sweep' },
];

// ─── Load / Save ───────────────────────────────────────────────────────────
export const loadFieldConfig = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULT_CONFIG };
};

export const saveFieldConfig = (config) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
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

// ─── Colorbar Rule Evaluator ───────────────────────────────────────────────
export const evaluateColorbar = (lead, rules) => {
  for (const rule of rules) {
    if (!rule.enabled || !rule.conditions?.length) continue;
    const matches = rule.logic === 'and'
      ? rule.conditions.every(c => checkCondition(lead, c))
      : rule.conditions.some(c => checkCondition(lead, c));
    if (matches) return rule;
  }
  return null;
};

const checkCondition = (lead, condition) => {
  const { field, operator, value } = condition;
  const leadVal = lead[field];
  if (leadVal == null && operator !== 'is_empty' && operator !== 'is_not_empty') return false;
  switch (operator) {
    case 'equals':       return String(leadVal).toLowerCase() === String(value).toLowerCase();
    case 'not_equals':   return String(leadVal).toLowerCase() !== String(value).toLowerCase();
    case 'contains':     return String(leadVal || '').toLowerCase().includes(String(value).toLowerCase());
    case 'greater_than': return parseFloat(leadVal) > parseFloat(value);
    case 'less_than':    return parseFloat(leadVal) < parseFloat(value);
    case 'is_empty':     return !leadVal || (Array.isArray(leadVal) && leadVal.length === 0);
    case 'is_not_empty': return leadVal && (!Array.isArray(leadVal) || leadVal.length > 0);
    case 'includes':     return Array.isArray(leadVal) ? leadVal.includes(value) : String(leadVal).includes(value);
    default: return false;
  }
};

export const OPERATORS = {
  text:     [{ v: 'equals', l: 'is' }, { v: 'not_equals', l: 'is not' }, { v: 'contains', l: 'contains' }, { v: 'is_empty', l: 'is empty' }, { v: 'is_not_empty', l: 'is not empty' }],
  number:   [{ v: 'equals', l: '=' }, { v: 'greater_than', l: '>' }, { v: 'less_than', l: '<' }, { v: 'is_empty', l: 'is empty' }],
  select:   [{ v: 'equals', l: 'is' }, { v: 'not_equals', l: 'is not' }, { v: 'is_empty', l: 'is empty' }, { v: 'is_not_empty', l: 'is not empty' }],
  multi_select: [{ v: 'includes', l: 'includes' }, { v: 'is_empty', l: 'is empty' }, { v: 'is_not_empty', l: 'is not empty' }],
  currency: [{ v: 'equals', l: '=' }, { v: 'greater_than', l: '>' }, { v: 'less_than', l: '<' }, { v: 'is_empty', l: 'is empty' }],
};

export const CONDITIONAL_FIELDS = [
  { key: 'status', label: 'Status', type: 'select', options: ['Analyzing', 'Won', 'Interested', 'Aware', 'Contacted', 'Not contacted', 'Not interested', 'DNC'] },
  { key: 'source', label: 'Source', type: 'select', options: ['LinkedIn', 'Google Search', 'Google Maps', 'Manual Web Search'] },
  { key: 'industry', label: 'Industry', type: 'text' },
  { key: 'opportunity', label: 'Opportunity', type: 'multi_select', options: ['Outdated Website', 'Ugly Website', 'Poor Functionality', 'Limited Features', 'No Website', 'Not Mobile Friendly'] },
  { key: 'page_quality_score', label: 'Page Score', type: 'number' },
  { key: 'proposal_value', label: 'Proposal Value', type: 'currency' },
  { key: 'revenue', label: 'Revenue', type: 'currency' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'state', label: 'State', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
];
