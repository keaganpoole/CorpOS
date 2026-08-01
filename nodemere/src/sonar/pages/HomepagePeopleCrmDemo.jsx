import React, { useCallback, useMemo, useState } from 'react';
import LeadsTable from './LeadsTable';
import { DEFAULT_FIELD_CONFIG } from '../lib/fieldConfig';

export const DEMO_CUSTOM_FIELDS = [
  {
    key: 'custom_membership_status',
    label: 'Membership Status',
    description: 'Whether this client is part of a package or membership.',
    type: 'select',
    options: ['None', 'Active', 'Paused', 'Expired'],
    table: true,
    editable: true,
    tableWidth: '160px',
    position: 0,
    config: {
      options: ['None', 'Active', 'Paused', 'Expired'],
      tableWidth: '160px',
      description: 'Whether this client is part of a package or membership.',
      optionColors: {
        None: '#71717a',
        Active: '#10b981',
        Paused: '#f59e0b',
        Expired: '#ef4444',
      },
    },
    id: 'demo_custom_membership_status',
    createdAt: '2026-06-07T00:00:00.000Z',
  },
  {
    key: 'custom_preferred_stylist',
    label: 'Preferred Stylist',
    description: 'Stylist this client prefers.',
    type: 'select',
    options: ['No Preference', 'Ava', 'Mia', 'Sofia', 'Emma', 'Jade', 'Olivia'],
    table: true,
    editable: true,
    tableWidth: '180px',
    position: 1,
    config: {
      options: ['No Preference', 'Ava', 'Mia', 'Sofia', 'Emma', 'Jade', 'Olivia'],
      tableWidth: '180px',
      description: 'Stylist this client prefers.',
      optionColors: {
        Ava: '#06b6d4',
        Mia: '#f59e0b',
        Emma: '#10b981',
        Jade: '#ef4444',
        Sofia: '#d946ef',
        Olivia: '#6366f1',
        'No Preference': '#71717a',
      },
    },
    id: 'demo_custom_preferred_stylist',
    createdAt: '2026-06-07T00:00:00.000Z',
  },
  {
    key: 'custom_primary_service_category',
    label: 'Primary Service Category',
    description: 'Main service type this client usually buys.',
    type: 'select',
    options: ['Cut', 'Color', 'Blonding', 'Extensions', 'Treatment', 'Styling', 'Mens Grooming'],
    table: true,
    editable: true,
    tableWidth: '190px',
    position: 2,
    config: {
      options: ['Cut', 'Color', 'Blonding', 'Extensions', 'Treatment', 'Styling', 'Mens Grooming'],
      tableWidth: '190px',
      description: 'Main service type this client usually buys.',
      optionColors: {
        Cut: '#3b82f6',
        Color: '#f43f5e',
        Styling: '#f97316',
        Blonding: '#eab308',
        Treatment: '#10b981',
        Extensions: '#8b5cf6',
        'Mens Grooming': '#14b8a6',
      },
    },
    id: 'demo_custom_primary_service_category',
    createdAt: '2026-06-07T00:00:00.000Z',
  },
  {
    key: 'custom_text_1781919626191',
    label: 'Hair Goals',
    description: '',
    type: 'text',
    options: [],
    table: true,
    editable: true,
    tableWidth: '180px',
    position: 3,
    config: { options: [], tableWidth: '180px', description: '' },
    id: 'demo_custom_hair_goals',
    createdAt: '2026-06-07T00:00:00.000Z',
  },
  {
    key: 'custom_vip_client',
    label: 'VIP Client',
    description: 'Marks premium or priority clients.',
    type: 'boolean',
    options: [],
    table: true,
    editable: true,
    tableWidth: '110px',
    position: 4,
    config: { options: [], tableWidth: '110px', description: 'Marks premium or priority clients.' },
    id: 'demo_custom_vip_client',
    createdAt: '2026-06-07T00:00:00.000Z',
  },
  {
    key: 'custom_birthday',
    label: 'Birthday',
    description: 'Useful for birthday campaigns.',
    type: 'date',
    options: [],
    table: true,
    editable: true,
    tableWidth: '150px',
    position: 5,
    config: { options: [], tableWidth: '150px', description: 'Useful for birthday campaigns.' },
    id: 'demo_custom_birthday',
    createdAt: '2026-06-07T00:00:00.000Z',
  },
  {
    key: 'custom_loyalty_points',
    label: 'Loyalty Points',
    description: 'Reward points balance.',
    type: 'number',
    options: [],
    table: true,
    editable: true,
    tableWidth: '130px',
    position: 6,
    config: { options: [], tableWidth: '130px', description: 'Reward points balance.' },
    id: 'demo_custom_loyalty_points',
    createdAt: '2026-06-07T00:00:00.000Z',
  },
  {
    key: 'custom_notes_for_front_desk',
    label: 'Notes',
    description: 'Useful non-appointment client notes for staff.',
    type: 'text',
    options: [],
    table: true,
    editable: true,
    tableWidth: '240px',
    position: 7,
    config: { options: [], tableWidth: '240px', description: 'Useful non-appointment client notes for staff.' },
    id: 'demo_custom_notes',
    createdAt: '2026-06-07T00:00:00.000Z',
  },
  {
    key: 'custom_referral_source',
    label: 'Referral Source',
    description: 'How the client first came in.',
    type: 'select',
    options: ['Instagram', 'Google', 'Tiktok', 'Friend', 'Walk In', 'Facebook'],
    table: true,
    editable: true,
    tableWidth: '170px',
    position: 8,
    config: {
      options: ['Instagram', 'Google', 'Tiktok', 'Friend', 'Walk In', 'Facebook'],
      tableWidth: '170px',
      description: 'How the client first came in.',
      optionColors: {
        Friend: '#f97316',
        Google: '#3b82f6',
        TikTok: '#14b8a6',
        'Walk-In': '#a855f7',
        Facebook: '#6366f1',
        Instagram: '#ec4899',
        'Existing Client': '#22c55e',
      },
    },
    id: 'demo_custom_referral_source',
    createdAt: '2026-06-07T00:00:00.000Z',
  },
  {
    key: 'custom_preferred_communication_style',
    label: 'Preferred Communication Style',
    description: 'How this client prefers to be contacted.',
    type: 'select',
    options: ['Quick Text', 'Phone Call', 'Email', 'Detailed Text', 'Minimal Contact'],
    table: true,
    editable: true,
    tableWidth: '220px',
    position: 10,
    config: {
      options: ['Quick Text', 'Phone Call', 'Email', 'Detailed Text', 'Minimal Contact'],
      tableWidth: '220px',
      description: 'How this client prefers to be contacted.',
      optionColors: {
        Email: '#8b5cf6',
        'Phone Call': '#f59e0b',
        'Quick Text': '#06b6d4',
        'Detailed Text': '#10b981',
        'Minimal Contact': '#71717a',
      },
    },
    id: 'demo_custom_preferred_communication_style',
    createdAt: '2026-06-07T00:00:00.000Z',
  },
  {
    key: 'custom_number_1782003711752',
    label: 'Lifetime Value',
    description: '',
    type: 'number',
    options: [],
    table: true,
    editable: true,
    tableWidth: '120px',
    position: 12,
    config: { options: [], tableWidth: '120px', description: '' },
    id: 'demo_custom_lifetime_value',
    createdAt: '2026-06-07T00:00:00.000Z',
  },
];

