import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle,
  Repeat,
  Cpu,
  Navigation,
  Activity,
  History,
  Timer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Utility: Countdown Calculator ---
const getCountdown = (targetTimeStr) => {
  const hours = Math.floor(Math.random() * 5);
  const mins = Math.floor(Math.random() * 59);
  const secs = Math.floor(Math.random() * 59);
  return `${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
};

// --- Internal Components ---

const StatusIndicator = ({ status }) => {
  const map = {
    active: 'bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]',
    queued: 'bg-zinc-800 border border-zinc-700',
    completed: 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)]',
    stopped: 'bg-rose-600 shadow-[0_0_15px_rgba(225,29,72,0.6)]',
  };

  return (
    <div className="relative">
      <div className={`h-2 w-2 rounded-full ${map[status]} transition-all duration-500`} />
      {status === 'active' && (
        <div className="absolute inset-0 rounded-full bg-cyan-400 animate-ping opacity-40" />
      )}
    </div>
  );
};

const CronCard = ({ job }) => {
  const [expanded, setExpanded] = useState(false);
  const [showIssue, setShowIssue] = useState(false);
  const [timeLeft, setTimeLeft] = useState(getCountdown(job.time));

  useEffect(() => {
    if (job.status !== 'active') {
      const timer = setInterval(() => {
        // Mock tick logic
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [job.status]);

  return (
    <motion.div 
      layout
      className="group relative bg-zinc-950/50 border border-white/[0.04] hover:border-cyan-500/20 rounded-2xl p-5 mb-4 backdrop-blur-xl transition-all duration-500 shadow-2xl"
    >
      {/* Dynamic Issue Portal */}
      {job.issue && (
        <div className="absolute top-5 right-5 z-20">
          <button 
            onMouseEnter={() => setShowIssue(true)}
            onMouseLeave={() => setShowIssue(false)}
            className="text-rose-500/30 hover:text-rose-400 transition-colors"
          >
            <AlertCircle size={15} />
          </button>
          <AnimatePresence>
            {showIssue && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95, x: 10 }}
                className="absolute right-8 top-0 w-64 p-4 bg-black/95 border border-rose-500/30 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-50 pointer-events-none backdrop-blur-2xl"
              >
                <div className="flex items-center gap-2 text-rose-500 mb-2">
                  <AlertCircle size={12} />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]">Diagnostic Alert</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed italic">{job.issue}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Identity Row */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-900 to-black border border-white/5 flex items-center justify-center group-hover:border-cyan-500/40 transition-all duration-500 shadow-inner">
          <Navigation size={16} className="text-zinc-600 group-hover:text-cyan-400 transition-colors" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-zinc-200 font-sans tracking-normal">
              {job.assignedTo}
            </span>
            <span className="w-1 h-1 rounded-full bg-zinc-800" />
            <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-black">{job.department}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
             {/* Status dot removed as requested */}
             <span className="text-[8px] font-bold text-zinc-700 uppercase tracking-tighter">Verified Protocol</span>
          </div>
        </div>
      </div>

      {/* Content Body */}
      <div className="space-y-2.5">
        <h4 className="text-[14px] font-bold text-zinc-100 tracking-tight leading-tight group-hover:text-white transition-colors">
          {job.title}
        </h4>
        <div 
          className="cursor-pointer group/desc" 
          onClick={() => setExpanded(!expanded)}
        >
          <p className={`text-[11px] text-zinc-500 font-medium leading-relaxed transition-all duration-500 ${expanded ? '' : 'line-clamp-2 opacity-60'}`}>
            {job.description}
          </p>
          <div className="flex items-center gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-all">
            <div className="h-px w-4 bg-zinc-800" />
            {expanded ? <ChevronUp size={11} className="text-zinc-500" /> : <ChevronDown size={11} className="text-zinc-500" />}
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-600">{expanded ? 'Collapse' : 'Expand Brief'}</span>
          </div>
        </div>
      </div>

      {/* Precision Action Bar */}
      <div className="mt-5 pt-4 border-t border-white/[0.03] flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Countdown Display */}
          <div className="flex items-center gap-2">
            <Timer size={12} className={job.status === 'active' ? 'text-cyan-400' : 'text-zinc-700'} />
            <span className="text-[11px] font-mono font-bold tracking-tight text-zinc-400 tabular-nums">
              {job.status === 'active' ? 'EXECUTING' : timeLeft}
            </span>
          </div>
          
          <div className="h-3 w-px bg-white/5" />

          {/* Execution Time */}
          <div className="flex items-center gap-2">
            <Clock size={12} className="text-zinc-800" />
            <span className="text-[11px] font-bold tracking-tighter text-zinc-500 lowercase">
              {job.time} <span className="text-[9px] uppercase font-black opacity-30 tracking-widest ml-1">est</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {job.recurring && <Repeat size={12} className="text-zinc-800 hover:text-zinc-600 transition-colors cursor-help" title="Daily Recurring" />}
          <StatusIndicator status={job.status} />
        </div>
      </div>

      {/* Hover Status Light - Bottom Edge */}
      <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[2px] group-hover:w-1/2 transition-all duration-700 rounded-full ${job.status === 'active' ? 'bg-cyan-500 shadow-[0_0_15px_cyan]' : 'bg-zinc-800'}`} />
    </motion.div>
  );
};

