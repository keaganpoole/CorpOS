import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ArrowLeft, ArrowRight, BarChart3, ChevronLeft, ChevronRight, Clock3,
  Eye, Filter, Flame, Globe2, Laptop, LayoutDashboard, MousePointer2, RefreshCw,
  Search, ShieldCheck, Smartphone, Sparkles, Target, UserRound, Users, X,
} from 'lucide-react';
import { visitorIntelligenceApi } from '../lib/visitorIntelligenceApi';
import {
  createVisitorInsights, EMPTY_COMMAND_CENTER, formatCount, formatDuration,
  formatPercent, HOMEPAGE_SECTIONS, mergeRecentActivity,
} from '../lib/visitorIntelligence';
import './VisitorsPage.css';

const DEFAULT_FILTERS = { range: '7d', device: 'all', segment: 'all', conversion: 'all', source: '', campaign: '', section: '' };
const RANGE_OPTIONS = [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['all', 'All time']];
const MODES = [
  { id: 'attention', label: 'Attention', icon: Flame },
  { id: 'clicks', label: 'Clicks', icon: MousePointer2 },
  { id: 'scroll', label: 'Scroll', icon: Eye },
  { id: 'dropoff', label: 'Drop-off', icon: ArrowRight },
];

const toNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const formatDate = (value, includeTime = true) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString(undefined, includeTime
    ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
};
const displayAttribution = (value, fallback) => {
  const text = String(value ?? '').trim();
  return !text || text.toLowerCase() === 'null' ? fallback : text;
};

function Panel({ children, className = '', as: Tag = 'section' }) {
  return <Tag className={`visitor-panel rounded-[26px] border border-white/[0.07] bg-[#080808]/90 shadow-[0_20px_70px_rgba(0,0,0,0.16)] ${className}`}>{children}</Tag>;
}

function MetricCard({ label, value, caption, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="flex items-center justify-between gap-3 text-zinc-600"><span className="text-[9px] font-bold uppercase tracking-[0.15em]">{label}</span><Icon size={14} /></div>
      <p className="mt-4 text-[25px] font-semibold tracking-[-0.045em] text-white">{value}</p>
      <p className="mt-1 min-h-[32px] text-[10px] leading-4 text-zinc-600">{caption}</p>
    </div>
  );
}

function SelectFilter({ label, value, onChange, children, title }) {
  return (
    <label className="visitor-select-wrap" title={title}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    </label>
  );
}

function FilterBar({ filters, options, onChange, onReset }) {
  const active = Object.entries(filters).filter(([key, value]) => value && value !== 'all' && !(key === 'range' && value === '7d')).length;
  return (
    <div className="visitor-filter-bar custom-scrollbar">
      <div className="flex items-center gap-2 px-2 text-zinc-600"><Filter size={13} /><span className="text-[9px] font-bold uppercase tracking-[0.16em]">Segment</span></div>
      <div className="visitor-range-tabs">
        {RANGE_OPTIONS.map(([id, label]) => <button key={id} type="button" className={filters.range === id ? 'active' : ''} onClick={() => onChange('range', id)}>{label}</button>)}
      </div>
      <SelectFilter label="Device" value={filters.device} onChange={(value) => onChange('device', value)}>
        <option value="all">All devices</option><option value="desktop">Desktop</option><option value="tablet">Tablet</option><option value="mobile">Mobile</option><option value="unknown">Unknown</option>
      </SelectFilter>
      <SelectFilter label="Visitor" value={filters.segment} onChange={(value) => onChange('segment', value)}>
        <option value="all">New & returning</option><option value="new">New</option><option value="returning">Returning</option>
      </SelectFilter>
      <SelectFilter label="Conversion" value={filters.conversion} onChange={(value) => onChange('conversion', value)}>
        <option value="all">All outcomes</option><option value="converted">Converted</option><option value="non_converted">Not converted</option>
      </SelectFilter>
      <SelectFilter label="Source" value={filters.source} onChange={(value) => onChange('source', value)}>
        <option value="">All sources</option>{(options.sources || []).map((item) => <option key={item} value={item}>{displayAttribution(item, 'Direct')}</option>)}
      </SelectFilter>
      <SelectFilter label="Campaign" value={filters.campaign} onChange={(value) => onChange('campaign', value)}>
        <option value="">All campaigns</option>{(options.campaigns || []).map((item) => <option key={item} value={item}>{displayAttribution(item, 'Unattributed')}</option>)}
      </SelectFilter>
      {filters.section && <button type="button" className="visitor-filter-chip" onClick={() => onChange('section', '')}>Section: {HOMEPAGE_SECTIONS.find((item) => item.id === filters.section)?.label || filters.section}<X size={11} /></button>}
      {active > 0 && <button type="button" className="visitor-reset" onClick={onReset}>Reset {active}</button>}
    </div>
  );
}

