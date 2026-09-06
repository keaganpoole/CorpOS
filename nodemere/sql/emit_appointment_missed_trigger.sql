-- Retired by Phase 6. Appointment mutations use the authenticated backend,
-- which emits tenant-bound encrypted scenario events without duplicating PHI.
drop trigger if exists trg_emit_appointment_missed_event on public.appointments;
drop function if exists public.emit_appointment_missed_event();
