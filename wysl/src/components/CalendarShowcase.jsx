import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Calendar as CalendarIcon,
  CreditCard,
  Database,
  GitBranch,
  PlayCircle,
  TimerReset,
  Workflow,
} from 'lucide-react';
import HomepageScenariosDemo from '../sonar/pages/Scenarios/HomepageScenariosDemo';

const HERO_COLORS = ['#818cf8', '#2dd4bf', '#60a5fa', '#a78bfa', '#f472b6', '#fbbf24', '#fb923c', '#34d399'];
const AVATAR_URLS = [
  'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/bonnie2.png',
  'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/chloe_transparent4.png',
  'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/maggie.png',
];
const RECEPTIONISTS = ['Bonnie', 'Chloe', 'Maggie'];
const BOOKING_DIAL_REELS = [
  ['05', 'GMT', '12:00', 'MON', 'OCT', '22', 'UTC', '09:45', 'WED', 'DEC', '14', 'EST', '18:30', 'PST', 'B'],
  ['12', 'CET', '15:30', 'TUE', 'JAN', '08', 'JST', '21:15', 'THU', 'APR', '29', 'AST', '11:00', 'MST', 'O'],
  ['19', 'PST', '08:15', 'WED', 'FEB', '31', 'MST', '14:30', 'FRI', 'MAY', '03', 'CST', '23:45', 'AEST', 'O'],
  ['27', 'EST', '23:00', 'THU', 'MAR', '11', 'NST', '07:00', 'SAT', 'JUN', '18', 'HST', '16:15', 'AKST', 'K'],
  ['03', 'JST', '06:45', 'FRI', 'APR', '15', 'AEST', '19:30', 'SUN', 'JUL', '25', 'SST', '08:00', 'ChST', 'I'],
  ['14', 'AEST', '17:00', 'SAT', 'MAY', '29', 'ChST', '11:15', 'MON', 'AUG', '07', 'GMT', '20:30', 'WET', 'N'],
  ['22', 'NZST', '10:30', 'SUN', 'JUN', '04', 'WET', '16:00', 'TUE', 'SEP', '13', 'CET', '05:15', 'EET', 'G'],
];
const BOOKING_REEL_MOTION = {
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  delays: [0, 200, 400, 500, 400, 200, 0],
  durations: [1500, 1500, 1500, 1500, 1500, 1500, 1500],
};
const BOOKING_TARGET_CHARS = ['B', 'o', 'o', 'k', 'i', 'n', 'g'];
const BOOKING_LETTER_WIDTHS = ['0.71em', '0.58em', '0.58em', '0.61em', '0.28em', '0.57em', '0.61em'];
const BOOKING_LETTER_OFFSETS = ['0em', '-0.015em', '-0.02em', '-0.03em', '-0.05em', '-0.03em', '-0.02em'];
const TAG_COLORS = {
  Color: HERO_COLORS[0],
  Extensions: HERO_COLORS[1],
  Bridal: HERO_COLORS[2],
  Styling: HERO_COLORS[3],
  Haircut: HERO_COLORS[4],
  Blowout: HERO_COLORS[5],
};
const FEATURE_ITEMS = [
  {
    icon: (
      <svg className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out" fill="none" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" className="transition-all duration-500 group-hover:stroke-purple-400" />
        <polyline points="12 6 12 12 16 14" className="origin-center transition-all duration-700 ease-in-out group-hover:rotate-[360deg] group-hover:stroke-purple-300" />
      </svg>
    ),
    colorClass: 'bg-purple-500',
    glowClass: 'shadow-[0_0_12px_rgba(168,85,247,0.6)]',
    hoverTextClass: 'group-hover:text-purple-400',
    title: 'Manage Appointments Intelligently',
    copy: 'Your AI receptionist handles the entire conversation naturally, guiding callers to the right service and securing the appointment without friction.',
  },
  {
    icon: (
      <svg className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out" fill="none" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" className="transition-all duration-500 group-hover:stroke-pink-400" />
        <line x1="9" y1="10" x2="9" y2="14" className="origin-center transition-all duration-500 group-hover:scale-y-150 group-hover:stroke-pink-300" />
        <line x1="12" y1="8" x2="12" y2="16" className="origin-center transition-all duration-500 delay-75 group-hover:scale-y-75 group-hover:stroke-pink-300" />
        <line x1="15" y1="10" x2="15" y2="14" className="origin-center transition-all duration-500 delay-100 group-hover:scale-y-150 group-hover:stroke-pink-300" />
      </svg>
    ),
    colorClass: 'bg-pink-500',
    glowClass: 'shadow-[0_0_12px_rgba(236,72,153,0.6)]',
    hoverTextClass: 'group-hover:text-pink-400',
    title: '24/7 Answering',
    copy: 'Your AI receptionist answers every call instantly, handles multiple conversations at once, and never sends opportunities to voicemail.',
  },
  {
    icon: (
      <svg className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out" fill="none" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" className="transition-all duration-500 group-hover:stroke-amber-400" />
        <path d="M2 12h20" className="transition-all duration-500 group-hover:opacity-60" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" className="origin-center transition-all duration-700 ease-in-out group-hover:rotate-[180deg] group-hover:stroke-amber-300" />
      </svg>
    ),
    colorClass: 'bg-amber-400',
    glowClass: 'shadow-[0_0_12px_rgba(251,191,36,0.6)]',
    hoverTextClass: 'group-hover:text-amber-400',
    title: '70+ Languages',
    copy: "Your AI receptionist automatically detects the caller's language and responds fluently, allowing customers from around the world to communicate naturally without translators, transfers, or awkward misunderstandings.",
  },
  {
    icon: (
      <svg className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out" fill="none" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" className="origin-center transition-all duration-500 group-hover:-translate-y-0.5 group-hover:rotate-3 group-hover:stroke-blue-400" />
        <line x1="2" y1="10" x2="22" y2="10" className="transition-all duration-500 group-hover:-translate-y-0.5" />
        <rect x="6" y="14" width="3" height="2" rx="0.5" className="transition-all duration-500 group-hover:fill-blue-300/30" />
      </svg>
    ),
    colorClass: 'bg-blue-500',
    glowClass: 'shadow-[0_0_12px_rgba(59,130,246,0.6)]',
    hoverTextClass: 'group-hover:text-blue-400',
    title: 'Take Payments',
    copy: 'Connect your payment processor and get paid the moment customers are ready. Your AI receptionist can collect deposits, process payments, and handle billing questions automatically.',
  },
  {
    icon: (
      <svg className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out" fill="none" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" className="origin-center transition-all duration-500 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-105 group-hover:stroke-emerald-400" />
        <path d="M3 21a18 18 0 0 1 8-8" strokeDasharray="3 3" className="transition-all duration-500 group-hover:stroke-emerald-300" />
      </svg>
    ),
    colorClass: 'bg-emerald-500',
    glowClass: 'shadow-[0_0_12px_rgba(16,185,129,0.6)]',
    hoverTextClass: 'group-hover:text-emerald-400',
    title: 'Follow Ups',
    copy: "Most businesses don't have a lead problem. They have a follow-up problem. Your AI receptionist knows when to reach out, what to say, and can even trigger personalized follow-ups through custom workflow automations.",
  },
  {
    icon: (
      <svg className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out" fill="none" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" className="origin-center transition-all duration-500 group-hover:-translate-y-1 group-hover:stroke-indigo-400" />
        <circle cx="12" cy="10" r="3" className="origin-center transition-all duration-500 group-hover:scale-125 group-hover:fill-indigo-300/30" />
      </svg>
    ),
    colorClass: 'bg-indigo-400',
    glowClass: 'shadow-[0_0_12px_rgba(129,140,248,0.6)]',
    hoverTextClass: 'group-hover:text-indigo-400',
    title: 'Step-by-Step Directions',
    copy: 'Powered by Google Maps, your AI receptionist can intelligently guide customers to your business with real-time directions, parking recommendations, traffic insights, and location-specific assistance.',
  },
];

