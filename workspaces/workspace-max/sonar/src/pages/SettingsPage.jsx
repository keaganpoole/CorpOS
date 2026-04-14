import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Clock, Building2, Phone, Bell, Calendar,
  Save, Check, ChevronDown, ChevronUp, Sun, Moon,
  BookOpen, FileText, Shield, HelpCircle, Sparkles,
  Eye, EyeOff, Lightbulb, Zap, Star, Info,
  Plus, Trash2, GripVertical, Tag, DollarSign,
  ChevronRight, ArrowRight, X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
  'America/Toronto', 'America/Vancouver', 'Europe/London',
];

// ─── Knowledge Base Templates ───────────────────────────────────────────────
const KNOWLEDGE_TEMPLATES = {
  about: {
    icon: Sparkles,
    label: 'About Us',
    placeholder: `Who are you? Tell your story. Your AI receptionist uses this to answer questions about your business.

EXAMPLE — paste this and customize:

We're Hartley Roofing, a family-owned roofing company based right here in Worcester, Massachusetts. My dad started this business back in 2006 with nothing but a truck and a ladder, and we've been keeping roofs tight ever since.

We specialize in residential roofing — asphalt shingles, metal roofing, flat roofs, and repairs. If it's got a roof, we can fix it or replace it. We also do gutter installation and siding because, honestly, if we're already up there, we might as well.

We're licensed and insured (Massachusetts License #RA-12345), and every job comes with a 10-year workmanship warranty on top of whatever the manufacturer gives you. We're not happy until you are — that's not a slogan, that's how we actually operate.

We serve Worcester County and most of central Mass — Worcester, Shrewsbury, Framingham, and everywhere in between. We don't do a lot of marketing because most of our work comes from referrals. Neighbors telling neighbors. That's the best kind of advertising.`,
  },
  services: {
    icon: Zap,
    label: 'Services & Pricing',
    placeholder: `List your services and what they cost. Keep it clear and specific so the receptionist can answer pricing questions accurately.

EXAMPLE — paste this and customize:

SERVICES WE OFFER:

• Roof Replacement
  Full tear-off and installation. Includes all new underlayment, flashing, and ridge vents.
  Starting at $8,500 for a standard single-family home (1,500-2,000 sq ft). Price depends on roof size, pitch, and material.

• Roof Repair
  Leaks, missing shingles, storm damage, flashing issues. Most repairs done same-day.
  $250 - $1,500 depending on severity. Free estimates for repair work over $500.

• New Construction Roofing
  Working with builders and contractors on new homes.
  Custom quotes — we need the blueprints to price this properly.

• Gutter Installation
  Seamless aluminum gutters, 5" and 6" sizes, multiple colors.
  $7 - $12 per linear foot installed. Includes downspouts and hangers.

• Siding Installation
  Vinyl siding, fiber cement (James Hardie), and wood.
  $8 - $15 per square foot installed depending on material.

• Emergency Tarp Service
  Storm damage? We come out same day and tarp it to prevent further damage.
  $250 - $500. We come back later for the full repair.

WHAT'S INCLUDED IN EVERY JOB:
- Free estimate and inspection
- Full cleanup and haul-away of old materials
- Written warranty
- Photo documentation before, during, and after`,
  },
  policies: {
    icon: Shield,
    label: 'Policies',
    placeholder: `Your rules and how you do business. This helps the receptionist set expectations with callers.

EXAMPLE — paste this and customize:

CANCELLATION POLICY:
We understand things come up. You can cancel or reschedule any appointment up to 24 hours before with no charge. Same-day cancellations for estimate appointments are fine — no fee. But if we've already started a job, we'll charge for materials and labor completed so far.

PAYMENT TERMS:
For estimates and consultations, there's no charge — those are free.
For repair jobs under $1,000: payment due on completion.
For larger jobs: 30% deposit to schedule, 40% at materials delivery, 30% on completion.
We accept cash, check, and all major credit cards. No financing currently.

WARRANTY:
All roof replacements come with a 10-year workmanship warranty. If something goes wrong within those 10 years related to our installation, we come fix it for free — no questions asked. Manufacturer warranties vary by material (most shingle manufacturers offer 25-50 years).

WHAT TO EXPECT:
For estimate appointments: We'll be there within a 2-hour window. We'll inspect the roof, take measurements and photos, and usually have the estimate ready within 48 hours.
For repair jobs: We try same-day or next-day for most repairs.
For replacements: Typically 2-5 days depending on roof size and weather.

INSURANCE CLAIMS:
We work with insurance companies regularly. If you have storm damage, we can do the inspection, provide the documentation your adjuster needs, and handle the paperwork. We won't inflate numbers — we charge fair, honest prices.`,
  },
  faq: {
    icon: HelpCircle,
    label: 'FAQ',
    placeholder: `Common questions your callers ask. Write them as they'd be asked, with clear answers.

EXAMPLE — paste this and customize:

Q: Do you give free estimates?
A: Yes, absolutely. Roof repairs and full replacements both come with free inspections and estimates. Just call and we'll schedule a time.

Q: How long does a roof replacement take?
A: Most residential jobs take 2-5 days depending on the size of your roof and the weather. We don't rush — we'd rather do it right than do it fast.

Q: What happens if it rains during the job?
A: We monitor the weather closely. If rain is coming, we'll make sure everything is tarped and sealed at the end of each work day so your home is never exposed. We don't start tearing off a roof unless we're confident we can get it dried in that same day.

Q: Do you work with insurance?
A: Yes. We're experienced with insurance claims for storm and hail damage. We'll document everything, provide the reports your adjuster needs, and work with them directly.

Q: What areas do you serve?
A: We serve all of Worcester County and most of central Massachusetts — Worcester, Shrewsbury, Grafton, Westborough, Framingham, Marlborough, and surrounding towns. If you're not sure, just call — we probably cover your area.

Q: Are you licensed and insured?
A: Yes. We're fully licensed in Massachusetts (License #RA-12345) and carry both general liability and workers' compensation insurance. We're happy to provide proof of insurance.

Q: Do you offer financing?
A: Not currently, but we offer flexible payment plans on larger jobs. We can split payments into 3 installments across the project timeline.

Q: How do I know if I need a repair or a full replacement?
A: If your roof is under 15 years old and the damage is localized (a few missing shingles, a small leak), a repair is usually enough. If the roof is older, has widespread damage, or the shingles are curling and cracking everywhere, a replacement is probably more cost-effective long-term. We'll give you an honest assessment during the inspection.`,
  },
};