function SectionArtwork({ sectionId }) {
  if (sectionId === 'hero') return <div className="mini-hero"><i /><i /><i /><div><b>Meet your AI front desk</b><span /><span /></div><span className="mini-hero-cta">Get started</span></div>;
  if (sectionId === 'calendar') return <div className="mini-calendar"><div className="mini-calendar-copy"><b>Calendar</b><i /><i /></div><div className="mini-calendar-grid">{Array.from({ length: 20 }, (_, index) => <i key={index} className={index === 8 || index === 14 ? 'active' : ''} />)}</div></div>;
  if (sectionId === 'people-crm') return <div className="mini-people"><b>People & CRM</b>{[0, 1, 2].map((item) => <div key={item}><i /><span /><em /></div>)}</div>;
  if (sectionId === 'live-monitoring') return <div className="mini-monitor"><b>Live Monitoring</b><div>{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ height: `${7 + ((index * 11) % 22)}px` }} />)}</div></div>;
  if (sectionId === 'comparison') return <div className="mini-comparison"><b>Built to see the whole operation</b><div><i /><i /><i /></div></div>;
  if (sectionId === 'scenarios') return <div className="mini-scenarios"><b>Scenarios</b><div><i /><span /><i /><span /><i /></div></div>;
  return <div className="mini-security"><ShieldCheck size={22} /><div><b>Security at every layer</b><span /><span /></div></div>;
}

function HomepageSurface({ snapshot, mode, selectedSection, selectedClick, onSection, onClick }) {
  const sectionsById = useMemo(() => Object.fromEntries((snapshot.sections || []).map((item) => [item.id, item])), [snapshot.sections]);
  const maxClicks = Math.max(1, ...(snapshot.clicks || []).map((item) => toNumber(item.clicks)));
  return (
    <div className={`homepage-intelligence-surface mode-${mode}`}>
      <div className="homepage-browser-chrome"><i /><i /><i /><span>nodemere.ai</span></div>
      <div className="homepage-mini-header"><strong>NODEMERE</strong><span /><span /><span className="homepage-mini-header-cta">Get started</span></div>
      {HOMEPAGE_SECTIONS.map((catalog) => {
        const data = sectionsById[catalog.id] || { id: catalog.id, label: catalog.label, attention_state: 'Dormant' };
        const score = toNumber(data.attention_score);
        const reach = toNumber(data.reach_rate);
        const dropoff = toNumber(data.dropoff_rate);
        const clicks = (snapshot.clicks || []).filter((item) => item.section_id === catalog.id);
        return (
          <button
            type="button" key={catalog.id}
            className={`homepage-preview-section ${selectedSection === catalog.id ? 'selected' : ''}`}
            style={{ '--attention': score / 100, '--reach': reach / 100, '--dropoff': dropoff / 100 }}
            onClick={() => onSection(catalog.id)}
            title={`${catalog.label}: ${formatPercent(reach)} reach`}
          >
            <SectionArtwork sectionId={catalog.id} />
            <div className="section-overlay" />
            <div className="section-label"><span>{catalog.label}</span><em>{mode === 'attention' ? data.attention_state || 'Dormant' : mode === 'scroll' ? `${formatPercent(reach)} reach` : mode === 'dropoff' ? `${formatPercent(dropoff)} drop-off` : `${formatCount(data.clicks)} clicks`}</em></div>
            {mode === 'scroll' && <div className="section-reach-line" />}
            {mode === 'dropoff' && dropoff > 0 && <div className="section-drop-marker"><ArrowRight size={10} /> {formatCount(data.dropoffs)} lost</div>}
            {mode === 'clicks' && clicks.map((item) => {
              const size = 18 + 24 * Math.sqrt(toNumber(item.clicks) / maxClicks);
              return <span key={`${item.element_id}-${item.x}-${item.y}`} className={`click-cluster ${item.cta_clicks > 0 ? 'cta' : ''} ${selectedClick?.element_id === item.element_id ? 'selected' : ''}`} style={{ left: `${toNumber(item.x) * 100}%`, top: `${toNumber(item.y) * 100}%`, width: size, height: size }} onClick={(event) => { event.stopPropagation(); onClick(item); }} title={`${item.element_id}: ${item.clicks} clicks`} />;
            })}
          </button>
        );
      })}
    </div>
  );
}

