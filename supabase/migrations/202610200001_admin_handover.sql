-- Run AFTER 202610190001 as postgres. No public registration or frontend grants.
begin;

create table jc_private.admin_handover (
  singleton boolean primary key default true check (singleton),
  source_id uuid not null references auth.users(id),
  target_id uuid not null references auth.users(id),
  prepared_at timestamptz not null default clock_timestamp(),
  confirmed_at timestamptz,
  completed_at timestamptz,
  check (source_id <> target_id)
);
alter table jc_private.admin_handover enable row level security;
alter table jc_private.admin_handover force row level security;
revoke all on jc_private.admin_handover from public, anon, authenticated;
create trigger serialize_write before insert or update or delete or truncate on jc_private.admin_handover
for each statement execute function jc_private.serialize_write();

-- Trusted operator only: both UUIDs must already exist in Supabase Auth.
create function jc_private.prepare_handover(p_source uuid, p_target uuid) returns void
language plpgsql security definer set search_path = pg_catalog
as $$ begin
  perform jc_private.lock_agenda();
  if p_source is null or p_target is null or p_source = p_target
    or not exists (select 1 from jc_private.authorized_admins where user_id = p_source)
    or not exists (select 1 from auth.users where id = p_target) then
    raise exception using errcode = '22023', message = 'Revisá los UUID del administrador actual y del destinatario creado en Auth.';
  end if;
  if exists (select 1 from jc_private.admin_handover where completed_at is null) then
    raise exception using errcode = '55000', message = 'Ya hay una transferencia pendiente. Completala antes de preparar otra.';
  end if;
  insert into jc_private.authorized_admins(user_id) values (p_target) on conflict do nothing;
  insert into jc_private.admin_handover(singleton, source_id, target_id)
  values (true, p_source, p_target)
  on conflict (singleton) do update set source_id = excluded.source_id,
    target_id = excluded.target_id, prepared_at = clock_timestamp(), confirmed_at = null, completed_at = null;
end $$;

-- Only the authenticated recipient can prove successful access, never the sender.
create function public.admin_confirm_handover(p_data jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$ begin
  perform jc_private.lock_agenda();
  perform jc_private.require_admin();
  update jc_private.admin_handover set confirmed_at = clock_timestamp()
    where singleton and target_id = auth.uid() and completed_at is null;
  if not found then
    raise exception using errcode = '42501', message = 'No sos el destinatario de una transferencia pendiente.';
  end if;
  return jsonb_build_object('success', true);
end $$;

-- Atomic cutover, serialized against ALL administrative writes.
create function jc_private.complete_handover(p_target uuid) returns void
language plpgsql security definer set search_path = pg_catalog
as $$ begin
  perform jc_private.lock_agenda();
  if not exists (select 1 from jc_private.admin_handover h
    join jc_private.authorized_admins a on a.user_id = h.target_id
    where h.singleton and h.target_id = p_target and h.completed_at is null
      and h.confirmed_at >= h.prepared_at
      and h.confirmed_at > clock_timestamp() - interval '24 hours') then
    raise exception using errcode = '55000', message = 'El destinatario debe ingresar y confirmar su acceso en las últimas 24 horas.';
  end if;
  delete from jc_private.authorized_admins where user_id <> p_target;
  update jc_private.admin_handover set completed_at = clock_timestamp() where singleton;
end $$;

revoke all on function jc_private.prepare_handover(uuid, uuid) from public, anon, authenticated;
revoke all on function jc_private.complete_handover(uuid) from public, anon, authenticated;
revoke all on function public.admin_confirm_handover(jsonb) from public, anon, authenticated;
grant execute on function public.admin_confirm_handover(jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
