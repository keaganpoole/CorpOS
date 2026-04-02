import React, { useState, useEffect } from 'react';
import {
  Users,
  Activity,
  BarChart3,
  Database,
  Gavel,
  Settings,
  Plus,
  Zap,
  Shield,
  Cpu,
  Terminal,
  Clock,
  Pause,
  Play,
  Volume2,
  Maximize2,
  RefreshCw,
  Layers,
  Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSkyboxState } from './hooks/useSkyboxState';

const StatusDot = ({ status, pulse = false }) => {
  const colors = {
    active: 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]',
    focused: 'bg-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.6)]',
    idle: 'bg-zinc-700',
    blocked: 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]',
    urgent: 'bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.6)]',
    success: 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]',
    info: 'bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.6)]',
    recurring: 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]',
    InProgress: 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]',
    in_progress: 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]',
    completed: 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]',
    failed: 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]',
    warning: 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]',
    paused: 'bg-zinc-500',
    queued: 'bg-zinc-700',
    offline: 'bg-zinc-800',
    error: 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]',
    waiting: 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]',
    ok: 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]',
    critical: 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]',
  };

  return (
    <div className="relative flex items-center justify-center">
      <div className={`h-2 w-2 rounded-full ${colors[status] || 'bg-zinc-500'}`} />
      {pulse && (
        <div className={`absolute h-2 w-2 rounded-full ${colors[status] || 'bg-zinc-500'} animate-ping opacity-50`} />
      )}
    </div>
  );
};

const Badge = ({ children, color = 'zinc' }) => {
  const variants = {
    magenta: 'text-fuchsia-400 bg-fuchsia-500/5 border-fuchsia-500/20 shadow-[inset_0_0_10px_rgba(217,70,239,0.05)]',
    cyan: 'text-cyan-400 bg-cyan-500/5 border-cyan-500/20 shadow-[inset_0_0_10px_rgba(34,211,238,0.05)]',
    indigo: 'text-indigo-400 bg-indigo-500/5 border-indigo-500/20 shadow-[inset_0_0_10px_rgba(99,102,241,0.05)]',
    orange: 'text-amber-400 bg-amber-500/5 border-amber-500/20 shadow-[inset_0_0_10px_rgba(251,191,36,0.05)]',
    zinc: 'text-zinc-500 bg-white/5 border-white/10',
    pink: 'text-pink-400 bg-pink-500/5 border-pink-500/20 shadow-[inset_0_0_10px_rgba(236,72,153,0.05)]',
    green: 'text-emerald-400 bg-emerald-500/5 border-emerald-500/20 shadow-[inset_0_0_10px_rgba(52,211,153,0.05)]',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${variants[color] || variants.zinc}`}>
      {children}
    </span>
  );
};

// Get first letter of owner for badge display
const ownerInitial = (owner) => {
  if (!owner) return '?';
  return owner.charAt(0).toUpperCase();
};

const TaskCard = ({ task }) => {
  const priorityColor = task.priority === 'urgent' ? 'pink' : task.priority === 'high' ? 'magenta' : 'zinc';
  const statusClass = task.status === 'in_progress' || task.status === 'In Progress'
    ? 'active'
    : task.status === 'completed' ? 'success'
    : task.status === 'warning' ? 'urgent'
    : task.status === 'failed' ? 'blocked'
    : task.status === 'paused' ? 'idle'
    : 'idle';

  return (
    <motion.div
      layout
      whileHover={{ y: -3, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: '#0F0F0F' }}
      className="bg-[#0A0A0A] border border-white/5 rounded-xl p-4 mb-3 cursor-grab active:cursor-grabbing shadow-xl group transition-all"
    >
      <div className="flex items-start justify-between mb-3 text-zinc-400">
        <Badge color={priorityColor}>
          {task.department}
        </Badge>
        <div className="flex items-center gap-1.5 bg-zinc-900/50 px-1.5 py-0.5 rounded border border-white/5">
          <span className="text-[9px] font-bold text-zinc-500 tracking-tighter">{ownerInitial(task.owner)}</span>
        </div>
      </div>

      <h4 className="text-[13px] font-bold text-zinc-100 mb-1 leading-tight tracking-tight">{task.title}</h4>
      <p className="text-[11px] text-zinc-600 line-clamp-2 leading-relaxed font-medium mb-4 tracking-normal opacity-80">{task.description}</p>

      <div className="pt-3 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-zinc-400">
          <Clock size={11} className="text-zinc-700" />
          <span className="text-[9px] text-zinc-700 font-bold tracking-widest uppercase">
            {task.latest_update_at ? new Date(task.latest_update_at + 'Z').toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }) : '—'}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          {(task.status === 'in_progress' || task.status === 'In Progress') && (
            <div className="flex gap-1">
              <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
            </div>
          )}
          <StatusDot status={statusClass} />
        </div>
      </div>
    </motion.div>
  );
};

const KanbanColumn = ({ title, tasks, icon: Icon, colorClass }) => (
  <div className="flex-1 min-w-[320px] max-w-[360px] flex flex-col h-full bg-white/[0.01] rounded-xl p-1.5 border border-white/[0.03] backdrop-blur-sm transition-all hover:bg-white/[0.02]">
    <div className="flex items-center justify-between mb-2 px-4 py-3 border-b border-white/[0.05] relative group">
      <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full ${colorClass} opacity-40 group-hover:opacity-100 transition-opacity`} />

      <div className="flex items-center gap-3">
        <div className={"p-1.5 rounded-lg bg-black/40 border border-white/10 " + colorClass.replace('bg-', 'text-')}>
          <Icon size={14} strokeWidth={2.5} />
        </div>
        <div className="flex flex-col">
          <h3 className="text-[11px] font-bold text-zinc-300 tracking-[0.1em] uppercase">{title}</h3>
          <span className="text-[9px] text-zinc-600 font-bold mt-0.5 tracking-tight uppercase opacity-50">{tasks.length} Threads</span>
        </div>
      </div>
      <button className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 text-zinc-600 hover:text-white transition-all">
        <Plus size={14} />
      </button>
    </div>

    <div className="flex-1 overflow-y-auto px-1 pt-2 custom-scrollbar space-y-1">
      {tasks.length > 0 ? (
        tasks.map((task) => <TaskCard key={task.id} task={task} />)
      ) : (
        <div className="h-24 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-xl m-2 bg-black/10">
          <span className="text-[10px] text-zinc-800 font-bold uppercase tracking-widest">Idle</span>
        </div>
      )}
    </div>
  </div>
);

