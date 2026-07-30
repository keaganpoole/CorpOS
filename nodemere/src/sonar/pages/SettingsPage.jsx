import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Clock, Building2, Phone, Bell, Calendar,
  Check, ChevronDown, ChevronUp, Sun, Moon,
  BookOpen, FileText, Shield, HelpCircle, Sparkles,
  Eye, EyeOff, Lightbulb, Zap, Star, Info,
  Plus, Trash2, Tag, DollarSign,
  ArrowRight, X, MessageSquareText, Users,
  CalendarClock, Mail, PhoneCall, ListChecks, Upload, CalendarCheck, Pencil,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ForwardNumberModal, { FORWARDING_API_BASE_URL } from '../components/ForwardNumberModal';

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

EXAMPLE:

We're Hartley Roofing, a family-owned roofing company based in Portland, Maine. My dad started this business back in 2006 with nothing but a truck and a ladder, and we've been keeping roofs tight ever since.

We specialize in residential roofing: asphalt shingles, metal roofing, flat roofs, and repairs. We also do gutter installation and siding.

We're licensed and insured, and every job comes with a workmanship warranty on top of the manufacturer warranty.

We proudly serve the Greater Portland area and much of southern Maine, including Portland, South Portland, Scarborough, Westbrook, Falmouth, Cape Elizabeth, Gorham, Windham, Cumberland, Yarmouth, Freeport, and surrounding communities.
`,
  },
  services: {
    icon: Zap,
    label: 'Services & Pricing',
    placeholder: `List your services and what they cost. Keep it clear and specific so the receptionist can answer pricing questions accurately.

EXAMPLE:

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

EXAMPLE:

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

EXAMPLE:

Q: Do you give free estimates?
A: Yes, absolutely. Roof repairs and full replacements both come with free inspections and estimates. Just call and we'll schedule a time.

Q: How long does a roof replacement take?
A: Most residential jobs take 2-5 days depending on the size of your roof and the weather. We don't rush — we'd rather do it right than do it fast.

Q: What happens if it rains during the job?
A: We monitor the weather closely. If rain is coming, we'll make sure everything is tarped and sealed at the end of each work day so your home is never exposed. We don't start tearing off a roof unless we're confident we can get it dried in that same day.

Q: Do you work with insurance?
A: Yes. We're experienced with insurance claims for storm and hail damage. We'll document everything, provide the reports your adjuster needs, and work with them directly.

Q: What areas do you serve?
A: We serve all of Cumberland County and most of Southern Maine

Q: Are you licensed and insured?
A: Yes. We're fully licensed in Maine (License #RA-12345) and carry both general liability and workers' compensation insurance. We're happy to provide proof of insurance.

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
  { key: 'policies', icon: Shield, label: 'Policies', hint: 'Cancellation, payment, warranties, and expectations' },
  { key: 'faq', icon: HelpCircle, label: 'FAQ', hint: 'Common questions your callers ask — with answers' },
];

const defaultSettings = {
  business_name: '',
  business_phone: '',
  business_email: '',
  business_avatar: '',
  business_timezone: 'America/New_York',
  business_street: '',
  business_city: '',
  business_state: '',
  business_zip: '',
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
  autonomy_index: 1,
  preferences: {
    calls: {
      allow_caller_authentication: false,
    },
  },
  knowledge_base: {
    about: '',
    services: '',
    policies: '',
    faq: '',
  },
  intro_message_prompt: 'Hey, this is {{receptionist_name}} at {{company_name}}. What can I do for you?',
};

const normalizeNullishStrings = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeNullishStrings);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, normalizeNullishStrings(nestedValue)])
    );
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === 'null' || trimmed === 'undefined') {
      return null;
    }
  }
  return value;
};

const normalizeServicePayload = (service) => {
  const normalized = {
    ...service,
    name: String(service?.name || '').trim(),
    description: service?.description || '',
    category: String(service?.category || '').trim() || 'General',
    unit: service?.unit || '',
    price_type: service?.price_type || 'fixed',
    is_active: service?.is_active !== false,
  };

  const normalizeNumeric = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) ? num : null;
  };

  normalized.price_min = normalizeNumeric(service?.price_min);
  normalized.price_max = normalizeNumeric(service?.price_max);

  if (normalized.price_type === 'free' || normalized.price_type === 'quote') {
    normalized.price_min = null;
    normalized.price_max = null;
    normalized.unit = '';
  } else if (normalized.price_type !== 'range') {
    normalized.price_max = null;
  }

  return normalized;
};

const createServiceFormState = (service) => ({
  name: service?.name || '',
  description: service?.description || '',
  price_type: service?.price_type || 'fixed',
  price_min: service?.price_min ?? '',
  price_max: service?.price_max ?? '',
  unit: service?.unit ?? '',
  category: service?.category ?? '',
  is_active: service?.is_active !== false,
});

const createDefaultHours = (baseHours = null) => (
  DAYS.reduce((acc, day) => {
    const hours = baseHours?.[day] || {};
    acc[day] = {
      enabled: typeof hours.enabled === 'boolean' ? hours.enabled : !['Saturday', 'Sunday'].includes(day),
      open: hours.open || '09:00',
      close: hours.close || '17:00',
    };
    return acc;
  }, {})
);

const DEFAULT_STAFF_KNOWLEDGE = `Staff Profile Knowledge Base

Role and specialties:
- Senior stylist specializing in layered cuts, dimensional color, blonding, gloss treatments, and blowouts.
- Best fit for clients who want thoughtful consultation, low-maintenance color plans, and polished styling.

Booking guidance:
- Standard haircut appointments usually need 45 minutes.
- Color consultations should be booked before major transformations, corrections, or first-time blonding.
- Leave extra time for thick hair, corrective color, extensions, or clients requesting a full style change.

Client preferences:
- Prefers a clear inspiration photo when the client wants a major change.
- Likes to know whether the client wants low-maintenance upkeep or a high-impact result.
- Recommends clients arrive with clean, dry hair for color services unless told otherwise.

Important knowledge for the receptionist:
- If a client mentions damaged hair, box dye, previous color correction, or uncertainty about the service, book a consultation first.
- If the requested service timing is unclear, choose the longer appointment option and add a note for the staff member.
- For new color clients, collect current hair color, desired result, hair history, and whether they have inspiration photos.`;

const createStaffFormState = (staff, baseHours = null) => ({
  id: staff?.id || null,
  full_name: staff?.full_name || '',
  first_name: staff?.first_name || '',
  last_name: staff?.last_name || '',
  role: staff?.role || '',
  email: staff?.email || '',
  phone: staff?.phone || '',
  avatar: staff?.avatar || '',
  is_active: staff?.is_active !== false,
  knowledge: staff ? (staff.knowledge || '') : DEFAULT_STAFF_KNOWLEDGE,
  working_hours: createDefaultHours(staff?.working_hours || baseHours),
});

const normalizeStaffPayload = (form, businessId) => {
  const derivedFullName = String(form.full_name || '').trim()
    || [form.first_name, form.last_name].map((value) => String(value || '').trim()).filter(Boolean).join(' ');

  return {
    business_id: businessId,
    full_name: derivedFullName,
    first_name: String(form.first_name || '').trim() || null,
    last_name: String(form.last_name || '').trim() || null,
    role: String(form.role || '').trim() || null,
    email: String(form.email || '').trim() || null,
    phone: String(form.phone || '').trim() || null,
    avatar: String(form.avatar || '').trim() || null,
    is_active: form.is_active !== false,
    working_hours: createDefaultHours(form.working_hours),
    knowledge: String(form.knowledge || '').trim() || null,
  };
};

const formatHourLabel = (value) => {
  if (!value || typeof value !== 'string' || !value.includes(':')) return 'N/A';
  const [rawHour, rawMinute] = value.split(':');
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const period = hour >= 12 ? 'PM' : 'AM';
  const normalizedHour = hour % 12 || 12;
  return `${normalizedHour}:${String(minute).padStart(2, '0')} ${period}`;
};

const getStaffAvailabilitySummary = (workingHours) => {
  const normalizedHours = createDefaultHours(workingHours);
  const enabledEntries = Object.entries(normalizedHours).filter(([, hours]) => hours?.enabled);
  const opens = enabledEntries
    .map(([, hours]) => hours.open)
    .filter(Boolean)
    .sort();
  const closes = enabledEntries
    .map(([, hours]) => hours.close)
    .filter(Boolean)
    .sort();

  return {
    activeDays: enabledEntries.length,
    firstOpen: opens[0] || null,
    lastClose: closes[closes.length - 1] || null,
    scheduleLabel: enabledEntries.length > 0
      ? enabledEntries.map(([day]) => day.slice(0, 3)).join(' • ')
      : 'No hours configured',
  };
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
    className="w-full bg-[#070707]/85 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[13px] text-zinc-200 placeholder:text-zinc-700 outline-none outline-none focus:outline-none focus-visible:outline-none focus-visible:outline-none transition-all"
  />
);

