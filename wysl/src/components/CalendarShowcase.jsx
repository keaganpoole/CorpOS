import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AudioLines,
  ArrowRight,
  Calendar as CalendarIcon,
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
import HomepagePeopleCrmDemo from '../sonar/pages/HomepagePeopleCrmDemo';

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
        <path d="M17 8h1a4 4 0 0 1 0 8h-1" className="transition-all duration-500 group-hover:stroke-cyan-400" />
        <path d="M7 8H6a4 4 0 0 0 0 8h1" className="transition-all duration-500 group-hover:stroke-cyan-400" />
        <rect x="7" y="6" width="10" height="12" rx="3" className="origin-center transition-all duration-500 group-hover:scale-105 group-hover:stroke-cyan-300" />
        <path d="M10 10h4M10 14h4" className="transition-all duration-500 group-hover:stroke-cyan-300" />
      </svg>
    ),
    colorClass: 'bg-cyan-400',
    glowClass: 'shadow-[0_0_12px_rgba(34,211,238,0.6)]',
    hoverTextClass: 'group-hover:text-cyan-400',
    title: 'Multiple Conversations',
    copy: 'Handle multiple conversations simultaneously without hold times, missed opportunities, or the limitations of traditional staffing.',
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
    copy: 'Your AI receptionist answers every call instantly, day or night, so customers always reach your business instead of voicemail.',
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
    copy: 'Your AI receptionist knows when to reach out, what to say, and can even trigger personalized follow-ups through custom workflow automations.',
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
    icon: <CreditCard className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:rotate-3 group-hover:stroke-blue-300" />,
    colorClass: 'bg-blue-500',
    glowClass: 'shadow-[0_0_12px_rgba(59,130,246,0.6)]',
    hoverTextClass: 'group-hover:text-blue-400',
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
    icon: <Phone className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:-translate-y-1 group-hover:stroke-cyan-300" />,
    colorClass: 'bg-cyan-400',
    glowClass: 'shadow-[0_0_12px_rgba(34,211,238,0.6)]',
    hoverTextClass: 'group-hover:text-cyan-300',
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
          className="monitoring-merged-text relative inline-block bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text pb-2 text-5xl font-black leading-[0.98] tracking-[-0.05em] text-transparent md:text-7xl lg:text-[5.1rem] xl:text-[5.4rem]"
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