const DEMO_FIELD_CONFIG = {
  ...DEFAULT_FIELD_CONFIG,
  source: {
    ...DEFAULT_FIELD_CONFIG.source,
    hidden: true,
    options: ['Phone', 'Text', 'Email', 'Website', 'Referral', 'Walk In', 'Manual'],
    description: '',
    optionColors: {
      Text: '#8b5cf6',
      Email: '#6366f1',
      Phone: '#06b6d4',
      Manual: '#71717a',
      'Walk In': '#d946ef',
      Website: '#3b82f6',
      Referral: '#f59e0b',
    },
  },
  custom_membership_status: {
    icon: 'tag',
    name: 'Membership Status',
    options: ['None', 'Active', 'Paused', 'Expired'],
    description: 'Whether this client is part of a package or membership.',
    optionColors: {
      None: '#71717a',
      Active: '#22c55e',
      Paused: '#71717a',
      Expired: '#f43f5e',
    },
  },
  custom_preferred_stylist: {
    icon: 'user',
    name: 'Preferred Stylist',
    options: ['No Preference', 'Ava', 'Mia', 'Sofia', 'Emma', 'Jade', 'Olivia'],
    description: 'Stylist this client prefers.',
    optionColors: {
      Ava: '#d946ef',
      Mia: '#d946ef',
      Emma: '#d946ef',
      Jade: '#d946ef',
      Sofia: '#d946ef',
      Olivia: '#d946ef',
      'No Preference': '#d946ef',
    },
  },
  custom_primary_service_category: {
    icon: 'tag',
    name: 'Primary Service Category',
    options: ['Cut', 'Color', 'Blonding', 'Extensions', 'Treatment', 'Styling', 'Mens Grooming'],
    description: 'Main service type this client usually buys.',
    optionColors: {
      Cut: '#a855f7',
      Color: '#a855f7',
      Styling: '#a855f7',
      Blonding: '#a855f7',
      Treatment: '#a855f7',
      Extensions: '#a855f7',
      'Mens Grooming': '#a855f7',
    },
  },
  custom_text_1781919626191: {
    icon: 'heart',
    name: 'Hair Goals',
    description: '',
    optionColors: {},
  },
  custom_vip_client: {
    icon: 'star',
    name: 'VIP Client',
    description: 'Marks premium or priority clients.',
    optionColors: {},
  },
  custom_referral_source: {
    icon: 'compass',
    name: 'Referral Source',
    options: ['Instagram', 'Google', 'Tiktok', 'Friend', 'Walk In', 'Facebook'],
    description: 'How the client first came in.',
    optionColors: {
      Friend: '#ec4899',
      Google: '#ec4899',
      Tiktok: '#ec4899',
      'Walk In': '#ec4899',
      Facebook: '#ec4899',
      Instagram: '#ec4899',
    },
  },
  custom_notes_for_front_desk: {
    icon: 'tag',
    name: 'Notes',
    description: 'Useful non-appointment client notes for staff.',
    optionColors: {},
  },
  custom_number_1782003711752: {
    icon: 'dollar-sign',
    name: 'Lifetime Value',
    description: '',
    optionColors: {},
  },
  custom_preferred_communication_style: {
    icon: 'message-square',
    name: 'Preferred Communication Style',
    optionColors: {
      Email: '#6366f1',
      'Phone Call': '#6366f1',
      'Quick Text': '#6366f1',
      'Detailed Text': '#6366f1',
      'Minimal Contact': '#6366f1',
    },
  },
  __zones: [
    {
      id: 'zone_1781920099686_ftmh9',
      color: '#d946ef',
      startColumnId: 'custom_preferred_stylist',
      endColumnId: 'custom_text_1781919626191',
    },
  ],
};

