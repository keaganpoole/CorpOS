import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, ChevronUp, ChevronDown, X,
  Building2, Filter, Mail, Phone, Calendar, ArrowUpRight, TrendingUp, MoreHorizontal,
} from 'lucide-react';
import {
  TABLE_COLUMNS, STATUS_OPTIONS, SOURCE_OPTIONS,
  formatCurrency, formatTimestamp, getStatusColor, getScoreColor,
} from '../lib/leadSchema';

// ─── Sparkline ─────────────────────────────────────────────────────────────
const Sparkline = ({ data, color = '#6366f1', width = 100, height = 32 }) => {
  if (!data || data.length < 2) {
    // Generate synthetic "flat" data so the visual isn't empty
    data = [30, 30, 30, 30, 30, 30, 30];
  }
  const padding = 4;
  const points = data.map((d, i) => ({
    x: padding + (i / (data.length - 1)) * (width - padding * 2),
    y: height - padding - (d / 100) * (height - padding * 2),
  }));
  const pathData = points.reduce((acc, p, i) =>
    i === 0 ? `M ${p.x},${p.y}` : `${acc} L ${p.x},${p.y}`, '');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color.replace('#','')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${pathData} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`}
        fill={`url(#spark-${color.replace('#','')})`}
      />
      <path d={pathData} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2.5" fill={color} />
    </svg>
  );
};

// ─── Shimmer Score Bar ─────────────────────────────────────────────────────
const PulseBar = ({ score, color }) => {
  const c = getScoreColor(score);
  const barColor = c === 'emerald' ? '#10b981' : c === 'amber' ? '#f59e0b' : c === 'rose' ? '#f43f5e' : '#3f3f46';
  if (score == null) return <span className="text-zinc-700 text-[11px]">—</span>;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold tabular-nums" style={{ color: barColor }}>{score}%</span>
      <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden relative border border-white/[0.03]">
        <div
          className="h-full rounded-full relative overflow-hidden"
          style={{ width: `${score}%`, backgroundColor: barColor, boxShadow: `0 0 12px ${barColor}40` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]" />
        </div>
      </div>
    </div>
  );
};

// ─── Status Badge ──────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const color = getStatusColor(status);
  const colors = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    green:   'bg-green-500/10 text-green-400 border-green-500/20',
    amber:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
    yellow:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    zinc:    'bg-white/5 text-zinc-500 border-white/10',
    rose:    'bg-rose-500/10 text-rose-400 border-rose-500/20',
    red:     'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black border uppercase tracking-widest whitespace-nowrap ${colors[color] || colors.zinc}`}>
      {status || '—'}
    </span>
  );
};

// ─── Opportunity Tags ──────────────────────────────────────────────────────
const OpportunityTags = ({ opportunities }) => {
  if (!opportunities || opportunities.length === 0) return <span className="text-zinc-700 text-[10px]">—</span>;
  const display = opportunities.slice(0, 2);
  const extra = opportunities.length - display.length;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {display.map(opp => (
        <span key={opp} className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-white/5 text-zinc-400 border border-white/5 whitespace-nowrap">
          {opp}
        </span>
      ))}
      {extra > 0 && <span className="text-[8px] text-zinc-600 font-bold">+{extra}</span>}
    </div>
  );
};

// ─── Colored Initial Avatar ────────────────────────────────────────────────
const LeadAvatar = ({ company, score }) => {
  const initial = company ? company.charAt(0).toUpperCase() : '?';
  const c = getScoreColor(score);
  const colorMap = {
    emerald: { bg: 'from-emerald-500/20 to-emerald-500/5', text: 'text-emerald-400', dot: 'bg-emerald-400' },
    amber:   { bg: 'from-amber-500/20 to-amber-500/5',     text: 'text-amber-400',   dot: 'bg-amber-400' },
    rose:    { bg: 'from-rose-500/20 to-rose-500/5',       text: 'text-rose-400',    dot: 'bg-rose-400' },
    zinc:    { bg: 'from-zinc-500/20 to-zinc-500/5',       text: 'text-zinc-400',    dot: 'bg-zinc-500' },
  };
  const scheme = colorMap[c] || colorMap.zinc;

  return (
    <div className="relative shrink-0">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${scheme.bg} border border-white/[0.05] flex items-center justify-center font-black text-[13px] ${scheme.text} transition-transform group-hover:scale-110`}>
        {initial}
      </div>
      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0a0a0a] ${scheme.dot}`} />
    </div>
  );
};