const getTagColor = (tag) => TAG_COLORS[tag] || HERO_COLORS[0];
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function BookingReelWord({ playState }) {
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    if (playState === 'resetting') {
      setIsResolved(false);
      return undefined;
    }

    if (playState !== 'playing') return undefined;

    const maxAnimationTime = Math.max(
      ...BOOKING_REEL_MOTION.delays.map((delay, index) => delay + BOOKING_REEL_MOTION.durations[index])
    );
    const timer = window.setTimeout(() => setIsResolved(true), maxAnimationTime - 110);
    return () => window.clearTimeout(timer);
  }, [playState]);

  return (
    <span
      className="relative inline-flex items-end align-baseline"
      style={{
        height: '0.98em',
        paddingBottom: '0.08em',
      }}
    >
      <span className="invisible inline-block bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text text-transparent">
        Booking
      </span>

      <span
        className="absolute inset-0 inline-flex items-end"
        style={{
          opacity: isResolved ? 0 : 1,
          filter: `blur(${isResolved ? 0.45 : 0}px)`,
          transition: 'opacity 240ms ease-out, filter 260ms ease-out',
        }}
      >
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

      <span
        className="absolute inset-0 inline-block bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text text-transparent"
        style={{
          opacity: isResolved ? 1 : 0,
          filter: `blur(${isResolved ? 0 : 1.6}px)`,
          transform: `translateY(${isResolved ? 0 : 1}px)`,
          transition: 'opacity 280ms ease-out, filter 320ms ease-out, transform 320ms ease-out',
        }}
      >
        Booking
      </span>
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
  const [scenarioAwaitingReentry, setScenarioAwaitingReentry] = useState(false);
  const [crmAwaitingReentry, setCrmAwaitingReentry] = useState(false);
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

  if (isCrmHeroVariant) {
    return (
      <div ref={rootRef} className="calendar-showcase relative h-[135vh] w-full bg-[#020202] md:h-[145vh]">
        <div ref={stickyRef} className="sticky top-0 flex h-screen items-center overflow-hidden bg-[#020202]">
          <div className="pointer-events-none absolute inset-0 opacity-[0.04] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:48px_48px]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_42%)]" />

          <div className="relative z-10 mx-auto w-full max-w-[1300px] px-6 text-center md:px-10 lg:px-12">
            <div className="mx-auto max-w-[1100px]">
              <h2 className="bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text pb-2 text-4xl font-black leading-[0.95] tracking-[-0.06em] text-transparent md:text-7xl lg:text-[6.2rem]">
                One. Stunning. CRM.
              </h2>
              <div className="mx-auto mt-6 max-w-[820px] text-base font-semibold leading-[1.55] tracking-[-0.02em] text-[#d4d4d8] md:text-xl">
                Transform customer data into a beautiful, visual workspace built for clarity, organization, and control.
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
      ? ['One. Stunning. CRM.']
      : ['Scenario Workflow Builder.'];
    const description = isMonitoringVariant
      ? 'Monitor calls as they happen and review every conversation later with the context, playback, and history your team actually needs.'
      : isCrmVariant
      ? 'Transform customer data into a beautiful, visual workspace built for clarity, organization, and control.'
      : 'Create custom workflows that automate calls, bookings, payments, follow-ups, and more, with triggers, conditions, and actions that keep everything moving automatically.';

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
                  <MonitoringHeadline playKey={monitoringHeadlineKey} />
                ) : (
                  <div className="min-h-[10rem]" />
                )
              ) : (
                <h2 className={`bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text pb-2 text-5xl font-black leading-[0.98] tracking-[-0.05em] text-transparent md:text-7xl ${isCrmVariant ? 'mx-auto max-w-[10ch] text-balance sm:max-w-[12ch] lg:max-w-none lg:text-[5.1rem] xl:text-[5.4rem]' : 'lg:text-[5.8rem]'}`}>
                  {titleLines.map((line, index) => (
                    <React.Fragment key={line}>
                      {line}
                      {!isCrmVariant && index < titleLines.length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </h2>
              )}
              <div className={`mx-auto text-base font-semibold leading-[1.55] tracking-[-0.02em] text-[#d4d4d8] md:text-xl ${isMonitoringVariant ? 'mt-2 max-w-[820px]' : 'mt-6 max-w-[760px]'}`}>
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
                  onDemoLimitExceeded={handleDemoLimitExceeded}
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
              <div className="bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text text-center text-4xl font-black tracking-[-0.04em] text-transparent md:text-7xl">
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
                <div className="calendar-showcase-description mx-auto mt-6 max-w-[24rem] text-base font-semibold leading-[1.45] tracking-[-0.02em] text-[#d4d4d8] md:mx-auto md:max-w-[36rem] md:text-center md:text-[1.1rem] md:leading-[1.55] lg:mx-0 lg:max-w-[24rem] lg:text-left lg:text-base lg:leading-[1.45]">
                  {isScenariosVariant
                    ? 'Build the exact workflows your business needs with triggers, branching logic, live variables, and actions that run across calls, records, appointments, payments, and follow-ups.'
                    : 'Turn every conversation into a booked appointment. Your AI receptionist answers every call instantly, checks real-time availability, books, reschedules, and confirms appointments while handling multiple conversations at once. No hold times, no missed opportunities, no smoke breaks — just a calendar that fills itself 24/7.'}
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

function RightFeatureList({ featureProgress, items, useScrollHighlight = false }) {
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
                      className={`feature-reveal-row__dot absolute h-1.5 w-1.5 rounded-full transition-all duration-300 ease-out ${item.colorClass} ${
                        isHighlighted ? `${item.glowClass} scale-110 opacity-100` : 'scale-75 opacity-30'
                      }`}
                    />
                  </div>

                  <div
                    className={`feature-reveal-row__icon flex items-center justify-center overflow-visible transition-all duration-300 ${
                      isHighlighted ? 'scale-110 text-white' : 'text-zinc-600'
                    }`}
                  >
                    {item.icon}
                  </div>

                  <div className={`feature-reveal-row__title text-xl font-black tracking-tighter uppercase text-zinc-100 transition-colors duration-300 md:text-[1.35rem] lg:text-2xl ${item.hoverTextClass}`}>
                    {item.title}
                  </div>
                </div>

                <div
                  className={`mt-2 w-full pl-7 transition-transform duration-300 ease-out md:mt-0 md:max-w-[26rem] md:pl-0 lg:max-w-sm ${
                    isHighlighted ? 'translate-x-1' : ''
                  }`}
                >
                  <div className="text-xs font-medium leading-relaxed tracking-tight text-zinc-400 md:text-[13px] lg:text-xs">
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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    updateViewportWidth();
    window.addEventListener('resize', updateViewportWidth);
    return () => window.removeEventListener('resize', updateViewportWidth);
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

  return (
    <div className="relative flex h-full w-full items-center">
      <div className={`relative w-full overflow-hidden border border-white/5 bg-[#08080A] shadow-[0_32px_80px_-24px_rgba(0,0,0,0.95)] ${isCompact ? 'rounded-[22px] p-3 sm:p-4 md:p-5' : 'rounded-[28px] p-10'}`}>
        <div className={`border-b border-white/5 text-left ${isCompact ? 'mb-3 pb-3 md:mb-4 md:pb-4' : 'mb-6 pb-6'}`}>
          <span className={`flex items-center space-x-2 font-bold tracking-tight text-white ${isMobile ? 'text-[1rem]' : isCompact ? 'text-[1.25rem]' : 'text-[2rem]'}`}>
            <CalendarIcon className="text-zinc-300" size={22} />
            <span>October 2026</span>
          </span>
        </div>

        <div className={`mb-2 grid grid-cols-7 text-center ${isCompact ? 'gap-1 md:gap-1.5' : 'gap-2'}`}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
            <span key={`${day}-${index}`} className={`py-1 font-bold uppercase tracking-widest text-zinc-500 ${isMobile ? 'text-[8px]' : isCompact ? 'text-[9px]' : 'text-[10px]'}`}>
              {day}
            </span>
          ))}
        </div>

        <div className={`grid grid-cols-7 ${isCompact ? 'gap-1 md:gap-1.5' : 'gap-2'}`}>
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

        <div className={`border-t border-white/5 ${isMobile ? 'mt-3 min-h-[118px] pt-3' : isCompact ? 'mt-4 min-h-[138px] pt-4' : 'mt-8 min-h-[170px] pt-5'}`}>
          <span className={`mb-3 flex items-center space-x-1.5 font-bold tracking-widest text-zinc-400 ${isMobile ? 'text-[8px]' : 'text-[9px]'}`}>
            <Activity size={10} className="text-zinc-300" />
            <span>Appointments for October {selectedDay}</span>
          </span>
          {itemsDatabase[selectedDay] ? (
            <div className={isMobile ? 'space-y-1.5' : 'space-y-2'}>
              {itemsDatabase[selectedDay].map((event, index) => (
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
                        src={AVATAR_URLS[index % AVATAR_URLS.length]}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </span>
                    <span className={`${isCompact ? 'hidden' : 'text-[10px]'} font-medium text-zinc-400`}>
                      {RECEPTIONISTS[index % RECEPTIONISTS.length]}
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
