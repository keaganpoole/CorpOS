begin;

-- Appointment changes now flow through the authenticated backend, which emits
-- a tenant-bound encrypted scenario event. Retire the legacy database trigger:
-- it duplicated events and cannot safely access the server-held encryption key.
drop trigger if exists trg_emit_appointment_missed_event on public.appointments;
drop function if exists public.emit_appointment_missed_event();

commit;
