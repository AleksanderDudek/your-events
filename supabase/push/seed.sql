-- The starting schedule: Sunday, Tuesday and Thursday at 12:00, in each
-- visitor's own timezone. After this, the owner edits the table directly.
insert into __SCHEMA__.push_schedule (weekday, local_time, note) values
  (7, '12:00', 'niedziela'),
  (2, '12:00', 'wtorek'),
  (4, '12:00', 'czwartek')
on conflict (weekday, local_time) do nothing;