const AgentNode = ({ agent, isActive = false }) => {
  const borderClass = isActive ? 'border-fuchsia-500/30' : 'border-white/5';
  const iconBg = isActive ? 'bg-fuchsia-500/10 text-fuchsia-400' : 'bg-zinc-900 text-zinc-400';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={"bg-[#0A0A0A] border " + borderClass + " rounded-xl p-4 w-[260px] flex flex-col hover:border-white transition-all relative group overflow-hidden"}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3.5">
          <div className={"w-9 h-9 rounded-lg " + iconBg + " border border-white/5 flex items-center justify-center text-sm font-bold group-hover:text-white transition-all duration-300"}>
            {agent.name[0]}
          </div>
          <div className="flex flex-col">
            <h4 className="text-[13px] font-bold text-zinc-100 tracking-tight group-hover:text-white transition-colors leading-none">{agent.name}</h4>
            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1 opacity-60 leading-none">{agent.role}</p>
          </div>
        </div>
        <StatusDot status={agent.status} pulse={agent.status === 'active'} />
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <div className="flex items-center gap-2 max-w-[180px]">
          <Terminal size={10} className="text-zinc-700 shrink-0" />
          <span className="text-[10px] text-zinc-500 font-medium truncate italic opacity-80">{agent.current_activity || 'Idle'}</span>
        </div>
        <Badge color={agent.department === 'Executive' ? 'magenta' : agent.department === 'Research' ? 'cyan' : 'indigo'}>
          {agent.department ? agent.department[0] : 'O'}
        </Badge>
      </div>
    </motion.div>
  );
};

