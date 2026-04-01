// CorpOS Skybox — Placeholder Data Layer
// All data here reflects real CorpOS structure.
// Will be wired to live OpenClaw data in a future phase.

// --- Agents ---
export const AGENTS = [
  {
    id: 'max',
    name: 'Max',
    role: 'Chief Operating Officer',
    status: 'active',
    department: 'Executive',
    hierarchyLevel: 1,
    reportsTo: null,
    lastAction: 'Analyzing Airtable Command Center — Zone 4 active',
    model: 'claude-sonnet-4.6',
    platform: 'Discord',
  },
  {
    id: 'lauren',
    name: 'Lauren',
    role: 'Research Manager',
    status: 'focused',
    department: 'Research',
    hierarchyLevel: 2,
    reportsTo: 'max',
    lastAction: 'Scanning for Digital Relics in target market',
    model: 'StepFun 3.5 Flash',
    platform: 'Discord',
  },
  {
    id: 'yanna',
    name: 'Yanna',
    role: 'Research Associate',
    status: 'idle',
    department: 'Research',
    hierarchyLevel: 3,
    reportsTo: 'lauren',
    lastAction: 'Workspace not yet initialized',
    model: 'TBD',
    platform: 'Discord',
  },
];

// --- Kanban Tasks ---
export const TASKS = [
  {
    id: 'T-001',
    title: 'Daily Relic Sweep',
    description: 'Automated scan of target market for outdated, broken, or ugly small business websites.',
    status: 'Recurring',
    department: 'Research',
    assignedAgent: 'Lauren',
    assignedAgentId: 'lauren',
    priority: 'high',
    lastUpdated: '2h ago',
  },
  {
    id: 'T-002',
    title: 'Airtable Command Center Sync',
    description: 'Pull current Zone, Stage, Status, and Priority fields from Command Center table.',
    status: 'Recurring',
    department: 'Operations',
    assignedAgent: 'Max',
    assignedAgentId: 'max',
    priority: 'medium',
    lastUpdated: '30m ago',
  },
  {
    id: 'T-003',
    title: 'Build Yanna Agent Workspace',
    description: 'Spin up independent agent, workspace, and bot for Yanna (Research Associate).',
    status: 'Backlog',
    department: 'Operations',
    assignedAgent: 'Max',
    assignedAgentId: 'max',
    priority: 'medium',
    lastUpdated: '1d ago',
  },
  {
    id: 'T-004',
    title: 'Lead Qualification Criteria',
    description: 'Define scoring rubric for Digital Relics — what qualifies a site as a high-value target.',
    status: 'Backlog',
    department: 'Research',
    assignedAgent: 'Lauren',
    assignedAgentId: 'lauren',
    priority: 'high',
    lastUpdated: '2d ago',
  },
  {
    id: 'T-005',
    title: 'Situation Room Dispatch Protocol',
    description: 'Finalize workflow: Keagan briefed → approved → Lauren posts to Situation Room.',
    status: 'In Progress',
    department: 'Operations',
    assignedAgent: 'Max',
    assignedAgentId: 'max',
    priority: 'high',
    lastUpdated: '4h ago',
  },
  {
    id: 'T-006',
    title: 'Skybox Frontend — Phase 1',
    description: 'Build Electron desktop control center for CorpOS. Kanban, agents, system, pipeline views.',
    status: 'In Progress',
    department: 'Engineering',
    assignedAgent: 'Max',
    assignedAgentId: 'max',
    priority: 'urgent',
    lastUpdated: '1h ago',
  },
  {
    id: 'T-007',
    title: 'Review Discord Bot Token Security',
    description: 'Audit max#2325 bot token permissions. Confirm allowlist and channel restrictions are locked.',
    status: 'Review',
    department: 'Security',
    assignedAgent: 'Max',
    assignedAgentId: 'max',
    priority: 'urgent',
    lastUpdated: '6h ago',
  },
  {
    id: 'T-008',
    title: 'Verify Lauren Situation Room Webhook',
    description: 'Confirm Lauren webhook is posting correctly to Situation Room. Test with sample dispatch.',
    status: 'Review',
    department: 'Research',
    assignedAgent: 'Lauren',
    assignedAgentId: 'lauren',
    priority: 'medium',
    lastUpdated: '12h ago',
  },
];

// --- Operations Pulse Activity Stream ---
export const ACTIVITIES = [
  { id: 1, agent: 'Max', action: 'analyzed Command Center — Zone 4, Stage Blue', type: 'info', time: '2m ago' },
  { id: 2, agent: 'Lauren', action: 'completed Relic sweep — 3 new targets flagged', type: 'success', time: '18m ago' },
  { id: 3, agent: 'Max', action: 'posted start_day brief to Keagan', type: 'info', time: '1h ago' },
  { id: 4, agent: 'System', action: 'Situation Room dispatch awaiting approval', type: 'urgent', time: '1h ago' },
  { id: 5, agent: 'Lauren', action: 'dispatched research report to Situation Room', type: 'success', time: '3h ago' },
  { id: 6, agent: 'Max', action: 'updated MEMORY.md with session log', type: 'info', time: '5h ago' },
];

// --- System Metrics ---
// Placeholder — ready for OpenClaw live wiring
export const SYSTEM_METRICS = {
  ok: 498,
  warnings: 26,
  errors: 4,
  uptime: '99.99%',
  status: 'Optimal',
  packetsPerSec: 248,
  memoryUsage: 72,
  activeAgents: 2,
  totalAgents: 3,
};

// --- Operation Log ---
// Static seed — SystemView appends live simulated entries on top
export const OPERATION_LOGS = [
  { time: '22:05:01', level: 'INFO', message: 'OpenClaw Gateway — Handshake sequence initiated' },
  { time: '22:05:02', level: 'OK',   message: 'Discord bot max#2325 — Connected to CorpOS server' },
  { time: '22:05:04', level: 'CMD',  message: 'start_day — Zone 4 / Stage Blue — Ignition active' },
  { time: '22:05:11', level: 'INFO', message: 'Airtable read — Command Center tbl8rlmoaZt3ZIsAY OK' },
  { time: '22:05:18', level: 'OK',   message: 'Lauren agent — Research sweep started (Situation Room)' },
  { time: '22:08:31', level: 'INFO', message: 'Relic detected — target flagged for qualification' },
  { time: '22:10:05', level: 'ERR',  message: 'Yanna agent — workspace not yet initialized' },
  { time: '22:12:44', level: 'OK',   message: 'Skybox build — Phase 1 in progress' },
];

// --- Pipeline ---
// Relic funnel — ready for Airtable Leads table wiring
export const PIPELINE = {
  stages: [
    { id: 'discovery',     label: 'Discovery',     count: 14, color: 'indigo' },
    { id: 'qualification', label: 'Qualification', count: 8,  color: 'cyan' },
    { id: 'outreach',      label: 'Outreach',      count: 5,  color: 'fuchsia' },
    { id: 'proposal',      label: 'Proposal',      count: 2,  color: 'amber' },
    { id: 'closed',        label: 'Closed',        count: 1,  color: 'green' },
  ],
  totalRelics: 14,
  qualifiedLeads: 8,
  activeOutreach: 5,
};

// --- Airtable Command Center State ---
export const COMMAND_CENTER = {
  tableId: 'tbl8rlmoaZt3ZIsAY',
  zone: 4,
  stage: 'Blue',
  status: 'Active',
  priority: 'High',
};
