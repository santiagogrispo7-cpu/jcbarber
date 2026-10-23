-- JC Barber: PostgreSQL 15+ / Supabase. Run as the trusted migration owner.
begin;

create schema jc_private;
revoke all on schema jc_private from public, anon, authenticated;
alter default privileges in schema jc_private revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public;

create table jc_private.authorized_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp()
);

create table jc_private.settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  timezone text not null default 'America/Argentina/Buenos_Aires'
    check (timezone = 'America/Argentina/Buenos_Aires'),
  break_minutes integer check (break_minutes between 0 and 240),
  travel_before_minutes integer check (travel_before_minutes between 0 and 240),
  travel_after_minutes integer check (travel_after_minutes between 0 and 240),
  slot_step_minutes integer not null default 15 check (slot_step_minutes between 1 and 120),
  horizon_days integer not null default 90 check (horizon_days between 1 and 366),
  check (not enabled or (break_minutes is not null and travel_before_minutes is not null
    and travel_after_minutes is not null))
);

create table jc_private.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  price numeric(12,2) check (price between 0 and 10000000),
  duration_minutes integer check (duration_minutes between 1 and 480),
  modes text[] not null check (cardinality(modes) between 1 and 2
    and modes <@ array['local','home']::text[] and array_position(modes, null) is null
    and (cardinality(modes) = 1 or modes[1] <> modes[2])),
  active boolean not null default false
);

create table jc_private.hours (
  id uuid primary key default gen_random_uuid(),
  weekday integer not null check (weekday between 0 and 6),
  mode text not null check (mode in ('local','home')),
  start_time time not null,
  end_time time not null,
  enabled boolean not null default false,
  check (start_time < end_time),
  unique (weekday, mode, start_time, end_time)
);

-- One resource, one exclusion constraint: bookings AND blocks, across BOTH modes.
create table jc_private.agenda (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('booking','block')),
  starts_at timestamptz not null check (isfinite(starts_at)),
  ends_at timestamptz not null check (isfinite(ends_at)),
  occupied_start timestamptz not null,
  occupied_end timestamptz not null,
  occupied tstzrange generated always as (tstzrange(occupied_start, occupied_end, '[)')) stored,
  status text not null default 'confirmed' check (status in ('confirmed','completed','cancelled','no_show')),
  service_id uuid references jc_private.services(id),
  service_name text,
  mode text check (mode in ('local','home')),
  price numeric(12,2),
  duration_minutes integer,
  break_minutes integer,
  travel_before_minutes integer,
  travel_after_minutes integer,
  customer_name text,
  phone text,
  address text,
  notes text,
  reason text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (starts_at < ends_at and occupied_start <= starts_at and occupied_end >= ends_at),
  check ((kind = 'block' and status = 'confirmed' and occupied_start = starts_at
      and occupied_end = ends_at and service_id is null and customer_name is null
      and phone is null and address is null and notes is null and char_length(reason) <= 250)
    or (kind = 'booking' and service_id is not null and service_name is not null
      and mode is not null and price is not null and price >= 0
      and duration_minutes is not null and duration_minutes between 1 and 480
      and break_minutes is not null and break_minutes between 0 and 240
      and travel_before_minutes is not null and travel_before_minutes between 0 and 240
      and travel_after_minutes is not null and travel_after_minutes between 0 and 240
      and (mode <> 'home' or (travel_before_minutes > 0 and travel_after_minutes > 0))
      and ends_at = starts_at + duration_minutes * interval '1 minute'
      and occupied_start = starts_at - travel_before_minutes * interval '1 minute'
      and occupied_end = ends_at + (travel_after_minutes + break_minutes) * interval '1 minute'
      and customer_name is not null and phone is not null and reason is null)),
  constraint agenda_no_overlap exclude using gist (occupied with &&) where (status <> 'cancelled')
);

-- Never exposed. Exact normalized payload comparison is the retry credential.
create table jc_private.booking_requests (
  request_id uuid primary key,
  payload jsonb not null,
  booking_id uuid not null unique references jc_private.agenda(id),
  response jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);

