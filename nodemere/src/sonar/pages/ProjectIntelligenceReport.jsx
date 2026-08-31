import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Brain,
  CheckCircle2,
  Clock,
  Code2,
  Database,
  DollarSign,
  Download,
  ExternalLink,
  Globe2,
  Info,
  Layers,
  RefreshCw,
  Shield,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import CubePreloader from '../components/CubePreloader';
import SplashScreenAlternate from '../../components/SplashScreenAlternate';

const TYPE_STYLES = {
  Measured: 'border-sky-400/20 bg-sky-400/[0.07] text-sky-300',
  Calculated: 'border-violet-400/20 bg-violet-400/[0.07] text-violet-300',
  'AI Estimate': 'border-amber-300/20 bg-amber-300/[0.07] text-amber-200',
  'Market Estimate': 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300',
  'Fun AI Opinion': 'border-fuchsia-400/20 bg-fuchsia-400/[0.07] text-fuchsia-300',
};

const SECTION_META = {
  project: { label: 'Project', icon: Layers, description: 'Size, scope, maturity, and commercial read.' },
  architecture: { label: 'Code & Architecture', icon: Code2, description: 'Measured source inventory and engineering quality.' },
  fun: { label: 'Fun Metrics', icon: Sparkles, description: 'Subjective opinions grounded in the actual build.' },
  financial: { label: 'Financial Value', icon: DollarSign, description: 'Software value only, separate from company valuation.' },
  pricing: { label: 'Pricing', icon: BarChart3, description: 'Value-based pricing recommendations.' },
  market: { label: 'Market', icon: Globe2, description: 'Cached competitor working set and market position.' },
  rankings: { label: 'Rankings', icon: Activity, description: 'Directional percentiles, never fake worldwide precision.' },
  ai: { label: 'AI & Automation', icon: Brain, description: 'The intelligence and workflow layer behind the front desk.' },
  development: { label: 'Development Effort', icon: Clock, description: 'Replacement effort, difficulty, and time ranges.' },
  features: { label: 'Features', icon: Workflow, description: 'What is built, what is partial, and what carries the product.' },
};

const formatDate = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const getScore = (item) => {
  if (Number.isFinite(Number(item?.score))) return Number(item.score);
  const match = String(item?.value || '').match(/(\d{1,3})\s*\/\s*100/);
  return match ? Number(match[1]) : null;
};

function TypeBadge({ type }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${TYPE_STYLES[type] || 'border-white/10 bg-white/[0.04] text-zinc-400'}`}>
      {type}
    </span>
  );
}

function ScoreBar({ score }) {
  if (score === null || score === undefined) return null;
  return (
    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className="brand-gradient h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
      />
    </div>
  );
}

function MetricRow({ item, compact = false }) {
  const score = getScore(item);
  const missing = String(item?.value || '').toLowerCase() === 'not enough data';
  return (
    <div className={`group border-b border-white/[0.06] py-4 last:border-0 ${compact ? 'px-0' : 'px-1'}`}>
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12px] font-semibold tracking-[-0.01em] text-zinc-100">{item.label}</p>
            <TypeBadge type={item.type} />
          </div>
          <p className="mt-1.5 max-w-[620px] text-[11px] leading-5 text-zinc-500">{item.explanation}</p>
        </div>
        <div className={`max-w-[46%] shrink-0 text-right text-[14px] font-semibold tracking-[-0.02em] ${missing ? 'text-zinc-600' : 'text-zinc-100'}`}>
          {item.value}
          <ScoreBar score={score} />
        </div>
      </div>
    </div>
  );
}

function MetricLedger({ items = [], columns = false }) {
  return (
    <div className={columns ? 'grid gap-x-10 md:grid-cols-2' : ''}>
      {items.map((item) => <MetricRow key={item.label} item={item} />)}
    </div>
  );
}

function Panel({ children, className = '' }) {
  return <section className={`report-print-panel rounded-[26px] border border-white/[0.07] bg-[#080808]/90 shadow-[0_20px_70px_rgba(0,0,0,0.16)] ${className}`}>{children}</section>;
}

function SectionHeading({ id, icon: Icon, title, description }) {
  return (
    <div id={id} className="mb-5 flex scroll-mt-8 items-end justify-between gap-5">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
          <Icon size={13} />
          Intelligence layer
        </div>
        <h2 className="text-[23px] font-semibold tracking-[-0.035em] text-white">{title}</h2>
        <p className="mt-1 text-[12px] text-zinc-500">{description}</p>
      </div>
      <a href="#report-top" className="report-print-hide hidden text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600 transition hover:text-zinc-300 sm:block">Back to top</a>
    </div>
  );
}

function SpotlightGrid({ items = [], accent = 'cyan' }) {
  const accentClass = accent === 'amber' ? 'from-amber-300/20' : accent === 'fuchsia' ? 'from-fuchsia-300/20' : 'from-cyan-300/20';
  const accentStyle = accent === 'cyan' ? { background: 'linear-gradient(135deg, color-mix(in srgb, var(--brandGradientStart) 14%, transparent), transparent 58%, color-mix(in srgb, var(--brandGradientEnd) 12%, transparent))' } : undefined;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} style={accentStyle} className={`relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br ${accentClass} via-transparent to-transparent p-5`}>
          <div className="absolute right-4 top-4"><TypeBadge type={item.type} /></div>
          <p className="pr-28 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">{item.label}</p>
          <p className="mt-4 text-[17px] font-semibold leading-6 tracking-[-0.02em] text-white">{item.value}</p>
          <p className="mt-2 text-[11px] leading-5 text-zinc-500">{item.explanation}</p>
        </div>
      ))}
    </div>
  );
}