const SCENARIO_FEATURE_ITEMS = [
  {
    icon: <TimerReset className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:rotate-12 group-hover:stroke-cyan-300" />,
    colorClass: 'bg-cyan-400',
    glowClass: 'shadow-[0_0_12px_rgba(34,211,238,0.6)]',
    hoverTextClass: 'group-hover:text-cyan-300',
    title: 'Event-Driven Triggers',
    copy: 'Start workflows from phone calls, people changes, appointment events, payments, invoices, subscriptions, or scheduled time-based triggers.',
  },
  {
    icon: <GitBranch className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:translate-x-1 group-hover:stroke-emerald-300" />,
    colorClass: 'bg-emerald-500',
    glowClass: 'shadow-[0_0_12px_rgba(16,185,129,0.6)]',
    hoverTextClass: 'group-hover:text-emerald-400',
    title: 'Branching Logic',
    copy: 'Use routers, conditional edges, and intent routing to send every scenario run down the correct path based on live context.',
  },
  {
    icon: <Database className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:-translate-y-1 group-hover:stroke-amber-300" />,
    colorClass: 'bg-amber-400',
    glowClass: 'shadow-[0_0_12px_rgba(251,191,36,0.6)]',
    hoverTextClass: 'group-hover:text-amber-400',
    title: 'Live Variables',
    copy: 'Pull data from upstream nodes, table fields, search results, and receptionist context directly into later workflow actions.',
  },
  {
    icon: <CreditCard className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:rotate-3 group-hover:stroke-blue-300" />,
    colorClass: 'bg-blue-500',
    glowClass: 'shadow-[0_0_12px_rgba(59,130,246,0.6)]',
    hoverTextClass: 'group-hover:text-blue-400',
    title: 'Action Execution',
    copy: 'Call customers, send email, manage records, create or update appointments, and run Stripe payment actions from the same workflow canvas.',
  },
  {
    icon: <PlayCircle className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:scale-110 group-hover:stroke-rose-300" />,
    colorClass: 'bg-rose-500',
    glowClass: 'shadow-[0_0_12px_rgba(244,63,94,0.6)]',
    hoverTextClass: 'group-hover:text-rose-400',
    title: 'Run & Debug',
    copy: 'Run the full scenario or individual nodes inside the builder, then watch active and completed path state as the workflow executes.',
  },
  {
    icon: <Workflow className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:rotate-6 group-hover:stroke-indigo-300" />,
    colorClass: 'bg-indigo-400',
    glowClass: 'shadow-[0_0_12px_rgba(129,140,248,0.6)]',
    hoverTextClass: 'group-hover:text-indigo-400',
    title: 'Schedules & Activation',
    copy: 'Save scenarios, toggle them active or disabled, and run them manually or from daily, weekly, reminder, and specific-time schedules.',
  },
];

