import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Activity,
  AudioLines,
  ArrowRight,
  Calendar as CalendarIcon,
  ClipboardList,
  CreditCard,
  Database,
  GitBranch,
  Layers,
  Phone,
  PlayCircle,
  Search,
  TimerReset,
  Users,
  Workflow,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import HomepageScenariosDemo from '../sonar/pages/Scenarios/HomepageScenariosDemo';
import HomepagePeopleCrmDemo, { DEMO_CUSTOM_FIELDS } from '../sonar/pages/HomepagePeopleCrmDemo';

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
    icon: <Activity className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:scale-110 group-hover:stroke-emerald-300" />,
    colorClass: 'bg-emerald-500',
    glowClass: 'shadow-[0_0_12px_rgba(16,185,129,0.6)]',
    hoverTextClass: 'group-hover:text-emerald-400',
    title: 'Booking CRM',
    copy: 'Create beautifully organized appointment records that bring together customer details, history, notes, and everything else surrounding each visit.',
  },
  {
    icon: <CalendarIcon className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:-translate-y-1 group-hover:stroke-pink-300" />,
    colorClass: 'bg-pink-500',
    glowClass: 'shadow-[0_0_12px_rgba(236,72,153,0.6)]',
    hoverTextClass: 'group-hover:text-pink-400',
    title: 'Fully Managed',
    copy: 'Handle the full appointment flow during the call, from new bookings to changes and cancellations.',
  },
  {
  icon: <Users className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:-translate-y-1 group-hover:stroke-pink-300" />,
  colorClass: 'bg-blue-500',
  glowClass: 'shadow-[0_0_12px_rgba(59,130,246,0.6)]',
  hoverTextClass: 'group-hover:text-pink-400',
  accentColor: '#f472b6',
  title: 'Staff Matching',
  copy: 'Match every customer with the staff member who best fits their needs while checking availability in real time.'
  },
  {
    icon: <TimerReset className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:rotate-12 group-hover:stroke-amber-300" />,
    colorClass: 'bg-amber-400',
    glowClass: 'shadow-[0_0_12px_rgba(251,191,36,0.6)]',
    hoverTextClass: 'group-hover:text-amber-400',
    title: 'Follow-Ups',
    copy: 'Send confirmations, reminders, and appointment updates so customers know exactly what was booked and what happens next.',
  },
  {
    icon: <Search className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:scale-110 group-hover:stroke-pink-300" />,
    colorClass: 'bg-cyan-400',
    glowClass: 'shadow-[0_0_12px_rgba(34,211,238,0.6)]',
    hoverTextClass: 'group-hover:text-pink-400',
    accentColor: '#f472b6',
    title: 'Manual Edits',
    copy: 'Review and adjust the appointment records your receptionist creates whenever staff need to update details, notes, or status.',
  },
  {
    icon: <CreditCard className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:rotate-3 group-hover:stroke-indigo-300" />,
    colorClass: 'bg-indigo-400',
    glowClass: 'shadow-[0_0_12px_rgba(129,140,248,0.6)]',
    hoverTextClass: 'group-hover:text-indigo-400',
    title: 'Deposits & Payments',
    copy: 'Collect payment or send deposit links during booking when an appointment needs to be secured.',
  },
];

