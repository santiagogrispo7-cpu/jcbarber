-- Read-only assertions after the commercial update, no real customer data.
do $$
begin
  if (select count(*) from jc_private.services where active) <> 4 then
    raise exception 'Expected four active services';
  end if;
  if (select count(*) from jc_private.services where active and modes = array['local'] and duration_minutes = 30 and
      ((name = 'Corte general' and price = 18000) or (name = 'Barba' and price = 10000) or (name = 'Perfilado de cejas' and price = 8000))) <> 3 then
    raise exception 'Incorrect local catalog';
  end if;
  if not exists (select 1 from jc_private.services where active and name = 'Corte a domicilio' and price = 20000 and duration_minutes = 45 and modes = array['home']) then
    raise exception 'Incorrect home service';
  end if;
  if (select count(*) from jc_private.hours) <> 28 or exists (
    select 1 from jc_private.hours where enabled or not (
      (start_time = '09:00' and end_time = '12:30') or (start_time = '16:30' and end_time = '20:30'))) then
    raise exception 'Expected new hours, with unknown weekdays still disabled';
  end if;
  if (select enabled from jc_private.settings) then raise exception 'Migration must not activate the agenda'; end if;
end $$;
