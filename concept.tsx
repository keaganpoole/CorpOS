import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Users, Activity, BarChart3, Database, Gavel, 
  Command, Search, Bell, Settings, Plus, Filter, MoreHorizontal, 
  ChevronRight, Zap, Shield, Cpu, Terminal, Briefcase, 
  CheckCircle2, AlertCircle, Clock, SearchCode, MessageSquare,
  Globe, Radio, HardDrive, Lock, FileText, Share2, 
  Pause, Play, Volume2, Maximize2, RefreshCw, Layers,
  GitBranch, Network, HardHat, TrendingUp, ChevronDown, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types & Mock Data ---

const AGENTS = [
  { id: 'max', name: 'Max', role: 'Lead Architect', status: 'active', dept: 'Core', level: 1, lastAction: 'Refining neural weights' },
  { id: 'lauren', name: 'Lauren', role: 'Strategy Lead', status: 'focused', dept: 'Operations', level: 2, reportsTo: 'max', lastAction: 'Analyzing competitor Q3' },
  { id: 'dan', name: 'Dan', role: 'Automation Lead', status: 'active', dept: 'DevOps', level: 2, reportsTo: 'max', lastAction: 'Optimizing Redis pipeline' },
  { id: 'allie', name: 'Allie', role: 'Content Strategist', status: 'idle', dept: 'Marketing', level: 3, reportsTo: 'lauren', lastAction: 'Scheduled authority posts' },
  { id: 'jenna', name: 'Jenna', role: 'Data Scientist', status: 'active', dept: 'Intelligence', level: 3, reportsTo: 'lauren', lastAction: 'Clustering lead signals' },
  { id: 'brian', name: 'Brian', role: 'Sales Agent', status: 'blocked', dept: 'Growth', level: 3, reportsTo: 'lauren', lastAction: 'Awaiting API response' },
  { id: 'leah', name: 'Leah', role: 'Customer Success', status: 'active', dept: 'Support', level: 3, reportsTo: 'dan', lastAction: 'Resolved ticket #902' },
  { id: 'devan', name: 'Devan', role: 'Systems Specialist', status: 'active', dept: 'Security', level: 3, reportsTo: 'dan', lastAction: 'Patching edge gateway' },
];

const TASKS = [
  { id: 101, title: 'Daily Market Sweep', desc: 'Analyzing global indices for sudden volatility shifts.', status: 'Recurring', dept: 'Intelligence', agent: 'J', priority: 'medium' },
  { id: 102, title: 'Cloud Cost Audit', desc: 'Automated pruning of unused node instances.', status: 'Recurring', dept: 'DevOps', agent: 'D', priority: 'low' },
  { id: 1, title: 'Research AI receptionist competitors', desc: 'Sweep market for low-latency voice models.', status: 'Backlog', dept: 'Research', agent: 'L', priority: 'medium' },
  { id: 7, title: 'Integrate Vector DB Sharding', desc: 'Scale Pinecone instance for multi-region support.', status: 'Backlog', dept: 'Eng', agent: 'M', priority: 'high' },
  { id: 2, title: 'Build WYSL onboarding flow', desc: 'V2 schema integration with React Flow.', status: 'In Progress', dept: 'Eng', agent: 'M', priority: 'high' },
  { id: 5, title: 'Refine lead qualification workflow', desc: 'Adjusting confidence threshold to 0.85.', status: 'In Progress', dept: 'Sales', agent: 'B', priority: 'high' },
  { id: 3, title: 'Review KeyQuarters vault UX', desc: 'Security audit on private key display logic.', status: 'Review', dept: 'Security', agent: 'D', priority: 'urgent' },
  { id: 6, title: 'Audit Telegram break command', desc: 'Fixing edge case in /pause utility.', status: 'Review', dept: 'DevOps', agent: 'S', priority: 'medium' },
];

const ACTIVITIES = [
  { id: 1, agent: 'Scout', action: 'discovered 4 new trends', type: 'info', time: '2m ago' },
  { id: 2, agent: 'Lauren', action: 'completed research sweep', type: 'success', time: '12m ago' },
  { id: 3, agent: 'Brian', action: 'updated sales pipeline', type: 'info', time: '45m ago' },
  { id: 4, agent: 'Council', action: 'requested review', type: 'urgent', time: '1h ago' },
  { id: 5, agent: 'Devan', action: 'deployed workflow fix', type: 'success', time: '2h ago' },
  { id: 6, agent: 'Leah', action: 'responded to client issue', type: 'info', time: '3h ago' },
];

