import React, { useCallback, useMemo, useState } from 'react';
import LeadsTable from './LeadsTable';
import { DEFAULT_FIELD_CONFIG } from '../lib/fieldConfig';

const FIELD_KEYS = {
  membership: 'custom_membership_status',
  stylist: 'custom_preferred_stylist',
  service: 'custom_primary_service_category',
};

const DEMO_CUSTOM_FIELDS = [
  {
    key: FIELD_KEYS.membership,
    label: 'Membership Status',
    description: '',
    type: 'select',
    options: ['Active', 'Paused', 'Expired'],
    table: true,
    editable: true,
    tableWidth: '150px',
    position: 0,
    config: { tableWidth: '150px', description: '', options: ['Active', 'Paused', 'Expired'] },
    id: 'demo_membership_status',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    key: FIELD_KEYS.stylist,
    label: 'Preferred Stylist',
    description: '',
    type: 'select',
    options: ['Ava', 'Mia', 'Jade', 'Olivia', 'Emma', 'Sofia', 'Chloe'],
    table: true,
    editable: true,
    tableWidth: '160px',
    position: 1,
    config: { tableWidth: '160px', description: '', options: ['Ava', 'Mia', 'Jade', 'Olivia', 'Emma', 'Sofia', 'Chloe'] },
    id: 'demo_preferred_stylist',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    key: FIELD_KEYS.service,
    label: 'Primary Service Category',
    description: '',
    type: 'select',
    options: ['Color', 'Styling', 'Treatment', 'Cut', 'Extensions', 'Bridal'],
    table: true,
    editable: true,
    tableWidth: '190px',
    position: 2,
    config: { tableWidth: '190px', description: '', options: ['Color', 'Styling', 'Treatment', 'Cut', 'Extensions', 'Bridal'] },
    id: 'demo_primary_service_category',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

const DEMO_FIELD_CONFIG = {
  ...DEFAULT_FIELD_CONFIG,
  source: { ...DEFAULT_FIELD_CONFIG.source, hidden: true },
  [FIELD_KEYS.membership]: {
    name: 'Membership Status',
    icon: 'tag',
    optionColors: {
      Active: '#22c55e',
      Paused: '#71717a',
      Expired: '#f43f5e',
    },
  },
  [FIELD_KEYS.stylist]: {
    name: 'Preferred Stylist',
    icon: 'user',
    optionColors: {
      Ava: '#d946ef',
      Mia: '#d946ef',
      Jade: '#d946ef',
      Olivia: '#d946ef',
      Emma: '#d946ef',
      Sofia: '#d946ef',
      Chloe: '#d946ef',
    },
  },
  [FIELD_KEYS.service]: {
    name: 'Primary Service Category',
    icon: 'tag',
    optionColors: {
      Color: '#a855f7',
      Styling: '#a855f7',
      Treatment: '#a855f7',
      Cut: '#a855f7',
      Extensions: '#a855f7',
      Bridal: '#a855f7',
    },
  },
  __zones: [
    {
      id: 'demo_zone_services',
      startColumnId: FIELD_KEYS.stylist,
      endColumnId: FIELD_KEYS.service,
      color: '#d946ef',
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
        id: 'demo_active_condition',
        field: FIELD_KEYS.membership,
        operator: 'equals',
        value: 'Active',
      },
    ],
    colors: ['#22c55e', '#10b981'],
    animation: 'sweep',
  },
];

const createRow = (id, firstName, lastName, phone, email, membership, stylist, service) => ({
  id,
  first_name: firstName,
  last_name: lastName,
  phone,
  email,
  source: 'Manual',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  custom_fields: {
    [FIELD_KEYS.membership]: membership,
    [FIELD_KEYS.stylist]: stylist,
    [FIELD_KEYS.service]: service,
  },
});

const createInitialRows = () => [
  createRow('demo_1', 'David', 'Willis', '(555) 177-1077', 'example@email.com', 'Active', 'Ava', 'Color'),
  createRow('demo_2', 'Sarah', 'Williams', '(555) 172-1072', 'example@email.com', 'Active', 'Mia', 'Styling'),
  createRow('demo_3', 'Jessica', 'Davis', '(555) 175-1075', 'example@email.com', 'Paused', 'Jade', 'Treatment'),
  createRow('demo_4', 'Daniel', 'Anderson', '(555) 176-1076', 'example@email.com', 'Active', 'Olivia', 'Styling'),
  createRow('demo_5', 'Willow', 'Rodriguez', '(555) 174-1074', 'example@email.com', 'Expired', 'Emma', 'Cut'),
  createRow('demo_6', 'Emily', 'Thompson', '(555) 173-1073', 'example@email.com', 'Active', 'Sofia', 'Extensions'),
  createRow('demo_7', 'Chloe', 'Martinez', '(555) 178-1078', 'example@email.com', 'Active', 'Chloe', 'Bridal'),
];

const HomepagePeopleCrmDemo = ({ className = '' }) => {
  const [rows, setRows] = useState(() => createInitialRows());
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [justAddedIds, setJustAddedIds] = useState([]);

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
    const row = createRow(id, '', '', '', '', 'Active', 'Ava', 'Color');
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
    <div className={`h-full w-full bg-[#020202] ${className}`}>
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
        hideTitle
        searchPlaceholder="Search records..."
      />
    </div>
  );
};

export default HomepagePeopleCrmDemo;
