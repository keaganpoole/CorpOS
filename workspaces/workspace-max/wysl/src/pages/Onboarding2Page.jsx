import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Building2,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Tag,
} from 'lucide-react';

const steps = [
  {
    id: 'business',
    title: 'What should callers know you as?',
    description: 'Start with the core business identity. We will use this across Sonar as the foundation for your receptionist experience.',
  },
  {
    id: 'contact',
    title: 'Where and how should people reach you?',
    description: 'Add the basics now so your workspace feels real from day one. You can refine any of this later.',
  },
  {
    id: 'operations',
    title: 'How should scheduling work?',
    description: 'A few defaults here make inbound calls and appointment handling feel much smoother immediately.',
  },
  {
    id: 'context',
    title: 'Give your receptionist some context.',
    description: 'Clear, simple notes about your company and services are enough. Perfect wording can come later.',
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

const defaultHours = {
  Monday: { enabled: true, open: '09:00', close: '17:00' },
  Tuesday: { enabled: true, open: '09:00', close: '17:00' },
  Wednesday: { enabled: true, open: '09:00', close: '17:00' },
  Thursday: { enabled: true, open: '09:00', close: '17:00' },
  Friday: { enabled: true, open: '09:00', close: '17:00' },
  Saturday: { enabled: false, open: '10:00', close: '14:00' },
  Sunday: { enabled: false, open: '10:00', close: '14:00' },
};

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const fieldClass =
  'w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-5 py-4 text-base text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700 transition-all [color-scheme:dark]';

const smallFieldClass =
  'w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700 transition-all [color-scheme:dark]';

const Field = ({ label, hint, children }) => (
  <div className="space-y-2">
    <div className="space-y-1">
      <div className="text-xs font-medium tracking-tight text-neutral-200">{label}</div>
      {hint ? <div className="text-xs text-neutral-500 leading-relaxed">{hint}</div> : null}
    </div>
    {children}
  </div>
);

const SelectCard = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full rounded-xl border p-4 text-left transition-all duration-300 ${
      active
        ? 'bg-neutral-100 border-neutral-100 text-neutral-950 shadow-[0_0_12px_rgba(255,255,255,0.12)]'
        : 'bg-neutral-900/40 border-neutral-800/80 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-900/60'
    }`}
  >
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium">{label}</span>
      {active ? (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-950 text-white">
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
    className={`relative h-6 w-11 rounded-full transition-all ${
      value ? 'bg-neutral-200 shadow-[0_0_10px_rgba(255,255,255,0.18)]' : 'bg-neutral-800 border border-neutral-700'
    }`}
  >
    <div
      className={`absolute top-0.5 h-5 w-5 rounded-full transition-transform ${
        value ? 'translate-x-5 bg-neutral-950' : 'translate-x-0.5 bg-white'
      }`}
    />
  </button>
);

const DayRow = ({ day, hours, onChange }) => (
  <div className="flex flex-col gap-3 rounded-xl border border-neutral-800/70 bg-neutral-900/30 px-4 py-3 md:flex-row md:items-center">
    <Toggle value={hours.enabled} onChange={(next) => onChange(day, 'enabled', next)} />
    <div className="w-full md:w-28">
      <div className={`text-sm font-medium ${hours.enabled ? 'text-neutral-200' : 'text-neutral-600'}`}>{day}</div>
      <div className="text-xs text-neutral-600">{hours.enabled ? 'Answer inbound calls' : 'Closed'}</div>
    </div>
    {hours.enabled ? (
      <div className="flex items-center gap-2 md:ml-auto">
        <input
          type="time"
          value={hours.open}
          onChange={(e) => onChange(day, 'open', e.target.value)}
          className={smallFieldClass}
        />
        <span className="text-xs text-neutral-600">to</span>
        <input
          type="time"
          value={hours.close}
          onChange={(e) => onChange(day, 'close', e.target.value)}
          className={smallFieldClass}
        />
      </div>
    ) : null}
  </div>
);

const Onboarding2Page = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [form, setForm] = useState({
    businessName: '',
    industry: '',
    ownerName: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    hours: defaultHours,
    appointmentDuration: 30,
    appointmentBuffer: 10,
    about: '',
    services: '',
  });

  const progress = ((step + 1) / steps.length) * 100;
  const current = steps[step];

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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
    if (step === 1) return form.email.trim() || form.phone.trim() || form.city.trim() || form.state.trim();
    if (step === 2) return form.appointmentDuration > 0;
    if (step === 3) return form.about.trim() || form.services.trim();
    return true;
  }, [form, step]);

  const handleNext = () => {
    if (!canContinue && step < steps.length - 1) return;
    if (step < steps.length - 1) {
      setStep((prev) => prev + 1);
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      localStorage.setItem('sonar-onboarding2-draft', JSON.stringify(form));
      setIsSubmitting(false);
      setComplete(true);
    }, 1800);
  };

  const handleBack = () => {
    if (step > 0) setStep((prev) => prev - 1);
  };

  const handleLaunch = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-black text-neutral-100 antialiased selection:bg-neutral-800 [color-scheme:dark]">
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        textarea:-webkit-autofill,
        textarea:-webkit-autofill:hover,
        textarea:-webkit-autofill:focus {
          -webkit-text-fill-color: #f5f5f5;
          -webkit-box-shadow: 0 0 0px 1000px #171717 inset;
          transition: background-color 9999s ease-in-out 0s;
          caret-color: #f5f5f5;
        }

        input[type="time"]::-webkit-calendar-picker-indicator {
          filter: invert(1) opacity(0.6);
        }
      `}</style>
      <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-between px-6">
        <header className="flex h-16 items-center justify-between pt-8 md:pt-12">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-white shadow-sm">
              <Sparkles className="h-4 w-4 text-neutral-200" />
            </div>
            <span className="text-sm font-medium tracking-tight text-neutral-200">Sonar Setup</span>
          </div>

          {!complete && !isSubmitting ? (
            <div className="text-xs font-mono text-neutral-500">
              {step + 1} of {steps.length}
            </div>
          ) : null}
        </header>

        <main className="flex flex-1 flex-col justify-center py-12 md:py-24">
          <div className="w-full">
            {!complete && !isSubmitting ? (
              <div className="mb-12 h-[2px] w-full overflow-hidden rounded-full bg-neutral-900">
                <div
                  className="h-full bg-neutral-200 shadow-[0_0_8px_rgba(255,255,255,0.35)] transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            ) : null}

            {isSubmitting ? (
              <div className="py-12 text-center">
                <div className="mb-6 flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-neutral-200" />
                </div>
                <h2 className="mb-2 text-xl font-medium tracking-tight text-neutral-100">Preparing your Sonar workspace</h2>
                <p className="mx-auto max-w-xs text-sm leading-relaxed text-neutral-400">
                  Saving your setup draft and getting your dashboard ready.
                </p>
              </div>
            ) : complete ? (
              <div className="space-y-8 py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-900/50 bg-neutral-900 text-emerald-400">
                  <Check className="h-6 w-6" />
                </div>

                <div className="space-y-3">
                  <h1 className="text-3xl font-semibold tracking-tight text-neutral-50">
                    {form.businessName || 'Your workspace'} is ready.
                  </h1>
                  <p className="text-base leading-relaxed text-neutral-400">
                    You now have a cleaner starting point for Sonar, with your business basics, call hours, appointment defaults, and receptionist context captured.
                  </p>
                </div>

                <div className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-xl">
                  <div className="flex items-center justify-between border-b border-neutral-800/60 pb-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg font-semibold text-neutral-950">
                        {(form.businessName || 'S').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-neutral-100">{form.businessName || 'Sonar Workspace'}</div>
                        <div className="text-xs text-neutral-500">{form.industry || 'Business'} setup saved</div>
                      </div>
                    </div>
                    <span className="rounded-full border border-emerald-900/40 bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-400">
                      Active
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="mb-1 block text-neutral-500">Contact</span>
                      <span className="font-medium text-neutral-300">{form.phone || form.email || 'To be added'}</span>
                    </div>
                    <div>
                      <span className="mb-1 block text-neutral-500">Scheduling</span>
                      <span className="font-medium text-neutral-300">{form.appointmentDuration} min default</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLaunch}
                  className="flex w-full items-center justify-center space-x-2 rounded-xl bg-white py-3.5 text-sm font-medium text-neutral-950 transition-all hover:bg-neutral-200 active:scale-[0.98]"
                >
                  <span>Open Dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-8"
                >
                  <div className="space-y-3">
                    <h1 className="text-2xl font-semibold tracking-tight text-neutral-100 md:text-3xl">{current.title}</h1>
                    <p className="text-sm leading-relaxed text-neutral-400 md:text-base">{current.description}</p>
                  </div>

                  {step === 0 ? (
                    <div className="space-y-6">
                      <Field label="Business name" hint="The primary name your receptionist should use.">
                        <div className="relative">
                          <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
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
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {industries.map((industry) => (
                            <SelectCard
                              key={industry}
                              label={industry}
                              active={form.industry === industry}
                              onClick={() => update('industry', industry)}
                            />
                          ))}
                        </div>
                      </Field>
                    </div>
                  ) : null}

                  {step === 1 ? (
                    <div className="space-y-6">
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field label="Business email">
                          <div className="relative">
                            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
                            <input
                              type="email"
                              value={form.email}
                              onChange={(e) => update('email', e.target.value)}
                              placeholder="hello@business.com"
                              autoFocus
                              className={`${fieldClass} pl-12`}
                            />
                          </div>
                        </Field>

                        <Field label="Phone number">
                          <div className="relative">
                            <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
                            <input
                              type="text"
                              value={form.phone}
                              onChange={(e) => update('phone', e.target.value)}
                              placeholder="+1 (555) 000-0000"
                              className={`${fieldClass} pl-12`}
                            />
                          </div>
                        </Field>

                        <Field label="City">
                          <div className="relative">
                            <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
                            <input
                              type="text"
                              value={form.city}
                              onChange={(e) => update('city', e.target.value)}
                              placeholder="Worcester"
                              className={`${fieldClass} pl-12`}
                            />
                          </div>
                        </Field>

                        <Field label="State">
                          <input
                            type="text"
                            value={form.state}
                            onChange={(e) => update('state', e.target.value)}
                            placeholder="MA"
                            className={fieldClass}
                          />
                        </Field>
                      </div>
                    </div>
                  ) : null}

                  {step === 2 ? (
                    <div className="space-y-8">
                      <div className="space-y-5">
                        <div className="flex items-center space-x-2 text-xs font-medium text-neutral-500">
                          <Clock3 className="h-4 w-4" />
                          <span>Inbound hours</span>
                        </div>
                        <div className="space-y-3">
                          {days.map((day) => (
                            <DayRow key={day} day={day} hours={form.hours[day]} onChange={updateHours} />
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field label="Default appointment duration">
                          <div className="relative">
                            <Calendar className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
                            <input
                              type="number"
                              min="5"
                              step="5"
                              value={form.appointmentDuration}
                              onChange={(e) => update('appointmentDuration', Number(e.target.value) || 0)}
                              className={`${fieldClass} pl-12`}
                            />
                          </div>
                        </Field>

                        <Field label="Buffer between appointments">
                          <input
                            type="number"
                            min="0"
                            step="5"
                            value={form.appointmentBuffer}
                            onChange={(e) => update('appointmentBuffer', Number(e.target.value) || 0)}
                            className={fieldClass}
                          />
                        </Field>
                      </div>
                    </div>
                  ) : null}

                  {step === 3 ? (
                    <div className="space-y-6">
                      <Field label="About the company" hint="A short, human description is enough.">
                        <textarea
                          value={form.about}
                          onChange={(e) => update('about', e.target.value)}
                          placeholder="We’re a family-owned roofing company focused on fast estimates, clean work, and honest communication."
                          rows={5}
                          autoFocus
                          className={fieldClass}
                        />
                      </Field>

                      <Field label="Services" hint="A simple list works great here.">
                        <textarea
                          value={form.services}
                          onChange={(e) => update('services', e.target.value)}
                          placeholder={`Roof repair\nRoof replacement\nGutter installation\nEmergency tarping`}
                          rows={5}
                          className={fieldClass}
                        />
                      </Field>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between space-x-4 pt-2">
                    {step > 0 ? (
                      <button
                        type="button"
                        onClick={handleBack}
                        className="flex items-center space-x-1 rounded-xl border border-neutral-800 bg-neutral-950 px-5 py-3.5 text-sm font-medium text-neutral-400 transition-all hover:bg-neutral-900 hover:text-neutral-200 active:scale-[0.98]"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span>Back</span>
                      </button>
                    ) : (
                      <div />
                    )}

                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={!canContinue}
                      className="flex items-center space-x-1.5 rounded-xl bg-white px-6 py-3.5 text-sm font-medium text-neutral-950 transition-all hover:bg-neutral-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <span>{step === steps.length - 1 ? 'Complete Setup' : 'Continue'}</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </main>

        <footer className="flex flex-col items-center justify-between border-t border-neutral-900/60 py-8 text-xs text-neutral-500 sm:flex-row">
          <div className="mb-2 flex items-center space-x-1.5 sm:mb-0">
            <ShieldCheck className="h-3.5 w-3.5 text-neutral-600" />
            <span>Workspace draft is saved locally for now</span>
          </div>
          <div>
            <span>Sonar Setup · {new Date().getFullYear()}</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Onboarding2Page;