// --- Subcomponents ---

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
    orange: 'text-amber-400 bg-amber-500/5 border-amber-500/20 shadow-[inset_0_0_10px_rgba(245,158,11,0.05)]',
    zinc: 'text-zinc-500 bg-white/5 border-white/10',
    pink: 'text-pink-400 bg-pink-500/5 border-pink-500/20 shadow-[inset_0_0_10px_rgba(236,72,153,0.05)]',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${variants[color]}`}>
      {children}
    </span>
  );
};

// --- View: Tasks (Kanban) ---

const TaskCard = ({ task }) => (
  <motion.div 
    layout
    whileHover={{ y: -3, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: '#0F0F0F' }}
    className="bg-[#0A0A0A] border border-white/5 rounded-xl p-4 mb-3 cursor-grab active:cursor-grabbing shadow-xl group transition-all"
  >
    <div className="flex items-start justify-between mb-3 text-zinc-400">
      <Badge color={task.priority === 'urgent' ? 'pink' : task.priority === 'high' ? 'magenta' : 'zinc'}>
        {task.dept}
      </Badge>
      <div className="flex items-center gap-1.5 bg-zinc-900/50 px-1.5 py-0.5 rounded border border-white/5">
        <span className="text-[9px] font-bold text-zinc-500 tracking-tighter">{task.agent}</span>
      </div>
    </div>
    
    <h4 className="text-[13px] font-bold text-zinc-100 mb-1 leading-tight tracking-tight">{task.title}</h4>
    <p className="text-[11px] text-zinc-600 line-clamp-2 leading-relaxed font-medium mb-4 tracking-normal opacity-80">{task.desc}</p>
    
    <div className="pt-3 border-t border-white/5 flex items-center justify-between">
      <div className="flex items-center gap-2 text-zinc-400">
        <Clock size={11} className="text-zinc-700" />
        <span className="text-[9px] text-zinc-700 font-bold tracking-widest uppercase">24h Ago</span>
      </div>
      <div className="flex items-center gap-2.5">
        {task.status === 'In Progress' && (
           <div className="flex gap-1">
             <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
           </div>
        )}
        {task.status === 'Recurring' && (
          <RefreshCw size={11} className="text-amber-400/60 animate-[spin_6s_linear_infinite]" />
        )}
        <StatusDot status={
          task.status === 'Recurring' ? 'recurring' : 
          task.status === 'In Progress' ? 'active' : 
          task.status === 'Review' ? 'urgent' : 'idle'
        } />
      </div>
    </div>
  </motion.div>
);

const KanbanColumn = ({ title, tasks, icon: Icon, colorClass }) => (
  <div className="flex-1 min-w-[320px] max-w-[360px] flex flex-col h-full bg-white/[0.01] rounded-xl p-1.5 border border-white/[0.03] backdrop-blur-sm transition-all hover:bg-white/[0.02]">
    <div className={`flex items-center justify-between mb-2 px-4 py-3 border-b border-white/[0.05] relative group`}>
      <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full ${colorClass} opacity-40 group-hover:opacity-100 transition-opacity`} />
      
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded-lg bg-black/40 border border-white/10 ${colorClass.replace('bg-', 'text-')}`}>
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
        tasks.map(task => <TaskCard key={task.id} task={task} />)
      ) : (
        <div className="h-24 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-xl m-2 bg-black/10">
           <span className="text-[10px] text-zinc-800 font-bold uppercase tracking-widest">Idle</span>
        </div>
      )}
    </div>
  </div>
);

// --- View: Agents Chain of Command ---

const AgentNode = ({ agent, isActive = false }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.98 }}
    animate={{ opacity: 1, scale: 1 }}
    className={`bg-[#0A0A0A] border ${isActive ? 'border-fuchsia-500/30' : 'border-white/5'} rounded-xl p-4 w-[260px] flex flex-col hover:border-white transition-all relative group overflow-hidden`}
  >
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3.5">
        <div className={`w-9 h-9 rounded-lg ${isActive ? 'bg-fuchsia-500/10 text-fuchsia-400' : 'bg-zinc-900 text-zinc-400'} border border-white/5 flex items-center justify-center text-sm font-bold group-hover:text-white transition-all duration-300`}>
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
          <span className="text-[10px] text-zinc-500 font-medium truncate italic opacity-80">{agent.lastAction}</span>
       </div>
       <Badge color={agent.dept === 'Core' ? 'magenta' : agent.dept === 'DevOps' ? 'indigo' : 'cyan'}>{agent.dept[0]}</Badge>
    </div>
  </motion.div>
);

