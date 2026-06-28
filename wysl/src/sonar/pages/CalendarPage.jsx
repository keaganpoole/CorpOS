import React from 'react';
import CalendarMonthView from './CalendarMonthView';
import AppointmentsPage from './AppointmentsPage';
import { useAppointments } from '../hooks/useAppointments';

export default function CalendarPage() {
  const appointmentsData = useAppointments();

  return (
    <div className="h-full bg-[#020202] overflow-hidden">
      <div className="flex h-full min-h-0 flex-row">
        <div className="min-h-0 min-w-0 flex-1">
          <AppointmentsPage data={appointmentsData} />
        </div>

        <div className="min-h-0 w-[38%] min-w-[11.5rem] max-w-[19rem] border-l border-white/[0.04] sm:w-[35%] sm:min-w-[14rem] sm:max-w-[23rem] lg:w-[32%] lg:min-w-[18rem] lg:max-w-[28rem] xl:w-[30%] xl:min-w-[22rem] xl:max-w-[36rem]">
          <CalendarMonthView data={appointmentsData} />
        </div>
      </div>
    </div>
  );
}
