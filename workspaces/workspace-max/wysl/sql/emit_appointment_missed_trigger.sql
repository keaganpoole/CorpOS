-- Fire the appointment_missed scenario event whenever an appointment is
-- inserted or updated to status = 'missed'.

CREATE OR REPLACE FUNCTION public.emit_appointment_missed_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'missed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.scenario_events (trigger_key, payload)
    VALUES (
      'appointment_missed',
      jsonb_build_object(
        'appointment_id', NEW.id,
        'client_name', NEW.client_name,
        'date', NEW.date,
        'time', NEW.time,
        'duration', NEW.duration,
        'status', NEW.status,
        'person_id', NEW.person_id,
        'service_id', NEW.service_id,
        'business_id', NEW.business_id,
        'assigned_receptionist', NEW.assigned_receptionist,
        'notes', NEW.notes
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emit_appointment_missed_event ON public.appointments;

CREATE TRIGGER trg_emit_appointment_missed_event
AFTER INSERT OR UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.emit_appointment_missed_event();