insert into jc_private.settings(singleton) values (true);
insert into jc_private.services(name, modes) values ('Corte de pelo', array['local','home']);
insert into jc_private.hours(weekday, mode, start_time, end_time)
select d, h.mode, h.start_time::time, h.end_time::time
from generate_series(0,6) as d
cross join (values ('home','07:00','08:30'), ('home','12:45','15:45'),
  ('local','09:00','12:30'), ('local','16:00','20:30')) as h(mode,start_time,end_time);

-- No table policies: default deny, including authenticated administrators.
alter table jc_private.authorized_admins enable row level security;
alter table jc_private.authorized_admins force row level security;
alter table jc_private.settings enable row level security;
alter table jc_private.settings force row level security;
alter table jc_private.services enable row level security;
alter table jc_private.services force row level security;
alter table jc_private.hours enable row level security;
alter table jc_private.hours force row level security;
alter table jc_private.agenda enable row level security;
alter table jc_private.agenda force row level security;
alter table jc_private.booking_requests enable row level security;
alter table jc_private.booking_requests force row level security;
revoke all on all tables in schema jc_private from public, anon, authenticated;

create function jc_private.is_admin() returns boolean
language sql stable security definer set search_path = pg_catalog
as $$ select exists (select 1 from jc_private.authorized_admins where user_id = auth.uid()) $$;

create function jc_private.require_admin() returns void
language plpgsql security definer set search_path = pg_catalog
as $$ begin
  if not jc_private.is_admin() then
    raise exception using errcode = '42501', message = 'Acceso administrativo no autorizado.';
  end if;
end $$;

create function jc_private.lock_agenda() returns void
language plpgsql volatile security definer set search_path = pg_catalog
as $$ begin
  -- READ COMMITTED gives each query after the lock a fresh committed snapshot.
  -- Reject transaction modes that could keep a pre-lock snapshot.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = '40001', message = 'Reintentá la operación en una transacción READ COMMITTED.';
  end if;
  perform pg_advisory_xact_lock(741932, 1);
end $$;

create function jc_private.serialize_write() returns trigger
language plpgsql security definer set search_path = pg_catalog
as $$ begin perform jc_private.lock_agenda(); return null; end $$;

create trigger serialize_write before insert or update or delete or truncate on jc_private.settings
for each statement execute function jc_private.serialize_write();
create trigger serialize_write before insert or update or delete or truncate on jc_private.services
for each statement execute function jc_private.serialize_write();
create trigger serialize_write before insert or update or delete or truncate on jc_private.hours
for each statement execute function jc_private.serialize_write();
create trigger serialize_write before insert or update or delete or truncate on jc_private.agenda
for each statement execute function jc_private.serialize_write();
create trigger serialize_write before insert or update or delete or truncate on jc_private.booking_requests
for each statement execute function jc_private.serialize_write();
create trigger serialize_write before insert or update or delete or truncate on jc_private.authorized_admins
for each statement execute function jc_private.serialize_write();

create function jc_private.config_ready() returns boolean
language sql stable security definer set search_path = pg_catalog
as $$
  select s.break_minutes is not null and s.travel_before_minutes is not null
    and s.travel_after_minutes is not null
    and exists (select 1 from jc_private.services where active)
    and not exists (select 1 from jc_private.services where active and (price is null or duration_minutes is null))
    and exists (select 1 from jc_private.hours where enabled)
    and (not exists (select 1 from jc_private.services where active and 'home' = any(modes))
      and not exists (select 1 from jc_private.hours where enabled and mode = 'home')
      or (s.travel_before_minutes > 0 and s.travel_after_minutes > 0))
  from jc_private.settings s where singleton
$$;