const SelectInput = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="w-full bg-[#070707]/85 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[13px] text-zinc-200 outline-none outline-none focus:outline-none focus-visible:outline-none focus-visible:outline-none transition-all appearance-none cursor-pointer"
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
    className="w-28 bg-[#070707]/85 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[13px] text-zinc-200 outline-none outline-none focus:outline-none focus-visible:outline-none focus-visible:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
  />
);

const Toggle = ({ value, onChange }) => {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-all ${value ? 'dashboard-toggle-active' : 'bg-zinc-800 border border-white/[0.06]'}`}
      aria-pressed={value}
    >
      <div
        className="h-4 w-4 rounded-full bg-white transition-transform"
        style={{ transform: value ? 'translateX(16px)' : 'translateX(0px)' }}
      />
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
            className="time-input-no-icon bg-[#070707]/85 border border-white/[0.06] rounded-lg px-3 py-1.5 text-[12px] text-zinc-300 outline-none outline-none focus:outline-none focus-visible:outline-none focus-visible:outline-none transition-all appearance-none"
          />
          <span className="text-[11px] text-zinc-600">to</span>
          <input
            type="time"
            value={hours.close}
            onChange={(e) => update('close', e.target.value)}
            className="time-input-no-icon bg-[#070707]/85 border border-white/[0.06] rounded-lg px-3 py-1.5 text-[12px] text-zinc-300 outline-none outline-none focus:outline-none focus-visible:outline-none focus-visible:outline-none transition-all appearance-none"
          />
        </div>
      ) : (
        <span className="text-[11px] text-zinc-700 ml-auto italic">Closed</span>
      )}
    </div>
  );
};

const StaffHoursRow = ({ day, hours, onChange }) => {
  const value = hours?.[day] || { enabled: false, open: '09:00', close: '17:00' };

  const update = (field, nextValue) => {
    onChange({
      ...hours,
      [day]: { ...value, [field]: nextValue },
    });
  };

  return (
    <div className="flex items-center gap-4 py-2.5 border-b border-white/[0.02] last:border-0">
      <button
        type="button"
        onClick={() => update('enabled', !value.enabled)}
        className={`flex h-6 w-10 items-center rounded-full border p-0.5 transition-all ${
          value.enabled
            ? 'border-emerald-400/30 bg-emerald-400/15'
            : 'border-white/[0.08] bg-black/30'
        }`}
        aria-label={value.enabled ? `Disable ${day}` : `Enable ${day}`}
      >
        <div
          className={`h-4 w-4 rounded-full transition-transform ${
            value.enabled
              ? 'translate-x-4 bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.35)]'
              : 'translate-x-0 bg-zinc-200'
          }`}
        />
      </button>
      <span className="w-24 text-[12px] font-medium text-zinc-300">{day}</span>
      {value.enabled ? (
        <div className="ml-auto flex items-center gap-2">
          <input
            type="time"
            value={value.open}
            onChange={(e) => update('open', e.target.value)}
            className="time-input-no-icon bg-[#070707]/85 border border-white/[0.06] rounded-lg px-3 py-1.5 text-[12px] text-zinc-300 outline-none outline-none focus:outline-none focus-visible:outline-none focus-visible:outline-none transition-all appearance-none"
          />
          <span className="text-[11px] text-zinc-600">to</span>
          <input
            type="time"
            value={value.close}
            onChange={(e) => update('close', e.target.value)}
            className="time-input-no-icon bg-[#070707]/85 border border-white/[0.06] rounded-lg px-3 py-1.5 text-[12px] text-zinc-300 outline-none outline-none focus:outline-none focus-visible:outline-none focus-visible:outline-none transition-all appearance-none"
          />
        </div>
      ) : (
        <span className="text-[11px] text-zinc-700 ml-auto italic">Closed</span>
      )}
    </div>
  );
};

const StaffAvailabilitySelector = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const current = value ? 'Active' : 'Inactive';
  const options = [
    { label: 'Active', value: true },
    { label: 'Inactive', value: false },
  ];

  const selectOption = (nextValue) => {
    onChange?.(nextValue);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-flex items-center">
      <div className="flex items-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          className="no-drag z-10 flex items-center gap-2 px-0 py-1 text-[16px] font-bold leading-none tracking-tight text-zinc-200 transition-colors duration-300 hover:text-white"
        >
          <CalendarCheck size={14} className={value ? 'settings-icon' : 'text-zinc-600'} />
          <span>{current}</span>
        </button>
        <div
          className={`z-10 flex items-center gap-3.5 overflow-hidden pl-4 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
            isOpen ? 'max-w-[180px] opacity-100' : 'max-w-0 opacity-0'
          }`}
        >
          {options.filter((option) => option.label !== current).map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                selectOption(option.value);
              }}
              className="no-drag text-[11px] font-black leading-none tracking-tight text-zinc-500 transition-all duration-300 hover:scale-105 hover:text-zinc-200"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const StaffCard = ({ staff, isSelected = false, onSelect, onEdit, onDelete, onToggleActive, compact = false }) => {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const availability = getStaffAvailabilitySummary(staff.working_hours);
  const borderClass = isSelected ? 'border-[color-mix(in_srgb,var(--brandGradientStart)_16%,transparent)] shadow-[0_0_14px_color-mix(in_srgb,var(--brandGradientStart)_2%,transparent)]' : 'border-white/[0.04]';
  const cardSizeClass = compact ? 'h-[465px] min-h-[465px] max-h-[465px] w-[300px] min-w-[300px] max-w-[300px]' : 'h-[550px] min-h-[550px] max-h-[550px] w-[380px] min-w-[380px] max-w-[380px]';
  const imageHeightClass = compact ? 'h-[150px]' : 'h-[280px]';
  const bodyClass = compact ? 'h-[315px] min-h-[315px] max-h-[315px] p-4 space-y-2.5' : 'h-[270px] min-h-[270px] max-h-[270px] p-6 space-y-3.5';
  const nameClass = compact ? 'text-xl' : 'text-2xl';
  const showAvatar = Boolean(staff.avatar) && !avatarFailed;

  useEffect(() => {
    setAvatarFailed(false);
  }, [staff.avatar]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={() => onSelect?.(staff)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(staff);
        }
      }}
      role="button"
      tabIndex={0}
      className={`group relative box-border flex ${cardSizeClass} flex-col overflow-hidden rounded-[28px] border bg-[#0A0A0A] text-left transition-colors duration-300 hover:border-white/10 ${borderClass}`}
    >
      <div className={`relative ${imageHeightClass} shrink-0 overflow-hidden rounded-t-[28px] bg-gradient-to-br from-zinc-800 to-zinc-950`}>
        {showAvatar && (
          <img
            src={staff.avatar}
            alt={staff.full_name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            onError={() => setAvatarFailed(true)}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/40 to-transparent" />

        <div className="absolute top-4 left-4 flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-black/60 px-2.5 py-1 backdrop-blur-xl">
          <div className={`h-1.5 w-1.5 rounded-full ${staff.is_active ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-zinc-600'}`}>
            {staff.is_active && <div className="absolute h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping opacity-40" />}
          </div>
          <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">
            {staff.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(staff);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.06] bg-black/60 text-zinc-300 opacity-0 backdrop-blur-xl transition-all group-hover:opacity-100 hover:border-white/15 hover:bg-white/10 hover:text-white"
            aria-label="Edit staff member"
          >
            <Pencil size={12} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(staff);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-rose-500/20 bg-black/60 text-rose-500 opacity-0 backdrop-blur-xl transition-all group-hover:opacity-100 hover:border-rose-500/40 hover:bg-rose-500/20"
          >
            <X size={13} />
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
          <h3 className={`${nameClass} truncate font-bold leading-none tracking-tight text-white`}>{staff.full_name}</h3>
          <p className="mt-1 inline-flex max-w-full items-center truncate rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white/50">
            {staff.role || 'Staff Member'}
          </p>
        </div>
      </div>

      <div className={bodyClass}>
        <div className="px-0.5 py-1">
          <div className="min-w-0">
            <p className="mb-1.5 text-[8px] font-bold uppercase tracking-widest text-zinc-700">Staff Member</p>
            <div className="mt-1" onClick={(e) => e.stopPropagation()}>
              <StaffAvailabilitySelector
              value={staff.is_active}
              onChange={(nextValue) => onToggleActive?.(staff, nextValue)}
              />
            </div>
          </div>
        </div>

        <div className={`grid grid-cols-2 gap-x-5 gap-y-3 border-t border-white/[0.04] ${compact ? 'pt-2.5' : 'pt-3.5'}`}>
          <div className="min-w-0">
            <p className="mb-1.5 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-widest text-zinc-700">
              <CalendarClock size={10} className="settings-icon" />
              Availability Window
            </p>
            <div className="flex items-baseline gap-2">
              <span className="truncate text-[11px] font-bold leading-none tracking-tight text-zinc-300">
                {formatHourLabel(availability.firstOpen)} - {formatHourLabel(availability.lastClose)}
              </span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-widest text-zinc-700">
              <Mail size={10} className="settings-icon" />
              Email
            </p>
            <div className="flex items-baseline gap-2">
              <span className="truncate text-[11px] font-bold leading-none tracking-tight text-zinc-300">{staff.email || 'No email set'}</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-widest text-zinc-700">
              <PhoneCall size={10} className="settings-icon" />
              Phone Number
            </p>
            <div className="min-w-0 text-[11px] font-bold leading-none tracking-tight text-zinc-300">
              <span className="block truncate">{staff.phone || 'No phone set'}</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-widest text-zinc-700">
              <ListChecks size={10} className="settings-icon" />
              Working Hours
            </p>
            <p className="truncate text-[11px] font-bold leading-none tracking-tight text-zinc-300">
              {availability.scheduleLabel}
            </p>
          </div>
        </div>
        <div className="relative min-h-[32px] min-w-0 border-t border-white/[0.04] pt-3">
          <p className="truncate text-[11px] font-bold leading-none tracking-tight text-zinc-300">
            {staff.knowledge || 'No knowledge set'}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Service Form (outside ServicesManager to preserve state) ─────────────
const StaffDetailsModal = ({ staff, onClose, onEdit }) => {
  if (!staff) return null;

  const availability = getStaffAvailabilitySummary(staff.working_hours);
  const normalizedHours = createDefaultHours(staff.working_hours);
  const detailItems = [
    { label: 'Full Name', value: staff.full_name || 'Not set' },
    { label: 'First Name', value: staff.first_name || 'Not set' },
    { label: 'Last Name', value: staff.last_name || 'Not set' },
    { label: 'Role', value: staff.role || 'Staff Member' },
    { label: 'Phone Number', value: staff.phone || 'No phone set' },
    { label: 'Email', value: staff.email || 'No email set' },
    { label: 'Status', value: staff.is_active !== false ? 'Active' : 'Inactive' },
    {
      label: 'Availability Window',
      value: availability.activeDays > 0
        ? `${formatHourLabel(availability.firstOpen)} - ${formatHourLabel(availability.lastClose)}`
        : 'No hours configured',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1180] flex items-center justify-center bg-black/80 p-6 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.section
        initial={{ opacity: 0, y: 22, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.98 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[calc(100vh-32px)] w-full max-w-[820px] flex-col overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#070707]/95 text-left shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      >
        <div className="pointer-events-none absolute left-1/2 top-[-260px] h-[520px] w-[520px] -translate-x-1/2 rounded-full blur-[90px]" style={{ background: 'var(--modalBloom)' }} />
        <div className="relative flex items-start justify-between gap-5 border-b border-white/[0.05] px-7 py-6">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${staff.is_active !== false ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-zinc-600'}`} />
              <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">
                {staff.is_active !== false ? 'Active' : 'Inactive'}
              </span>
            </div>
            <h2 className="truncate text-2xl font-bold leading-none tracking-tight text-white sm:text-3xl">
              {staff.full_name || 'Unnamed Staff Member'}
            </h2>
            <p className="mt-2 inline-flex max-w-full items-center truncate rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white/50">
              {staff.role || 'Staff Member'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit?.(staff)}
              className="flex h-9 w-9 items-center justify-center text-zinc-500 transition hover:text-white"
              aria-label="Edit staff member"
            >
              <Pencil size={14} strokeWidth={2.2} />
            </button>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-zinc-500 transition hover:bg-white/[0.04] hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="custom-scrollbar relative flex-1 overflow-auto px-7 py-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {detailItems.map((item) => (
              <div key={item.label} className="min-w-0 rounded-2xl border border-white/[0.05] bg-white/[0.025] px-4 py-3">
                <p className="mb-1.5 text-[8px] font-bold uppercase tracking-widest text-zinc-700">{item.label}</p>
                <p className="truncate text-[11px] font-bold leading-none tracking-tight text-zinc-300">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-white/[0.05] bg-white/[0.025] px-4 py-4">
            <p className="mb-3 text-[8px] font-bold uppercase tracking-widest text-zinc-700">Schedule</p>
            <div className="grid gap-x-8 gap-y-0 sm:grid-cols-2">
              {DAYS.map((day) => {
                const hours = normalizedHours[day] || {};
                return (
                  <div key={day} className="flex items-center justify-between gap-3 border-b border-white/[0.04] py-2 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0">
                    <span className="truncate text-[11px] font-bold leading-none tracking-tight text-zinc-300">{day}</span>
                    <span className="shrink-0 text-[11px] font-bold leading-none tracking-tight text-zinc-500">
                      {hours.enabled ? `${formatHourLabel(hours.open)} - ${formatHourLabel(hours.close)}` : 'Inactive'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/[0.05] bg-white/[0.025] px-4 py-4">
            <p className="mb-3 text-[8px] font-bold uppercase tracking-widest text-zinc-700">Knowledge</p>
            <div className="custom-scrollbar max-h-[260px] overflow-auto rounded-xl border border-white/[0.05] bg-black/20 p-4 pr-5">
              <p className="whitespace-pre-wrap text-[11px] font-bold leading-6 tracking-tight text-zinc-300">
                {staff.knowledge || 'No knowledge set'}
              </p>
            </div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
};

const ServiceForm = ({ initial, onSave, onCancel }) => {
  const [form, setForm] = useState(createServiceFormState(initial));

  return (
    <div className="border border-white/[0.06] rounded-2xl bg-white/[0.025] p-5 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Service Name</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Roof Repair"
            className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[13px] text-zinc-200 placeholder:text-zinc-800 outline-none outline-none focus:outline-none focus-visible:outline-none focus-visible:outline-none transition-all" />
        </div>
        <div className="col-span-2">
          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="What's included, what to expect..."
            rows={2}
            className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[12px] text-zinc-300 placeholder:text-zinc-800 outline-none outline-none focus:outline-none focus-visible:outline-none focus-visible:outline-none transition-all resize-none" />
        </div>
        <div>
          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Category</label>
          <input type="text" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            placeholder="e.g. Roofing, Gutters"
            className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[12px] text-zinc-300 placeholder:text-zinc-800 outline-none outline-none focus:outline-none focus-visible:outline-none focus-visible:outline-none transition-all" />
        </div>
        {form.price_type !== 'free' && form.price_type !== 'quote' && (
          <>
            <div>
              <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">
                {form.price_type === 'range' ? 'Min Price' : 'Price'}
              </label>
              <input type="number" value={form.price_min} onChange={e => setForm(f => ({ ...f, price_min: e.target.value ? Number(e.target.value) : '' }))}
                placeholder="0" min={0}
                className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[12px] text-zinc-300 placeholder:text-zinc-800 outline-none outline-none focus:outline-none focus-visible:outline-none focus-visible:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
            {form.price_type === 'range' && (
              <div>
                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Max Price</label>
                <input type="number" value={form.price_max} onChange={e => setForm(f => ({ ...f, price_max: e.target.value ? Number(e.target.value) : '' }))}
                  placeholder="0" min={0}
                  className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[12px] text-zinc-300 placeholder:text-zinc-800 outline-none outline-none focus:outline-none focus-visible:outline-none focus-visible:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
            )}
            <div>
              <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1.5 block">Unit</label>
              <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                className="w-full bg-black/50 border border-white/[0.06] rounded-xl px-4 py-2.5 text-[12px] text-zinc-300 outline-none outline-none focus:outline-none focus-visible:outline-none focus-visible:outline-none transition-all appearance-none cursor-pointer">
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
          className="settings-neutral-button px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-20 disabled:cursor-not-allowed">
          Save Service
        </button>
      </div>
    </div>
  );
};

// ─── Services Manager ──────────────────────────────────────────────────────
const ServicesManager = ({ businessId, ensureBusinessRecord, onBusinessLinked }) => {
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
      let resolvedBusinessId = businessId;
      if (!resolvedBusinessId) {
        const business = await ensureBusinessRecord({ createIfMissing: false });
        resolvedBusinessId = business?.id || null;
        if (business?.id) onBusinessLinked?.(business.id);
      }

      if (!resolvedBusinessId) {
        setServices([]);
        return;
      }

      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', resolvedBusinessId)
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
    try {
      const business = await ensureBusinessRecord({ createIfMissing: true });
      const resolvedBusinessId = business?.id || businessId || null;
      if (!resolvedBusinessId) throw new Error('Save business info before adding services.');
      onBusinessLinked?.(resolvedBusinessId);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = authData?.user?.id;
      if (!userId) throw new Error('User not found');

      const newSvc = {
        ...normalizeServicePayload(svc),
        id,
        user_id: userId,
        sort_order: services.length,
        business_id: resolvedBusinessId,
      };
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
      let resolvedBusinessId = businessId;
      if (!resolvedBusinessId) {
        const business = await ensureBusinessRecord({ createIfMissing: false });
        resolvedBusinessId = business?.id || null;
      }
      const existingService = services.find((service) => service.id === id);
      if (!existingService) throw new Error('Service not found.');
      const normalizedUpdates = normalizeServicePayload({ ...existingService, ...updates });
      let query = supabase.from('services').update(normalizedUpdates).eq('id', id);
      if (resolvedBusinessId) query = query.eq('business_id', resolvedBusinessId);
      const { error } = await query;
      if (error) throw error;
      setServices(prev => prev.map(s => s.id === id ? { ...s, ...normalizedUpdates } : s));
    } catch (err) {
      console.error('[ServicesManager] Failed to update:', err);
    }
  };

  const deleteService = async (id) => {
    try {
      let resolvedBusinessId = businessId;
      if (!resolvedBusinessId) {
        const business = await ensureBusinessRecord({ createIfMissing: false });
        resolvedBusinessId = business?.id || null;
      }
      let query = supabase.from('services').delete().eq('id', id);
      if (resolvedBusinessId) query = query.eq('business_id', resolvedBusinessId);
      const { error } = await query;
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
          <DollarSign size={14} className="settings-icon" />
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
                <Tag size={10} className="settings-icon" />
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
                        <div onClick={(e) => e.stopPropagation()}>
                          <Toggle
                            value={svc.is_active}
                            onChange={() => toggleActive(svc.id)}
                            color="amber"
                          />
                        </div>

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
                        <span className="shrink-0 text-[12px] font-black text-zinc-300 tabular-nums">
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

export const StaffManager = ({ businessId, ensureBusinessRecord, onBusinessLinked, defaultHours, hideIntro = false, hideToolbar = false, cardGridClassName = '', compactCards = false }) => {
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(createStaffFormState(null, defaultHours));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffSlide, setStaffSlide] = useState(0);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUploadName, setAvatarUploadName] = useState('');
  const [showKnowledgeTips, setShowKnowledgeTips] = useState(false);
  const [deleteStaffTarget, setDeleteStaffTarget] = useState(null);

  useEffect(() => {
    loadStaff();
  }, [businessId]);

  useEffect(() => {
    const handleExternalCreate = () => openCreateModal();
    window.addEventListener('team:open-staff-modal', handleExternalCreate);
    return () => window.removeEventListener('team:open-staff-modal', handleExternalCreate);
  }, [defaultHours]);

  const loadStaff = async () => {
    setLoading(true);
    setError('');
    try {
      let resolvedBusinessId = businessId;
      if (!resolvedBusinessId) {
        const business = await ensureBusinessRecord({ createIfMissing: false });
        resolvedBusinessId = business?.id || null;
        if (business?.id) onBusinessLinked?.(business.id);
      }

      if (!resolvedBusinessId) return;

      const { data, error: loadError } = await supabase
        .from('staff')
        .select('*')
        .eq('business_id', resolvedBusinessId)
        .order('created_at', { ascending: false });
      if (loadError) throw loadError;
      setStaffMembers(data || []);
    } catch (err) {
      console.error('[StaffManager] Failed to load:', err);
      setError(err.message || 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingStaffId(null);
    setForm(createStaffFormState(null, defaultHours));
    setStaffSlide(0);
    setAvatarUploadName('');
    setShowKnowledgeTips(false);
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (staff) => {
    setSelectedStaff(null);
    setEditingStaffId(staff.id);
    setForm(createStaffFormState(staff, defaultHours));
    setStaffSlide(0);
    setAvatarUploadName('');
    setShowKnowledgeTips(false);
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setEditingStaffId(null);
    setForm(createStaffFormState(null, defaultHours));
    setStaffSlide(0);
    setAvatarUploadName('');
    setShowKnowledgeTips(false);
    setError('');
  };

  const requestDeleteStaff = (staff) => {
    if (!staff?.id) return;
    setDeleteStaffTarget(staff);
  };

  const validateStaffSlide = () => {
    if (staffSlide !== 0) return true;
    const fullName = String(form.full_name || '').trim()
      || [form.first_name, form.last_name].map((value) => String(value || '').trim()).filter(Boolean).join(' ');
    if (!fullName) {
      setError('Full name is required.');
      return false;
    }
    return true;
  };

  const goNextStaffSlide = () => {
    setError('');
    if (!validateStaffSlide()) return;
    setStaffSlide((prev) => Math.min(prev + 1, 3));
  };

  const goBackStaffSlide = () => {
    setError('');
    setStaffSlide((prev) => Math.max(prev - 1, 0));
  };

  const uploadStaffAvatar = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      setError('Choose an image file for the staff profile photo.');
      return;
    }
    setAvatarUploading(true);
    setError('');
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = authData?.user?.id;
      if (!userId) throw new Error('User not found');
      const business = await ensureBusinessRecord({ createIfMissing: true });
      const resolvedBusinessId = business?.id || businessId || 'business';
      if (business?.id) onBusinessLinked?.(business.id);
      const extension = file.name?.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${userId}/${resolvedBusinessId}/${editingStaffId || 'new'}-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('staff-avatars')
        .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('staff-avatars').getPublicUrl(path);
      setForm((prev) => ({ ...prev, avatar: data?.publicUrl || '' }));
      setAvatarUploadName(file.name || 'Uploaded image');
    } catch (err) {
      console.error('[StaffManager] Failed to upload avatar:', err);
      setError(err.message || 'Failed to upload image. Confirm the Supabase avatars bucket exists and allows uploads.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const saveStaff = async () => {
    const fullName = String(form.full_name || '').trim()
      || [form.first_name, form.last_name].map((value) => String(value || '').trim()).filter(Boolean).join(' ');

    if (!fullName) {
      setError('Full name is required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const business = await ensureBusinessRecord({ createIfMissing: true });
      const resolvedBusinessId = business?.id || businessId || null;
      if (!resolvedBusinessId) throw new Error('Save business info before adding staff.');
      onBusinessLinked?.(resolvedBusinessId);

      const payload = normalizeStaffPayload({ ...form, full_name: fullName }, resolvedBusinessId);

      if (!editingStaffId) {
        const { data, error: insertError } = await supabase
          .from('staff')
          .insert(payload)
          .select('*')
          .single();
        if (insertError) throw insertError;
        setStaffMembers((prev) => [data, ...prev]);
      } else {
        const { data, error: updateError } = await supabase
          .from('staff')
          .update(payload)
          .eq('id', editingStaffId)
          .eq('business_id', resolvedBusinessId)
          .select('*')
          .single();
        if (updateError) throw updateError;
        setStaffMembers((prev) => prev.map((member) => (member.id === data.id ? data : member)));
      }
      closeModal();
    } catch (err) {
      console.error('[StaffManager] Failed to save:', err);
      setError(err.message || 'Failed to save staff member');
    } finally {
      setSaving(false);
    }
  };

  const deleteStaff = async (staff) => {
    if (!staff?.id) return;
    try {
      let resolvedBusinessId = businessId;
      if (!resolvedBusinessId) {
        const business = await ensureBusinessRecord({ createIfMissing: false });
        resolvedBusinessId = business?.id || null;
      }

      let query = supabase.from('staff').delete().eq('id', staff.id);
      if (resolvedBusinessId) query = query.eq('business_id', resolvedBusinessId);
      const { error: deleteError } = await query;
      if (deleteError) throw deleteError;

      setStaffMembers((prev) => prev.filter((member) => member.id !== staff.id));
      setSelectedStaff((prev) => (prev?.id === staff.id ? null : prev));
      setDeleteStaffTarget((prev) => (prev?.id === staff.id ? null : prev));
      if (editingStaffId === staff.id) closeModal();
    } catch (err) {
      console.error('[StaffManager] Failed to delete:', err);
      setError(err.message || 'Failed to delete staff member');
    }
  };

  const toggleStaffActive = async (staff, nextIsActive) => {
    try {
      let resolvedBusinessId = businessId;
      if (!resolvedBusinessId) {
        const business = await ensureBusinessRecord({ createIfMissing: false });
        resolvedBusinessId = business?.id || null;
      }

      let query = supabase
        .from('staff')
        .update({ is_active: nextIsActive })
        .eq('id', staff.id);
      if (resolvedBusinessId) query = query.eq('business_id', resolvedBusinessId);
      const { data, error: toggleError } = await query.select('*').single();
      if (toggleError) throw toggleError;

      setStaffMembers((prev) => prev.map((member) => (member.id === data.id ? data : member)));
      setSelectedStaff((prev) => (prev?.id === data.id ? data : prev));
      if (editingStaffId === data.id) {
        setForm((prev) => ({ ...prev, is_active: data.is_active }));
      }
    } catch (err) {
      console.error('[StaffManager] Failed to toggle:', err);
      setError(err.message || 'Failed to update staff status');
    }
  };

  const staffSteps = [
    { label: 'Profile', title: 'Basic Info', description: 'Add basic info for this staff member.' },
    { label: 'Schedule', title: 'Schedule', description: 'Set the exact days and hours this staff member can accept appointments.' },
    { label: 'Knowledge', title: 'Knowledge', description: 'Help your receptionist learn more about this staff member. This allows it to recommend the right person, explain their strengths clearly, and make better booking decisions during calls.' },
    { label: 'Photo', title: 'Upload Image', description: 'Upload a profile image that helps keep this staff member easy to recognize across the Team page.' },
  ];

  const renderStaffSlide = () => {
    if (staffSlide === 0) {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2 md:col-span-2">
            <span className="text-[13px] font-normal text-zinc-400">Full Name</span>
            <input type="text" value={form.full_name} onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))} placeholder="e.g. Olivia Hart" className="h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-white outline-none transition placeholder:text-zinc-700" />
          </label>
          <label className="block space-y-2">
            <span className="text-[13px] font-normal text-zinc-400">First Name</span>
            <input type="text" value={form.first_name} onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))} placeholder="Olivia" className="h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-white outline-none transition placeholder:text-zinc-700" />
          </label>
          <label className="block space-y-2">
            <span className="text-[13px] font-normal text-zinc-400">Last Name</span>
            <input type="text" value={form.last_name} onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))} placeholder="Hart" className="h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-white outline-none transition placeholder:text-zinc-700" />
          </label>
          <label className="block space-y-2">
            <span className="text-[13px] font-normal text-zinc-400">Role</span>
            <input type="text" value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))} placeholder="Senior Stylist" className="h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-white outline-none transition placeholder:text-zinc-700" />
          </label>
          <label className="block space-y-2">
            <span className="text-[13px] font-normal text-zinc-400">Phone</span>
            <input type="text" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="(555) 000-0000" className="h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-white outline-none transition placeholder:text-zinc-700" />
          </label>
          <label className="block space-y-2 md:col-span-2">
            <span className="text-[13px] font-normal text-zinc-400">Email</span>
            <input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="olivia@business.com" className="h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-white outline-none transition placeholder:text-zinc-700" />
          </label>
        </div>
      );
    }

    if (staffSlide === 1) {
      return (
        <div className="custom-scrollbar max-h-[400px] overflow-auto rounded-[22px] border border-white/[0.06] bg-black/20 p-4 pr-3">
          {DAYS.map((day) => (
            <StaffHoursRow key={day} day={day} hours={form.working_hours} onChange={(nextHours) => setForm((prev) => ({ ...prev, working_hours: nextHours }))} />
          ))}
        </div>
      );
    }

    if (staffSlide === 2) {
      return (
        <textarea value={form.knowledge} onChange={(e) => setForm((prev) => ({ ...prev, knowledge: e.target.value }))} className="custom-scrollbar h-[410px] w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-4 pr-5 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-700" />
      );
    }

    return (
      <label className="flex h-[300px] cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-white/[0.12] bg-white/[0.035] px-6 text-center transition hover:border-white/25 hover:bg-white/[0.055]">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-black/20 text-zinc-500">
          <Upload size={24} />
        </div>
        <p className="text-sm font-bold text-white">{avatarUploading ? 'Uploading image...' : 'Upload staff image'}</p>
        <p className="mt-2 max-w-sm text-xs leading-5 text-zinc-600">Choose a clear image file. Once uploaded, it will be saved as this staff member's profile photo.</p>
        {(avatarUploadName || form.avatar) && <p className="mt-4 max-w-full truncate text-xs text-zinc-300">{avatarUploadName || 'Image ready'}</p>}
        <input type="file" accept="image/*" className="hidden" disabled={avatarUploading || saving} onChange={(e) => uploadStaffAvatar(e.target.files?.[0])} />
      </label>
    );
  };

  const activeCount = staffMembers.filter((member) => member.is_active !== false).length;

  return (
    <div className="space-y-4">
      {!hideIntro && <div className="mb-4">
        <p className="text-[12px] leading-relaxed text-zinc-500">
          Add the real people your receptionist can book appointments for. Each staff record carries its own availability window so scheduling decisions are tied to actual staff hours, not just business hours.
        </p>
      </div>}

      {error && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-[11px] font-medium text-rose-300">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {!hideToolbar && <div className="flex items-center justify-between rounded-[24px] border border-white/[0.05] bg-zinc-950/30 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Users size={14} className="settings-icon" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              {staffMembers.length} staff member{staffMembers.length !== 1 ? 's' : ''} configured
            </span>
            <span className="text-[10px] text-zinc-700">·</span>
            <span className="text-[10px] text-zinc-600">{activeCount} active</span>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-black transition hover:bg-zinc-200"
          >
            <Plus size={11} />
            Add Staff
          </button>
        </div>}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-700 animate-pulse">Loading staff</span>
          </div>
        ) : staffMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[28px] border border-white/[0.04] bg-gradient-to-b from-zinc-950/20 to-transparent py-16 opacity-50">
            <Users size={36} className="mb-3 text-zinc-800" />
            <p className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-800">No staff yet</p>
            <p className="mt-1 text-[10px] text-zinc-900">Add your first bookable staff member</p>
          </div>
        ) : (
          <div className={cardGridClassName || 'grid grid-cols-1 gap-4 xl:grid-cols-2'}>
            {staffMembers.map((staff) => (
              <StaffCard
                key={staff.id}
                staff={staff}
                onSelect={setSelectedStaff}
                onEdit={openEditModal}
                onDelete={requestDeleteStaff}
                onToggleActive={toggleStaffActive}
                compact={compactCards}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedStaff && (
          <StaffDetailsModal
            staff={selectedStaff}
            onClose={() => setSelectedStaff(null)}
            onEdit={openEditModal}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteStaffTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1250] flex items-center justify-center p-8 bg-black/80 backdrop-blur-md"
            onClick={() => setDeleteStaffTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[400px] bg-[#0a0a0a] border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Delete Staff Member</span>
                <button onClick={() => setDeleteStaffTarget(null)} className="p-1 rounded-lg text-zinc-600 hover:text-white hover:bg-white/[0.04] transition-all">
                  <X size={14} />
                </button>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                    <Trash2 size={18} className="text-rose-400" />
                  </div>
                  <div>
                    <p className="text-[13px] text-zinc-200 font-medium">
                      Remove <span className="text-white font-bold">{deleteStaffTarget?.first_name || deleteStaffTarget?.full_name}</span> from active duty?
                    </p>
                    <p className="text-[11px] text-zinc-600 mt-1">This action cannot be undone.</p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setDeleteStaffTarget(null)}
                    className="px-4 py-2 rounded-xl text-[11px] font-bold text-zinc-500 uppercase tracking-wider hover:text-zinc-300 hover:bg-white/[0.03] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => deleteStaff(deleteStaffTarget)}
                    className="px-5 py-2 rounded-xl bg-rose-500 text-white text-[11px] font-black uppercase tracking-wider hover:bg-rose-400 transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] active:scale-95"
                  >
                    Terminate
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/80 p-6 backdrop-blur-xl"
            onClick={closeModal}
          >
            <motion.section
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[calc(100vh-24px)] w-full max-w-[700px] overflow-hidden rounded-[34px] border border-white/[0.08] bg-[#070707]/95 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl"
            >
              <div className="pointer-events-none absolute left-1/2 top-[-260px] h-[520px] w-[520px] -translate-x-1/2 rounded-full blur-[90px]" style={{ background: 'var(--modalBloom)' }} />
              <div className="relative p-6 sm:p-8">
                <div className="mb-6 flex items-start justify-between gap-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex h-4 items-center gap-3 pr-8">
                      <p className="shrink-0 text-[13px] font-normal leading-4 text-zinc-300">{staffSteps[staffSlide].label} · {staffSlide + 1} of {staffSteps.length}</p>
                      <div className="h-1 w-[190px] shrink-0 translate-y-0 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full brand-gradient transition-all duration-500" style={{ width: `${((staffSlide + 1) / staffSteps.length) * 100}%` }} />
                      </div>
                    </div>
                    <div className="mt-5 flex items-center gap-3">
                      <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
                        {staffSteps[staffSlide].title}
                      </h2>
                      {staffSlide === 2 && (
                        <button type="button" onClick={() => setShowKnowledgeTips(true)} className="h-6 rounded-full border border-white/[0.08] px-2.5 text-[10px] font-semibold tracking-normal text-zinc-500 transition hover:border-white/20 hover:text-zinc-300">
                          Tips
                        </button>
                      )}
                    </div>
                    <p className="mt-3 w-full max-w-none text-sm leading-6 text-zinc-500">
                      {staffSteps[staffSlide].description}
                    </p>
                  </div>
                  <button type="button" onClick={closeModal} className="shrink-0 rounded-full p-2 text-zinc-500 transition hover:bg-white/[0.04] hover:text-white">
                    <X size={16} />
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={staffSlide}
                    initial={{ opacity: 0, x: 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -18 }}
                    transition={{ duration: 0.18 }}
                    className="min-h-[420px]"
                  >
                    {renderStaffSlide()}
                  </motion.div>
                </AnimatePresence>

                <div className="mt-5 space-y-3">
                  {staffSlide === staffSteps.length - 1 ? (
                    <button type="button" onClick={saveStaff} disabled={saving || avatarUploading} className="h-12 w-full rounded-full bg-white text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40">
                      {saving ? 'Saving...' : editingStaffId ? 'Update staff' : 'Add staff'}
                    </button>
                  ) : (
                    <button type="button" onClick={goNextStaffSlide} disabled={saving || avatarUploading} className="h-12 w-full rounded-full bg-white text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40">
                      Continue
                    </button>
                  )}
                  <button type="button" onClick={staffSlide === 0 ? closeModal : goBackStaffSlide} disabled={saving || avatarUploading} className="h-11 w-full rounded-full text-sm font-normal text-zinc-500 transition hover:text-white disabled:opacity-40">
                    {staffSlide === 0 ? 'Close' : 'Back'}
                  </button>
                  {editingStaffId && staffSlide === staffSteps.length - 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const selected = staffMembers.find((member) => member.id === editingStaffId);
                        if (selected) requestDeleteStaff(selected);
                      }}
                      className="h-10 w-full rounded-full text-xs font-normal text-zinc-600 transition hover:text-rose-300"
                    >
                      Delete staff member
                    </button>
                  )}
                  {error && <p className="text-center text-sm text-red-400">{error}</p>}
                </div>
              </div>
            </motion.section>
            <AnimatePresence>
              {showKnowledgeTips && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[10] flex items-center justify-center bg-black/55 p-6 backdrop-blur-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowKnowledgeTips(false);
                  }}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 18, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.97 }}
                    transition={{ duration: 0.18 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-[520px] rounded-[28px] border border-white/[0.08] bg-[#181818] p-6 text-left shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[13px] font-normal text-zinc-300">Knowledge tips</p>
                        <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">What should go here?</h3>
                      </div>
                      <button type="button" onClick={() => setShowKnowledgeTips(false)} className="shrink-0 rounded-full p-2 text-zinc-500 transition hover:bg-white/[0.05] hover:text-white">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="mt-5 space-y-4 text-sm leading-7 text-zinc-400">
                      <p>Write this like you are briefing a smart receptionist before a call. Give them the details that help them make better choices: what this staff member is great at, what they should or should not be booked for, when a consultation is needed, timing preferences, and any client situations that need special handling.</p>
                      <p>During a call, the receptionist can use this context to explain options accurately, pick the right staff member, avoid bad bookings, and ask the right follow-up questions instead of guessing.</p>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
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
                  ? 'bg-white/[0.06] text-white border border-white/[0.08] shadow-[0_0_8px_color-mix(in_srgb,var(--brandGradientStart)_3%,transparent)]'
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
          <Lightbulb size={12} className="settings-icon" />
          <span className="text-[11px] text-zinc-600">{activeConfig.hint}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-700 tabular-nums">{wordCount} words · {charCount} chars</span>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all
              ${showPreview
                ? 'bg-white/[0.06] text-white border border-white/[0.08]'
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
                        <div key={i} className={isQuestion ? 'mt-4 mb-1' : 'mb-2 pl-4 border-l-2 border-white/[0.08]'}>
                          <span className={`font-bold ${isQuestion ? 'text-zinc-200' : 'text-zinc-500'}`}>
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
                          <span className="text-zinc-500 mt-0.5 shrink-0">▸</span>
                          <span className="text-zinc-400">{line.substring(1).trim()}</span>
                        </div>
                      );
                    }
                    if (line.startsWith('SERVICES') || line.startsWith('WHAT') || line.startsWith('CANCELLATION') || line.startsWith('PAYMENT') || line.startsWith('WARRANTY') || line.startsWith('INSURANCE')) {
                      return <div key={i} className="text-zinc-200 font-black text-[12px] uppercase tracking-wider mt-4 mb-2">{line}</div>;
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
              className="w-full min-h-[360px] bg-black/30 border border-white/[0.04] rounded-xl px-5 py-4 text-[13px] text-zinc-300 placeholder:text-zinc-800 outline-none focus:outline-none focus-visible:outline-none transition-all resize-y leading-relaxed font-mono"
              style={{ tabSize: 2 }}
            />
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-end px-5 py-3 border-t border-white/[0.03] bg-white/[0.01]">
        <button
          onClick={loadTemplate}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-[11px] font-bold text-zinc-300 uppercase tracking-wider hover:bg-white/[0.06] hover:border-white/15 transition-all"
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

// ─── Intro Message Editor ──────────────────────────────────────────────────
const IntroMessageEditor = ({ value, onChange }) => {
  const textareaRef = React.useRef(null);

  const wordCount = (value || '').trim() ? (value || '').trim().split(/\s+/).length : 0;

  return (
    <div className="border border-white/[0.04] rounded-2xl bg-gradient-to-b from-zinc-950/40 to-transparent overflow-hidden">
      {/* Editor */}
      <div className="p-5">
        <textarea
          id="intro-message-textarea"
          ref={textareaRef}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Hey, thanks for calling. What can I do for you?"
          className="min-h-[118px] w-full resize-none bg-black/30 border border-white/[0.04] rounded-xl px-5 py-4 text-[13px] text-zinc-300 placeholder:text-zinc-800 outline-none focus:outline-none focus-visible:outline-none transition-all leading-relaxed font-sans"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.03] bg-white/[0.01]">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-700 tabular-nums">{wordCount} words · {(value || '').length} chars</span>
        </div>
      </div>
    </div>
  );
};

// ─── Settings Page ──────────────────────────────────────────────────────────
const formatForwardingPhoneNumber = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  const normalized = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (normalized.length !== 10) return value || 'Unassigned';
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
};

const BusinessForwardingSettings = ({ authSession }) => {
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);

  const loadForwardingState = async () => {
    if (!authSession?.access_token) {
      setEntry(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${FORWARDING_API_BASE_URL}/businesses/me/forwarding`, {
        headers: { Authorization: `Bearer ${authSession.access_token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setEntry(data?.current_entry || null);
    } catch (err) {
      console.error('[SettingsPage] Failed to load forwarding state:', err);
      setEntry(null);
      setError('Could not load forwarding status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForwardingState();
  }, [authSession?.access_token]);

  const sourceLabel = formatForwardingPhoneNumber(entry?.source_number || entry?.source_label);
  const targetLabel = formatForwardingPhoneNumber(entry?.target_number);
  const isVerified = entry?.status === 'verified';

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-[24px] border border-white/[0.05] bg-zinc-950/40 p-5">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <PhoneCall size={15} className="settings-icon" />
                <h4 className="text-[13px] font-semibold text-zinc-100">Business Number Forwarding</h4>
              </div>
              <p className="mt-2 max-w-2xl text-[12px] leading-5 text-zinc-500">
                Set the forwarding number for this business once. All receptionist call handling uses this business-level setup.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="settings-neutral-button shrink-0 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
            >
              {entry ? 'Manage' : 'Setup'}
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/[0.04] bg-black/20 p-4">
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-700">Business Number</p>
              <p className="mt-2 truncate text-[14px] font-semibold text-zinc-200">
                {loading ? 'Loading...' : sourceLabel}
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.04] bg-black/20 p-4">
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-700">Receptionist Number</p>
              <p className="mt-2 truncate text-[14px] font-semibold text-zinc-200">
                {loading ? 'Loading...' : targetLabel}
              </p>
            </div>
          </div>

          {error && (
            <p className="mt-4 text-[11px] font-medium text-rose-400">{error}</p>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <ForwardNumberModal
            authSession={authSession}
            onClose={() => setShowModal(false)}
            onSaved={(savedEntry) => {
              setEntry(savedEntry || null);
              loadForwardingState();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
};

const SettingsPage = () => {
  const { session: authSession } = useAuth();
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('business');
  const [businessAvatarUploading, setBusinessAvatarUploading] = useState(false);
  const businessAvatarInputRef = useRef(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const syncBusinessId = (businessId) => {
    if (!businessId) return;
    setSettings(prev => ({ ...prev, _business_id: businessId }));
  };

  const ensureBusinessRecord = async ({ createIfMissing = true } = {}) => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    const userId = authData?.user?.id;
    if (!userId) throw new Error('User not found');

    const businessPayload = {
      name: settings.business_name || '',
      phone: settings.business_phone || '',
      email: settings.business_email || '',
      avatar: settings.business_avatar || '',
      address: settings.business_street || '',
      city: settings.business_city || '',
      state: settings.business_state || '',
      zip: settings.business_zip || '',
      business_hours: typeof settings.business_hours === 'object' ? JSON.stringify(settings.business_hours) : settings.business_hours,
      about_us: settings.knowledge_base?.about || '',
      policies: settings.knowledge_base?.policies || '',
      faq: settings.knowledge_base?.faq || '',
      user_id: userId,
    };

    const normalizedBusinessId =
      settings._business_id === null || settings._business_id === undefined || settings._business_id === ''
        ? null
        : Number(settings._business_id);

    if (normalizedBusinessId !== null && Number.isNaN(normalizedBusinessId)) {
      throw new Error(`Invalid business id: ${settings._business_id}`);
    }

    if (normalizedBusinessId !== null) {
      const { data, error } = await supabase
        .from('businesses')
        .update(businessPayload)
        .eq('id', normalizedBusinessId)
        .eq('user_id', userId)
        .select('id')
        .single();
      if (error) throw error;
      syncBusinessId(data?.id ?? normalizedBusinessId);
      return data || { id: normalizedBusinessId };
    }

    const { data: existingBusiness, error: existingBusinessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (existingBusinessError && existingBusinessError.code !== 'PGRST116') throw existingBusinessError;

    if (existingBusiness?.id) {
      const { data, error } = await supabase
        .from('businesses')
        .update(businessPayload)
        .eq('id', existingBusiness.id)
        .eq('user_id', userId)
        .select('id')
        .single();
      if (error) throw error;
      syncBusinessId(data?.id ?? existingBusiness.id);
      return data || existingBusiness;
    }

    if (!createIfMissing) return null;

    const { data, error } = await supabase
      .from('businesses')
      .insert(businessPayload)
      .select('id')
      .single();
    if (error) throw error;
    syncBusinessId(data?.id ?? null);
    return data || null;
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = authData?.user?.id;
      if (!userId) throw new Error('User not found');

      // Load business info from businesses table
      const { data: bizData, error: bizErr } = await supabase
        .from('businesses')
        .select('id, name, phone, email, avatar, address, city, state, zip, business_hours, about_us, policies, faq')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (bizErr && bizErr.code !== 'PGRST116') throw bizErr;

      // Load app config from account_settings
      const { data: settingsData, error: settingsErr } = await supabase
        .from('account_settings')
        .select('*')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (settingsErr && settingsErr.code !== 'PGRST116') throw settingsErr;

      const biz = bizData || {};
      const config = settingsData ? (() => {
        const { created_at, updated_at, business_name, business_phone, business_email, business_address, business_hours, business_timezone, ...parsed } = settingsData;
        return parsed;
      })() : {};

      setSettings({
        ...defaultSettings,
        // Business fields from businesses table
        _business_id: biz.id || null,
        business_name: biz.name || '',
        business_phone: biz.phone || '',
        business_email: biz.email || '',
        business_avatar: biz.avatar || '',
        business_street: biz.address || '',
        business_city: biz.city || '',
        business_state: biz.state || '',
        business_zip: biz.zip || '',
        business_hours: (() => {
          const h = biz.business_hours;
          if (!h) return {};
          if (typeof h === 'object') return h;
          try { return JSON.parse(h); } catch { return {}; }
        })(),
        business_timezone: config.business_timezone || 'America/New_York',
        // App config from account_settings
        ...config,
        // Knowledge base from businesses table
        knowledge_base: {
          about: biz.about_us ?? '',
          policies: biz.policies ?? '',
          faq: biz.faq ?? '',
        },
      });
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
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = authData?.user?.id;
      if (!userId) throw new Error('User not found');

      const business = await ensureBusinessRecord({ createIfMissing: true });
      const normalizedBusinessId = business?.id ?? null;

      // Save app config to account_settings (excluding business fields and services)
      const { business_name, business_phone, business_email, business_avatar, business_street, business_city, business_state, business_zip, business_hours, business_timezone, _business_id, services, knowledge_base, id: _id, created_at, updated_at, ...appConfig } = settings;
      const normalizedAppConfig = normalizeNullishStrings(appConfig);
      const scopedAppConfig = {
        ...normalizedAppConfig,
        user_id: userId,
        business_id: normalizedBusinessId,
      };

      let savedSettings = null;
      if (_id) {
        const { data, error } = await supabase
          .from('account_settings')
          .update(scopedAppConfig)
          .eq('id', _id)
          .eq('user_id', userId)
          .select('*')
          .single();
        if (error) throw error;
        savedSettings = data;
      } else {
        const { data: existingSettings, error: existingSettingsError } = await supabase
          .from('account_settings')
          .select('id')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle();
        if (existingSettingsError && existingSettingsError.code !== 'PGRST116') throw existingSettingsError;

        if (existingSettings?.id) {
          const { data, error } = await supabase
            .from('account_settings')
            .update(scopedAppConfig)
            .eq('id', existingSettings.id)
            .eq('user_id', userId)
            .select('*')
            .single();
          if (error) throw error;
          savedSettings = data;
        } else {
          const { data, error } = await supabase
            .from('account_settings')
            .insert(scopedAppConfig)
            .select('*')
            .single();
          if (error) throw error;
          savedSettings = data;
        }
      }

      setSettings(prev => ({
        ...prev,
        _business_id: normalizedBusinessId,
        id: savedSettings?.id || prev.id,
      }));

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

  const updatePreference = (section, field, value) => {
    setSettings(prev => ({
      ...prev,
      preferences: {
        ...(prev.preferences || {}),
        [section]: {
          ...((prev.preferences || {})[section] || {}),
          [field]: value,
        },
      },
    }));
  };

  const uploadBusinessAvatar = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      setError('Choose an image file for the business avatar.');
      return;
    }

    setBusinessAvatarUploading(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = authData?.user?.id;
      if (!userId) throw new Error('User not found');

      await ensureBusinessRecord({ createIfMissing: true });

      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${FORWARDING_API_BASE_URL}/api/sonar/business/avatar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authSession?.access_token}`,
        },
        body: formData,
      });
      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const payload = await response.json();
          message = payload?.detail || message;
        } catch {
          // Keep fallback status text.
        }
        throw new Error(message);
      }
      const payload = await response.json();
      const avatarUrl = payload?.avatar || payload?.business?.avatar || '';
      const businessId = payload?.business?.id;
      if (!avatarUrl) throw new Error('Avatar uploaded, but no public URL was returned.');

      setSettings(prev => ({
        ...prev,
        _business_id: businessId || prev._business_id,
        business_avatar: avatarUrl,
      }));
    } catch (err) {
      console.error('[SettingsPage] Failed to upload business avatar:', err);
      setError(err.message || 'Failed to upload business avatar.');
    } finally {
      setBusinessAvatarUploading(false);
      if (businessAvatarInputRef.current) businessAvatarInputRef.current.value = '';
    }
  };

  const settingsSections = [
    { id: 'business', title: 'Business Info', icon: Building2, iconClass: 'settings-icon', hint: 'Name, contact, and location' },
    { id: 'forwarding', title: 'Connections', icon: PhoneCall, iconClass: 'settings-icon', hint: 'Call routing' },
    { id: 'preferences', title: 'Preferences', icon: Shield, iconClass: 'settings-icon', hint: 'Call permissions and controls' },
    { id: 'intro', title: 'Intro Message', icon: MessageSquareText, iconClass: 'settings-icon', hint: 'Opening call greeting' },
    { id: 'appointments', title: 'Hours', icon: Calendar, iconClass: 'settings-icon', hint: 'Business availability' },
    { id: 'services', title: 'Services & Pricing', icon: Tag, iconClass: 'settings-icon', hint: 'Offer catalog and rates' },
    { id: 'knowledge', title: 'Knowledge Base', icon: BookOpen, iconClass: 'settings-icon', hint: 'Policies, FAQs, and context' },
  ];

  const activeSectionConfig = settingsSections.find(section => section.id === activeSection) || settingsSections[0];
  const ActiveSettingsIcon = activeSectionConfig.icon;

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'forwarding':
        return <BusinessForwardingSettings authSession={authSession} />;
      case 'intro':
        return (
          <>
            <div className="mb-4">
              <p className="text-[12px] text-zinc-500 leading-relaxed mb-1">
                The first thing callers hear when your AI receptionist picks up.
              </p>
            </div>
            <IntroMessageEditor
              value={settings.intro_message_prompt}
              onChange={(v) => update('intro_message_prompt', v)}
            />
          </>
        );
      case 'appointments':
        return (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock size={14} className="settings-icon" />
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Business Hours</span>
            </div>
            <div className="flex flex-col">
              {DAYS.map(day => (
                <DayHoursRow key={day} day={day} settings={settings} onChange={setSettings} />
              ))}
            </div>
          </div>
        );
      case 'services':
        return (
          <>
            <div className="mb-4">
              <p className="text-[12px] text-zinc-500 leading-relaxed">
                Your AI receptionist uses these to answer pricing questions and describe what you offer.
              </p>
            </div>
            <ServicesManager
              businessId={settings._business_id}
              ensureBusinessRecord={ensureBusinessRecord}
              onBusinessLinked={syncBusinessId}
            />
          </>
        );
      case 'knowledge':
        return (
          <>
            <div className="mb-4">
              <p className="text-[12px] text-zinc-500 leading-relaxed mb-1">
                Your AI receptionist reads these documents during calls. They contain your business story, policies, and common answers.
              </p>
              <p className="text-[11px] text-zinc-600 flex items-center gap-1.5">
                <Info size={11} className="settings-icon shrink-0" />
                Each tab has a ready-to-customize template.
              </p>
            </div>
            <KnowledgeBaseEditor
              value={settings.knowledge_base || {}}
              onChange={(v) => update('knowledge_base', v)}
            />
          </>
        );
      case 'preferences':
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/[0.05] bg-zinc-950/40 p-5">
              <div className="flex items-start justify-between gap-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Shield size={15} className="settings-icon" />
                    <h4 className="text-[13px] font-semibold text-zinc-100">Authenticate Callers</h4>
                    <span className="group relative inline-flex">
                      <button
                        type="button"
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/[0.12] text-[10px] font-bold text-zinc-500 transition-colors hover:border-white/30 hover:text-zinc-300 outline-none focus:outline-none focus-visible:outline-none"
                        aria-label="Caller authentication details"
                      >
                        i
                      </button>
                      <span className="pointer-events-none absolute bottom-6 left-1/2 z-20 hidden w-72 -translate-x-1/2 rounded-xl border border-white/[0.08] bg-zinc-950 px-3 py-2 text-[11px] font-normal leading-4 text-zinc-400 shadow-2xl shadow-black/40 group-hover:block group-focus-within:block">
                        If a caller's incoming phone number doesn't match the number on file, the receptionist will text a secure OTP verification link to confirm their identity before making any account changes. This helps protect customer accounts from unauthorized access.
                      </span>
                    </span>
                  </div>
                  <p className="mt-2 max-w-2xl text-[12px] leading-5 text-zinc-500">
                    Sends a secure text message with a one-time verification link to confirm the caller's identity.
                  </p>
                </div>
                <Toggle
                  value={settings.preferences?.calls?.allow_caller_authentication === true}
                  onChange={(value) => updatePreference('calls', 'allow_caller_authentication', value)}
                  color="cyan"
                />
              </div>
            </div>
          </div>
        );
      default:
        return (
          <>
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
            <Field label="Street Address">
              <TextInput value={settings.business_street} onChange={(v) => update('business_street', v)} placeholder="123 Main St" />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="City">
                <TextInput value={settings.business_city} onChange={(v) => update('business_city', v)} placeholder="City" />
              </Field>
              <Field label="State">
                <TextInput value={settings.business_state} onChange={(v) => update('business_state', v)} placeholder="ME" />
              </Field>
              <Field label="ZIP Code">
                <TextInput value={settings.business_zip} onChange={(v) => update('business_zip', v)} placeholder="04901" />
              </Field>
            </div>
          </>
        );
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#020202]">
        <div className="text-[11px] text-zinc-700 uppercase tracking-[0.3em] animate-pulse">Loading settings</div>
      </div>
    );
  }

  return (
    <div className="settings-page-scope h-full flex flex-col bg-[#020202] text-zinc-400 font-sans selection:bg-indigo-500/20 overflow-hidden">

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between border-b border-white/[0.02] bg-gradient-to-b from-zinc-950/20 to-transparent px-10 py-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-[1.875rem] font-semibold tracking-[-0.045em] text-white leading-none m-0">Settings</h2>
          <p className="text-[13px] text-zinc-500 m-0">Account &amp; business configuration</p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="settings-neutral-button relative flex min-w-[72px] items-center justify-center px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95"
        >
          <AnimatePresence mode="wait" initial={false}>
            {savedFlash ? (
              <motion.span
                key="saved-check"
                initial={{ opacity: 0, y: 4, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.92 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="settings-save-status-icon inline-flex items-center justify-center text-current"
              >
                <Check size={14} />
              </motion.span>
            ) : (
              <motion.span
                key={saving ? 'saving' : 'save'}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                {saving ? 'Saving...' : 'Save'}
              </motion.span>
            )}
          </AnimatePresence>
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
      <div className="flex-1 overflow-hidden px-8 py-6">
        <div className="mx-auto grid h-full max-w-6xl grid-cols-[260px_minmax(0,1fr)] gap-5">
          <aside className="rounded-[28px] border border-white/[0.05] bg-zinc-950/30 p-3">
            <nav className="space-y-1">
              {settingsSections.map(section => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full rounded-2xl px-4 py-3 text-left transition-all ${
                      isActive
                        ? 'bg-white/[0.06] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                        : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-200'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon size={16} className={section.iconClass} />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold tracking-[-0.02em]">{section.title}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-zinc-600">{section.hint}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="min-h-0 overflow-auto custom-scrollbar rounded-[28px] border border-white/[0.05] bg-gradient-to-b from-zinc-950/40 to-transparent p-6">
            <div className="mb-6 flex items-center justify-between gap-4 border-b border-white/[0.04] pb-5">
              <div className="flex min-w-0 items-center gap-3">
                <div>
                  <ActiveSettingsIcon size={18} className={activeSectionConfig.iconClass} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-3xl font-semibold tracking-[-0.045em] text-white leading-none">{activeSectionConfig.title}</h3>
                  <p className="mt-2 text-[13px] leading-5 text-zinc-600">{activeSectionConfig.hint}</p>
                </div>
              </div>
              {activeSection === 'business' && (
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => businessAvatarInputRef.current?.click()}
                    disabled={businessAvatarUploading || saving}
                    className="group/avatar relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/[0.07] bg-white/[0.025] transition hover:border-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Upload business avatar"
                  >
                    {settings.business_avatar ? (
                      <img src={settings.business_avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[13px] font-semibold text-zinc-500">
                        {(settings.business_name || 'B').trim().slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/85 text-white opacity-0 transition-opacity duration-200 group-hover/avatar:opacity-100 group-focus-visible/avatar:opacity-100">
                      <Upload size={16} />
                    </span>
                    {businessAvatarUploading && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/75 text-[8px] font-bold uppercase tracking-widest text-zinc-300">
                        ...
                      </span>
                    )}
                  </button>
                  <input
                    ref={businessAvatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={businessAvatarUploading || saving}
                    onChange={(event) => uploadBusinessAvatar(event.target.files?.[0])}
                  />
                </div>
              )}
            </div>
            {renderSectionContent()}
          </section>
        </div>
      </div>

      <div className="hidden">
        <div className="max-w-3xl mx-auto flex flex-col gap-4">

          {/* ── Business Info ────────────────────────────────────────────── */}
          <Section title="Business Info" icon={Building2} color="bg-white/[0.04] text-white" defaultOpen={true}>
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
            <Field label="Street Address">
              <TextInput value={settings.business_street} onChange={(v) => update('business_street', v)} placeholder="123 Main St" />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="City">
                <TextInput value={settings.business_city} onChange={(v) => update('business_city', v)} placeholder="City" />
              </Field>
              <Field label="State">
                <TextInput value={settings.business_state} onChange={(v) => update('business_state', v)} placeholder="ME" />
              </Field>
              <Field label="ZIP Code">
                <TextInput value={settings.business_zip} onChange={(v) => update('business_zip', v)} placeholder="04901" />
              </Field>
            </div>
          </Section>

          {/* ── Intro Message ─────────────────────────────────────────────── */}
          <Section title="Intro Message" icon={MessageSquareText} color="bg-white/[0.04] text-white" defaultOpen={true}>
            <div className="mb-4">
              <p className="text-[12px] text-zinc-500 leading-relaxed mb-1">
                The first thing callers hear when your AI receptionist picks up.
              </p>
            </div>
            <IntroMessageEditor
              value={settings.intro_message_prompt}
              onChange={(v) => update('intro_message_prompt', v)}
            />
          </Section>

          {/* ── Calendar & Appointments ──────────────────────────────────── */}
          <Section title="Calendar & Appointments" icon={Calendar} color="bg-white/[0.04] text-white" defaultOpen={true}>
            <div className="border-t border-white/[0.03] pt-5 mt-1">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={14} className="settings-icon" />
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
          {/* ── Services & Pricing ──────────────────────────────────────── */}
          <Section title="Services & Pricing" icon={Tag} color="bg-white/[0.04] text-white" defaultOpen={true}>
            <div className="mb-4">
              <p className="text-[12px] text-zinc-500 leading-relaxed">
                Your AI receptionist uses these to answer pricing questions and describe what you offer.
              </p>
            </div>

            <ServicesManager
              businessId={settings._business_id}
              ensureBusinessRecord={ensureBusinessRecord}
              onBusinessLinked={syncBusinessId}
            />
          </Section>

          {/* ── Knowledge Base ──────────────────────────────────────────── */}
          <Section title="Knowledge Base" icon={BookOpen} color="bg-white/[0.04] text-white" defaultOpen={true}>
            <div className="mb-4">
              <p className="text-[12px] text-zinc-500 leading-relaxed mb-1">
                Your AI receptionist reads these documents during calls. They contain everything it needs to know about your business — your story, services, pricing, policies, and common answers.
              </p>
              <p className="text-[11px] text-zinc-600 flex items-center gap-1.5">
                <Info size={11} className="settings-icon shrink-0" />
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