const SCENARIO_FEATURE_ITEMS = [
  {
    icon: <TimerReset className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:rotate-12 group-hover:stroke-pink-300" />,
    colorClass: 'bg-cyan-400',
    glowClass: 'shadow-[0_0_12px_rgba(34,211,238,0.6)]',
    hoverTextClass: 'group-hover:text-pink-400',
    accentColor: '#f472b6',
    title: 'Call Automation',
    copy: 'Have your receptionist make phone calls as part of the workflow, so calls happen exactly when they should, at the perfect moment.',
  },
  {
    icon: <GitBranch className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:translate-x-1 group-hover:stroke-emerald-300" />,
    colorClass: 'bg-emerald-500',
    glowClass: 'shadow-[0_0_12px_rgba(16,185,129,0.6)]',
    hoverTextClass: 'group-hover:text-emerald-400',
    title: 'Automated Follow-Ups',
    copy: 'Stay on top of every customer by following up at the right time based on specific triggers within your business.',
  },
  {
    icon: <Database className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:-translate-y-1 group-hover:stroke-amber-300" />,
    colorClass: 'bg-amber-400',
    glowClass: 'shadow-[0_0_12px_rgba(251,191,36,0.6)]',
    hoverTextClass: 'group-hover:text-amber-400',
    title: 'Live Data',
    copy: 'Use live variables to carry useful data through the workflow, so later steps can continue with full context.',
  },
  {
    icon: <CreditCard className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:rotate-3 group-hover:stroke-pink-300" />,
    colorClass: 'bg-blue-500',
    glowClass: 'shadow-[0_0_12px_rgba(59,130,246,0.6)]',
    hoverTextClass: 'group-hover:text-pink-400',
    accentColor: '#f472b6',
    title: 'Built-In Payments',
    copy: 'Automate billing tasks like payment collection, invoice creation, and payment links as part of the conversation.',
  },
  {
    icon: <PlayCircle className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:scale-110 group-hover:stroke-rose-300" />,
    colorClass: 'bg-rose-500',
    glowClass: 'shadow-[0_0_12px_rgba(244,63,94,0.6)]',
    hoverTextClass: 'group-hover:text-rose-400',
    title: 'Workflow Resume',
    copy: 'Scenarios can carry forward the latest details from earlier steps, letting your receptionist continue the workflow instead of starting over.',
  },
  {
    icon: <Workflow className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:rotate-6 group-hover:stroke-indigo-300" />,
    colorClass: 'bg-indigo-400',
    glowClass: 'shadow-[0_0_12px_rgba(129,140,248,0.6)]',
    hoverTextClass: 'group-hover:text-indigo-400',
    title: 'Schedules',
    copy: 'Set scenarios to run at specific times, on recurring intervals, or before important events.',
  },
];

const CRM_FEATURE_ITEMS = [
  {
    icon: <Layers className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:translate-x-1 group-hover:stroke-violet-300" />,
    colorClass: 'bg-violet-500',
    glowClass: 'shadow-[0_0_12px_rgba(139,92,246,0.6)]',
    hoverTextClass: 'group-hover:text-violet-400',
    title: 'Fully Customizable',
    copy: 'Build a CRM tailored to your business with custom fields and flexible data structures designed around the way your team operates.',
  },
  {
    icon: <Activity className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:scale-110 group-hover:stroke-emerald-300" />,
    colorClass: 'bg-emerald-500',
    glowClass: 'shadow-[0_0_12px_rgba(16,185,129,0.6)]',
    hoverTextClass: 'group-hover:text-emerald-400',
    title: 'Colorbar',
    copy: 'Turn your data into a visual, animated workspace by automatically coloring records based on custom conditions',
  },
  {
    icon: <GitBranch className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:rotate-6 group-hover:stroke-fuchsia-300" />,
    colorClass: 'bg-fuchsia-500',
    glowClass: 'shadow-[0_0_12px_rgba(217,70,239,0.6)]',
    hoverTextClass: 'group-hover:text-fuchsia-400',
    title: 'Zones',
    copy: 'Organize records with beautiful, personalized color-coded columns for faster scanning and easier management.',
  },
  {
    icon: <TimerReset className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:rotate-12 group-hover:stroke-amber-300" />,
    colorClass: 'bg-amber-400',
    glowClass: 'shadow-[0_0_12px_rgba(251,191,36,0.6)]',
    hoverTextClass: 'group-hover:text-amber-400',
    title: 'Organization Tools',
    copy: 'Sort, filter, hide, freeze, and arrange data to create the perfect workspace for your business.',
  },
  {
    icon: <Users className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:-translate-y-1 group-hover:stroke-rose-300" />,
    colorClass: 'bg-rose-500',
    glowClass: 'shadow-[0_0_12px_rgba(244,63,94,0.6)]',
    hoverTextClass: 'group-hover:text-rose-400',
    title: 'Real-Time Updates',
    copy: 'See live customer activity as it happens, making every record more useful and every decision faster.',
  },
  {
    icon: <ClipboardList className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:-translate-y-1 group-hover:stroke-pink-300" />,
    colorClass: 'bg-cyan-400',
    glowClass: 'shadow-[0_0_12px_rgba(34,211,238,0.6)]',
    hoverTextClass: 'group-hover:text-pink-400',
    accentColor: '#f472b6',
    title: 'Custom Intake Fields',
    copy: 'Tell your receptionist which details matter most, and it will prioritize collecting them during the call before saving them to the customer record.',
  },
];

