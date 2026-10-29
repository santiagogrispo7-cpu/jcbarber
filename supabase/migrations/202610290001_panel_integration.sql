-- Panel /admin integrado con el sitio público.
-- Agrega precios de membresías editables y rangos bloqueados de sólo lectura
-- para el navegador del cliente. No modifica reservas, servicios ni franjas.

begin;

create table if not exists jc_private.site_settings (
  singleton boolean primary key default true check (singleton),
  memberships jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default clock_timestamp(),
  constraint site_settings_memberships_array check (jsonb_typeof(memberships) = 'array')
);

insert into jc_private.site_settings(singleton, memberships)
values (
  true,
  '[
    {"id":"membresia-2","name":"Membresía 2 cortes","amount":30000},
    {"id":"membresia-3","name":"Membresía 3 cortes","amount":45000},
    {"id":"membresia-4","name":"Membresía 4 cortes","amount":50000}
  ]'::jsonb
)
on conflict (singleton) do nothing;

alter table jc_private.site_settings enable row level security;
alter table jc_private.site_settings force row level security;
revoke all on table jc_private.site_settings from public, anon, authenticated;

create function public.public_site_catalog() returns jsonb
language sql stable security definer set search_path = pg_catalog set timezone = 'UTC'
as $$
  select jsonb_build_object(
    'enabled', s.enabled,
    'timezone', s.timezone,
    'horizon_days', s.horizon_days,
    'updated_at', c.updated_at,
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id,
        'name', v.name,
        'price', v.price,
        'duration_minutes', v.duration_minutes,
        'modes', v.modes
      ) order by v.name, v.id)
      from jc_private.services v
      where v.active and v.price is not null and v.duration_minutes is not null
    ), '[]'::jsonb),
    'memberships', c.memberships
  )
  from jc_private.settings s
  cross join jc_private.site_settings c
  where s.singleton and c.singleton
$$;

create function public.public_blocked_ranges(p_from date, p_to date)
returns table(starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = pg_catalog set timezone = 'UTC'
as $$ declare lo timestamptz; hi timestamptz; begin
  if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to)
    or p_to < p_from or p_to - p_from > 365 then
    raise exception using errcode = '22023', message = 'Elegí un rango de hasta 366 días inclusive.';
  end if;
  lo := p_from::timestamp at time zone 'America/Argentina/Buenos_Aires';
  hi := (p_to + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires';
  return query
    select a.starts_at, a.ends_at
    from jc_private.agenda a
    where a.kind = 'block' and a.occupied && tstzrange(lo, hi, '[)')
    order by a.starts_at, a.id;
end $$;

create function public.admin_save_site_catalog(p_data jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog
as $$ declare item jsonb; begin
  perform jc_private.lock_agenda();
  perform jc_private.require_admin();
  if jsonb_typeof(p_data) is distinct from 'object'
    or jsonb_typeof(p_data->'memberships') is distinct from 'array'
    or jsonb_array_length(p_data->'memberships') > 20 then
    raise exception using errcode = '22023', message = 'Enviá la lista de membresías (hasta 20).';
  end if;
  for item in select value from jsonb_array_elements(p_data->'memberships') loop
    if jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'id') is distinct from 'string'
      or jsonb_typeof(item->'name') is distinct from 'string'
      or jsonb_typeof(item->'amount') is distinct from 'number'
      or (item->>'id') !~ '^[a-z0-9][a-z0-9-]{0,39}$'
      or char_length(btrim(item->>'name')) not between 1 and 80
      or (item->>'amount')::numeric < 0
      or (item->>'amount')::numeric > 10000000 then
      raise exception using errcode = '22023', message = 'Revisá el identificador, nombre y precio de cada membresía.';
    end if;
  end loop;
  if exists (
    select 1 from jsonb_array_elements(p_data->'memberships') x
    group by x->>'id' having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'Hay membresías duplicadas.';
  end if;
  update jc_private.site_settings
  set memberships = p_data->'memberships', updated_at = clock_timestamp()
  where singleton;
  return jsonb_build_object('success', true);
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'Hay membresías duplicadas.';
  when invalid_text_representation or numeric_value_out_of_range or check_violation then
    raise exception using errcode = '22023', message = 'Revisá los precios de las membresías.';
end $$;

revoke all on function public.public_site_catalog(),
  public.public_blocked_ranges(date, date),
  public.admin_save_site_catalog(jsonb) from public, anon, authenticated;

grant execute on function public.public_site_catalog(),
  public.public_blocked_ranges(date, date) to anon, authenticated;
grant execute on function public.admin_save_site_catalog(jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
