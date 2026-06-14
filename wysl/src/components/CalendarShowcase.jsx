import React, { useEffect, useState } from 'react';
import {
  Activity,
  Calendar as CalendarIcon,
  CalendarDays,
  Clock,
  Command,
  MapPin,
} from 'lucide-react';

const TOTAL_SLIDES = 2;
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

const getTagColor = (tag) => TAG_COLORS[tag] || HERO_COLORS[0];

const CalendarShowcase = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStartX, setTouchStartX] = useState(null);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % TOTAL_SLIDES);
    }, 6500);

    return () => clearInterval(interval);
  }, [isPaused]);

  const pauseAutoplay = () => {
    setIsPaused(true);
  };

  const handleTouchStart = (event) => {
    pauseAutoplay();
    setTouchStartX(event.touches?.[0]?.clientX ?? null);
  };

  const handleTouchEnd = (event) => {
    if (touchStartX === null) return;
    const endX = event.changedTouches?.[0]?.clientX ?? touchStartX;
    const deltaX = endX - touchStartX;
    const swipeThreshold = 50;

    if (Math.abs(deltaX) >= swipeThreshold) {
      setCurrentSlide((prev) => {
        if (deltaX < 0) return (prev + 1) % TOTAL_SLIDES;
        return (prev - 1 + TOTAL_SLIDES) % TOTAL_SLIDES;
      });
    }

    setTouchStartX(null);
  };

  return (
    <div className="relative w-full">
      <div className="relative z-10 mx-auto w-full max-w-[1300px] px-6 md:px-10 lg:px-12">
        <div className="grid min-h-[700px] grid-cols-1 items-center gap-16 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)] lg:gap-24">
          <div className="flex min-h-[220px] items-center justify-center lg:justify-start">
            <div className="text-left">
              <h2 className="bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text text-5xl font-black leading-[0.88] tracking-[-0.05em] text-transparent md:text-7xl lg:text-[6rem]">
                Sculpting
                <br />
                Time.
              </h2>
            </div>
          </div>

          <div className="flex items-center justify-start">
            <div className="relative h-[680px] w-full max-w-[720px]">
              <div
                className={`absolute inset-0 transition-opacity duration-500 ease-out ${
                  currentSlide === 0 ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
                onMouseEnter={pauseAutoplay}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onClick={pauseAutoplay}
              >
                <RightHeroWidget />
              </div>
              <div
                className={`absolute inset-0 transition-opacity duration-500 ease-out ${
                  currentSlide === 1 ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
                onMouseEnter={pauseAutoplay}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onClick={pauseAutoplay}
              >
                <RightCalendarGrid />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function RightHeroWidget() {
  const scheduledItems = [
    {
      time: '09:00 AM',
      title: 'Balayage & Couture Blowout',
      detail: 'Marcus - VIP Salon Suite',
      color: HERO_COLORS[0],
      tag: 'Color',
      tagColor: getTagColor('Color'),
    },
    {
      time: '11:30 AM',
      title: 'Platinum Weft Extensions Fitting',
      detail: 'Elena - Styling Station 4',
      color: HERO_COLORS[1],
      tag: 'Extensions',
      tagColor: getTagColor('Extensions'),
    },
    {
      time: '03:00 PM',
      title: 'Editorial Bridal Trial Package',
      detail: 'Chloe - VIP Beauty Lounge',
      color: HERO_COLORS[2],
      tag: 'Bridal',
      tagColor: getTagColor('Bridal'),
    },
  ];

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative w-full max-w-[720px] overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-zinc-950 to-[#030303] p-10 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.95)]">
        <div className="mb-9 flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: HERO_COLORS[0] }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: HERO_COLORS[1] }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: HERO_COLORS[2] }} />
          </div>
        </div>

        <div className="mb-8 space-y-1">
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold tracking-tight text-white">Saturday 13</span>
          </div>
        </div>

        <div className="space-y-3.5">
          {scheduledItems.map((item) => (
            <div
              key={item.title}
              className="flex items-center justify-between rounded-xl border border-white/5 bg-zinc-900/40 p-4 transition hover:border-white/15 hover:bg-zinc-900/80"
            >
              <div className="flex items-center space-x-4 text-left">
                <div className="h-10 w-[3px] rounded-full" style={{ backgroundColor: item.color }} />
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="block text-[10px] font-mono text-zinc-400">{item.time}</span>
                    <span
                      className="rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
                      style={{
                        color: item.tagColor,
                        borderColor: `${item.tagColor}33`,
                        backgroundColor: `${item.tagColor}14`,
                      }}
                    >
                      {item.tag}
                    </span>
                  </div>
                  <span className="block text-sm font-semibold tracking-tight text-zinc-100">
                    {item.title}
                  </span>
                  <span className="block text-[10px] text-zinc-500">{item.detail}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-5 text-[10px] font-semibold tracking-wider text-zinc-500">
          <span className="flex items-center space-x-1.5">
            <Clock size={11} className="text-cyan-400" />
            <span className="text-zinc-400">Appointments</span>
          </span>
          <span className="text-zinc-400">See more details</span>
        </div>
      </div>
    </div>
  );
}

function RightCalendarGrid() {
  const [selectedDay, setSelectedDay] = useState(17);

  const itemsDatabase = {
    1: [
      { title: 'Color Consultation', category: 'Color', time: '9:00 AM', color: HERO_COLORS[0], colorText: HERO_COLORS[0], tagColor: getTagColor('Color') },
    ],
    2: [
      { title: 'Styling Appointment', category: 'Styling', time: '11:00 AM', color: HERO_COLORS[3], colorText: HERO_COLORS[3], tagColor: getTagColor('Styling') },
    ],
    3: [
      { title: 'Root Touch-Up', category: 'Color', time: '9:30 AM', color: HERO_COLORS[0], colorText: HERO_COLORS[0], tagColor: getTagColor('Color') },
      { title: 'Styling Consult', category: 'Styling', time: '1:00 PM', color: HERO_COLORS[3], colorText: HERO_COLORS[3], tagColor: getTagColor('Styling') },
    ],
    5: [
      { title: 'Haircut Appointment', category: 'Haircut', time: '10:15 AM', color: HERO_COLORS[4], colorText: HERO_COLORS[4], tagColor: getTagColor('Haircut') },
    ],
    6: [
      { title: 'Blowout Appointment', category: 'Blowout', time: '10:00 AM', color: HERO_COLORS[5], colorText: HERO_COLORS[5], tagColor: getTagColor('Blowout') },
      { title: 'Haircut & Style', category: 'Styling', time: '3:00 PM', color: HERO_COLORS[1], colorText: HERO_COLORS[1], tagColor: getTagColor('Styling') },
    ],
    7: [
      { title: 'Blowout Appointment', category: 'Blowout', time: '12:00 PM', color: HERO_COLORS[5], colorText: HERO_COLORS[5], tagColor: getTagColor('Blowout') },
    ],
    8: [
      { title: 'Color Refresh', category: 'Color', time: '11:15 AM', color: HERO_COLORS[0], colorText: HERO_COLORS[0], tagColor: getTagColor('Color') },
      { title: 'Trim Appointment', category: 'Haircut', time: '4:45 PM', color: HERO_COLORS[4], colorText: HERO_COLORS[4], tagColor: getTagColor('Haircut') },
    ],
    9: [
      { title: 'Color Appointment', category: 'Color', time: '10:30 AM', color: HERO_COLORS[0], colorText: HERO_COLORS[0], tagColor: getTagColor('Color') },
    ],
    10: [
      { title: 'Balayage Session', category: 'Color', time: '9:00 AM', color: HERO_COLORS[0], colorText: HERO_COLORS[0], tagColor: getTagColor('Color') },
      { title: 'Styling Appointment', category: 'Styling', time: '2:00 PM', color: HERO_COLORS[3], colorText: HERO_COLORS[3], tagColor: getTagColor('Styling') },
      { title: 'Blowout Appointment', category: 'Blowout', time: '5:15 PM', color: HERO_COLORS[5], colorText: HERO_COLORS[5], tagColor: getTagColor('Blowout') },
    ],
    12: [
      { title: 'Haircut Appointment', category: 'Haircut', time: '10:00 AM', color: HERO_COLORS[3], colorText: HERO_COLORS[3], tagColor: getTagColor('Haircut') },
    ],
    13: [
      { title: 'Bridal Trial', category: 'Bridal', time: '11:00 AM', color: HERO_COLORS[2], colorText: HERO_COLORS[2], tagColor: getTagColor('Bridal') },
      { title: 'Color Appointment', category: 'Color', time: '3:15 PM', color: HERO_COLORS[0], colorText: HERO_COLORS[0], tagColor: getTagColor('Color') },
    ],
    14: [
      { title: 'Styling Appointment', category: 'Styling', time: '9:30 AM', color: HERO_COLORS[3], colorText: HERO_COLORS[3], tagColor: getTagColor('Styling') },
    ],
    15: [
      { title: 'Hair Coloring Appointment', category: 'Color', time: '11:00 AM', color: HERO_COLORS[0], colorText: HERO_COLORS[0], tagColor: getTagColor('Color') },
      { title: 'Haircut & Style', category: 'Styling', time: '2:30 PM', color: HERO_COLORS[1], colorText: HERO_COLORS[1], tagColor: getTagColor('Styling') },
      { title: 'Blowout Appointment', category: 'Blowout', time: '5:30 PM', color: HERO_COLORS[5], colorText: HERO_COLORS[5], tagColor: getTagColor('Blowout') },
    ],
    16: [
      { title: 'Root Touch-Up', category: 'Color', time: '11:45 AM', color: HERO_COLORS[0], colorText: HERO_COLORS[0], tagColor: getTagColor('Color') },
    ],
    17: [
      { title: 'Hair Styling Appointment', category: 'Styling', time: 'All Day', color: HERO_COLORS[2], colorText: HERO_COLORS[2], tagColor: getTagColor('Styling') },
    ],
    19: [
      { title: 'Haircut & Style', category: 'Styling', time: '10:00 AM', color: HERO_COLORS[1], colorText: HERO_COLORS[1], tagColor: getTagColor('Styling') },
    ],
    20: [
      { title: 'Blowout Appointment', category: 'Blowout', time: '1:00 PM', color: HERO_COLORS[5], colorText: HERO_COLORS[5], tagColor: getTagColor('Blowout') },
    ],
    21: [
      { title: 'Color Refresh', category: 'Color', time: '3:30 PM', color: HERO_COLORS[0], colorText: HERO_COLORS[0], tagColor: getTagColor('Color') },
    ],
    22: [
      { title: 'Hair Color Appointment', category: 'Color', time: '9:00 AM', color: HERO_COLORS[4], colorText: HERO_COLORS[4], tagColor: getTagColor('Color') },
    ],
    23: [
      { title: 'Styling Appointment', category: 'Styling', time: '9:15 AM', color: HERO_COLORS[3], colorText: HERO_COLORS[3], tagColor: getTagColor('Styling') },
    ],
    24: [
      { title: 'Blowout Appointment', category: 'Blowout', time: '9:45 AM', color: HERO_COLORS[5], colorText: HERO_COLORS[5], tagColor: getTagColor('Blowout') },
      { title: 'Root Touch-Up', category: 'Color', time: '2:15 PM', color: HERO_COLORS[0], colorText: HERO_COLORS[0], tagColor: getTagColor('Color') },
    ],
    26: [
      { title: 'Haircut Appointment', category: 'Haircut', time: '10:30 AM', color: HERO_COLORS[4], colorText: HERO_COLORS[4], tagColor: getTagColor('Haircut') },
    ],
    27: [
      { title: 'Haircut Appointment', category: 'Haircut', time: '4:00 PM', color: HERO_COLORS[7], colorText: HERO_COLORS[7], tagColor: getTagColor('Haircut') },
    ],
    28: [
      { title: 'Styling Appointment', category: 'Styling', time: '10:45 AM', color: HERO_COLORS[3], colorText: HERO_COLORS[3], tagColor: getTagColor('Styling') },
      { title: 'Color Appointment', category: 'Color', time: '4:30 PM', color: HERO_COLORS[0], colorText: HERO_COLORS[0], tagColor: getTagColor('Color') },
    ],
  };

  return (
    <div className="relative flex h-full w-full items-center">
      <div className="relative w-full overflow-hidden rounded-[28px] border border-white/5 bg-[#08080A] p-10 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.95)]">
        <div className="mb-6 border-b border-white/5 pb-6 text-left">
          <span className="flex items-center space-x-2 text-[2rem] font-bold tracking-tight text-white">
            <CalendarIcon style={{ color: HERO_COLORS[1] }} size={22} />
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

                <div className="mt-auto flex w-full justify-center space-x-1">
                  {eventsList.map((event) => (
                    <div
                      key={`${dayNum}-${event.title}`}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: isSelected ? '#ffffff' : event.tagColor }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 min-h-[170px] border-t border-white/5 pt-5">
          <span className="mb-3 flex items-center space-x-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
            <Activity size={10} style={{ color: HERO_COLORS[1] }} />
            <span>Atelier Floor Agenda â€¢ October {selectedDay}</span>
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
