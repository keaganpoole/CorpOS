-- Allow appointments.status to accept "completed" and "missed" for
-- post-visit and no-show workflows.

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'confirmed'::text,
        'cancelled'::text,
        'completed'::text,
        'missed'::text
      ]
    )
  );
