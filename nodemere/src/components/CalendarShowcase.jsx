import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AudioLines,
  ArrowRight,
  Calendar as CalendarIcon,
  ClipboardList,
  CreditCard,
  GitBranch,
  Layers,
  Phone,
  PlayCircle,
  TimerReset,
  Users,
  Workflow,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import HomepageScenariosDemo from '../sonar/pages/Scenarios/HomepageScenariosDemo';
import HomepagePeopleCrmDemo, { DEMO_CUSTOM_FIELDS } from '../sonar/pages/HomepagePeopleCrmDemo';
import useSectionScrollProgress from '../hooks/useSectionScrollProgress';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

const HERO_COLORS = ['#818cf8', '#2dd4bf', '#60a5fa', '#a78bfa', '#f472b6', '#fbbf24', '#fb923c', '#34d399'];
const TAG_COLORS = {
  Color: HERO_COLORS[0],
  Extensions: HERO_COLORS[1],
  Bridal: HERO_COLORS[2],
  Styling: HERO_COLORS[3],
  Haircut: HERO_COLORS[4],
  Blowout: HERO_COLORS[5],
};
const DEMO_APPOINTMENT_STATUS_COLORS = {
  Completed: '#22c55e',
  Cancelled: '#f43f5e',
  Confirmed: '#a78bfa',
  Booked: '#f59e0b',
};

const getDemoAppointmentActions = (status) => {
  if (status === 'Completed') return [];
  if (status === 'Cancelled') return [{ label: 'Reschedule', className: 'text-zinc-300' }];
  if (status === 'Confirmed') {
    return [
      { label: 'Reschedule', className: 'text-zinc-300' },
      { label: 'Cancel', className: 'text-rose-300' },
    ];
  }

  return [
    { label: 'Confirm', className: 'text-emerald-300' },
    { label: 'Reschedule', className: 'text-zinc-300' },
    { label: 'Cancel', className: 'text-rose-300' },
  ];
};

const DEMO_CUSTOMER_FIRST_NAMES = [
  'Ava',
  'Maya',
  'Sofia',
  'Harper',
  'Ella',
  'Nora',
  'Isla',
  'Grace',
  'Lena',
  'Ruby',
  'Claire',
  'Mia',
];

const getDemoActionPrompt = (action, customerFirstName) => {
  if (action === 'Confirm') return `Call ${customerFirstName} to confirm?`;
  if (action === 'Cancel') return `Call ${customerFirstName} to cancel?`;
  return `Call ${customerFirstName} to reschedule?`;
};

const getReceptionistBannerUrl = (bannerId) => (
  bannerId
    ? `https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/banners/${bannerId}.png`
    : null
);

const FALLBACK_RECEPTIONISTS = [
  {
    id: 'fallback-bonnie',
    full_name: 'Bonnie',
    first_name: 'Bonnie',
    avatar: 'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/bonnie2.png',
  },
  {
    id: 'fallback-chloe',
    full_name: 'Chloe',
    first_name: 'Chloe',
    avatar: 'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/chloe_transparent4.png',
  },
  {
    id: 'fallback-maggie',
    full_name: 'Maggie',
    first_name: 'Maggie',
    avatar: 'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/maggie.png',
  },
];
const FEATURE_ITEMS = [
  {
    icon: <Activity className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:scale-110" />,
    title: 'Booking CRM',
    copy: 'Create beautifully organized appointment records that bring together customer details, history, notes, and everything else surrounding each visit.',
  },
  {
  icon: <Users className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:-translate-y-1" />,
  title: 'Staff Matching',
  copy: 'Match every customer with the staff member who best fits their needs while checking availability in real time.'
  },
  {
    icon: <CalendarIcon className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:-translate-y-1" />,
    title: 'Fully Managed',
    copy: 'Handle the full appointment flow during the call, from new bookings to changes and cancellations.',
  },
  {
    icon: <TimerReset className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:rotate-12" />,
    title: 'Follow-Ups',
    copy: 'Send confirmations, reminders, and appointment updates so customers know exactly what was booked and what happens next.',
  },
  {
    icon: <CreditCard className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:rotate-3" />,
    title: 'Deposits & Payments',
    copy: 'Collect payment or send deposit links during booking when an appointment needs to be secured.',
  },
];

const SCENARIO_FEATURE_ITEMS = [
  {
    icon: <TimerReset className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:rotate-12" />,
    title: 'Call Automation',
    copy: 'Have your receptionist make phone calls as part of the workflow, so calls happen exactly when they should, at the perfect moment.',
  },
  {
    icon: <GitBranch className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:translate-x-1" />,
    title: 'Automated Follow-Ups',
    copy: 'Stay on top of every customer by following up at the right time based on specific triggers within your business.',
  },
  {
    icon: <CreditCard className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:rotate-3" />,
    title: 'Built-In Payments',
    copy: 'Automate billing tasks like payment collection, invoice creation, and payment links as part of the conversation.',
  },
  {
    icon: <PlayCircle className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:scale-110" />,
    title: 'Workflow Resume',
    copy: 'Scenarios can carry forward the latest details from earlier steps, letting your receptionist continue the workflow instead of starting over.',
  },
  {
    icon: <Workflow className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:rotate-6" />,
    title: 'Schedules',
    copy: 'Set scenarios to run at specific times, on recurring intervals, or before important events.',
  },
];

const CRM_FEATURE_ITEMS = [
  {
    icon: <Layers className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:translate-x-1" />,
    title: 'Fully Customizable',
    copy: 'Build a CRM tailored to your business with custom fields and flexible data structures designed around the way your team operates.',
  },
  {
    icon: <ClipboardList className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:-translate-y-1" />,
    title: 'Custom Intake Fields',
    copy: 'Tell your receptionist which details matter most, and it will prioritize collecting them during the call before saving them to the customer record.',
  },
  {
    icon: <TimerReset className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:rotate-12" />,
    title: 'Organization Tools',
    copy: 'Sort, filter, hide, freeze, and arrange data to create the perfect workspace for your business.',
  },
  {
    icon: <Users className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:-translate-y-1" />,
    title: 'Real-Time Updates',
    copy: 'See live customer activity as it happens, making every record more useful and every decision faster.',
  },
  {
    icon: <GitBranch className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:rotate-6" />,
    title: 'Zones',
    copy: 'Organize records with beautiful, personalized color-coded columns for faster scanning and easier management.',
  },
];

const MONITORING_FEATURE_ITEMS = [
  {
    icon: <Activity className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:scale-110" />,
    title: 'Real-Time Analytics',
    copy: 'Track calls, appointments, customers, revenue, and payment activity in real time from one live dashboard.',
  },
  {
    icon: <AudioLines className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:scale-110" />,
    title: 'Call Listening',
    copy: 'Access recorded conversations so finding important information is always simple.',
  },
  {
    icon: <Phone className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:-translate-y-1" />,
    title: 'Live Call Visibility',
    copy: 'Experience every call as it happens with a live visual flow that reveals the path your AI receptionist takes from start to finish.',
  },
  {
    icon: <Layers className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:-translate-y-1" />,
    title: 'Full Transcripts',
    copy: 'Review what mattered fast with transcripts, summaries, direction, duration, and outcomes attached to every call.',
  },
];

const MONITORING_HEADLINE_STYLES = `
  .monitoring-merged-text {
    color: white;
  }

  @keyframes monitoring-rec-dot-sequence {
    0% { transform: scale(0); opacity: 0; }
    15% { transform: scale(1); opacity: 1; background-color: #ff3333; box-shadow: 0 0 15px #ff3333; }
    25% { transform: scale(0.6); opacity: 0.5; }
    35% { transform: scale(1); opacity: 1; box-shadow: 0 0 15px #ff3333; }
    45% { transform: scale(0.6); opacity: 0.5; }
    55% { transform: scale(1); opacity: 1; box-shadow: 0 0 15px #ff3333; }
    65% { transform: scaleX(25) scaleY(0.1); opacity: 1; background-color: white; box-shadow: 0 0 15px white; }
    85% { transform: scaleX(25) scaleY(0.1) translateY(80px); opacity: 0; }
    100% { opacity: 0; }
  }

  @keyframes monitoring-rec-text-sequence {
    0%, 64% { opacity: 0; clip-path: inset(50% 0 50% 0); }
    65% { opacity: 1; clip-path: inset(10% 0 80% 0); transform: translateX(-10px); color: cyan; }
    70% { clip-path: inset(80% 0 10% 0); transform: translateX(10px); color: magenta; }
    75% { clip-path: inset(0 0 0 0); transform: translateX(0); color: white; filter: drop-shadow(4px 0px 0px #ff003c) drop-shadow(-4px 0px 0px cyan); }
    80%, 100% { filter: none; opacity: 1; clip-path: inset(0 0 0 0); }
  }
`;

const CRM_STUNNING_STYLES = `
  @keyframes crm-prism-red-move {
    0% { transform: translate(-14px, -4px) scale(1.03); opacity: 0; filter: blur(3px); }
    15% { opacity: 0.95; }
    55% { transform: translate(-3px, -1px) scale(1.01); opacity: 0.5; }
    80% { opacity: 0.15; }
    100% { transform: translate(0, 0) scale(1); opacity: 0; filter: blur(0); }
  }

  @keyframes crm-prism-blue-move {
    0% { transform: translate(14px, 4px) scale(1.03); opacity: 0; filter: blur(3px); }
    15% { opacity: 0.95; }
    55% { transform: translate(3px, 1px) scale(1.01); opacity: 0.5; }
    80% { opacity: 0.15; }
    100% { transform: translate(0, 0) scale(1); opacity: 0; filter: blur(0); }
  }

  @keyframes crm-prism-green-move {
    0% { transform: scale(1.1); opacity: 0; filter: blur(10px); }
    30% { opacity: 0.7; filter: blur(3px); }
    100% { transform: scale(1); opacity: 1; filter: blur(0); }
  }

  @keyframes crm-flash-settle {
    0% { filter: brightness(4.5) contrast(1.5) drop-shadow(0 0 35px rgba(255,255,255,0.9)); }
    25% { filter: brightness(1.8) contrast(1.2) drop-shadow(0 0 15px rgba(255,255,255,0.3)); }
    100% { filter: brightness(1) contrast(1) drop-shadow(0 2px 10px rgba(255,255,255,0.15)); }
  }
`;

