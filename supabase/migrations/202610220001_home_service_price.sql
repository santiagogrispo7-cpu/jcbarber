-- Home service price confirmed by the owner on 2026-10-22.
-- Existing bookings keep their immutable price/duration snapshots.
begin;
select jc_private.lock_agenda();

update jc_private.services
set price = 30000
where name = 'Corte a domicilio' and modes = array['home'];

commit;