const MONITORING_FEATURE_ITEMS = [
  {
    icon: <Activity className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:scale-110 group-hover:stroke-emerald-300" />,
    colorClass: 'bg-emerald-500',
    glowClass: 'shadow-[0_0_12px_rgba(16,185,129,0.6)]',
    hoverTextClass: 'group-hover:text-emerald-400',
    title: 'Real-Time Analytics',
    copy: 'Track calls, appointments, customers, revenue, and payment activity in real time from one live dashboard.',
  },
  {
    icon: <AudioLines className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:scale-110 group-hover:stroke-rose-300" />,
    colorClass: 'bg-rose-500',
    glowClass: 'shadow-[0_0_12px_rgba(244,63,94,0.6)]',
    hoverTextClass: 'group-hover:text-rose-400',
    title: 'Call Listening',
    copy: 'Access recorded conversations so finding important information is always simple.',
  },
  {
    icon: <Phone className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:-translate-y-1 group-hover:stroke-pink-300" />,
    colorClass: 'bg-cyan-400',
    glowClass: 'shadow-[0_0_12px_rgba(34,211,238,0.6)]',
    hoverTextClass: 'group-hover:text-pink-400',
    accentColor: '#f472b6',
    title: 'Live Call Visibility',
    copy: 'Experience every call as it happens with a live visual flow that reveals the path your AI receptionist takes from start to finish.',
  },
  {
    icon: <GitBranch className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:rotate-6 group-hover:stroke-fuchsia-300" />,
    colorClass: 'bg-fuchsia-500',
    glowClass: 'shadow-[0_0_12px_rgba(217,70,239,0.6)]',
    hoverTextClass: 'group-hover:text-fuchsia-400',
    title: 'Flow Tracking',
    copy: 'See how each conversation moves through records, appointments, and payments with a clear visual path instead of guessing.',
  },
  {
    icon: <Layers className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:-translate-y-1 group-hover:stroke-amber-300" />,
    colorClass: 'bg-amber-400',
    glowClass: 'shadow-[0_0_12px_rgba(251,191,36,0.6)]',
    hoverTextClass: 'group-hover:text-amber-400',
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
  const rootRef = useRef(null);
  const stickyRef = useRef(null);
  const [sectionProgress, setSectionProgress] = useState(0);
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

  const calendarExited = sectionProgress >= 0.31;
  const featureEntered = sectionProgress >= 0.365;
  const featureProgress = featureEntered ? 1 : 0;
  const calendarOpacity = calendarExited ? 0 : 1;
  const featureOpacity = featureEntered ? 1 : 0;
  const isCompactBookingViewport = viewportSize.width < 1024;
  const mobileIntroExited = sectionProgress >= 0.24;
  const mobileCalendarEntered = sectionProgress >= 0.18;
  const mobileCalendarExited = sectionProgress >= 0.56;
  const mobileFeatureEntered = sectionProgress >= 0.62;
  const bookingIntroOpacity = isCompactBookingViewport ? (mobileIntroExited ? 0 : 1) : 1;
  const bookingCalendarOpacity = isCompactBookingViewport
    ? (mobileCalendarEntered && !mobileCalendarExited ? 1 : 0)
    : calendarOpacity;
  const bookingFeatureOpacity = isCompactBookingViewport ? (mobileFeatureEntered ? 1 : 0) : featureOpacity;
  const bookingFeatureProgress = isCompactBookingViewport
    ? Math.min(1, Math.max(0, (sectionProgress - 0.58) / 0.42))
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
      <div ref={rootRef} className={`calendar-showcase scenario-demo-showcase relative w-full ${isMonitoringVariant ? 'h-[170vh]' : 'h-[250vh]'}`}>
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
    <div ref={rootRef} className="calendar-showcase relative h-[225vh] w-full lg:h-[225vh]">
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

export function RightFeatureList({ featureProgress, items, useScrollHighlight = false }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const isVisible = featureProgress > 0.12;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(hover: none), (pointer: coarse)');
    const updateTouchState = () => setIsTouchDevice(mediaQuery.matches);

    updateTouchState();
    mediaQuery.addEventListener?.('change', updateTouchState);
    return () => mediaQuery.removeEventListener?.('change', updateTouchState);
  }, []);

  const shouldUseScrollHighlight = useScrollHighlight || isTouchDevice;
  const touchActiveIndex = shouldUseScrollHighlight && isVisible
    ? Math.min(items.length - 1, Math.max(0, Math.floor(featureProgress * items.length)))
    : null;

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
      <div className="mx-auto w-full max-w-[820px] text-left md:max-w-[940px] lg:max-w-[820px]">
        <div className="flex flex-col">
          {items.map((item, index) => {
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
                  className={`flex items-center gap-4 transition-transform duration-300 ease-out md:min-w-[280px] md:gap-5 lg:min-w-0 ${
                    isHighlighted ? 'translate-x-1.5' : ''
                  }`}
                >
                  <div className="relative flex h-3 w-3 items-center justify-center">
                    <span
                      className={`feature-reveal-row__dot absolute h-1.5 w-1.5 rounded-full transition-all duration-300 ease-out ${
                        isHighlighted ? 'is-highlighted scale-110 opacity-100' : 'scale-75 opacity-30'
                      }`}
                    />
                  </div>

                  <div
                    className={`feature-reveal-row__icon flex items-center justify-center overflow-visible transition-all duration-300 ${
                      isHighlighted ? 'scale-110 text-white' : 'text-zinc-600'
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
                  className={`mt-2 w-full pl-7 transition-transform duration-300 ease-out md:mt-0 md:max-w-[26rem] md:pl-0 lg:max-w-sm ${
                    isHighlighted ? 'translate-x-1' : ''
                  }`}
                >
                  <div className="homepage-feature-copy text-xs font-medium leading-relaxed tracking-tight text-zinc-400 md:text-[13px] lg:text-xs">
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
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1440));
  const [receptionists, setReceptionists] = useState(FALLBACK_RECEPTIONISTS);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    updateViewportWidth();
    window.addEventListener('resize', updateViewportWidth);
    return () => window.removeEventListener('resize', updateViewportWidth);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadReceptionists = async () => {
      try {
        const { data, error } = await supabase
          .from('receptionist_catalog')
          .select('id, full_name, first_name, avatar')
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

    return Object.fromEntries(
      Object.entries(itemsDatabase).map(([day, events]) => [
        day,
        (events || []).map((event, index) => {
          const poolIndex = hashSeed(`${day}-${event.title}-${event.time}-${index}`) % pool.length;
          const receptionist = pool[poolIndex];
          return {
            ...event,
            receptionistName: receptionist?.first_name || receptionist?.full_name || 'Receptionist',
            receptionistAvatar: receptionist?.avatar || '',
          };
        }),
      ])
    );
  }, [itemsDatabase, receptionists]);

  return (
    <div className="relative flex h-full w-full items-center">
      <div className={`relative isolate w-full overflow-hidden border border-white/[0.08] bg-[#0b0b0c]/95 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.95)] ${isCompact ? 'rounded-[22px] p-3 sm:p-4 md:p-5' : 'rounded-[28px] p-10'}`}>
        <div className={`relative z-10 border-b border-white/5 text-left ${isCompact ? 'mb-3 pb-3 md:mb-4 md:pb-4' : 'mb-6 pb-6'}`}>
          <span className={`flex items-center space-x-2 font-bold tracking-tight text-white ${isMobile ? 'text-[1rem]' : isCompact ? 'text-[1.25rem]' : 'text-[2rem]'}`}>
            <CalendarIcon className="text-zinc-300" size={22} />
            <span>October 2026</span>
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
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`empty-${index}`} className="aspect-square bg-transparent opacity-5" />
          ))}

          {Array.from({ length: 28 }).map((_, index) => {
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

                <div className={`mt-auto flex w-full justify-center space-x-1 ${hasAnimatedDots ? 'anim-starlight-shimmer' : ''}`}>
                  {eventsList.map((event, dotIndex) => (
                    <div
                      key={`${dayNum}-${event.title}`}
                      className={`dot-item rounded-full ${isMobile ? 'h-[3px] w-[3px]' : isCompact ? 'h-1 w-1' : 'h-1.5 w-1.5'}`}
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

        <div className={`relative z-10 border-t border-white/5 ${isMobile ? 'mt-3 min-h-[118px] pt-3' : isCompact ? 'mt-4 min-h-[138px] pt-4' : 'mt-8 min-h-[170px] pt-5'}`}>
          <span className={`mb-3 flex items-center space-x-1.5 font-bold tracking-widest text-zinc-400 ${isMobile ? 'text-[8px]' : 'text-[9px]'}`}>
            <Activity size={10} className="text-zinc-300" />
            <span>Appointments for October {selectedDay}</span>
          </span>
          {assignedItemsDatabase[selectedDay] ? (
            <div className={isMobile ? 'space-y-1.5' : 'space-y-2'}>
              {assignedItemsDatabase[selectedDay].map((event, index) => (
                <div
                  key={event.title}
                  className={`agenda-item flex items-center justify-between rounded-lg border border-white/5 bg-zinc-950 text-left ${isMobile ? 'gap-2 p-2' : isCompact ? 'gap-2.5 p-2.5' : 'gap-3 p-3'}`}
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <div className="flex min-w-0 flex-1 items-center space-x-2">
                    <span className={`${isMobile ? 'h-1.5 w-1.5' : isCompact ? 'h-2 w-2' : 'h-2.5 w-2.5'} rounded-full`} style={{ backgroundColor: event.tagColor }} />
                    <span className={`truncate font-semibold text-zinc-200 ${isMobile ? 'text-[10px]' : isCompact ? 'text-[11px]' : 'text-xs'}`}>{event.title}</span>
                    {!isMobile && !isCompact && <span className="text-[10px] font-medium italic text-zinc-500">via</span>}
                    <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-zinc-900">
                      <img
                        src={event.receptionistAvatar}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </span>
                    <span className={`${isCompact ? 'hidden' : 'text-[10px]'} font-medium text-zinc-400`}>
                      {event.receptionistName}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center space-x-1.5">
                    <span
                      className={`rounded border font-bold uppercase tracking-wider ${isMobile ? 'px-1.5 py-0.5 text-[7px]' : isCompact ? 'px-1.5 py-0.5 text-[8px]' : 'px-2 py-0.5 text-[9px]'}`}
                      style={{
                        color: event.tagColor,
                        borderColor: `${event.tagColor}33`,
                        backgroundColor: `${event.tagColor}14`,
                      }}
                    >
                      {event.category}
                    </span>
                    <span className={`${isMobile ? 'text-[8px]' : isCompact ? 'text-[9px]' : 'text-[10px]'} font-mono text-zinc-400`}>{event.time}</span>
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


