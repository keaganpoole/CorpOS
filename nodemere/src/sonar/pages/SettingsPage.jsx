import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Building2, Phone, Bell, Calendar,
  Check, ChevronDown, ChevronUp, Sun, Moon,
  BookOpen, FileText, Shield, HelpCircle, Sparkles,
  Eye, EyeOff, Lightbulb, Zap, Star, Info,
  Copy, Download, Layers, Plus, Trash2, Tag, DollarSign,
  ArrowRight, X, MessageSquareText, Users, Maximize2, Wand2,
  CalendarClock, Mail, PhoneCall, ListChecks, Upload, CalendarCheck, Pencil,
  Loader2, CreditCard, ExternalLink,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../lib/api';
import ForwardNumberModal, { FORWARDING_API_BASE_URL } from '../components/ForwardNumberModal';
import CubePreloader from '../components/CubePreloader';
import ModalSpectrumLine from '../../components/ModalSpectrumLine';
import {
  allBusinessBriefSections,
  allIndustryExampleValues,
  buildBusinessBriefSection,
  buildFullBusinessBrief,
  formatBusinessBriefTemplate,
  generatedBusinessBriefPlaceholders,
  getBusinessBriefSections,
  getBusinessBriefTemplateVariants,
  getFaqExamples,
  getIndustryExample,
  LONG_TEXT_LIMIT_VALUE,
  normalizeBusinessBriefPlaceholder,
} from '../../data/onboardingKnowledgeTemplates';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SCHEDULE_LAYER_TYPES = [
  { id: 'business', label: 'Business Hours', color: '#06b6d4', gradient: 'from-cyan-500 to-blue-600', glow: '0 0 16px rgba(6, 182, 212, 0.4)' },
  { id: 'inbound', label: 'Inbound Calls', color: '#14b8a6', gradient: 'from-teal-400 to-emerald-500', glow: '0 0 16px rgba(20, 184, 166, 0.4)' },
  { id: 'outbound', label: 'Outbound Calls', color: '#f97316', gradient: 'from-orange-400 to-red-500', glow: '0 0 16px rgba(249, 115, 22, 0.38)' },
];
const COLORBLIND_SCHEDULE_LAYER_TYPES = [
  { id: 'business', label: 'Business Hours', color: '#0072b2', gradient: 'from-[#0072b2] to-[#56b4e9]', glow: '0 0 16px rgba(0, 114, 178, 0.36)' },
  { id: 'inbound', label: 'Inbound Calls', color: '#009e73', gradient: 'from-[#009e73] to-[#66c2a5]', glow: '0 0 16px rgba(0, 158, 115, 0.36)' },
  { id: 'outbound', label: 'Outbound Calls', color: '#d55e00', gradient: 'from-[#d55e00] to-[#e69f00]', glow: '0 0 16px rgba(213, 94, 0, 0.36)' },
];
const getScheduleLayerTypes = (colorblindMode = false) => colorblindMode ? COLORBLIND_SCHEDULE_LAYER_TYPES : SCHEDULE_LAYER_TYPES;
const OUTBOUND_LATE_HOURS_TERMS_KEY = 'outbound_late_hours_acknowledgment_v1';
const OUTBOUND_LATE_HOURS_START = 20;
const OUTBOUND_LATE_HOURS_END = 8;

const hasAcceptedOutboundLateHoursTerms = (profile) => (
  profile?.terms_of_service?.[OUTBOUND_LATE_HOURS_TERMS_KEY]?.accepted === true
);

