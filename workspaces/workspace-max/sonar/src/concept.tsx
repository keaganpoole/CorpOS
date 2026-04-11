import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal, 
  ChevronRight, 
  Zap, 
  Mail, 
  Phone, 
  Calendar, 
  ArrowUpRight, 
  TrendingUp, 
  Layers,
  MousePointer2,
  CheckCircle2,
  Clock,
  LayoutGrid,
  List,
  Activity,
  Command,
  X,
  ArrowRight,
  ShieldCheck,
  ZapOff,
  Globe,
  Bell
} from 'lucide-react';

const INITIAL_LEADS = [
  { id: 1, name: 'Sarah Chen', company: 'Nebula AI', status: 'Nurturing', score: 94, momentum: '+12%', lastContact: '2h ago', engagement: [20, 45, 30, 80, 95, 70, 94], value: '$12,400', color: '#6366f1' },
  { id: 2, name: 'Marcus Wright', company: 'FlowState', status: 'Discovery', score: 72, momentum: '-4%', lastContact: '5h ago', engagement: [10, 20, 15, 40, 35, 50, 72], value: '$8,200', color: '#8b5cf6' },
  { id: 3, name: 'Elena Rodriguez', company: 'Vertex Systems', status: 'Closing', score: 98, momentum: '+24%', lastContact: '15m ago', engagement: [40, 60, 80, 75, 90, 95, 98], value: '$45,000', color: '#ec4899' },
  { id: 4, name: 'James Wilson', company: 'Aether Lab', status: 'Qualified', score: 65, momentum: '+2%', lastContact: '1d ago', engagement: [30, 35, 40, 38, 45, 60, 65], value: '$15,000', color: '#f59e0b' },
  { id: 5, name: 'Miko Tanaka', company: 'Kuro Design', status: 'New', score: 42, momentum: '+15%', lastContact: 'Just now', engagement: [0, 5, 10, 20, 25, 35, 42], value: '$5,500', color: '#10b981' },
];

const Sparkline = ({ data, color }) => {
  const width = 120;
  const height = 40;
  const padding = 5;
  
  const points = data.map((d, i) => ({
    x: padding + (i / (data.length - 1)) * (width - padding * 2),
    y: height - padding - (d / 100) * (height - padding * 2)
  }));
  
  const pathData = points.reduce((acc, p, i) => 
    i === 0 ? `M ${p.x},${p.y}` : `${acc} L ${p.x},${p.y}`, "");

  return (
    <div className="relative group/spark">
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={`grad-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${pathData} L ${points[points.length-1].x},${height} L ${points[0].x},${height} Z`}
          fill={`url(#grad-${color})`}
        />
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-500"
        />
        <circle 
          cx={points[points.length-1].x} 
          cy={points[points.length-1].y} 
          r="3" 
          fill={color} 
          className="animate-pulse"
        />
      </svg>
    </div>
  );
};