function Drilldown({ section, click }) {
  if (click) return (
    <div className="visitor-drilldown">
      <div><p>Selected element</p><h3>{click.element_id}</h3><span>{click.section_id} · {click.element_type}</span></div>
      <dl><div><dt>Clicks</dt><dd>{formatCount(click.clicks)}</dd></div><div><dt>Unique visitors</dt><dd>{formatCount(click.unique_visitors)}</dd></div><div><dt>Click-through</dt><dd>{formatPercent(click.click_through_rate)}</dd></div><div><dt>Conversion</dt><dd>{formatPercent(click.conversion_rate)}</dd></div><div><dt>CTA clicks</dt><dd>{formatCount(click.cta_clicks)}</dd></div><div><dt>Converted visitors</dt><dd>{formatCount(click.converted_visitors)}</dd></div></dl>
    </div>
  );
  if (!section) return <div className="visitor-drilldown empty"><MousePointer2 size={16} /><span>Select a homepage section or click cluster to inspect it.</span></div>;
  return (
    <div className="visitor-drilldown">
      <div><p>Section drill-down</p><h3>{section.label}</h3><span>{section.attention_state || 'Dormant'} attention</span></div>
      <dl><div><dt>Reach</dt><dd>{formatPercent(section.reach_rate)}</dd></div><div><dt>Visible time</dt><dd>{formatDuration(section.average_visible_seconds)}</dd></div><div><dt>Clicks / CTA</dt><dd>{formatCount(section.clicks)} / {formatCount(section.cta_clicks)}</dd></div><div><dt>Drop-off</dt><dd>{formatPercent(section.dropoff_rate)}</dd></div><div><dt>Continuation</dt><dd>{formatPercent(section.continuation_rate)}</dd></div><div><dt>Converted</dt><dd>{formatCount(section.converted_visitors)}</dd></div><div><dt>New</dt><dd>{formatCount(section.new_visitors)}</dd></div><div><dt>Returning</dt><dd>{formatCount(section.returning_visitors)}</dd></div></dl>
    </div>
  );
}