create function jc_private.fits_window(
  p_start timestamptz, p_duration integer, p_mode text,
  p_before integer, p_after integer, p_break integer, p_step integer
) returns boolean
language sql stable security definer set search_path = pg_catalog
as $$
  select exists (
    select 1 from jc_private.hours h
    cross join lateral (select p_start at time zone 'America/Argentina/Buenos_Aires' as local_start) t
    where h.enabled and h.mode = p_mode and h.weekday = extract(dow from t.local_start)::integer
      and p_start - p_before * interval '1 minute' >=
        (t.local_start::date + h.start_time) at time zone 'America/Argentina/Buenos_Aires'
      and p_start + (p_duration + p_after + p_break) * interval '1 minute' <=
        (t.local_start::date + h.end_time) at time zone 'America/Argentina/Buenos_Aires'
      and mod(extract(epoch from (t.local_start - (t.local_start::date + h.start_time))), p_step * 60) = 0
  )
$$;

create function public.public_catalog() returns jsonb
language plpgsql stable security definer set search_path = pg_catalog
as $$ declare s jc_private.settings; begin
  select * into strict s from jc_private.settings where singleton;
  return jsonb_build_object('enabled', s.enabled, 'timezone', s.timezone, 'horizon_days', s.horizon_days,
    'services', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'price', price,
      'duration_minutes', duration_minutes, 'modes', modes, 'active', active) order by name, id)
      from jc_private.services where s.enabled and active and price is not null and duration_minutes is not null), '[]'::jsonb));
end $$;

