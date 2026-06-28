import React from 'react';
import CalendarMonthView from './CalendarMonthView';
import AppointmentsPage from './AppointmentsPage';
import { useAppointments } from '../hooks/useAppointments';

export default function CalendarPage() {
  const appointmentsData = useAppointments();

  return (
    <div className="h-full overflow-hidden bg-[#020202] p-4 md:p-5">
      <div className="flex h-full min-h-0 flex-row overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#020202] shadow-[0_32px_100px_-36px_rgba(0,0,0,0.92)]">
        <div className="min-h-0 min-w-0 flex-1 border-r border-white/[0.04]">
          <AppointmentsPage data={appointmentsData} />
        </div>

        <div className="min-h-0 w-[38%] min-w-[11.5rem] max-w-[19rem] bg-[#020202] sm:w-[35%] sm:min-w-[14rem] sm:max-w-[23rem] lg:w-[32%] lg:min-w-[18rem] lg:max-w-[28rem] xl:w-[30%] xl:min-w-[22rem] xl:max-w-[36rem]">
          <CalendarMonthView data={appointmentsData} />
        </div>
      </div>
    </div>
  );
}