function InsightRail({ insights, activity, onInsight, onVisitor }) {
  return (
    <aside className="space-y-4">
      <Panel className="p-5">
        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.17em] text-zinc-600"><Sparkles size={13} className="brand-icon" /> Deterministic insights</div>
        <div className="mt-4 space-y-2">
          {insights.length ? insights.map((item) => <button type="button" key={`${item.kind}-${item.title}`} onClick={() => onInsight(item)} className="visitor-insight"><i className={`kind-${item.kind}`} /><div><strong>{item.title}</strong><p>{item.body}</p></div></button>) : <div className="visitor-empty-small">Insights appear after at least five visitors produce a reliable section or segment signal.</div>}
        </div>
      </Panel>
      <Panel className="p-5">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.17em] text-zinc-600"><Activity size={13} className="text-emerald-300" /> Visitor Pulse</div><span className="visitor-live-dot">Live</span></div>
        <div className="mt-4 max-h-[330px] space-y-1 overflow-y-auto pr-1 custom-scrollbar">
          {activity.length ? activity.map((item) => <button key={item.id} type="button" className="visitor-activity-row" onClick={() => onVisitor(item.visitor_id)}><i /><div><strong>{String(item.event || '').replaceAll('_', ' ')}</strong><span>{item.section || item.page || 'Website'} · {formatDate(item.occurred_at)}</span></div></button>) : <div className="visitor-empty-small">No visitor activity in the last 30 minutes.</div>}
        </div>
      </Panel>
    </aside>
  );
}

function BarList({ items, labelKey, valueKey = 'visitors', empty = 'No measured data in this segment.' }) {
  const maximum = Math.max(1, ...(items || []).map((item) => toNumber(item[valueKey])));
  if (!items?.length) return <div className="visitor-empty-small">{empty}</div>;
  return <div className="visitor-bar-list">{items.map((item) => <div key={item[labelKey]}><div><span>{displayAttribution(item[labelKey], labelKey === 'campaign' ? 'Unattributed' : 'Direct')}</span><strong>{formatCount(item[valueKey])}</strong></div><i><em style={{ width: `${100 * toNumber(item[valueKey]) / maximum}%` }} /></i></div>)}</div>;
}

function DeepAnalytics({ deep, comparison }) {
  const [tab, setTab] = useState('acquisition');
  const tabs = ['acquisition', 'behavior', 'engagement', 'conversion', 'devices', 'geography'];
  const content = {
    acquisition: <div className="grid gap-7 md:grid-cols-2"><div><h4>Top sources</h4><BarList items={deep.acquisition?.sources} labelKey="source" /></div><div><h4>Campaigns</h4><BarList items={deep.acquisition?.campaigns} labelKey="campaign" /></div></div>,
    behavior: <div><h4>Page activity</h4><BarList items={deep.behavior?.pages} labelKey="page" valueKey="pageviews" /></div>,
    engagement: <div className="visitor-ledger"><div><span>Average scroll depth</span><strong>{formatPercent(deep.engagement?.average_scroll_depth)}</strong></div><div><span>90% completion rate</span><strong>{formatPercent(deep.engagement?.completion_rate)}</strong></div></div>,
    conversion: <div className="visitor-ledger"><div><span>Signup conversions</span><strong>{formatCount(deep.conversion?.signups)}</strong></div><div><span>Paid conversions</span><strong>{formatCount(deep.conversion?.paid)}</strong></div><div><span>Signup rate</span><strong>{formatPercent(deep.conversion?.rate)}</strong></div></div>,
    devices: <div className="grid gap-7 md:grid-cols-2"><div><h4>Devices</h4><BarList items={deep.devices?.devices} labelKey="device" /></div><div><h4>Browsers</h4><BarList items={deep.devices?.browsers} labelKey="browser" /></div></div>,
    geography: <div className="visitor-geography-empty"><Globe2 size={22} /><strong>Geography is unavailable</strong><p>{deep.geography?.message || 'Location data is not collected by the current instrumentation.'}</p></div>,
  };
  const fresh = comparison?.new || {};
  const returning = comparison?.returning || {};
  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-white/[0.06] p-5 sm:p-6"><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-600">Deep analytics</p><h2 className="mt-2 text-[22px] font-semibold tracking-[-0.035em] text-white">See what creates momentum</h2></div>
      <div className="visitor-deep-tabs custom-scrollbar">{tabs.map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={tab === item ? 'active' : ''}>{item}</button>)}</div>
      <div className="visitor-deep-content">{content[tab]}</div>
      <div className="visitor-comparison">
        <div><p>Comparison</p><h3>New vs returning</h3><span>One consistent view across the selected period.</span></div>
        {[['New', fresh], ['Returning', returning]].map(([label, data]) => <div key={label} className="comparison-column"><strong>{label}</strong><dl><div><dt>Visitors</dt><dd>{formatCount(data.visitors)}</dd></div><div><dt>Sessions</dt><dd>{formatCount(data.sessions)}</dd></div><div><dt>Engaged</dt><dd>{formatDuration(data.avg_engaged_seconds)}</dd></div><div><dt>Scroll</dt><dd>{formatPercent(data.avg_scroll_depth)}</dd></div><div><dt>Converted</dt><dd>{formatCount(data.converted)}</dd></div></dl></div>)}
      </div>
    </Panel>
  );
}

