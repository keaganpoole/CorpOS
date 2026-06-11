import React, { useState } from 'react';
import { CalendarFold, Rows3 } from 'lucide-react';
import CalendarMonthView from './CalendarMonthView';
import AppointmentsPage from './AppointmentsPage';

const VIEW_OPTIONS = [
  { key: 'calendar', label: 'Calendar View', icon: CalendarFold },
  { key: 'crm', label: 'CRM View', icon: Rows3 },
];

export default function CalendarPage() {
  const [activeView, setActiveView] = useState('calendar');

  return (
    <div className="h-full flex flex-col bg-[#020202] overflow-hidden">
      <div className="shrink-0 px-8 pt-5 pb-3 border-b border-white/[0.04] bg-[#070707]/92 backdrop-blur-xl">
        <div className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1">
          {VIEW_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = activeView === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setActiveView(option.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[11px] font-semibold tracking-[-0.02em] transition-all ${active ? 'bg-white text-black shadow-[0_0_18px_rgba(255,255,255,0.08)]' : 'text-zinc-500 hover:text-white hover:bg-white/[0.04]'}`}
              >
                <Icon size={13} />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {activeView === 'calendar' ? <CalendarMonthView /> : <AppointmentsPage />}
      </div>
    </div>
  );
}