const BOOKING_SCAN_STYLES = `
  @keyframes booking-shimmer-sweep {
    0% { background-position: 200% center; }
    100% { background-position: -200% center; }
  }
`;

function GradientWord({ children }) {
  return <>{children}</>;
}

function MonitoringHeadline({ playKey }) {
  return (
    <>
      <style>{MONITORING_HEADLINE_STYLES}</style>
      <div key={playKey} className="relative inline-block">
        <span
          className="absolute left-1/2 top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500"
          style={{ animation: 'monitoring-rec-dot-sequence 1.8s ease-in-out forwards' }}
        />
        <h2
          className="monitoring-merged-text relative inline-block bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text pb-2 text-5xl font-bold leading-[0.98] tracking-[-0.05em] text-transparent md:text-7xl lg:text-[5.1rem] xl:text-[5.4rem]"
          style={{
            animation: 'monitoring-rec-text-sequence 1.8s ease-in-out forwards',
            opacity: 0,
          }}
        >
          Live Call Monitoring
        </h2>
      </div>
    </>
  );
}

function CrmStunningWord({ shouldAnimate }) {
  const text = 'Stunning.';
  const animatedStyle = shouldAnimate
    ? {
        animationDuration: '1.2s',
        animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        animationIterationCount: 1,
        animationFillMode: 'forwards',
      }
    : null;

  return (
    <>
      <style>{CRM_STUNNING_STYLES}</style>
      <span aria-label={text} className="relative mx-[0.08em] inline-block overflow-visible align-baseline">
        <span aria-hidden="true" className="invisible inline-block">
          {text}
        </span>

        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 block overflow-visible"
          style={{ lineHeight: 'inherit' }}
        >
          <span
            className="absolute left-0 top-0 select-none text-[#ff0055] mix-blend-screen"
            style={{
              padding: '0.22em 0.16em 0.42em',
              margin: '-0.22em -0.16em -0.42em',
              lineHeight: 'inherit',
              ...(shouldAnimate ? { ...animatedStyle, animationName: 'crm-prism-red-move' } : { opacity: 0 }),
            }}
          >
            {text}
          </span>

          <span
            className="absolute left-0 top-0 select-none text-[#00ffcc] mix-blend-screen"
            style={{
              padding: '0.22em 0.16em 0.42em',
              margin: '-0.22em -0.16em -0.42em',
              lineHeight: 'inherit',
              ...(shouldAnimate ? { ...animatedStyle, animationName: 'crm-prism-blue-move' } : { opacity: 0 }),
            }}
          >
            {text}
          </span>

          <span
            className="relative inline-block bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(255,255,255,0.1)]"
            style={
              shouldAnimate
                ? {
                    padding: '0.22em 0.16em 0.42em',
                    margin: '-0.22em -0.16em -0.42em',
                    lineHeight: 'inherit',
                    animationName: 'crm-prism-green-move, crm-flash-settle',
                    animationDuration: '1.2s, 0.9s',
                    animationDelay: '0s, 0.24s',
                    animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1), ease-out',
                    animationIterationCount: '1, 1',
                    animationFillMode: 'forwards',
                  }
                : {
                    padding: '0.22em 0.16em 0.42em',
                    margin: '-0.22em -0.16em -0.42em',
                    lineHeight: 'inherit',
                  }
            }
          >
            {text}
          </span>
        </span>
      </span>
    </>
  );
}

const getTagColor = (tag) => TAG_COLORS[tag] || HERO_COLORS[0];
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function BookingReelWord({ playState }) {
  const [isScanning, setIsScanning] = useState(false);
  const text = 'Booking.';

  useEffect(() => {
    if (playState === 'resetting') {
      setIsScanning(false);
      return undefined;
    }

    if (playState !== 'playing') return undefined;

    setIsScanning(true);
    const timer = window.setTimeout(() => setIsScanning(false), 1500);
    return () => window.clearTimeout(timer);
  }, [playState]);

  return (
    <>
      <style>{BOOKING_SCAN_STYLES}</style>
      <span key={playState} className="relative inline-block select-none align-baseline">
        <span
          className="relative inline-block transition-colors duration-200"
          style={{ color: isScanning ? '#e4e4e7' : '#ffffff' }}
        >
          {text}
        </span>

        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 inline-block bg-clip-text text-transparent"
          style={{
            backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.1) 100%)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            opacity: isScanning ? 1 : 0,
            animation: isScanning ? 'booking-shimmer-sweep 1.5s cubic-bezier(0.4, 0, 0.2, 1) both' : undefined,
          }}
        >
          {text}
        </span>
      </span>
    </>
  );
}

