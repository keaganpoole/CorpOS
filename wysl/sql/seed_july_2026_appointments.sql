insert into public.appointments (
  id,
  date,
  time,
  duration,
  status,
  notes,
  scenario_id,
  created_at,
  user_id,
  person_id,
  service_id,
  business_id,
  custom_fields,
  source,
  updated_at,
  receptionist_id
) values
  ('11111111-1111-4111-8111-111111111111', '2026-07-02', '09:00', 30, 'confirmed', 'July test appointment 1', null, now(), 'f7f077d7-1236-4367-8dd5-409231cfa8fe', null, null, 12, '{}'::jsonb, 'Manual', now(), 12),
  ('22222222-2222-4222-8222-222222222222', '2026-07-03', '10:15', 45, 'pending', 'July test appointment 2', null, now(), 'f7f077d7-1236-4367-8dd5-409231cfa8fe', null, null, 12, '{}'::jsonb, 'Manual', now(), 18),
  ('33333333-3333-4333-8333-333333333333', '2026-07-06', '11:30', 30, 'confirmed', 'July test appointment 3', null, now(), 'f7f077d7-1236-4367-8dd5-409231cfa8fe', null, null, 12, '{}'::jsonb, 'Manual', now(), 23),
  ('44444444-4444-4444-8444-444444444444', '2026-07-08', '13:00', 60, 'completed', 'July test appointment 4', null, now(), 'f7f077d7-1236-4367-8dd5-409231cfa8fe', null, null, 12, '{}'::jsonb, 'Manual', now(), 24),
  ('55555555-5555-4555-8555-555555555555', '2026-07-10', '14:30', 30, 'pending', 'July test appointment 5', null, now(), 'f7f077d7-1236-4367-8dd5-409231cfa8fe', null, null, 12, '{}'::jsonb, 'Manual', now(), 29),
  ('66666666-6666-4666-8666-666666666666', '2026-07-13', '09:45', 45, 'confirmed', 'July test appointment 6', null, now(), 'f7f077d7-1236-4367-8dd5-409231cfa8fe', null, null, 12, '{}'::jsonb, 'Manual', now(), 12),
  ('77777777-7777-4777-8777-777777777777', '2026-07-15', '12:15', 30, 'missed', 'July test appointment 7', null, now(), 'f7f077d7-1236-4367-8dd5-409231cfa8fe', null, null, 12, '{}'::jsonb, 'Manual', now(), 18),
  ('88888888-8888-4888-8888-888888888888', '2026-07-17', '15:00', 60, 'confirmed', 'July test appointment 8', null, now(), 'f7f077d7-1236-4367-8dd5-409231cfa8fe', null, null, 12, '{}'::jsonb, 'Manual', now(), 23),
  ('99999999-9999-4999-8999-999999999999', '2026-07-21', '10:30', 30, 'pending', 'July test appointment 9', null, now(), 'f7f077d7-1236-4367-8dd5-409231cfa8fe', null, null, 12, '{}'::jsonb, 'Manual', now(), 24),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-07-24', '16:00', 45, 'confirmed', 'July test appointment 10', null, now(), 'f7f077d7-1236-4367-8dd5-409231cfa8fe', null, null, 12, '{}'::jsonb, 'Manual', now(), 29)
on conflict (id) do nothing;
