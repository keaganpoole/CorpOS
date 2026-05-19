import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import HireReceptionistModal from '../sonar/pages/HireReceptionistModal';

const TOTAL_STEPS = 8;

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const INDUSTRIES = [
  {
    label: 'Healthcare',
    options: [
      'Dental Practice',
      'Medical Clinic',
      'Chiropractic',
      'Physical Therapy',
      'Med Spa',
      'Mental Health',
      'Veterinary Clinic',
      'Urgent Care',
      'Home Healthcare',
    ],
  },
  {
    label: 'Home Services',
    options: [
      'Roofing',
      'HVAC',
      'Plumbing',
      'Electrical',
      'Landscaping',
      'Pest Control',
      'Cleaning Service',
      'Painting',
      'Garage Door Service',
    ],
  },
  {
    label: 'Automotive',
    options: [
      'Auto Repair',
      'Auto Detailing',
      'Tire Shop',
      'Car Dealership',
      'Collision Repair',
      'Towing Company',
    ],
  },
  {
    label: 'Legal & Financial',
    options: [
      'Law Firm',
      'Accounting Firm',
      'Insurance Agency',
      'Financial Advisor',
      'Tax Services',
      'Real Estate Agency',
    ],
  },
  {
    label: 'Beauty & Wellness',
    options: [
      'Hair Salon',
      'Barbershop',
      'Nail Salon',
      'Spa',
      'Massage Therapy',
      'Fitness Studio',
      'Gym',
    ],
  },
  {
    label: 'Hospitality & Food',
    options: [
      'Restaurant',
      'Cafe',
      'Bakery',
      'Catering',
      'Hotel',
      'Short-Term Rental',
    ],
  },
  {
    label: 'Professional Services',
    options: [
      'Marketing Agency',
      'Consulting',
      'IT Services',
      'Software Company',
      'Photography Studio',
      'Staffing Agency',
    ],
  },
  {
    label: 'Other',
    options: [
      'Church',
      'Nonprofit',
      'Education',
      'Security Company',
      'Construction',
      'Moving Company',
      'Other',
    ],
  },
];

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
];

const defaultHours = {
  Sunday: { enabled: false, open: '09:00', close: '17:00' },
  Monday: { enabled: true, open: '09:00', close: '17:00' },
  Tuesday: { enabled: true, open: '09:00', close: '17:00' },
  Wednesday: { enabled: true, open: '09:00', close: '17:00' },
  Thursday: { enabled: true, open: '09:00', close: '17:00' },
  Friday: { enabled: true, open: '09:00', close: '17:00' },
  Saturday: { enabled: false, open: '09:00', close: '17:00' },
};

const stepMeta = [
  { eyebrow: 'Start', title: 'Business basics', helper: 'Just enough to shape your workspace.' },
  { eyebrow: 'Details', title: 'Full business info', helper: 'Optional now. Useful once calls go live.' },
  { eyebrow: '', title: '', helper: '' },
  { eyebrow: 'Receptionist', title: 'Hire your receptionist', helper: 'Choose the voice and personality customers will meet first.' },
  { eyebrow: 'Availability', title: 'Hours of operation', helper: 'Tell Sonar when it should answer inbound calls.' },
  { eyebrow: '', title: '', helper: '' },
  { eyebrow: 'Company', title: 'About the company', helper: 'A simple natural summary works best.' },
  { eyebrow: 'Services', title: 'What do you offer?', helper: 'Add the services customers usually ask about.' },
];

const cn = (...classes) => classes.filter(Boolean).join(' ');

const formatTimezone = (timezone) => timezone
  .replace('America/', '')
  .replace('Europe/', '')
  .replace('Pacific/', '')
  .replace('_', ' ');

const formatHour = (value) => {
  if (!value) return '';

  const [hourText, minute] = value.split(':');
  let hour = Number(hourText);
  const suffix = hour >= 12 ? 'PM' : 'AM';

  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
};

const formatRange = (hours) => {
  if (!hours?.enabled) return 'Closed';
  return `${formatHour(hours.open)} – ${formatHour(hours.close)}`;
};