const DEMO_COLORBAR_RULES = [
  {
    id: 'demo_active_members',
    name: 'Active members',
    enabled: true,
    logic: 'and',
    conditions: [
      {
        id: 'demo_active_membership',
        field: 'custom_membership_status',
        operator: 'equals',
        value: 'Active',
      },
    ],
    colors: ['#22c55e', '#10b981'],
    animation: 'none',
  },
  {
    id: 'demo_expired_members',
    name: 'Expired members',
    enabled: true,
    logic: 'and',
    conditions: [
      {
        id: 'demo_expired_membership',
        field: 'custom_membership_status',
        operator: 'equals',
        value: 'Expired',
      },
    ],
    colors: ['#fb7185', '#e11d48'],
    animation: 'pulse',
  },
];

const createRow = (id, firstName, lastName, phone, email, customFields, createdAt = '2026-06-07T00:00:00.000Z') => ({
  id,
  first_name: firstName,
  last_name: lastName,
  phone,
  email,
  source: 'Manual',
  created_at: createdAt,
  updated_at: createdAt,
  custom_fields: customFields,
});

const createInitialRows = () => [
  createRow(77, 'David', 'Willis', '(555) 177-1077', 'example@email.com', {
    Membership: 'Standard',
    'Last Service': 'Consultation',
    'Customer Type': 'Commercial',
    custom_birthday: '1984-11-29',
    custom_vip_client: false,
    custom_loyalty_points: 230,
    custom_referral_source: 'Google',
    custom_membership_status: 'Active',
    custom_preferred_stylist: 'Ava',
    custom_text_1781919626191: 'Wants a clean low fade',
    custom_notes_for_front_desk: 'Prefers morning communication only.',
    custom_number_1782003711752: 1712,
    custom_primary_service_category: 'Color',
    custom_preferred_communication_style: 'Phone Call',
  }, '2026-06-08T00:48:33.680Z'),
  createRow(72, 'Sarah', 'Williams', '(555) 172-1072', 'example@email.com', {
    Membership: 'Premium',
    'Last Service': 'Haircut',
    'Customer Type': 'Residential',
    custom_birthday: '1987-09-02',
    custom_vip_client: false,
    custom_loyalty_points: 275,
    custom_referral_source: 'Google',
    custom_membership_status: 'Active',
    custom_preferred_stylist: 'Mia',
    custom_text_1781919626191: 'Healthier ends and less breakage',
    custom_notes_for_front_desk: 'Usually calls back quickly if voicemail is left.',
    custom_number_1782003711752: 1178,
    custom_primary_service_category: 'Styling',
    custom_preferred_communication_style: 'Phone Call',
  }, '2026-06-07T16:30:37.153Z'),
  createRow(75, 'Jessica', 'Davis', '(555) 175-1075', 'example@email.com', {
    Membership: 'Standard',
    'Last Service': 'Maintenance',
    'Customer Type': 'Residential',
    custom_birthday: '1995-12-05',
    custom_vip_client: true,
    custom_loyalty_points: 160,
    custom_referral_source: 'Walk In',
    custom_membership_status: 'Paused',
    custom_preferred_stylist: 'Jade',
    custom_text_1781919626191: 'Wants brighter blonde without brassiness',
    custom_notes_for_front_desk: 'Likes product recommendations at checkout.',
    custom_number_1782003711752: 771,
    custom_primary_service_category: 'Treatment',
    custom_preferred_communication_style: 'Email',
  }, '2026-06-07T18:16:22.350Z'),
  createRow(76, 'Daniel', 'Anderson', '(555) 176-1076', 'example@email.com', {
    Membership: 'Premium',
    'Last Service': 'Haircut',
    'Customer Type': 'Commercial',
    custom_birthday: '1992-03-14',
    custom_vip_client: false,
    custom_loyalty_points: 60,
    custom_referral_source: 'Facebook',
    custom_membership_status: 'Active',
    custom_preferred_stylist: 'Olivia',
    custom_text_1781919626191: 'Low-maintenance balayage look',
    custom_notes_for_front_desk: 'Usually books for special events and photoshoots.',
    custom_number_1782003711752: 984,
    custom_primary_service_category: 'Styling',
    custom_preferred_communication_style: 'Quick Text',
  }, '2026-06-07T18:16:28.778Z'),
  createRow(74, 'Willow', 'Rodriguez', '(555) 174-1074', 'example@email.com', {
    Membership: 'Standard',
    'Last Service': 'Installation',
    'Customer Type': 'Commercial',
    custom_birthday: '1998-07-11',
    custom_vip_client: false,
    custom_loyalty_points: 90,
    custom_referral_source: 'Instagram',
    custom_membership_status: 'Expired',
    custom_preferred_stylist: 'Emma',
    custom_text_1781919626191: 'Better shine and overall softness',
    custom_notes_for_front_desk: 'First-time client, friendly and easygoing.',
    custom_number_1782003711752: 421,
    custom_primary_service_category: 'Cut',
    custom_preferred_communication_style: 'Quick Text',
  }, '2026-06-07T18:16:15.075Z'),
  createRow(73, 'Emily', 'Thompson', '(555) 173-1073', 'example@email.com', {
    Membership: 'Standard',
    'Last Service': 'Consultation',
    'Customer Type': 'Commercial',
    custom_birthday: '1990-01-26',
    custom_vip_client: true,
    custom_loyalty_points: 510,
    custom_referral_source: 'Friend',
    custom_membership_status: 'Active',
    custom_preferred_stylist: 'Sofia',
    custom_text_1781919626191: 'Wants fuller-looking hair with more volume',
    custom_notes_for_front_desk: 'Usually asks for extension care products.',
    custom_number_1782003711752: 690,
    custom_primary_service_category: 'Extensions',
    custom_preferred_communication_style: 'Detailed Text',
  }, '2026-06-07T18:16:10.433Z'),
];

