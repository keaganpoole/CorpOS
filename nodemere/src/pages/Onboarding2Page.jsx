import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowRight,
  Building2,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Trash2,
  X,
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const steps = [
  {
    id: 'business',
    title: 'What should callers know you as?',
    description: 'Start with the core business identity. We will use this across Sonar as the foundation for your receptionist experience.',
  },
  {
    id: 'contact',
    title: 'Where and how should people reach you?',
    description: 'Add the phone, email, and full business address so your workspace feels real from day one. You can refine any of this later.',
  },
  {
    id: 'operations',
    title: 'How should scheduling work?',
    description: 'A few defaults here make inbound calls and appointment handling feel much smoother immediately.',
  },
  {
    id: 'context',
    title: 'Give your receptionist some context.',
    description: 'This is the background your receptionist uses when callers ask who you are, what makes you different, where you work, how you operate, and what customers should expect. A useful starter is already loaded, so you can keep it, edit it, or skip it for now.',
  },
  {
    id: 'policies',
    title: 'What policies should your receptionist follow?',
    description: 'Add the business rules your receptionist should know for cancellations, deposits, warranties, service areas, payment terms, emergencies, and anything callers commonly need clarified.',
  },
  {
    id: 'faq',
    title: 'What questions should your receptionist answer?',
    description: 'Add common customer questions and answers so your receptionist can respond consistently. A simple list is enough; you can refine it later.',
  },
  {
    id: 'services',
    title: 'What services should your receptionist know?',
    description: 'Build a clean service catalog your receptionist can use for booking, pricing questions, and caller guidance. Add the common services now; you can refine every detail later.',
  },
];

const industries = [
  'Home Services',
  'Medical',
  'Dental',
  'Legal',
  'Real Estate',
  'Automotive',
  'Beauty & Wellness',
  'Hospitality',
  'Other',
];

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const defaultHours = {
  Monday: { enabled: true, open: '09:00', close: '17:00' },
  Tuesday: { enabled: true, open: '09:00', close: '17:00' },
  Wednesday: { enabled: true, open: '09:00', close: '17:00' },
  Thursday: { enabled: true, open: '09:00', close: '17:00' },
  Friday: { enabled: true, open: '09:00', close: '17:00' },
  Saturday: { enabled: false, open: '10:00', close: '14:00' },
  Sunday: { enabled: false, open: '10:00', close: '14:00' },
};

const aboutTemplate = `Who are you? Tell your story. Your AI receptionist uses this to answer questions about your business.

EXAMPLE:

We're Hartley Roofing, a family-owned roofing company based in Portland, Maine. My dad started this business back in 2006 with nothing but a truck and a ladder, and we've been keeping roofs tight ever since.

We specialize in residential roofing: asphalt shingles, metal roofing, flat roofs, and repairs. We also do gutter installation and siding.

We're licensed and insured, and every job comes with a workmanship warranty on top of the manufacturer warranty.

We proudly serve the Greater Portland area and much of southern Maine, including Portland, South Portland, Scarborough, Westbrook, Falmouth, Cape Elizabeth, Gorham, Windham, Cumberland, Yarmouth, Freeport, and surrounding communities.
`;

const policiesTemplate = `Add the policies your AI receptionist should follow during calls.

EXAMPLE:

Service area:
- We serve Cumberland County and most of Southern Maine.

Scheduling:
- Standard appointments require at least 24 hours notice when possible.
- Emergency repair calls can be accepted same day when availability allows.

Cancellations:
- Customers should call as early as possible if they need to cancel or reschedule.

Payments:
- Larger projects may require a deposit before work begins.
- Final payment is due when work is complete unless another arrangement is approved.

Warranty:
- Workmanship warranty details depend on the service performed and will be confirmed in the estimate.`;

const faqTemplate = `Add common customer questions and the answers your AI receptionist should give.

EXAMPLE:

Q: Do you offer free estimates?
A: Yes, estimates are available for most larger projects. Emergency visits or diagnostic calls may have a service fee.

Q: How soon can someone come out?
A: Availability depends on the schedule and urgency. Emergency issues are prioritized whenever possible.

Q: Are you licensed and insured?
A: Yes, we are licensed and insured.

Q: What areas do you serve?
A: We serve Cumberland County and most of Southern Maine.

Q: Do you handle emergency repairs?
A: Yes, callers with active leaks, storm damage, or urgent issues should be prioritized for the soonest available appointment.`;