const getTagColor = (tag) => TAG_COLORS[tag] || HERO_COLORS[0];
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function BookingReelWord({ playState }) {
  return (
    <span className="inline-flex items-end pb-[0.08em]">
      {BOOKING_DIAL_REELS.map((reel, dialIdx) => {
        const delayVal = BOOKING_REEL_MOTION.delays[dialIdx];
        const durationVal = BOOKING_REEL_MOTION.durations[dialIdx];
        const translateY = playState === 'playing' ? (14 * -0.98) : 0;

        return (
          <span
            key={dialIdx}
            style={{
              height: '0.98em',
              width: BOOKING_LETTER_WIDTHS[dialIdx],
              marginRight: BOOKING_LETTER_OFFSETS[dialIdx],
            }}
            className="inline-block overflow-hidden last:mr-0"
          >
            <span
              className="flex flex-col items-center"
              style={{
                transform: `translateY(${translateY}em)`,
                transitionProperty: playState === 'resetting' ? 'none' : 'transform',
                transitionDuration: `${durationVal}ms`,
                transitionDelay: `${delayVal}ms`,
                transitionTimingFunction: BOOKING_REEL_MOTION.easing,
              }}
            >
              {reel.map((char, charIdx) => {
                const isTarget = charIdx === 14;
                const displayChar = isTarget ? BOOKING_TARGET_CHARS[dialIdx] : char;

                return (
                  <span
                    key={charIdx}
                    style={{ height: '0.98em' }}
                    className={`flex w-full items-center justify-center text-center ${
                      isTarget
                        ? 'bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text font-black text-transparent'
                        : 'scale-90 font-medium text-zinc-600/25 blur-[0.35px]'
                    }`}
                  >
                    {displayChar}
                  </span>
                );
              })}
            </span>
          </span>
        );
      })}
    </span>
  );
}