const AgentsHierarchy = () => {
  const architect = AGENTS.find(a => a.level === 1);
  const leads = AGENTS.filter(a => a.level === 2);
  const getReports = (leadId) => AGENTS.filter(a => a.reportsTo === leadId);

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
                   {idx < getReports(lead.id).length - 1 && (
                     <div className="w-[1px] h-3 bg-zinc-900" />
                   )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- View: System Health ---

const SystemView = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[
        { label: 'OK', val: '498', status: 'success', icon: <Cpu size={16}/>, color: 'text-cyan-400' },
        { label: 'Warnings', val: '26', status: 'success', icon: <Shield size={16}/>, color: 'text-cyan-400' },
        { label: 'Errors', val: '4', status: 'info', icon: <Activity size={16}/>, color: 'text-indigo-400' },
      ].map((s, i) => (
        <div key={i} className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl shadow-xl group">
          <div className="flex items-center gap-3 mb-4 text-zinc-600">
            <span className={s.color}>{s.icon}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest">{s.label}</span>
          </div>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold text-zinc-100 tracking-tight">{s.val}</span>
            <Badge color={s.status === 'success' ? 'cyan' : 'indigo'}>Operational</Badge>
          </div>
        </div>
      ))}
    </div>
    
    <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-black/40">
        <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Operation Log</h3>
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[10px] text-white font-bold tracking-widest uppercase">248 Pkt/Sec</span>
        </div>
      </div>
      <div className="p-5 bg-black/20 font-mono text-[11px] h-[300px] overflow-y-auto space-y-2 custom-scrollbar">
        <p className="text-zinc-600"><span className="opacity-30 mr-3">20:05:01</span> <span className="text-indigo-400 font-bold mr-3">INFO</span> Handshake Sequence Initiated</p>
        <p className="text-zinc-600"><span className="opacity-30 mr-3">20:05:02</span> <span className="text-cyan-400 font-bold mr-3">OK</span> Secure Node Link Established</p>
        <p className="text-zinc-600"><span className="opacity-30 mr-3">20:05:04</span> <span className="text-fuchsia-500 font-bold mr-3">CMD</span> Strategy Audit Shard_01 Active</p>
        <p className="text-zinc-600"><span className="opacity-30 mr-3">20:05:11</span> <span className="text-rose-500 font-bold mr-3">ERR</span> Latency Detection Shard_07 Alert</p>
        <p className="text-zinc-600"><span className="opacity-30 mr-3">20:05:18</span> <span className="text-cyan-400 font-bold mr-3">OK</span> Dynamic Optimization Successful</p>
        <p className="text-cyan-400 animate-pulse font-black text-lg mt-4">_</p>
      </div>
    </div>
  </div>
);

// --- Main App Shell ---

