-- Commercial details confirmed by the owner on 2026-10-21.
-- Existing bookings keep their immutable price/duration snapshots.
begin;
select jc_private.lock_agenda();

update jc_private.services set active = false;
insert into jc_private.services(name, price, duration_minutes, modes, active) values
  ('Corte general', 18000, 30, array['local'], true),
  ('Barba', 10000, 30, array['local'], true),
  ('Perfilado de cejas', 8000, 30, array['local'], true),
  ('Corte a domicilio', 20000, 45, array['home'], true);

-- Keep each weekday/mode's activation state; do not invent operating days.
create temporary table customer_hours_state on commit drop as
select weekday, mode, bool_or(enabled) as enabled
from jc_private.hours group by weekday, mode;
delete from jc_private.hours;
insert into jc_private.hours(weekday, mode, start_time, end_time, enabled)
select d, m, w.starts::time, w.ends::time, coalesce(s.enabled, false)
from generate_series(0,6) d
cross join (values ('local'), ('home')) modes(m)
cross join (values ('09:00','12:30'), ('16:30','20:30')) w(starts,ends)
left join customer_hours_state s on s.weekday = d and s.mode = m;

-- Both 30- and 45-minute start grids are compatible with the server's 15-minute grid.
update jc_private.settings set slot_step_minutes = 15;
commit;
