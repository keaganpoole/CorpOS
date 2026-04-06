import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Target, MapPin, Building2, Hash, Flag, Check,
  Plus, Trash2, Play, Pause, AlertCircle, Loader2,
  ChevronDown, Globe, Sparkles, Pencil, TrendingUp,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const STATUS_CONFIG = {
  Ready:     { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', glow: 'shadow-[0_0_12px_rgba(52,211,153,0.08)]', icon: <Flag size={10} />, label: 'Ready' },
  Active:    { color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20',    glow: 'shadow-[0_0_12px_rgba(34,211,238,0.08)]', icon: <Play size={10} />, label: 'Active' },
  Paused:    { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   glow: 'shadow-[0_0_12px_rgba(251,191,36,0.08)]', icon: <Pause size={10} />, label: 'Paused' },
  Completed: { color: 'text-zinc-400',    bg: 'bg-zinc-500/10',    border: 'border-zinc-500/20',    glow: '', icon: <Check size={10} />, label: 'Done' },
};

const STATUS_OPTIONS = ['Ready', 'Active', 'Paused', 'Completed'];

const toArray = (val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    if (val.startsWith('{') && val.endsWith('}')) return val.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    if (val.includes(',')) return val.split(',').map(s => s.trim()).filter(Boolean);
    if (val.trim()) return [val.trim()];
  }
  return [];
};

// ─── Campaign Card ─────────────────────────────────────────────────────────
const CampaignCard = ({ campaign, onUpdate, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const statusConf = STATUS_CONFIG[campaign?.Status] || STATUS_CONFIG.Ready;

  const startEditing = () => {
    setForm({
      'Campaign Name': campaign?.['Campaign Name'] || '',
      'Status': campaign?.Status || 'Ready',
      'Target Industry': campaign?.['Target Industry'] || '',
      'Target State(s)': toArray(campaign?.['Target State(s)']).join(', '),
      'Target City(s)': toArray(campaign?.['Target City(s)']).join(', '),
      'Lead Count Goal': campaign?.['Lead Count Goal'] || '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(campaign.id, {
        'Campaign Name': form['Campaign Name'],
        'Status': form['Status'],
        'Target Industry': form['Target Industry'],
        'Target State(s)': form['Target State(s)'].split(',').map(s => s.trim()).filter(Boolean).join(', '),
        'Target City(s)': form['Target City(s)'].split(',').map(s => s.trim()).filter(Boolean).join(', '),
        'Lead Count Goal': parseInt(form['Lead Count Goal']) || null,
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); setEditing(false); }, 800);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        className="bg-[#0d0d0f] border border-cyan-500/15 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(34,211,238,0.03)]"
      >
        {/* Edit Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/15">
              <Pencil size={11} className="text-cyan-400" />
            </div>
            <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.15em]">Editing Campaign</span>
          </div>
          <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg text-zinc-600 hover:text-white hover:bg-white/5 transition-all">
            <X size={12} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Campaign Name</label>
            <input type="text" value={form['Campaign Name']} onChange={e => setForm({ ...form, 'Campaign Name': e.target.value })}
              className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[12px] text-white font-semibold focus:outline-none focus:border-cyan-500/30 transition-colors placeholder:text-zinc-800"
              placeholder="Florida HVAC Sweep" autoFocus />
          </div>

          {/* Status Selector */}
          <div>
            <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Status</label>
            <div className="flex gap-1.5">
              {STATUS_OPTIONS.map(s => {
                const c = STATUS_CONFIG[s];
                return (
                  <button key={s} onClick={() => setForm({ ...form, Status: s })}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all ${
                      form.Status === s ? `${c.bg} ${c.color} border ${c.border}` : 'bg-white/[0.02] text-zinc-600 border border-transparent hover:bg-white/[0.04] hover:text-zinc-400'
                    }`}>
                    {c.icon} {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Industry */}
          <div>
            <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Target Industry</label>
            <input type="text" value={form['Target Industry']} onChange={e => setForm({ ...form, 'Target Industry': e.target.value })}
              className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[12px] text-white font-semibold focus:outline-none focus:border-cyan-500/30 transition-colors placeholder:text-zinc-800"
              placeholder="HVAC, Plumbing, Roofing" />
          </div>

          {/* States + Cities + Goal */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">States</label>
              <input type="text" value={form['Target State(s)']} onChange={e => setForm({ ...form, 'Target State(s)': e.target.value })}
                className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-3 py-2.5 text-[12px] text-white font-semibold focus:outline-none focus:border-cyan-500/30 transition-colors placeholder:text-zinc-800"
                placeholder="FL, GA, TX" />
            </div>
            <div>
              <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Cities</label>
              <input type="text" value={form['Target City(s)']} onChange={e => setForm({ ...form, 'Target City(s)': e.target.value })}
                className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-3 py-2.5 text-[12px] text-white font-semibold focus:outline-none focus:border-cyan-500/30 transition-colors placeholder:text-zinc-800"
                placeholder="Miami, Orlando" />
            </div>
            <div>
              <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Lead Goal</label>
              <input type="number" value={form['Lead Count Goal']} onChange={e => setForm({ ...form, 'Lead Count Goal': e.target.value })}
                className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-3 py-2.5 text-[12px] text-white font-semibold focus:outline-none focus:border-cyan-500/30 transition-colors placeholder:text-zinc-800"
                placeholder="50" />
            </div>
          </div>
        </div>

        {/* Edit Footer */}
        <div className="px-5 py-3 border-t border-white/[0.04] flex items-center gap-2">
          <button onClick={() => onDelete(campaign.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/[0.06] border border-rose-500/15 text-rose-400 text-[9px] font-bold uppercase tracking-wider hover:bg-rose-500/10 transition-all active:scale-95">
            <Trash2 size={10} /> Delete
          </button>
          <div className="flex-1" />
          <button onClick={() => setEditing(false)}
            className="px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-wider text-zinc-500 hover:text-white transition-all">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 ${
              saved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-white text-black hover:bg-cyan-400'
            }`}>
            {saving ? <Loader2 size={10} className="inline animate-spin mr-1" /> : saved ? <><Check size={10} className="inline mr-1" /> Saved</> : 'Save'}
          </button>
        </div>
      </motion.div>
    );
  }

  // ─── View Mode ───────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="group bg-[#0A0A0A] border border-white/[0.04] rounded-2xl overflow-hidden hover:border-white/[0.08] transition-all duration-300"
    >
      <div className="p-5">
        {/* Top row: name + status + edit */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 mr-3">
            <h4 className="text-[14px] font-bold text-white tracking-tight truncate">{campaign?.['Campaign Name'] || 'Untitled'}</h4>
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${statusConf.bg} ${statusConf.color} border ${statusConf.border} ${statusConf.glow}`}>
                {statusConf.icon} {campaign?.Status || 'Ready'}
              </span>
              {campaign?.['Target Industry'] && (
                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                  <Building2 size={10} /> {campaign['Target Industry']}
                </span>
              )}
            </div>
          </div>
          <button onClick={startEditing}
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-all p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-zinc-500 hover:text-white hover:bg-white/[0.06]">
            <Pencil size={12} />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/[0.03]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/[0.06] border border-indigo-500/10">
              <Target size={10} className="text-indigo-400/70" />
            </div>
            <div>
              <p className="text-[7px] text-zinc-700 font-bold uppercase tracking-widest">Goal</p>
              <p className="text-[12px] font-bold text-zinc-300">{campaign?.['Lead Count Goal'] || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/[0.06] border border-cyan-500/10">
              <MapPin size={10} className="text-cyan-400/70" />
            </div>
            <div>
              <p className="text-[7px] text-zinc-700 font-bold uppercase tracking-widest">States</p>
              <p className="text-[12px] font-bold text-zinc-300 truncate">{toArray(campaign?.['Target State(s)']).join(', ') || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/[0.06] border border-amber-500/10">
              <Globe size={10} className="text-amber-400/70" />
            </div>
            <div>
              <p className="text-[7px] text-zinc-700 font-bold uppercase tracking-widest">Cities</p>
              <p className="text-[12px] font-bold text-zinc-300 truncate">{toArray(campaign?.['Target City(s)']).join(', ') || '—'}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ─── New Campaign Form ─────────────────────────────────────────────────────
const NewCampaignForm = ({ onCreate, onCancel }) => {
  const [form, setForm] = useState({
    'Campaign Name': '', 'Status': 'Ready', 'Target Industry': '',
    'Target State(s)': '', 'Target City(s)': '', 'Lead Count Goal': '',
  });
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!form['Campaign Name']) return;
    setCreating(true);
    try {
      await onCreate({
        'Campaign Name': form['Campaign Name'],
        'Status': form['Status'],
        'Target Industry': form['Target Industry'],
        'Target State(s)': form['Target State(s)'].split(',').map(s => s.trim()).filter(Boolean).join(', '),
        'Target City(s)': form['Target City(s)'].split(',').map(s => s.trim()).filter(Boolean).join(', '),
        'Lead Count Goal': parseInt(form['Lead Count Goal']) || null,
      });
      onCancel();
    } catch (err) {
      console.error('Create failed:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="bg-[#0d0d0f] border border-indigo-500/15 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(99,102,241,0.03)] mb-4">
        {/* New Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/15">
              <Sparkles size={11} className="text-indigo-400" />
            </div>
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.15em]">New Campaign</span>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg text-zinc-600 hover:text-white hover:bg-white/5 transition-all">
            <X size={12} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Campaign Name *</label>
            <input type="text" value={form['Campaign Name']} onChange={e => setForm({ ...form, 'Campaign Name': e.target.value })}
              className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[12px] text-white font-semibold focus:outline-none focus:border-indigo-500/30 transition-colors placeholder:text-zinc-800"
              placeholder="Florida HVAC Sweep" autoFocus />
          </div>

          <div>
            <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Target Industry</label>
            <input type="text" value={form['Target Industry']} onChange={e => setForm({ ...form, 'Target Industry': e.target.value })}
              className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[12px] text-white font-semibold focus:outline-none focus:border-indigo-500/30 transition-colors placeholder:text-zinc-800"
              placeholder="HVAC" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">States</label>
              <input type="text" value={form['Target State(s)']} onChange={e => setForm({ ...form, 'Target State(s)': e.target.value })}
                className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-3 py-2.5 text-[12px] text-white font-semibold focus:outline-none focus:border-indigo-500/30 transition-colors placeholder:text-zinc-800"
                placeholder="FL, GA" />
            </div>
            <div>
              <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Cities</label>
              <input type="text" value={form['Target City(s)']} onChange={e => setForm({ ...form, 'Target City(s)': e.target.value })}
                className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-3 py-2.5 text-[12px] text-white font-semibold focus:outline-none focus:border-indigo-500/30 transition-colors placeholder:text-zinc-800"
                placeholder="Miami" />
            </div>
            <div>
              <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Lead Goal</label>
              <input type="number" value={form['Lead Count Goal']} onChange={e => setForm({ ...form, 'Lead Count Goal': e.target.value })}
                className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-3 py-2.5 text-[12px] text-white font-semibold focus:outline-none focus:border-indigo-500/30 transition-colors placeholder:text-zinc-800"
                placeholder="50" />
            </div>
          </div>

          <button onClick={handleCreate} disabled={creating || !form['Campaign Name']}
            className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${
              !form['Campaign Name'] ? 'bg-white/[0.03] text-zinc-700 cursor-not-allowed border border-white/[0.04]'
                : 'bg-white text-black hover:bg-indigo-400'
            }`}>
            {creating ? <Loader2 size={11} className="inline animate-spin mr-1.5" /> : <Plus size={11} className="inline mr-1.5" />}
            Create Campaign
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main Modal ────────────────────────────────────────────────────────────
const CampaignsModal = ({ onClose }) => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('research_campaigns')
          .select('*')
          .order('created_at', { ascending: false });
        if (err) throw err;
        if (!cancelled) { setCampaigns(Array.isArray(data) ? data : []); setLoading(false); }
      } catch (err) {
        console.error('[CampaignsModal] Fetch error:', err);
        if (!cancelled) { setError(err?.message || 'Failed to load'); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleCreate = async (campaignData) => {
    const { data, error: err } = await supabase.from('research_campaigns').insert(campaignData).select().single();
    if (err) throw err;
    setCampaigns(prev => [data, ...prev]);
  };

  const handleUpdate = async (id, updates) => {
    const { data, error: err } = await supabase.from('research_campaigns').update(updates).eq('id', id).select().single();
    if (err) throw err;
    setCampaigns(prev => prev.map(c => c.id === id ? data : c));
  };

  const handleDelete = async (id) => {
    const { error: err } = await supabase.from('research_campaigns').delete().eq('id', id);
    if (err) throw err;
    setCampaigns(prev => prev.filter(c => c.id !== id));
  };

  const filtered = statusFilter === 'All' ? campaigns : campaigns.filter(c => c?.Status === statusFilter);
  const statusCounts = STATUS_OPTIONS.reduce((acc, s) => { acc[s] = campaigns.filter(c => c?.Status === s).length; return acc; }, {});

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="relative w-[720px] max-h-[760px] bg-[#08080a] border border-white/[0.06] rounded-3xl flex flex-col overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.95)]"
      >
        {/* Header */}
        <div className="shrink-0 px-7 py-5 border-b border-white/[0.04]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/[0.08] border border-indigo-500/12">
                <Target size={15} className="text-indigo-400" />
              </div>
              <div>
                <h2 className="text-[14px] font-black text-white tracking-tight uppercase">Research Campaigns</h2>
                <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest mt-0.5">
                  {campaigns.length} total · {statusCounts.Active || 0} active
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowNew(!showNew)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                  showNew
                    ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/15'
                    : 'bg-white text-black hover:bg-indigo-400 hover:text-white'
                }`}>
                {showNew ? <X size={10} /> : <Plus size={10} />}
                {showNew ? 'Cancel' : 'New Campaign'}
              </button>
              <button onClick={onClose} className="p-2 rounded-xl text-zinc-600 hover:text-white hover:bg-white/[0.04] transition-all">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 mt-4">
            {['All', ...STATUS_OPTIONS].map(s => {
              const count = s === 'All' ? campaigns.length : (statusCounts[s] || 0);
              const isActive = statusFilter === s;
              const conf = s !== 'All' ? STATUS_CONFIG[s] : null;
              return (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all ${
                    isActive
                      ? `${conf ? `${conf.bg} ${conf.color} border ${conf.border}` : 'bg-white/[0.06] text-white border border-white/[0.08]'}`
                      : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.02]'
                  }`}>
                  {conf && conf.icon} {s}
                  <span className={`text-[8px] font-mono ${isActive ? 'opacity-70' : 'text-zinc-700'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3">
          <AnimatePresence>
            {showNew && <NewCampaignForm key="new-form" onCreate={handleCreate} onCancel={() => setShowNew(false)} />}
          </AnimatePresence>

          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 size={22} className="text-zinc-700 animate-spin mb-3" />
              <span className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">Loading campaigns</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 bg-rose-500/[0.04] border border-rose-500/10 rounded-2xl px-5 py-4">
              <AlertCircle size={16} className="text-rose-400 shrink-0" />
              <div>
                <p className="text-[11px] text-rose-300 font-semibold">{error}</p>
                <p className="text-[9px] text-rose-500/60 mt-0.5">Check Supabase connection and table permissions</p>
              </div>
            </div>
          )}

          {!loading && !error && filtered.map(c => (
            <CampaignCard key={c.id} campaign={c} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}

          {!loading && !error && filtered.length === 0 && !showNew && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] mb-4">
                <Target size={28} className="text-zinc-700" />
              </div>
              <p className="text-[12px] text-zinc-500 font-bold mb-1">
                {statusFilter === 'All' ? 'No campaigns yet' : `No ${statusFilter.toLowerCase()} campaigns`}
              </p>
              <p className="text-[9px] text-zinc-700">
                {statusFilter === 'All' ? 'Create one to start targeting Relics' : 'Change the filter to see other campaigns'}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CampaignsModal;