create function public.available_slots(p_service uuid, p_mode text, p_date date)
returns table(starts_at timestamptz, ends_at timestamptz, price numeric, duration_minutes integer)
language plpgsql volatile security definer set search_path = pg_catalog set timezone = 'UTC'
as $$ declare
  s jc_private.settings; v jc_private.services; b integer; a integer;
  today date := (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if p_mode is null or p_mode not in ('local','home') or p_date is null or not isfinite(p_date) then
    raise exception using errcode = '22023', message = 'Fecha o modalidad inválida.';
  end if;
  select * into strict s from jc_private.settings where singleton;
  if (not s.enabled and not jc_private.is_admin()) or not jc_private.config_ready()
    or p_date < today or p_date > today + s.horizon_days then return; end if;
  select svc.* into v from jc_private.services svc where svc.id = p_service and svc.active
    and svc.price is not null and svc.duration_minutes is not null and p_mode = any(svc.modes);
  if not found then return; end if;
  b := case when p_mode = 'home' then s.travel_before_minutes else 0 end;
  a := case when p_mode = 'home' then s.travel_after_minutes else 0 end;
  return query
    select distinct g.t, g.t + v.duration_minutes * interval '1 minute', v.price, v.duration_minutes
    from jc_private.hours h
    cross join lateral generate_series(
      (p_date + h.start_time) at time zone s.timezone,
      (p_date + h.end_time) at time zone s.timezone,
      s.slot_step_minutes * interval '1 minute') g(t)
    where h.enabled and h.weekday = extract(dow from p_date)::integer and h.mode = p_mode
      and g.t > clock_timestamp() and g.t - b * interval '1 minute' >= clock_timestamp()
      and jc_private.fits_window(g.t, v.duration_minutes, p_mode, b, a, s.break_minutes, s.slot_step_minutes)
      and not exists (select 1 from jc_private.agenda x where x.status <> 'cancelled'
        and x.occupied && tstzrange(g.t - b * interval '1 minute',
          g.t + (v.duration_minutes + a + s.break_minutes) * interval '1 minute', '[)'))
    order by 1;
end $$;

create function jc_private.booking_result(p_row jc_private.agenda) returns jsonb
language sql immutable set search_path = pg_catalog set timezone = 'UTC'
as $$ select jsonb_build_object('id', p_row.id, 'starts_at', p_row.starts_at, 'ends_at', p_row.ends_at,
  'price', p_row.price, 'service_name', p_row.service_name, 'mode', p_row.mode, 'status', p_row.status) $$;

create function jc_private.insert_booking(p_data jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog set timezone = 'UTC'
as $$ declare
  s jc_private.settings; v jc_private.services; r jc_private.agenda; prior jc_private.booking_requests;
  req uuid; sid uuid; st timestamptz; m text; n text; ph text; ad text; nt text;
  payload jsonb; result jsonb; d date; b integer; a integer; field text;
begin
  perform jc_private.lock_agenda();
  if jsonb_typeof(p_data) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'Datos de reserva inválidos.';
  end if;
  foreach field in array array['request_id','service_id','mode','starts_at','customer_name','phone'] loop
    if jsonb_typeof(p_data->field) is distinct from 'string' then
      raise exception using errcode = '22023', message = 'Completá los campos obligatorios de la reserva con texto válido.';
    end if;
  end loop;
  foreach field in array array['address','notes'] loop
    if coalesce(jsonb_typeof(p_data->field),'null') not in ('string','null') then
      raise exception using errcode = '22023', message = 'La dirección y las notas deben ser texto.';
    end if;
  end loop;
  req := (p_data->>'request_id')::uuid; sid := (p_data->>'service_id')::uuid;
  -- Require an explicit offset: never interpret a client timestamp in the server's local zone.
  if coalesce(p_data->>'starts_at','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$' then
    raise exception using errcode = '22023', message = 'La fecha debe incluir hora y zona horaria.';
  end if;
  st := (p_data->>'starts_at')::timestamptz; m := p_data->>'mode';
  n := btrim(p_data->>'customer_name'); ph := btrim(p_data->>'phone');
  ad := nullif(btrim(p_data->>'address'), ''); nt := nullif(btrim(p_data->>'notes'), '');
  if req is null or sid is null or st is null or not isfinite(st) or m is null or m not in ('local','home') then
    raise exception using errcode = '22023', message = 'Faltan datos obligatorios de la reserva.';
  end if;
  if n is null or char_length(n) not between 3 and 120 or n ~ '[[:cntrl:]]'
    or n !~ '[[:alpha:]][^[:space:]]*[[:space:]]+.*[[:alpha:]]' then
    raise exception using errcode = '22023', message = 'Ingresá nombre y apellido (hasta 120 caracteres).';
  end if;
  if ph is null or ph !~ '^\+?[1-9][0-9]{9,14}$' then
    raise exception using errcode = '22023', message = 'Ingresá un teléfono de 10 a 15 dígitos, con + opcional.';
  end if;
  if (m = 'home' and (ad is null or char_length(ad) < 5)) or char_length(ad) > 250 then
    raise exception using errcode = '22023', message = 'Ingresá una dirección de 5 a 250 caracteres para domicilio.';
  end if;
  if char_length(nt) > 500 then
    raise exception using errcode = '22023', message = 'Las notas admiten hasta 500 caracteres.';
  end if;
  payload := jsonb_build_object('service_id',sid,'starts_at',st,'mode',m,
    'customer_name',n,'phone',ph,'address',ad,'notes',nt);
  select * into prior from jc_private.booking_requests where request_id = req;
  if found then
    if prior.payload <> payload then
      raise exception using errcode = '23505', message = 'La clave de solicitud ya fue utilizada con otros datos.';
    end if;
    return prior.response;
  end if;
  select * into strict s from jc_private.settings where singleton;
  if not s.enabled and not jc_private.is_admin() then
    raise exception using errcode = '55000', message = 'Las reservas online están desactivadas.';
  end if;
  if not jc_private.config_ready() then
    raise exception using errcode = '55000', message = 'La configuración de la agenda está incompleta.';
  end if;
  select * into v from jc_private.services where id = sid and active and m = any(modes)
    and price is not null and duration_minutes is not null;
  if not found then
    raise exception using errcode = '22023', message = 'El servicio no está disponible en esa modalidad.';
  end if;
  d := (st at time zone s.timezone)::date;
  b := case when m = 'home' then s.travel_before_minutes else 0 end;
  a := case when m = 'home' then s.travel_after_minutes else 0 end;
  if st <= clock_timestamp() or st - b * interval '1 minute' < clock_timestamp()
    or d > (clock_timestamp() at time zone s.timezone)::date + s.horizon_days
    or not jc_private.fits_window(st, v.duration_minutes, m, b, a, s.break_minutes, s.slot_step_minutes) then
    raise exception using errcode = '22023', message = 'El turno completo debe estar en una franja habilitada, futura y dentro del horizonte.';
  end if;
  insert into jc_private.agenda(kind, starts_at, ends_at, occupied_start, occupied_end,
    service_id, service_name, mode, price, duration_minutes, break_minutes,
    travel_before_minutes, travel_after_minutes, customer_name, phone, address, notes)
  values ('booking', st, st + v.duration_minutes * interval '1 minute', st - b * interval '1 minute',
    st + (v.duration_minutes + a + s.break_minutes) * interval '1 minute',
    v.id, v.name, m, v.price, v.duration_minutes, s.break_minutes, b, a, n, ph, ad, nt)
  returning * into r;
  result := jc_private.booking_result(r);
  insert into jc_private.booking_requests(request_id, payload, booking_id, response) values (req, payload, r.id, result);
  return result;
end $$;

create function public.create_booking(p_data jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog
as $$ begin
  return jc_private.insert_booking(p_data);
exception
  when exclusion_violation then raise exception using errcode = '23P01', message = 'Ese horario ya no está disponible.';
  when unique_violation then raise exception using errcode = '23505', message = 'La clave de solicitud ya fue utilizada con otros datos.';
  when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range or check_violation or not_null_violation then
    raise exception using errcode = '22023', message = 'Revisá los datos de la reserva.';
end $$;

create function public.admin_snapshot(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog set timezone = 'UTC'
as $$ declare lo timestamptz; hi timestamptz; result jsonb; begin
  perform jc_private.require_admin();
  if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to)
    or p_to < p_from or p_to - p_from > 365 then
    raise exception using errcode = '22023', message = 'Elegí un rango de hasta 366 días inclusive.';
  end if;
  lo := p_from::timestamp at time zone 'America/Argentina/Buenos_Aires';
  hi := (p_to + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires';
  select jsonb_build_object(
    'settings', (select to_jsonb(s) - 'singleton' from jc_private.settings s where singleton),
    'services', coalesce((select jsonb_agg(to_jsonb(v) order by v.name, v.id) from jc_private.services v), '[]'::jsonb),
    'hours', coalesce((select jsonb_agg(to_jsonb(h) order by h.weekday, h.start_time, h.mode) from jc_private.hours h), '[]'::jsonb),
    'blocks', coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'starts_at',a.starts_at,
      'ends_at',a.ends_at,'reason',a.reason) order by a.starts_at, a.id)
      from jc_private.agenda a where a.kind = 'block' and a.occupied && tstzrange(lo,hi,'[)')), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'service_id',a.service_id,
      'service_name',a.service_name,'mode',a.mode,'starts_at',a.starts_at,'ends_at',a.ends_at,
      'occupied_start',a.occupied_start,'occupied_end',a.occupied_end,'price',a.price,
      'customer_name',a.customer_name,'phone',a.phone,'address',a.address,'notes',a.notes,'status',a.status)
      order by a.starts_at, a.id) from jc_private.agenda a
      where a.kind = 'booking' and a.occupied && tstzrange(lo,hi,'[)')), '[]'::jsonb)) into result;
  return result;