const CalendarShowcase = ({ variant = 'calendar' }) => {
  const rootRef = useRef(null);
  const stickyRef = useRef(null);
  const [sectionProgress, setSectionProgress] = useState(0);
  const [hasAnimatedDots, setHasAnimatedDots] = useState(false);
  const [bookingPlayState, setBookingPlayState] = useState('idle');
  const [demoResetState, setDemoResetState] = useState(null);
  const [demoInstanceKey, setDemoInstanceKey] = useState(0);
  const isScenariosVariant = variant === 'scenarios';
  const featureItems = isScenariosVariant ? SCENARIO_FEATURE_ITEMS : FEATURE_ITEMS;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    let frame = null;

    const updateProgress = () => {
      frame = null;
      const rect = root.getBoundingClientRect();
      const scrollableDistance = Math.max(root.offsetHeight - window.innerHeight, 1);
      const nextProgress = clamp((-rect.top) / scrollableDistance, 0, 1);
      setSectionProgress(nextProgress);
    };

    const onScroll = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  useEffect(() => {
    const sticky = stickyRef.current;
    if (!sticky || hasAnimatedDots) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasAnimatedDots(true);
          observer.disconnect();
        }
      },
      { threshold: 0.45 }
    );

    observer.observe(sticky);
    return () => observer.disconnect();
  }, [hasAnimatedDots]);

  useEffect(() => {
    const sticky = stickyRef.current;
    if (!sticky) return undefined;

    let replayTimer = null;
    let isVisible = false;

    const replay = () => {
      setBookingPlayState('resetting');
      replayTimer = window.setTimeout(() => {
        setBookingPlayState('playing');
      }, 50);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          isVisible = true;
          replay();
        } else if (!entry.isIntersecting) {
          isVisible = false;
        }
      },
      { threshold: 0.45 }
    );

    observer.observe(sticky);

    return () => {
      observer.disconnect();
      if (replayTimer !== null) window.clearTimeout(replayTimer);
    };
  }, []);

  const calendarFadeProgress = clamp((sectionProgress - 0.31) / 0.07, 0, 1);
  const featureFadeProgress = clamp((sectionProgress - 0.365) / 0.08, 0, 1);
  const featureProgress = featureFadeProgress;
  const calendarOpacity = 1 - calendarFadeProgress;
  const featureOpacity = featureFadeProgress;

  const handleDemoLimitExceeded = () => {
    setDemoResetState('message');
    window.setTimeout(() => {
      setDemoInstanceKey((prev) => prev + 1);
      setDemoResetState('intro');
    }, 1300);
    window.setTimeout(() => {
      setDemoResetState(null);
    }, 3400);
  };

  if (isScenariosVariant) {
    const introFadeProgress = clamp((sectionProgress - 0.16) / 0.08, 0, 1);
    const builderFadeInProgress = clamp((sectionProgress - 0.22) / 0.08, 0, 1);
    const builderFadeOutProgress = clamp((sectionProgress - 0.6) / 0.1, 0, 1);
    const scenariosFeatureProgress = clamp((sectionProgress - 0.68) / 0.12, 0, 1);
    const isMessageReset = demoResetState === 'message';
    const isIntroReset = demoResetState === 'intro';
    const introOpacity = isMessageReset ? 0 : isIntroReset ? 1 : 1 - introFadeProgress;
    const builderOpacity = demoResetState ? 0 : builderFadeInProgress * (1 - builderFadeOutProgress);
    const scenariosFeatureOpacity = demoResetState ? 0 : scenariosFeatureProgress;

    return (
      <div ref={rootRef} className="calendar-showcase scenario-demo-showcase relative h-[250vh] w-full">
        <div ref={stickyRef} className="sticky top-0 h-screen overflow-hidden bg-[#020202]">
          <div
            className={`absolute inset-0 z-20 flex items-center justify-center px-6 transition-[opacity,transform] duration-500 ease-out ${
              introOpacity <= 0.01 ? 'pointer-events-none' : ''
            }`}
            style={{
              opacity: introOpacity,
              visibility: introOpacity <= 0.01 ? 'hidden' : 'visible',
              transform: `translateY(${introFadeProgress * -12}px)`,
            }}
          >
            <div className="mx-auto max-w-[860px] text-center">
              <h2 className="bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text pb-2 text-5xl font-black leading-[0.98] tracking-[-0.05em] text-transparent md:text-7xl lg:text-[5.8rem]">
                Scenario
                <br />
                Workflow
                <br />
                Builder.
              </h2>
              <div className="mx-auto mt-6 max-w-[760px] text-base font-semibold leading-[1.55] tracking-[-0.02em] text-zinc-300 md:text-xl">
                Build the exact workflows your business needs with triggers, branching logic, live variables, and actions that run across calls, records, appointments, payments, and follow-ups.
              </div>
            </div>
          </div>

          <div
            className={`absolute inset-0 z-10 transition-[opacity,transform] duration-500 ease-out ${
              builderOpacity <= 0.01 ? 'pointer-events-none' : ''
            }`}
            style={{
              opacity: builderOpacity,
              visibility: builderOpacity <= 0.01 ? 'hidden' : 'visible',
              transform: `translateY(${(1 - builderFadeInProgress) * 18 - builderFadeOutProgress * 18}px)`,
            }}
          >
            <HomepageScenariosDemo
              key={demoInstanceKey}
              demoMode
              demoMaxNodes={4}
              onDemoLimitExceeded={handleDemoLimitExceeded}
              className="homepage-scenarios-builder"
            />
          </div>

          <div
            className={`absolute inset-0 z-30 flex items-center justify-center bg-[#020202] px-6 transition-opacity duration-300 ${
              isMessageReset ? '' : 'pointer-events-none'
            }`}
            style={{
              opacity: isMessageReset ? 1 : 0,
              visibility: isMessageReset ? 'visible' : 'hidden',
            }}
          >
            <div className="bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text text-center text-4xl font-black tracking-[-0.04em] text-transparent md:text-7xl">
              You get the idea.
            </div>
          </div>

          <div
            className={`absolute inset-0 z-10 flex items-center justify-center px-6 transition-[opacity,transform] duration-500 ease-out ${
              scenariosFeatureOpacity <= 0.01 ? 'pointer-events-none' : ''
            }`}
            style={{
              opacity: scenariosFeatureOpacity,
              visibility: scenariosFeatureOpacity <= 0.01 ? 'hidden' : 'visible',
              transform: `translateY(${(1 - scenariosFeatureOpacity) * 18}px)`,
            }}
          >
            <div className="w-full max-w-[980px]">
              <RightFeatureList featureProgress={scenariosFeatureProgress} items={featureItems} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="calendar-showcase relative h-[205vh] w-full md:h-[215vh] lg:h-[225vh]">
      <div ref={stickyRef} className="sticky top-0 flex h-screen items-center">
        <div className="relative z-10 mx-auto w-full max-w-[1300px] px-6 md:px-10 lg:px-12">
          <div className="grid min-h-[700px] grid-cols-1 items-center gap-16 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)] lg:gap-24">
            <div className="flex min-h-[260px] items-center justify-center lg:justify-start lg:min-h-[300px]">
              <div className="text-left">
                <h2 className="bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text pb-1 text-5xl font-black leading-[0.98] tracking-[-0.05em] text-transparent md:text-7xl lg:text-[4rem] lg:pb-2">
                  {isScenariosVariant ? (
                    <>
                      Scenario
                      <br />
                      Workflow
                      <br />
                      Builder.
                    </>
                  ) : (
                    <>
                      Fully Autonomous
                      <br />
                      <BookingReelWord playState={bookingPlayState} />
                      <span>.</span>
                    </>
                  )}
                </h2>
                <div className="calendar-showcase-description mt-6 max-w-[24rem] text-[0.95rem] font-semibold leading-[1.45] tracking-[-0.02em] text-zinc-300 md:text-base">
                  {isScenariosVariant
                    ? 'Build the exact workflows your business needs with triggers, branching logic, live variables, and actions that run across calls, records, appointments, payments, and follow-ups.'
                    : 'Your customers want immediate answers, accurate availability, and a frictionless path to confirmation. This booking flow handles the entire conversation with calm precision.'}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-start">
              <div className="relative h-[680px] w-full max-w-[720px]">
                <div
                  className={`absolute inset-0 transition-[opacity,transform] duration-300 ease-out ${
                    calendarOpacity <= 0.01 ? 'pointer-events-none' : ''
                  }`}
                  style={{
                    opacity: calendarOpacity,
                    visibility: calendarOpacity <= 0.01 ? 'hidden' : 'visible',
                    transform: `translateY(${calendarFadeProgress * -14}px) scale(${1 - calendarFadeProgress * 0.012})`,
                  }}
                >
                  <RightCalendarGrid hasAnimatedDots={hasAnimatedDots} />
                </div>

                <div
                  className={`absolute inset-0 transition-[opacity,transform] duration-500 ease-out ${
                    featureOpacity <= 0.01 ? 'pointer-events-none' : ''
                  }`}
                  style={{
                    opacity: featureOpacity,
                    visibility: featureOpacity <= 0.01 ? 'hidden' : 'visible',
                    transform: `translateY(${(1 - featureOpacity) * 18}px)`,
                  }}
                >
                  <RightFeatureList featureProgress={featureProgress} items={featureItems} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function RightFeatureList({ featureProgress, items }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const isVisible = featureProgress > 0.08;

  return (
    <div className="flex h-full w-full items-center">
      <div className="w-full max-w-[720px] text-left">
        <div className="flex flex-col">
          {items.map((item, index) => {
            const rowVisible = isVisible && featureProgress > 0.18 + index * 0.045;
            const isHovered = hoveredIndex === index;

            return (
              <div
                key={item.title}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="feature-reveal-row group relative flex cursor-pointer flex-col justify-between border-b border-zinc-900/40 py-4 transition-all duration-300 ease-out md:flex-row md:items-center md:py-5"
                style={{
                  opacity: rowVisible ? 1 : 0,
                  transform: rowVisible ? 'translateY(0)' : 'translateY(18px)',
                  transition: `opacity 420ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 75}ms, transform 420ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 75}ms`,
                }}
              >
                <div
                  className={`absolute inset-y-0.5 -inset-x-3 -z-10 rounded-lg bg-zinc-900/[0.12] opacity-0 transition-all duration-300 ease-out ${
                    isHovered ? 'scale-100 opacity-100' : 'scale-[0.98]'
                  }`}
                />

                <div className="flex items-center gap-4 transition-transform duration-300 ease-out group-hover:translate-x-1.5 md:gap-5">
                  <div className="relative flex h-3 w-3 items-center justify-center">
                    <span
                      className={`absolute h-1.5 w-1.5 rounded-full transition-all duration-300 ease-out ${item.colorClass} ${
                        isHovered ? `${item.glowClass} scale-110 opacity-100` : 'scale-75 opacity-30'
                      }`}
                    />
                  </div>

                  <div
                    className={`flex items-center justify-center overflow-visible transition-all duration-300 ${
                      isHovered ? 'scale-110 text-white' : 'text-zinc-600'
                    }`}
                  >
                    {item.icon}
                  </div>

                  <div className={`text-xl font-black tracking-tighter uppercase text-zinc-100 transition-colors duration-300 md:text-2xl ${item.hoverTextClass}`}>
                    {item.title}
                  </div>
                </div>

                <div className="mt-2 w-full pl-7 transition-transform duration-300 ease-out group-hover:translate-x-1 md:mt-0 md:max-w-xs lg:max-w-sm md:pl-0">
                  <div className="text-xs font-medium leading-relaxed tracking-tight text-zinc-400 md:text-[13px]">
                    {item.copy}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RightCalendarGrid({ hasAnimatedDots }) {
  const [selectedDay, setSelectedDay] = useState(17);

  const itemsDatabase = useMemo(
    () => ({
      1: [{ title: 'Color Consultation', category: 'Color', time: '9:00 AM', tagColor: getTagColor('Color') }],
      2: [{ title: 'Styling Appointment', category: 'Styling', time: '11:00 AM', tagColor: getTagColor('Styling') }],
      3: [
        { title: 'Root Touch-Up', category: 'Color', time: '9:30 AM', tagColor: getTagColor('Color') },
        { title: 'Styling Consult', category: 'Styling', time: '1:00 PM', tagColor: getTagColor('Styling') },
      ],
      5: [{ title: 'Haircut Appointment', category: 'Haircut', time: '10:15 AM', tagColor: getTagColor('Haircut') }],
      6: [
        { title: 'Blowout Appointment', category: 'Blowout', time: '10:00 AM', tagColor: getTagColor('Blowout') },
        { title: 'Haircut & Style', category: 'Styling', time: '3:00 PM', tagColor: getTagColor('Styling') },
      ],
      7: [{ title: 'Blowout Appointment', category: 'Blowout', time: '12:00 PM', tagColor: getTagColor('Blowout') }],
      8: [
        { title: 'Color Refresh', category: 'Color', time: '11:15 AM', tagColor: getTagColor('Color') },
        { title: 'Trim Appointment', category: 'Haircut', time: '4:45 PM', tagColor: getTagColor('Haircut') },
      ],
      9: [{ title: 'Color Appointment', category: 'Color', time: '10:30 AM', tagColor: getTagColor('Color') }],
      10: [
        { title: 'Balayage Session', category: 'Color', time: '9:00 AM', tagColor: getTagColor('Color') },
        { title: 'Styling Appointment', category: 'Styling', time: '2:00 PM', tagColor: getTagColor('Styling') },
        { title: 'Blowout Appointment', category: 'Blowout', time: '5:15 PM', tagColor: getTagColor('Blowout') },
      ],
      12: [{ title: 'Haircut Appointment', category: 'Haircut', time: '10:00 AM', tagColor: getTagColor('Haircut') }],
      13: [
        { title: 'Bridal Trial', category: 'Bridal', time: '11:00 AM', tagColor: getTagColor('Bridal') },
        { title: 'Color Appointment', category: 'Color', time: '3:15 PM', tagColor: getTagColor('Color') },
      ],
      14: [{ title: 'Styling Appointment', category: 'Styling', time: '9:30 AM', tagColor: getTagColor('Styling') }],
      15: [
        { title: 'Hair Coloring Appointment', category: 'Color', time: '11:00 AM', tagColor: getTagColor('Color') },
        { title: 'Haircut & Style', category: 'Styling', time: '2:30 PM', tagColor: getTagColor('Styling') },
        { title: 'Blowout Appointment', category: 'Blowout', time: '5:30 PM', tagColor: getTagColor('Blowout') },
      ],
      16: [{ title: 'Root Touch-Up', category: 'Color', time: '11:45 AM', tagColor: getTagColor('Color') }],
      17: [{ title: 'Hair Styling Appointment', category: 'Styling', time: 'All Day', tagColor: getTagColor('Styling') }],
      19: [{ title: 'Haircut & Style', category: 'Styling', time: '10:00 AM', tagColor: getTagColor('Styling') }],
      20: [{ title: 'Blowout Appointment', category: 'Blowout', time: '1:00 PM', tagColor: getTagColor('Blowout') }],
      21: [{ title: 'Color Refresh', category: 'Color', time: '3:30 PM', tagColor: getTagColor('Color') }],
      22: [{ title: 'Hair Color Appointment', category: 'Color', time: '9:00 AM', tagColor: getTagColor('Color') }],
      23: [{ title: 'Styling Appointment', category: 'Styling', time: '9:15 AM', tagColor: getTagColor('Styling') }],
      24: [
        { title: 'Blowout Appointment', category: 'Blowout', time: '9:45 AM', tagColor: getTagColor('Blowout') },
        { title: 'Root Touch-Up', category: 'Color', time: '2:15 PM', tagColor: getTagColor('Color') },
      ],
      26: [{ title: 'Haircut Appointment', category: 'Haircut', time: '10:30 AM', tagColor: getTagColor('Haircut') }],
      27: [{ title: 'Haircut Appointment', category: 'Haircut', time: '4:00 PM', tagColor: getTagColor('Haircut') }],
      28: [
        { title: 'Styling Appointment', category: 'Styling', time: '10:45 AM', tagColor: getTagColor('Styling') },
        { title: 'Color Appointment', category: 'Color', time: '4:30 PM', tagColor: getTagColor('Color') },
      ],
    }),
    []
  );

  return (
    <div className="relative flex h-full w-full items-center">
      <div className="relative w-full overflow-hidden rounded-[28px] border border-white/5 bg-[#08080A] p-10 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.95)]">
        <div className="mb-6 border-b border-white/5 pb-6 text-left">
          <span className="flex items-center space-x-2 text-[2rem] font-bold tracking-tight text-white">
            <CalendarIcon className="text-zinc-300" size={22} />
            <span>October 2026</span>
          </span>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-2 text-center">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
            <span key={`${day}-${index}`} className="py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              {day}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`empty-${index}`} className="aspect-square bg-transparent opacity-5" />
          ))}

          {Array.from({ length: 28 }).map((_, index) => {
            const dayNum = index + 1;
            const isSelected = selectedDay === dayNum;
            const eventsList = itemsDatabase[dayNum] || [];

            return (
              <button
                key={dayNum}
                onClick={() => setSelectedDay(dayNum)}
                className={`relative flex aspect-square flex-col justify-between overflow-hidden rounded-xl border p-2 transition-all duration-300 ${
                  isSelected
                    ? 'z-10 border-transparent bg-gradient-to-tr from-violet-600 via-purple-600 to-fuchsia-600 text-white shadow-[0_0_18px_rgba(139,92,246,0.3)]'
                    : 'border-white/5 bg-zinc-950/60 text-zinc-400 hover:border-white/20'
                }`}
              >
                <span className={`text-[11px] font-bold ${isSelected ? 'text-white' : 'text-zinc-500'}`}>
                  {dayNum}
                </span>

                <div className={`mt-auto flex w-full justify-center space-x-1 ${hasAnimatedDots ? 'anim-starlight-shimmer' : ''}`}>
                  {eventsList.map((event, dotIndex) => (
                    <div
                      key={`${dayNum}-${event.title}`}
                      className="dot-item h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: isSelected ? '#ffffff' : event.tagColor,
                        animationDelay: hasAnimatedDots ? `${dayNum * 24 + dotIndex * 80}ms` : '0ms',
                        animationDuration: '720ms',
                      }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 min-h-[170px] border-t border-white/5 pt-5">
          <span className="mb-3 flex items-center space-x-1.5 text-[9px] font-bold tracking-widest text-zinc-400">
            <Activity size={10} className="text-zinc-300" />
            <span>Appointments for October {selectedDay}</span>
          </span>
          {itemsDatabase[selectedDay] ? (
            <div className="space-y-2">
              {itemsDatabase[selectedDay].map((event, index) => (
                <div
                  key={event.title}
                  className="agenda-item flex items-center justify-between rounded-lg border border-white/5 bg-zinc-950 p-3 text-left"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <div className="flex items-center space-x-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: event.tagColor }} />
                    <span className="text-xs font-semibold text-zinc-200">{event.title}</span>
                    <span className="text-[10px] font-medium italic text-zinc-500">via</span>
                    <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-zinc-900">
                      <img
                        src={AVATAR_URLS[index % AVATAR_URLS.length]}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </span>
                    <span className="text-[10px] font-medium text-zinc-400">
                      {RECEPTIONISTS[index % RECEPTIONISTS.length]}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className="rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                      style={{
                        color: event.tagColor,
                        borderColor: `${event.tagColor}33`,
                        backgroundColor: `${event.tagColor}14`,
                      }}
                    >
                      {event.category}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">{event.time}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs italic text-zinc-500">
              No large-scale bookings scheduled. Open stations available for boutique appointments.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default CalendarShowcase;
