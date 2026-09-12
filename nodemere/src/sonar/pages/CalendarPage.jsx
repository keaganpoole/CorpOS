import React, { useCallback, useEffect, useRef, useState } from 'react';
import CalendarMonthView from './CalendarMonthView';
import AppointmentsPage from './AppointmentsPage';
import { useAppointments } from '../hooks/useAppointments';

const CALENDAR_MIN_WIDTH = 34 * 16;
const APPOINTMENTS_MIN_WIDTH = 32 * 16;
const SPLIT_HANDLE_WIDTH = 12;
const DESKTOP_SPLIT_QUERY = '(min-width: 1536px)';

export default function CalendarPage({ onToolbarMetaChange = null }) {
  const appointmentsData = useAppointments();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mobilePanel, setMobilePanel] = useState('appointments');
  const [calendarWidth, setCalendarWidth] = useState(null);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const splitContainerRef = useRef(null);

  const getCalendarWidthBounds = useCallback(() => {
    const containerWidth = splitContainerRef.current?.clientWidth || 0;
    return {
      min: CALENDAR_MIN_WIDTH,
      max: Math.max(CALENDAR_MIN_WIDTH, containerWidth - APPOINTMENTS_MIN_WIDTH - SPLIT_HANDLE_WIDTH),
    };
  }, []);

  const clampCalendarWidth = useCallback((width) => {
    const { min, max } = getCalendarWidthBounds();
    return Math.min(Math.max(width, min), max);
  }, [getCalendarWidthBounds]);

  const handleSplitPointerDown = useCallback((event) => {
    if (event.button !== 0 || !window.matchMedia(DESKTOP_SPLIT_QUERY).matches) return;

    event.preventDefault();
    setIsDraggingSplit(true);
    const startX = event.clientX;
    const startCalendarWidth = calendarWidth ?? CALENDAR_MIN_WIDTH;

    const handlePointerMove = (moveEvent) => {
      setCalendarWidth(clampCalendarWidth(startCalendarWidth - (moveEvent.clientX - startX)));
    };
    const handlePointerUp = () => {
      setIsDraggingSplit(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('pointercancel', handlePointerUp, { once: true });
  }, [calendarWidth, clampCalendarWidth]);

  const handleSplitKeyDown = useCallback((event) => {
    const { min, max } = getCalendarWidthBounds();
    const currentWidth = calendarWidth ?? CALENDAR_MIN_WIDTH;
    let nextWidth = null;

    if (event.key === 'ArrowLeft') nextWidth = currentWidth + 32;
    if (event.key === 'ArrowRight') nextWidth = currentWidth - 32;
    if (event.key === 'Home') nextWidth = min;
    if (event.key === 'End') nextWidth = max;
    if (nextWidth == null) return;

    event.preventDefault();
    setCalendarWidth(Math.min(Math.max(nextWidth, min), max));
  }, [calendarWidth, getCalendarWidthBounds]);

  useEffect(() => {
    const splitContainer = splitContainerRef.current;
    if (!splitContainer || typeof window === 'undefined') return undefined;

    const desktopQuery = window.matchMedia(DESKTOP_SPLIT_QUERY);
    const keepSplitInBounds = () => {
      if (!desktopQuery.matches) return;
      setCalendarWidth((width) => (width == null ? width : clampCalendarWidth(width)));
    };
    const resizeObserver = new ResizeObserver(keepSplitInBounds);

    resizeObserver.observe(splitContainer);
    desktopQuery.addEventListener('change', keepSplitInBounds);
    return () => {
      resizeObserver.disconnect();
      desktopQuery.removeEventListener('change', keepSplitInBounds);
    };
  }, [clampCalendarWidth]);

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
      <div
        ref={splitContainerRef}
        className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#020202] shadow-[0_32px_100px_-36px_rgba(0,0,0,0.92)] 2xl:flex-row"
        style={{ '--calendar-panel-width': `${calendarWidth ?? CALENDAR_MIN_WIDTH}px` }}
      >
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

        <div className={`min-w-0 overflow-hidden border-b border-white/[0.04] transition-[flex-basis,opacity] duration-300 ease-out 2xl:min-h-0 2xl:min-w-[32rem] 2xl:flex-1 2xl:border-b-0 ${
          mobilePanel === 'appointments' ? 'min-h-0 flex-[1_1_auto] opacity-100' : 'flex-[0_0_0px] opacity-0 2xl:opacity-100'
        }`}>
          <AppointmentsPage data={appointmentsData} defaultAppointmentDate={selectedDate} hideTitle />
        </div>

        <div
          role="separator"
          aria-label="Resize appointments and calendar panels"
          aria-orientation="vertical"
          aria-valuemin={CALENDAR_MIN_WIDTH}
          aria-valuemax={getCalendarWidthBounds().max}
          aria-valuenow={calendarWidth ?? CALENDAR_MIN_WIDTH}
          tabIndex={0}
          onPointerDown={handleSplitPointerDown}
          onKeyDown={handleSplitKeyDown}
          className={`group relative hidden w-3 shrink-0 cursor-col-resize touch-none outline-none 2xl:block ${
            isDraggingSplit ? 'bg-white/[0.04]' : 'hover:bg-white/[0.025] focus-visible:bg-white/[0.04]'
          }`}
        >
          <span className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors ${
            isDraggingSplit ? 'bg-white/30' : 'bg-white/[0.06] group-hover:bg-white/20 group-focus-visible:bg-white/20'
          }`} />
          <span className={`absolute left-1/2 top-1/2 flex h-8 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[10px] tracking-[-0.28em] transition-all ${
            isDraggingSplit
              ? 'border-white/20 bg-[#141414] text-zinc-200 shadow-[0_8px_20px_rgba(0,0,0,0.45)]'
              : 'border-transparent bg-[#101010] text-zinc-600 opacity-0 group-hover:border-white/[0.12] group-hover:opacity-100 group-focus-visible:border-white/[0.12] group-focus-visible:opacity-100'
          }`} aria-hidden="true">
            ⋮
          </span>
        </div>

        <div className={`min-w-0 overflow-hidden bg-[#020202] transition-[flex-basis,opacity] duration-300 ease-out 2xl:min-h-0 2xl:w-[var(--calendar-panel-width)] 2xl:flex-none 2xl:opacity-100 ${
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