const PRICE_TYPES = [
  { value: 'fixed', label: 'Fixed Price' },
  { value: 'starting_at', label: 'Starting At' },
  { value: 'range', label: 'Price Range' },
  { value: 'quote', label: 'Free Quote' },
  { value: 'free', label: 'Free' },
];

const PRICE_UNITS = [
  { value: '', label: 'Flat rate' },
  { value: 'per hour', label: 'Per hour' },
  { value: 'per day', label: 'Per day' },
  { value: 'per sq ft', label: 'Per sq ft' },
  { value: 'per linear ft', label: 'Per linear ft' },
  { value: 'per item', label: 'Per item' },
  { value: 'per visit', label: 'Per visit' },
];

const KNOWLEDGE_TABS = [
  { key: 'about', icon: Sparkles, label: 'About Us', hint: 'Your story, mission, and what makes you different' },
  { key: 'services', icon: Zap, label: 'Services', hint: 'What you offer and what it costs' },
  { key: 'policies', icon: Shield, label: 'Policies', hint: 'Cancellation, payment, warranties, and expectations' },
  { key: 'faq', icon: HelpCircle, label: 'FAQ', hint: 'Common questions your callers ask — with answers' },
];

const defaultSettings = {
  business_name: '',
  business_phone: '',
  business_email: '',
  business_timezone: 'America/New_York',
  business_address: '',
  default_appointment_duration: 30,
  appointment_buffer_minutes: 0,
  business_hours: {
    Monday:    { enabled: true,  open: '09:00', close: '17:00' },
    Tuesday:   { enabled: true,  open: '09:00', close: '17:00' },
    Wednesday: { enabled: true,  open: '09:00', close: '17:00' },
    Thursday:  { enabled: true,  open: '09:00', close: '17:00' },
    Friday:    { enabled: true,  open: '09:00', close: '17:00' },
    Saturday:  { enabled: false, open: '09:00', close: '17:00' },
    Sunday:    { enabled: false, open: '09:00', close: '17:00' },
  },
  auto_confirm_appointments: false,
  send_confirmation_sms: false,
  send_confirmation_email: false,
  reminder_before_minutes: 60,
  allow_cancellations: true,
  cancellation_window_hours: 24,
  knowledge_base: {
    about: '',
    services: '',
    policies: '',
    faq: '',
  },
  services: [],
};