const PulseBar = ({ score, color }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex justify-between items-end text-[10px] font-bold uppercase tracking-wider text-slate-500">
       <span style={{ color }}>{score}%</span>
    </div>
    <div className="w-28 h-1.5 bg-white/5 rounded-full overflow-hidden relative border border-white/[0.03]">
      <div 
        className="h-full rounded-full transition-all duration-1000 ease-out relative"
        style={{ 
          width: `${score}%`, 
          backgroundColor: color,
          boxShadow: `0 0 20px ${color}40`
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]" />
      </div>
    </div>
  </div>
);

const App = () => {
  const [leads] = useState(INITIAL_LEADS);
  const [isCompact, setIsCompact] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#030303] text-slate-300 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03]" 
             style={{ backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 border-b ${scrolled ? 'bg-black/60 backdrop-blur-md border-white/10 py-3' : 'bg-transparent border-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-40 group-hover:opacity-80 transition-opacity" />
                <div className="relative p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg transform group-hover:rotate-12 transition-transform">
                  <Activity className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">Quantum Ledger</h1>
                <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em]">Enterprise Engine</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-6">
              {['Pipeline', 'Analytics', 'Signals', 'Network'].map((item) => (
                <button key={item} className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Global search..." 
                className="bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-12 py-2 text-sm w-64 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:bg-white/5 transition-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-40">
                <Command className="w-3 h-3" />
                <span className="text-[10px] font-bold">K</span>
              </div>
            </div>
            <button className="p-2 text-slate-400 hover:text-white transition-colors relative">
               <Bell className="w-5 h-5" />
               <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full border-2 border-[#030303]" />
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-800 border border-white/10" />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative max-w-7xl mx-auto px-6 pt-32 pb-24">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
          <div className="space-y-2">
            <h2 className="text-4xl font-bold text-white tracking-tight">Lead Intelligence</h2>
            <p className="text-slate-500 max-w-md">Neural-processed engagement streams and real-time conversion probability analysis.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-white/[0.03] border border-white/10 rounded-xl p-1">
              <button 
                onClick={() => setIsCompact(false)}
                className={`p-2 rounded-lg transition-all ${!isCompact ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setIsCompact(true)}
                className={`p-2 rounded-lg transition-all ${isCompact ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-sm font-bold hover:bg-white/5 transition-all">
              <Filter className="w-4 h-4" />
              <span>Filter</span>
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-500 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-95">
              <Plus className="w-4 h-4" />
              <span>Create Lead</span>
            </button>
          </div>
        </div>

        {/* Table Card */}
        <div className="relative group/table">
          <div className="absolute inset-0 bg-indigo-500/5 blur-3xl opacity-0 group-hover/table:opacity-100 transition-opacity pointer-events-none" />
          <div className="relative bg-[#0a0a0c]/80 backdrop-blur-xl border border-white/[0.08] rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.05] bg-white/[0.01]">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Identity & Status</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Health Vector</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Velocity</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Net Value</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Sync</th>
                    <th className="px-8 py-5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {leads.map((lead) => (
                    <tr 
                      key={lead.id}
                      onMouseEnter={() => setHoveredRow(lead.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      onClick={() => setSelectedLead(lead)}
                      className={`group cursor-pointer transition-all duration-300 ${
                        selectedLead?.id === lead.id 
                          ? 'bg-indigo-500/[0.06]' 
                          : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className={`px-8 transition-all duration-500 ${isCompact ? 'py-4' : 'py-7'}`}>
                        <div className="flex items-center gap-5">
                          <div className="relative">
                            <div 
                              className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm border border-white/[0.05] relative z-10 transition-transform group-hover:scale-110"
                              style={{ 
                                background: `linear-gradient(135deg, ${lead.color}20, ${lead.color}05)`, 
                                color: lead.color,
                                boxShadow: `0 4px 12px ${lead.color}15`
                              }}
                            >
                              {lead.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div 
                              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#0a0a0c] z-20"
                              style={{ backgroundColor: lead.color }}
                            />
                          </div>
                          <div>
                            <div className="font-bold text-[15px] text-white leading-tight mb-1 group-hover:text-indigo-300 transition-colors">{lead.name}</div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">{lead.company}</span>
                              <span className="w-1 h-1 rounded-full bg-slate-700" />
                              <span className={`
                                px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border
                                ${lead.status === 'Closing' ? 'bg-pink-500/10 text-pink-400 border-pink-500/20' : ''}
                                ${lead.status === 'Nurturing' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : ''}
                                ${lead.status === 'Discovery' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : ''}
                                ${lead.status === 'Qualified' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : ''}
                                ${lead.status === 'New' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : ''}
                              `}>
                                {lead.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-8 py-4">
                        <PulseBar score={lead.score} color={lead.color} />
                      </td>

                      <td className="px-8 py-4">
                        <div className="flex items-center gap-4">
                          <Sparkline data={lead.engagement} color={lead.color} />
                          <div className={`text-[10px] font-black flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${lead.momentum.startsWith('+') ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10'}`}>
                            {lead.momentum.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-90" />}
                            {lead.momentum}
                          </div>
                        </div>
                      </td>

                      <td className="px-8 py-4">
                        <div className="text-[15px] font-mono font-bold tabular-nums text-white">
                          {lead.value}
                        </div>
                        <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-0.5">Potential Cap</div>
                      </td>

                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping absolute inset-0" />
                            <div className="w-2 h-2 rounded-full bg-indigo-500 relative" />
                          </div>
                          <span className="text-xs font-medium text-slate-400">{lead.lastContact}</span>
                        </div>
                      </td>

                      <td className="px-8 py-4">
                        <div className={`flex items-center justify-end gap-2 transition-all duration-300 ${hoveredRow === lead.id ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}`}>
                          {[Mail, Phone, Calendar].map((Icon, i) => (
                            <button key={i} className="p-2.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all border border-transparent hover:border-white/10">
                              <Icon className="w-4 h-4" />
                            </button>
                          ))}
                          <div className="w-[1px] h-4 bg-white/10 mx-1" />
                          <button className="p-2.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Dynamic Status Bar */}
        <footer className="mt-12 flex flex-col md:flex-row items-center justify-between gap-6 px-4">
          <div className="flex flex-wrap items-center gap-10">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-[#030303] bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-[10px] font-bold text-white">
                    {String.fromCharCode(64+i)}
                  </div>
                ))}
              </div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em]"><span className="text-white">12 Agents</span> Active in Stream</p>
            </div>
            
            <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/5 px-3 py-1.5 rounded-full border border-emerald-500/10">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest">Neural Link Secure</span>
            </div>

            <div className="flex items-center gap-2 text-slate-500">
               <Globe className="w-4 h-4" />
               <span className="text-[10px] font-black uppercase tracking-widest">Global Latency: 14ms</span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] border border-white/10 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
            <span>Powered by</span>
            <span className="text-white">Gemini 2.5 Flash</span>
          </div>
        </footer>
      </main>

      {/* Side Detail Panel */}
      {selectedLead && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[50] transition-opacity duration-700 ease-out" 
            onClick={() => setSelectedLead(null)}
          />
          <div className="fixed top-4 right-4 bottom-4 w-full max-w-[480px] bg-[#0d0d0f]/95 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-[0_0_80px_rgba(0,0,0,0.8)] z-[60] overflow-hidden flex flex-col transform transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] animate-in slide-in-from-right-full">
            
            {/* Panel Header */}
            <div className="p-8 pb-12 border-b border-white/5 relative overflow-hidden">
               {/* Background visual decoration */}
              <div 
                className="absolute top-0 right-0 w-64 h-64 blur-[100px] opacity-20 pointer-events-none"
                style={{ background: selectedLead.color }}
              />

              <div className="flex items-center justify-between mb-10 relative z-10">
                <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full flex items-center gap-2">
                  <ShieldCheck className="w-3 h-3 text-indigo-400" />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Verified Opportunity</span>
                </div>
                <button 
                  onClick={() => setSelectedLead(null)}
                  className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full transition-all text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex items-center gap-6 relative z-10">
                <div 
                  className="w-24 h-24 rounded-[2rem] flex items-center justify-center text-4xl font-black shadow-2xl transition-transform hover:scale-105 duration-500" 
                  style={{ 
                    background: `linear-gradient(135deg, ${selectedLead.color}, ${selectedLead.color}80)`,
                    color: 'white'
                  }}
                >
                  {selectedLead.name[0]}
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-white mb-1 tracking-tight">{selectedLead.name}</h3>
                  <p className="text-lg text-slate-400 font-medium">{selectedLead.company}</p>
                  <div className="mt-3 flex gap-2">
                    <span className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-indigo-400 uppercase">Series B</span>
                    <span className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-slate-400 uppercase">SaaS</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
              {/* Quick Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/[0.03] border border-white/[0.05] p-6 rounded-[2rem] group hover:bg-white/[0.05] transition-colors">
                  <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-3">Engagement Score</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-mono font-bold text-white">{selectedLead.score}</span>
                    <span className="text-emerald-400 text-xs font-bold flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" />
                      {selectedLead.momentum}
                    </span>
                  </div>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.05] p-6 rounded-[2rem] group hover:bg-white/[0.05] transition-colors">
                  <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-3">Est. Deal Value</div>
                  <div className="text-3xl font-bold text-white tracking-tight">{selectedLead.value}</div>
                  <div className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest mt-1">H2 Projections</div>
                </div>
              </div>

              {/* Signals Timeline */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Live Interaction Flow
                  </h4>
                  <span className="text-[10px] text-indigo-400 font-bold">Auto-Syncing</span>
                </div>
                <div className="space-y-3">
                  {[
                    { icon: <MousePointer2 className="w-4 h-4" />, text: "Viewed Enterprise Pricing", time: "14m ago", color: "indigo" },
                    { icon: <CheckCircle2 className="w-4 h-4" />, text: "Downloaded Technical Docs", time: "2h ago", color: "emerald" },
                    { icon: <Activity className="w-4 h-4" />, text: "Velocity spike: 4 sessions", time: "4h ago", color: "purple" },
                  ].map((signal, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl group hover:border-white/20 transition-all hover:translate-x-1">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl bg-${signal.color}-500/10 text-${signal.color}-400 border border-${signal.color}-500/20`}>
                          {signal.icon}
                        </div>
                        <span className="text-xs text-slate-200 font-bold">{signal.text}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-600 group-hover:text-slate-400 transition-colors">{signal.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Neural Insight Card */}
              <div className="p-8 bg-gradient-to-br from-indigo-600/10 to-purple-600/10 border border-indigo-500/20 rounded-[2.5rem] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                   <Zap className="w-12 h-12" />
                </div>
                <p className="text-[11px] text-indigo-400 font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Predictive Recommendation
                </p>
                <p className="text-[15px] text-slate-200 leading-relaxed font-medium italic mb-8">
                  "{selectedLead.name.split(' ')[0]}'s behavior indicates high procurement friction. Scheduling a 'Security Audit' deep-dive usually accelerates closing for similar Nebula AI profiles."
                </p>
                <button className="w-full bg-white text-black py-4 rounded-2xl font-black text-xs uppercase tracking-[0.1em] hover:bg-slate-200 transition-all shadow-[0_10px_30px_rgba(255,255,255,0.1)] flex items-center justify-center gap-3 active:scale-95 group">
                  Initiate Audit Sequence
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              <div className="pt-4 grid grid-cols-3 gap-3">
                 {[Mail, Phone, Calendar].map((Icon, i) => (
                    <button key={i} className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                      <Icon className="w-5 h-5 text-slate-400" />
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                        {i === 0 ? 'Email' : i === 1 ? 'Call' : 'Invite'}
                      </span>
                    </button>
                 ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Global Shortcut Help */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30">
        <div className="flex items-center gap-6 bg-black/40 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-2xl shadow-2xl">
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-white/10 rounded-md border border-white/10 text-[10px] font-bold text-white">⌘</kbd>
            <kbd className="px-2 py-1 bg-white/10 rounded-md border border-white/10 text-[10px] font-bold text-white">K</kbd>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Search</span>
          </div>
          <div className="w-[1px] h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-white/10 rounded-md border border-white/10 text-[10px] font-bold text-white">ESC</kbd>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Close Detail</span>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.1);
        }
      `}} />
    </div>
  );
};

export default App;