const HomepagePeopleCrmMobilePreview = ({ rows, selectedId, onSelect }) => {
  const previewRows = rows.slice(0, 4);
  const activeRow = previewRows.find((row) => row.id === selectedId) || previewRows[0];

  if (!activeRow) return null;

  const fields = activeRow.custom_fields || {};
  const initials = `${activeRow.first_name?.[0] || ''}${activeRow.last_name?.[0] || ''}`.toUpperCase();
  const lifetimeValue = Number(fields.custom_number_1782003711752);
  const recordDetails = [
    { label: 'Membership', value: fields.custom_membership_status || 'Active' },
    { label: 'Stylist', value: fields.custom_preferred_stylist || 'No preference' },
    { label: 'Service', value: fields.custom_primary_service_category || 'Client profile' },
    { label: 'Lifetime value', value: Number.isFinite(lifetimeValue) ? `$${lifetimeValue.toLocaleString()}` : '—' },
  ];

  return (
    <div className="flex h-full w-full items-center justify-center px-5 pt-8 sm:px-8">
      <section className="w-full max-w-[42rem] rounded-[26px] border border-white/[0.08] bg-[#0b0b0c]/95 p-4 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.95)] sm:p-5">
        <header className="flex items-center justify-between border-b border-white/[0.06] pb-3 text-left">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500">Customer records</div>
            <div className="mt-1 text-sm font-semibold tracking-[-0.02em] text-zinc-100">A closer view of every client</div>
          </div>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-400">Live profile</span>
        </header>

        <div className="relative mt-4 overflow-hidden rounded-[20px] border border-white/[0.08] bg-gradient-to-br from-zinc-900 via-[#101012] to-zinc-950 p-4 text-left shadow-[0_18px_42px_-26px_rgba(217,70,239,0.36)] sm:p-5">
          <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-[var(--brandGradientStart)] to-transparent" />
          <div className="absolute -right-16 -top-20 h-44 w-44 rounded-full bg-[var(--brandGradientEnd)] opacity-[0.09] blur-3xl" />
          <div className="relative flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.05] text-sm font-bold tracking-tight text-white shadow-[0_0_22px_rgba(255,255,255,0.06)]">{initials}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-semibold tracking-[-0.04em] text-white">{activeRow.first_name} {activeRow.last_name}</div>
              <div className="mt-1 truncate text-[11px] font-medium text-zinc-500">{activeRow.email || activeRow.phone || 'Client record'}</div>
            </div>
            <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.07] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-200">Active</span>
          </div>

          <div className="relative mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/[0.06] pt-4">
            {recordDetails.map((detail) => (
              <div key={detail.label} className="min-w-0">
                <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-600">{detail.label}</div>
                <div className="mt-1 truncate text-xs font-semibold tracking-[-0.02em] text-zinc-200">{detail.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2" role="listbox" aria-label="Choose a customer record">
          {previewRows.map((row) => {
            const isActive = row.id === activeRow.id;
            return (
              <button
                key={row.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => onSelect(row.id)}
                className={`min-h-[46px] rounded-xl border px-3 py-2 text-left transition-colors ${
                  isActive
                    ? 'border-white/[0.18] bg-white/[0.08] text-white shadow-[0_0_18px_rgba(217,70,239,0.12)]'
                    : 'border-white/[0.06] bg-white/[0.025] text-zinc-500 active:bg-white/[0.06]'
                }`}
              >
                <span className="block truncate text-[11px] font-semibold tracking-[-0.02em]">{row.first_name} {row.last_name}</span>
                <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-[0.15em] text-zinc-600">View record</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};

const HomepagePeopleCrmDemo = ({ className = '', entranceActive = false, onDemoLimitExceeded, onDemoSchemaChange }) => {
  const [rows, setRows] = useState(() => createInitialRows());
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [justAddedIds, setJustAddedIds] = useState([]);
  const [entranceComplete, setEntranceComplete] = useState(false);
  const [entranceStarted, setEntranceStarted] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  ));

  React.useEffect(() => {
    const updateViewport = () => setIsCompactViewport(window.innerWidth < 1024);
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  React.useEffect(() => {
    if (rows.length > 14) {
      onDemoLimitExceeded?.();
    }
  }, [onDemoLimitExceeded, rows.length]);

  React.useEffect(() => {
    onDemoSchemaChange?.({ customFields: DEMO_CUSTOM_FIELDS });
  }, [onDemoSchemaChange]);

  React.useEffect(() => {
    if (!entranceActive || entranceStarted) return undefined;
    setEntranceStarted(true);
    const timer = window.setTimeout(() => {
      setEntranceComplete(true);
    }, 5600);
    return () => window.clearTimeout(timer);
  }, [entranceActive, entranceStarted]);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((row) => [
      row.first_name,
      row.last_name,
      row.phone,
      row.email,
      ...Object.values(row.custom_fields || {}),
    ].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [rows, searchQuery]);

  const handleUpdate = useCallback(async (id, updates) => {
    setRows((currentRows) => currentRows.map((row) => (
      row.id === id ? { ...row, ...updates, updated_at: new Date().toISOString() } : row
    )));
  }, []);

  const handleCreate = useCallback(async () => {
    const id = `demo_${Date.now()}`;
    const row = createRow(id, '', '', '', '', {
      custom_membership_status: 'Active',
      custom_preferred_stylist: 'No Preference',
      custom_primary_service_category: 'Cut',
      custom_text_1781919626191: '',
      custom_vip_client: false,
      custom_birthday: null,
      custom_loyalty_points: null,
      custom_notes_for_front_desk: '',
      custom_referral_source: '',
      custom_preferred_communication_style: '',
      custom_number_1782003711752: null,
    }, new Date().toISOString());
    setRows((currentRows) => [...currentRows, row]);
    setJustAddedIds((currentIds) => [...currentIds, id]);
    window.setTimeout(() => {
      setJustAddedIds((currentIds) => currentIds.filter((currentId) => currentId !== id));
    }, 1200);
  }, []);

  const handleDeleteMany = useCallback(async (ids) => {
    setRows((currentRows) => currentRows.filter((row) => !ids.includes(row.id)));
    setSelectedId((currentId) => (ids.includes(currentId) ? null : currentId));
  }, []);

  return (
    <div className={`relative h-full w-full bg-[#020202] crm-demo-entrance ${entranceStarted ? 'has-started' : 'is-waiting'} ${entranceComplete ? 'is-loaded' : 'is-entering'} ${className}`}>
      {isCompactViewport ? (
        <HomepagePeopleCrmMobilePreview rows={filteredRows} selectedId={selectedId} onSelect={setSelectedId} />
      ) : (
        <LeadsTable
          leads={filteredRows}
          loading={false}
          selectedId={selectedId}
          onSelect={setSelectedId}
          justAddedLeadIds={justAddedIds}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sourceFilter="All"
          onSourceFilterChange={() => {}}
          sortBy="updated_at"
          sortDir="desc"
          onSort={() => {}}
          totalCount={rows.length}
          onCreateInline={handleCreate}
          onDeleteMany={handleDeleteMany}
          onUpdateLead={handleUpdate}
          demoMode
          demoInitialCustomFields={DEMO_CUSTOM_FIELDS}
          demoInitialFieldConfig={DEMO_FIELD_CONFIG}
          demoInitialColorbarRules={DEMO_COLORBAR_RULES}
          demoInitialViewSettings={{ rowHeight: 3, sortRules: [], frozenCount: 0 }}
          demoEntrance
          onSchemaChange={onDemoSchemaChange}
          hideTitle
          searchPlaceholder="Search records..."
        />
      )}
      <div className={`pointer-events-none absolute left-0 right-0 px-8 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-700/80 ${isCompactViewport ? 'bottom-8' : 'bottom-[120px]'}`}>
        Demonstration purposes only
      </div>
    </div>
  );
};

export default HomepagePeopleCrmDemo;