end $$;

create function public.admin_save_config(p_data jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog
as $$ declare s jsonb; item jsonb; sid uuid; hid uuid; v_modes text[]; field text; begin
  perform jc_private.lock_agenda();
  perform jc_private.require_admin();
  s := p_data->'settings';
  if jsonb_typeof(p_data) is distinct from 'object' or jsonb_typeof(s) is distinct from 'object'
    or jsonb_typeof(p_data->'services') is distinct from 'array'
    or jsonb_typeof(p_data->'hours') is distinct from 'array'
    or not (s ?& array['enabled','timezone','break_minutes','travel_before_minutes','travel_after_minutes','slot_step_minutes','horizon_days'])
    or jsonb_array_length(p_data->'services') > 100 or jsonb_array_length(p_data->'hours') > 200 then
    raise exception using errcode = '22023', message = 'Enviá la configuración completa de agenda, servicios y franjas.';
  end if;
  if jsonb_typeof(s->'enabled') is distinct from 'boolean' or jsonb_typeof(s->'timezone') is distinct from 'string'
    or jsonb_typeof(s->'slot_step_minutes') is distinct from 'number'
    or jsonb_typeof(s->'horizon_days') is distinct from 'number' then
    raise exception using errcode = '22023', message = 'Revisá los tipos de los valores de configuración.';
  end if;
  foreach field in array array['break_minutes','travel_before_minutes','travel_after_minutes'] loop
    if jsonb_typeof(s->field) not in ('number','null') then
      raise exception using errcode = '22023', message = 'Descanso y traslados deben ser minutos enteros o null.';
    end if;
  end loop;
  -- Set disabled temporarily inside the transaction, never visible to other sessions.
  update jc_private.settings set enabled = false, timezone = s->>'timezone',
    break_minutes = (s->>'break_minutes')::integer,
    travel_before_minutes = (s->>'travel_before_minutes')::integer,
    travel_after_minutes = (s->>'travel_after_minutes')::integer,
    slot_step_minutes = (s->>'slot_step_minutes')::integer,
    horizon_days = (s->>'horizon_days')::integer where singleton;
  if exists (select 1 from jsonb_array_elements(p_data->'services') x
    where x->>'id' is not null group by (x->>'id')::uuid having count(*) > 1) then
    raise exception using errcode = '22023', message = 'Hay servicios duplicados.';
  end if;
  update jc_private.services set active = false;
  for item in select value from jsonb_array_elements(p_data->'services') loop
    if jsonb_typeof(item) is distinct from 'object' or not (item ?& array['id','name','price','duration_minutes','modes','active'])
      or jsonb_typeof(item->'modes') is distinct from 'array'
      or jsonb_typeof(item->'name') is distinct from 'string'
      or jsonb_typeof(item->'active') is distinct from 'boolean'
      or jsonb_typeof(item->'price') not in ('number','null')
      or jsonb_typeof(item->'duration_minutes') not in ('number','null') then
      raise exception using errcode = '22023', message = 'Revisá los campos de cada servicio.';
    end if;
    sid := (item->>'id')::uuid;
    select array_agg(value) into v_modes from jsonb_array_elements_text(item->'modes');
    if sid is null then
      insert into jc_private.services(name,price,duration_minutes,modes,active)
      values (btrim(item->>'name'), (item->>'price')::numeric, (item->>'duration_minutes')::integer, v_modes, (item->>'active')::boolean);
    else
      update jc_private.services set name = btrim(item->>'name'), price = (item->>'price')::numeric,
        duration_minutes = (item->>'duration_minutes')::integer, modes = v_modes,
        active = (item->>'active')::boolean where id = sid;
      if not found then raise exception using errcode = '22023', message = 'El servicio indicado no existe.'; end if;
    end if;
  end loop;
  -- IDs supplied by the client must belong to the previous configuration.
  if exists (select 1 from jsonb_array_elements(p_data->'hours') x where x->>'id' is not null
    and not exists (select 1 from jc_private.hours h where h.id = (x->>'id')::uuid)) then
    raise exception using errcode = '22023', message = 'La franja indicada no existe.';
  end if;
  delete from jc_private.hours;
  for item in select value from jsonb_array_elements(p_data->'hours') loop
    if jsonb_typeof(item) is distinct from 'object'
      or not (item ?& array['weekday','mode','start_time','end_time','enabled'])
      or jsonb_typeof(item->'weekday') is distinct from 'number'
      or jsonb_typeof(item->'enabled') is distinct from 'boolean'
      or jsonb_typeof(item->'mode') is distinct from 'string'
      or jsonb_typeof(item->'start_time') is distinct from 'string'
      or jsonb_typeof(item->'end_time') is distinct from 'string'
      or (item->>'start_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$'
      or (item->>'end_time') !~ '^(([01][0-9]|2[0-3]):[0-5][0-9](:00)?|24:00(:00)?)$' then
      raise exception using errcode = '22023', message = 'Revisá los campos de cada franja.';
    end if;
    hid := coalesce((item->>'id')::uuid, gen_random_uuid());
    insert into jc_private.hours(id,weekday,mode,start_time,end_time,enabled)
    values (hid,(item->>'weekday')::integer,item->>'mode',(item->>'start_time')::time,
      (item->>'end_time')::time,(item->>'enabled')::boolean);
  end loop;
  if exists (select 1 from jc_private.hours a join jc_private.hours b
    on a.id < b.id and a.enabled and b.enabled and a.weekday = b.weekday and a.mode = b.mode
    and a.start_time < b.end_time and b.start_time < a.end_time) then
    raise exception using errcode = '22023', message = 'Las franjas habilitadas de una misma modalidad no pueden superponerse.';
  end if;
  if (s->>'enabled')::boolean and not jc_private.config_ready() then
    raise exception using errcode = '22023', message = 'Para activar completá servicios activos, días habilitados, descanso y traslados; domicilio requiere traslados mayores a cero.';
  end if;
  update jc_private.settings set enabled = (s->>'enabled')::boolean where singleton;
  -- Existing appointments retain all their snapshots, including their original occupied interval.
  return jsonb_build_object('success',true);
exception
  when unique_violation then raise exception using errcode = '23505', message = 'Hay identificadores o franjas duplicados.';
  when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range or check_violation or not_null_violation then
    raise exception using errcode = '22023', message = 'Revisá los valores de configuración.';
end $$;

create function public.admin_booking(p_data jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog set timezone = 'UTC'
as $$ declare r jc_private.agenda; s jc_private.settings; st timestamptz; ns text; b integer; a integer; br integer; begin
  perform jc_private.lock_agenda();
  perform jc_private.require_admin();
  if p_data->>'action' = 'create' then return jc_private.insert_booking(p_data); end if;
  if p_data->>'action' is distinct from 'update' then
    raise exception using errcode = '22023', message = 'Acción de reserva inválida.';
  end if;
  if p_data ?| array['service_id','price','duration_minutes','mode','customer_name','phone','address','notes'] then
    raise exception using errcode = '22023', message = 'La actualización sólo admite estado y horario; conserva el servicio y sus datos.';
  end if;
  select * into r from jc_private.agenda where id = (p_data->>'id')::uuid and kind = 'booking';
  if not found then raise exception using errcode = '22023', message = 'La reserva no existe.'; end if;
  ns := case when p_data ? 'status' then p_data->>'status' else r.status end;
  if ns is null or ns not in ('confirmed','completed','cancelled','no_show') then
    raise exception using errcode = '22023', message = 'Estado de reserva inválido.';
  end if;
  st := r.starts_at;
  if p_data ? 'starts_at' then
    if coalesce(p_data->>'starts_at','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$' then
      raise exception using errcode = '22023', message = 'La fecha debe incluir hora y zona horaria.';
    end if;
    st := (p_data->>'starts_at')::timestamptz;
  end if;
  if p_data ? 'starts_at' or (r.status = 'cancelled' and ns <> 'cancelled') then
    select * into strict s from jc_private.settings where singleton;
    if s.break_minutes is null or s.travel_before_minutes is null or s.travel_after_minutes is null
      or (r.mode = 'home' and (s.travel_before_minutes = 0 or s.travel_after_minutes = 0)) then
      raise exception using errcode = '55000', message = 'Completá descanso y traslados antes de reprogramar.';
    end if;
    b := greatest(r.travel_before_minutes, case when r.mode = 'home' then s.travel_before_minutes else 0 end);
    a := greatest(r.travel_after_minutes, case when r.mode = 'home' then s.travel_after_minutes else 0 end);
    br := greatest(r.break_minutes, s.break_minutes);
    if ns = 'cancelled' or not isfinite(st) or st <= clock_timestamp()
      or st - b * interval '1 minute' < clock_timestamp()
      or (st at time zone s.timezone)::date > (clock_timestamp() at time zone s.timezone)::date + s.horizon_days
      or not jc_private.fits_window(st, r.duration_minutes, r.mode, b, a, br, s.slot_step_minutes) then
      raise exception using errcode = '22023', message = 'No es posible reprogramar en esa franja; revisá estado, fecha y ocupación completa.';
    end if;
    -- GiST compares the updated row against OTHER rows, not its own previous interval.
    update jc_private.agenda set starts_at = st, ends_at = st + r.duration_minutes * interval '1 minute',
      occupied_start = st - b * interval '1 minute',
      occupied_end = st + (r.duration_minutes + a + br) * interval '1 minute',
      travel_before_minutes = b, travel_after_minutes = a, break_minutes = br,
      status = ns, updated_at = clock_timestamp() where id = r.id returning * into r;
  else
    update jc_private.agenda set status = ns, updated_at = clock_timestamp() where id = r.id returning * into r;
  end if;
  return jc_private.booking_result(r);
exception
  when exclusion_violation then raise exception using errcode = '23P01', message = 'Ese horario ya no está disponible.';
  when unique_violation then raise exception using errcode = '23505', message = 'La clave de solicitud ya fue utilizada con otros datos.';
  when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range or check_violation or not_null_violation then
    raise exception using errcode = '22023', message = 'Revisá los datos de la reserva.';
end $$;

create function public.admin_block(p_data jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog set timezone = 'UTC'
as $$ declare st timestamptz; en timestamptz; rid uuid; why text; begin
  perform jc_private.lock_agenda();
  perform jc_private.require_admin();
  if p_data->>'action' = 'delete' then
    delete from jc_private.agenda where id = (p_data->>'id')::uuid and kind = 'block' returning id into rid;
    if not found then raise exception using errcode = '22023', message = 'El bloqueo no existe.'; end if;
    return jsonb_build_object('success',true,'id',rid);
  end if;
  if p_data->>'action' is distinct from 'create' then
    raise exception using errcode = '22023', message = 'Acción de bloqueo inválida.';
  end if;
  if coalesce(p_data->>'starts_at','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$'
    or coalesce(p_data->>'ends_at','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$' then
    raise exception using errcode = '22023', message = 'Las fechas deben incluir hora y zona horaria.';
  end if;
  st := (p_data->>'starts_at')::timestamptz; en := (p_data->>'ends_at')::timestamptz;
  why := nullif(btrim(p_data->>'reason'),'');
  if st is null or en is null or not isfinite(st) or not isfinite(en) or st >= en or char_length(why) > 250 then
    raise exception using errcode = '22023', message = 'Revisá el intervalo y el motivo (hasta 250 caracteres).';
  end if;
  insert into jc_private.agenda(kind,starts_at,ends_at,occupied_start,occupied_end,reason)
  values ('block',st,en,st,en,why) returning id into rid;
  return jsonb_build_object('success',true,'id',rid);
exception
  when exclusion_violation then raise exception using errcode = '23P01', message = 'El bloqueo se superpone con una reserva u otro bloqueo.';
  when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or check_violation or not_null_violation then
    raise exception using errcode = '22023', message = 'Revisá los datos del bloqueo.';
end $$;

-- Default PostgreSQL function EXECUTE is PUBLIC; explicitly close every helper and RPC.
revoke all on all functions in schema jc_private from public, anon, authenticated;
revoke all on function public.public_catalog(), public.available_slots(uuid,text,date),
  public.create_booking(jsonb), public.admin_snapshot(date,date), public.admin_save_config(jsonb),
  public.admin_booking(jsonb), public.admin_block(jsonb) from public, anon, authenticated;
grant execute on function public.public_catalog(), public.available_slots(uuid,text,date),
  public.create_booking(jsonb) to anon, authenticated;
grant execute on function public.admin_snapshot(date,date), public.admin_save_config(jsonb),
  public.admin_booking(jsonb), public.admin_block(jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