function Field({ label, required, children, hint }) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center justify-between gap-3 text-[13px] font-normal text-zinc-400">
        <span>{label}{required ? ' *' : ''}</span>
        {hint && <span className="normal-case tracking-normal text-zinc-600">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function TextInput({ className, ...props }) {
  return (
    <input
      {...props}
      className={cn(
        'h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-white outline-none transition',
        'placeholder:text-zinc-700 focus:border-orange-400/60 focus:bg-white/[0.055] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.08)]',
        '[color-scheme:dark]',
        className
      )}
    />
  );
}

function SelectInput({ className, children, ...props }) {
  return (
    <select
      {...props}
      className={cn(
        'h-12 w-full appearance-none rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 pr-10 text-sm text-white outline-none transition',
        'focus:border-orange-400/60 focus:bg-white/[0.055] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.08)]',
        '[color-scheme:dark]',
        className
      )}
    >
      {children}
    </select>
  );
}

function TextArea({ className, ...props }) {
  return (
    <textarea
      {...props}
      className={cn(
        'min-h-[220px] w-full resize-none rounded-[22px] border border-white/[0.08] bg-white/[0.035] px-4 py-4 text-sm leading-6 text-white outline-none transition',
        'placeholder:text-zinc-700 focus:border-orange-400/60 focus:bg-white/[0.055] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.08)]',
        className
      )}
    />
  );
}

function StepShell({ meta, step, onSkip, children }) {
  return (
    <section className="rounded-[34px] border border-white/[0.08] bg-[#070707]/92 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-7">
      <div className="mb-8 flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-[13px] font-normal text-orange-300">{meta.eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">{meta.title}</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-zinc-500">{meta.helper}</p>
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="shrink-0 rounded-full border border-white/[0.08] px-3 py-2 text-xs font-normal text-zinc-500 transition hover:border-white/[0.16] hover:text-white"
        >
          Skip for now
        </button>
      </div>

      <div className="space-y-4">{children}</div>

      <div className="mt-8 text-center text-[11px] font-medium text-zinc-700">
        Step {step} of {TOTAL_STEPS}
      </div>
    </section>
  );
}

function QuietCelebration({ eyebrow, title, body }) {
  return (
    <div className="py-10 text-center">
      <div className="mx-auto mb-7 h-16 w-16 rounded-full border border-orange-400/20 bg-orange-400/[0.06] shadow-[0_0_44px_rgba(249,115,22,0.12)]" />
      <p className="text-[11px] font-bold uppercase tracking-[0.34em] text-orange-400/90">{eyebrow}</p>
      <h2 className="mx-auto mt-4 max-w-md text-4xl font-semibold tracking-[-0.05em] text-white">{title}</h2>
      <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-zinc-500">{body}</p>
    </div>
  );
}

function DayPill({ day, hours, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-10 rounded-full border px-4 text-xs font-semibold transition',
        active
          ? 'border-orange-400 bg-orange-400 text-black shadow-[0_0_22px_rgba(249,115,22,0.18)]'
          : hours.enabled
            ? 'border-white/[0.1] bg-white/[0.04] text-zinc-300 hover:border-orange-400/40 hover:text-white'
            : 'border-white/[0.06] bg-black/20 text-zinc-700 hover:border-white/[0.12]'
      )}
    >
      {day.slice(0, 3)}
    </button>
  );
}

function Toggle({ checked, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative h-6 w-11 rounded-full border transition',
        checked ? 'border-orange-400 bg-orange-400' : 'border-white/[0.1] bg-white/[0.04]'
      )}
    >
      <span
        className={cn(
          'absolute left-[2px] top-[2px] h-5 w-5 rounded-full transition',
          checked ? 'translate-x-5 bg-black' : 'translate-x-0 bg-zinc-300'
        )}
      />
    </button>
  );
}

