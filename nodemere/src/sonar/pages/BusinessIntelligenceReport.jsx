import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Brain,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Info,
  Phone,
  RefreshCw,
  Settings2,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import CubePreloader from '../components/CubePreloader';
import { RealtimeSankey, useLiveSankeyState } from './LiveMonitoringPage';

let businessIntelligenceCache = null;

const TYPE_STYLES = {
  Measured: 'border-sky-400/20 bg-sky-400/[0.07] text-sky-300',
  Calculated: 'border-violet-400/20 bg-violet-400/[0.07] text-violet-300',
};

const SECTION_META = {
  calls: { label: 'Calls', description: 'Every retained call-log signal, from volume through capture coverage.', icon: Phone },
  appointments: { label: 'Appointments', description: 'Booking volume, outcomes, capacity, and calendar demand.', icon: CalendarDays },
  people: { label: 'People & CRM', description: 'The quality, growth, and appointment history of your people records.', icon: Users },
  payments: { label: 'Payments & revenue', description: 'Successful payment activity and clearly labelled aggregate ratios.', icon: CreditCard },
  automation: { label: 'AI & automation', description: 'Scenario coverage and the workflow events your system has actually emitted.', icon: Workflow },
  operations: { label: 'Team & readiness', description: 'Your operating setup, capacity, service catalog, and plan usage.', icon: Settings2 },
  documents: { label: 'Document requests', description: 'Optional request and document activity, when this workflow is in use.', icon: FileText },
};

const formatDate = (value) => {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const getScore = (item) => Number.isFinite(Number(item?.score)) ? Number(item.score) : null;

function TypeBadge({ type }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${TYPE_STYLES[type] || 'border-white/10 bg-white/[0.04] text-zinc-400'}`}>{type}</span>;
}

function ScoreBar({ score, displayValue }) {
  if (score === null || score === undefined) return null;
  const normalizedScore = Math.max(0, Math.min(100, score));
  return (
    <div
      className="ml-auto grid h-8 w-8 place-items-center rounded-full p-[2px]"
      style={{ background: `conic-gradient(from 215deg, var(--brandGradientStart) 0%, var(--brandGradientEnd) ${normalizedScore}%, rgba(255,255,255,0.08) ${normalizedScore}% 100%)` }}
      title={`${normalizedScore}/100`}
      aria-label={`${normalizedScore} out of 100`}
    >
      <span className="grid h-full w-full place-items-center rounded-full bg-[#080808] text-[8px] font-bold text-zinc-400">{displayValue || `${normalizedScore}%`}</span>
    </div>
  );
}

function Panel({ children, className = '' }) {
  return <section className={`business-report-panel rounded-[26px] border border-white/[0.07] bg-[#080808]/90 shadow-[0_20px_70px_rgba(0,0,0,0.16)] ${className}`}>{children}</section>;
}

function HeroMetric({ item, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="flex items-center justify-between gap-3 text-zinc-600"><span className="text-[10px] font-bold uppercase tracking-[0.14em]">{item.label}</span><Icon size={14} /></div>
      <p className="mt-4 text-[24px] font-semibold tracking-[-0.04em] text-white">{item.value}</p>
      <p className="mt-1 text-[11px] leading-4 text-zinc-600">{item.explanation}</p>
    </div>
  );
}

function MetricRow({ item }) {
  const score = getScore(item);
  const missing = String(item?.value || '').toLowerCase() === 'not enough data';
  return (
    <div className="border-b border-white/[0.06] py-4 last:border-0">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><p className="text-[12px] font-semibold tracking-[-0.01em] text-zinc-100">{item.label}</p><TypeBadge type={item.type} /></div>
          <p className="mt-1.5 max-w-[580px] text-[11px] leading-5 text-zinc-500">{item.explanation}</p>
        </div>
        <div className={`flex max-w-[46%] shrink-0 items-center justify-end self-stretch text-right text-[14px] font-semibold tracking-[-0.02em] ${missing ? 'text-zinc-600' : 'text-zinc-100'}`}>
          {score === null || score === undefined ? item.value : <ScoreBar score={score} displayValue={item.value} />}
        </div>
      </div>
    </div>
  );
}

function MetricLedger({ items = [] }) {
  return <div className="grid gap-x-10 md:grid-cols-2">{items.map((item) => <MetricRow key={item.label} item={item} />)}</div>;
}

function SectionHeading({ sectionKey, meta }) {
  const Icon = meta.icon;
  return (
    <div id={sectionKey} className="mb-5 flex scroll-mt-8 items-end justify-between gap-5">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600"><Icon size={13} /> Business intelligence</div>
        <h2 className="text-[23px] font-semibold tracking-[-0.035em] text-white">{meta.label}</h2>
        <p className="mt-1 text-[12px] text-zinc-500">{meta.description}</p>
      </div>
      <a href="#business-report-top" className="report-print-hide hidden text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600 transition hover:text-zinc-300 sm:block">Back to top</a>
    </div>
  );
}

function HeroSlideControls({ activeSlide, onChange }) {
  return (
    <div className="report-print-hide flex items-center gap-2">
      <button type="button" onClick={() => onChange(activeSlide === 0 ? 1 : 0)} className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.09] bg-white/[0.03] text-zinc-400 transition hover:bg-white/[0.07] hover:text-white" aria-label="Previous intelligence slide"><ChevronLeft size={15} /></button>
      <div className="flex items-center gap-1.5">{[0, 1].map((index) => <button key={index} type="button" onClick={() => onChange(index)} className={`h-1.5 rounded-full transition-all ${activeSlide === index ? 'brand-gradient w-5' : 'w-1.5 bg-white/[0.2] hover:bg-white/[0.4]'}`} aria-label={`Show intelligence slide ${index + 1}`} />)}</div>
      <button type="button" onClick={() => onChange(activeSlide === 1 ? 0 : 1)} className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.09] bg-white/[0.03] text-zinc-400 transition hover:bg-white/[0.07] hover:text-white" aria-label="Next intelligence slide"><ChevronRight size={15} /></button>
    </div>
  );
}