function VisitorsTable({ data, filters, onFilter, onOpen, loading }) {
  const pages = Math.max(1, Math.ceil(toNumber(data.total) / toNumber(data.page_size || 25)));
  return (
    <Panel className="overflow-hidden" id="visitor-table">
      <div className="visitor-table-toolbar">
        <div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-600">Visitor directory</p><h2 className="mt-2 text-[22px] font-semibold tracking-[-0.035em] text-white">Visitors</h2><span>{formatCount(data.total)} matched profiles</span></div>
        <div className="visitor-table-controls">
          <label className="visitor-search"><Search size={13} /><input value={filters.search} onChange={(event) => onFilter('search', event.target.value)} placeholder="Search ID, source, campaign…" /></label>
          <select value={filters.status} onChange={(event) => onFilter('status', event.target.value)}><option value="all">All statuses</option><option value="new">New</option><option value="returning">Returning</option><option value="anonymous">Anonymous</option><option value="registered">Registered</option><option value="converted">Converted</option></select>
          <select value={filters.sort} onChange={(event) => onFilter('sort', event.target.value)}><option value="last_seen_desc">Last seen</option><option value="first_seen_desc">First seen</option><option value="visits_desc">Most visits</option><option value="pageviews_desc">Most pageviews</option><option value="engaged_desc">Most engaged</option></select>
        </div>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="visitor-table">
          <thead><tr><th>Visitor</th><th>Status</th><th>First seen</th><th>Last seen</th><th>Visits</th><th>Sessions</th><th>Pageviews</th><th>Engaged</th><th>Location</th><th>Device</th><th>Browser</th><th>Source</th><th>Campaign</th><th>Depth</th><th>Conversion</th></tr></thead>
          <tbody>
            {data.items?.map((item) => <tr key={item.visitor_id} onClick={() => onOpen(item.visitor_id)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') onOpen(item.visitor_id); }}>
              <td><div className="visitor-id-cell"><i><UserRound size={12} /></i><span>{String(item.visitor_id).slice(0, 8)}</span></div></td><td><span className={`visitor-status status-${String(item.status).toLowerCase()}`}>{item.visitor_type} · {item.status}</span></td><td>{formatDate(item.first_seen_at)}</td><td>{formatDate(item.last_seen_at)}</td><td>{formatCount(item.visits)}</td><td>{formatCount(item.sessions)}</td><td>{formatCount(item.pageviews)}</td><td>{formatDuration(item.engaged_seconds)}</td><td>Not available</td><td className="capitalize">{item.device}</td><td className="capitalize">{String(item.browser).replaceAll('_', ' ')}</td><td>{displayAttribution(item.source, 'Direct')}</td><td>{displayAttribution(item.campaign, 'Unattributed')}</td><td>{item.deepest_section_id || 'Not reached'}</td><td>{item.subscribed_at ? 'Paid' : item.signed_up_at || item.user_id ? 'Signup' : 'None'}</td>
            </tr>)}
            {!loading && !data.items?.length && <tr><td colSpan="15"><div className="visitor-table-empty"><Users size={19} /><strong>No visitors match this view</strong><span>Change a filter or wait for consented visitor activity.</span></div></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="visitor-pagination"><span>Page {data.page || 1} of {pages}</span><div><button type="button" disabled={(data.page || 1) <= 1} onClick={() => onFilter('page', (data.page || 1) - 1)}><ChevronLeft size={14} /></button><button type="button" disabled={(data.page || 1) >= pages} onClick={() => onFilter('page', (data.page || 1) + 1)}><ChevronRight size={14} /></button></div></div>
    </Panel>
  );
}

function ProfileDrawer({ profile, loading, onClose }) {
  if (!profile && !loading) return null;
  const identity = profile?.identity || {};
  return <div className="visitor-drawer-backdrop" onMouseDown={onClose}><aside className="visitor-profile-drawer custom-scrollbar" onMouseDown={(event) => event.stopPropagation()}>
    <div className="visitor-profile-head"><div><p>Visitor profile</p><h2>{identity.id ? String(identity.id).slice(0, 12) : 'Loading…'}</h2></div><button type="button" onClick={onClose}><X size={16} /></button></div>
    {loading ? <div className="visitor-profile-loading"><RefreshCw className="animate-spin" size={20} /> Loading visitor history</div> : <>
      <div className="visitor-profile-identity"><div className="profile-avatar"><UserRound size={20} /></div><div><strong>{identity.status}</strong><span>{identity.linked ? 'Linked identity' : 'Anonymous identity'} · {formatCount(identity.identity_confidence)}% confidence</span></div></div>
      <ProfileSection title="Identity"><ProfileGrid rows={[["Visitor ID", identity.id], ["Fingerprint", identity.fingerprint], ["Fingerprint confidence", `${formatCount(identity.fingerprint_confidence)}%`], ["Match method", String(identity.match_method || '').replaceAll('_', ' ')]]} /></ProfileSection>
      <ProfileSection title="Overview"><ProfileGrid rows={[["First seen", formatDate(profile.overview?.first_seen_at)], ["Last seen", formatDate(profile.overview?.last_seen_at)], ["Visits", formatCount(profile.overview?.visits)], ["Pageviews", formatCount(profile.overview?.pageviews)], ["Engaged time", formatDuration(profile.overview?.engaged_seconds)], ["Average session", formatDuration(profile.overview?.average_session_seconds)]]} /></ProfileSection>
      <ProfileSection title="Attribution"><ProfileGrid rows={[["Original source", displayAttribution(profile.attribution?.original?.utm_source || profile.attribution?.original?.referrer, 'Direct')], ["Original campaign", displayAttribution(profile.attribution?.original?.utm_campaign, 'Unattributed')], ["Latest source", displayAttribution(profile.attribution?.latest?.utm_source || profile.attribution?.latest?.referrer, 'Direct')], ["Landing page", profile.attribution?.original?.landing_page || 'Not available']]} /></ProfileSection>
      <ProfileSection title="Device & location"><ProfileGrid rows={[["Device", profile.device?.device_type || 'Unknown'], ["Browser", profile.device?.browser || 'Unknown'], ["Operating system", profile.device?.os || 'Unknown'], ["Location", profile.location?.display || 'Not available']]} /></ProfileSection>
      <ProfileSection title="Conversion journey"><ProfileGrid rows={[["Signed up", formatDate(profile.conversion?.signed_up_at)], ["Paid", formatDate(profile.conversion?.subscribed_at)], ["Visits before signup", profile.conversion?.visits_before_signup ?? 'Not available'], ["Time before signup", profile.conversion?.time_to_signup_seconds == null ? 'Not available' : formatDuration(profile.conversion.time_to_signup_seconds)]]} /></ProfileSection>
      <ProfileSection title="Timeline"><div className="visitor-timeline">{profile.timeline?.length ? profile.timeline.map((item) => <div key={item.id}><i /><div><strong>{String(item.event).replaceAll('_', ' ')}</strong><span>{item.section || item.page || 'Website'} · {formatDate(item.occurred_at)}</span></div></div>) : <div className="visitor-empty-small">No retained events.</div>}</div></ProfileSection>
    </>}
  </aside></div>;
}

function ProfileSection({ title, children }) { return <section className="visitor-profile-section"><h3>{title}</h3>{children}</section>; }
function ProfileGrid({ rows }) { return <dl className="visitor-profile-grid">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd title={String(value ?? '')}>{value ?? 'Not available'}</dd></div>)}</dl>; }