const isOutboundLateHoursLayer = (layer) => (
  Boolean(layer?.enabled)
  && (Number(layer.start) < OUTBOUND_LATE_HOURS_END || Number(layer.end) >= OUTBOUND_LATE_HOURS_START)
);
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
  industry: '',
  industry_details: {},
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
  preferences: {
    general: {
      show_setup_guide: true,
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

const ONBOARDING_SERVICE_UNITS = [
  { value: 'session', label: 'Session' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const serviceDescriptionMagicTemplate = (serviceName, industry) => {
  const example = getIndustryExample(industry || 'Other General Business');
  const name = String(serviceName || '').trim() || example.serviceName;
  return example.serviceDescription(name);
};

const formatOnboardingServicePrice = (service) => {
  const unit = service.unit ? ` / ${service.unit}` : '';
  if (service.price_type === 'free') return 'Free';
  if (service.price_type === 'quote') return 'Quote required';
  if (service.price_type === 'range') return `$${service.price_min || 0} - $${service.price_max || 0}${unit}`;
  if (service.price_type === 'starting_at') return `From $${service.price_min || 0}${unit}`;
  return service.price_min ? `$${service.price_min}${unit}` : 'Price not set';
};

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

const timeToDecimalHour = (value, fallback = 9) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hours = Math.max(0, Math.min(23, Number(match[1])));
  const minutes = Math.max(0, Math.min(59, Number(match[2])));
  return hours + (minutes / 60);
};

const decimalHourToTime = (value) => {
  const totalMinutes = Math.round(Number(value || 0) * 60);
  const hours = Math.max(0, Math.min(24, Math.floor(totalMinutes / 60)));
  const minutes = hours === 24 ? 0 : Math.max(0, Math.min(59, totalMinutes % 60));
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const isStructuredBusinessHours = (value) => (
  value?.schema_version === 1
  && value?.timeline
  && value?.days
  && DAYS.every((day) => SCHEDULE_LAYER_TYPES.every(({ id }) => value.days[day]?.layers?.[id]))
);

const createStructuredBusinessHours = (flatHours = null) => ({
  schema_version: 1,
  timeline: { start: 0, end: 24 },
  days: DAYS.reduce((acc, day) => {
    const hours = flatHours?.[day] || {};
    const enabled = typeof hours.enabled === 'boolean' ? hours.enabled : !['Saturday', 'Sunday'].includes(day);
    const open = hours.open || '09:00';
    const close = hours.close || '17:00';
    const start = timeToDecimalHour(open, 9);
    const end = Math.max(start + 0.25, timeToDecimalHour(close, 17));
    acc[day] = {
      enabled,
      layers: {
        business: { enabled, start, end: Math.min(24, end) },
        inbound: { enabled, start, end: Math.min(24, end) },
        outbound: { enabled, start, end: Math.min(24, end) },
      },
    };
    return acc;
  }, {}),
});

const cleanStructuredBusinessHours = (businessHours) => {
  const defaults = createStructuredBusinessHours();
  const source = businessHours?.schema_version === 1 && businessHours?.days
    ? businessHours
    : createStructuredBusinessHours(businessHours);
  return {
    schema_version: 1,
    timeline: { start: 0, end: 24 },
    days: DAYS.reduce((acc, day) => {
      const dayValue = source.days?.[day] || defaults.days[day];
      acc[day] = {
        enabled: Boolean(dayValue.enabled),
        layers: SCHEDULE_LAYER_TYPES.reduce((layers, { id }) => {
          const fallbackLayer = defaults.days[day].layers[id];
          const layer = dayValue.layers?.[id] || fallbackLayer;
          const start = Number(layer.start);
          const end = Number(layer.end);
          layers[id] = {
            enabled: Boolean(layer.enabled),
            start: Number.isFinite(start) ? Math.max(0, Math.min(23.75, start)) : fallbackLayer.start,
            end: Number.isFinite(end) ? Math.max(0.25, Math.min(24, end)) : fallbackLayer.end,
          };
          if (layers[id].end <= layers[id].start) {
            layers[id].end = Math.min(24, layers[id].start + 0.25);
          }
          return layers;
        }, {}),
      };
      return acc;
    }, {}),
  };
};

const formatScheduleTime = (decimalHours) => {
  const totalMinutes = Math.round(Number(decimalHours || 0) * 60) % (24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
};

const formatScheduleDuration = (decimalHours) => {
  const minutes = Math.round(Number(decimalHours || 0) * 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ''}` : `${remainder}m`;
};

const formatWeeklyHours = (hours) => {
  const rounded = Math.round(Number(hours || 0) * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}h`;
};

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

const STAFF_NAME_PATTERN = /[^a-zA-Z\s.'-]/g;
const STAFF_ROLE_PATTERN = /[^a-zA-Z0-9\s&/.,'-]/g;

const maskStaffName = (value) => String(value || '').replace(STAFF_NAME_PATTERN, '').replace(/\s{2,}/g, ' ');
const maskStaffRole = (value) => String(value || '').replace(STAFF_ROLE_PATTERN, '').replace(/\s{2,}/g, ' ');
const maskStaffEmail = (value) => String(value || '').toLowerCase().replace(/\s/g, '').replace(/[^a-z0-9._%+-@]/g, '');
const isValidStaffEmail = (value) => {
  const email = String(value || '').trim();
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
};
const maskStaffPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const staffInputClass = 'h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-white outline-none ring-0 transition placeholder:text-zinc-700 focus:border-white/[0.16] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0';

const createStaffFormState = (staff, baseHours = null) => ({
  id: staff?.id || null,
  full_name: maskStaffName(staff?.full_name || ''),
  first_name: maskStaffName(staff?.first_name || ''),
  last_name: maskStaffName(staff?.last_name || ''),
  role: maskStaffRole(staff?.role || ''),
  email: maskStaffEmail(staff?.email || ''),
  phone: maskStaffPhone(staff?.phone || ''),
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
      className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-all ${value ? 'bg-zinc-100/90 shadow-[0_0_10px_rgba(244,244,245,0.16)]' : 'bg-zinc-800 border border-white/[0.06]'}`}
      aria-pressed={value}
    >
      <div
        className={`h-4 w-4 rounded-full transition-transform ${value ? 'bg-zinc-900' : 'bg-white'}`}
        style={{ transform: value ? 'translateX(16px)' : 'translateX(0px)' }}
      />
    </button>
  );
};

const LateHoursTermsModal = ({ isSaving = false, onAccept, onClose }) => {
  const [secondsRemaining, setSecondsRemaining] = useState(10);
  const canAccept = secondsRemaining === 0 && !isSaving;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
    >
      <motion.section
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-[560px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0a0a0a] shadow-[0_28px_90px_rgba(0,0,0,0.6)]"
      >
        <div className="border-b border-white/[0.06] px-7 py-6">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-300/80">Outbound calling notice</p>
              <h2 className="mt-2 text-[22px] font-black tracking-[-0.04em] text-white">Late-hours calling</h2>
            </div>
            <button type="button" onClick={onClose} className="mt-0.5 text-zinc-600 transition hover:text-white" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="px-7 py-6">
          <p className="text-sm leading-6 text-zinc-300">
            Calling customers outside normal business hours may lead to complaints, lower answer rates, and could be subject to local telemarketing or consumer protection regulations. Only enable overnight calling if it fits your business, you have appropriate customer consent, and you're confident it complies with applicable laws.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] px-7 py-5">
          <button type="button" onClick={onClose} className="h-10 rounded-full px-6 text-sm font-medium text-zinc-500 transition hover:text-white">
            Review schedule
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={!canAccept}
            className={`flex h-10 min-w-[168px] items-center justify-center gap-2 rounded-full px-6 text-sm font-bold transition disabled:cursor-wait ${
              canAccept
                ? 'bg-white text-black hover:bg-zinc-200'
                : 'border border-white/[0.08] bg-white/[0.04] text-zinc-500'
            }`}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>
                <span>Yes, I accept</span>
                {secondsRemaining > 0 ? <span className="text-[11px] text-zinc-500">({secondsRemaining})</span> : null}
              </>
            )}
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
};

const SettingsScheduleBuilder = ({ value, onChange, outboundLateHoursAccepted, onOutboundLateHours }) => {
  const dragPreviewRef = useRef(null);
  const [snapMinutes, setSnapMinutes] = useState(15);
  const [visibleLayers, setVisibleLayers] = useState({ business: true, inbound: true, outbound: true });
  const [colorblindMode, setColorblindMode] = useState(false);
  const [drag, setDrag] = useState(null);
  const [hoveredBar, setHoveredBar] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [notice, setNotice] = useState('');
  const schedule = cleanStructuredBusinessHours(value);
  const activeLayerTypes = getScheduleLayerTypes(colorblindMode);
  const timelineHours = 24;

  const weeklyTotals = (() => {
    const totals = { business: 0, inbound: 0, outbound: 0 };
    DAYS.forEach((day) => {
      const dayValue = schedule.days[day];
      if (!dayValue?.enabled) return;
      SCHEDULE_LAYER_TYPES.forEach(({ id }) => {
        const layer = dayValue.layers[id];
        if (layer?.enabled) totals[id] += Math.max(0, Number(layer.end) - Number(layer.start));
      });
    });
    return { coverage: totals.business, ...totals };
  })();

  const updateSchedule = (updater) => {
    const next = typeof updater === 'function' ? updater(schedule) : updater;
    onChange(cleanStructuredBusinessHours(next));
  };

  const updateLayer = (day, layerId, nextLayer) => {
    updateSchedule((current) => ({
      ...current,
      days: {
        ...current.days,
        [day]: {
          ...current.days[day],
          layers: { ...current.days[day].layers, [layerId]: nextLayer },
        },
      },
    }));
  };

  const handlePointerDown = (event, day, layerId, handle) => {
    const layer = schedule.days[day].layers[layerId];
    if (!schedule.days[day].enabled || !layer.enabled) return;
    event.preventDefault();
    dragPreviewRef.current = { day, layerId, layer };
    setDrag({ day, layerId, handle, startX: event.clientX, startValue: handle === 'left' ? layer.start : handle === 'right' ? layer.end : layer.start });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  useEffect(() => {
    if (!drag) return undefined;
    const handleMove = (event) => {
      const track = document.querySelector(`[data-settings-schedule-track="${drag.day}"]`);
      if (!track) return;
      const width = track.getBoundingClientRect().width;
      const delta = ((event.clientX - drag.startX) / width) * timelineHours;
      const snap = snapMinutes / 60;
      const layer = schedule.days[drag.day].layers[drag.layerId];
      const duration = layer.end - layer.start;
      let start = layer.start;
      let end = layer.end;
      if (drag.handle === 'left') start = Math.round((drag.startValue + delta) / snap) * snap;
      if (drag.handle === 'right') end = Math.round((drag.startValue + delta) / snap) * snap;
      if (drag.handle === 'center') {
        start = Math.round((drag.startValue + delta) / snap) * snap;
        end = start + duration;
      }
      start = Math.max(0, Math.min(start, 24 - snap));
      end = Math.max(start + snap, Math.min(end, 24));
      if (drag.handle === 'center') {
        end = Math.min(24, start + duration);
        start = end - duration;
      }
      const nextLayer = { ...layer, start, end };
      dragPreviewRef.current = { day: drag.day, layerId: drag.layerId, layer: nextLayer };
      updateLayer(drag.day, drag.layerId, nextLayer);
    };
    const stop = () => {
      const preview = dragPreviewRef.current;
      if (
        preview?.layerId === 'outbound'
        && !outboundLateHoursAccepted
        && isOutboundLateHoursLayer(preview.layer)
      ) {
        onOutboundLateHours?.();
      }
      dragPreviewRef.current = null;
      setDrag(null);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stop);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', stop);
    };
  }, [drag, schedule, snapMinutes, onOutboundLateHours, outboundLateHoursAccepted]);

  const copyDay = (sourceDay) => {
    const source = schedule.days[sourceDay];
    updateSchedule((current) => ({
      ...current,
      days: Object.fromEntries(DAYS.map((day) => [day, {
        ...current.days[day],
        layers: Object.fromEntries(SCHEDULE_LAYER_TYPES.map(({ id }) => [id, { ...source.layers[id] }])),
      }])),
    }));
    setNotice(`${sourceDay} copied to all days`);
  };

  const exportSchedule = () => {
    const blob = new Blob([JSON.stringify(schedule, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nodemere-schedule.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const openImportModal = () => {
    setImportText('');
    setNotice('');
    setImportModalOpen(true);
  };

  const importSchedule = () => {
    try {
      const parsed = JSON.parse(importText);
      if (!isStructuredBusinessHours(parsed)) throw new Error('This file does not contain a complete schedule.');
      onChange(cleanStructuredBusinessHours(parsed));
      setImportModalOpen(false);
      setImportText('');
      setNotice('Schedule imported');
    } catch (error) {
      setNotice(error.message || 'Could not import that schedule.');
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium text-zinc-500"><Layers className="h-3.5 w-3.5" /> Layers:</span>
          {activeLayerTypes.map((layer) => (
            <button key={layer.id} type="button" onClick={() => setVisibleLayers((current) => ({ ...current, [layer.id]: !current[layer.id] }))} className={`flex items-center gap-1.5 text-[11px] font-medium transition ${visibleLayers[layer.id] ? 'text-zinc-300' : 'text-zinc-700'}`}>
              <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${layer.gradient} ${visibleLayers[layer.id] ? '' : 'opacity-30'}`} />{layer.label}
            </button>
          ))}
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span>Snap</span>
            <select value={snapMinutes} onChange={(event) => setSnapMinutes(Number(event.target.value))} className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 text-[11px] font-semibold text-white outline-none">
              {[5, 15, 30, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setColorblindMode((current) => !current)} className={`relative flex h-8 w-8 items-center justify-center rounded-lg border transition ${colorblindMode ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' : 'border-white/[0.07] bg-white/[0.025] text-zinc-500 hover:border-white/[0.14] hover:text-white'}`} aria-label="Colorblind-friendly colors" title="Colorblind-friendly colors">
            <Eye className="h-4 w-4" />
            <span className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[conic-gradient(from_90deg,#0072b2,#009e73,#d55e00,#56b4e9,#0072b2)] ring-1 ring-black/30" />
          </button>
          <button type="button" onClick={openImportModal} className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 text-[11px] font-medium text-zinc-500 transition hover:border-white/[0.14] hover:text-white"><FileText className="h-3.5 w-3.5" /> Import</button>
          <button type="button" onClick={exportSchedule} className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 text-[11px] font-medium text-zinc-500 transition hover:border-white/[0.14] hover:text-white"><Download className="h-3.5 w-3.5" /> Export</button>
        </div>
      </div>
      <AnimatePresence>
        {importModalOpen ? (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-xl rounded-2xl border border-white/[0.08] bg-[#080808] p-5 shadow-2xl"
              initial={{ y: 18, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 18, scale: 0.98, opacity: 0 }}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Import schedule</h3>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">Paste the exported schedule text below.</p>
                </div>
                <button type="button" onClick={() => setImportModalOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/10 hover:text-white" aria-label="Close import schedule">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                className="h-64 w-full resize-none rounded-xl border border-white/[0.08] bg-black/50 p-3 font-mono text-xs text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-white/[0.18]"
                placeholder=""
              />
              <div className="mt-4 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setImportModalOpen(false)} className="h-9 rounded-lg border border-white/[0.07] px-3 text-xs font-semibold text-zinc-400 transition hover:border-white/[0.14] hover:text-white">Cancel</button>
                <button type="button" onClick={importSchedule} className="h-9 rounded-lg bg-white px-3 text-xs font-semibold text-black transition hover:bg-zinc-200">Import schedule</button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="space-y-4 rounded-[22px] border border-white/[0.06] bg-black/20 p-4 sm:p-5">
        <div className="flex pl-32 pr-12 text-[11px] font-mono text-zinc-600">
          <div className="relative h-5 flex-1 select-none">{[0, 4, 8, 12, 16, 20, 24].map((hour) => <span key={hour} className="absolute -translate-x-1/2" style={{ left: `${(hour / timelineHours) * 100}%` }}>{formatScheduleTime(hour)}</span>)}</div>
        </div>

        <div className="space-y-1.5">
          {DAYS.map((day) => {
            const dayValue = schedule.days[day];
            return (
              <div key={day} className={`group relative flex items-center rounded-xl border px-3 py-2 transition-all duration-200 ${dayValue.enabled ? 'border-white/[0.06] bg-white/[0.018] hover:bg-white/[0.035]' : 'border-transparent bg-black/20 opacity-50 hover:opacity-75'}`}>
                <div className="flex w-28 shrink-0 items-center gap-2.5">
                  <button type="button" onClick={() => updateSchedule((current) => ({ ...current, days: { ...current.days, [day]: { ...current.days[day], enabled: !current.days[day].enabled } } }))} className={`flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ${dayValue.enabled ? 'bg-zinc-100/90 shadow-[0_0_10px_rgba(244,244,245,0.16)]' : 'bg-zinc-800'}`} aria-label={`Toggle ${day}`}><span className={`block h-3 w-3 rounded-full shadow-md transition-transform duration-200 ${dayValue.enabled ? 'translate-x-3 bg-zinc-900' : 'translate-x-0 bg-white'}`} /></button>
                  <span className={`text-xs font-semibold uppercase tracking-wider ${dayValue.enabled ? 'text-zinc-200' : 'text-zinc-500'}`}>{day.slice(0, 3)}</span>
                </div>
                <div data-settings-schedule-track={day} className="relative mx-2 flex h-14 min-w-0 flex-1 items-center">
                  <div className="pointer-events-none absolute inset-0 flex justify-between opacity-10">{Array.from({ length: timelineHours + 1 }).map((_, index) => <span key={index} className="h-full w-px bg-white/40" />)}</div>
                  <div className="relative flex w-full flex-col gap-1.5 py-1">
                    {activeLayerTypes.map((layerType) => {
                      const layer = dayValue.layers[layerType.id];
                      const left = Math.max(0, Math.min(100, (layer.start / timelineHours) * 100));
                      const width = Math.max(0, Math.min(100 - left, ((layer.end - layer.start) / timelineHours) * 100));
                      const barKey = `${day}-${layerType.id}`;
                      const isActiveBar = drag?.day === day && drag?.layerId === layerType.id;
                      const isHovered = hoveredBar === barKey;
                      const isDimmed = drag && !isActiveBar;
                      if (!visibleLayers[layerType.id]) return <div key={layerType.id} className="h-2.5" />;
                      return (
                        <div key={layerType.id} className="group/bar relative h-2.5 w-full" onMouseEnter={() => setHoveredBar(barKey)} onMouseLeave={() => setHoveredBar(null)}>
                          <div className="absolute inset-y-0 left-0 right-0 overflow-hidden rounded-full border border-white/[0.03] bg-white/[0.04]" />
                          {dayValue.enabled && layer.enabled ? (
                            <div className={`absolute inset-y-0 select-none rounded-full bg-gradient-to-r ${layerType.gradient} cursor-grab transition-all duration-75 active:cursor-grabbing ${isActiveBar ? 'z-20 scale-y-110 ring-2 ring-white/50' : 'z-10'} ${isDimmed ? 'opacity-30' : 'opacity-100'} ${isHovered ? 'brightness-125 shadow-lg' : ''}`} style={{ left: `${left}%`, width: `${width}%`, boxShadow: isActiveBar || isHovered ? layerType.glow : 'none' }} onPointerDown={(event) => handlePointerDown(event, day, layerType.id, 'center')}>
                              <button type="button" aria-label={`Move ${layerType.label} start`} onPointerDown={(event) => { event.stopPropagation(); handlePointerDown(event, day, layerType.id, 'left'); }} className="absolute left-0 top-1/2 z-30 flex h-4 w-3 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white opacity-0 shadow-md transition-all hover:scale-125 group-hover/bar:opacity-100"><span className="h-2 w-0.5 rounded-full bg-zinc-600" /></button>
                              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-30"><span className="h-0.5 w-4 rounded-full bg-white/60" /></div>
                              <button type="button" aria-label={`Move ${layerType.label} end`} onPointerDown={(event) => { event.stopPropagation(); handlePointerDown(event, day, layerType.id, 'right'); }} className="absolute right-0 top-1/2 z-30 flex h-4 w-3 translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white opacity-0 shadow-md transition-all hover:scale-125 group-hover/bar:opacity-100"><span className="h-2 w-0.5 rounded-full bg-zinc-600" /></button>
                            </div>
                          ) : null}
                          {dayValue.enabled && layer.enabled && (isHovered || isActiveBar) ? (
                            <div className="pointer-events-none absolute -top-7 z-30 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/[0.08] bg-[#111] px-2 py-0.5 font-mono text-[11px] text-zinc-100 shadow-2xl" style={{ left: `${Math.min(92, Math.max(8, left + (width / 2)))}%` }}>
                              <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: layerType.color }} />
                              <span className="font-semibold text-white">{formatScheduleTime(layer.start)}</span>
                              <span className="px-1 text-zinc-500">-</span>
                              <span className="font-semibold text-white">{formatScheduleTime(layer.end)}</span>
                              <span className="ml-1.5 rounded bg-white/10 px-1 text-[10px] text-zinc-400">{formatScheduleDuration(layer.end - layer.start)}</span>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex w-10 shrink-0 justify-end opacity-0 transition-opacity group-hover:opacity-100">
                  <button type="button" onClick={() => copyDay(day)} className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-white" aria-label={`Copy ${day} schedule to all days`}><Copy className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex min-h-[48px] items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.018] px-4 text-[11px] text-zinc-500">
          <div className="flex flex-wrap items-center gap-4">
            {activeLayerTypes.map((layer) => (
              <span key={layer.id} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: layer.color }} />
                <span>{layer.label.replace(' Hours', '')}: <strong className="ml-1 text-white">{formatWeeklyHours(weeklyTotals[layer.id])}</strong></span>
              </span>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-zinc-600">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-zinc-600 text-[9px] font-bold">i</span>
            <span>Drag handles or entire bar to resize and adjust schedules.</span>
          </div>
        </div>
      </div>
      {notice ? <div className="px-1 text-right text-[10px] text-emerald-300">{notice}</div> : null}
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
            ? 'border-transparent bg-zinc-100/90 shadow-[0_0_10px_rgba(244,244,245,0.16)]'
            : 'border-white/[0.08] bg-black/30'
        }`}
        aria-label={value.enabled ? `Disable ${day}` : `Enable ${day}`}
      >
        <div
          className={`h-4 w-4 rounded-full transition-transform ${
            value.enabled
              ? 'translate-x-4 bg-zinc-900'
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

const SettingsServiceInfoModal = ({ title, intro, points, footer, onClose, dense = false, maxWidthClass = 'max-w-[620px]' }) => (
  <motion.div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
    <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }} transition={{ duration: 0.18 }} className={`relative w-full ${maxWidthClass} overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#070707] shadow-[0_28px_90px_rgba(0,0,0,0.62)]`} onMouseDown={(event) => event.stopPropagation()}>
      <ModalSpectrumLine variant="tips" />
      <div className="pointer-events-none absolute right-[-140px] top-[-180px] h-72 w-72 rounded-full bg-white/[0.035] blur-[72px]" />
      <div className="p-7 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="relative">
            <div className="mb-3 flex items-center gap-1.5"><Lightbulb className="h-4 w-4 shrink-0 -translate-y-[5px] text-zinc-600" aria-hidden="true" /><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-600">Tips</p></div>
            <h2 className="text-xl font-semibold tracking-[-0.04em] text-white sm:text-2xl">{title}</h2>
            {intro ? <p className="mt-3 max-w-[520px] text-sm leading-6 text-zinc-500">{intro}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center text-zinc-600 transition hover:text-white" aria-label={`Close ${title}`}><X size={16} /></button>
        </div>
        {points?.length ? <div className={`mt-7 text-sm text-zinc-400 ${dense ? 'space-y-1 leading-5' : 'space-y-4 leading-6'}`}>
          {points.map((point, index) => <div key={point.title} className="flex gap-3"><span className={`${dense ? 'mt-2 h-1 w-1' : 'mt-2 h-1.5 w-1.5'} shrink-0 rounded-full bg-white`} style={{ opacity: Math.max(0.35, 1 - (index * 0.14)) }} /><p><span className="font-semibold text-white">{point.title}</span> {point.body}</p></div>)}
        </div> : null}
        {footer ? <div className="relative mt-7 border-t border-white/[0.06] pt-5"><p className="max-w-[520px] text-[13px] leading-6 text-zinc-500">{footer}</p></div> : null}
      </div>
    </motion.div>
  </motion.div>
);

const SettingsServiceModal = ({ initialService, industry, onClose, onSave }) => {
  const [serviceDetailsHelpOpen, setServiceDetailsHelpOpen] = useState(false);
  const [descriptionHelpOpen, setDescriptionHelpOpen] = useState(false);
  const [descriptionEditorOpen, setDescriptionEditorOpen] = useState(false);
  const [draft, setDraft] = useState({
    ...(initialService || { name: '', description: '', price_min: '', unit: 'session', is_active: true }),
    price_type: 'fixed',
    price_max: '',
    unit: initialService?.unit === 'per session' ? 'session' : initialService?.unit || 'session',
    is_active: true,
  });
  const exampleService = getIndustryExample(industry || 'Other General Business');
  const magicDescription = serviceDescriptionMagicTemplate(draft.name, industry);
  const magicDescriptionEnabled = draft.description === magicDescription;
  const setDraftValue = (key, nextValue) => setDraft((prev) => ({ ...prev, [key]: nextValue }));
  const toggleMagicDescription = () => setDraft((prev) => ({ ...prev, description: prev.description === serviceDescriptionMagicTemplate(prev.name, industry) ? '' : serviceDescriptionMagicTemplate(prev.name, industry) }));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-xl">
      <motion.section initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.98 }} className="w-full max-w-[720px] overflow-visible rounded-[30px] border border-white/[0.08] bg-[#070707] shadow-[0_28px_90px_rgba(0,0,0,0.62)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] px-6 py-5">
          <div><h2 className="text-xl font-semibold tracking-[-0.04em] text-white">{initialService ? 'Edit service' : 'Create service'}</h2><p className="mt-1 text-sm leading-6 text-zinc-500">Add a service customers can ask about or book.</p></div>
          <button type="button" onClick={onClose} className="p-0 text-zinc-600 transition hover:text-white" aria-label="Close service modal"><X className="h-5 w-5" /></button>
        </div>
        <div className="custom-scrollbar max-h-[calc(100vh-170px)] overflow-y-auto px-6 py-7 sm:px-8">
          <div className="space-y-6">
            <div className="border-b border-white/[0.05] pb-6">
              <div className="mb-1.5 flex items-baseline gap-1.5"><p className="text-[10px] font-bold uppercase leading-none tracking-[0.22em] text-zinc-600">Billing unit</p><button type="button" onClick={() => setServiceDetailsHelpOpen(true)} className="inline-flex h-3.5 w-3.5 shrink-0 translate-y-[1px] items-center justify-center text-zinc-600 transition hover:text-zinc-300" aria-label="Service details help"><Lightbulb className="h-3 w-3" /></button></div>
              <div className="space-y-5">
                <div className="custom-scrollbar flex min-w-0 items-center overflow-x-auto pb-1" aria-label="Billing unit">
                  {ONBOARDING_SERVICE_UNITS.map((option, index) => { const active = draft.unit === option.value; return <div key={option.value} className="flex shrink-0 items-center">{index > 0 ? <span className="h-3 w-px bg-white/[0.10]" /> : null}<button type="button" aria-pressed={active} onClick={() => setDraftValue('unit', option.value)} className={`${index === 0 ? 'pr-3' : 'px-3'} bg-transparent text-[10px] font-semibold leading-[1.7] whitespace-nowrap transition ${active ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'}`}>{option.label}</button></div>; })}
                </div>
                <Field label="Service name"><input type="text" value={draft.name} onChange={(event) => setDraftValue('name', event.target.value)} placeholder={`e.g., ${exampleService.serviceName}`} autoFocus className={settingsFieldClass} /></Field>
                <Field label={<span className="flex items-center gap-2"><span>Description</span><button type="button" onClick={() => setDescriptionHelpOpen(true)} className="flex h-5 w-5 shrink-0 items-center justify-center text-zinc-600 transition hover:text-zinc-300" aria-label="Service description help"><Lightbulb className="h-3.5 w-3.5" /></button><button type="button" onClick={toggleMagicDescription} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition ${magicDescriptionEnabled ? 'bg-white/[0.05] text-white shadow-[0_0_6px_rgba(255,255,255,0.10)]' : 'text-zinc-600 hover:text-zinc-300'}`} aria-pressed={magicDescriptionEnabled} aria-label="Use suggested service description"><Wand2 className="h-3.5 w-3.5" /></button></span>}>
                  <div className="relative"><button type="button" onClick={() => setDescriptionEditorOpen(true)} className="absolute right-7 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] bg-[#0b0b0b]/90 text-zinc-600 transition hover:border-white/[0.12] hover:text-zinc-300" aria-label="Enlarge service description"><Maximize2 className="h-3.5 w-3.5" /></button><textarea value={draft.description} onChange={(event) => setDraftValue('description', event.target.value)} placeholder="Describe what this service includes and what customers should expect." rows={5} className={`${settingsFieldClass} h-[168px] resize-none py-4 pr-16 leading-6`} /></div>
                </Field>
                <Field label="Price"><input type="text" inputMode="decimal" value={draft.price_min ?? ''} onChange={(event) => setDraftValue('price_min', String(event.target.value).replace(/[^\d.]/g, '').replace(/(\.\d{2}).*$/, '$1'))} placeholder="e.g., 49.99" className={settingsFieldClass} /></Field>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-white/[0.05] px-6 py-5"><button type="button" onClick={onClose} className="h-11 rounded-full px-8 text-sm font-normal text-zinc-500 transition hover:text-white">Cancel</button><button type="button" onClick={() => onSave(draft)} disabled={!draft.name.trim()} className="flex h-11 min-w-[170px] items-center justify-center gap-2 rounded-full bg-white px-8 text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"><Check className="h-4 w-4" /><span>Save service</span></button></div>
      </motion.section>
      <AnimatePresence>
        {descriptionEditorOpen ? <motion.div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setDescriptionEditorOpen(false)}><motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }} transition={{ duration: 0.18 }} className="w-full max-w-[760px] overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#070707] shadow-[0_28px_90px_rgba(0,0,0,0.62)]" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4 border-b border-white/[0.05] px-6 py-5"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">Service description</p><h2 className="text-xl font-semibold tracking-[-0.04em] text-white">Edit full description</h2></div><button type="button" onClick={() => setDescriptionEditorOpen(false)} className="flex h-8 w-8 shrink-0 items-center justify-center text-zinc-600 transition hover:text-white" aria-label="Close description editor"><X className="h-4 w-4" /></button></div><div className="p-6"><textarea value={draft.description} onChange={(event) => setDraftValue('description', event.target.value)} placeholder="Describe what this service includes and what customers should expect." autoFocus className={`${settingsFieldClass} h-[420px] resize-none py-4 leading-6`} /></div><div className="flex items-center justify-end border-t border-white/[0.05] px-6 py-5"><button type="button" onClick={() => setDescriptionEditorOpen(false)} className="h-11 rounded-full bg-white px-8 text-sm font-bold text-black transition hover:bg-zinc-200">Done</button></div></motion.div></motion.div> : null}
        {serviceDetailsHelpOpen ? <SettingsServiceInfoModal dense maxWidthClass="max-w-[480px]" title="Billing units" intro="Use this to tell your receptionist how the service is normally priced or discussed when customers ask about cost." points={[{ title: 'Session.', body: 'Each appointment or visit has its own price.' }, { title: 'Hourly.', body: 'Price is based on the amount of time worked.' }, { title: 'Weekly.', body: 'Price is charged per week.' }, { title: 'Monthly.', body: 'Price is charged per month.' }, { title: 'Yearly.', body: 'Price is charged per year.' }]} onClose={() => setServiceDetailsHelpOpen(false)} /> : null}
        {descriptionHelpOpen ? <SettingsServiceInfoModal title="Write a useful service description" intro="A good description helps your receptionist understand when this service fits, how to answer questions about it, and what next step to recommend." points={[{ title: 'Focus on fit.', body: 'Explain what the service is for, when someone needs it, and what outcome they can expect.' }, { title: 'Stay concise.', body: 'One clear paragraph is usually enough. Pricing and billing details live in their own fields.' }, { title: 'Example:', body: exampleService.serviceDescription(exampleService.serviceName).split('\n\n')[0].replace('Service overview:\n', '') }]} footer="Keep it practical: what it is, when it applies, and anything else your receptionist should know about it." onClose={() => setDescriptionHelpOpen(false)} /> : null}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Services Manager ──────────────────────────────────────────────────────
const ServicesManager = ({ businessId, ensureBusinessRecord, onBusinessLinked, industry }) => {
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
       setAddForm(null);
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
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/[0.03]">
        <p className="text-[12px] font-medium text-zinc-600">
          {services.length} service{services.length === 1 ? '' : 's'} configured
        </p>
        <button type="button" onClick={() => setAddForm({ name: '', description: '', price_type: 'fixed', price_min: '', price_max: '', unit: 'session', category: 'General', is_active: true })}
          className="flex h-10 items-center justify-center rounded-full bg-white px-6 text-sm font-bold text-black transition hover:bg-zinc-200">
          <span>Create service</span>
        </button>
      </div>

      {/* Service list */}
      <div className="p-5 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-[10px] text-zinc-700 uppercase tracking-[0.3em] animate-pulse">Loading services</span>
          </div>
        ) : services.length === 0 ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center rounded-[24px] border border-dashed border-white/[0.08] bg-black/20 p-7 text-center">
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-white">Add your first service</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600">Add the services your business offers and the details your receptionist should know. You can always add or update services later.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[22px] border border-white/[0.05] bg-black/10">
            <div className="grid grid-cols-[minmax(0,1fr)_130px_72px] items-center gap-5 border-b border-white/[0.04] px-5 py-3 text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-700 max-sm:hidden">
              <div>Service</div>
              <div>Price</div>
              <div className="text-right">Actions</div>
            </div>
            <div className="custom-scrollbar max-h-[360px] divide-y divide-white/[0.035] overflow-y-auto">
              {services.map((service) => (
                <div key={service.id} className="grid cursor-pointer grid-cols-[minmax(0,1fr)_130px_72px] items-center gap-5 px-5 py-2.5 transition hover:bg-white/[0.018] max-sm:grid-cols-[minmax(0,1fr)_64px] max-sm:gap-3" onClick={() => setAddForm(service)}>
                  <div className="flex min-w-0 items-center gap-3 leading-none">
                    <span className="flex shrink-0 items-center truncate text-sm font-medium leading-none text-zinc-100">{service.name || 'Untitled service'}</span>
                    {service.description ? <span className="flex min-w-0 items-center truncate text-[11px] leading-none text-zinc-700">{service.description}</span> : null}
                  </div>
                  <div className="truncate text-xs text-zinc-500 max-sm:hidden">{formatOnboardingServicePrice(service)}</div>
                  <div className="flex items-center justify-end gap-1">
                    <button type="button" onClick={(event) => { event.stopPropagation(); setAddForm(service); }} className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-700 transition hover:text-zinc-300" aria-label="Edit service"><Pencil className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); deleteService(service.id); }} className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-800 transition hover:text-rose-400" aria-label="Remove service"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <AnimatePresence>{addForm ? <SettingsServiceModal initialService={addForm.name !== '' || addForm.id ? addForm : null} industry={industry} onClose={() => setAddForm(null)} onSave={(draft) => { if (addForm.id) { updateService(addForm.id, draft); setAddForm(null); } else { addService(draft); } }} /> : null}</AnimatePresence>
    </div>
  );
};

export const StaffManager = ({ businessId, ensureBusinessRecord, onBusinessLinked, defaultHours, hideIntro = false, hideToolbar = false, cardGridClassName = '', compactCards = false, loaderClassName = '', loadingFallback = null }) => {
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
    if (!isValidStaffEmail(form.email)) {
      setError('Enter a valid email address.');
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

    if (!isValidStaffEmail(form.email)) {
      setError('Enter a valid email address.');
      setStaffSlide(0);
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
            <input type="text" value={form.full_name} onChange={(e) => setForm((prev) => ({ ...prev, full_name: maskStaffName(e.target.value) }))} placeholder="e.g. Olivia Hart" className={staffInputClass} />
          </label>
          <label className="block space-y-2">
            <span className="text-[13px] font-normal text-zinc-400">First Name</span>
            <input type="text" value={form.first_name} onChange={(e) => setForm((prev) => ({ ...prev, first_name: maskStaffName(e.target.value) }))} placeholder="Olivia" className={staffInputClass} />
          </label>
          <label className="block space-y-2">
            <span className="text-[13px] font-normal text-zinc-400">Last Name</span>
            <input type="text" value={form.last_name} onChange={(e) => setForm((prev) => ({ ...prev, last_name: maskStaffName(e.target.value) }))} placeholder="Hart" className={staffInputClass} />
          </label>
          <label className="block space-y-2">
            <span className="text-[13px] font-normal text-zinc-400">Role</span>
            <input type="text" value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: maskStaffRole(e.target.value) }))} placeholder="Senior Stylist" className={staffInputClass} />
          </label>
          <label className="block space-y-2">
            <span className="text-[13px] font-normal text-zinc-400">Phone</span>
            <input type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: maskStaffPhone(e.target.value) }))} placeholder="(555) 000-0000" className={staffInputClass} />
          </label>
          <label className="block space-y-2 md:col-span-2">
            <span className="text-[13px] font-normal text-zinc-400">Email</span>
            <input type="email" inputMode="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: maskStaffEmail(e.target.value) }))} placeholder="olivia@business.com" className={staffInputClass} />
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
        <textarea value={form.knowledge} onChange={(e) => setForm((prev) => ({ ...prev, knowledge: e.target.value }))} className="custom-scrollbar h-[410px] w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-4 pr-5 text-sm leading-6 text-white outline-none ring-0 transition placeholder:text-zinc-700 focus:border-white/[0.16] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0" />
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

  if (loading && loadingFallback) return loadingFallback;

  return (
    <div className={`space-y-4 ${hideIntro && hideToolbar ? 'h-full' : ''}`}>
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

      <div className={`space-y-4 ${hideIntro && hideToolbar ? 'h-full' : ''}`}>
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
          <div className={loaderClassName || 'flex min-h-[260px] items-center justify-center pb-20'}>
            <CubePreloader />
          </div>
        ) : staffMembers.length === 0 ? (
          <div className={`flex flex-col items-center justify-center pb-20 text-center ${hideIntro && hideToolbar ? 'min-h-full' : 'min-h-[420px]'}`}>
            <Users size={30} strokeWidth={1.7} className="mb-4 text-zinc-500" />
            <p className="text-[28px] font-semibold leading-none tracking-tight text-white">No staff</p>
            <p className="text-[13px] leading-none text-zinc-500 -translate-y-1.5">Add a staff member your receptionist can book with.</p>
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

const SETTINGS_LONG_TEXT_LIMIT = LONG_TEXT_LIMIT_VALUE;
const settingsFieldClass = 'h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-white !outline-none ring-0 transition placeholder:text-zinc-700 focus:border-white/[0.16] focus:!outline-none focus:ring-0 focus-visible:!outline-none focus-visible:ring-0 [color-scheme:dark]';

const limitKnowledgeText = (value) => String(value || '').slice(0, SETTINGS_LONG_TEXT_LIMIT);
const escapeKnowledgeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const allSettingsBriefSections = () => allBusinessBriefSections();

const hasBusinessBriefSection = (value, section) => (
  new RegExp(`(?:^|\\n\\n)${escapeKnowledgeRegExp(section.label)}:\\n\\n`, 'm').test(value || '')
);

const getBusinessBriefSectionText = (value, section, sections) => {
  const labels = sections.map((item) => item.label);
  const pattern = new RegExp(
    `(?:^|\\n\\n)${escapeKnowledgeRegExp(section.label)}:\\n\\n([\\s\\S]*?)(?=\\n\\n(?:${labels.map((label) => escapeKnowledgeRegExp(`${label}:`)).join('|')})\\n\\n|$)`,
    'm',
  );
  return String(value || '').match(pattern)?.[1]?.trim() || '';
};

const replaceBusinessBriefSection = (value, section, sections) => {
  if (!hasBusinessBriefSection(value, section)) {
    return [String(value || '').trim(), buildBusinessBriefSection(section)].filter(Boolean).join('\n\n');
  }
  const labels = sections.map((item) => item.label);
  const pattern = new RegExp(
    `((?:^|\\n\\n)${escapeKnowledgeRegExp(section.label)}:\\n\\n)[\\s\\S]*?(?=\\n\\n(?:${labels.map((label) => escapeKnowledgeRegExp(`${label}:`)).join('|')})\\n\\n|$)`,
    'm',
  );
  return String(value || '').replace(pattern, `$1${formatBusinessBriefTemplate(section)}`).replace(/\n{3,}/g, '\n\n').trim();
};

const removeBusinessBriefSection = (value, section, sections) => {
  const labels = sections.map((item) => item.label);
  const pattern = new RegExp(
    `(?:^|\\n\\n)${escapeKnowledgeRegExp(section.label)}:\\n\\n[\\s\\S]*?(?=\\n\\n(?:${labels.map((label) => escapeKnowledgeRegExp(`${label}:`)).join('|')})\\n\\n|$)`,
    'm',
  );
  return String(value || '').replace(pattern, '').replace(/\n{3,}/g, '\n\n').trim();
};

const isGeneratedBusinessBriefSection = (value, section) => (
  allSettingsBriefSections().some((candidate) => (
    candidate.id === section.id && getBusinessBriefTemplateVariants(candidate).includes(String(value || '').trim())
  ))
);

const EditableKnowledgeBrief = ({ value, onChange, editorRef }) => {
  const lastInputValueRef = useRef(String(value || ''));

  useEffect(() => {
    const editor = editorRef.current;
    const nextValue = String(value || '');
    if (!editor) return;
    if (editor.textContent === nextValue && lastInputValueRef.current === nextValue) return;
    editor.innerHTML = escapeKnowledgeHtml(nextValue);
    lastInputValueRef.current = nextValue;
  }, [editorRef, value]);

  return (
    <div
      ref={editorRef}
      contentEditable
      role="textbox"
      aria-multiline="true"
      suppressContentEditableWarning
      onBeforeInput={(event) => {
        if (!event.inputType?.startsWith('insert')) return;
        const currentValue = event.currentTarget.textContent || '';
        const selectedTextLength = window.getSelection?.()?.toString().length || 0;
        if (currentValue.length - selectedTextLength >= SETTINGS_LONG_TEXT_LIMIT) event.preventDefault();
      }}
      onPaste={(event) => {
        event.preventDefault();
        const editor = event.currentTarget;
        const currentValue = editor.textContent || '';
        const pastedText = event.clipboardData.getData('text/plain');
        const selection = window.getSelection?.();
        const selectedTextLength = selection?.rangeCount ? String(selection.toString()).length : 0;
        const available = SETTINGS_LONG_TEXT_LIMIT - (currentValue.length - selectedTextLength);
        if (available > 0) document.execCommand('insertText', false, pastedText.slice(0, available));
      }}
      onInput={(event) => {
        const editor = event.currentTarget;
        let nextValue = editor.textContent || '';
        if (nextValue.length > SETTINGS_LONG_TEXT_LIMIT) {
          nextValue = nextValue.slice(0, SETTINGS_LONG_TEXT_LIMIT);
          editor.textContent = nextValue;
          moveKnowledgeCaretToEnd(editor);
        }
        refreshKnowledgePlaceholderStyles(editor);
        lastInputValueRef.current = nextValue;
        onChange(nextValue);
      }}
      onClick={selectKnowledgePlaceholder}
      onBlur={(event) => { event.currentTarget.innerHTML = escapeKnowledgeHtml(event.currentTarget.textContent || ''); }}
      className={`${settingsFieldClass} h-[459px] overflow-y-auto whitespace-pre-wrap resize-none py-4 leading-6`}
    />
  );
};

const escapeKnowledgeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/\[([^\]]+)\]/g, (match, placeholder) => {
    const className = generatedBusinessBriefPlaceholders().has(normalizeBusinessBriefPlaceholder(placeholder))
      ? 'business-brief-placeholder-highlight'
      : 'business-brief-placeholder-edited';
    return `<span class="${className}">[${placeholder}]</span>`;
  });

const refreshKnowledgePlaceholderStyles = (editor) => {
  const generatedPlaceholders = generatedBusinessBriefPlaceholders();
  editor.querySelectorAll('.business-brief-placeholder-highlight').forEach((placeholder) => {
    if (generatedPlaceholders.has(normalizeBusinessBriefPlaceholder(placeholder.textContent))) return;
    placeholder.classList.remove('business-brief-placeholder-highlight');
    placeholder.classList.add('business-brief-placeholder-edited');
  });
};

const selectKnowledgePlaceholder = (event) => {
  const placeholder = event.target.closest?.('.business-brief-placeholder-highlight, .business-brief-placeholder-edited');
  if (!placeholder || !event.currentTarget.contains(placeholder)) return;
  const selection = window.getSelection?.();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(placeholder);
  selection.removeAllRanges();
  selection.addRange(range);
};

const moveKnowledgeCaretToEnd = (element) => {
  const selection = window.getSelection?.();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
};

const KnowledgeBaseEditor = ({ value, onChange, industry }) => {
  const [activeTab, setActiveTab] = useState('about');
  const [faqExampleIndex, setFaqExampleIndex] = useState(0);
  const [tipsOpen, setTipsOpen] = useState(false);
  const businessBriefEditorRef = useRef(null);
  const businessBriefSections = getBusinessBriefSections(industry || 'Other General Business');
  const industryExample = getIndustryExample(industry || 'Other General Business');
  const faqExamples = getFaqExamples(industry || 'Other General Business');
  const content = value[activeTab] || '';

  useEffect(() => {
    setFaqExampleIndex(0);
    const currentValue = String(value.about || '');
    if (!currentValue.trim()) return;
    const refreshed = businessBriefSections.reduce((nextValue, section) => {
      if (!hasBusinessBriefSection(nextValue, section)) return nextValue;
      const currentSectionText = getBusinessBriefSectionText(nextValue, section, allSettingsBriefSections());
      if (!isGeneratedBusinessBriefSection(currentSectionText, section)) return nextValue;
      return replaceBusinessBriefSection(nextValue, section, allSettingsBriefSections());
    }, currentValue);
    const nextValue = {
      ...value,
      about: refreshed,
      policies: allIndustryExampleValues('policies').includes(value.policies) ? '' : value.policies,
      faq: allIndustryExampleValues('faq').includes(value.faq) ? '' : value.faq,
    };
    if (nextValue.about !== value.about || nextValue.policies !== value.policies || nextValue.faq !== value.faq) onChange(nextValue);
  }, [industry]);

  const updateDoc = (nextValue) => onChange({ ...value, [activeTab]: limitKnowledgeText(nextValue) });
  const toggleBusinessBriefSection = (section) => {
    const isActive = hasBusinessBriefSection(value.about, section);
    const currentSectionText = getBusinessBriefSectionText(value.about, section, allSettingsBriefSections());
    const isStaleGeneratedSection = isActive
      && isGeneratedBusinessBriefSection(currentSectionText, section)
      && currentSectionText !== section.template;
    const nextAbout = isStaleGeneratedSection
      ? replaceBusinessBriefSection(value.about, section, businessBriefSections)
      : isActive
        ? removeBusinessBriefSection(value.about, section, businessBriefSections)
        : [String(value.about || '').trim(), buildBusinessBriefSection(section)].filter(Boolean).join('\n\n');
    onChange({ ...value, about: limitKnowledgeText(nextAbout) });
    requestAnimationFrame(() => businessBriefEditorRef.current?.scrollTo({ top: businessBriefEditorRef.current.scrollHeight, behavior: 'smooth' }));
  };

  const showFullBusinessBrief = () => onChange({ ...value, about: limitKnowledgeText(buildFullBusinessBrief(businessBriefSections)) });
  const addFaqQuestion = () => {
    const block = 'Q: \nA: ';
    const currentFaq = String(value.faq || '').trimEnd();
    updateDoc(currentFaq ? `${currentFaq}\n\n${block}` : block);
  };
  const addFaqExample = () => {
    if (!faqExamples.length) return;
    const example = faqExamples[faqExampleIndex % faqExamples.length];
    updateDoc([String(value.faq || '').trim(), example].filter(Boolean).join('\n\n'));
    setFaqExampleIndex((index) => (index + 1) % faqExamples.length);
  };

  const tabs = [
    { key: 'about', label: 'Business Brief', icon: FileText, hint: 'What the company is, how it works, and who it serves' },
    { key: 'policies', label: 'Policies', icon: Shield, hint: 'Business rules, restrictions, requirements, and boundaries' },
    { key: 'faq', label: 'FAQ', icon: HelpCircle, hint: 'Common customer questions and clear answers' },
  ];
  const activeConfig = tabs.find((tab) => tab.key === activeTab) || tabs[0];
  const ActiveIcon = activeConfig.icon;

  return (
    <div className="border border-white/[0.04] rounded-2xl bg-gradient-to-b from-zinc-950/40 to-transparent overflow-hidden">
      <div className="flex items-center gap-1 px-4 py-3 border-b border-white/[0.03] overflow-x-auto">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.key;
          const hasContent = String(value[tab.key] || '').trim().length > 0;
          return (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${isActive ? 'bg-white/[0.06] text-white border border-white/[0.08]' : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.02] border border-transparent'}`}>
              <TabIcon size={13} />
              {tab.label}
              {hasContent && !isActive ? <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" /> : null}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.02] bg-white/[0.01]">
        <div className="flex items-center gap-2 min-w-0">
          <ActiveIcon size={12} className="settings-icon shrink-0" />
          <span className="text-[11px] text-zinc-600 truncate">{activeConfig.hint}</span>
          <button type="button" onClick={() => setTipsOpen(true)} className="flex h-5 w-5 shrink-0 items-center justify-center text-zinc-600 transition hover:text-zinc-300" aria-label={`${activeConfig.label} tips`}>
            <Lightbulb size={13} />
          </button>
        </div>
        <span className="text-[10px] text-zinc-700 tabular-nums shrink-0 ml-3">{content.trim() ? content.trim().split(/\s+/).length : 0} words · {content.length} chars</span>
      </div>

      <div className="p-5">
        {activeTab === 'about' ? (
          <div className="space-y-3">
            <div className="custom-scrollbar flex min-w-0 items-center overflow-x-auto pb-1" aria-label="Business brief sections">
              <button type="button" aria-pressed={businessBriefSections.every((section) => hasBusinessBriefSection(value.about, section))} onClick={showFullBusinessBrief} className={`shrink-0 bg-transparent pr-3 text-[10px] font-semibold leading-[1.7] whitespace-nowrap transition ${businessBriefSections.every((section) => hasBusinessBriefSection(value.about, section)) ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'}`}>All</button>
              {businessBriefSections.map((section) => {
                const active = hasBusinessBriefSection(value.about, section);
                return <div key={section.id} className="flex shrink-0 items-center"><span className="h-3 w-px bg-white/[0.10]" /><button type="button" aria-pressed={active} onClick={() => toggleBusinessBriefSection(section)} className={`bg-transparent px-3 text-[10px] font-semibold leading-[1.7] whitespace-nowrap transition ${active ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'}`}>{section.label}</button></div>;
              })}
            </div>
            <div className="relative">
              <EditableKnowledgeBrief editorRef={businessBriefEditorRef} value={value.about || ''} onChange={(nextValue) => onChange({ ...value, about: nextValue })} />
              <KnowledgeCharacterLimitNotice value={value.about} />
            </div>
          </div>
        ) : null}

        {activeTab === 'policies' ? (
          <div className="relative">
            <textarea value={value.policies || ''} onChange={(event) => onChange({ ...value, policies: limitKnowledgeText(event.target.value) })} placeholder={industryExample.policies} maxLength={SETTINGS_LONG_TEXT_LIMIT} rows={9} className={`${settingsFieldClass} h-[499px] resize-none py-4 leading-6`} />
            <KnowledgeCharacterLimitNotice value={value.policies} />
          </div>
        ) : null}

        {activeTab === 'faq' ? (
          <div className="space-y-3">
            <div className="custom-scrollbar flex min-w-0 items-center overflow-x-auto pb-1" aria-label="Frequently asked questions actions">
              <button type="button" onClick={addFaqQuestion} disabled={String(value.faq || '').length >= SETTINGS_LONG_TEXT_LIMIT} className="shrink-0 bg-transparent pr-3 text-[10px] font-semibold leading-[1.7] whitespace-nowrap text-zinc-500 transition hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-700">Add new</button>
              <span className="h-3 w-px bg-white/[0.10]" />
              <button type="button" onClick={addFaqExample} disabled={!faqExamples.length || String(value.faq || '').length >= SETTINGS_LONG_TEXT_LIMIT} className="shrink-0 bg-transparent px-3 text-[10px] font-semibold leading-[1.7] whitespace-nowrap text-zinc-500 transition hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-700">Add example</button>
            </div>
            <div className="relative">
              <textarea value={value.faq || ''} onChange={(event) => onChange({ ...value, faq: limitKnowledgeText(event.target.value) })} placeholder={industryExample.faq} maxLength={SETTINGS_LONG_TEXT_LIMIT} rows={9} className={`${settingsFieldClass} h-[499px] resize-none py-4 leading-6`} />
              <KnowledgeCharacterLimitNotice value={value.faq} />
            </div>
          </div>
        ) : null}
      </div>
      <AnimatePresence>{tipsOpen ? <KnowledgeTipsModal activeTab={activeTab} onClose={() => setTipsOpen(false)} /> : null}</AnimatePresence>
    </div>
  );
};

const KnowledgeCharacterLimitNotice = ({ value, limit = SETTINGS_LONG_TEXT_LIMIT }) => {
  const remaining = Math.max(0, limit - String(value || '').length);
  if (remaining > 1000) return null;
  return <div className="pointer-events-none absolute right-4 top-3 z-10 rounded-full bg-[#0d0d0d]/90 px-2 py-1 text-[10px] font-semibold text-rose-300">{remaining.toLocaleString()} / {limit.toLocaleString()} characters left</div>;
};

const KNOWLEDGE_TIPS = {
  about: {
    title: 'Build a strong business brief',
    intro: 'Give your AI receptionist a clear understanding of the company, including its background, how it developed, what it is known for, where it operates, and what makes it distinct, so it can respond to customers with more confidence.',
    points: [
      ['Use real business details.', 'Include relevant information such as the founder, start year, early work, location history, community involvement, operating model, specialties, and current scale.'],
      ['Keep it factual and informative.', 'Focus on useful company context rather than promotional language, sentiment, or generic descriptions.'],
      ['Company-focused.', 'Detailed services, FAQs, and policies are covered in their own tabs. Here, focus on the company itself and the details that define it.'],
    ],
    footer: 'Your AI receptionist should come away knowing meaningful facts about this company that would not automatically be true of a typical competitor.',
  },
  policies: {
    title: 'How policies work',
    intro: 'Policies are company-specific rules, restrictions, requirements, and operating boundaries that the AI could not reasonably know or infer on its own. They define how this particular business chooses to operate and may differ significantly from other businesses in the same industry.',
    points: [
      ['Use real operating rules.', 'Policies can cover service limitations, scheduling requirements, geographic restrictions, minimum requirements, qualification rules, pricing boundaries, approval requirements, exceptions, and other internal business rules.'],
      ['Keep them company-specific.', 'A good policy should be something another legitimate business in the same industry could reasonably handle differently or even opposite.'],
      ['Think like you are training a receptionist.', 'Include the important rules and guidelines they should follow when helping customers.'],
    ],
    footer: 'Could another legitimate business in the same industry reasonably have a different or opposite policy? If not, it is probably a general rule or industry standard rather than a company policy.',
  },
  faq: {
    title: 'Write useful FAQs',
    intro: 'Add common customer questions and the answers your AI receptionist should give so it can respond consistently and guide callers toward the right next step.',
    points: [
      ['Use real customer questions.', 'Write questions the way callers naturally ask them, including questions about timing, pricing, availability, service areas, and what to expect.'],
      ['Answer clearly and specifically.', 'Give a direct answer with the details the receptionist should share, while avoiding promises that depend on confirmation.'],
      ['Include the next step when useful.', 'Explain what information the caller should provide or what the receptionist should do when the answer depends on the business or situation.'],
    ],
    footer: 'A strong FAQ helps your receptionist answer common questions without guessing, overpromising, or sending every caller back to the office.',
  },
};

const KnowledgeTipsModal = ({ activeTab, onClose }) => {
  const tips = KNOWLEDGE_TIPS[activeTab] || KNOWLEDGE_TIPS.about;
  return (
    <motion.div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
        <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }} transition={{ duration: 0.18 }} className="relative w-full max-w-[620px] overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#070707] shadow-[0_28px_90px_rgba(0,0,0,0.62)]" onMouseDown={(event) => event.stopPropagation()}>
        <ModalSpectrumLine variant="tips" />
        <div className="pointer-events-none absolute right-[-140px] top-[-180px] h-72 w-72 rounded-full bg-white/[0.035] blur-[72px]" />
        <div className="p-7 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="relative">
              <div className="mb-3 flex items-center gap-1.5"><Lightbulb className="h-4 w-4 shrink-0 -translate-y-[5px] text-zinc-600" aria-hidden="true" /><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-600">Tips</p></div>
              <h2 className="text-xl font-semibold tracking-[-0.04em] text-white sm:text-2xl">{tips.title}</h2>
              <p className="mt-3 max-w-[520px] text-sm leading-6 text-zinc-500">{tips.intro}</p>
            </div>
            <button type="button" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center text-zinc-600 transition hover:text-white" aria-label={`Close ${tips.title}`}><X size={17} /></button>
          </div>
          <div className="mt-7 space-y-5">
            {tips.points.map(([title, body], index) => (
              <div key={title} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: `rgba(255,255,255,${Math.max(0.35, 1 - (index * 0.14))})` }} />
                <div><p className="text-sm font-semibold text-zinc-200">{title}</p><p className="mt-1 text-sm leading-6 text-zinc-500">{body}</p></div>
              </div>
            ))}
          </div>
          <p className="mt-7 border-t border-white/[0.06] pt-5 text-sm leading-6 text-zinc-400">{tips.footer}</p>
        </div>
      </motion.div>
    </motion.div>
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

const BillingSettings = ({ profile }) => {
  const [openingPortal, setOpeningPortal] = useState(false);
  const [error, setError] = useState('');

  const openBillingPortal = async () => {
    setOpeningPortal(true);
    setError('');
    try {
      const result = await api.createBillingPortal();
      if (!result?.url) throw new Error('Stripe Billing Portal is unavailable.');
      window.location.assign(result.url);
    } catch (err) {
      setError(err?.message || 'Could not open Stripe Billing Portal.');
    } finally {
      setOpeningPortal(false);
    }
  };

  const plan = profile?.plan || 'Free';
  const subscriptionStatus = profile?.subscription_status || 'inactive';

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-white/[0.05] bg-zinc-950/40 p-5">
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CreditCard size={15} className="settings-icon" />
              <h4 className="text-[13px] font-semibold text-zinc-100">Billing Portal</h4>
            </div>
            <p className="mt-2 max-w-2xl text-[12px] leading-5 text-zinc-500">
              Manage payment method, invoices, plan changes, and cancellation through Stripe.
            </p>
          </div>
          <button
            type="button"
            onClick={openBillingPortal}
            disabled={openingPortal}
            className="settings-neutral-button inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:cursor-wait disabled:opacity-50"
          >
            {openingPortal ? <Loader2 size={13} className="animate-spin" /> : <ExternalLink size={13} />}
            {openingPortal ? 'Opening' : 'Open Portal'}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/[0.04] bg-black/20 p-4">
            <p className="text-[8px] font-black uppercase tracking-widest text-zinc-700">Current Plan</p>
            <p className="mt-2 truncate text-[14px] font-semibold text-zinc-200">{plan}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.04] bg-black/20 p-4">
            <p className="text-[8px] font-black uppercase tracking-widest text-zinc-700">Subscription Status</p>
            <p className="mt-2 truncate text-[14px] font-semibold text-zinc-200">{subscriptionStatus}</p>
          </div>
        </div>

        {error && (
          <p className="mt-4 text-[11px] font-medium text-rose-400">{error}</p>
        )}
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const { session: authSession, profile, refreshProfile } = useAuth();
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState(null);
  const [lateHoursTermsOpen, setLateHoursTermsOpen] = useState(false);
  const [lateHoursTermsSaving, setLateHoursTermsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('business');
  const [businessAvatarUploading, setBusinessAvatarUploading] = useState(false);
  const businessAvatarInputRef = useRef(null);
  const outboundLateHoursAccepted = hasAcceptedOutboundLateHoursTerms(profile);

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
      industry: {
        ...(settings.industry_details || {}),
        industry: settings.industry || null,
      },
      phone: settings.business_phone || '',
      email: settings.business_email || '',
      avatar: settings.business_avatar || '',
      address: settings.business_street || '',
      city: settings.business_city || '',
      state: settings.business_state || '',
      zip: settings.business_zip || '',
      business_hours: JSON.stringify(
        isStructuredBusinessHours(settings.business_hours)
          ? settings.business_hours
          : createStructuredBusinessHours(settings.business_hours)
      ),
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
        .select('id, name, industry, phone, email, avatar, address, city, state, zip, business_hours, about_us, policies, faq')
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
      const storedIndustry = typeof biz.industry === 'string' ? biz.industry : biz.industry?.industry || '';
      const config = settingsData ? (() => {
        const { created_at, updated_at, business_name, business_phone, business_email, business_address, business_hours, business_timezone, ...parsed } = settingsData;
        return parsed;
      })() : {};

      setSettings({
        ...defaultSettings,
        // Business fields from businesses table
        _business_id: biz.id || null,
        business_name: biz.name || '',
        industry: storedIndustry,
        industry_details: biz.industry && typeof biz.industry === 'object' ? biz.industry : {},
        business_phone: biz.phone || '',
        business_email: biz.email || '',
        business_avatar: biz.avatar || '',
        business_street: biz.address || '',
        business_city: biz.city || '',
        business_state: biz.state || '',
        business_zip: biz.zip || '',
        business_hours: (() => {
          const h = biz.business_hours;
          const parsed = (() => {
            if (!h) return null;
            if (typeof h === 'object') return h;
            try { return JSON.parse(h); } catch { return null; }
          })();
          return isStructuredBusinessHours(parsed) ? parsed : createStructuredBusinessHours(parsed);
        })(),
        business_timezone: config.business_timezone || 'America/New_York',
        // App config from account_settings
        ...config,
        preferences: {
          ...defaultSettings.preferences,
          ...(config.preferences || {}),
          general: {
            ...defaultSettings.preferences.general,
            ...((config.preferences || {}).general || {}),
          },
          calls: {
            ...defaultSettings.preferences.calls,
            ...((config.preferences || {}).calls || {}),
          },
        },
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
      const { business_name, industry, industry_details, business_phone, business_email, business_avatar, business_street, business_city, business_state, business_zip, business_hours, business_timezone, _business_id, services, knowledge_base, id: _id, created_at, updated_at, ...appConfig } = settings;
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

      window.dispatchEvent(new CustomEvent('sonar:preferences-updated', {
        detail: { preferences: scopedAppConfig.preferences || {} },
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

  const acceptOutboundLateHoursTerms = async () => {
    if (!authSession?.access_token) {
      setError('Your session expired. Please sign in again to continue.');
      return;
    }

    setLateHoursTermsSaving(true);
    try {
      const response = await fetch(`${FORWARDING_API_BASE_URL}/users/me`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          terms_of_service: {
            ...(profile?.terms_of_service || {}),
            [OUTBOUND_LATE_HOURS_TERMS_KEY]: {
              accepted: true,
              accepted_at: new Date().toISOString(),
              version: 1,
            },
          },
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await refreshProfile?.();
      setLateHoursTermsOpen(false);
    } catch (err) {
      console.error('[SettingsPage] Failed to save late-hours terms:', err);
      setError('Could not save that acknowledgment. Please try again.');
    } finally {
      setLateHoursTermsSaving(false);
    }
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
    { id: 'billing', title: 'Billing', icon: CreditCard, iconClass: 'settings-icon', hint: 'Plan, invoices, and payment' },
    { id: 'preferences', title: 'Preferences', icon: Shield, iconClass: 'settings-icon', hint: 'Permissions and controls' },
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
      case 'billing':
        return <BillingSettings profile={profile} />;
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
          <SettingsScheduleBuilder
            value={settings.business_hours}
            onChange={(businessHours) => update('business_hours', businessHours)}
            outboundLateHoursAccepted={outboundLateHoursAccepted}
            onOutboundLateHours={() => setLateHoursTermsOpen(true)}
          />
        );
      case 'services':
        return (
          <>
            <div className="mb-4">
              <p className="text-[12px] text-zinc-500 leading-relaxed">
                Give your receptionist the knowledge it needs to explain what you offer, make helpful service recommendations, and guide customers toward the right next step when they are ready to book.
              </p>
            </div>
            <ServicesManager
              businessId={settings._business_id}
              ensureBusinessRecord={ensureBusinessRecord}
              onBusinessLinked={syncBusinessId}
              industry={settings.industry}
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
            </div>
            <KnowledgeBaseEditor
              value={settings.knowledge_base || {}}
              industry={settings.industry}
              onChange={(v) => update('knowledge_base', v)}
            />
          </>
        );
      case 'preferences':
        return (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">General</p>
              <div className="rounded-2xl border border-white/[0.05] bg-zinc-950/40 p-5">
                <div className="flex items-start justify-between gap-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ListChecks size={15} className="settings-icon" />
                      <h4 className="text-[13px] font-semibold text-zinc-100">Show Setup Guide</h4>
                    </div>
                    <p className="mt-2 max-w-2xl text-[12px] leading-5 text-zinc-500">
                      Shows the Getting Started checklist in the lower-right corner of the dashboard.
                    </p>
                  </div>
                  <Toggle
                    value={settings.preferences?.general?.show_setup_guide !== false}
                    onChange={(value) => updatePreference('general', 'show_setup_guide', value)}
                    color="cyan"
                  />
                </div>
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
        <CubePreloader size={22} />
      </div>
    );
  }

  return (
    <div className="settings-page-scope h-full flex flex-col bg-[#020202] text-zinc-400 font-sans selection:bg-indigo-500/20 overflow-hidden">

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-end px-8 pb-2 pt-8">
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
      <div className="flex-1 overflow-hidden px-8 pb-6 pt-3">
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

      <AnimatePresence>
        {lateHoursTermsOpen ? (
          <LateHoursTermsModal
            isSaving={lateHoursTermsSaving}
            onAccept={acceptOutboundLateHoursTerms}
            onClose={() => setLateHoursTermsOpen(false)}
          />
        ) : null}
      </AnimatePresence>

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
              <SettingsScheduleBuilder
                value={settings.business_hours}
                onChange={(businessHours) => update('business_hours', businessHours)}
                outboundLateHoursAccepted={outboundLateHoursAccepted}
                onOutboundLateHours={() => setLateHoursTermsOpen(true)}
              />
            </div>
          </Section>

          {/* ── Call & Notification Settings ─────────────────────────────── */}
          {/* ── Services & Pricing ──────────────────────────────────────── */}
          <Section title="Services & Pricing" icon={Tag} color="bg-white/[0.04] text-white" defaultOpen={true}>
            <div className="mb-4">
              <p className="text-[12px] text-zinc-500 leading-relaxed">
                Give your receptionist the knowledge it needs to explain what you offer, make helpful service recommendations, and guide customers toward the right next step when they are ready to book.
              </p>
            </div>

            <ServicesManager
              businessId={settings._business_id}
              ensureBusinessRecord={ensureBusinessRecord}
              onBusinessLinked={syncBusinessId}
              industry={settings.industry}
            />
          </Section>

          {/* ── Knowledge Base ──────────────────────────────────────────── */}
          <Section title="Knowledge Base" icon={BookOpen} color="bg-white/[0.04] text-white" defaultOpen={true}>
            <div className="mb-4">
              <p className="text-[12px] text-zinc-500 leading-relaxed mb-1">
                Your AI receptionist reads these documents during calls. They contain everything it needs to know about your business — your story, services, pricing, policies, and common answers.
              </p>
            </div>

            <KnowledgeBaseEditor
              value={settings.knowledge_base || {}}
              industry={settings.industry}
              onChange={(v) => update('knowledge_base', v)}
            />
          </Section>

        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