const App = () => {
  const [currentRoute, setCurrentRoute] = useState('tasks');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  
  const navItems = [
    { id: 'tasks', icon: <Layers size={18} />, label: 'Tasks' },
    { id: 'agents', icon: <Users size={18} />, label: 'Agents' },
    { id: 'system', icon: <Activity size={18} />, label: 'System' },
    { id: 'pipeline', icon: <BarChart3 size={18} />, label: 'Pipeline' },
    { id: 'memory', icon: <Database size={18} />, label: 'Memory' },
    { id: 'council', icon: <Gavel size={18} />, label: 'Council' },
  ];

  const renderView = () => {
    switch (currentRoute) {
      case 'tasks':
        return (
          <div className="flex gap-5 h-full overflow-x-auto custom-scrollbar snap-x pb-8">
            <KanbanColumn title="Recurring" tasks={TASKS.filter(t => t.status === 'Recurring')} icon={RefreshCw} colorClass="bg-amber-400" />
            <KanbanColumn title="Backlog" tasks={TASKS.filter(t => t.status === 'Backlog')} icon={Database} colorClass="bg-zinc-600" />
            <KanbanColumn title="In Progress" tasks={TASKS.filter(t => t.status === 'In Progress')} icon={Activity} colorClass="bg-cyan-400" />
            <KanbanColumn title="Review" tasks={TASKS.filter(t => t.status === 'Review')} icon={Eye} colorClass="bg-fuchsia-500" />
          </div>
        );
      case 'agents':
        return (
          <div className="h-full overflow-auto custom-scrollbar bg-[#050505] flex justify-center items-start pt-6">
             <AgentsHierarchy />
          </div>
        );
      case 'system':
        return <SystemView />;
      case 'pipeline':
        return (
          <div className="flex items-center justify-center h-full text-zinc-500 flex-col gap-4">
             <div className="p-16 border border-white/5 rounded-3xl bg-[#0A0A0A] flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
                <BarChart3 size={64} className="text-cyan-400 mb-8 drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]" />
                <h3 className="text-xl font-bold text-zinc-100 tracking-tight uppercase">Protocol Engine</h3>
                <p className="text-[12px] font-bold text-zinc-600 max-w-xs mt-4 leading-relaxed uppercase tracking-widest opacity-60">Autonomous signal scoring mapping</p>
                <div className="mt-10 flex gap-4">
                   <div className="w-3 h-12 bg-zinc-900 rounded-full animate-pulse delay-75" />
                   <div className="w-3 h-20 bg-cyan-400 rounded-full animate-pulse delay-150 shadow-[0_0_15px_rgba(34,211,238,0.4)]" />
                   <div className="w-3 h-10 bg-zinc-900 rounded-full animate-pulse delay-300" />
                </div>
             </div>
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center h-full text-zinc-800 uppercase font-bold text-xs tracking-[0.5em] animate-pulse">Offline</div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-[#050505] text-zinc-100 font-sans selection:bg-cyan-500/30 overflow-hidden">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #333; }
        .snap-x { scroll-snap-type: x proximity; }
        body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; letter-spacing: -0.015em; }
      `}</style>
      
      {/* Sidebar Navigation */}
      <aside className={`w-[240px] flex flex-col border-r border-white/5 bg-[#050505] transition-all ${isSidebarOpen ? 'ml-0' : '-ml-[240px]'}`}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:scale-105 transition-transform cursor-pointer">
              <Shield size={20} className="text-black" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold tracking-tight uppercase leading-none">Command</h1>
              <p className="text-[9px] text-white uppercase tracking-widest font-bold mt-1.5 opacity-80">v4.0.2 Stable</p>
            </div>
          </div>
          
          <nav className="space-y-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setCurrentRoute(item.id)}
                className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[13px] transition-all relative group ${
                  currentRoute === item.id ? 'text-zinc-100 bg-white/5 border border-white/10' : 'text-zinc-500 hover:text-white'
                }`}
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
                <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">Memory</span>
                <span className="text-[11px] text-cyan-400 font-bold tracking-tight">72%</span>
             </div>
             <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 w-[72%] rounded-full" />
             </div>
          </div>
          <div className="flex items-center gap-3.5 px-2 group cursor-pointer text-zinc-400">
            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-[11px] font-bold text-white group-hover:border-white transition-colors">OP</div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[12px] font-bold truncate text-zinc-100 tracking-tight group-hover:text-white">Operator_01</p>
              <p className="text-[9px] text-zinc-600 truncate font-bold uppercase tracking-widest mt-1 opacity-60">Connected</p>
            </div>
            <Settings size={15} className="text-zinc-700 hover:text-white transition-colors" />
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col min-w-0 bg-black relative">
        <header className="h-14 border-b border-white/5 bg-black/60 backdrop-blur-2xl sticky top-0 z-20 flex items-center justify-between px-10">
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-3 px-3.5 py-1.5 bg-white/[0.03] border border-white/5 rounded-lg text-[10px] font-bold">
              <span className="text-zinc-500 uppercase tracking-widest">Stage</span>
              <span className="text-white font-mono">04</span>
            </button>
            <button className="flex items-center gap-3 px-3.5 py-1.5 bg-white/[0.03] border border-white/5 rounded-lg text-[10px] font-bold">
              <span className="text-zinc-500 uppercase tracking-widest">Code</span>
              <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
            </button>
          </div>
          
          <div className="flex items-center gap-6">
             <button onClick={() => setIsPaused(!isPaused)} className="flex items-center gap-3 group cursor-pointer">
                <StatusDot status={isPaused ? 'idle' : 'active'} pulse={!isPaused} />
                <span className={`text-[10px] font-bold uppercase tracking-widest text-white`}>
                  {isPaused ? 'Paused' : 'Live'}
                </span>
                {isPaused ? <Play size={11} className="text-white" fill="currentColor" /> : <Pause size={11} className="text-white" fill="currentColor" />}
             </button>
             
             <button className="w-9 h-9 flex items-center justify-center bg-white text-black rounded-full hover:bg-cyan-400 transition-all active:scale-95 shadow-xl">
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

      {/* Right Sidebar - Live Pulse Panel */}
      <aside className="w-[320px] border-l border-white/5 bg-[#050505] hidden xl:flex flex-col shadow-2xl">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-600">Operations Pulse</h2>
          <div className="flex items-center gap-4">
             <button className="text-[10px] text-zinc-700 hover:text-white uppercase font-bold tracking-widest transition-colors">Trace</button>
             <button className="text-[10px] text-zinc-700 hover:text-white uppercase font-bold tracking-widest transition-colors">Ping</button>
          </div>
        </div>
        
        {/* Activity Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {ACTIVITIES.map((act) => (
            <div key={act.id} className="flex gap-4 group">
              <div className="flex flex-col items-center">
                 <StatusDot status={act.type} pulse={act.type === 'urgent' && !isPaused} />
                 <div className="flex-1 w-[1px] bg-zinc-900 mt-2 mb-1 group-last:bg-transparent" />
              </div>
              <div className="pb-4">
                <div className="flex items-baseline gap-3 mb-1.5">
                  <span className="text-[12px] font-bold text-zinc-200 group-hover:text-white transition-colors">{act.agent}</span>
                  <span className="text-[9px] text-zinc-800 font-bold">{act.time}</span>
                </div>
                <p className="text-[11px] text-zinc-600 font-medium leading-relaxed group-hover:text-zinc-400 transition-colors">{act.action}</p>
              </div>
            </div>
          ))}
          
          {/* Health Visualizer Card */}
          <div className="pt-6">
            <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl group hover:bg-white/[0.04] transition-all">
               <div className="flex items-center justify-between mb-6">
                  <span className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">Global Health</span>
                  <Activity size={14} className={`${isPaused ? 'text-zinc-700' : 'text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.3)]'} transition-colors`} />
               </div>
               
               {/* Animated Pulse Bars */}
               <div className="flex items-end gap-1.5 h-12">
                  {[40, 70, 45, 90, 65, 85, 30, 45, 75, 60, 40, 50, 90, 80, 70, 100].map((h, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ height: 0 }}
                      animate={{ height: isPaused ? '4px' : `${h}%` }}
                      transition={{ 
                        delay: i * 0.05, 
                        repeat: isPaused ? 0 : Infinity, 
                        repeatType: 'reverse', 
                        duration: 1.5 
                      }}
                      className={`flex-1 rounded-full transition-colors duration-500 ${
                        isPaused ? 'bg-zinc-800' : 'bg-gradient-to-t from-fuchsia-500/30 to-cyan-400'
                      }`} 
                    />
                  ))}
               </div>
               
               <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest">Uptime</span>
                    <span className="text-[13px] font-bold text-zinc-300 font-mono">99.99%</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest">Status</span>
                    <span className={`text-[13px] font-bold font-mono transition-colors ${isPaused ? 'text-zinc-500' : 'text-cyan-400'}`}>
                        {isPaused ? 'Standby' : 'Optimal'}
                    </span>
                  </div>
               </div>
            </div>
          </div>
        </div>
        
        {/* Sidebar Footer Controls */}
        <div className="p-4 bg-black border-t border-white/5">
           <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                 <button 
                    onClick={() => setIsPaused(!isPaused)} 
                    className="text-zinc-500 hover:text-white transition-colors"
                  >
                   {isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
                 </button>
                 <div className="h-10 w-px bg-zinc-900" />
                 <div className="overflow-hidden">
                    <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-tighter">Current Session</p>
                    <p className="text-[11px] text-zinc-300 truncate w-32">
                        {isPaused ? 'Stream Halted' : 'Strategy Sync (Active)'}
                    </p>
                 </div>
              </div>
              <div className="flex items-center gap-3 text-zinc-700">
                <Volume2 size={15} className="hover:text-zinc-400 cursor-pointer" />
                <Maximize2 size={15} className="hover:text-zinc-400 cursor-pointer" />
              </div>
           </div>
        </div>
      </aside>
    </div>
  );
};

export default App;