const AgentsHierarchy = ({ agents }) => {
  const architect = agents.find((a) => a.hierarchy_level === 1);
  const leads = agents.filter((a) => a.hierarchy_level === 2);
  const getReports = (leadId) => agents.filter((a) => a.reports_to === leadId);

  if (!architect) return <div className="flex items-center justify-center h-full text-zinc-600">No agent data</div>;

  return (
    <div className="min-w-fit px-12 py-10 flex flex-col items-center gap-16 select-none">
      <div className="relative">
        <AgentNode agent={architect} isActive />
        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-[1px] h-16 bg-zinc-800" />
      </div>

      <div className="flex gap-24 relative">
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[calc(100%-260px)] h-[1px] bg-zinc-800" />
        {leads.map((lead) => (
          <div key={lead.id} className="flex flex-col items-center relative">
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[1px] h-16 bg-zinc-800" />
            <AgentNode agent={lead} />

            <div className="mt-10 flex flex-col gap-4 relative w-full items-center">
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-[1px] h-10 bg-zinc-800" />
              {getReports(lead.id).map((spec, idx) => (
                <div key={spec.id} className="flex flex-col items-center gap-4 w-full">
                  <AgentNode agent={spec} />
                  {idx < getReports(lead.id).length - 1 && <div className="w-[1px] h-3 bg-zinc-900" />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SystemView = ({ summary, systemLogs }) => {
  const displayStatus = summary.status || 'Operational';
  const statusBadgeColor = displayStatus === 'Operational' ? 'cyan' : displayStatus === 'Degraded' ? 'orange' : 'pink';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'OK', val: String(summary.ok || 0), status: 'success', icon: <Cpu size={16} />, color: 'text-cyan-400' },
          { label: 'Warnings', val: String(summary.warnings || 0), status: 'success', icon: <Shield size={16} />, color: 'text-cyan-400' },
          { label: 'Errors', val: String(summary.errors || 0), status: 'info', icon: <Activity size={16} />, color: 'text-indigo-400' },
        ].map((s, i) => (
          <div key={i} className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl shadow-xl group">
            <div className="flex items-center gap-3 mb-4 text-zinc-600">
              <span className={s.color}>{s.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest">{s.label}</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold text-zinc-100 tracking-tight">{s.val}</span>
              <Badge color={statusBadgeColor}>{displayStatus}</Badge>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-black/40">
          <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Operation Log</h3>
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[10px] text-white font-bold tracking-widest uppercase">Live</span>
          </div>
        </div>
        <div className="p-5 bg-black/20 font-mono text-[11px] h-[300px] overflow-y-auto space-y-2 custom-scrollbar">
          {systemLogs.map((log, i) => (
            <p key={log.timestamp + '-' + i} className="text-zinc-600">
              <span className="opacity-30 mr-3">{log.timestamp ? new Date(log.timestamp + 'Z').toLocaleTimeString('en-US', { hour12: true, timeZone: 'America/New_York' }) : '—:—:—'}</span>
              <span className={"font-bold mr-3 " + (log.level === 'ok' ? 'text-cyan-400' : log.level === 'critical' ? 'text-rose-500' : log.level === 'cmd' ? 'text-fuchsia-500' : log.level === 'warning' ? 'text-amber-400' : 'text-indigo-400')}>
                {(log.level || 'INFO').toUpperCase()}
              </span>
              {log.message}
            </p>
          ))}
          <p className="text-cyan-400 animate-pulse font-black text-lg mt-4">_</p>
        </div>
      </div>
    </div>
  );
};

const PipelineView = ({ pipeline }) => {
  const { stages = [], totalRelics = 0, qualifiedLeads = 0, activeOutreach = 0 } = pipeline || {};

  const stageColors = {
    indigo: { bar: 'bg-indigo-500', text: 'text-indigo-400', glow: 'shadow-[0_0_15px_rgba(99,102,241,0.3)]' },
    cyan: { bar: 'bg-cyan-400', text: 'text-cyan-400', glow: 'shadow-[0_0_15px_rgba(34,211,238,0.3)]' },
    fuchsia: { bar: 'bg-fuchsia-500', text: 'text-fuchsia-400', glow: 'shadow-[0_0_15px_rgba(217,70,239,0.3)]' },
    amber: { bar: 'bg-amber-400', text: 'text-amber-400', glow: 'shadow-[0_0_15px_rgba(251,191,36,0.3)]' },
    green: { bar: 'bg-emerald-400', text: 'text-emerald-400', glow: 'shadow-[0_0_15px_rgba(52,211,153,0.3)]' },
  };

  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="h-full flex flex-col gap-8">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Relics', val: totalRelics, color: 'text-indigo-400' },
          { label: 'Qualified Leads', val: qualifiedLeads, color: 'text-cyan-400' },
          { label: 'Active Outreach', val: activeOutreach, color: 'text-fuchsia-400' },
        ].map((s, i) => (
          <div key={i} className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl shadow-xl">
            <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest mb-3">{s.label}</p>
            <p className={`text-3xl font-bold tracking-tight ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 bg-[#0A0A0A] border border-white/5 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Relic Pipeline — Signal Scoring Map</h3>
          <Badge color="cyan">Live</Badge>
        </div>

        <div className="flex items-end gap-6 h-[200px]">
          {stages.map((stage) => {
            const c = stageColors[stage.color] || stageColors.cyan;
            const heightPct = Math.round((stage.count / maxCount) * 100);
            return (
              <div key={stage.id} className="flex-1 flex flex-col items-center gap-3">
                <span className={`text-[11px] font-bold ${c.text}`}>{stage.count}</span>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${heightPct}%` }}
                  transition={{ duration: 1, delay: 0.2, type: 'spring' }}
                  className={`w-full rounded-xl ${c.bar} ${c.glow} relative overflow-hidden`}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                </motion.div>
                <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest text-center">{stage.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const PlaceholderView = ({ title, body }) => (
  <div className="flex items-center justify-center h-full text-zinc-500 flex-col gap-4">
    <div className="p-16 border border-white/5 rounded-3xl bg-[#0A0A0A] flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
      <Database size={56} className="text-cyan-400 mb-8 drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]" />
      <h3 className="text-xl font-bold text-zinc-100 tracking-tight uppercase">{title}</h3>
      <p className="text-[12px] font-bold text-zinc-600 max-w-xs mt-4 leading-relaxed uppercase tracking-widest opacity-60">{body}</p>
    </div>
  </div>
);

const App = () => {
  const [currentRoute, setCurrentRoute] = useState('tasks');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live backend state
  const {
    tasks,
    agents,
    controlState,
    session,
    livePulse,
    systemLogs,
    pipeline,
    summary,
    wsStatus,
    isPaused,
    toggleRuntime,
    pingMax,
  } = useSkyboxState();

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const navItems = [
    { id: 'tasks', icon: <Layers size={18} />, label: 'Tasks' },
    { id: 'agents', icon: <Users size={18} />, label: 'Agents' },
    { id: 'system', icon: <Activity size={18} />, label: 'System' },
    { id: 'pipeline', icon: <BarChart3 size={18} />, label: 'Leads' },
    { id: 'memory', icon: <Database size={18} />, label: 'Memory' },
    { id: 'council', icon: <Gavel size={18} />, label: 'Council' },
  ];

  // Map backend status to Kanban columns
  const kanbanColumns = [
    { title: 'Queued', statuses: ['queued'], icon: Database, colorClass: 'bg-zinc-600' },
    { title: 'In Progress', statuses: ['in_progress', 'In Progress'], icon: Activity, colorClass: 'bg-cyan-400' },
    { title: 'Warning', statuses: ['warning'], icon: Eye, colorClass: 'bg-amber-400' },
    { title: 'Completed', statuses: ['completed', 'failed', 'paused'], icon: Shield, colorClass: 'bg-emerald-400' },
  ];

  const renderView = () => {
    switch (currentRoute) {
      case 'tasks':
        return (
          <div className="flex gap-5 h-full overflow-x-auto custom-scrollbar snap-x pb-8">
            {kanbanColumns.map(col => (
              <KanbanColumn
                key={col.title}
                title={col.title}
                tasks={tasks.filter(t => col.statuses.includes(t.status))}
                icon={col.icon}
                colorClass={col.colorClass}
              />
            ))}
          </div>
        );
      case 'agents':
        return (
          <div className="h-full overflow-auto custom-scrollbar bg-[#050505] flex justify-center items-start pt-6">
            <AgentsHierarchy agents={agents} />
          </div>
        );
      case 'system':
        return <SystemView summary={summary} systemLogs={systemLogs} />;
      case 'pipeline':
        return <PipelineView pipeline={pipeline} />;
      case 'memory':
        return <PlaceholderView title="Memory Grid" body="Curated recall layer ready for OpenClaw memory wiring" />;
      case 'council':
        return <PlaceholderView title="Council Layer" body="Decision orchestration view reserved for future command routing" />;
      default:
        return <div className="flex items-center justify-center h-full text-zinc-800 uppercase font-bold text-xs tracking-[0.5em] animate-pulse">Offline</div>;
    }
  };

  // Format control state for display
  const displayStage = controlState?.stage === 'code_red' ? 'Red' : controlState?.stage === 'code_blue' ? 'Blue' : controlState?.stage || 'Blue';
  const displayZone = controlState?.zone || 1;

  return (
    <div className="flex h-screen bg-[#050505] text-zinc-100 font-sans selection:bg-cyan-500/30 overflow-hidden">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #333; }
        .snap-x { scroll-snap-type: x proximity; }
        body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; letter-spacing: -0.015em; }
        .drag-region { -webkit-app-region: drag; }
        .no-drag { -webkit-app-region: no-drag; }
      `}</style>

      <div className="drag-region fixed top-0 left-0 right-0 h-8 z-50 pointer-events-none" />

      <aside className="w-[240px] flex flex-col border-r border-white/5 bg-[#050505] transition-all">
        <div className="p-6 pt-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:scale-105 transition-transform cursor-pointer">
              <Shield size={20} className="text-black" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold tracking-tight uppercase leading-none">Skybox</h1>
              <p className="text-[9px] text-white uppercase tracking-widest font-bold mt-1.5 opacity-80">CorpOS v2.0</p>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentRoute(item.id)}
                className={`no-drag w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[13px] transition-all relative group ${currentRoute === item.id ? 'text-zinc-100 bg-white/5 border border-white/10' : 'text-zinc-500 hover:text-white'}`}
              >
                <span className={currentRoute === item.id ? 'text-cyan-400' : 'text-zinc-600 group-hover:text-white transition-colors'}>
                  {item.icon}
                </span>
                <span className="font-bold tracking-tight">{item.label}</span>
                {currentRoute === item.id && (
                  <motion.div layoutId="nav-active" className="absolute left-0 w-1 h-5 bg-cyan-400 rounded-r-full shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 space-y-6">
          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">Agents</span>
              <span className="text-[11px] text-cyan-400 font-bold tracking-tight">{summary.activeAgents || 0}/{summary.totalAgents || 0}</span>
            </div>
            <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 rounded-full" style={{ width: `${summary.totalAgents ? (summary.activeAgents / summary.totalAgents) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-3.5 px-2 group cursor-pointer text-zinc-400">
            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-[11px] font-bold text-white group-hover:border-white transition-colors">KP</div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[12px] font-bold truncate text-zinc-100 tracking-tight group-hover:text-white">Keagan Poole</p>
              <p className="text-[9px] text-zinc-600 truncate font-bold uppercase tracking-widest mt-1 opacity-60">CEO — {wsStatus === 'connected' ? 'Connected' : 'Offline'}</p>
            </div>
            <Settings size={15} className="no-drag text-zinc-700 hover:text-white transition-colors" />
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-black relative">
        <header className="h-14 border-b border-white/5 bg-black/60 backdrop-blur-2xl sticky top-0 z-20 flex items-center justify-between px-10 pt-2">
          <div className="flex items-center gap-4">
            <button className="no-drag flex items-center gap-3 px-3.5 py-1.5 bg-white/[0.03] border border-white/5 rounded-lg text-[10px] font-bold">
              <span className="text-zinc-500 uppercase tracking-widest">Zone</span>
              <span className="text-white font-mono">0{displayZone}</span>
            </button>
            <button className="no-drag flex items-center gap-3 px-3.5 py-1.5 bg-white/[0.03] border border-white/5 rounded-lg text-[10px] font-bold">
              <span className="text-zinc-500 uppercase tracking-widest">Stage</span>
              <div className={`w-2 h-2 rounded-full ${displayStage === 'Red' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' : 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]'}`} />
              <span className={displayStage === 'Red' ? 'text-rose-400 font-mono' : 'text-cyan-400 font-mono'}>{displayStage}</span>
            </button>
            <span className="text-[10px] text-zinc-700 font-mono font-bold">{currentTime.toLocaleTimeString('en-US', { hour12: true, timeZone: 'America/New_York' })}</span>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={toggleRuntime} className="no-drag flex items-center gap-3 group cursor-pointer">
              <StatusDot status={isPaused ? 'idle' : 'active'} pulse={!isPaused} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white">{isPaused ? 'Paused' : 'Live'}</span>
              {isPaused ? <Play size={11} className="text-white" fill="currentColor" /> : <Pause size={11} className="text-white" fill="currentColor" />}
            </button>

            <button onClick={pingMax} className="no-drag w-9 h-9 flex items-center justify-center bg-white text-black rounded-full hover:bg-cyan-400 transition-all active:scale-95 shadow-xl">
              <Zap size={16} fill="black" />
            </button>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div key={currentRoute} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="h-full">
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <aside className="w-[320px] border-l border-white/5 bg-[#050505] hidden xl:flex flex-col shadow-2xl">
        <div className="p-6 pt-10 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-600">LIVE Pulse</h2>
          <div className="flex items-center gap-3">
            <div className={`h-1.5 w-1.5 rounded-full ${wsStatus === 'connected' ? 'bg-cyan-400 animate-pulse' : 'bg-zinc-700'}`} />
            <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">{wsStatus}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {livePulse.map((evt) => (
            <div key={evt.id || `${evt.timestamp}-${evt.message}`} className="flex gap-4 group">
              <div className="flex flex-col items-center">
                <StatusDot status={evt.severity || 'info'} pulse={evt.severity === 'critical' && !isPaused} />
                <div className="flex-1 w-[1px] bg-zinc-900 mt-2 mb-1 group-last:bg-transparent" />
              </div>
              <div className="pb-4">
                <div className="flex items-baseline gap-3 mb-1.5">
                  <span className="text-[12px] font-bold text-zinc-200 group-hover:text-white transition-colors">{evt.actor || 'System'}</span>
                  <span className="text-[9px] text-zinc-800 font-bold">
                    {evt.timestamp ? new Date(evt.timestamp + 'Z').toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' }) : '—'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-600 font-medium leading-relaxed group-hover:text-zinc-400 transition-colors">{evt.message}</p>
              </div>
            </div>
          ))}

          <div className="pt-6">
            <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl group hover:bg-white/[0.04] transition-all">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">Global Health</span>
                <Activity size={14} className={`${isPaused ? 'text-zinc-700' : 'text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.3)]'} transition-colors`} />
              </div>

              <div className="flex items-end gap-1.5 h-12">
                {(() => {
                  const total = (summary.ok || 0) + (summary.warnings || 0) + (summary.errors || 0) || 1;
                  const bars = livePulse.slice(0, 16).map((evt) => {
                    if (evt.severity === 'critical') return 95;
                    if (evt.severity === 'warning') return 60;
                    return 35;
                  });
                  // Pad to 16 if fewer events
                  while (bars.length < 16) bars.push(10);
                  return bars.map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: isPaused ? '4px' : `${h}%` }}
                      transition={{ delay: i * 0.05, duration: 0.6 }}
                      className={`flex-1 rounded-full transition-colors duration-500 ${isPaused ? 'bg-zinc-800' : h > 80 ? 'bg-gradient-to-t from-rose-500/40 to-amber-400' : h > 50 ? 'bg-gradient-to-t from-amber-500/30 to-cyan-400' : 'bg-gradient-to-t from-fuchsia-500/30 to-cyan-400'}`}
                    />
                  ));
                })()}
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest">Uptime</span>
                  <span className="text-[13px] font-bold text-zinc-300 font-mono">{summary.uptime || '99.99%'}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest">Status</span>
                  <span className={`text-[13px] font-bold font-mono transition-colors ${isPaused ? 'text-zinc-500' : 'text-cyan-400'}`}>
                    {isPaused ? 'Standby' : (summary.status || 'Operational')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-black border-t border-white/5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={toggleRuntime} className="no-drag text-zinc-500 hover:text-white transition-colors">
                {isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
              </button>
              <div className="h-10 w-px bg-zinc-900" />
              <div className="overflow-hidden">
                <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-tighter">Current Session</p>
                <p className="text-[11px] text-zinc-300 truncate w-32">{isPaused ? 'Stream Halted' : (session?.id ? 'CorpOS — Active' : 'No Session')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-zinc-700">
              <Volume2 size={15} className="no-drag hover:text-zinc-400 cursor-pointer" />
              <Maximize2 size={15} className="no-drag hover:text-zinc-400 cursor-pointer" />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default App;