const unitOptions = [
  { value: '', label: 'None' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'per session', label: 'Per session' },
];

const blankService = () => ({
  id: `service-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name: '',
  description: '',
  category: 'General',
  price_type: 'fixed',
  price_min: '',
  price_max: '',
  unit: 'hourly',
  is_active: true,
});

const formatServicePrice = (service) => {
  const unit = service.unit ? ` / ${service.unit}` : '';
  if (service.price_type === 'free') return 'Free';
  if (service.price_type === 'quote') return 'Quote required';
  if (service.price_type === 'range') return `$${service.price_min || 0} - $${service.price_max || 0}${unit}`;
  if (service.price_type === 'starting_at') return `From $${service.price_min || 0}${unit}`;
  return service.price_min ? `$${service.price_min}${unit}` : 'Price not set';
};

const formatPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const formatZip = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

const formatState = (value) => String(value || '').replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase();

const formatCurrencyInput = (value) => {
  const cleaned = String(value || '').replace(/[^\d.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
};

const formatIntegerInput = (value, maxLength = 3) => String(value || '').replace(/\D/g, '').slice(0, maxLength);

const isEmailComplete = (value) => {
  const email = String(value || '').trim();
  return !email || (email.includes('@') && email.indexOf('@') > 0 && email.indexOf('@') < email.length - 1);
};

const fieldClass =
  'h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-white !outline-none ring-0 transition placeholder:text-zinc-700 focus:border-white/[0.16] focus:!outline-none focus:ring-0 focus-visible:!outline-none focus-visible:ring-0 [color-scheme:dark]';

const smallFieldClass =
  'h-10 w-full rounded-xl border border-white/[0.06] bg-[#070707]/85 px-3 text-[12px] text-zinc-300 !outline-none ring-0 transition placeholder:text-zinc-700 focus:border-white/[0.14] focus:!outline-none focus:ring-0 focus-visible:!outline-none focus-visible:ring-0 [color-scheme:dark]';

const Field = ({ label, hint, children }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-3">
      <div className="text-[13px] font-normal text-zinc-400">
        {label}
        {hint ? <span className="text-zinc-600"> ({hint})</span> : null}
      </div>
    </div>
    {children}
  </div>
);

const SelectCard = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full rounded-2xl border p-4 text-left transition-all duration-300 ${
      active
        ? 'border-white bg-white text-black shadow-[0_0_18px_rgba(255,255,255,0.10)]'
        : 'border-white/[0.08] bg-white/[0.035] text-zinc-400 hover:border-white/[0.16] hover:bg-white/[0.055] hover:text-zinc-200'
    }`}
  >
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold">{label}</span>
      {active ? (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-black text-white">
          <Check className="h-3.5 w-3.5 stroke-[3]" />
        </div>
      ) : null}
    </div>
  </button>
);