function LiveRouteStyles() {
  return <style>{`
    .business-intelligence-report .live-sankey-shell { height: 100%; min-height: 300px; position: relative; overflow: visible; background: transparent; user-select: none; }
    .business-intelligence-report .live-monitoring-sankey-link { transition: stroke-opacity 180ms ease; stroke-linecap: round; stroke-linejoin: round; }
    .business-intelligence-report .live-node-bar { transition: opacity 180ms ease; }
    .business-intelligence-report .live-node-pulsing, .business-intelligence-report .live-node-active, .business-intelligence-report .live-node-partial { animation: businessRouteBreath 1.7s ease-in-out infinite; }
    .business-intelligence-report .live-node-completed { animation: businessRouteConfirm 900ms ease-out 1; }
    @keyframes businessRouteBreath { 0%, 100% { opacity: .62; } 50% { opacity: 1; } }
    @keyframes businessRouteConfirm { 0% { opacity: .58; } 35% { opacity: 1; } 100% { opacity: .86; } }
    .business-intelligence-report .live-sankey-tooltip { pointer-events: none; position: fixed; z-index: 50; min-width: 220px; max-width: 280px; opacity: 0; border-radius: 12px; border: 1px solid rgba(255,255,255,.08); background: linear-gradient(180deg,rgba(9,9,11,.96),rgba(6,6,8,.94)); box-shadow: 0 18px 46px rgba(0,0,0,.62); color: white; padding: 12px 13px; font-size: 10px; font-weight: 700; backdrop-filter: blur(18px); transition: opacity 160ms ease; }
    .business-intelligence-report .live-tooltip-card { display: flex; flex-direction: column; gap: 9px; }
    .business-intelligence-report .live-tooltip-topline, .business-intelligence-report .live-tooltip-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .business-intelligence-report .live-tooltip-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
    .business-intelligence-report .live-tooltip-kicker, .business-intelligence-report .live-tooltip-time, .business-intelligence-report .live-tooltip-key { color: #6b7280; font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .business-intelligence-report .live-tooltip-time { letter-spacing: .04em; }
    .business-intelligence-report .live-tooltip-route { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 800; line-height: 1.2; }
    .business-intelligence-report .live-tooltip-arrow { color: #52525b; font-size: 10px; }
    .business-intelligence-report .live-tooltip-grid { display: grid; gap: 6px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.05); }
    .business-intelligence-report .live-tooltip-val { color: #f4f4f5; font-size: 10px; font-weight: 700; text-align: right; }
    .business-intelligence-report .live-tooltip-val-mono { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; color: #d4d4d8; }
    .business-intelligence-report .live-tooltip-chip { display: inline-flex; align-items: center; border-radius: 999px; border: 1px solid rgba(6,182,212,.28); background: rgba(6,182,212,.1); color: #67e8f9; padding: 2px 6px; font-size: 8px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
    .business-intelligence-report .live-tooltip-chip-failed { border-color: rgba(244,63,94,.26); background: rgba(244,63,94,.1); color: #fda4af; }
  `}</style>;
}