function HeroStat({ label, value, explanation, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="flex items-center justify-between text-zinc-600"><span className="text-[10px] font-bold uppercase tracking-[0.14em]">{label}</span><Icon size={14} /></div>
      <p className="mt-4 text-[24px] font-semibold tracking-[-0.04em] text-white">{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-zinc-600">{explanation}</p>
    </div>
  );
}

function ScoreRing({ score }) {
  return (
    <div className="relative flex h-[158px] w-[158px] shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(from 215deg, var(--brandGradientStart) 0%, var(--brandGradientEnd) ${score}%, rgba(255,255,255,0.07) ${score}% 100%)` }}>
      <div className="flex h-[132px] w-[132px] flex-col items-center justify-center rounded-full bg-[#080808]">
        <span className="text-[42px] font-semibold leading-none tracking-[-0.07em] text-white">{score}</span>
        <span className="mt-2 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-600">overall / 100</span>
      </div>
    </div>
  );
}

function ComparisonTable({ competitors = [] }) {
  const columns = [
    ['overall', 'Overall'],
    ['feature_depth', 'Feature depth'],
    ['ai', 'AI'],
    ['automation', 'Automation'],
    ['integrations', 'Integrations'],
    ['workflow', 'Workflow'],
    ['breadth', 'Breadth'],
    ['utility', 'Utility'],
  ];
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
      <table className="min-w-[900px] w-full border-collapse text-left">
        <thead className="bg-white/[0.025]">
          <tr>
            <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-600">Product</th>
            {columns.map(([, label]) => <th key={label} className="px-3 py-3 text-right text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600">{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {competitors.map((competitor) => (
            <tr key={competitor.name} style={competitor.name === 'Nodemere' ? { background: 'linear-gradient(90deg, color-mix(in srgb, var(--brandGradientStart) 9%, transparent), color-mix(in srgb, var(--brandGradientEnd) 9%, transparent))' } : undefined} className={competitor.name === 'Nodemere' ? '' : 'border-t border-white/[0.05]'}>
              <td className="px-4 py-3.5"><p className="text-[12px] font-semibold text-zinc-100">{competitor.name}</p><p className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-zinc-600">{competitor.kind}</p></td>
              {columns.map(([key]) => <td key={key} className="px-3 py-3.5 text-right text-[12px] font-semibold text-zinc-300">{competitor[key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RevenueScenarioTable({ rows = [] }) {
  const scenarios = [...new Set(rows.map((row) => row.scenario))];
  return (
    <div className="space-y-6">
      {scenarios.map((scenario) => (
        <div key={scenario}>
          <div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-300">{scenario}</p><span className="text-[10px] text-zinc-600">{rows.find((row) => row.scenario === scenario)?.arpu} blended ARPA</span></div>
          <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead className="bg-white/[0.025]"><tr>{['Customers', 'MRR', 'ARR'].map((label) => <th key={label} className="px-4 py-2.5 text-right text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600 first:text-left">{label}</th>)}</tr></thead>
              <tbody>{rows.filter((row) => row.scenario === scenario).map((row) => <tr key={`${scenario}-${row.customers}`} className="border-t border-white/[0.05]"><td className="px-4 py-3 text-[12px] font-semibold text-zinc-200">{row.customers.toLocaleString()}</td><td className="px-4 py-3 text-right text-[12px] text-zinc-300">{row.mrr}</td><td className="px-4 py-3 text-right text-[12px] font-semibold text-white">{row.arr}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResearchSources({ sources = [], checks = [] }) {
  const statusByUrl = useMemo(() => Object.fromEntries(checks.map((check) => [check.url, check.status])), [checks]);
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {sources.map((source) => (
        <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="group flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition hover:border-white/[0.14] hover:bg-white/[0.04]">
          <div className="min-w-0"><p className="truncate text-[11px] font-semibold text-zinc-200">{source.name}</p><p className="mt-1 truncate text-[10px] text-zinc-600">{source.observed}</p></div>
          <div className="flex shrink-0 items-center gap-2 text-zinc-600"><span className="text-[9px] uppercase tracking-[0.12em]">{statusByUrl[source.url] || 'cached'}</span><ExternalLink size={13} className="transition group-hover:text-zinc-300" /></div>
        </a>
      ))}
    </div>
  );
}

export default function ProjectIntelligenceReport({ publicView = false }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(publicView);
  const [busy, setBusy] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const loadReport = useCallback(async (loader, kind = 'load', successMessage = '') => {
    setBusy(kind);
    setStatus('');
    setError('');
    try {
      const next = await loader();
      if (!next) throw new Error('The analysis service did not return a report.');
      setReport(next);
      if (successMessage) setStatus(successMessage);
    } catch (requestError) {
      setError(requestError.message || 'Could not load project intelligence.');
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const next = await (publicView ? api.getPublicProjectIntelligence() : api.getProjectIntelligence());
        if (mounted) {
          if (!next) setError('The analysis service did not return a report.');
          else setReport(next);
          setLoading(false);
        }
      } catch (requestError) {
        if (mounted) { setError(requestError.message || 'Could not load project intelligence.'); setLoading(false); }
      }
    })();
    return () => { mounted = false; };
  }, [publicView]);

  const runReanalysis = () => loadReport(api.reanalyzeProjectIntelligence, 'analysis', 'Project analysis refreshed');
  const runMarketRefresh = () => loadReport(api.refreshMarketResearch, 'market', 'Market research cache refreshed');
  const exportPdf = async () => {
    const element = document.getElementById('report-top');
    if (!element) return;
    setBusy('pdf');
    setStatus('Preparing PDF download…');
    setError('');
    element.classList.add('report-exporting');
    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default || html2pdfModule;
      await html2pdf()
        .set({
          margin: 0.35,
          filename: 'project-intelligence-report.pdf',
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

  if (publicView && showSplash) {
    return <SplashScreenAlternate label="Intel" onAnimationEnd={() => setShowSplash(false)} />;
  }

  if (loading) {
    return <div className={`${publicView ? 'min-h-screen w-full' : 'h-full'} flex items-center justify-center bg-[#020202] text-zinc-500`}><div className="flex items-center justify-center"><CubePreloader size={28} /></div></div>;
  }

  if (!report) {
    return <div className="flex h-full items-center justify-center bg-[#020202] p-8"><Panel className="max-w-lg p-8 text-center"><AlertTriangle className="mx-auto text-amber-300" size={24} /><h1 className="mt-4 text-xl font-semibold text-white">Project analysis unavailable</h1><p className="mt-2 text-sm leading-6 text-zinc-500">{error || 'Not enough data.'}</p><button type="button" onClick={() => loadReport(publicView ? api.getPublicProjectIntelligence : api.getProjectIntelligence)} className="mt-6 rounded-xl border border-white/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-300 hover:bg-white/[0.05]">Retry</button></Panel></div>;
  }

  const sections = report.metrics || {};
  const spotlights = report.spotlights || {};
  const market = report.market_research || {};
  const recommendations = report.recommendations || {};
  const evidence = report.evidence || {};
  const overallScore = getScore((sections.project || []).find((item) => item.label === 'Overall Project Score')) || 72;
  const completion = (sections.project || []).find((item) => item.label === 'Completion')?.value || 'Not enough data';
  const size = (sections.project || []).find((item) => item.label === 'Project Size')?.value || 'Not enough data';
  const marketCount = (sections.market || []).find((item) => item.label === 'Estimated Meaningful Competitor Count')?.value || 'Not enough data';
  const sourceStatus = status;

  return (
    <div id="report-top" className="project-intelligence-report h-full overflow-y-auto bg-[#020202] text-zinc-100 custom-scrollbar">
      <div className="mx-auto max-w-[1500px] px-5 pb-24 pt-8 sm:px-8 lg:px-12">
        <div className="mb-5 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500"><Brain size={13} className="brand-icon" /> Nodemere intelligence lab</div><h1 className="text-[34px] font-semibold tracking-[-0.055em] text-white sm:text-[48px]">Project Intelligence Report</h1><p className="mt-3 max-w-3xl text-[13px] leading-6 text-zinc-500">A source-aware read on the software itself: what is built, how difficult it is, what it could cost to replace, and where it actually sits in the market.</p></div>
          <div className="report-print-hide flex flex-wrap items-center gap-2">
            <button type="button" onClick={exportPdf} disabled={busy === 'pdf'} className="brand-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60" title="Download this report as a PDF"><Download size={13} className={busy === 'pdf' ? 'animate-pulse' : ''} /> {busy === 'pdf' ? 'Preparing PDF' : 'Export PDF'}</button>
            {!publicView && <button type="button" onClick={runReanalysis} disabled={Boolean(busy === 'analysis')} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-60"><RefreshCw size={13} className={busy === 'analysis' ? 'animate-spin' : ''} /> Reanalyze Project</button>}
            {!publicView && <button type="button" onClick={runMarketRefresh} disabled={Boolean(busy === 'market')} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-black transition hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-60"><Globe2 size={13} className={busy === 'market' ? 'animate-pulse' : ''} /> Refresh Market Research</button>}
          </div>
        </div>

        {(error || sourceStatus) && <div className={`mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-[11px] ${error ? 'border-amber-300/20 bg-amber-300/[0.06] text-amber-200' : 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200'}`}><Info size={14} /> {error || sourceStatus}</div>}

        <Panel className="overflow-hidden p-5 sm:p-7">
          <div className="grid gap-8 xl:grid-cols-[220px_minmax(0,1fr)_360px] xl:items-center">
            <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:text-left xl:block xl:text-left"><ScoreRing score={overallScore} /><div className="xl:mt-5"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">{report.project?.classification}</p><p className="mt-1 text-[11px] leading-5 text-zinc-600">{report.project?.classification_explanation}</p></div></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600">Executive read</p><h2 className="mt-3 max-w-2xl text-[27px] font-semibold leading-[1.12] tracking-[-0.045em] text-white">{report.project?.headline}</h2><p className="mt-5 max-w-2xl text-[12px] leading-6 text-zinc-500">{report.project?.disclaimer}</p><div className="mt-5 flex flex-wrap gap-2"><span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.11em] text-zinc-400"><CheckCircle2 size={12} className="text-emerald-300" /> Source fingerprint {report.analysis_fingerprint}</span><span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.11em] text-zinc-400"><Shield size={12} className="brand-icon" /> {report.core_metric_count} core signals</span></div></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><HeroStat label="Completion" value={completion} explanation="Calculated from visible product surface and hardening signals." icon={Activity} /><HeroStat label="Project size" value={size.split(' · ')[0]} explanation={size.includes(' · ') ? size.split(' · ')[1] : size} icon={Code2} /><HeroStat label="Backend routes" value={evidence.backend_routes?.length?.toLocaleString() || 'Not enough data'} explanation="Declared FastAPI endpoints." icon={Zap} /><HeroStat label="Meaningful competitors" value={marketCount} explanation="Cached working set, not the entire market." icon={Globe2} /></div>
          </div>
        </Panel>

        <div className="report-print-hide sticky top-0 z-10 -mx-2 my-7 overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#020202]/90 p-2 backdrop-blur-xl"><div className="flex min-w-max gap-1">{Object.entries(SECTION_META).map(([key, meta]) => <a key={key} href={`#${key}`} className="rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-600 transition hover:bg-white/[0.05] hover:text-zinc-200">{meta.label}</a>)}</div></div>

        <div className="space-y-14">
          <section id="project" className="scroll-mt-16"><SectionHeading {...SECTION_META.project} /><Panel className="p-5 sm:p-7"><MetricLedger items={sections.project} columns /></Panel></section>

          <section id="architecture" className="scroll-mt-16"><SectionHeading {...SECTION_META.architecture} /><Panel className="p-5 sm:p-7"><MetricLedger items={sections.architecture} columns /></Panel><div className="mt-3 flex flex-wrap gap-2 text-[10px] text-zinc-600"><span className="rounded-full border border-white/[0.06] px-3 py-1.5">Frontend {evidence.frontend_files ?? '—'} files</span><span className="rounded-full border border-white/[0.06] px-3 py-1.5">Backend {evidence.backend_files ?? '—'} files</span><span className="rounded-full border border-white/[0.06] px-3 py-1.5">SQL {evidence.sql_files ?? '—'} files</span><span className="rounded-full border border-white/[0.06] px-3 py-1.5">{evidence.test_files?.length ?? 0} test files</span></div></section>

          <section id="fun" className="scroll-mt-16"><SectionHeading {...SECTION_META.fun} /><Panel className="p-5 sm:p-7"><div className="mb-5 flex items-start gap-3 rounded-2xl border border-fuchsia-300/15 bg-fuchsia-300/[0.05] p-4 text-[11px] leading-5 text-fuchsia-100/70"><Sparkles size={15} className="mt-0.5 shrink-0 text-fuchsia-200" /><span>Subjective AI opinions. They are grounded in the repository, but they are still opinions—not measured facts.</span></div><MetricLedger items={sections.fun} columns /><div className="mt-3"><SpotlightGrid items={spotlights.fun} accent="fuchsia" /></div></Panel></section>
          <section id="financial" className="scroll-mt-16"><SectionHeading {...SECTION_META.financial} /><Panel className="p-5 sm:p-7"><div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-4 text-[11px] leading-5 text-amber-100/70"><DollarSign size={15} className="mt-0.5 shrink-0 text-amber-200" /><span>Software value only. This is not a company valuation and does not imply revenue, customer traction, retention, or an acquisition price.</span></div><MetricLedger items={sections.financial} columns /></Panel></section>

          <section id="pricing" className="scroll-mt-16"><SectionHeading {...SECTION_META.pricing} /><Panel className="p-5 sm:p-7"><MetricLedger items={sections.pricing} columns /><div className="mt-6 grid gap-3 md:grid-cols-2"><div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">Current implementation anchor</p><p className="mt-3 text-[22px] font-semibold text-white">$100 · $400 · $900</p><p className="mt-1 text-[11px] text-zinc-500">Essentials, Pro, and Ultra are present in the current pricing surface.</p></div><div style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--brandGradientStart) 10%, transparent), color-mix(in srgb, var(--brandGradientEnd) 10%, transparent))' }} className="rounded-2xl border border-white/[0.1] p-5"><p className="brand-gradient-text text-[10px] font-bold uppercase tracking-[0.16em]">Value-based position</p><p className="mt-3 text-[22px] font-semibold text-white">{recommendations.best_market_position}</p><p className="mt-2 text-[11px] leading-5 text-zinc-500">{recommendations.best_pricing_structure}</p></div></div></Panel></section>

          <section id="market" className="scroll-mt-16"><SectionHeading {...SECTION_META.market} /><Panel className="p-5 sm:p-7"><div className="grid gap-3 md:grid-cols-2"><MetricLedger items={sections.market} /><MetricLedger items={spotlights.market} /></div><div className="mt-7 border-t border-white/[0.06] pt-6"><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">Cached research sources</p><p className="mt-1 text-[11px] text-zinc-500">Last cached: {formatDate(market.researched_at)}</p></div><span className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600"><Database size={12} /> Refresh only on request</span></div><ResearchSources sources={market.sources} checks={market.refresh_checks} /></div><div className="mt-7 border-t border-white/[0.06] pt-6"><div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">Competitive comparison</p><p className="mt-1 text-[11px] text-zinc-500">Directional scores from the cached working set. They compare public product scope, not private execution quality.</p></div><ComparisonTable competitors={market.competitors} /></div></Panel></section>

          <section id="rankings" className="scroll-mt-16"><SectionHeading {...SECTION_META.rankings} /><Panel className="p-5 sm:p-7"><div className="mb-5 flex items-start gap-3 rounded-2xl border border-violet-300/15 bg-violet-300/[0.05] p-4 text-[11px] leading-5 text-violet-100/70"><Info size={15} className="mt-0.5 shrink-0 text-violet-200" /><span>These are defensible directional estimates against comparable modern software—not exact worldwide rankings.</span></div><MetricLedger items={sections.rankings} columns /></Panel></section>

          <section className="scroll-mt-16"><SectionHeading icon={Shield} title="Quick recommendations" description="The concise operating answer." /><Panel className="grid gap-x-10 gap-y-5 p-5 sm:grid-cols-2 sm:p-7 lg:grid-cols-3">{Object.entries(recommendations).map(([key, value]) => <div key={key}><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">{key.replaceAll('_', ' ')}</p><p className="mt-2 text-[12px] leading-5 text-zinc-300">{value}</p></div>)}</Panel></section>

          <section className="scroll-mt-16"><SectionHeading icon={BarChart3} title="Value-Based Revenue Scenarios" description="Illustrative MRR and ARR ranges based on customer value, not expected earnings." /><Panel className="p-5 sm:p-7"><div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.05] p-4 text-[11px] leading-5 text-emerald-100/70"><ArrowUpRight size={15} className="mt-0.5 shrink-0 text-emerald-200" /><span>{report.revenue_scenarios?.disclaimer}</span></div><RevenueScenarioTable rows={report.revenue_scenarios?.rows} /></Panel></section>

          <section id="ai" className="scroll-mt-16"><SectionHeading {...SECTION_META.ai} /><Panel className="p-5 sm:p-7"><MetricLedger items={sections.ai} columns /></Panel><div className="mt-3"><SpotlightGrid items={spotlights.ai} accent="amber" /></div></section>

          <section id="development" className="scroll-mt-16"><SectionHeading {...SECTION_META.development} /><Panel className="p-5 sm:p-7"><MetricLedger items={sections.development} columns /></Panel></section>

          <section id="features" className="scroll-mt-16"><SectionHeading {...SECTION_META.features} /><Panel className="p-5 sm:p-7"><MetricLedger items={sections.features} columns /></Panel><div className="mt-3"><SpotlightGrid items={spotlights.features} /></div></section>
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-white/[0.06] pt-5 text-[10px] leading-5 text-zinc-700 sm:flex-row sm:items-center sm:justify-between"><span>Project Analysis Updated · {formatDate(report.analysis_updated_at)}</span><span>Market Research Updated · {formatDate(market.researched_at)}</span><span>Source-aware · Cached · Honest by design</span></div>
      </div>
      <style>{`
        @media print {
          @page { margin: 0.42in; }
          html, body, #root { background: #020202 !important; }
          body { overflow: visible !important; }
          .sonar-dashboard-chrome, .report-print-hide { display: none !important; }
          .sonar-dashboard-shell, .sonar-dashboard-shell > .flex, .sonar-dashboard-shell main { display: block !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
          .project-intelligence-report { height: auto !important; max-height: none !important; overflow: visible !important; background: #020202 !important; color: #f4f4f5 !important; }
          .project-intelligence-report > div { max-width: none !important; padding: 0 !important; }
          .project-intelligence-report *, .project-intelligence-report *::before, .project-intelligence-report *::after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .project-intelligence-report section { scroll-margin-top: 0 !important; }
          .project-intelligence-report .report-print-panel { break-inside: avoid; box-shadow: none !important; }
          .project-intelligence-report thead { display: table-header-group; }
          .project-intelligence-report tr, .project-intelligence-report .grid > div { break-inside: avoid; }
          .project-intelligence-report a { color: inherit; }
        }
        .project-intelligence-report.report-exporting { height: auto !important; max-height: none !important; overflow: visible !important; }
        .project-intelligence-report.report-exporting .report-print-hide { display: none !important; }
      `}</style>
    </div>
  );
}
