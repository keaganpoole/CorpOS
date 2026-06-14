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

const CalendarShowcase = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % TOTAL_SLIDES);
    }, 6500);

    return () => clearInterval(interval);
  }, []);

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
              >
                <RightHeroWidget />
              </div>
              <div
                className={`absolute inset-0 transition-opacity duration-500 ease-out ${
                  currentSlide === 1 ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
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
      colorClass: 'from-cyan-500 to-blue-500',
      tag: 'Color',
      tagColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    },
    {
      time: '11:30 AM',
      title: 'Platinum Weft Extensions Fitting',
      detail: 'Elena - Styling Station 4',
      colorClass: 'from-violet-500 to-fuchsia-500',
      tag: 'Extensions',
      tagColor: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    },
    {
      time: '03:00 PM',
      title: 'Editorial Bridal Trial Package',
      detail: 'Chloe - VIP Beauty Lounge',
      colorClass: 'from-amber-500 to-rose-500',
      tag: 'Bridal',
      tagColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
  ];

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative w-full max-w-[720px] overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-zinc-950 to-[#030303] p-10 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.95)]">
        <div className="mb-9 flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
            <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          </div>
        </div>

        <div className="mb-8 space-y-1">
          <span className="block text-xs font-bold uppercase tracking-widest text-zinc-500">
          </span>
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
                <div className={`h-10 w-[3px] rounded-full bg-gradient-to-b ${item.colorClass}`} />
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="block text-[10px] font-mono text-zinc-400">{item.time}</span>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${item.tagColor}`}
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
    12: [{ title: 'Color Masterclass (Stylist Academy)', category: 'Academy', time: '10:00 AM', color: 'bg-cyan-500', colorText: 'text-cyan-400' }],
    15: [
      { title: 'Vogue Couture Editorial Shoot', category: 'High Fashion', time: '11:00 AM', color: 'bg-violet-500', colorText: 'text-violet-400' },
      { title: 'VIP Guest Session: Bridal Suite Closeout', category: 'VIP Closeout', time: '2:30 PM', color: 'bg-pink-500', colorText: 'text-pink-400' },
    ],
    17: [{ title: 'Atelier Client Day Sequence', category: 'Featured', time: 'All Day', color: 'bg-fuchsia-500', colorText: 'text-fuchsia-300' }],
    22: [{ title: 'Master Stylist Performance Reviews', category: 'Internal Sync', time: '9:00 AM', color: 'bg-violet-500', colorText: 'text-violet-400' }],
    27: [{ title: 'Atelier Winter Collection Launch Gala', category: 'Gala Launch', time: '4:00 PM', color: 'bg-emerald-500', colorText: 'text-emerald-400' }],
  };

  return (
    <div className="relative flex h-full w-full items-center">
      <div className="relative w-full overflow-hidden rounded-[28px] border border-white/5 bg-[#08080A] p-10 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.95)]">
      <div className="mb-6 border-b border-white/5 pb-6 text-left">
        <span className="flex items-center space-x-2 text-[2rem] font-bold tracking-tight text-white">
          <CalendarIcon className="text-violet-400" size={22} />
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
                  ? 'z-10 scale-[1.03] border-transparent bg-gradient-to-tr from-violet-600 via-purple-600 to-fuchsia-600 text-white shadow-[0_0_24px_rgba(139,92,246,0.45)]'
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
                    className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : event.color}`}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 border-t border-white/5 pt-5">
        <span className="mb-3 flex items-center space-x-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
          <Activity size={10} className="text-violet-400" />
          <span>Atelier Floor Agenda • October {selectedDay}</span>
        </span>
        {itemsDatabase[selectedDay] ? (
          <div className="space-y-2">
            {itemsDatabase[selectedDay].map((event) => (
              <div
                key={event.title}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-zinc-950 p-3 text-left"
              >
                <div className="flex items-center space-x-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${event.color}`} />
                  <span className="text-xs font-semibold text-zinc-200">{event.title}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`rounded border border-white/5 bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${event.colorText}`}>
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