export default function BusinessIntelligenceReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);
  const flowState = useLiveSankeyState();

  const loadReport = useCallback(async ({ force = false } = {}) => {
    setBusy(force ? 'refresh' : null);
    setError('');
    try {
      const next = await api.getBusinessIntelligence();
      if (!next) throw new Error('The business intelligence service did not return a report.');
      businessIntelligenceCache = next;
      setReport(next);
      if (force) setStatus('Business intelligence refreshed');
    } catch (requestError) {
      setError(requestError.message || 'Could not load business intelligence.');
    } finally {
      setLoading(false);
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    if (businessIntelligenceCache) {
      setReport(businessIntelligenceCache);
      setLoading(false);
      return undefined;
    }
    loadReport();
    return undefined;
  }, [loadReport]);

  const exportPdf = async () => {
    const element = document.getElementById('business-report-top');
    if (!element) return;
    setBusy('pdf');
    setError('');
    setStatus('Preparing PDF download…');
    element.classList.add('report-exporting');
    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default || html2pdfModule;
      await html2pdf()
        .set({
          margin: 0.35,
          filename: 'business-intelligence-report.pdf',
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#020202', scrollY: 0 },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        })
        .from(element)
        .save();
      setStatus('PDF downloaded');
    } catch (exportError) {
      setError(exportError.message || 'Could not download the PDF.');
    } finally {
      element.classList.remove('report-exporting');
      setBusy(null);
    }
  };

  const heroIcons = [Phone, CalendarDays, CreditCard, Workflow];
  const heroMetrics = report?.hero_metrics || [];
  const sections = report?.metrics || {};
  const availability = report?.availability || {};
  const unavailableSources = Object.entries(availability).filter(([, available]) => !available).map(([key]) => key.replace('_', ' '));
  const sectionLinks = useMemo(() => Object.entries(SECTION_META).filter(([key]) => (sections[key] || []).length), [sections]);

  if (loading) {
    return <div className="flex h-full items-center justify-center bg-[#020202]"><CubePreloader size={28} /></div>;
  }

  if (!report) {
    return <div className="flex h-full items-center justify-center bg-[#020202] p-8"><Panel className="max-w-lg p-8 text-center"><AlertTriangle className="mx-auto text-amber-300" size={24} /><h1 className="mt-4 text-xl font-semibold text-white">Business intelligence unavailable</h1><p className="mt-2 text-sm leading-6 text-zinc-500">{error || 'Not enough data.'}</p><button type="button" onClick={() => loadReport({ force: true })} className="mt-6 rounded-xl border border-white/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-300 hover:bg-white/[0.05]">Retry</button></Panel></div>;
  }

  return (
    <div id="business-report-top" className="business-intelligence-report h-full overflow-y-auto bg-[#020202] text-zinc-100 custom-scrollbar">
      <LiveRouteStyles />
      <div className="mx-auto max-w-[1500px] px-5 pb-24 pt-8 sm:px-8 lg:px-12">
        <div className="mb-5 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500"><Brain size={13} className="brand-icon" /> Nodemere intelligence</div>
            <h1 className="text-[34px] font-semibold tracking-[-0.055em] text-white sm:text-[48px]">Business Intelligence Report</h1>
            <p className="mt-3 max-w-3xl text-[13px] leading-6 text-zinc-500">{report.business?.name} · Evidence-backed operating intelligence from the records your front desk is already creating.</p>
          </div>
          <div className="report-print-hide flex flex-wrap items-center gap-2">
            <button type="button" onClick={exportPdf} disabled={busy === 'pdf'} className="brand-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"><Download size={13} className={busy === 'pdf' ? 'animate-pulse' : ''} /> {busy === 'pdf' ? 'Preparing PDF' : 'Export PDF'}</button>
            <button type="button" onClick={() => loadReport({ force: true })} disabled={busy === 'refresh'} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-60"><RefreshCw size={13} className={busy === 'refresh' ? 'animate-spin' : ''} /> Refresh report</button>
          </div>
        </div>

        {(error || status) && <div className={`mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-[11px] ${error ? 'border-amber-300/20 bg-amber-300/[0.06] text-amber-200' : 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200'}`}><Info size={14} /> {error || status}</div>}

        <Panel className="overflow-hidden p-5 sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600">Executive read</p><p className="mt-2 text-[11px] text-zinc-600">Slide {activeSlide + 1} of 2</p></div><HeroSlideControls activeSlide={activeSlide} onChange={setActiveSlide} /></div>
          {activeSlide === 0 ? (
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600">{report.business?.industry}</p>
                <h2 className="mt-3 max-w-3xl text-[28px] font-semibold leading-[1.12] tracking-[-0.045em] text-white">{report.business?.headline}</h2>
                <p className="mt-5 max-w-3xl text-[12px] leading-6 text-zinc-500">{report.business?.disclaimer}</p>
                <div className="mt-5 flex flex-wrap gap-2"><span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.11em] text-zinc-400"><Zap size={12} className="brand-icon" /> {report.core_metric_count} tracked metrics</span><span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.11em] text-zinc-400"><Activity size={12} className="text-emerald-300" /> Updated {formatDate(report.analysis_updated_at)}</span></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">{heroMetrics.map((item, index) => <HeroMetric key={item.label} item={item} icon={heroIcons[index] || Activity} />)}</div>
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)] xl:items-stretch">
              <div className="flex flex-col justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600">Live front-desk routes</p><h2 className="mt-3 text-[28px] font-semibold leading-[1.12] tracking-[-0.045em] text-white">Follow the work, not just the totals.</h2><p className="mt-4 text-[12px] leading-6 text-zinc-500">Calls can move through records, appointments, and payments. The lines update from the same real-time workflow checkpoints previously shown on Live Monitoring.</p></div><p className="mt-7 text-[10px] leading-5 text-zinc-600">Routes appear only when their tracked workflow events exist. Hover a route for its latest context.</p></div>
              <div className="h-[330px] overflow-hidden rounded-2xl border border-white/[0.06] bg-[#020202] p-3 sm:p-5"><RealtimeSankey flowState={flowState} /></div>
            </div>
          )}
        </Panel>

        {unavailableSources.length > 0 && <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-4 text-[11px] leading-5 text-amber-100/70"><Info size={15} className="mt-0.5 shrink-0 text-amber-200" /><span>Some optional sources were not available: {unavailableSources.join(', ')}. Their metrics remain marked <strong className="font-semibold text-amber-100">Not enough data</strong> instead of being estimated.</span></div>}

        <div className="report-print-hide sticky top-0 z-10 -mx-2 my-7 overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#020202]/90 p-2 backdrop-blur-xl"><div className="flex min-w-max gap-1">{sectionLinks.map(([key, meta]) => <a key={key} href={`#${key}`} className="rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-600 transition hover:bg-white/[0.05] hover:text-zinc-200">{meta.label}</a>)}</div></div>

        <div className="space-y-14">{sectionLinks.map(([key, meta]) => <section key={key} className="scroll-mt-16"><SectionHeading sectionKey={key} meta={meta} /><Panel className="p-5 sm:p-7"><MetricLedger items={sections[key]} /></Panel></section>)}</div>

        <div className="mt-14 flex flex-col gap-2 border-t border-white/[0.06] pt-5 text-[10px] leading-5 text-zinc-700 sm:flex-row sm:items-center sm:justify-between"><span>Business Intelligence Updated · {formatDate(report.analysis_updated_at)}</span><span>Measured records · Calculated summaries · No invented outcomes</span></div>
      </div>
      <style>{`
        @media print {
          @page { margin: 0.42in; }
          html, body, #root { background: #020202 !important; }
          body { overflow: visible !important; }
          .sonar-dashboard-chrome, .report-print-hide { display: none !important; }
          .sonar-dashboard-shell, .sonar-dashboard-shell > .flex, .sonar-dashboard-shell main { display: block !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
          .business-intelligence-report { height: auto !important; max-height: none !important; overflow: visible !important; background: #020202 !important; color: #f4f4f5 !important; }
          .business-intelligence-report > div { max-width: none !important; padding: 0 !important; }
          .business-intelligence-report *, .business-intelligence-report *::before, .business-intelligence-report *::after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .business-intelligence-report .business-report-panel { break-inside: avoid; box-shadow: none !important; }
          .business-intelligence-report .grid > div { break-inside: avoid; }
        }
        .business-intelligence-report.report-exporting { height: auto !important; max-height: none !important; overflow: visible !important; }
        .business-intelligence-report.report-exporting .report-print-hide { display: none !important; }
      `}</style>
    </div>
  );
}