export default function VisitorsPage({ client = visitorIntelligenceApi }) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [tableFilters, setTableFilters] = useState({ page: 1, page_size: 25, search: '', sort: 'last_seen_desc', status: 'all' });
  const [snapshot, setSnapshot] = useState(EMPTY_COMMAND_CENTER);
  const [visitors, setVisitors] = useState({ total: 0, page: 1, page_size: 25, items: [] });
  const [activity, setActivity] = useState([]);
  const [mode, setMode] = useState('attention');
  const [selectedClick, setSelectedClick] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [error, setError] = useState('');
  const refreshRevision = useRef(0);
  const activityRef = useRef([]);

  const loadSnapshot = useCallback(async () => {
    const revision = ++refreshRevision.current;
    setLoading(true); setError('');
    try {
      const data = await client.commandCenter(filters);
      if (revision === refreshRevision.current) setSnapshot(data || EMPTY_COMMAND_CENTER);
    } catch (requestError) {
      if (revision === refreshRevision.current) setError(requestError.message);
    } finally { if (revision === refreshRevision.current) setLoading(false); }
  }, [client, filters]);

  useEffect(() => { loadSnapshot(); }, [loadSnapshot]);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setTableLoading(true);
      try {
        const data = await client.visitors({ ...filters, ...tableFilters, search: tableFilters.search.trim() });
        if (!cancelled) setVisitors(data || { total: 0, page: tableFilters.page, page_size: tableFilters.page_size, items: [] });
      } catch (requestError) { if (!cancelled) setError(requestError.message); }
      finally { if (!cancelled) setTableLoading(false); }
    }, tableFilters.search ? 240 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [filters, tableFilters]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const since = activityRef.current[0]?.occurred_at || null;
        const incoming = await client.activity(since, 30);
        if (!cancelled) setActivity((current) => {
          const merged = mergeRecentActivity(current, incoming, 30); activityRef.current = merged; return merged;
        });
      } catch { /* The main surface already reports authorization/read failures. */ }
    };
    poll();
    const timer = setInterval(poll, 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [client]);

  const updateFilter = (key, value) => { setFilters((current) => ({ ...current, [key]: value })); setTableFilters((current) => ({ ...current, page: 1 })); setSelectedClick(null); };
  const updateTableFilter = (key, value) => setTableFilters((current) => ({ ...current, [key]: value, ...(key === 'page' ? {} : { page: 1 }) }));
  const openProfile = async (visitorId) => {
    setProfile(null); setProfileLoading(true);
    try { setProfile(await client.profile(visitorId)); }
    catch (requestError) { setError(requestError.message); setProfileLoading(false); return; }
    setProfileLoading(false);
  };
  const selectSection = (sectionId) => { updateFilter('section', filters.section === sectionId ? '' : sectionId); setSelectedClick(null); document.getElementById('visitor-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const sections = snapshot.homepage?.sections || [];
  const selectedSection = sections.find((item) => item.id === filters.section);
  const insights = useMemo(() => createVisitorInsights(snapshot), [snapshot]);
  const overview = snapshot.overview || {};
  const metrics = [
    ['Visitors', formatCount(overview.visitors), `${formatCount(overview.new_visitors)} new · ${formatCount(overview.returning_visitors)} returning`, Users],
    ['Sessions', formatCount(overview.sessions), `${formatCount(overview.pageviews)} pageviews`, LayoutDashboard],
    ['Average engaged', formatDuration(overview.avg_engaged_seconds), `${formatDuration(overview.avg_session_seconds)} average session`, Clock3],
    ['Scroll depth', formatPercent(overview.avg_scroll_depth), `${formatPercent(overview.completion_rate)} reached 90%`, Eye],
    ['Signup conversions', formatCount(overview.signup_conversions), `${formatCount(overview.paid_conversions)} paid conversions`, Target],
    ['Conversion rate', formatPercent(overview.conversion_rate), `${formatCount(overview.avg_visits_before_signup)} visits before signup`, BarChart3],
  ];

  return (
    <div className="visitor-command-center min-h-screen bg-[#020202] text-zinc-100">
      <header className="visitor-command-header">
        <button type="button" onClick={() => navigate('/dashboard')} className="visitor-back"><ArrowLeft size={15} /> Dashboard</button>
        <div className="visitor-wordmark">NODEMERE <span>INTELLIGENCE</span></div>
        <button type="button" onClick={loadSnapshot} disabled={loading} className="visitor-refresh"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </header>
      <main className="mx-auto max-w-[1580px] px-4 pb-24 pt-7 sm:px-7 lg:px-10">
        <div className="visitor-title-row">
          <div><div className="mb-3 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600"><Activity size={13} className="brand-icon" /> Nodemere intelligence</div><h1>Visitor Intelligence</h1><p>Understand how consented visitors discover, explore, and convert across Nodemere.</p></div>
          <div className="visitor-period-totals"><div><span>Today</span><strong>{formatCount(overview.visitors_today)}</strong></div><div><span>7 days</span><strong>{formatCount(overview.visitors_week)}</strong></div><div><span>30 days</span><strong>{formatCount(overview.visitors_month)}</strong></div></div>
        </div>
        <FilterBar filters={filters} options={snapshot.filters || {}} onChange={updateFilter} onReset={() => { setFilters(DEFAULT_FILTERS); setTableFilters((current) => ({ ...current, page: 1 })); }} />
        {error && <div className="visitor-error"><ShieldCheck size={15} /><span>{error}</span><button type="button" onClick={loadSnapshot}>Retry</button></div>}
        <div className={`visitor-content ${loading ? 'is-loading' : ''}`}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{metrics.map(([label, value, caption, icon]) => <MetricCard key={label} label={label} value={value} caption={caption} icon={icon} />)}</div>
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
            <Panel className="overflow-hidden">
              <div className="visitor-surface-head"><div><p>Homepage intelligence</p><h2>See where attention turns into action</h2><span>{displayAttribution(overview.top_source, 'No source yet')} · {overview.top_device || 'No device yet'} · Updated {formatDate(snapshot.generated_at)}</span></div><div className="visitor-mode-tabs">{MODES.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={mode === id ? 'active' : ''} onClick={() => setMode(id)}><Icon size={12} />{label}</button>)}</div></div>
              <div className="visitor-surface-body"><HomepageSurface snapshot={snapshot.homepage || {}} mode={mode} selectedSection={filters.section} selectedClick={selectedClick} onSection={selectSection} onClick={setSelectedClick} /></div>
              <Drilldown section={selectedSection} click={selectedClick} />
            </Panel>
            <InsightRail insights={insights} activity={activity} onInsight={(item) => item.section && selectSection(item.section)} onVisitor={openProfile} />
          </div>
          <div className="mt-5"><DeepAnalytics deep={snapshot.deep || EMPTY_COMMAND_CENTER.deep} comparison={snapshot.comparison || {}} /></div>
          <div className="mt-5"><VisitorsTable data={visitors} filters={tableFilters} onFilter={updateTableFilter} onOpen={openProfile} loading={tableLoading} /></div>
        </div>
      </main>
      <ProfileDrawer profile={profile} loading={profileLoading} onClose={() => { setProfile(null); setProfileLoading(false); }} />
    </div>
  );
}