const Toggle = ({ value, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={`flex h-6 w-10 items-center rounded-full border p-0.5 transition-all ${
      value ? 'border-emerald-400/30 bg-emerald-400/15' : 'border-white/[0.08] bg-black/30'
    }`}
  >
    <div
      className={`h-4 w-4 rounded-full transition-transform ${
        value ? 'translate-x-4 bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.35)]' : 'translate-x-0 bg-zinc-200'
      }`}
    />
  </button>
);

const DayRow = ({ day, hours, onChange }) => (
  <div className="flex flex-col gap-3 border-b border-white/[0.02] py-2.5 last:border-0 md:flex-row md:items-center">
    <Toggle value={hours.enabled} onChange={(next) => onChange(day, 'enabled', next)} />
    <div className="w-full md:w-28">
      <div className={`text-[12px] font-medium ${hours.enabled ? 'text-zinc-300' : 'text-zinc-600'}`}>{day}</div>
      <div className="text-[11px] text-zinc-700">{hours.enabled ? 'Answer inbound calls' : 'Closed'}</div>
    </div>
    {hours.enabled ? (
      <div className="flex items-center gap-2 md:ml-auto">
        <input type="time" value={hours.open} onChange={(e) => onChange(day, 'open', e.target.value)} className={smallFieldClass} />
        <span className="text-[11px] text-zinc-600">to</span>
        <input type="time" value={hours.close} onChange={(e) => onChange(day, 'close', e.target.value)} className={smallFieldClass} />
      </div>
    ) : (
      <span className="text-[11px] italic text-zinc-700 md:ml-auto">Closed</span>
    )}
  </div>
);

const BillingUnitCascade = ({ value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const label = selected?.label || options[0]?.label || 'Hourly';

  return (
    <div className="flex min-h-[32px] items-center overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="shrink-0 py-1 pr-1 text-left text-[13px] font-bold leading-none tracking-[-0.02em] text-zinc-100 transition hover:text-white"
      >
        {label}
      </button>

      <div
        className={`flex items-center gap-3.5 overflow-hidden pl-3 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${
          open ? 'max-w-[390px] opacity-100' : 'max-w-0 opacity-0'
        }`}
      >
        {options.filter((option) => option.value !== value).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}
            className="shrink-0 text-[11px] font-black leading-none tracking-tight text-zinc-600 transition duration-300 hover:scale-105 hover:text-zinc-200"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const ServiceModal = ({ initialService, onClose, onSave }) => {
  const [draft, setDraft] = useState({
    ...(initialService || blankService()),
    price_type: 'fixed',
    price_max: '',
    is_active: true,
  });
  const setDraftValue = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-xl"
    >
      <motion.section
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        className="w-full max-w-[560px] overflow-visible rounded-[30px] border border-white/[0.08] bg-[#070707] shadow-[0_28px_90px_rgba(0,0,0,0.62)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.04em] text-white">
              {initialService ? 'Edit service' : 'Create service'}
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500">Add a service customers can ask about or book.</p>
          </div>
          <button type="button" onClick={onClose} className="p-0 text-zinc-600 transition hover:text-white" aria-label="Close service modal">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="custom-scrollbar max-h-[calc(100vh-190px)] overflow-y-auto px-6 py-7">
          <div className="space-y-6">
            <div className="border-b border-white/[0.05] pb-6">
              <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">Service details</p>
              <div className="space-y-5">
                <Field label="Service name">
                  <input type="text" value={draft.name} onChange={(e) => setDraftValue('name', e.target.value)} placeholder="e.g., Roof repair" autoFocus className={fieldClass} />
                </Field>

                <Field label="Description" hint="Optional">
                  <textarea
                    value={draft.description}
                    onChange={(e) => setDraftValue('description', e.target.value)}
                    placeholder="Briefly describe what this service includes and what customers should expect."
                    rows={5}
                    className={`${fieldClass} h-[132px] resize-none py-4 leading-6`}
                  />
                </Field>

                <Field label="Price">
                  <input type="text" inputMode="decimal" value={draft.price_min} onChange={(e) => setDraftValue('price_min', formatCurrencyInput(e.target.value))} placeholder="e.g., 49.99" className={fieldClass} />
                </Field>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">Billing</p>
              <div className="space-y-5">
                <Field label="Billing unit" hint="Optional">
                  <BillingUnitCascade value={draft.unit || ''} options={unitOptions} onChange={(value) => setDraftValue('unit', value)} />
                </Field>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/[0.05] px-6 py-5">
          <button type="button" onClick={onClose} className="h-11 rounded-full px-8 text-sm font-normal text-zinc-500 transition hover:text-white">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            disabled={!draft.name.trim()}
            className="flex h-11 min-w-[170px] items-center justify-center gap-2 rounded-full bg-white px-8 text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="h-4 w-4" />
            <span>Save service</span>
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
};

const Onboarding2Page = () => {
  const navigate = useNavigate();
  const { session, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [form, setForm] = useState({
    businessName: '',
    industry: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    hours: defaultHours,
    appointmentDuration: 30,
    appointmentBuffer: 10,
    about: aboutTemplate,
    policies: policiesTemplate,
    faq: faqTemplate,
    services: [],
  });

  const progress = ((step + 1) / steps.length) * 100;
  const current = steps[step];
  const stepLabel = current.id.charAt(0).toUpperCase() + current.id.slice(1);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const removeService = (serviceId) => {
    setForm((prev) => ({ ...prev, services: prev.services.filter((service) => service.id !== serviceId) }));
  };

  const openCreateServiceModal = () => {
    setEditingService(null);
    setServiceModalOpen(true);
  };

  const openEditServiceModal = (service) => {
    setEditingService(service);
    setServiceModalOpen(true);
  };

  const saveService = (serviceDraft) => {
    const normalized = {
      ...serviceDraft,
      name: serviceDraft.name.trim(),
      description: serviceDraft.description.trim(),
      category: serviceDraft.category || 'General',
      price_type: 'fixed',
      unit: serviceDraft.unit,
      price_min: serviceDraft.price_min,
      price_max: '',
      is_active: serviceDraft.is_active !== false,
    };

    if (!normalized.name) return;

    setForm((prev) => {
      const exists = prev.services.some((service) => service.id === normalized.id);
      return {
        ...prev,
        services: exists
          ? prev.services.map((service) => (service.id === normalized.id ? normalized : service))
          : [...prev.services, normalized],
      };
    });
    setServiceModalOpen(false);
    setEditingService(null);
  };

  const updateHours = (day, key, value) => {
    setForm((prev) => ({
      ...prev,
      hours: {
        ...prev.hours,
        [day]: {
          ...prev.hours[day],
          [key]: value,
        },
      },
    }));
  };

  const canContinue = useMemo(() => {
    if (step === 0) return form.businessName.trim() && form.industry.trim();
    if (step === 1) return isEmailComplete(form.email) && (form.email.trim() || form.phone.trim() || form.street.trim() || form.city.trim() || form.state.trim() || form.zip.trim());
    if (step === 2) return form.appointmentDuration > 0;
    return true;
  }, [form, step]);

  const normalizedServices = useMemo(() => (
    form.services
      .map((service) => {
        const priceMin = service.price_min === '' ? null : Number(service.price_min);
        const priceMax = service.price_max === '' ? null : Number(service.price_max);
        return {
          name: String(service.name || '').trim(),
          description: String(service.description || '').trim(),
          category: String(service.category || '').trim() || 'General',
          unit: String(service.unit || '').trim(),
          price_type: service.price_type || 'fixed',
          price_min: Number.isFinite(priceMin) ? priceMin : null,
          price_max: Number.isFinite(priceMax) ? priceMax : null,
          is_active: service.is_active !== false,
        };
      })
      .filter((service) => service.name)
  ), [form.services]);

  const servicesSummary = normalizedServices
    .map((service) => {
      const price = service.price_type === 'quote'
        ? 'Quote required'
        : service.price_type === 'free'
          ? 'Free'
        : service.price_type === 'range'
          ? `$${service.price_min || 0} - $${service.price_max || 0}${service.unit ? ` / ${service.unit}` : ''}`
          : service.price_min
            ? `$${service.price_min}${service.unit ? ` / ${service.unit}` : ''}`
            : 'Price not set';
      return `${service.name}\nPricing: ${price}\n${service.description}`.trim();
    })
    .join('\n\n');

  const buildOnboardingPayload = () => ({
    business_name: form.businessName.trim(),
    industry: form.industry,
    sub_industry: null,
    business_email: form.email.trim() || null,
    business_phone: form.phone.trim() || null,
    business_street: form.street.trim() || null,
    business_city: form.city.trim() || null,
    business_state: form.state.trim() || null,
    business_zip: form.zip.trim() || null,
    business_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
    about_company: [form.about.trim(), servicesSummary ? `Services:\n${servicesSummary}` : ''].filter(Boolean).join('\n\n'),
    policies: form.policies.trim(),
    faq: form.faq.trim(),
    business_hours: form.hours,
    appointment_settings: {
      duration_minutes: form.appointmentDuration,
      buffer_minutes: form.appointmentBuffer,
    },
    services: normalizedServices,
  });

  const handleNext = async () => {
    if (!canContinue && step < steps.length - 1) return;
    setSubmitError('');
    if (step < steps.length - 1) {
      setStep((prev) => prev + 1);
      return;
    }

    if (!session?.access_token) {
      setSubmitError('Your session expired. Please sign in again to finish setup.');
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.post(`${API_BASE_URL}/users/me/onboarding`, buildOnboardingPayload(), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      localStorage.setItem('sonar-onboarding2-draft', JSON.stringify(form));
      await refreshProfile?.();
      setComplete(true);
    } catch (error) {
      console.error('Failed to save onboarding:', error);
      setSubmitError(error.response?.data?.detail || 'Could not save onboarding. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((prev) => prev - 1);
  };

  const handleSkip = () => {
    setSubmitError('');
    if (step < steps.length - 1) {
      setStep((prev) => prev + 1);
    } else {
      handleNext();
    }
  };

  const handleLaunch = () => {
    navigate('/dashboard');
  };

  return (
    <div className="onboarding-setup min-h-screen bg-black text-white antialiased selection:bg-zinc-800 [color-scheme:dark]">
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        textarea:-webkit-autofill,
        textarea:-webkit-autofill:hover,
        textarea:-webkit-autofill:focus {
          -webkit-text-fill-color: #f5f5f5;
          -webkit-box-shadow: 0 0 0px 1000px #111 inset;
          transition: background-color 9999s ease-in-out 0s;
          caret-color: #f5f5f5;
        }

        input[type="time"]::-webkit-calendar-picker-indicator {
          filter: invert(1) opacity(0.55);
        }

        .onboarding-setup input,
        .onboarding-setup textarea,
        .onboarding-setup input:focus,
        .onboarding-setup input:focus-visible,
        .onboarding-setup textarea:focus,
        .onboarding-setup textarea:focus-visible {
          outline: none !important;
          outline-width: 0 !important;
          outline-style: none !important;
          box-shadow: none !important;
        }
      `}</style>

      <div className="mx-auto flex min-h-screen w-full items-center justify-center px-5 py-3 sm:px-8 lg:px-10">
        <section className="relative max-h-[calc(100vh-20px)] w-full max-w-[960px] overflow-hidden rounded-[34px] border border-white/[0.08] bg-[#070707]/95 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="pointer-events-none absolute left-1/2 top-[-260px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/[0.035] blur-[90px]" />

          <main className="relative flex max-h-[calc(100vh-20px)] min-h-[740px] flex-col overflow-auto p-6 sm:p-8">
            {!complete && !isSubmitting ? (
              <div className="mb-6 flex items-center justify-between gap-5">
                <div className="flex h-4 items-center gap-3">
                  <p className="shrink-0 text-[13px] font-normal leading-4 text-zinc-300">
                    {stepLabel} · {step + 1} of {steps.length}
                  </p>
                  <div className="h-1 w-[190px] shrink-0 translate-y-0 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full brand-gradient transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="shrink-0 text-[13px] font-normal text-zinc-600 transition hover:text-zinc-300"
                  >
                    Skip for now
                  </button>
                ) : <div className="h-4 w-[78px]" />}
              </div>
            ) : null}

            <div className="flex flex-1 items-stretch py-0">
              <div className="flex w-full">
                {isSubmitting ? (
                  <div className="mx-auto flex max-w-xl flex-col items-center justify-center py-16 text-center">
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035]">
                      <Loader2 className="h-6 w-6 animate-spin text-zinc-200" />
                    </div>
                    <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">Preparing your Sonar workspace</h2>
                    <p className="mt-3 max-w-md text-sm leading-6 text-zinc-500">
                      Saving your setup draft and getting your dashboard ready.
                    </p>
                  </div>
                ) : complete ? (
                  <div className="mx-auto w-full max-w-3xl space-y-8">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                      <Check className="h-6 w-6" />
                    </div>

                    <div>
                      <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                        {form.businessName || 'Your workspace'} is ready.
                      </h1>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">
                        You now have a cleaner starting point for Sonar, with your business basics, call hours, appointment defaults, and receptionist context captured.
                      </p>
                    </div>

                    <div className="rounded-[28px] border border-white/[0.06] bg-white/[0.035] p-5">
                      <div className="flex items-center justify-between border-b border-white/[0.04] pb-5">
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-lg font-bold text-black">
                            {(form.businessName || 'S').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-white">{form.businessName || 'Sonar Workspace'}</div>
                            <div className="text-xs text-zinc-600">{form.industry || 'Business'} setup saved</div>
                          </div>
                        </div>
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                          Active
                        </span>
                      </div>

                      <div className="grid gap-4 pt-5 text-xs sm:grid-cols-2">
                        <div>
                          <span className="mb-1 block text-zinc-600">Contact</span>
                          <span className="font-medium text-zinc-300">{form.phone || form.email || 'To be added'}</span>
                        </div>
                        <div>
                          <span className="mb-1 block text-zinc-600">Scheduling</span>
                          <span className="font-medium text-zinc-300">{form.appointmentDuration} min default</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleLaunch}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black transition hover:bg-zinc-200 active:scale-[0.98]"
                    >
                      <span>Open Dashboard</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={current.id}
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -18 }}
                      transition={{ duration: 0.18 }}
                      className="mx-auto flex min-h-[620px] w-full flex-col"
                    >
                      <div className="mb-6">
                        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">{current.title}</h1>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500 sm:text-base">{current.description}</p>
                      </div>

                      <div className="flex-1">
                        {step === 0 ? (
                          <div className="space-y-6">
                            <Field label="Business name" hint="The primary name your receptionist should use.">
                              <div className="relative">
                                <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                                <input
                                  type="text"
                                  value={form.businessName}
                                  onChange={(e) => update('businessName', e.target.value)}
                                  placeholder="e.g., Hartley Roofing"
                                  autoFocus
                                  className={`${fieldClass} pl-12`}
                                />
                              </div>
                            </Field>

                            <Field label="Industry" hint="Choose the closest fit. This helps shape smarter defaults.">
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {industries.map((industry) => (
                                  <SelectCard key={industry} label={industry} active={form.industry === industry} onClick={() => update('industry', industry)} />
                                ))}
                              </div>
                            </Field>
                          </div>
                        ) : null}

                        {step === 1 ? (
                        <div className="grid gap-5 sm:grid-cols-2">
                          <Field label="Business email">
                            <div className="relative">
                              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                              <input type="email" value={form.email} onChange={(e) => update('email', e.target.value.trim())} placeholder="hello@business.com" autoFocus className={`${fieldClass} pl-12 ${form.email && !isEmailComplete(form.email) ? 'border-rose-400/40' : ''}`} />
                            </div>
                          </Field>

                          <Field label="Phone number">
                            <div className="relative">
                              <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                              <input type="tel" inputMode="tel" value={form.phone} onChange={(e) => update('phone', formatPhone(e.target.value))} placeholder="(555) 000-0000" className={`${fieldClass} pl-12`} />
                            </div>
                          </Field>

                          <Field label="Street address">
                            <div className="relative">
                              <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                              <input type="text" value={form.street} onChange={(e) => update('street', e.target.value)} placeholder="123 Main Street" className={`${fieldClass} pl-12`} />
                            </div>
                          </Field>

                          <Field label="City">
                            <input type="text" value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Portland" className={fieldClass} />
                          </Field>

                          <Field label="State">
                            <input type="text" value={form.state} onChange={(e) => update('state', formatState(e.target.value))} placeholder="ME" className={fieldClass} />
                          </Field>

                          <Field label="ZIP code">
                            <input type="text" inputMode="numeric" value={form.zip} onChange={(e) => update('zip', formatZip(e.target.value))} placeholder="04101" className={fieldClass} />
                          </Field>
                        </div>
                        ) : null}

                        {step === 2 ? (
                        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                          <div>
                            <div className="mb-3 flex items-center gap-2 text-[12px] font-medium text-zinc-500">
                              <Clock3 className="h-4 w-4" />
                              <span>Inbound hours</span>
                            </div>
                            <div className="custom-scrollbar max-h-[420px] overflow-auto rounded-[22px] border border-white/[0.06] bg-black/20 p-4 pr-3">
                              {days.map((day) => (
                                <DayRow key={day} day={day} hours={form.hours[day]} onChange={updateHours} />
                              ))}
                            </div>
                          </div>

                          <div className="space-y-5">
                            <Field label="Default appointment duration">
                              <div className="relative">
                                <Calendar className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                                <input type="text" inputMode="numeric" value={form.appointmentDuration || ''} onChange={(e) => update('appointmentDuration', Number(formatIntegerInput(e.target.value)) || 0)} className={`${fieldClass} pl-12`} />
                              </div>
                            </Field>

                            <Field label="Buffer between appointments">
                              <input type="text" inputMode="numeric" value={form.appointmentBuffer || ''} onChange={(e) => update('appointmentBuffer', Number(formatIntegerInput(e.target.value)) || 0)} className={fieldClass} />
                            </Field>
                          </div>
                        </div>
                        ) : null}

                        {step === 3 ? (
                        <textarea
                          value={form.about}
                          onChange={(e) => update('about', e.target.value)}
                          rows={9}
                          autoFocus
                          className={`${fieldClass} h-[360px] resize-none py-4 leading-6`}
                        />
                        ) : null}

                        {step === 4 ? (
                        <textarea
                          value={form.policies}
                          onChange={(e) => update('policies', e.target.value)}
                          rows={9}
                          autoFocus
                          className={`${fieldClass} h-[360px] resize-none py-4 leading-6`}
                        />
                        ) : null}

                        {step === 5 ? (
                        <textarea
                          value={form.faq}
                          onChange={(e) => update('faq', e.target.value)}
                          rows={9}
                          autoFocus
                          className={`${fieldClass} h-[360px] resize-none py-4 leading-6`}
                        />
                        ) : null}

                        {step === 6 ? (
                        <div className="space-y-5">
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-[12px] font-medium text-zinc-600">
                              {form.services.length} service{form.services.length === 1 ? '' : 's'} configured
                            </p>
                            <button
                              type="button"
                              onClick={openCreateServiceModal}
                              className="flex h-10 items-center justify-center rounded-full bg-white px-6 text-sm font-bold text-black transition hover:bg-zinc-200"
                            >
                              <span>Create service</span>
                            </button>
                          </div>

                          {form.services.length === 0 ? (
                            <div className="flex min-h-[160px] flex-col items-center justify-center rounded-[24px] border border-dashed border-white/[0.08] bg-black/20 p-7 text-center">
                              <h3 className="text-lg font-semibold tracking-[-0.03em] text-white">No services added yet</h3>
                              <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600">
                                Add your common services, pricing style, and booking details. You can also skip this and add services later.
                              </p>
                            </div>
                          ) : (
                            <div className="overflow-hidden rounded-[22px] border border-white/[0.05] bg-black/10">
                              <div className="grid grid-cols-[minmax(0,1fr)_130px_72px] items-center gap-5 border-b border-white/[0.04] px-5 py-3 text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-700 max-sm:hidden">
                                <div>Service</div>
                                <div>Price</div>
                                <div className="text-right">Actions</div>
                              </div>
                              <div className="custom-scrollbar max-h-[228px] divide-y divide-white/[0.035] overflow-y-auto">
                                {form.services.map((service) => (
                                  <div key={service.id} className="grid grid-cols-[minmax(0,1fr)_130px_72px] items-center gap-5 px-5 py-2.5 transition hover:bg-white/[0.018] max-sm:grid-cols-[minmax(0,1fr)_64px] max-sm:gap-3">
                                    <div className="flex min-w-0 items-center gap-3 leading-none">
                                      <span className="flex shrink-0 items-center truncate text-sm font-medium leading-none text-zinc-100">{service.name || 'Untitled service'}</span>
                                      {service.description ? (
                                        <span className="flex min-w-0 items-center truncate text-[11px] leading-none text-zinc-700">{service.description}</span>
                                      ) : null}
                                    </div>
                                    <div className="truncate text-xs text-zinc-500 max-sm:hidden">
                                      {formatServicePrice(service)}
                                    </div>
                                    <div className="flex items-center justify-end gap-1">
                                      <button type="button" onClick={() => openEditServiceModal(service)} className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-700 transition hover:text-zinc-300" aria-label="Edit service">
                                        <Edit3 className="h-3.5 w-3.5" />
                                      </button>
                                      <button type="button" onClick={() => removeService(service.id)} className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-800 transition hover:text-rose-400" aria-label="Remove service">
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        ) : null}

                        {submitError ? (
                          <div className="mt-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-[12px] font-medium text-rose-300">
                            {submitError}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-auto flex flex-col items-center gap-3 pt-8">
                        <button
                          type="button"
                          onClick={handleNext}
                          disabled={!canContinue}
                          className="flex h-12 w-full max-w-[320px] items-center justify-center gap-2 rounded-full bg-white px-10 text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <span>{step === steps.length - 1 ? 'Complete Setup' : 'Continue'}</span>
                          <ChevronRight className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={handleBack}
                          disabled={step === 0}
                          className="flex h-11 w-full max-w-[320px] items-center justify-center gap-1 rounded-full px-10 text-sm font-normal text-zinc-500 transition hover:text-white disabled:pointer-events-none disabled:opacity-0"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span>Back</span>
                        </button>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            </div>

          </main>
        </section>
      </div>

      <AnimatePresence>
        {serviceModalOpen ? (
          <ServiceModal
            initialService={editingService}
            onClose={() => {
              setServiceModalOpen(false);
              setEditingService(null);
            }}
            onSave={saveService}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default Onboarding2Page;
