import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Calendar as CalendarIcon,
  Clock,
  CreditCard,
  Globe2,
  MapPinned,
  MessageCircle,
  Send,
} from 'lucide-react';

const HERO_COLORS = ['#818cf8', '#2dd4bf', '#60a5fa', '#a78bfa', '#f472b6', '#fbbf24', '#fb923c', '#34d399'];
const AVATAR_URLS = [
  'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/bonnie2.png',
  'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/chloe_transparent4.png',
  'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/maggie.png',
];
const RECEPTIONISTS = ['Bonnie', 'Chloe', 'Maggie'];
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
    icon: Clock,
    colorClass: 'bg-purple-500',
    glowClass: 'shadow-[0_0_12px_rgba(168,85,247,0.6)]',
    hoverTextClass: 'group-hover:text-purple-400',
    accent: '#f472b6',
    title: 'Manage Appointments Intelligently',
    copy: 'Handles the conversation naturally, guides callers to the right service, and secures appointments without friction.',
  },
  {
    icon: MessageCircle,
    colorClass: 'bg-pink-500',
    glowClass: 'shadow-[0_0_12px_rgba(236,72,153,0.6)]',
    hoverTextClass: 'group-hover:text-pink-400',
    accent: '#a78bfa',
    title: '24/7 Answering',
    copy: 'Answers every call instantly, handles multiple conversations at once, and keeps opportunities out of voicemail.',
  },
  {
    icon: Globe2,
    colorClass: 'bg-amber-400',
    glowClass: 'shadow-[0_0_12px_rgba(251,191,36,0.6)]',
    hoverTextClass: 'group-hover:text-amber-400',
    accent: '#fbbf24',
    title: '70+ Languages',
    copy: 'Detects the caller language and responds fluently, helping customers communicate without awkward handoffs.',
  },
  {
    icon: CreditCard,
    colorClass: 'bg-blue-500',
    glowClass: 'shadow-[0_0_12px_rgba(59,130,246,0.6)]',
    hoverTextClass: 'group-hover:text-blue-400',
    accent: '#60a5fa',
    title: 'Take Payments',
    copy: 'Collects deposits, processes payments, and answers billing questions when customers are ready to book.',
  },
  {
    icon: Send,
    colorClass: 'bg-emerald-500',
    glowClass: 'shadow-[0_0_12px_rgba(16,185,129,0.6)]',
    hoverTextClass: 'group-hover:text-emerald-400',
    accent: '#34d399',
    title: 'Follow Ups',
    copy: 'Reaches back out with context, timing, and workflow automation so promising leads keep moving.',
  },
  {
    icon: MapPinned,
    colorClass: 'bg-indigo-400',
    glowClass: 'shadow-[0_0_12px_rgba(129,140,248,0.6)]',
    hoverTextClass: 'group-hover:text-indigo-400',
    accent: '#818cf8',
    title: 'Step-by-Step Directions',
    copy: 'Uses location context to help callers with directions, parking, traffic, and arrival questions.',
  },
];

const getTagColor = (tag) => TAG_COLORS[tag] || HERO_COLORS[0];
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const CalendarShowcase = () => {
  const rootRef = useRef(null);
  const stickyRef = useRef(null);
  const [sectionProgress, setSectionProgress] = useState(0);
  const [hasAnimatedDots, setHasAnimatedDots] = useState(false);

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

  const calendarFadeProgress = clamp((sectionProgress - 0.34) / 0.16, 0, 1);
  const featureFadeProgress = clamp((sectionProgress - 0.58) / 0.16, 0, 1);
  const featureProgress = featureFadeProgress;
  const calendarOpacity = 1 - calendarFadeProgress;
  const featureOpacity = featureFadeProgress;

  return (
    <div ref={rootRef} className="calendar-showcase relative h-[240vh] w-full md:h-[250vh] lg:h-[260vh]">
      <div ref={stickyRef} className="sticky top-0 flex h-screen items-center">
        <div className="relative z-10 mx-auto w-full max-w-[1300px] px-6 md:px-10 lg:px-12">
          <div className="grid min-h-[700px] grid-cols-1 items-center gap-16 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)] lg:gap-24">
            <div className="flex min-h-[220px] items-center justify-center lg:justify-start">
              <div className="text-left">
                <h2 className="bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text text-5xl font-black leading-[0.88] tracking-[-0.05em] text-transparent md:text-7xl lg:text-[4rem]">
                  Fully Autonomous
                  <br />
                  Booking.
                </h2>
                <div className="calendar-showcase-description mt-6 max-w-[24rem] text-[0.95rem] font-semibold leading-[1.45] tracking-[-0.02em] text-zinc-300 md:text-base">
                  Your customers want immediate answers, accurate availability, and a frictionless path to confirmation. This booking flow handles the entire conversation with calm precision.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-start">
              <div className="relative h-[680px] w-full max-w-[720px]">
                <div
                  className={`absolute inset-0 transition-[opacity,transform] duration-500 ease-out ${
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
                  <RightFeatureList featureProgress={featureProgress} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function RightFeatureList({ featureProgress }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const isVisible = featureProgress > 0.08;

  return (
    <div className="flex h-full w-full items-center">
      <div className="w-full max-w-[720px] text-left">
        <div className="flex flex-col">
          {FEATURE_ITEMS.map((item, index) => {
            const Icon = item.icon;
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
                    <Icon size={20} strokeWidth={2} />
                  </div>

                  <h3 className={`text-xl font-black uppercase text-zinc-100 transition-colors duration-300 md:text-2xl ${item.hoverTextClass}`}>
                    {item.title}
                  </h3>
                </div>

                <div className="mt-2 w-full pl-7 transition-transform duration-300 ease-out group-hover:translate-x-1 md:mt-0 md:max-w-sm md:pl-0">
                  <p className="text-xs font-medium leading-relaxed text-zinc-400 md:text-[13px]">
                    {item.copy}
                  </p>
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
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day) => (
            <span key={day} className="py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
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