const CalendarShowcase = ({ variant = 'calendar' }) => {
  const { rootRef, progress: sectionProgress } = useSectionScrollProgress({ mobileMinDelta: 0.0025 });
  const stickyRef = useRef(null);
  const [hasAnimatedDots, setHasAnimatedDots] = useState(false);
  const [bookingPlayState, setBookingPlayState] = useState('idle');
  const [demoResetState, setDemoResetState] = useState(null);
  const [demoInstanceKey, setDemoInstanceKey] = useState(0);
  const [demoPeopleCustomFields, setDemoPeopleCustomFields] = useState(DEMO_CUSTOM_FIELDS);
  const [scenarioAwaitingReentry, setScenarioAwaitingReentry] = useState(false);
  const [crmAwaitingReentry, setCrmAwaitingReentry] = useState(false);
  const [crmHeadlinePlayed, setCrmHeadlinePlayed] = useState(false);
  const [copyVisible, setCopyVisible] = useState(false);
  const [monitoringHeadlineKey, setMonitoringHeadlineKey] = useState(null);
  const monitoringHeadlinePlayedRef = useRef(false);
  const [compactCalendarCycle, setCompactCalendarCycle] = useState(0);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1440,
    height: typeof window !== 'undefined' ? window.innerHeight : 900,
  }));
  const isScenariosVariant = variant === 'scenarios';
  const isCrmVariant = variant === 'people-crm';
  const isCrmHeroVariant = variant === 'people-crm-hero';
  const isMonitoringVariant = variant === 'live-monitoring';
  const featureItems = isMonitoringVariant
    ? MONITORING_FEATURE_ITEMS
    : isCrmVariant
      ? CRM_FEATURE_ITEMS
      : isScenariosVariant
        ? SCENARIO_FEATURE_ITEMS
        : FEATURE_ITEMS;

  useEffect(() => {
    const root = rootRef.current;
    if (!root || copyVisible) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCopyVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0,
        rootMargin: '0px 0px -68% 0px',
      }
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, [copyVisible]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const updateViewportSize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateViewportSize();
    window.addEventListener('resize', updateViewportSize);
    return () => window.removeEventListener('resize', updateViewportSize);
  }, []);

  const isMobileViewport = viewportSize.width < 768;
  const isTabletViewport = viewportSize.width >= 768 && viewportSize.width < 1180;
  const scenarioDemoScale = isScenariosVariant
    ? Math.min(
        1,
        isMobileViewport
          ? Math.max(0.62, Math.min(viewportSize.width / 440, viewportSize.height / 980))
          : isTabletViewport
            ? Math.max(0.78, Math.min(viewportSize.width / 1120, viewportSize.height / 1040))
            : 1
      )
    : 1;

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
      }, 950);
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

  if (isCrmHeroVariant) {
    return (
      <div ref={rootRef} className="calendar-showcase relative h-[135vh] w-full bg-[#020202] md:h-[145vh]">
        <div ref={stickyRef} className="sticky top-0 flex h-screen items-center overflow-hidden bg-[#020202]">
          <div className="pointer-events-none absolute inset-0 opacity-[0.04] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:48px_48px]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_42%)]" />

          <div className="relative z-10 mx-auto w-full max-w-[1300px] px-6 text-center md:px-10 lg:px-12">
            <div className="mx-auto max-w-[1100px]">
              <h2 className={`homepage-copy-reveal bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text pb-2 text-4xl font-bold leading-[0.95] tracking-[-0.06em] text-transparent md:text-7xl lg:text-[6.2rem] ${copyVisible ? 'is-visible' : ''}`}>
                One. Stunning. CRM.
              </h2>
              <div className={`homepage-copy-reveal homepage-copy-reveal--delayed mx-auto mt-6 max-w-[820px] text-base font-semibold leading-[1.55] tracking-[-0.02em] text-[#d4d4d8] md:text-xl ${copyVisible ? 'is-visible' : ''}`}>
                Transform customer data into a beautiful, visual workspace built for <GradientWord>clarity</GradientWord>, organization, and control.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const featureStartProgress = 0.31;
  const calendarExited = sectionProgress >= featureStartProgress;
  const featureEntered = sectionProgress >= featureStartProgress;
  const featureProgress = featureEntered ? 1 : 0;
  const calendarOpacity = calendarExited ? 0 : 1;
  const featureOpacity = featureEntered ? 1 : 0;
  const isCompactBookingViewport = viewportSize.width < 1024;
  const mobileIntroExited = sectionProgress >= 0.24;
  const mobileCalendarEntered = sectionProgress >= 0.18;
  const mobileFeatureStartProgress = 0.56;
  const mobileCalendarExited = sectionProgress >= mobileFeatureStartProgress;
  const mobileFeatureEntered = sectionProgress >= mobileFeatureStartProgress;
  const bookingIntroOpacity = isCompactBookingViewport ? (mobileIntroExited ? 0 : 1) : 1;
  const bookingCalendarOpacity = isCompactBookingViewport
    ? (mobileCalendarEntered && !mobileCalendarExited ? 1 : 0)
    : calendarOpacity;
  const bookingFeatureOpacity = isCompactBookingViewport ? (mobileFeatureEntered ? 1 : 0) : featureOpacity;
  const bookingFeatureProgress = isCompactBookingViewport
    ? Math.min(1, Math.max(0, (sectionProgress - 0.62) / 0.3))
    : featureProgress;

  useEffect(() => {
    if (!isCompactBookingViewport) return;
    if (mobileCalendarEntered && !mobileCalendarExited) {
      setCompactCalendarCycle((prev) => prev + 1);
    }
  }, [isCompactBookingViewport, mobileCalendarEntered, mobileCalendarExited]);

  const handleDemoLimitExceeded = () => {
    if (isScenariosVariant) {
      setScenarioAwaitingReentry(true);
    }
    if (isCrmVariant) {
      setCrmAwaitingReentry(true);
    }
    setDemoResetState('message');
    window.setTimeout(() => {
      setDemoPeopleCustomFields(DEMO_CUSTOM_FIELDS);
      setDemoInstanceKey((prev) => prev + 1);
      setDemoResetState('intro');
    }, 1300);
    window.setTimeout(() => {
      setDemoResetState(null);
    }, 3400);
  };

  useEffect(() => {
    if (!isScenariosVariant || !scenarioAwaitingReentry) return;
    if (sectionProgress <= 0.18) {
      setScenarioAwaitingReentry(false);
    }
  }, [isScenariosVariant, scenarioAwaitingReentry, sectionProgress]);

  useEffect(() => {
    if (!isCrmVariant || !crmAwaitingReentry) return;
    if (sectionProgress <= 0.18) {
      setCrmAwaitingReentry(false);
    }
  }, [crmAwaitingReentry, isCrmVariant, sectionProgress]);

  useEffect(() => {
    if (!isCrmVariant || crmHeadlinePlayed) return;

    const root = rootRef.current;
    if (!root) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCrmHeadlinePlayed(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0,
        rootMargin: '0px 0px -72% 0px',
      }
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, [crmHeadlinePlayed, isCrmVariant]);

  useEffect(() => {
    if (!isMonitoringVariant) return;

    const root = rootRef.current;
    if (!root || monitoringHeadlinePlayedRef.current) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          monitoringHeadlinePlayedRef.current = true;
          setMonitoringHeadlineKey(0);
          observer.disconnect();
        }
      },
      {
        threshold: 0,
        rootMargin: '0px 0px -72% 0px',
      }
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, [isMonitoringVariant, sectionProgress]);

  if (isScenariosVariant || isCrmVariant || isMonitoringVariant) {
    const isCompactFeatureViewport = viewportSize.width < 1024;
    const introEntered = sectionProgress >= 0.16;
    const builderEntered = sectionProgress >= 0.22;
    const featuresEntered = isMonitoringVariant ? sectionProgress >= 0.44 : sectionProgress >= 0.68;
    const isMessageReset = isScenariosVariant && demoResetState === 'message';
    const isIntroReset = isScenariosVariant && demoResetState === 'intro';
    const isCrmMessageReset = isCrmVariant && demoResetState === 'message';
    const isCrmIntroReset = isCrmVariant && demoResetState === 'intro';
    const holdScenarioIntro = isScenariosVariant && scenarioAwaitingReentry && !isMessageReset;
    const holdCrmIntro = isCrmVariant && crmAwaitingReentry && !isCrmMessageReset;
    const introOpacity = isMonitoringVariant
      ? (featuresEntered ? 0 : 1)
      : isMessageReset || isCrmMessageReset ? 0 : isIntroReset || isCrmIntroReset || holdScenarioIntro || holdCrmIntro || !builderEntered ? 1 : 0;
    const scenariosFeatureProgress = featuresEntered ? 1 : 0;
    const compactFeaturesListProgress = isCompactFeatureViewport
      ? isMonitoringVariant
        ? Math.min(1, Math.max(0, (sectionProgress - 0.44) / 0.38))
        : Math.min(1, Math.max(0, (sectionProgress - 0.68) / 0.28))
      : scenariosFeatureProgress;
    const builderDimFactor = scenariosFeatureProgress > 0.01 ? (1 - scenariosFeatureProgress * 0.68) : 1;
    const builderOpacity = isMonitoringVariant || demoResetState || holdScenarioIntro || holdCrmIntro || !builderEntered ? 0 : builderDimFactor;
    const scenariosFeatureOpacity = isMonitoringVariant ? (featuresEntered ? 1 : 0) : isScenariosVariant && demoResetState ? 0 : holdScenarioIntro || holdCrmIntro ? 0 : featuresEntered ? 1 : 0;
    const builderBlur = (isScenariosVariant || isCrmVariant) && demoResetState ? 0 : scenariosFeatureProgress > 0.01 ? 3.5 + scenariosFeatureProgress * 7.5 : 0;
    const builderBrightness = (isScenariosVariant || isCrmVariant) && demoResetState ? 0 : scenariosFeatureProgress > 0.01 ? 0.82 - scenariosFeatureProgress * 0.58 : 1;
    const titleLines = isMonitoringVariant
      ? ['Live Call Monitoring']
      : isCrmVariant
      ? ['One.', 'CRM.']
      : ['Build Outbound Workflows'];
    const description = isMonitoringVariant ? (
      <>Monitor calls as they happen and review every conversation later with the context, <GradientWord>playback</GradientWord>, and history your team actually needs.</>
    ) : isCrmVariant ? (
      <>Transform customer data into a beautiful, visual workspace built for <GradientWord>clarity</GradientWord>, organization, and control.</>
    ) : (
      <>Create custom workflows that <GradientWord>automate</GradientWord> outbound calls, bookings, payments, follow-ups, and more, with triggers, conditions, and actions that keep everything moving automatically.</>
    );

    return (
      <div ref={rootRef} className={`calendar-showcase scenario-demo-showcase relative w-full ${isMonitoringVariant ? 'h-[215vh]' : 'h-[340vh]'}`}>
        <div ref={stickyRef} className="sticky top-0 h-screen overflow-hidden bg-[#020202]">
          <div
            className={`absolute inset-0 z-20 flex items-center justify-center px-6 transition-[opacity,transform] duration-500 ease-out ${
              introOpacity <= 0.01 ? 'pointer-events-none' : ''
            }`}
            style={{
              opacity: introOpacity,
              visibility: introOpacity <= 0.01 ? 'hidden' : 'visible',
              transform: `translateY(${builderEntered ? -12 : 0}px)`,
            }}
          >
            <div className="mx-auto max-w-[860px] px-2 text-center sm:px-4">
              {isMonitoringVariant ? (
                monitoringHeadlineKey !== null ? (
                  <div className={`homepage-copy-reveal ${copyVisible ? 'is-visible' : ''}`}>
                    <MonitoringHeadline playKey={monitoringHeadlineKey} />
                  </div>
                ) : (
                  <div className="min-h-[10rem]" />
                )
              ) : isCrmVariant ? (
                <h2 className={`homepage-copy-reveal mx-auto max-w-[10ch] text-balance pb-2 text-5xl font-bold leading-[0.98] tracking-[-0.05em] text-white sm:max-w-[12ch] md:text-7xl lg:max-w-none lg:text-[5.1rem] xl:text-[5.4rem] ${copyVisible ? 'is-visible' : ''}`}>
                  <span className="bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text text-transparent">
                    One.
                  </span>
                  {' '}
                  <CrmStunningWord shouldAnimate={crmHeadlinePlayed} />
                  {' '}
                  <span className="bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text text-transparent">
                    CRM.
                  </span>
                </h2>
              ) : (
                <h2 className={`homepage-copy-reveal bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text pb-2 text-5xl font-bold leading-[0.98] tracking-[-0.05em] text-transparent md:text-7xl ${copyVisible ? 'is-visible' : ''} ${isCrmVariant ? 'mx-auto max-w-[10ch] text-balance sm:max-w-[12ch] lg:max-w-none lg:text-[5.1rem] xl:text-[5.4rem]' : 'lg:text-[5.8rem]'}`}>
                  {titleLines.map((line, index) => (
                    <React.Fragment key={line}>
                      {line}
                      {!isCrmVariant && index < titleLines.length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </h2>
              )}
              <div className={`homepage-copy-reveal homepage-copy-reveal--delayed mx-auto text-base font-semibold leading-[1.55] tracking-[-0.02em] text-[#d4d4d8] md:text-xl ${copyVisible ? 'is-visible' : ''} ${isMonitoringVariant ? 'mt-2 max-w-[820px]' : 'mt-6 max-w-[760px]'}`}>
                {description}
              </div>
              {isMonitoringVariant && (
                <div className="mt-8 flex justify-center">
                  <Link to="/auth" state={{ isSignUp: true }} className="homepage-brand-cta">
                    Get Started
                    <ArrowRight size={16} strokeWidth={2.4} />
                  </Link>
                </div>
              )}
              {!isMonitoringVariant && !isCrmVariant && (
                <div className="mt-12 flex justify-center">
                  <Link to="/auth" state={{ isSignUp: true }} className="homepage-brand-cta">
                    Start Booking Calls
                    <ArrowRight size={16} strokeWidth={2.4} />
                  </Link>
                </div>
              )}
            </div>
          </div>

          {!isMonitoringVariant && (
            <div
              className={`absolute inset-0 z-10 transition-[opacity,transform] duration-500 ease-out ${
                builderOpacity <= 0.01 ? 'pointer-events-none' : ''
              }`}
              style={{
                opacity: builderOpacity,
                visibility: builderOpacity <= 0.01 ? 'hidden' : 'visible',
                transform: `translateY(${builderEntered ? 0 : 18}px)`,
                filter: `blur(${builderBlur}px) brightness(${builderBrightness}) saturate(0.88)`,
              }}
            >
              {isCrmVariant ? (
                <HomepagePeopleCrmDemo
                  key={demoInstanceKey}
                  className="homepage-crm-demo"
                  entranceActive={builderEntered && builderOpacity > 0.01}
                  onDemoLimitExceeded={handleDemoLimitExceeded}
                  onDemoSchemaChange={({ customFields } = {}) => {
                    setDemoPeopleCustomFields(Array.isArray(customFields) ? customFields : []);
                  }}
                />
              ) : (
                <div
                  className="homepage-scenarios-builder-frame"
                  style={{
                    transform: `scale(${scenarioDemoScale})`,
                    transformOrigin: 'center center',
                  }}
                >
                  <HomepageScenariosDemo
                    key={demoInstanceKey}
                    demoMode
                    demoMaxNodes={4}
                    demoPeopleCustomFields={demoPeopleCustomFields}
                    onDemoLimitExceeded={handleDemoLimitExceeded}
                    className="homepage-scenarios-builder"
                  />
                </div>
              )}
            </div>
          )}

          {!isMonitoringVariant && (
            <div
              className={`absolute inset-0 z-30 flex items-center justify-center bg-[#020202] px-6 transition-opacity duration-300 ${
                isMessageReset || isCrmMessageReset ? '' : 'pointer-events-none'
              }`}
              style={{
                opacity: isMessageReset || isCrmMessageReset ? 1 : 0,
                visibility: isMessageReset || isCrmMessageReset ? 'visible' : 'hidden',
              }}
            >
              <div className="bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text text-center text-4xl font-bold tracking-[-0.04em] text-transparent md:text-7xl">
                You get the idea.
              </div>
            </div>
          )}

          <div
            className={`absolute inset-0 z-20 flex items-center justify-center px-6 transition-[opacity,transform] duration-500 ease-out ${
              scenariosFeatureOpacity <= 0.01 ? 'pointer-events-none' : ''
            }`}
            style={{
              opacity: scenariosFeatureOpacity,
              visibility: scenariosFeatureOpacity <= 0.01 ? 'hidden' : 'visible',
              transform: `translateY(${featuresEntered ? 0 : 18}px)`,
            }}
          >
            <div className="mx-auto w-full max-w-[1120px]">
              <RightFeatureList
                featureProgress={compactFeaturesListProgress}
                items={featureItems}
                useScrollHighlight={isCompactFeatureViewport}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="calendar-showcase relative h-[285vh] w-full lg:h-[285vh]">
      <div ref={stickyRef} className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="relative z-10 mx-auto w-full max-w-[1300px] px-6 md:px-10 lg:px-12">
          <div className="calendar-booking-layout grid min-h-[700px] grid-cols-1 items-center gap-8 md:gap-10 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)] lg:gap-24">
            <div
              className={`booking-copy-panel flex min-h-[210px] items-center justify-center transition-[opacity,transform] duration-500 ease-out md:min-h-[230px] lg:min-h-[300px] lg:justify-start ${
                bookingIntroOpacity <= 0.01 ? 'pointer-events-none' : ''
              }`}
              style={{
                opacity: bookingIntroOpacity,
                visibility: bookingIntroOpacity <= 0.01 ? 'hidden' : 'visible',
                transform: isCompactBookingViewport ? `translateY(${mobileIntroExited ? -16 : 0}px)` : 'none',
              }}
            >
              <div className="text-center lg:text-left">
                <h2 className={`homepage-copy-reveal pb-1 text-5xl font-bold leading-[0.98] tracking-[-0.05em] text-white md:text-7xl lg:text-[4rem] lg:pb-2 ${copyVisible ? 'is-visible' : ''}`}>
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
                    </>
                  )}
                </h2>
                <div className={`homepage-copy-reveal homepage-copy-reveal--delayed calendar-showcase-description mx-auto mt-6 max-w-[24rem] text-base font-semibold leading-[1.45] tracking-[-0.02em] text-[#d4d4d8] md:mx-auto md:max-w-[36rem] md:text-center md:text-[1.1rem] md:leading-[1.55] lg:mx-0 lg:max-w-[24rem] lg:text-left lg:text-base lg:leading-[1.45] ${copyVisible ? 'is-visible' : ''}`}>
                  {isScenariosVariant ? (
                    <>Build the exact workflows your business needs with triggers, branching logic, live variables, and actions that run across calls, records, appointments, payments, and <GradientWord>follow-ups</GradientWord>.</>
                  ) : (
                    <>Turn conversations into booked appointments. Your AI receptionist answers instantly, checks real-time staff availability, books and reschedules appointments, and more. No hold times, no missed opportunities, just a calendar that keeps filling itself.</>
                  )}
                </div>
              </div>
            </div>

            <div className="booking-visual-panel flex items-center justify-center lg:justify-start">
              <div className="relative h-[calc(100vh-120px)] w-full max-w-[720px] sm:h-[calc(100vh-132px)] md:h-[calc(100vh-150px)] lg:h-[680px]">
                <div
                  className={`absolute inset-0 transition-[opacity,transform] duration-300 ease-out ${
                    bookingCalendarOpacity <= 0.01 ? 'pointer-events-none' : ''
                  }`}
                  style={{
                    opacity: bookingCalendarOpacity,
                    visibility: bookingCalendarOpacity <= 0.01 ? 'hidden' : 'visible',
                    transform: isCompactBookingViewport
                      ? `translateY(${mobileCalendarEntered ? 0 : 18}px) scale(${mobileCalendarEntered ? 1 : 0.99})`
                      : `translateY(${calendarExited ? -14 : 0}px) scale(${calendarExited ? 0.988 : 1})`,
                  }}
                >
                  <RightCalendarGrid
                    key={isCompactBookingViewport ? `compact-calendar-${compactCalendarCycle}` : 'desktop-calendar'}
                    hasAnimatedDots={hasAnimatedDots}
                    calendarVisible={bookingCalendarOpacity > 0.98}
                  />
                </div>

                <div
                  className={`absolute inset-0 transition-[opacity,transform] duration-500 ease-out ${
                    bookingFeatureOpacity <= 0.01 ? 'pointer-events-none' : ''
                  }`}
                  style={{
                    opacity: bookingFeatureOpacity,
                    visibility: bookingFeatureOpacity <= 0.01 ? 'hidden' : 'visible',
                    transform: `translateY(${(isCompactBookingViewport ? mobileFeatureEntered : featureEntered) ? 0 : 18}px)`,
                  }}
                >
                  <RightFeatureList
                    featureProgress={bookingFeatureProgress}
                    items={featureItems}
                    useScrollHighlight={isCompactBookingViewport}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export function RightFeatureList({ featureProgress, items, useScrollHighlight = false, mobilePageSize = null, mobileMaxItems = null }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isMobileFeatureViewport, setIsMobileFeatureViewport] = useState(false);
  const isVisible = featureProgress > 0.01;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(hover: none), (pointer: coarse)');
    const updateTouchState = () => setIsTouchDevice(mediaQuery.matches);

    updateTouchState();
    mediaQuery.addEventListener?.('change', updateTouchState);
    return () => mediaQuery.removeEventListener?.('change', updateTouchState);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const updateViewport = () => {
      setIsMobileFeatureViewport(window.innerWidth < 768);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
    };
  }, []);

  const shouldUseScrollHighlight = useScrollHighlight || isTouchDevice;
  const visibleItems = mobileMaxItems && isMobileFeatureViewport ? items.slice(0, mobileMaxItems) : items;
  const isMobilePagedList = Boolean(mobilePageSize && isMobileFeatureViewport && visibleItems.length > mobilePageSize);
  const pageCount = isMobilePagedList ? Math.ceil(visibleItems.length / mobilePageSize) : 1;
  const activeItemCount = isMobilePagedList ? visibleItems.length : items.length;
  const touchActiveIndex = shouldUseScrollHighlight && isVisible
    ? Math.min(activeItemCount - 1, Math.max(0, Math.floor(featureProgress * activeItemCount)))
    : null;
  const activePageIndex = isMobilePagedList
    ? Math.min(pageCount - 1, Math.max(0, Math.floor(touchActiveIndex / mobilePageSize)))
    : 0;
  const renderFeatureRow = (item, index) => {
    const rowVisible = shouldUseScrollHighlight ? isVisible : isVisible && featureProgress > 0.12 + index * 0.11;
    const isHovered = hoveredIndex === index;
    const isTouchHighlighted = shouldUseScrollHighlight && touchActiveIndex === index;
    const isHighlighted = isHovered || isTouchHighlighted;

    return (
      <div
        key={item.title}
        onMouseEnter={() => !shouldUseScrollHighlight && setHoveredIndex(index)}
        onMouseLeave={() => !shouldUseScrollHighlight && setHoveredIndex(null)}
        className="feature-reveal-row group relative flex cursor-pointer flex-col justify-between border-b border-zinc-900/40 py-4 transition-all duration-300 ease-out md:flex-row md:items-center md:gap-10 md:py-5 lg:gap-0"
        style={{
          opacity: rowVisible ? 1 : 0,
          transform: rowVisible ? 'translateY(0)' : 'translateY(18px)',
          transition: shouldUseScrollHighlight
            ? `opacity 420ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 80}ms, transform 420ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 80}ms`
            : `opacity 520ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 120}ms, transform 520ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 120}ms`,
        }}
      >
        <div
          className={`feature-reveal-row__bg absolute inset-y-0.5 -inset-x-3 -z-10 rounded-lg bg-zinc-900/[0.12] opacity-0 transition-all duration-300 ease-out ${
            isHighlighted ? 'scale-100 opacity-100' : 'scale-[0.98]'
          }`}
        />

        <div
          className={`feature-reveal-row__heading flex items-center gap-4 transition-transform duration-300 ease-out md:min-w-[280px] md:gap-5 lg:min-w-0 ${
            isHighlighted ? 'translate-x-1.5' : ''
          }`}
        >
          <div className="feature-reveal-row__dot-wrap relative flex h-3 w-3 items-center justify-center">
            <span
              className={`feature-reveal-row__dot absolute h-1.5 w-1.5 rounded-full transition-all duration-300 ease-out ${
                isHighlighted ? 'is-highlighted scale-110 opacity-100' : 'scale-75 opacity-30'
              }`}
            />
          </div>

          <div
            className={`feature-reveal-row__icon flex items-center justify-center overflow-visible transition-all duration-300 ${
              isHighlighted ? 'scale-110' : 'text-zinc-600'
            } ${isHighlighted ? 'is-highlighted' : ''}`}
          >
            {item.icon}
          </div>

          <div
            className={`feature-reveal-row__title text-xl font-black tracking-tighter uppercase text-zinc-100 transition-colors duration-300 md:text-[1.35rem] lg:text-2xl ${isHighlighted ? 'is-highlighted' : ''}`}
          >
            {item.title}
          </div>
        </div>

        <div
          className={`feature-reveal-row__copy-wrap mt-2 w-full pl-7 transition-transform duration-300 ease-out md:mt-0 md:max-w-[26rem] md:pl-0 lg:max-w-sm ${
            isHighlighted ? 'translate-x-1' : ''
          }`}
        >
          <div className="homepage-feature-copy text-xs font-medium leading-relaxed tracking-tight text-zinc-400 md:text-[13px] lg:text-xs">
            {item.copy}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full w-full items-center">
      <svg className="pointer-events-none absolute h-0 w-0" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="homepage-feature-icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--brandGradientStart)" />
            <stop offset="100%" stopColor="var(--brandGradientEnd)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="homepage-feature-list mx-auto w-full max-w-[820px] text-left md:max-w-[940px] lg:max-w-[820px]">
        <div className={isMobilePagedList ? 'homepage-feature-pages' : 'flex flex-col'}>
          {isMobilePagedList
            ? Array.from({ length: pageCount }, (_, pageIndex) => {
              const pageItems = visibleItems.slice(pageIndex * mobilePageSize, pageIndex * mobilePageSize + mobilePageSize);
              return (
                <div
                  key={`feature-page-${pageIndex}`}
                  className={`homepage-feature-page flex flex-col ${activePageIndex === pageIndex ? 'is-active' : ''}`}
                  aria-hidden={activePageIndex !== pageIndex}
                >
                  {pageItems.map((item, itemIndex) => renderFeatureRow(item, pageIndex * mobilePageSize + itemIndex))}
                </div>
              );
            })
            : items.map((item, index) => renderFeatureRow(item, index))}
        </div>
      </div>
    </div>
  );
}

function RightCalendarGrid({ hasAnimatedDots, calendarVisible = true }) {
  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();
  const daysInCurrentMonth = useMemo(
    () => new Date(currentYear, currentMonth + 1, 0).getDate(),
    [currentYear, currentMonth]
  );
  const firstDayOffset = useMemo(
    () => (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7,
    [currentYear, currentMonth]
  );
  const monthYearLabel = useMemo(
    () => today.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    [today]
  );
  const monthLabel = useMemo(
    () => today.toLocaleDateString(undefined, { month: 'long' }),
    [today]
  );
  const [selectedDay, setSelectedDay] = useState(currentDay);
  const [expandedAppointmentId, setExpandedAppointmentId] = useState(null);
  const [activeAppointmentActionsId, setActiveAppointmentActionsId] = useState(null);
  const [activeAppointmentPrompt, setActiveAppointmentPrompt] = useState(null);
  const [showAvatarHint, setShowAvatarHint] = useState(false);
  const [showAvatarHintReturn, setShowAvatarHintReturn] = useState(false);
  const [visibleDotAnimationsComplete, setVisibleDotAnimationsComplete] = useState(false);
  const [appointmentAnimationsComplete, setAppointmentAnimationsComplete] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1440));
  const [receptionists, setReceptionists] = useState(FALLBACK_RECEPTIONISTS);
  const calendarGridRef = useRef(null);
  const avatarHintShownRef = useRef(false);
  const visibleDotAnimationCountRef = useRef(0);
  const completedVisibleDotAnimationsRef = useRef(new Set());
  const completedAppointmentAnimationsRef = useRef(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    updateViewportWidth();
    window.addEventListener('resize', updateViewportWidth);
    return () => window.removeEventListener('resize', updateViewportWidth);
  }, []);

  useEffect(() => {
    setExpandedAppointmentId(null);
    setActiveAppointmentActionsId(null);
    setActiveAppointmentPrompt(null);
    setVisibleDotAnimationsComplete(false);
    setAppointmentAnimationsComplete(false);
    setShowAvatarHint(false);
    completedVisibleDotAnimationsRef.current = new Set();
    completedAppointmentAnimationsRef.current = new Set();
  }, [selectedDay]);

  useEffect(() => {
    let cancelled = false;

    const loadReceptionists = async () => {
      try {
        const { data, error } = await supabase
          .from('receptionist_catalog')
          .select('id, full_name, first_name, avatar, banner_id')
          .order('full_name', { ascending: true });

        if (cancelled) return;
        if (error) throw error;

        const catalogReceptionists = (data || []).filter((row) => row?.avatar);
        if (catalogReceptionists.length > 0) {
          setReceptionists(catalogReceptionists);
        }
      } catch (error) {
        console.warn('[CalendarShowcase] Failed to load receptionist catalog:', error);
      }
    };

    loadReceptionists();
    return () => {
      cancelled = true;
    };
  }, []);

  const isMobile = viewportWidth < 768;
  const isCompact = viewportWidth < 1180;
  const shouldRevealCalendarDetails = hasAnimatedDots && calendarVisible;

  const itemsDatabase = useMemo(
    () => ({
      1: [
        { title: 'Color Consultation', category: 'Color', time: '9:00 AM', tagColor: getTagColor('Color') },
        { title: 'Haircut Appointment', category: 'Haircut', time: '1:30 PM', tagColor: getTagColor('Haircut') },
      ],
      2: [
        { title: 'Styling Appointment', category: 'Styling', time: '11:00 AM', tagColor: getTagColor('Styling') },
        { title: 'Blowout Appointment', category: 'Blowout', time: '4:15 PM', tagColor: getTagColor('Blowout') },
      ],
      3: [
        { title: 'Root Touch-Up', category: 'Color', time: '9:30 AM', tagColor: getTagColor('Color') },
        { title: 'Styling Consult', category: 'Styling', time: '1:00 PM', tagColor: getTagColor('Styling') },
        { title: 'Trim Appointment', category: 'Haircut', time: '5:00 PM', tagColor: getTagColor('Haircut') },
      ],
      4: [
        { title: 'Gloss Refresh', category: 'Color', time: '12:30 PM', tagColor: getTagColor('Color') },
        { title: 'Event Styling', category: 'Styling', time: '3:45 PM', tagColor: getTagColor('Styling') },
      ],
      5: [
        { title: 'Haircut Appointment', category: 'Haircut', time: '10:15 AM', tagColor: getTagColor('Haircut') },
        { title: 'Color Refresh', category: 'Color', time: '2:45 PM', tagColor: getTagColor('Color') },
      ],
      6: [
        { title: 'Root Touch-Up', category: 'Color', time: '8:45 AM', tagColor: getTagColor('Color') },
        { title: 'Blowout Appointment', category: 'Blowout', time: '10:00 AM', tagColor: getTagColor('Blowout') },
        { title: 'Haircut & Style', category: 'Styling', time: '3:00 PM', tagColor: getTagColor('Styling') },
      ],
      7: [
        { title: 'Blowout Appointment', category: 'Blowout', time: '12:00 PM', tagColor: getTagColor('Blowout') },
        { title: 'Bridal Trial', category: 'Bridal', time: '2:30 PM', tagColor: getTagColor('Bridal') },
      ],
      8: [
        { title: 'Haircut Appointment', category: 'Haircut', time: '9:15 AM', tagColor: getTagColor('Haircut') },
        { title: 'Color Refresh', category: 'Color', time: '11:15 AM', tagColor: getTagColor('Color') },
        { title: 'Trim Appointment', category: 'Haircut', time: '4:45 PM', tagColor: getTagColor('Haircut') },
      ],
      9: [
        { title: 'Color Appointment', category: 'Color', time: '10:30 AM', tagColor: getTagColor('Color') },
        { title: 'Blowout Appointment', category: 'Blowout', time: '3:30 PM', tagColor: getTagColor('Blowout') },
      ],
      10: [
        { title: 'Balayage Session', category: 'Color', time: '9:00 AM', tagColor: getTagColor('Color') },
        { title: 'Haircut Appointment', category: 'Haircut', time: '11:45 AM', tagColor: getTagColor('Haircut') },
        { title: 'Styling Appointment', category: 'Styling', time: '2:00 PM', tagColor: getTagColor('Styling') },
        { title: 'Blowout Appointment', category: 'Blowout', time: '5:15 PM', tagColor: getTagColor('Blowout') },
      ],
      11: [
        { title: 'Color Consultation', category: 'Color', time: '9:45 AM', tagColor: getTagColor('Color') },
        { title: 'Trim Appointment', category: 'Haircut', time: '1:15 PM', tagColor: getTagColor('Haircut') },
      ],
      12: [
        { title: 'Haircut Appointment', category: 'Haircut', time: '10:00 AM', tagColor: getTagColor('Haircut') },
        { title: 'Styling Appointment', category: 'Styling', time: '4:00 PM', tagColor: getTagColor('Styling') },
      ],
      13: [
        { title: 'Bridal Trial', category: 'Bridal', time: '11:00 AM', tagColor: getTagColor('Bridal') },
        { title: 'Color Appointment', category: 'Color', time: '3:15 PM', tagColor: getTagColor('Color') },
        { title: 'Blowout Appointment', category: 'Blowout', time: '5:30 PM', tagColor: getTagColor('Blowout') },
      ],
      14: [
        { title: 'Styling Appointment', category: 'Styling', time: '9:30 AM', tagColor: getTagColor('Styling') },
        { title: 'Root Touch-Up', category: 'Color', time: '1:45 PM', tagColor: getTagColor('Color') },
      ],
      15: [
        { title: 'Hair Coloring Appointment', category: 'Color', time: '11:00 AM', tagColor: getTagColor('Color') },
        { title: 'Trim Appointment', category: 'Haircut', time: '12:45 PM', tagColor: getTagColor('Haircut') },
        { title: 'Haircut & Style', category: 'Styling', time: '2:30 PM', tagColor: getTagColor('Styling') },
        { title: 'Blowout Appointment', category: 'Blowout', time: '5:30 PM', tagColor: getTagColor('Blowout') },
      ],
      16: [
        { title: 'Root Touch-Up', category: 'Color', time: '11:45 AM', tagColor: getTagColor('Color') },
        { title: 'Blowout Appointment', category: 'Blowout', time: '3:15 PM', tagColor: getTagColor('Blowout') },
      ],
      17: [
        { title: 'Hair Styling Appointment', category: 'Styling', time: 'All Day', tagColor: getTagColor('Styling') },
        { title: 'Color Refresh', category: 'Color', time: '10:30 AM', tagColor: getTagColor('Color') },
      ],
      18: [
        { title: 'Haircut Appointment', category: 'Haircut', time: '9:30 AM', tagColor: getTagColor('Haircut') },
        { title: 'Event Styling', category: 'Styling', time: '2:15 PM', tagColor: getTagColor('Styling') },
      ],
      19: [
        { title: 'Haircut & Style', category: 'Styling', time: '10:00 AM', tagColor: getTagColor('Styling') },
        { title: 'Gloss Refresh', category: 'Color', time: '3:00 PM', tagColor: getTagColor('Color') },
      ],
      20: [
        { title: 'Blowout Appointment', category: 'Blowout', time: '1:00 PM', tagColor: getTagColor('Blowout') },
        { title: 'Trim Appointment', category: 'Haircut', time: '4:30 PM', tagColor: getTagColor('Haircut') },
      ],
      21: [
        { title: 'Root Touch-Up', category: 'Color', time: '9:15 AM', tagColor: getTagColor('Color') },
        { title: 'Color Refresh', category: 'Color', time: '3:30 PM', tagColor: getTagColor('Color') },
      ],
      22: [
        { title: 'Hair Color Appointment', category: 'Color', time: '9:00 AM', tagColor: getTagColor('Color') },
        { title: 'Haircut Appointment', category: 'Haircut', time: '12:15 PM', tagColor: getTagColor('Haircut') },
        { title: 'Styling Consult', category: 'Styling', time: '4:45 PM', tagColor: getTagColor('Styling') },
      ],
      23: [
        { title: 'Styling Appointment', category: 'Styling', time: '9:15 AM', tagColor: getTagColor('Styling') },
        { title: 'Blowout Appointment', category: 'Blowout', time: '1:30 PM', tagColor: getTagColor('Blowout') },
      ],
      24: [
        { title: 'Blowout Appointment', category: 'Blowout', time: '9:45 AM', tagColor: getTagColor('Blowout') },
        { title: 'Root Touch-Up', category: 'Color', time: '2:15 PM', tagColor: getTagColor('Color') },
      ],
      25: [
        { title: 'Balayage Session', category: 'Color', time: '9:30 AM', tagColor: getTagColor('Color') },
        { title: 'Haircut & Style', category: 'Styling', time: '1:00 PM', tagColor: getTagColor('Styling') },
        { title: 'Blowout Appointment', category: 'Blowout', time: '5:00 PM', tagColor: getTagColor('Blowout') },
      ],
      26: [
        { title: 'Haircut Appointment', category: 'Haircut', time: '10:30 AM', tagColor: getTagColor('Haircut') },
        { title: 'Color Consultation', category: 'Color', time: '2:00 PM', tagColor: getTagColor('Color') },
      ],
      27: [
        { title: 'Root Touch-Up', category: 'Color', time: '11:00 AM', tagColor: getTagColor('Color') },
        { title: 'Haircut Appointment', category: 'Haircut', time: '4:00 PM', tagColor: getTagColor('Haircut') },
      ],
      28: [
        { title: 'Bridal Trial', category: 'Bridal', time: '8:45 AM', tagColor: getTagColor('Bridal') },
        { title: 'Styling Appointment', category: 'Styling', time: '10:45 AM', tagColor: getTagColor('Styling') },
        { title: 'Color Appointment', category: 'Color', time: '4:30 PM', tagColor: getTagColor('Color') },
      ],
      29: [
        { title: 'Haircut Appointment', category: 'Haircut', time: '9:45 AM', tagColor: getTagColor('Haircut') },
        { title: 'Color Refresh', category: 'Color', time: '12:30 PM', tagColor: getTagColor('Color') },
      ],
      30: [
        { title: 'Blowout Appointment', category: 'Blowout', time: '10:15 AM', tagColor: getTagColor('Blowout') },
        { title: 'Styling Appointment', category: 'Styling', time: '3:45 PM', tagColor: getTagColor('Styling') },
      ],
      31: [
        { title: 'Root Touch-Up', category: 'Color', time: '9:00 AM', tagColor: getTagColor('Color') },
        { title: 'Haircut & Style', category: 'Styling', time: '1:15 PM', tagColor: getTagColor('Styling') },
        { title: 'Blowout Appointment', category: 'Blowout', time: '4:30 PM', tagColor: getTagColor('Blowout') },
      ],
    }),
    []
  );

  const displayItemsDatabase = useMemo(() => {
    const todayItems = itemsDatabase[24] || [];
    const displayedItems = {
      ...itemsDatabase,
      [currentDay]: todayItems,
    };

    return Object.fromEntries(
      Object.entries(displayedItems).filter(([day]) => (
        new Date(currentYear, currentMonth, Number(day)).getDay() !== 0
      ))
    );
  }, [itemsDatabase, currentDay, currentMonth, currentYear]);

  const assignedItemsDatabase = useMemo(() => {
    const pool = receptionists.length > 0 ? receptionists : FALLBACK_RECEPTIONISTS;

    const hashSeed = (value) => {
      const text = String(value || '');
      let hash = 0;
      for (let i = 0; i < text.length; i += 1) {
        hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
      }
      return hash;
    };
    const findReceptionistByName = (name) => (
      pool.find((receptionist) => {
        const firstName = String(receptionist?.first_name || '').trim().toLowerCase();
        const fullName = String(receptionist?.full_name || '').trim().toLowerCase();
        return firstName === name || fullName === name;
      })
    );
    const defaultReceptionistAssignments = [
      findReceptionistByName('maggie'),
      findReceptionistByName('bonnie'),
    ];
    const getAppointmentNote = (event, day, index) => {
      const notesByTitle = {
        'Color Consultation': 'New guest is deciding between warm brunette gloss and a low-maintenance balayage. Mention patch test timing and take before photos.',
        'Styling Appointment': 'Client is attending a work dinner after the appointment. Prefers polished waves with soft volume and no heavy finishing spray.',
        'Root Touch-Up': 'Use saved formula from the last color visit and focus on the hairline. Client is sensitive to toner sitting too long.',
        'Styling Consult': 'Wants help choosing a style for engagement photos. Bring up humidity-friendly options and pin one reference photo.',
        'Haircut Appointment': 'Prefers keeping length through the front with light face framing. Confirm before removing more than one inch.',
        'Blowout Appointment': 'Client likes long-lasting volume at the crown and a smooth finish. Offer round-brush curls instead of flat iron waves.',
        'Haircut & Style': 'Usually books before travel. Keep layers blended and leave enough length for easy ponytails.',
        'Color Refresh': 'Refresh gloss and brighten around the face only. Avoid pulling color through dry ends unless needed.',
        'Color Appointment': 'Client asked for a natural result that grows out softly. Review maintenance schedule before mixing color.',
        'Balayage Session': 'Returning guest wants brighter ribbons around the face while keeping depth underneath. Schedule enough time for a careful gloss.',
        'Bridal Trial': 'Bride wants soft romantic texture with pieces left around the face. Take photos from front, side, and back for wedding-day notes.',
        'Hair Coloring Appointment': 'Client mentioned previous color faded warm. Use cooler gloss and recommend color-safe shampoo at checkout.',
        'Hair Color Appointment': 'Confirm whether client wants full refresh or root-only service before starting. Add extra time if ends need gloss.',
        'Trim Appointment': 'Client is growing hair out and only wants a cleanup. Keep the perimeter full.',
      };

      return notesByTitle[event.title] || `Demo note ${index + 1} for day ${day}: confirm service goals, timing, and any customer preferences before starting.`;
    };
    const getAppointmentStatus = (event, day, index) => {
      const statuses = ['Completed', 'Booked', 'Confirmed', 'Cancelled'];
      if (Number(day) === 24) {
        return index === 0 ? 'Booked' : 'Confirmed';
      }

      return statuses[hashSeed(`${day}-${event.title}-${event.time}-${index}-status`) % statuses.length];
    };

    return Object.fromEntries(
      Object.entries(displayItemsDatabase).map(([day, events]) => [
        day,
        (events || []).map((event, index) => {
          const seedDay = Number(day) === currentDay ? 24 : day;
          const poolIndex = hashSeed(`${seedDay}-${event.title}-${event.time}-${index}`) % pool.length;
          const customerIndex = hashSeed(`${seedDay}-${event.title}-${event.time}-${index}-customer`) % DEMO_CUSTOMER_FIRST_NAMES.length;
          const receptionist = Number(seedDay) === 24
            ? (defaultReceptionistAssignments[index] || pool[poolIndex])
            : pool[poolIndex];
          const status = getAppointmentStatus(event, seedDay, index);
          return {
            ...event,
            id: `demo-${day}-${index}`,
            serviceName: event.title,
            status,
            statusColor: DEMO_APPOINTMENT_STATUS_COLORS[status] || DEMO_APPOINTMENT_STATUS_COLORS.Booked,
            notes: getAppointmentNote(event, seedDay, index),
            customerFirstName: DEMO_CUSTOMER_FIRST_NAMES[customerIndex],
            receptionistName: receptionist?.first_name || receptionist?.full_name || 'Receptionist',
            receptionistAvatar: receptionist?.avatar || '',
            receptionistBannerUrl: receptionist?.banner_url || getReceptionistBannerUrl(receptionist?.banner_id) || receptionist?.avatar || '',
          };
        }),
      ])
    );
  }, [currentDay, displayItemsDatabase, receptionists]);

  const selectedAppointments = assignedItemsDatabase[selectedDay] || [];
  const visibleDotAnimationTotal = useMemo(
    () => Object.values(assignedItemsDatabase).reduce((total, events) => total + (events?.length || 0), 0),
    [assignedItemsDatabase]
  );

  useEffect(() => {
    visibleDotAnimationCountRef.current = visibleDotAnimationTotal;
    if (!shouldRevealCalendarDetails || visibleDotAnimationTotal === 0) return;
    setVisibleDotAnimationsComplete(false);
    completedVisibleDotAnimationsRef.current = new Set();
  }, [shouldRevealCalendarDetails, visibleDotAnimationTotal]);

  useEffect(() => {
    if (!calendarVisible) {
      avatarHintShownRef.current = false;
      setShowAvatarHint(false);
      setShowAvatarHintReturn(false);
      setAppointmentAnimationsComplete(false);
      setVisibleDotAnimationsComplete(false);
      completedAppointmentAnimationsRef.current = new Set();
      completedVisibleDotAnimationsRef.current = new Set();
      return;
    }
    if (selectedAppointments.length === 0) {
      setAppointmentAnimationsComplete(true);
      return;
    }
    setAppointmentAnimationsComplete(false);
    completedAppointmentAnimationsRef.current = new Set();
  }, [calendarVisible, selectedAppointments]);

  useEffect(() => {
    if (!shouldRevealCalendarDetails || avatarHintShownRef.current) return undefined;

    let hintTimer = null;
    let avatarReturnTimer = null;
    let cancelled = false;

    const startHint = () => {
      if (cancelled || avatarHintShownRef.current) return;
      const root = calendarGridRef.current;
      const avatarTarget = root?.querySelector('.demo-calendar-avatar-trigger');
      const avatarRect = avatarTarget?.getBoundingClientRect();

      if (!avatarTarget || !avatarRect || avatarRect.width <= 0 || avatarRect.height <= 0) return;

      avatarHintShownRef.current = true;
      setShowAvatarHint(true);
      setShowAvatarHintReturn(false);
      hintTimer = window.setTimeout(() => {
        setShowAvatarHint(false);
        setShowAvatarHintReturn(true);
        avatarReturnTimer = window.setTimeout(() => {
          setShowAvatarHintReturn(false);
        }, 520);
      }, 1600);
    };

    if (visibleDotAnimationsComplete && appointmentAnimationsComplete) {
      hintTimer = window.setTimeout(startHint, 560);
    } else {
      hintTimer = window.setTimeout(startHint, 1550);
    }

    return () => {
      cancelled = true;
      if (hintTimer !== null) window.clearTimeout(hintTimer);
      if (avatarReturnTimer !== null) window.clearTimeout(avatarReturnTimer);
    };
  }, [appointmentAnimationsComplete, shouldRevealCalendarDetails, visibleDotAnimationsComplete]);

  const handleVisibleDotAnimationEnd = (dotKey, animationEvent) => {
    if (animationEvent.animationName !== 'starlightShimmer') return;
    completedVisibleDotAnimationsRef.current.add(dotKey);
    if (completedVisibleDotAnimationsRef.current.size >= visibleDotAnimationCountRef.current) {
      setVisibleDotAnimationsComplete(true);
    }
  };

  const handleAppointmentAnimationEnd = (appointmentId, animationEvent) => {
    if (animationEvent.animationName !== 'agendaCascade') return;
    completedAppointmentAnimationsRef.current.add(appointmentId);
    if (completedAppointmentAnimationsRef.current.size >= selectedAppointments.length) {
      setAppointmentAnimationsComplete(true);
    }
  };

  return (
    <div ref={calendarGridRef} className="relative flex h-full w-full items-center">
      <div className={`relative isolate w-full overflow-hidden border border-white/[0.08] bg-[#0b0b0c]/95 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.95)] ${isCompact ? 'rounded-[22px] p-3 sm:p-4 md:p-5' : 'rounded-[28px] p-10'}`}>
        <div className={`relative z-10 border-b border-white/5 text-left ${isCompact ? 'mb-3 pb-3 md:mb-4 md:pb-4' : 'mb-6 pb-6'}`}>
          <span className={`flex items-center space-x-2 font-bold tracking-tight text-white ${isMobile ? 'text-[1rem]' : isCompact ? 'text-[1.25rem]' : 'text-[2rem]'}`}>
            <CalendarIcon className="text-zinc-300" size={22} />
            <span>{monthYearLabel}</span>
          </span>
        </div>

        <div className={`relative z-10 mb-2 grid grid-cols-7 text-center ${isCompact ? 'gap-1 md:gap-1.5' : 'gap-2'}`}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
            <span key={`${day}-${index}`} className={`py-1 font-bold uppercase tracking-widest text-zinc-500 ${isMobile ? 'text-[8px]' : isCompact ? 'text-[9px]' : 'text-[10px]'}`}>
              {day}
            </span>
          ))}
        </div>

        <div className={`relative z-10 grid grid-cols-7 ${isCompact ? 'gap-1 md:gap-1.5' : 'gap-2'}`}>
          {Array.from({ length: firstDayOffset }).map((_, index) => (
            <div key={`empty-${index}`} className="aspect-square bg-transparent opacity-5" />
          ))}

          {Array.from({ length: daysInCurrentMonth }).map((_, index) => {
            const dayNum = index + 1;
            const isSelected = selectedDay === dayNum;
            const eventsList = assignedItemsDatabase[dayNum] || [];

            return (
              <button
                key={dayNum}
                onClick={() => setSelectedDay(dayNum)}
                className={`relative flex aspect-square flex-col justify-between overflow-hidden border transition-all duration-300 ${isMobile ? 'rounded-lg p-1.5' : isCompact ? 'rounded-lg p-2' : 'rounded-xl p-2'} ${
                  isSelected
                    ? 'z-10 border-transparent bg-gradient-to-tr from-violet-600 via-purple-600 to-fuchsia-600 text-white shadow-[0_0_18px_rgba(139,92,246,0.3)]'
                    : 'border-white/5 bg-zinc-950/60 text-zinc-400 hover:border-white/20'
                }`}
              >
                <span className={`${isMobile ? 'text-[9px]' : isCompact ? 'text-[10px]' : 'text-[11px]'} font-bold ${isSelected ? 'text-white' : 'text-zinc-500'}`}>
                  {dayNum}
                </span>

                <div className={`mt-auto flex w-full justify-center space-x-1 ${shouldRevealCalendarDetails ? 'anim-starlight-shimmer' : ''}`}>
                  {eventsList.map((event, dotIndex) => (
                    <div
                      key={`${dayNum}-${event.title}`}
                      className={`dot-item rounded-full ${isMobile ? 'h-[3px] w-[3px]' : isCompact ? 'h-1 w-1' : 'h-1.5 w-1.5'}`}
                      onAnimationEnd={(animationEvent) => handleVisibleDotAnimationEnd(`${dayNum}-${dotIndex}`, animationEvent)}
                      style={{
                        backgroundColor: isSelected ? '#ffffff' : event.statusColor,
                        animationDelay: shouldRevealCalendarDetails ? `${dayNum * 24 + dotIndex * 80}ms` : '0ms',
                        animationDuration: '720ms',
                      }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <div className={`relative z-10 border-t border-white/5 ${isMobile ? 'mt-3 min-h-[118px] pt-3' : isCompact ? 'mt-4 min-h-[138px] pt-4' : 'mt-8 min-h-[170px] pt-5'}`}>
          <span className={`mb-3 flex items-center space-x-1.5 font-bold tracking-widest text-zinc-400 ${isMobile ? 'text-[8px]' : 'text-[9px]'}`}>
            <Activity size={10} className="text-zinc-300" />
            <span>Appointments for {monthLabel} {selectedDay}</span>
          </span>
          {selectedAppointments.length > 0 ? (
            <div className={isMobile ? 'space-y-1.5' : 'space-y-2'}>
              {selectedAppointments.map((event, index) => {
                const appointmentActions = getDemoAppointmentActions(event.status);
                const hasAppointmentActions = appointmentActions.length > 0;
                const activePromptAction = activeAppointmentPrompt?.appointmentId === event.id
                  ? activeAppointmentPrompt.action
                  : null;
                const showAppointmentActions = activeAppointmentActionsId === event.id;
                const showPeekReveal = showAvatarHint && hasAppointmentActions && !showAppointmentActions && !activePromptAction;
                const showAvatarReturn = showAvatarHintReturn && hasAppointmentActions && !showAppointmentActions && !activePromptAction;
                const showActionLane = showAppointmentActions || showPeekReveal || Boolean(activePromptAction);
                const toggleAppointmentActions = () => {
                  if (!hasAppointmentActions) return;
                  setActiveAppointmentActionsId((current) => {
                    const next = current === event.id ? null : event.id;
                    if (next !== event.id) setActiveAppointmentPrompt(null);
                    return next;
                  });
                };

                return (
                <div key={event.id} className="space-y-1">
                  <motion.div
                    initial={false}
                    animate={{ opacity: 1, y: 0 }}
                    onAnimationEnd={(animationEvent) => handleAppointmentAnimationEnd(event.id, animationEvent)}
                    className={`agenda-item ${calendarVisible ? 'agenda-item--visible' : ''} demo-calendar-appointment-record flex w-full items-center rounded-lg border bg-[#070707]/92 text-left ${activePromptAction ? 'demo-call-agenda-item' : 'border-white/[0.08]'} ${isMobile ? 'gap-2 p-2' : isCompact ? 'gap-2.5 p-2.5' : 'gap-3 p-3'}`}
                    style={{
                      animationDelay: `${index * 90}ms`,
                      '--demo-receptionist-banner': `url(${event.receptionistBannerUrl || event.receptionistAvatar})`,
                    }}
                  >
                    <button
                      type="button"
                      aria-label={`${activeAppointmentActionsId === event.id ? 'Hide' : 'Show'} appointment actions`}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        toggleAppointmentActions();
                      }}
                      className={`relative z-10 flex shrink-0 items-center justify-center rounded-full p-1 transition-transform duration-200 focus:outline-none ${hasAppointmentActions ? 'hover:scale-110' : 'cursor-default'}`}
                    >
                      <span
                        className={`${isMobile ? 'h-1.5 w-1.5' : isCompact ? 'h-2 w-2' : 'h-2.5 w-2.5'} rounded-full ${activePromptAction ? 'demo-call-status-dot' : 'shadow-[0_0_4px_currentColor]'}`}
                        style={activePromptAction
                          ? undefined
                          : { color: event.statusColor, backgroundColor: event.statusColor }}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (showAppointmentActions || activePromptAction) {
                          return;
                        }
                        setExpandedAppointmentId((current) => (current === event.id ? null : event.id));
                      }}
                      className="relative flex min-w-0 flex-1 items-center justify-between gap-2 overflow-visible text-left"
                    >
                      <AnimatePresence initial={false}>
                        {showActionLane && (
                          <motion.div
                            initial={{ opacity: 0, x: -10, scale: 0.96 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -8, scale: 0.97 }}
                            transition={showPeekReveal ? { type: 'spring', stiffness: 440, damping: 28, mass: 0.7 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                            className={`demo-calendar-actions-layer absolute left-7 z-20 flex max-w-[calc(100%-6.2rem)] items-center ${showPeekReveal ? 'demo-calendar-actions-peek pointer-events-none' : 'gap-2.5'}`}
                          >
                            <AnimatePresence mode="wait" initial={false}>
                              {activePromptAction ? (
                                <motion.div
                                  key="action-prompt"
                                  initial={{ opacity: 0, x: -14, scale: 0.96 }}
                                  animate={{ opacity: 1, x: 0, scale: 1 }}
                                  exit={{ opacity: 0, x: -12, scale: 0.97 }}
                                  transition={{ type: 'spring', stiffness: 440, damping: 28, mass: 0.7 }}
                                  className="flex min-w-0 items-center gap-2"
                                >
                                  <span className={`truncate font-bold tracking-[-0.02em] text-zinc-200 drop-shadow-[0_0_10px_rgba(255,255,255,0.08)] ${isMobile ? 'text-[8px]' : 'text-[9px]'}`}>
                                    {getDemoActionPrompt(activePromptAction, event.customerFirstName)}
                                  </span>
                                  <span
                                    onClick={(actionEvent) => {
                                      actionEvent.preventDefault();
                                      actionEvent.stopPropagation();
                                    }}
                                    className={`shrink-0 cursor-pointer font-bold tracking-[-0.02em] text-emerald-300 drop-shadow-[0_0_10px_rgba(110,231,183,0.14)] ${isMobile ? 'text-[8px]' : 'text-[9px]'}`}
                                  >
                                    Call
                                  </span>
                                  <span
                                    onClick={(actionEvent) => {
                                      actionEvent.preventDefault();
                                      actionEvent.stopPropagation();
                                      setActiveAppointmentPrompt(null);
                                    }}
                                    className={`shrink-0 cursor-pointer font-bold tracking-[-0.02em] text-zinc-500 drop-shadow-[0_0_10px_rgba(113,113,122,0.14)] ${isMobile ? 'text-[8px]' : 'text-[9px]'}`}
                                  >
                                    Cancel
                                  </span>
                                </motion.div>
                              ) : (
                                <motion.div
                                  key="action-list"
                                  initial={{ opacity: 0, x: -14, scale: 0.96 }}
                                  animate={{ opacity: 1, x: 0, scale: 1 }}
                                  exit={{ opacity: 0, x: -12, scale: 0.97 }}
                                  transition={{ type: 'spring', stiffness: 440, damping: 28, mass: 0.7 }}
                                  className={showPeekReveal ? 'demo-calendar-peek-actions' : 'flex items-center gap-2.5'}
                                >
                                  {appointmentActions.map((action) => (
                                    <span
                                      key={action.label}
                                      onClick={(actionEvent) => {
                                        if (showPeekReveal) return;
                                        actionEvent.preventDefault();
                                        actionEvent.stopPropagation();
                                        setActiveAppointmentPrompt({
                                          appointmentId: event.id,
                                          action: action.label,
                                        });
                                      }}
                                      className={`cursor-pointer font-bold tracking-[-0.02em] ${showPeekReveal ? '' : 'drop-shadow-[0_0_10px_rgba(255,255,255,0.08)]'} ${action.className} ${showPeekReveal ? 'demo-calendar-peek-action' : ''} ${isMobile ? 'text-[8px]' : 'text-[9px]'}`}
                                    >
                                      {action.label}
                                    </span>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <motion.div
                        animate={{
                          opacity: 1,
                          x: 0,
                        }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="demo-calendar-appointment-foreground flex min-w-0 flex-1 items-center space-x-2"
                      >
                        <span
                          role={hasAppointmentActions ? 'button' : undefined}
                          tabIndex={hasAppointmentActions ? 0 : undefined}
                          aria-label={`${activeAppointmentActionsId === event.id ? 'Hide' : 'Show'} appointment actions`}
                          onClick={(avatarEvent) => {
                            avatarEvent.preventDefault();
                            avatarEvent.stopPropagation();
                            toggleAppointmentActions();
                          }}
                          onKeyDown={(avatarEvent) => {
                            if (!hasAppointmentActions) return;
                            if (avatarEvent.key === 'Enter' || avatarEvent.key === ' ') {
                              avatarEvent.preventDefault();
                              avatarEvent.stopPropagation();
                              toggleAppointmentActions();
                            }
                          }}
                          className={`demo-calendar-avatar-trigger flex h-5 w-5 items-center justify-center rounded-full ${hasAppointmentActions ? 'cursor-pointer' : ''} ${showPeekReveal ? 'demo-calendar-avatar-trigger--peek-pop' : ''} ${showAvatarReturn ? 'demo-calendar-avatar-trigger--return' : ''}`}
                        >
                          <span className="demo-calendar-avatar-trigger__image flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-white/10 bg-zinc-900">
                            <img
                              src={event.receptionistAvatar}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </span>
                        </span>
                        <span className={`demo-calendar-appointment-text ${showActionLane ? 'demo-calendar-appointment-text--peek-hidden' : ''} ${showAvatarReturn ? 'demo-calendar-appointment-text--return' : ''} truncate font-semibold text-zinc-200 ${isMobile ? 'text-[10px]' : isCompact ? 'text-[11px]' : 'text-xs'}`}>{event.title}</span>
                        {!isMobile && !isCompact && <span className={`demo-calendar-appointment-text ${showActionLane ? 'demo-calendar-appointment-text--peek-hidden' : ''} ${showAvatarReturn ? 'demo-calendar-appointment-text--return' : ''} text-[10px] font-medium italic text-zinc-500`}>via</span>}
                        <span className={`demo-calendar-appointment-text ${showActionLane ? 'demo-calendar-appointment-text--peek-hidden' : ''} ${showAvatarReturn ? 'demo-calendar-appointment-text--return' : ''} ${isCompact ? 'hidden' : 'text-[10px]'} font-medium text-zinc-400`}>
                          {event.receptionistName}
                        </span>
                      </motion.div>
                      <div className="flex shrink-0 items-center space-x-1.5">
                        <span
                        className={`font-bold uppercase tracking-wider text-zinc-500 ${isMobile ? 'text-[7px]' : isCompact ? 'text-[8px]' : 'text-[9px]'}`}
                        >
                          {event.category}
                        </span>
                        <span className={`${isMobile ? 'h-3' : 'h-4'} w-px bg-white/[0.12]`} aria-hidden="true" />
                        <span className={`${isMobile ? 'text-[8px]' : isCompact ? 'text-[9px]' : 'text-[10px]'} font-mono text-zinc-400`}>{event.time}</span>
                      </div>
                    </button>
                  </motion.div>
                  <AnimatePresence initial={false}>
                    {expandedAppointmentId === event.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="overflow-hidden"
                      >
                        <div className="pl-4 pr-2 pt-2">
                          <div className="relative pl-4 text-left">
                            <span className="absolute left-0 top-0 h-full w-px bg-white/[0.08]" />
                            <div className="mb-1 text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-600">
                              Notes
                            </div>
                            <div className="text-left text-[11px] leading-5 text-zinc-400">
                              {event.notes || ''}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
              })}
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
