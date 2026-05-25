import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Target, Check, Plus, Trash2, AlertCircle, Loader2,
  Pencil, Sparkles, GitBranch, Play, Pause, Zap,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const STATUS_CONFIG = {
  disabled: { color: 'text-zinc-500',   bg: 'bg-zinc-500/10',    border: 'border-zinc-500/20',    glow: '',                                        icon: <Pause size={10} /> },
  active:   { color: 'text-cyan-400',   bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20',    glow: 'shadow-[0_0_12px_rgba(34,211,238,0.08)]',  icon: <Play size={10} /> },
};

const ScenariosModal = ({ agent, onClose, onScenarioAssigned }) => {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadScenarios = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('scenarios')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      setScenarios(data || []);
    } catch (err) {
      console.error('[ScenariosModal] Failed to load scenarios:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScenarios();
  }, []);

  const handleAssignScenario = async (scenario) => {
    try {
      const { error } = await supabase
        .from('scenarios')
        .update({ assigned_to: agent.name })
        .eq('id', scenario.id);
      
      if (error) throw error;
      
      // Unassign from other scenarios
      const otherScenarios = scenarios.filter(s => s.id !== scenario.id && s.assigned_to === agent.name);
      for (const s of otherScenarios) {
        await supabase
          .from('scenarios')
          .update({ assigned_to: null })
          .eq('id', s.id);
      }
      
      loadScenarios();
      onScenarioAssigned?.();
    } catch (err) {
      console.error('[ScenariosModal] Failed to assign scenario:', err);
    }
  };

  const handleUnassignScenario = async (scenario) => {
    try {
      const { error } = await supabase
        .from('scenarios')
        .update({ assigned_to: null })
        .eq('id', scenario.id);
      
      if (error) throw error;
      
      loadScenarios();
      onScenarioAssigned?.();
    } catch (err) {
      console.error('[ScenariosModal] Failed to unassign scenario:', err);
    }
  };

  const toggleScenarioStatus = async (scenario) => {
    try {
      const newStatus = scenario.status === 'active' ? 'disabled' : 'active';
      const { error } = await supabase
        .from('scenarios')
        .update({ status: newStatus })
        .eq('id', scenario.id);
      
      if (error) throw error;
      
      loadScenarios();
    } catch (err) {
      console.error('[ScenariosModal] Failed to toggle scenario status:', err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#0A0A0A] border border-white/[0.08] rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/15">
              <Target size={16} className="text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Assign Scenario</h3>
              <p className="text-[10px] text-zinc-500 font-medium">{agent.name} • AI Receptionist Workflows</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Scenarios List */}
        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-zinc-500" />
            </div>
          ) : scenarios.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <GitBranch size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No scenarios yet</p>
              <p className="text-xs text-zinc-600">Create scenarios in the Scenarios page first</p>
            </div>
          ) : (
            scenarios.map((scenario) => {
              const isAssigned = scenario.assigned_to === agent.name;
              const isAssignedToOther = scenario.assigned_to && scenario.assigned_to !== agent.name;
              const statusConf = STATUS_CONFIG[scenario.status] || STATUS_CONFIG.disabled;
              
              return (
                <div
                  key={scenario.id}
                  className={`group p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                    isAssigned
                      ? 'bg-cyan-500/10 border-cyan-500/30'
                      : isAssignedToOther
                        ? 'bg-zinc-900/50 border-zinc-800/50 opacity-60'
                        : 'bg-[#0D0D0F] border-white/[0.04] hover:border-white/[0.08]'
                  }`}
                  onClick={() => {
                    if (isAssignedToOther) return;
                    if (isAssigned) {
                      handleUnassignScenario(scenario);
                    } else {
                      handleAssignScenario(scenario);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-bold text-white truncate">{scenario.name}</h4>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider ${statusConf.bg} ${statusConf.color} border ${statusConf.border}`}>
                          {statusConf.icon} {scenario.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 line-clamp-2">
                        {scenario.description || 'No description'}
                      </p>
                      {isAssignedToOther && (
                        <p className="text-[10px] text-indigo-400/70 mt-2">
                          Assigned to {scenario.assigned_to}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleScenarioStatus(scenario); }}
                        className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all"
                      >
                        {scenario.status === 'active' ? <Pause size={12} /> : <Play size={12} />}
                      </button>
                      {isAssigned && (
                        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                          <Check size={10} className="text-cyan-400" />
                          <span className="text-[8px] font-black text-cyan-400 uppercase tracking-wider">Assigned</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/[0.06] flex items-center justify-between bg-black/20">
          <p className="text-[10px] text-zinc-500">
            {scenarios.filter(s => s.assigned_to === agent.name).length} scenario(s) assigned
          </p>
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-white text-black text-[10px] font-bold uppercase tracking-wider hover:bg-zinc-200 transition-all">
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ScenariosModal;
