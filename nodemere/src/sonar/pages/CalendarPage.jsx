import React, { useEffect, useState } from 'react';
import CalendarMonthView from './CalendarMonthView';
import AppointmentsPage from './AppointmentsPage';
import { useAppointments } from '../hooks/useAppointments';

export default function CalendarPage({ onToolbarMetaChange = null }) {
  const appointmentsData = useAppointments();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mobilePanel, setMobilePanel] = useState('appointments');

  useEffect(() => {
    const hasAppointmentWithPerson = appointmentsData.allAppointments.some((appointment) => (
      String(appointment.person_id || '').trim().length > 0
    ));
    onToolbarMetaChange?.({
      count: appointmentsData.allAppointments.length,
      loading: appointmentsData.loading,
      hasAppointmentWithPerson,
    });
  }, [appointmentsData.allAppointments, appointmentsData.loading, onToolbarMetaChange]);

  return (
    <div className="h-full overflow-hidden bg-[#020202] px-4 pb-5 pt-8 md:px-5 md:pb-5 md:pt-8">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#020202] shadow-[0_32px_100px_-36px_rgba(0,0,0,0.92)] 2xl:flex-row">
        <div className="relative flex shrink-0 items-center gap-1 border-b border-white/[0.06] bg-[#050505] px-1.5 pb-2 pt-1.5 2xl:hidden">
          <div className="absolute bottom-0 left-1.5 right-1.5 h-px bg-white/[0.04]" />
          <div
            className="absolute bottom-0 left-1.5 h-px rounded-full bg-gradient-to-r from-[var(--brandGradientStart)] to-[var(--brandGradientEnd)] shadow-[0_0_10px_color-mix(in_srgb,var(--brandGradientStart)_24%,transparent)] transition-transform duration-300 ease-out"
            style={{
              width: 'calc(50% - 0.1875rem)',
              transform: `translateX(${mobilePanel === 'calendar' ? 'calc(100% + 0.25rem)' : '0'})`,
            }}
          />
          <button
            type="button"
            onClick={() => setMobilePanel('appointments')}
            className={`flex h-10 flex-1 items-center justify-center rounded-2xl text-[11px] font-semibold tracking-[-0.02em] transition-all ${
              mobilePanel === 'appointments'
                ? 'text-zinc-100'
                : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'
            }`}
          >
            Appointments
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel('calendar')}
            className={`flex h-10 flex-1 items-center justify-center rounded-2xl text-[11px] font-semibold tracking-[-0.02em] transition-all ${
              mobilePanel === 'calendar'
                ? 'text-zinc-100'
                : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'
            }`}
          >
            Calendar
          </button>
        </div>

        <div className={`min-w-0 overflow-hidden border-b border-white/[0.04] transition-[flex-basis,opacity] duration-300 ease-out 2xl:min-h-0 2xl:flex-1 2xl:border-b-0 2xl:border-r ${
          mobilePanel === 'appointments' ? 'min-h-0 flex-[1_1_auto] opacity-100' : 'flex-[0_0_0px] opacity-0 2xl:opacity-100'
        }`}>
          <AppointmentsPage data={appointmentsData} defaultAppointmentDate={selectedDate} hideTitle />
        </div>

        <div className={`min-w-0 overflow-hidden bg-[#020202] transition-[flex-basis,opacity] duration-300 ease-out 2xl:min-h-0 2xl:w-[34rem] 2xl:flex-none 2xl:opacity-100 ${
          mobilePanel === 'calendar' ? 'min-h-0 flex-[1_1_auto] opacity-100' : 'flex-[0_0_0px] opacity-0'
        }`}>
          <CalendarMonthView
            data={appointmentsData}
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
            className="mx-auto max-w-[760px] 2xl:max-w-none"
          />
        </div>
      </div>
    </div>
  );
}