// ─── Section Card ───────────────────────────────────────────────────────────
const Section = ({ title, icon: Icon, color, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-white/[0.04] rounded-2xl bg-gradient-to-b from-zinc-950/40 to-transparent overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-6 py-5 hover:bg-white/[0.02] transition-colors"
      >
        <div className={`p-2 ${color} rounded-xl border border-white/[0.06]`}>
          <Icon size={18} />
        </div>
        <span className="text-[13px] font-bold text-white uppercase tracking-wider flex-1 text-left">
          {title}
        </span>
        {open ? <ChevronUp size={14} className="text-zinc-600" /> : <ChevronDown size={14} className="text-zinc-600" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-2 border-t border-white/[0.03]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Input Field ────────────────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5 mb-5 last:mb-0">
    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</label>
    {children}
  </div>
);

const TextInput = ({ value, onChange, placeholder, type = 'text' }) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full bg-zinc-950/80 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[13px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all"
  />
);

const SelectInput = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="w-full bg-zinc-950/80 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[13px] text-zinc-200 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer"
    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
  >
    {options.map(opt => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
);

const NumberInput = ({ value, onChange, min, max, step = 1 }) => (
  <input
    type="number"
    value={value}
    onChange={(e) => onChange(Number(e.target.value))}
    min={min}
    max={max}
    step={step}
    className="w-28 bg-zinc-950/80 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[13px] text-zinc-200 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
  />
);

const Toggle = ({ value, onChange, color = 'indigo' }) => {
  const activeColor = color === 'indigo' ? 'bg-indigo-500' : 'bg-cyan-500';
  const glowColor = color === 'indigo' ? 'shadow-[0_0_12px_rgba(99,102,241,0.4)]' : 'shadow-[0_0_12px_rgba(34,211,238,0.4)]';

  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-all ${value ? activeColor + ' ' + glowColor : 'bg-zinc-800 border border-white/[0.06]'}`}
    >
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : ''}`} />
    </button>
  );
};

// ─── Day Hours Row ──────────────────────────────────────────────────────────
const DayHoursRow = ({ day, settings, onChange }) => {
  const hours = settings.business_hours[day] || { enabled: false, open: '09:00', close: '17:00' };

  const update = (field, val) => {
    onChange({
      ...settings,
      business_hours: {
        ...settings.business_hours,
        [day]: { ...hours, [field]: val },
      },
    });
  };

  return (
    <div className="flex items-center gap-4 py-2.5 border-b border-white/[0.02] last:border-0">
      <Toggle value={hours.enabled} onChange={(v) => update('enabled', v)} color="cyan" />
      <span className={`text-[12px] font-medium w-24 ${hours.enabled ? 'text-zinc-300' : 'text-zinc-600'}`}>{day}</span>
      {hours.enabled ? (
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="time"
            value={hours.open}
            onChange={(e) => update('open', e.target.value)}
            className="bg-zinc-950/80 border border-white/[0.06] rounded-lg px-3 py-1.5 text-[12px] text-zinc-300 focus:outline-none focus:border-cyan-500/40 transition-all"
          />
          <span className="text-[11px] text-zinc-600">to</span>
          <input
            type="time"
            value={hours.close}
            onChange={(e) => update('close', e.target.value)}
            className="bg-zinc-950/80 border border-white/[0.06] rounded-lg px-3 py-1.5 text-[12px] text-zinc-300 focus:outline-none focus:border-cyan-500/40 transition-all"
          />
        </div>
      ) : (
        <span className="text-[11px] text-zinc-700 ml-auto italic">Closed</span>
      )}
    </div>
  );
};

// ─── Service Form (outside ServicesManager to preserve state) ─────────────
const ServiceForm = ({ initial, onSave, onCancel }) => {
  const [form, setForm] = useState(initial || {
    name: '', description: '', price_type: 'fixed',
    price_min: '', price_max: '', unit: '', category: '', is_active: true,
  });

  return (
    <div className="border border-amber-500/15 rounded-2xl bg-amber-500/[0.03] p-5 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Service Name</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Roof Repair"
            className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[13px] text-zinc-200 placeholder:text-zinc-800 focus:outline-none focus:border-amber-500/30 transition-all" />
        </div>
        <div className="col-span-2">
          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="What's included, what to expect..."
            rows={2}
            className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[12px] text-zinc-300 placeholder:text-zinc-800 focus:outline-none focus:border-amber-500/30 transition-all resize-none" />
        </div>
        <div>
          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Category</label>
          <input type="text" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            placeholder="e.g. Roofing, Gutters"
            className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[12px] text-zinc-300 placeholder:text-zinc-800 focus:outline-none focus:border-amber-500/30 transition-all" />
        </div>
        <div>
          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Price Type</label>
          <select value={form.price_type} onChange={e => setForm(f => ({ ...f, price_type: e.target.value }))}
            className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[12px] text-zinc-300 focus:outline-none focus:border-amber-500/30 transition-all appearance-none cursor-pointer">
            {PRICE_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
          </select>
        </div>
        {form.price_type !== 'free' && form.price_type !== 'quote' && (
          <>
            <div>
              <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">
                {form.price_type === 'range' ? 'Min Price' : 'Price'}
              </label>
              <input type="number" value={form.price_min} onChange={e => setForm(f => ({ ...f, price_min: e.target.value ? Number(e.target.value) : '' }))}
                placeholder="0" min={0}
                className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[12px] text-zinc-300 placeholder:text-zinc-800 focus:outline-none focus:border-amber-500/30 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
            {form.price_type === 'range' && (
              <div>
                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Max Price</label>
                <input type="number" value={form.price_max} onChange={e => setForm(f => ({ ...f, price_max: e.target.value ? Number(e.target.value) : '' }))}
                  placeholder="0" min={0}
                  className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[12px] text-zinc-300 placeholder:text-zinc-800 focus:outline-none focus:border-amber-500/30 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
            )}
            <div>
              <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Unit</label>
              <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[12px] text-zinc-300 focus:outline-none focus:border-amber-500/30 transition-all appearance-none cursor-pointer">
                {PRICE_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 pt-2">
        <button onClick={onCancel}
          className="px-4 py-2 rounded-xl text-[11px] font-bold text-zinc-600 uppercase tracking-wider hover:text-zinc-400 hover:bg-white/[0.03] transition-all">
          Cancel
        </button>
        <button onClick={() => onSave(form)}
          disabled={!form.name.trim()}
          className="px-5 py-2 rounded-xl bg-amber-500 text-black text-[11px] font-black uppercase tracking-wider hover:bg-amber-400 transition-all disabled:opacity-20 disabled:cursor-not-allowed">
          Save Service
        </button>
      </div>
    </div>
  );
};

// ─── Services Manager ──────────────────────────────────────────────────────
const ServicesManager = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [addForm, setAddForm] = useState(null);

  // Load from Supabase on mount
  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setServices(data || []);
    } catch (err) {
      console.error('[ServicesManager] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  const addService = async (svc) => {
    const id = crypto.randomUUID();
    const newSvc = { ...svc, id, sort_order: services.length };
    try {
      const { error } = await supabase.from('services').insert(newSvc);
      if (error) throw error;
      setServices(prev => [...prev, { ...newSvc, id }]);
      setAddForm(null);
    } catch (err) {
      console.error('[ServicesManager] Failed to add:', err);
    }
  };

  const updateService = async (id, updates) => {
    try {
      const { error } = await supabase.from('services').update(updates).eq('id', id);
      if (error) throw error;
      setServices(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    } catch (err) {
      console.error('[ServicesManager] Failed to update:', err);
    }
  };

  const deleteService = async (id) => {
    try {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;
      setServices(prev => prev.filter(s => s.id !== id));
      setEditingId(null);
    } catch (err) {
      console.error('[ServicesManager] Failed to delete:', err);
    }
  };

  const toggleActive = async (id) => {
    const svc = services.find(s => s.id === id);
    if (svc) await updateService(id, { is_active: !svc.is_active });
  };

  const formatPrice = (svc) => {
    if (svc.price_type === 'free') return 'Free';
    if (svc.price_type === 'quote') return 'Free Quote';
    const fmt = (n) => n != null ? `$${n.toLocaleString()}` : '?';
    const unit = svc.unit ? ` ${svc.unit}` : '';
    if (svc.price_type === 'fixed') return fmt(svc.price_min) + unit;
    if (svc.price_type === 'starting_at') return 'From ' + fmt(svc.price_min) + unit;
    if (svc.price_type === 'range') return fmt(svc.price_min) + ' – ' + fmt(svc.price_max) + unit;
    return '—';
  };

  // Group by category
  const categories = {};
  for (const svc of services) {
    const cat = svc.category || 'General';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(svc);
  }

  // ServiceForm is defined outside to prevent React state resets
  return (
    <div className="border border-white/[0.04] rounded-2xl bg-gradient-to-b from-zinc-950/40 to-transparent overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.03]">
        <div className="flex items-center gap-2.5">
          <DollarSign size={14} className="text-amber-400/60" />
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
            {services.length} service{services.length !== 1 ? 's' : ''} configured
          </span>
          <span className="text-[10px] text-zinc-700">·</span>
          <span className="text-[10px] text-zinc-600">
            {services.filter(s => s.is_active).length} active
          </span>
        </div>
        <button onClick={() => setAddForm({ name: '', description: '', price_type: 'fixed', price_min: '', price_max: '', unit: '', category: '', is_active: true })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-[10px] font-black uppercase tracking-wider hover:scale-105 transition-all shadow-[0_0_15px_rgba(255,255,255,0.08)]">
          <Plus size={10} /> Add Service
        </button>
      </div>

      {/* Add form */}
      {addForm && (
        <div className="px-5 pt-4">
          <ServiceForm
            initial={addForm}
            onSave={addService}
            onCancel={() => setAddForm(null)}
          />
        </div>
      )}

      {/* Service list grouped by category */}
      <div className="p-5 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-[10px] text-zinc-700 uppercase tracking-[0.3em] animate-pulse">Loading services</span>
          </div>
        ) : services.length === 0 && !addForm ? (
          <div className="flex flex-col items-center justify-center py-12 opacity-40">
            <Tag size={32} className="text-zinc-800 mb-3" />
            <p className="text-[11px] text-zinc-800 font-black uppercase tracking-[0.4em]">No services yet</p>
            <p className="text-[10px] text-zinc-900 mt-1 mb-4">Click Add Service to get started</p>
          </div>
        ) : (
          Object.entries(categories).map(([cat, catServices]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <Tag size={10} className="text-amber-400/40" />
                <span className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.3em]">{cat}</span>
                <div className="flex-1 h-px bg-white/[0.03]" />
              </div>
              <div className="space-y-2">
                {catServices.map(svc => (
                  <div key={svc.id}>
                    {editingId === svc.id ? (
                      <ServiceForm
                        initial={svc}
                        onSave={(form) => { updateService(svc.id, form); setEditingId(null); }}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <div className={`group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer
                        ${svc.is_active
                          ? 'border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.08]'
                          : 'border-white/[0.02] bg-white/[0.005] opacity-50 hover:opacity-70'
                        }`}
                        onClick={() => setEditingId(svc.id)}
                      >
                        {/* Active toggle */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleActive(svc.id); }}
                          className={`shrink-0 w-9 h-5 rounded-full transition-all flex items-center
                            ${svc.is_active
                              ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                              : 'bg-zinc-800 border border-white/[0.06]'
                            }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform shadow-sm ${svc.is_active ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                        </button>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[13px] font-bold truncate ${svc.is_active ? 'text-zinc-200' : 'text-zinc-500'}`}>
                              {svc.name}
                            </span>
                          </div>
                          {svc.description && (
                            <p className="text-[10px] text-zinc-700 truncate mt-0.5">{svc.description}</p>
                          )}
                        </div>

                        {/* Price */}
                        <span className="shrink-0 text-[12px] font-black text-amber-400/70 tabular-nums">
                          {formatPrice(svc)}
                        </span>

                        {/* Delete */}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteService(svc.id); }}
                          className="shrink-0 p-1.5 rounded-lg text-zinc-800 hover:text-rose-400 hover:bg-rose-500/5 transition-all opacity-0 group-hover:opacity-100">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ─── Knowledge Base Editor ─────────────────────────────────────────────────
const KnowledgeBaseEditor = ({ value, onChange }) => {
  const [activeTab, setActiveTab] = useState('about');
  const [showPreview, setShowPreview] = useState(false);

  const activeConfig = KNOWLEDGE_TABS.find(t => t.key === activeTab);
  const ActiveIcon = activeConfig.icon;
  const content = value[activeTab] || '';
  const template = KNOWLEDGE_TEMPLATES[activeTab];
  const TemplateIcon = template.icon;

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  const updateDoc = (val) => {
    onChange({ ...value, [activeTab]: val });
  };

  const loadTemplate = () => {
    if (content.trim()) {
      if (!window.confirm('This will replace your current content with the template. Continue?')) return;
    }
    updateDoc(template.placeholder);
  };

  const clearDoc = () => {
    if (!window.confirm('Clear all content in this tab?')) return;
    updateDoc('');
  };

  return (
    <div className="border border-white/[0.04] rounded-2xl bg-gradient-to-b from-zinc-950/40 to-transparent overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-3 border-b border-white/[0.03] overflow-x-auto">
        {KNOWLEDGE_TABS.map(tab => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.key;
          const hasContent = (value[tab.key] || '').trim().length > 0;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setShowPreview(false); }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap
                ${isActive
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.08)]'
                  : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.02] border border-transparent'
                }`}
            >
              <TabIcon size={13} />
              {tab.label}
              {hasContent && !isActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Hint bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.02] bg-white/[0.01]">
        <div className="flex items-center gap-2">
          <Lightbulb size={12} className="text-amber-400/60" />
          <span className="text-[11px] text-zinc-600">{activeConfig.hint}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-700 tabular-nums">{wordCount} words · {charCount} chars</span>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all
              ${showPreview
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'text-zinc-700 hover:text-zinc-400 border border-transparent'
              }`}
          >
            {showPreview ? <><EyeOff size={10} /> Edit</> : <><Eye size={10} /> Preview</>}
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="p-5">
        {showPreview ? (
          <div className="min-h-[300px]">
            {!content.trim() ? (
              <div className="flex flex-col items-center justify-center h-48 opacity-40">
                <Eye size={28} className="text-zinc-700 mb-3" />
                <p className="text-[11px] text-zinc-700 font-bold uppercase tracking-[0.3em]">Nothing to preview</p>
                <p className="text-[10px] text-zinc-800 mt-1">Write some content or load a template first</p>
              </div>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-[13px] text-zinc-300 leading-relaxed font-sans">
                  {content.split('\n').map((line, i) => {
                    if (line.startsWith('Q:') || line.startsWith('A:')) {
                      const isQuestion = line.startsWith('Q:');
                      return (
                        <div key={i} className={isQuestion ? 'mt-4 mb-1' : 'mb-2 pl-4 border-l-2 border-amber-500/10'}>
                          <span className={`font-bold ${isQuestion ? 'text-amber-400/80' : 'text-cyan-400/60'}`}>
                            {line.substring(0, 2)}
                          </span>
                          <span className={isQuestion ? 'text-zinc-200 font-semibold' : 'text-zinc-400'}>
                            {line.substring(2)}
                          </span>
                        </div>
                      );
                    }
                    if (line.startsWith('•') || line.startsWith('-')) {
                      return (
                        <div key={i} className="pl-4 flex items-start gap-2 my-1">
                          <span className="text-amber-400/40 mt-0.5 shrink-0">▸</span>
                          <span className="text-zinc-400">{line.substring(1).trim()}</span>
                        </div>
                      );
                    }
                    if (line.startsWith('SERVICES') || line.startsWith('WHAT') || line.startsWith('CANCELLATION') || line.startsWith('PAYMENT') || line.startsWith('WARRANTY') || line.startsWith('INSURANCE')) {
                      return <div key={i} className="text-amber-400/80 font-black text-[12px] uppercase tracking-wider mt-4 mb-2">{line}</div>;
                    }
                    if (line.trim() === '') {
                      return <div key={i} className="h-2" />;
                    }
                    return <div key={i} className="text-zinc-400">{line}</div>;
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="relative">
            {!content.trim() && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-30">
                <TemplateIcon size={32} className="text-zinc-800 mb-3" />
                <p className="text-[11px] text-zinc-800 font-bold uppercase tracking-[0.3em]">Empty document</p>
                <p className="text-[10px] text-zinc-900 mt-1">Load the template below or start typing</p>
              </div>
            )}
            <textarea
              value={content}
              onChange={(e) => updateDoc(e.target.value)}
              placeholder={`Write about ${activeConfig.label.toLowerCase()}...`}
              className="w-full min-h-[360px] bg-black/30 border border-white/[0.04] rounded-xl px-5 py-4 text-[13px] text-zinc-300 placeholder:text-zinc-800 focus:outline-none focus:border-amber-500/20 focus:shadow-[0_0_20px_rgba(245,158,11,0.04)] transition-all resize-y leading-relaxed font-mono"
              style={{ tabSize: 2 }}
            />
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.03] bg-white/[0.01]">
        <button
          onClick={loadTemplate}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-amber-500/15 bg-amber-500/5 text-[11px] font-bold text-amber-400 uppercase tracking-wider hover:bg-amber-500/10 hover:border-amber-500/25 transition-all"
        >
          <Star size={12} />
          Load Template
        </button>
        {content.trim() && (
          <button
            onClick={clearDoc}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-zinc-700 uppercase tracking-wider hover:text-rose-400 hover:bg-rose-500/5 transition-all"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Settings Page ──────────────────────────────────────────────────────────
const SettingsPage = () => {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('account_settings')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        // Strip supabase metadata fields
        const { id, created_at, updated_at, ...parsed } = data;
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (err) {
      console.error('[SettingsPage] Failed to load settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = { ...settings };

      const { data, error } = await supabase
        .from('account_settings')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw error;
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      console.error('[SettingsPage] Failed to save settings:', err);
      setError('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const update = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#020202]">
        <div className="text-[11px] text-zinc-700 uppercase tracking-[0.3em] animate-pulse">Loading settings</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#020202] text-zinc-400 font-sans selection:bg-indigo-500/20 overflow-hidden">

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between border-b border-white/[0.02] bg-gradient-to-b from-zinc-950/20 to-transparent px-8 py-6">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-indigo-500/5 rounded-xl border border-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.05)]">
            <Settings className="text-indigo-400" size={22} />
          </div>
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">Settings</h2>
            <p className="text-[11px] text-zinc-600 mt-1 tracking-wider uppercase">Account &amp; Business Configuration</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95
            ${savedFlash
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.3)]'
            }`}
        >
          {savedFlash ? <><Check size={14} /> Saved</> : saving ? 'Saving...' : <><Save size={14} /> Save Changes</>}
        </button>
      </header>

      {/* ─── Error Banner ───────────────────────────────────────────────── */}
      {error && (
        <div className="mx-8 mt-4 bg-rose-500/10 border border-rose-500/20 rounded-xl px-5 py-3 flex items-center gap-3">
          <span className="text-[11px] text-rose-400 font-medium">{error}</span>
          <button onClick={() => setError(null)} className="text-[10px] text-rose-400/60 hover:text-rose-400 ml-auto">Dismiss</button>
        </div>
      )}

      {/* ─── Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto custom-scrollbar px-8 py-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-4">

          {/* ── Business Info ────────────────────────────────────────────── */}
          <Section title="Business Info" icon={Building2} color="bg-indigo-500/10 text-indigo-400" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-x-6">
              <Field label="Business Name">
                <TextInput value={settings.business_name} onChange={(v) => update('business_name', v)} placeholder="Acme Corp" />
              </Field>
              <Field label="Phone Number">
                <TextInput value={settings.business_phone} onChange={(v) => update('business_phone', v)} placeholder="+1 (555) 000-0000" />
              </Field>
              <Field label="Email">
                <TextInput value={settings.business_email} onChange={(v) => update('business_email', v)} placeholder="hello@acme.com" type="email" />
              </Field>
              <Field label="Timezone">
                <SelectInput
                  value={settings.business_timezone}
                  onChange={(v) => update('business_timezone', v)}
                  options={TIMEZONES.map(tz => ({ value: tz, label: tz.replace('America/', '').replace('_', ' ') }))}
                />
              </Field>
            </div>
            <Field label="Address">
              <TextInput value={settings.business_address} onChange={(v) => update('business_address', v)} placeholder="123 Main St, City, State ZIP" />
            </Field>
          </Section>

          {/* ── Calendar & Appointments ──────────────────────────────────── */}
          <Section title="Calendar & Appointments" icon={Calendar} color="bg-cyan-500/10 text-cyan-400" defaultOpen={true}>
            <div className="flex items-center gap-8 mb-6">
              <Field label="Default Duration">
                <div className="flex items-center gap-2">
                  <NumberInput value={settings.default_appointment_duration} onChange={(v) => update('default_appointment_duration', v)} min={5} max={480} step={5} />
                  <span className="text-[12px] text-zinc-500">minutes</span>
                </div>
              </Field>
              <Field label="Buffer Between Appointments">
                <div className="flex items-center gap-2">
                  <NumberInput value={settings.appointment_buffer_minutes} onChange={(v) => update('appointment_buffer_minutes', v)} min={0} max={120} step={5} />
                  <span className="text-[12px] text-zinc-500">minutes</span>
                </div>
              </Field>
            </div>

            <div className="border-t border-white/[0.03] pt-5 mt-1">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={14} className="text-cyan-400/60" />
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Business Hours</span>
              </div>
              <div className="flex flex-col">
                {DAYS.map(day => (
                  <DayHoursRow key={day} day={day} settings={settings} onChange={setSettings} />
                ))}
              </div>
            </div>
          </Section>

          {/* ── Call & Notification Settings ─────────────────────────────── */}
          <Section title="Calls & Notifications" icon={Bell} color="bg-fuchsia-500/10 text-fuchsia-400" defaultOpen={false}>
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[12px] font-medium text-zinc-300">Auto-Confirm Appointments</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">Automatically confirm new bookings without manual review</div>
                </div>
                <Toggle value={settings.auto_confirm_appointments} onChange={(v) => update('auto_confirm_appointments', v)} />
              </div>

              <div className="border-t border-white/[0.03]" />

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[12px] font-medium text-zinc-300">SMS Confirmations</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">Send text message confirmations for new bookings</div>
                </div>
                <Toggle value={settings.send_confirmation_sms} onChange={(v) => update('send_confirmation_sms', v)} color="cyan" />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[12px] font-medium text-zinc-300">Email Confirmations</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">Send email confirmations for new bookings</div>
                </div>
                <Toggle value={settings.send_confirmation_email} onChange={(v) => update('send_confirmation_email', v)} color="cyan" />
              </div>

              <div className="border-t border-white/[0.03]" />

              <Field label="Send Reminders Before Appointment">
                <div className="flex items-center gap-2">
                  <NumberInput value={settings.reminder_before_minutes} onChange={(v) => update('reminder_before_minutes', v)} min={0} max={1440} step={15} />
                  <span className="text-[12px] text-zinc-500">minutes</span>
                </div>
              </Field>

              <div className="border-t border-white/[0.03]" />

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[12px] font-medium text-zinc-300">Allow Cancellations</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">Let callers cancel their appointments</div>
                </div>
                <Toggle value={settings.allow_cancellations} onChange={(v) => update('allow_cancellations', v)} />
              </div>

              {settings.allow_cancellations && (
                <Field label="Cancellation Window">
                  <div className="flex items-center gap-2">
                    <NumberInput value={settings.cancellation_window_hours} onChange={(v) => update('cancellation_window_hours', v)} min={0} max={168} step={1} />
                    <span className="text-[12px] text-zinc-500">hours before appointment</span>
                  </div>
                </Field>
              )}
            </div>
          </Section>

          {/* ── Services & Pricing ──────────────────────────────────────── */}
          <Section title="Services & Pricing" icon={Tag} color="bg-amber-500/10 text-amber-400" defaultOpen={true}>
            <div className="mb-4">
              <p className="text-[12px] text-zinc-500 leading-relaxed">
                Your AI receptionist uses these to answer pricing questions and describe what you offer.
              </p>
            </div>

            <ServicesManager />
          </Section>

          {/* ── Knowledge Base ──────────────────────────────────────────── */}
          <Section title="Knowledge Base" icon={BookOpen} color="bg-amber-500/10 text-amber-400" defaultOpen={true}>
            <div className="mb-4">
              <p className="text-[12px] text-zinc-500 leading-relaxed mb-1">
                Your AI receptionist reads these documents during calls. They contain everything it needs to know about your business — your story, services, pricing, policies, and common answers.
              </p>
              <p className="text-[11px] text-zinc-600 flex items-center gap-1.5">
                <Info size={11} className="text-amber-400/60 shrink-0" />
                Each tab below has a ready-to-customize template. Just edit the placeholders and your receptionist knows your business.
              </p>
            </div>

            <KnowledgeBaseEditor
              value={settings.knowledge_base || {}}
              onChange={(v) => update('knowledge_base', v)}
            />
          </Section>

        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