// ─── Momentum Indicator ────────────────────────────────────────────────────
// Derived from score: >= 70 = strong up, 40-69 = slight up, < 40 = down
const MomentumBadge = ({ score }) => {
  if (score == null) return null;
  const isUp = score >= 70;
  const isFlat = score >= 40 && score < 70;
  const label = isUp ? `+${Math.round((score - 50) * 0.5)}%` : isFlat ? '+2%' : `-${Math.round((50 - score) * 0.3)}%`;
  return (
    <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
      isUp ? 'text-emerald-400 bg-emerald-400/10' : isFlat ? 'text-amber-400 bg-amber-400/10' : 'text-rose-400 bg-rose-400/10'
    }`}>
      {isUp ? <ArrowUpRight size={10} /> : <TrendingUp size={10} className={!isUp && !isFlat ? 'rotate-90' : ''} />}
      {label}
    </div>
  );
};

// ─── Sort Header ───────────────────────────────────────────────────────────
const SortHeader = ({ label, sortKey, sortBy, sortDir, onSort }) => (
  <button
    onClick={() => onSort(sortKey)}
    className="flex items-center gap-1 text-[9px] font-black text-zinc-600 uppercase tracking-widest hover:text-zinc-300 transition-colors shrink-0"
  >
    {label}
    {sortBy === sortKey && (sortDir === 'asc' ? <ChevronUp size={9} /> : <ChevronDown size={9} />)}
  </button>
);

// ─── Main Table ────────────────────────────────────────────────────────────
const LeadsTable = ({
  leads, loading, selectedId, onSelect, searchQuery, onSearchChange,
  statusFilter, onStatusFilterChange, sourceFilter, onSourceFilterChange,
  sortBy, sortDir, onSort, onCreateNew, totalCount,
}) => {
  const [hoveredRow, setHoveredRow] = useState(null);

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-8 py-5 flex items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Lead Intelligence</h2>
          <p className="text-[11px] text-zinc-600 mt-0.5">{leads.length} of {totalCount} leads</p>
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative w-[260px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search leads..."
            className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl py-2 pl-9 pr-8 text-[12px] text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-white/20 transition-colors"
          />
          {searchQuery && (
            <button onClick={() => onSearchChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-700 hover:text-white transition-colors">
              <X size={11} />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={e => onStatusFilterChange(e.target.value)}
          className="appearance-none bg-white/[0.02] border border-white/[0.06] rounded-xl py-2 px-3 text-[11px] text-zinc-400 font-bold focus:outline-none focus:border-white/20 transition-colors cursor-pointer"
        >
          <option value="All">All Status</option>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.value}</option>)}
        </select>

        {/* Source Filter */}
        <select
          value={sourceFilter}
          onChange={e => onSourceFilterChange(e.target.value)}
          className="appearance-none bg-white/[0.02] border border-white/[0.06] rounded-xl py-2 px-3 text-[11px] text-zinc-400 font-bold focus:outline-none focus:border-white/20 transition-colors cursor-pointer"
        >
          <option value="All">All Sources</option>
          {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.value}</option>)}
        </select>

        {/* New Lead */}
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-xl text-black text-[10px] font-black uppercase tracking-wider hover:bg-cyan-400 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
        >
          <Plus size={13} /> New Lead
        </button>
      </div>

      {/* ── Table Card ──────────────────────────────────────────────────── */}
      <div className="flex-1 px-6 pb-6 min-h-0">
        <div className="relative group/table h-full flex flex-col">
          <div className="absolute inset-0 bg-indigo-500/[0.02] blur-3xl opacity-0 group-hover/table:opacity-100 transition-opacity pointer-events-none rounded-[2rem]" />
          <div className="relative bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/[0.06] rounded-[1.5rem] flex flex-col h-full overflow-hidden shadow-2xl">

            {/* Column Headers */}
            <div className="shrink-0 px-8 py-3 border-b border-white/[0.04] flex items-center gap-6 bg-white/[0.01]">
              <div className="w-10 shrink-0" /> {/* avatar space */}
              <div className="flex-1 min-w-0" style={{ flex: '1.5 1 160px' }}>
                <SortHeader label="Identity" sortKey="company" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              </div>
              <div style={{ width: '120px' }} className="shrink-0">
                <SortHeader label="Status" sortKey="status" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              </div>
              <div style={{ width: '120px' }} className="shrink-0">
                <SortHeader label="Health" sortKey="page_quality_score" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              </div>
              <div style={{ width: '110px' }} className="shrink-0">
                <SortHeader label="Value" sortKey="proposal_value" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              </div>
              <div style={{ width: '110px' }} className="shrink-0">
                <SortHeader label="Revenue" sortKey="revenue" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              </div>
              <div style={{ width: '140px' }} className="shrink-0">
                <SortHeader label="Source" sortKey="source" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              </div>
              <div style={{ width: '110px' }} className="shrink-0">
                <SortHeader label="Location" sortKey="city" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              </div>
              <div style={{ width: '100px' }} className="shrink-0">
                <SortHeader label="Created" sortKey="date_created" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              </div>
              <div className="w-8 shrink-0" />
            </div>

            {/* Table Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-white/[0.02]">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 pt-20">
                  <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-cyan-500/60 animate-spin" />
                  <p className="text-[11px] text-zinc-600 font-medium">Loading leads...</p>
                </div>
              ) : leads.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 pt-20">
                  <Building2 size={32} className="text-zinc-800" />
                  <p className="text-[13px] text-zinc-500 font-bold">No leads found</p>
                  <p className="text-[10px] text-zinc-700">Adjust filters or create a new lead</p>
                </div>
              ) : (
                leads.map((lead, idx) => {
                  const isSelected = selectedId === lead.id;
                  const isHovered = hoveredRow === lead.id;
                  return (
                    <motion.div
                      key={lead.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.015, 0.4) }}
                      onMouseEnter={() => setHoveredRow(lead.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      onClick={() => onSelect(lead.id)}
                      className={`group px-8 py-4 flex items-center gap-6 cursor-pointer transition-all duration-200 ${
                        isSelected ? 'bg-indigo-500/[0.04]' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      {/* Avatar */}
                      <LeadAvatar company={lead.company} score={lead.page_quality_score} />

                      {/* Identity */}
                      <div className="flex-1 min-w-0" style={{ flex: '1.5 1 160px' }}>
                        <p className="text-[13px] font-bold text-white leading-tight group-hover:text-indigo-300 transition-colors truncate">
                          {lead.company || '—'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {(lead.first_name || lead.last_name) && (
                            <span className="text-[10px] text-zinc-500 truncate">{lead.first_name} {lead.last_name}</span>
                          )}
                          {lead.industry && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-zinc-700 shrink-0" />
                              <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider shrink-0">{lead.industry}</span>
                            </>
                          )}
                        </div>
                        {lead.opportunity && lead.opportunity.length > 0 && (
                          <div className="mt-1">
                            <OpportunityTags opportunities={lead.opportunity} />
                          </div>
                        )}
                      </div>

                      {/* Status */}
                      <div className="shrink-0" style={{ width: '120px' }}>
                        <StatusBadge status={lead.status} />
                      </div>

                      {/* Health (score + sparkline) */}
                      <div className="shrink-0" style={{ width: '120px' }}>
                        <PulseBar score={lead.page_quality_score} />
                      </div>

                      {/* Proposal Value */}
                      <div className="shrink-0" style={{ width: '110px' }}>
                        <p className="text-[14px] font-mono font-bold text-white tabular-nums">
                          {formatCurrency(lead.proposal_value)}
                        </p>
                        <MomentumBadge score={lead.page_quality_score} />
                      </div>

                      {/* Revenue */}
                      <div className="shrink-0" style={{ width: '110px' }}>
                        <p className="text-[13px] font-mono font-semibold text-zinc-400 tabular-nums">
                          {formatCurrency(lead.revenue)}
                        </p>
                      </div>

                      {/* Source */}
                      <div className="shrink-0" style={{ width: '140px' }}>
                        <span className="text-[10px] text-zinc-500 font-medium">{lead.source || '—'}</span>
                      </div>

                      {/* Location */}
                      <div className="shrink-0" style={{ width: '110px' }}>
                        <span className="text-[11px] text-zinc-500">
                          {lead.city && lead.state ? `${lead.city}, ${lead.state}` : lead.city || lead.state || '—'}
                        </span>
                      </div>

                      {/* Created */}
                      <div className="shrink-0" style={{ width: '100px' }}>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                          </div>
                          <span className="text-[10px] text-zinc-600">{formatTimestamp(lead.date_created)}</span>
                        </div>
                      </div>

                      {/* Hover actions */}
                      <div className={`w-8 shrink-0 flex items-center justify-end transition-all duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                        <button className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-600 hover:text-white transition-all">
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default LeadsTable;