const ItineraryColumn = ({ day, isToday, jobs }) => {
  return (
    <div className={`flex-1 min-w-[340px] max-w-[380px] flex flex-col h-full rounded-3xl relative transition-all duration-1000 ${isToday ? 'bg-zinc-950/20' : ''}`}>
      <div className="px-8 py-10 relative z-10">
        <div className="flex items-baseline gap-3 mb-2">
          <h3 className={`text-3xl font-black tracking-tighter transition-colors duration-500 ${isToday ? 'text-white' : 'text-zinc-800'}`}>
            {day.date.split(' ')[1]}
          </h3>
          <span className={`text-[11px] font-black uppercase tracking-[0.4em] ${isToday ? 'text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'text-zinc-900'}`}>
            {day.weekday.slice(0, 3)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className={`h-[1px] flex-1 ${isToday ? 'bg-cyan-500/20' : 'bg-zinc-900/50'}`} />
          <span className={`text-[9px] font-black uppercase tracking-widest ${isToday ? 'text-zinc-500' : 'text-zinc-800'}`}>
            {jobs.length} Operational Nodes
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 custom-scrollbar pb-12 space-y-2">
        {jobs.length > 0 ? jobs.map(job => (
          <CronCard key={job.id} job={job} />
        )) : (
          <div className="h-40 flex flex-col items-center justify-center opacity-20 group">
             <div className="w-12 h-12 rounded-full border border-dashed border-zinc-800 flex items-center justify-center mb-4 group-hover:border-zinc-700 transition-colors">
               <History size={20} className="text-zinc-800" />
             </div>
             <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-800">No Scheduled Logic</span>
          </div>
        )}
      </div>

      {isToday && (
        <div className="absolute top-0 right-8">
           <div className="bg-cyan-500/10 text-cyan-400 text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-b-lg border-x border-b border-cyan-500/20 shadow-lg">
             Current
           </div>
        </div>
      )}
    </div>
  );
};

const App = () => {
  const [activeFilter, setActiveFilter] = useState('all');

  const timeline = Array.from({ length: 8 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      raw: d.toISOString().split('T')[0]
    };
  });

  const cronJobs = [
    {
      id: '1',
      title: 'Neural Signal Scraping',
      description: 'Automated extraction of sector-alpha financial signals. Research team to categorize high-volatility anomalies and report to Council.',
      time: '02:00 pm',
      assignedTo: 'Research-Team',
      department: 'Data Intel',
      deptColor: 'bg-cyan-400',
      status: 'active',
      recurring: true,
      dayOffset: 0
    },
    {
      id: '2',
      title: 'Archival Pruning Cycle',
      description: 'Standard cleanup of dead memory threads. Consolidating logic nodes to reduce latency across the primary execution shell.',
      time: '04:30 am',
      assignedTo: 'Logic-Agent-4',
      department: 'Maintenance',
      deptColor: 'bg-zinc-600',
      status: 'queued',
      recurring: true,
      dayOffset: 0,
      issue: 'Thread fragmentation at 14%. Optimization might take longer than scheduled 15m window.'
    },
    {
      id: '3',
      title: 'Global KPI Sync',
      description: 'Pulling real-time performance metrics from all active sub-processes for the morning executive briefing.',
      time: '08:00 am',
      assignedTo: 'Executive-Core',
      department: 'Management',
      deptColor: 'bg-fuchsia-500',
      status: 'completed',
      recurring: false,
      dayOffset: 1
    }
  ];

  return (
    <div className="h-full flex flex-col bg-[#020202] text-zinc-400 font-sans selection:bg-cyan-500/20 overflow-hidden">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; height: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #111; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #222; }
      `}</style>

      <header className="px-12 py-14 shrink-0 flex items-end justify-between border-b border-white/[0.02] bg-gradient-to-b from-zinc-950/20 to-transparent">
        <div className="flex items-center gap-16">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <div className="p-2.5 bg-cyan-500/5 rounded-xl border border-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.05)]">
                <History className="text-cyan-400" size={22} />
              </div>
              <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">Chronos</h2>
            </div>
            <p className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.5em] ml-1">Operational Matrix v2.4</p>
          </div>

          <nav className="flex items-center gap-10 border-l border-white/5 pl-16">
            {['All Nodes', 'Critical', 'Maintenance'].map((t) => (
              <button 
                key={t}
                onClick={() => setActiveFilter(t.toLowerCase())}
                className={`text-[10px] font-black uppercase tracking-[0.25em] transition-all relative ${activeFilter === t.toLowerCase() ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                {t}
                {activeFilter === t.toLowerCase() && (
                  <motion.div layoutId="header-tab" className="absolute -bottom-2 left-0 right-0 h-0.5 bg-cyan-500 shadow-[0_0_10px_cyan]" />
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-8">
          <div className="text-right flex flex-col items-end">
            <span className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.3em] mb-1">Regional Clock</span>
            <span className="text-xl font-mono font-bold text-zinc-400 leading-none tracking-tighter">EST / NYC</span>
          </div>
          <button className="h-14 w-14 rounded-2xl bg-white border border-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.15)] group">
            <Cpu size={24} className="text-black group-hover:rotate-180 transition-transform duration-1000 ease-in-out" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex gap-0 overflow-x-auto custom-scrollbar relative">
        <div className="absolute top-[108px] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-zinc-900 to-transparent z-0" />
        
        {timeline.map((day, idx) => (
          <ItineraryColumn 
            key={day.raw} 
            day={day} 
            isToday={idx === 0}
            jobs={cronJobs.filter(j => j.dayOffset === idx)}
          />
        ))}
      </div>

      <footer className="h-14 border-t border-white/[0.02] bg-black/80 backdrop-blur-md px-12 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Activity size={14} className="text-zinc-800" />
            <span className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.4em]">Temporal Sync: Locked</span>
          </div>
          <div className="w-px h-4 bg-zinc-900" />
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-zinc-800 uppercase tracking-[0.2em]">Active Threads: 04</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-6 h-6 rounded-full bg-zinc-950 border border-white/10 flex items-center justify-center text-[8px] font-bold text-zinc-500">
                A{i}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2.5 bg-cyan-500/5 px-3 py-1 rounded-full border border-cyan-500/10">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_cyan] animate-pulse" />
            <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">System Online</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;