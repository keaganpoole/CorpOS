import React, { useState, useMemo, useEffect } from 'react';
import { 
  Zap, 
  Cpu, 
  Layers, 
  Maximize2, 
  Search, 
  ChevronRight, 
  Info,
  Database,
  Globe,
  Sparkles,
  Command,
  Activity,
  Box,
  Filter
} from 'lucide-react';

const ContinuumSelector = () => {
  // Master state - Now tracking a range [min, max]
  const [range, setRange] = useState({ min: 32, max: 2048 });
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredId, setHoveredId] = useState(null);
  const [isFiltering, setIsFiltering] = useState(false);

  // Generate mock data (320 models) synchronized with the new option design fields
  const allModels = useMemo(() => {
    const providers = ['OpenAI', 'Anthropic', 'Google', 'Meta', 'Mistral', 'Cohere', 'DeepSeek', 'Grok', 'Scale', 'Stability'];
    const families = ['GPT-4o', 'Claude 3.5', 'Gemini 1.5', 'Llama 3.1', 'Mistral Large', 'Command R', 'V3', 'Grok-2', 'Atlas', 'Stable'];
    const tiers = ['Mini', 'Small', 'Medium', 'Large', 'Turbo', 'Ultra', 'Flash'];
    
    return Array.from({ length: 320 }, (_, i) => {
      const provider = providers[i % providers.length];
      const family = families[i % families.length];
      const tier = tiers[i % tiers.length];
      
      // Distributed context lengths
      const contextPool = [8, 16, 32, 64, 128, 256, 512, 1024, 2048];
      const context = contextPool[i % contextPool.length];
      
      return {
        id: `model-${i}`,
        name: `${family} ${tier} v${(i % 3) + 1}.${i % 9}`,
        provider,
        context, // stored in k
        latency: Math.floor(Math.random() * 500) + 50,
        efficiency: Math.floor(Math.random() * 40) + 60,
        type: i % 10 === 0 ? 'Vision' : 'Text-Only'
      };
    }).sort((a, b) => a.context - b.context);
  }, []);

  // Filter logic - Now using both floor and ceiling
  const filteredModels = useMemo(() => {
    return allModels.filter(m => 
      m.context >= range.min && 
      m.context <= range.max &&
      (m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
       m.provider.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [range, searchQuery, allModels]);

  // Visual feedback when slider moves
  useEffect(() => {
    setIsFiltering(true);
    const timer = setTimeout(() => setIsFiltering(false), 300);
    return () => clearTimeout(timer);
  }, [range]);

  // Format context for display (input is in k)
  const formatContext = (val) => {
    if (val >= 1000) return `${(val / 1000).toFixed(1)}M`;
    return `${val}k`;
  };

  const handleMinChange = (e) => {
    const value = Math.min(parseInt(e.target.value), range.max - 8);
    setRange(prev => ({ ...prev, min: value }));
  };

  const handleMaxChange = (e) => {
    const value = Math.max(parseInt(e.target.value), range.min + 8);
    setRange(prev => ({ ...prev, max: value }));
  };

  return (
    <div className="min-h-screen bg-[#030303] text-slate-300 font-sans selection:bg-indigo-500/30 overflow-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className={`absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full transition-opacity duration-1000 ${isFiltering ? 'opacity-100' : 'opacity-40'}`} />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-rose-600/10 blur-[120px] rounded-full opacity-30" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-8 flex flex-col h-screen">
        
        {/* Header: Continental Layout */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 blur-md opacity-50 animate-pulse" />
              <div className="relative p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
                <Activity size={24} className="text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2 uppercase">
                Continuum <span className="text-xs font-medium text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">V.4</span>
              </h1>
              <p className="text-[10px] font-bold text-indigo-400/80 uppercase tracking-[0.2em]">Context Horizon Engine</p>
            </div>
          </div>
          
          <div className="w-full md:w-80 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Search model, provider or capability..."
              className="w-full bg-slate-900/40 border border-slate-800/50 rounded-2xl py-3 pl-11 pr-4 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600 text-sm backdrop-blur-md"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </header>

        {/* Master Control: Visual Range Slider */}
        <div className="mb-8 relative">
          <div className="bg-gradient-to-b from-slate-900/40 to-black/40 border border-slate-800/50 p-8 rounded-[2.5rem] backdrop-blur-2xl shadow-2xl relative overflow-hidden group">
            
            <div className="flex flex-col md:flex-row justify-between items-center md:items-end mb-10 gap-4">
              <div className="text-center md:text-left">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-2">Operational Bracket</span>
                <div className="flex items-baseline justify-center md:justify-start gap-2">
                  <span className="text-6xl font-black text-white tracking-tighter tabular-nums leading-none">
                    {formatContext(range.min)}
                  </span>
                  <span className="text-xl font-bold text-slate-600">—</span>
                  <span className="text-6xl font-black text-white tracking-tighter tabular-nums leading-none">
                    {formatContext(range.max)}
                  </span>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="bg-black/40 border border-slate-800 rounded-2xl px-6 py-4 text-center min-w-[120px]">
                  <span className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-widest">In Range</span>
                  <span className={`text-2xl font-mono font-bold transition-colors duration-300 ${isFiltering ? 'text-indigo-400' : 'text-white'}`}>
                    {filteredModels.length}
                  </span>
                </div>
                <div className="bg-black/40 border border-slate-800 rounded-2xl px-6 py-4 text-center min-w-[120px]">
                  <span className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-widest">Global</span>
                  <span className="text-2xl font-mono font-bold text-slate-400">{allModels.length}</span>
                </div>
              </div>
            </div>

            {/* Range Slider Mechanism */}
            <div className="relative h-12 px-2">
              {/* Custom Track */}
              <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-1.5 bg-slate-800/50 rounded-full overflow-hidden">
                <div 
                  className="absolute h-full bg-gradient-to-r from-emerald-500 via-indigo-500 to-rose-500 transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                  style={{ 
                    left: `${(range.min / 2048) * 100}%`,
                    width: `${((range.max - range.min) / 2048) * 100}%` 
                  }}
                />
              </div>
              
              {/* Dual Range Inputs Overlaid */}
              <input 
                type="range" 
                min="8" 
                max="2048" 
                step="8"
                value={range.min}
                onChange={handleMinChange}
                className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full bg-transparent appearance-none cursor-pointer z-30 pointer-events-none
                  [&::-webkit-slider-thumb]:pointer-events-auto
                  [&::-webkit-slider-thumb]:appearance-none 
                  [&::-webkit-slider-thumb]:w-8 
                  [&::-webkit-slider-thumb]:h-8 
                  [&::-webkit-slider-thumb]:bg-white 
                  [&::-webkit-slider-thumb]:rounded-xl
                  [&::-webkit-slider-thumb]:border-4
                  [&::-webkit-slider-thumb]:border-indigo-600
                  [&::-webkit-slider-thumb]:shadow-[0_0_20px_rgba(255,255,255,0.3)]
                  [&::-webkit-slider-thumb]:transition-transform
                  hover:[&::-webkit-slider-thumb]:scale-110"
              />
              <input 
                type="range" 
                min="8" 
                max="2048" 
                step="8"
                value={range.max}
                onChange={handleMaxChange}
                className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full bg-transparent appearance-none cursor-pointer z-20 pointer-events-none
                  [&::-webkit-slider-thumb]:pointer-events-auto
                  [&::-webkit-slider-thumb]:appearance-none 
                  [&::-webkit-slider-thumb]:w-8 
                  [&::-webkit-slider-thumb]:h-8 
                  [&::-webkit-slider-thumb]:bg-white 
                  [&::-webkit-slider-thumb]:rounded-xl
                  [&::-webkit-slider-thumb]:border-4
                  [&::-webkit-slider-thumb]:border-rose-600
                  [&::-webkit-slider-thumb]:shadow-[0_0_20px_rgba(255,255,255,0.3)]
                  [&::-webkit-slider-thumb]:transition-transform
                  hover:[&::-webkit-slider-thumb]:scale-110"
              />
              
              <div className="flex justify-between mt-10 px-1">
                {['8k', '128k', '512k', '1M', '2M'].map((label) => (
                  <span key={label} className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{label}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SLIM CATALOG LIST (Transplanted Design) */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
          <div className="grid grid-cols-1 gap-2">
            {filteredModels.length > 0 ? (
              filteredModels.map((model, idx) => (
                <div 
                  key={model.id}
                  className="group relative flex items-center gap-4 bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/20 rounded-xl px-5 py-3 transition-all duration-300 cursor-pointer overflow-hidden animate-in fade-in slide-in-from-bottom-2"
                  style={{ animationDelay: `${Math.min(idx * 20, 300)}ms` }}
                >
                  {/* Indicator Line */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${model.context >= 1000 ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-indigo-500/40'}`} />

                  {/* Provider Logo Placeholder */}
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs font-bold text-slate-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-colors">
                    {model.provider[0]}
                  </div>

                  {/* Main Info */}
                  <div className="flex-1 grid grid-cols-12 items-center gap-4">
                    <div className="col-span-4">
                      <h4 className="text-sm font-semibold truncate group-hover:text-white transition-colors">{model.name}</h4>
                      <p className="text-[10px] text-slate-500 uppercase tracking-tight">{model.provider}</p>
                    </div>

                    {/* Context Metric */}
                    <div className="col-span-2 flex flex-col items-center">
                       <span className="text-xs font-mono font-bold text-indigo-400">
                        {formatContext(model.context)}
                       </span>
                       <div className="w-full h-1 bg-white/10 rounded-full mt-1 overflow-hidden max-w-[40px]">
                         <div 
                          className="h-full bg-indigo-500/60" 
                          style={{ width: `${Math.min((model.context / 2048) * 100, 100)}%` }}
                         />
                       </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="col-span-3 flex gap-6 items-center justify-center">
                       <div className="flex flex-col items-center opacity-60 group-hover:opacity-100 transition-opacity">
                         <span className="text-[9px] text-slate-500 uppercase">Latency</span>
                         <span className="text-[11px] font-mono">{model.latency}ms</span>
                       </div>
                       <div className="flex flex-col items-center opacity-60 group-hover:opacity-100 transition-opacity">
                         <span className="text-[9px] text-slate-500 uppercase">Score</span>
                         <span className="text-[11px] font-mono">{model.efficiency}%</span>
                       </div>
                    </div>

                    {/* Tags & Action */}
                    <div className="col-span-3 flex items-center justify-end gap-3">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full border ${model.type === 'Vision' ? 'border-amber-500/30 text-amber-500 bg-amber-500/5' : 'border-slate-500/30 text-slate-500'}`}>
                        {model.type}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-600 bg-white/[0.01] border border-dashed border-white/5 rounded-3xl">
                <Box className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm italic">Horizon Exceeded</p>
                <p className="text-[10px] mt-1 text-slate-500 uppercase tracking-widest">No models match the current range ({formatContext(range.min)} – {formatContext(range.max)})</p>
                <button 
                  onClick={() => {setRange({ min: 8, max: 2048 }); setSearchQuery('');}}
                  className="mt-6 text-xs text-indigo-400 hover:text-indigo-300 transition-colors border border-indigo-500/20 px-4 py-2 rounded-xl"
                >
                  Reset Parameters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Metrics */}
        <footer className="mt-6 pt-6 border-t border-white/5 flex justify-between items-center text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">
          <div className="flex gap-8">
            <span className="flex items-center gap-1.5"><Layers size={12} /> Matrix Mode</span>
            <span className="flex items-center gap-1.5"><Globe size={12} /> Node: Primary-US</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-indigo-500 animate-pulse">System Stabilized</span>
            <div className="h-2 w-2 rounded-full bg-emerald-500/50" />
          </div>
        </footer>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in-from-bottom-2 {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-in { animation: 0.3s ease forwards; }
        .fade-in { animation-name: fade-in; }
        .slide-in-from-bottom-2 { animation-name: slide-in-from-bottom-2; }
        
        /* Range Slider Overrides */
        input[type=range]::-webkit-slider-runnable-track {
          cursor: pointer;
        }
        input[type=range] {
          pointer-events: none;
        }
        input[type=range]::-webkit-slider-thumb {
          pointer-events: auto;
        }
      `}} />
    </div>
  );
};

export default ContinuumSelector;