function DayHoursRow({ day, hours, onUpdate }) {
  return (
    <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.025] p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className={cn('text-sm font-semibold', hours.enabled ? 'text-white' : 'text-zinc-600')}>{day}</div>
          <div className="mt-1 text-xs text-zinc-700">{formatRange(hours)}</div>
        </div>
        <Toggle checked={hours.enabled} onClick={() => onUpdate(day, 'enabled', !hours.enabled)} />
      </div>

      {hours.enabled && (
        <div className="mt-4 flex items-center gap-3">
          <TextInput
            type="time"
            value={hours.open}
            onChange={(event) => onUpdate(day, 'open', event.target.value)}
            className="h-11 rounded-xl px-3"
          />
          <span className="text-xs text-zinc-700">to</span>
          <TextInput
            type="time"
            value={hours.close}
            onChange={(event) => onUpdate(day, 'close', event.target.value)}
            className="h-11 rounded-xl px-3"
          />
        </div>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [subIndustry, setSubIndustry] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessStreet, setBusinessStreet] = useState('');
  const [businessCity, setBusinessCity] = useState('');
  const [businessState, setBusinessState] = useState('');
  const [businessZip, setBusinessZip] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessTimezone, setBusinessTimezone] = useState('America/New_York');
  const [selectedReceptionist, setSelectedReceptionist] = useState(null);
  const [businessHours, setBusinessHours] = useState(defaultHours);
  const [selectedScheduleDays, setSelectedScheduleDays] = useState(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const [showAdvancedSchedule, setShowAdvancedSchedule] = useState(false);
  const [appointmentDuration, setAppointmentDuration] = useState('30');
  const [appointmentBuffer, setAppointmentBuffer] = useState('15');
  const [aboutCompany, setAboutCompany] = useState('');
  const [services, setServices] = useState('');

  const meta = stepMeta[step - 1];

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof fbq === 'function') {
      fbq('track', 'CompleteRegistration');
    }
  }, []);

  const selectedDayHours = businessHours[selectedScheduleDays[0]] || businessHours.Monday;

  const completion = useMemo(() => Math.round((step / TOTAL_STEPS) * 100), [step]);

  const isStepComplete = () => {
    if (step === 1) {
      return businessName.trim() !== '' && industry.trim() !== '' && subIndustry.trim() !== '';
    }
    return true;
  };

  const updateHours = (day, field, value) => {
    setBusinessHours((previous) => ({
      ...previous,
      [day]: {
        ...previous[day],
        [field]: value,
      },
    }));
  };

  const updateSelectedDays = (field, value) => {
    setBusinessHours((previous) => {
      const next = { ...previous };

      selectedScheduleDays.forEach((day) => {
        next[day] = {
          ...next[day],
          [field]: value,
        };
      });

      return next;
    });
  };

  const toggleScheduleDaySelection = (day) => {
    setSelectedScheduleDays((previous) => {
      if (previous.includes(day)) {
        return previous.length === 1 ? previous : previous.filter((item) => item !== day);
      }

      return [...previous, day];
    });
  };

  const finishOnboarding = async () => {
    setIsSaving(true);
    setSaveError('');

    try {
      const payload = {
        business_name: businessName,
        industry,
        sub_industry: subIndustry,
        business_email: businessEmail,
        business_street: businessStreet,
        business_city: businessCity,
        business_state: businessState,
        business_zip: businessZip,
        business_phone: businessPhone,
        business_timezone: businessTimezone,
        receptionist: selectedReceptionist,
        business_hours: businessHours,
        appointment_settings: {
          default_duration_minutes: Number(appointmentDuration) || 30,
          buffer_minutes: Number(appointmentBuffer) || 0,
        },
        about_company: aboutCompany,
        services,
      };

      localStorage.setItem('sonar-onboarding-draft', JSON.stringify(payload));
      navigate('/dashboard');
    } catch (error) {
      setSaveError(error?.message || 'Failed to finish onboarding.');
    } finally {
      setIsSaving(false);
    }
  };

  const nextStep = () => {
    if (!isStepComplete()) return;

    if (step === TOTAL_STEPS) {
      finishOnboarding();
      return;
    }

    setStep((current) => Math.min(current + 1, TOTAL_STEPS));
  };

  const skipStep = () => {
    if (step === TOTAL_STEPS) {
      finishOnboarding();
      return;
    }

    setStep((current) => Math.min(current + 1, TOTAL_STEPS));
  };

  const prevStep = () => {
    setStep((current) => Math.max(current - 1, 1));
  };

  const handleReceptionistHire = (receptionist) => {
    setSelectedReceptionist(receptionist);
    setStep((current) => Math.min(current + 1, TOTAL_STEPS));
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <StepShell meta={meta} step={step} onSkip={skipStep}>
            <Field label="Business name" required>
              <TextInput
                autoFocus
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="Northstar Dental"
              />
            </Field>

            <Field label="Industry" required>
              <SelectInput
                value={industry}
                onChange={(event) => {
                  setIndustry(event.target.value);
                  setSubIndustry('');
                }}
              >
                <option value="" className="bg-zinc-950 text-zinc-500">
                  Select an industry
                </option>

                {INDUSTRIES.map((group) => (
                  <option
                    key={group.label}
                    value={group.label}
                    className="bg-zinc-950 text-white"
                  >
                    {group.label}
                  </option>
                ))}
              </SelectInput>
            </Field>

            {industry && (
              <Field label="Sub-industry" required>
                <SelectInput
                  value={subIndustry}
                  onChange={(event) => setSubIndustry(event.target.value)}
                >
                  <option value="" className="bg-zinc-950 text-zinc-500">
                    Select a sub-industry
                  </option>

                  {(INDUSTRIES.find((group) => group.label === industry)?.options || []).map((option) => (
                    <option
                      key={option}
                      value={option}
                      className="bg-zinc-950 text-white"
                    >
                      {option}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            )}
          </StepShell>
        );

      case 2:
        return (
          <StepShell meta={meta} step={step} onSkip={skipStep}>
            <Field label="Business email">
              <TextInput
                type="email"
                value={businessEmail}
                onChange={(event) => setBusinessEmail(event.target.value)}
                placeholder="hello@company.com"
              />
            </Field>

            <Field label="Phone number">
              <TextInput
                value={businessPhone}
                onChange={(event) => setBusinessPhone(event.target.value)}
                placeholder="(555) 123-4567"
              />
            </Field>

            <Field label="Street address">
              <TextInput
                value={businessStreet}
                onChange={(event) => setBusinessStreet(event.target.value)}
                placeholder="123 Main Street"
              />
            </Field>

            <Field label="City">
              <TextInput
                value={businessCity}
                onChange={(event) => setBusinessCity(event.target.value)}
                placeholder="Boston"
              />
            </Field>

            <Field label="State">
              <TextInput
                value={businessState}
                onChange={(event) => setBusinessState(event.target.value)}
                placeholder="MA"
              />
            </Field>

            <Field label="ZIP code">
              <TextInput
                value={businessZip}
                onChange={(event) => setBusinessZip(event.target.value)}
                placeholder="02108"
              />
            </Field>

            <Field label="Timezone">
              <SelectInput value={businessTimezone} onChange={(event) => setBusinessTimezone(event.target.value)}>
                {TIMEZONES.map((timezone) => (
                  <option key={timezone} value={timezone} className="bg-zinc-950 text-white">
                    {formatTimezone(timezone)}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </StepShell>
        );

      case 3:
        return (
          <StepShell meta={meta} step={step} onSkip={skipStep}>
            <QuietCelebration
              eyebrow="Looks great!"
              title="Clean setup. No bloat."
              body="You already gave Sonar the essentials. The rest just makes the receptionist sharper."
            />
          </StepShell>
        );

      case 4:
        return (
          <StepShell meta={meta} step={step} onSkip={skipStep}>
            <div className="overflow-hidden rounded-[26px] border border-white/[0.08] bg-black/30">
              <HireReceptionistModal embedded onHire={handleReceptionistHire} />
            </div>
          </StepShell>
        );

      case 5:
        return (
          <StepShell meta={meta} step={step} onSkip={skipStep}>
            <div className="space-y-5 rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-4">
              <div>
                <div className="mb-3 text-[13px] font-normal text-zinc-500">Days receptionist can answer</div>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => (
                    <DayPill
                      key={day}
                      day={day}
                      hours={businessHours[day]}
                      active={selectedScheduleDays.includes(day)}
                      onClick={() => toggleScheduleDaySelection(day)}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-[22px] border border-white/[0.06] bg-black/20 p-4">
                <div className="flex items-center justify-between gap-5">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-600">
                      {selectedScheduleDays.length === 1 ? selectedScheduleDays[0] : `${selectedScheduleDays.length} days selected`}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {selectedScheduleDays.length === 1 ? formatRange(selectedDayHours) : 'Apply the same window to selected days'}
                    </p>
                  </div>

                  <Toggle
                    checked={selectedDayHours.enabled}
                    onClick={() => updateSelectedDays('enabled', !selectedDayHours.enabled)}
                  />
                </div>

                {selectedDayHours.enabled && (
                  <div className="mt-5 flex items-center gap-3">
                    <TextInput
                      type="time"
                      value={selectedDayHours.open}
                      onChange={(event) => updateSelectedDays('open', event.target.value)}
                      className="h-11 rounded-xl px-3"
                    />
                    <span className="text-xs text-zinc-700">to</span>
                    <TextInput
                      type="time"
                      value={selectedDayHours.close}
                      onChange={(event) => updateSelectedDays('close', event.target.value)}
                      className="h-11 rounded-xl px-3"
                    />
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowAdvancedSchedule((current) => !current)}
                className="text-sm font-semibold text-orange-400 transition hover:text-orange-300"
              >
                {showAdvancedSchedule ? 'Hide daily schedule' : 'Customize each day'}
              </button>
            </div>

            {showAdvancedSchedule && (
              <div className="space-y-3">
                {DAYS.map((day) => (
                  <DayHoursRow key={day} day={day} hours={businessHours[day]} onUpdate={updateHours} />
                ))}
              </div>
            )}
          </StepShell>
        );

      case 6:
        return (
          <StepShell meta={meta} step={step} onSkip={skipStep}>
            <QuietCelebration
              eyebrow="Almost done!"
              title="Give it a little context."
              body="The next screens help the receptionist answer naturally instead of sounding generic."
            />
          </StepShell>
        );

      case 7:
        return (
          <StepShell meta={meta} step={step} onSkip={skipStep}>
            <Field label="Company summary">
              <TextArea
                value={aboutCompany}
                onChange={(event) => setAboutCompany(event.target.value)}
                placeholder="We’re a family-owned roofing company in Worcester. We handle repairs, replacements, gutters, and emergency leak calls..."
              />
            </Field>
          </StepShell>
        );

      case 8:
        return (
          <StepShell meta={meta} step={step} onSkip={skipStep}>
            <Field label="Services">
              <TextArea
                value={services}
                onChange={(event) => setServices(event.target.value)}
                placeholder={`Roof repair — leak fixes, missing shingles, flashing issues.\n\nRoof replacement — full tear-off and installation.\n\nGutter installation — seamless gutters in multiple colors.`}
              />
            </Field>
          </StepShell>
        );

      default:
        return null;
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020202] px-4 py-6 text-white antialiased sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-220px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-orange-500/[0.07] blur-[90px]" />
        <div className="absolute bottom-[-280px] right-[-120px] h-[520px] w-[520px] rounded-full bg-white/[0.035] blur-[110px]" />
      </div>

      <div className={cn(
        'relative mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-xl flex-col justify-center transition duration-500',
        isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      )}>
        <header className="mb-6">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-300 via-orange-400 to-orange-600 transition-all duration-500"
              style={{ width: `${completion}%` }}
            />
          </div>
        </header>

        {renderStep()}

        <footer className="mt-5 space-y-3">
          <button
            type="button"
            onClick={nextStep}
            disabled={!isStepComplete() || isSaving}
            className="h-12 w-full rounded-full bg-white text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? 'Saving...' : step < TOTAL_STEPS ? 'Continue' : 'Finish setup'}
          </button>

          {step > 1 && (
            <button
              type="button"
              onClick={prevStep}
              disabled={isSaving}
              className="h-11 w-full rounded-full text-sm font-normal text-zinc-500 transition hover:text-white disabled:opacity-40"
            >
              Back
            </button>
          )}

          {saveError && <p className="text-center text-sm text-red-400">{saveError}</p>}
        </footer>
      </div>
    </main>
  );
}
