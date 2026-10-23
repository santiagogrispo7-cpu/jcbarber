-- Run as postgres on a fresh migration in a DISPOSABLE test project.
-- All synthetic fixtures and helpers are rolled back. No pgTAP dependency.
begin;
set local timezone = 'Pacific/Auckland'; -- RPC output/input must not depend on session TZ.

create function pg_temp.assert_true(ok boolean, label text) returns void
language plpgsql as $$ begin
  if ok is distinct from true then raise exception 'ASSERTION FAILED: %', label; end if;
end $$;

create function pg_temp.expect_error(statement text, expected text, label text) returns void
language plpgsql as $$ declare actual text; begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics actual = returned_sqlstate;
    if actual = expected then return; end if;
    raise exception 'ASSERTION FAILED: %, expected %, got % (%)', label, expected, actual, sqlerrm;
  end;
  raise exception 'ASSERTION FAILED: %, expected error %', label, expected;
end $$;

do $test$
declare
  admin_id uuid := gen_random_uuid(); outsider_id uuid := gen_random_uuid();
  d date := (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date + 2;
  sid uuid; snap jsonb; cfg jsonb; original_cfg jsonb; payload jsonb; saved jsonb;
  receipt jsonb; retry jsonb; home_receipt jsonb; block_result jsonb; other jsonb;
  t text; st text; old_count integer; original_start timestamptz; original_end timestamptz;
begin
  perform pg_temp.assert_true((select count(*) = 28 and bool_and(not enabled) from jc_private.hours), '28 disabled seed windows');
  perform pg_temp.assert_true((select count(*) = 7 from (select weekday from jc_private.hours group by weekday having count(*) = 4) x), 'four windows for each weekday');
  perform pg_temp.assert_true((select not enabled and break_minutes is null and travel_before_minutes is null
    and travel_after_minutes is null and slot_step_minutes = 15 and horizon_days = 90
    and timezone = 'America/Argentina/Buenos_Aires' from jc_private.settings), 'unknown config stays disabled');
  perform pg_temp.assert_true((select bool_and(price is null and duration_minutes is null and not active) from jc_private.services), 'no invented prices/durations');
  perform pg_temp.assert_true((select bool_and(relrowsecurity and relforcerowsecurity) from pg_class
    where relnamespace = 'jc_private'::regnamespace and relkind = 'r'), 'RLS forced on every private table');
  perform pg_temp.assert_true(not exists (select 1 from pg_policies where schemaname = 'jc_private'), 'default deny policies');
  perform pg_temp.assert_true(not exists (select 1 from pg_proc p where p.pronamespace = 'jc_private'::regnamespace
    and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))), 'no executable helper');
  insert into auth.users(id,email) values (admin_id,'sql-admin@example.invalid');
  insert into jc_private.authorized_admins(user_id) values (admin_id);
  select id into sid from jc_private.services limit 1;

  set local role anon;
  perform pg_temp.assert_true(public.public_catalog()->'services' = '[]'::jsonb
    and public.public_catalog()->'enabled' = 'false'::jsonb, 'anonymous disabled catalog');
  perform pg_temp.assert_true(not exists(select 1 from public.available_slots(sid,'local',d)), 'anonymous disabled slots');
  foreach t in array array['settings','services','hours','agenda','booking_requests','authorized_admins'] loop
    perform pg_temp.expect_error(format('select * from jc_private.%I',t),'42501','anon cannot read '||t);
    perform pg_temp.expect_error(format('delete from jc_private.%I',t),'42501','anon cannot write '||t);
  end loop;
  perform pg_temp.expect_error('select jc_private.is_admin()','42501','anon cannot invoke helpers');
  perform pg_temp.expect_error(format('select public.admin_snapshot(%L,%L)',d,d),'42501','anon admin denied');
  reset role;

  -- Deliberate grants in this rollback-only test prove RLS independently of ACLs.
  grant usage on schema jc_private to anon, authenticated;
  grant select, insert on all tables in schema jc_private to anon, authenticated;
  set local role anon;
  perform pg_temp.assert_true((select count(*) = 0 from jc_private.settings),'RLS denies even with SELECT grant');
  perform pg_temp.expect_error('insert into jc_private.hours(weekday,mode,start_time,end_time) values(0,''local'',''01:00'',''02:00'')',
    '42501','RLS denies INSERT even with grant');
  reset role;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  set local role authenticated;
  perform pg_temp.assert_true((select count(*) = 0 from jc_private.authorized_admins),'RLS denies direct admin membership read');
  reset role;
  revoke all on schema jc_private from anon, authenticated;
  revoke all on all tables in schema jc_private from anon, authenticated;

  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  set local role authenticated;
  perform pg_temp.expect_error(format('select public.admin_snapshot(%L,%L)',d,d),'42501','authenticated outsider snapshot denied');
  perform pg_temp.expect_error('select public.admin_save_config(''{}'')','42501','authenticated outsider config denied');
  perform pg_temp.expect_error('select public.admin_booking(''{"action":"create"}'')','42501','authenticated outsider booking denied');
  perform pg_temp.expect_error('select public.admin_block(''{"action":"create"}'')','42501','authenticated outsider block denied');
  foreach t in array array['settings','services','hours','agenda','booking_requests','authorized_admins'] loop
    perform pg_temp.expect_error(format('select * from jc_private.%I',t),'42501','authenticated cannot read '||t);
    perform pg_temp.expect_error(format('delete from jc_private.%I',t),'42501','authenticated cannot write '||t);
  end loop;
  reset role;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  set local role authenticated;
  snap := public.admin_snapshot(d,d);
  cfg := snap - 'blocks' - 'bookings'; original_cfg := cfg;
  perform pg_temp.expect_error('select * from jc_private.agenda','42501','admin also uses RPC only');
  perform pg_temp.expect_error(format('select public.admin_snapshot(%L,%L)',d,d+366),'22023','maximum 366 inclusive days');
  perform pg_temp.expect_error(format('select public.admin_save_config(%L)',jsonb_set(cfg,'{settings,enabled}','true')),'22023','activation incomplete rejected');
  perform pg_temp.assert_true(public.admin_snapshot(d,d)->'settings' = original_cfg->'settings','failed config rolled back');

  cfg := jsonb_set(cfg,'{settings,break_minutes}','15');
  cfg := jsonb_set(cfg,'{settings,travel_before_minutes}','15');
  cfg := jsonb_set(cfg,'{settings,travel_after_minutes}','15');
  cfg := jsonb_set(cfg,'{services,0,price}','1000');
  cfg := jsonb_set(cfg,'{services,0,duration_minutes}','30');
  cfg := jsonb_set(cfg,'{services,0,active}','true');
  cfg := jsonb_set(cfg,'{hours}',(select jsonb_agg(jsonb_set(value,'{enabled}','true')) from jsonb_array_elements(cfg->'hours')));
  perform public.admin_save_config(cfg);
  perform pg_temp.assert_true(exists(select 1 from public.available_slots(sid,'local',d)), 'admin preview while disabled');
  perform pg_temp.assert_true((select min(starts_at) = (d + time '07:15') at time zone 'America/Argentina/Buenos_Aires'
    from public.available_slots(sid,'home',d)), 'home starts after travel before');
  perform pg_temp.assert_true(not exists(select 1 from public.available_slots(sid,'home',d)
    where (starts_at at time zone 'America/Argentina/Buenos_Aires')::time = time '07:45'), 'home all buffers fit window');
  perform pg_temp.assert_true(not exists(select 1 from public.available_slots(sid,'local',d)
    where (starts_at at time zone 'America/Argentina/Buenos_Aires')::time = time '12:00'), 'local break fits window');
  reset role;
  perform set_config('request.jwt.claim.sub','',true);
  set local role anon;
  perform pg_temp.assert_true(not exists(select 1 from public.available_slots(sid,'local',d)), 'public cannot preview disabled configured agenda');
  reset role;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  set local role authenticated;
  cfg := jsonb_set(cfg,'{settings,enabled}','true');
  perform pg_temp.expect_error(format('select public.admin_save_config(%L)',jsonb_set(cfg,'{settings,travel_before_minutes}','0')),'22023','home travel must be positive');
  perform public.admin_save_config(cfg);
  reset role;
  perform set_config('request.jwt.claim.sub','',true);
  set local role anon;
  perform pg_temp.assert_true(jsonb_array_length(public.public_catalog()->'services') = 1,'enabled valid catalog');
  perform pg_temp.assert_true(not exists(select 1 from public.available_slots(sid,'local',d+100)), 'horizon filter');
  perform pg_temp.assert_true(not exists(select 1 from public.available_slots(sid,'local',d-3)), 'past filter');
  perform pg_temp.expect_error(format('select public.available_slots(%L,''wrong'',%L)',sid,d),'22023','mode validation');

  payload := jsonb_build_object('request_id',gen_random_uuid(),'service_id',sid,'mode','local',
    'starts_at',d::text||'T09:00:00-03:00','customer_name','Prueba Apellido','phone','+5493329600000',
    'address',null,'notes','SQL fixture');
  perform pg_temp.expect_error(format('select public.create_booking(%L)',jsonb_set(payload,'{customer_name}','"Solo"')),'22023','surname required');
  perform pg_temp.expect_error(format('select public.create_booking(%L)',jsonb_set(payload,'{phone}','"123"')),'22023','phone validation');
  perform pg_temp.expect_error(format('select public.create_booking(%L)',jsonb_set(payload,'{phone}','5493329600000')),'22023','phone must be JSON string');
  perform pg_temp.expect_error(format('select public.create_booking(%L)',jsonb_set(payload,'{notes}',to_jsonb(repeat('x',501)))),'22023','notes maximum');
  perform pg_temp.expect_error(format('select public.create_booking(%L)',jsonb_set(payload,'{starts_at}',to_jsonb(d::text||'T09:01:00-03:00'))),'22023','grid validation');
  perform pg_temp.expect_error(format('select public.create_booking(%L)',jsonb_set(payload,'{starts_at}',to_jsonb(d::text||'T09:00:00'))),'22023','offset required');
  receipt := public.create_booking(payload || '{"price":1,"duration_minutes":1}'::jsonb);
  perform pg_temp.assert_true((receipt->>'price')::numeric = 1000
    and (receipt->>'ends_at')::timestamptz - (receipt->>'starts_at')::timestamptz = interval '30 minutes','server price and duration');
  perform pg_temp.assert_true(not (receipt ?| array['customer_name','phone','address','notes','request_id']), 'receipt has no PII');
  retry := public.create_booking(payload);
  perform pg_temp.assert_true(receipt = retry,'identical retry returns immutable receipt');
  perform pg_temp.expect_error(format('select public.create_booking(%L)',jsonb_set(payload,'{phone}','"+5493329600001"')),'23505','request ID alone cannot retrieve receipt');
  perform pg_temp.expect_error(format('select public.create_booking(%L)',jsonb_set(payload,'{request_id}',to_jsonb(gen_random_uuid()))),'23P01','same-mode conflict');
  perform pg_temp.assert_true(not exists(select 1 from public.available_slots(sid,'local',d)
    where starts_at = (receipt->>'starts_at')::timestamptz),'occupied slot filtered');
  other := public.create_booking(jsonb_set(jsonb_set(payload,'{request_id}',to_jsonb(gen_random_uuid())),
    '{starts_at}',to_jsonb(d::text||'T09:45:00-03:00')));
  perform pg_temp.assert_true(other->>'id' <> receipt->>'id','half-open adjacent booking allowed');
  reset role;

  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  set local role authenticated;
  perform public.admin_booking(jsonb_build_object('action','update','id',receipt->>'id','status','completed'));
  perform pg_temp.expect_error(format('select public.create_booking(%L)',jsonb_set(payload,'{request_id}',to_jsonb(gen_random_uuid()))),'23P01','completed retains occupancy');
  perform public.admin_booking(jsonb_build_object('action','update','id',receipt->>'id','status','no_show'));
  perform pg_temp.expect_error(format('select public.create_booking(%L)',jsonb_set(payload,'{request_id}',to_jsonb(gen_random_uuid()))),'23P01','no_show retains occupancy');
  perform public.admin_booking(jsonb_build_object('action','update','id',receipt->>'id','status','confirmed',
    'starts_at',d::text||'T09:00:00-03:00'));
  perform pg_temp.assert_true(true,'reschedule to own interval succeeds');
  perform pg_temp.expect_error(format('select public.admin_booking(%L)',jsonb_build_object('action','update','id',receipt->>'id',
    'starts_at',d::text||'T09:30:00-03:00')),'23P01','reschedule cannot overlap other booking');
  perform public.admin_booking(jsonb_build_object('action','update','id',other->>'id','status','cancelled'));
  perform public.admin_booking(jsonb_build_object('action','update','id',receipt->>'id','starts_at',d::text||'T09:15:00-03:00'));
  perform pg_temp.assert_true((public.admin_snapshot(d,d)->'bookings'->0->>'starts_at')::timestamptz =
    (d + time '09:15') at time zone 'America/Argentina/Buenos_Aires','reschedule overlapping own old interval');
  perform public.admin_booking(jsonb_build_object('action','update','id',receipt->>'id','status','cancelled'));
  perform pg_temp.assert_true(exists(select 1 from public.available_slots(sid,'local',d)
    where starts_at = (d + time '09:00') at time zone 'America/Argentina/Buenos_Aires'),'cancel frees slot');
  block_result := public.admin_block(jsonb_build_object('action','create','starts_at',d::text||'T09:00:00-03:00',
    'ends_at',d::text||'T09:45:00-03:00','reason','SQL fixture'));
  perform pg_temp.expect_error(format('select public.create_booking(%L)',jsonb_set(payload,'{request_id}',to_jsonb(gen_random_uuid()))),'23P01','block prevents booking');
  perform pg_temp.assert_true(not exists(select 1 from public.available_slots(sid,'local',d)
    where starts_at = (d + time '09:00') at time zone 'America/Argentina/Buenos_Aires'),'block filters slots');
  perform public.admin_block(jsonb_build_object('action','delete','id',block_result->>'id'));
  perform public.admin_booking(jsonb_build_object('action','update','id',receipt->>'id','status','confirmed'));
  perform pg_temp.expect_error(format('select public.admin_block(%L)',jsonb_build_object('action','create',
    'starts_at',d::text||'T09:30:00-03:00','ends_at',d::text||'T09:45:00-03:00')),'23P01','booking prevents block');

  -- Deliberately overlapping mode schedules to verify a SINGLE resource, not one per mode.
  cfg := jsonb_set(cfg,'{hours}',(cfg->'hours') || jsonb_build_array(jsonb_build_object('id',null,
    'weekday',extract(dow from d)::integer,'mode','home','start_time','09:00','end_time','12:30','enabled',true)));
  perform public.admin_save_config(cfg);
  home_receipt := payload || jsonb_build_object('request_id',gen_random_uuid(),'mode','home','address','Calle Ficticia 123',
    'starts_at',d::text||'T09:30:00-03:00');
  perform pg_temp.expect_error(format('select public.create_booking(%L)',home_receipt),'23P01','cross-mode booking overlap');
  perform pg_temp.expect_error(format('select public.create_booking(%L)',jsonb_set(home_receipt,'{address}','"x"')),'22023','home address required');
  home_receipt := public.admin_booking(home_receipt || jsonb_build_object('action','create','starts_at',d::text||'T10:15:00-03:00'));
  perform pg_temp.expect_error(format('select public.admin_block(%L)',jsonb_build_object('action','create',
    'starts_at',d::text||'T10:00:00-03:00','ends_at',d::text||'T10:15:00-03:00')),'23P01','home before-travel prevents block');
  perform pg_temp.expect_error(format('select public.admin_block(%L)',jsonb_build_object('action','create',
    'starts_at',d::text||'T11:00:00-03:00','ends_at',d::text||'T11:15:00-03:00')),'23P01','home after-travel plus break prevents block');

  -- Saved configuration can change without moving or repricing existing bookings.
  snap := public.admin_snapshot(d,d);
  select value into saved from jsonb_array_elements(snap->'bookings') where value->>'id' = home_receipt->>'id';
  cfg := snap - 'bookings' - 'blocks';
  cfg := jsonb_set(cfg,'{services,0,price}','2000');
  cfg := jsonb_set(cfg,'{services,0,duration_minutes}','45');
  cfg := jsonb_set(cfg,'{settings,travel_before_minutes}','30');
  perform public.admin_save_config(cfg);
  select value into retry from jsonb_array_elements(public.admin_snapshot(d,d)->'bookings') where value->>'id' = home_receipt->>'id';
  perform pg_temp.assert_true(saved = retry,'configuration preserves all reservation snapshots');
  retry := public.admin_booking(jsonb_build_object('action','update','id',home_receipt->>'id','starts_at',d::text||'T10:30:00-03:00'));
  perform pg_temp.assert_true((retry->>'price')::numeric = 1000 and
    (retry->>'ends_at')::timestamptz - (retry->>'starts_at')::timestamptz = interval '30 minutes','reschedule retains price and duration');
  select value into retry from jsonb_array_elements(public.admin_snapshot(d,d)->'bookings') where value->>'id' = home_receipt->>'id';
  perform pg_temp.assert_true((retry->>'starts_at')::timestamptz - (retry->>'occupied_start')::timestamptz = interval '30 minutes','reschedule enlarges travel conservatively');
  cfg := jsonb_set(cfg,'{settings,travel_before_minutes}','5');
  perform public.admin_save_config(cfg);
  perform public.admin_booking(jsonb_build_object('action','update','id',home_receipt->>'id','starts_at',d::text||'T10:30:00-03:00'));
  select value into retry from jsonb_array_elements(public.admin_snapshot(d,d)->'bookings') where value->>'id' = home_receipt->>'id';
  perform pg_temp.assert_true((retry->>'starts_at')::timestamptz - (retry->>'occupied_start')::timestamptz = interval '30 minutes','reschedule never shrinks saved buffer');

  -- Atomic config rollback after partial writes to settings/services/hours.
  snap := public.admin_snapshot(d,d); cfg := snap - 'bookings' - 'blocks';
  perform pg_temp.expect_error(format('select public.admin_save_config(%L)',jsonb_set(cfg,'{hours,0,end_time}','"00:00"')),'22023','bad late config value rolls back');
  perform pg_temp.assert_true(public.admin_snapshot(d,d) = snap,'full config rollback');
  cfg := jsonb_set(cfg,'{services}',(cfg->'services') || jsonb_build_array(jsonb_build_object('id',null,
    'name','Servicio borrador','price',null,'duration_minutes',null,'modes',jsonb_build_array('local'),'active',false)));
  perform public.admin_save_config(cfg);
  perform pg_temp.assert_true(jsonb_array_length(public.admin_snapshot(d,d)->'services') = 2,'new service with null ID');
  cfg := public.admin_snapshot(d,d) - 'bookings' - 'blocks';
  cfg := jsonb_set(cfg,'{settings,enabled}','false');
  cfg := jsonb_set(cfg,'{settings,break_minutes}','null');
  cfg := jsonb_set(cfg,'{hours}',(select jsonb_agg(jsonb_set(value,'{enabled}','false')) from jsonb_array_elements(cfg->'hours')));
  perform public.admin_save_config(cfg);
  perform pg_temp.assert_true(jsonb_array_length(public.admin_snapshot(d,d)->'bookings') = 3,'disabling hours preserves future appointments');
  reset role;
  perform set_config('request.jwt.claim.sub','',true);
  set local role anon;
  perform pg_temp.assert_true(public.create_booking(payload) = receipt,'retry remains original receipt after reschedule/config disabled');
  perform pg_temp.expect_error(format('select public.create_booking(%L)',jsonb_set(payload,'{request_id}',to_jsonb(gen_random_uuid()))),'55000','new booking rejected when disabled');
  reset role;

  -- Range filtering must use Argentina dates and include blocks crossing midnight.
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  set local role authenticated;
  block_result := public.admin_block(jsonb_build_object('action','create','starts_at',(d-1)::text||'T23:30:00-03:00',
    'ends_at',d::text||'T00:30:00-03:00','reason','Midnight fixture'));
  perform pg_temp.assert_true(jsonb_array_length(public.admin_snapshot(d,d)->'blocks') = 1,'Argentina overlap includes prior-day start');
  perform pg_temp.assert_true(jsonb_array_length(public.admin_snapshot(d+1,d+1)->'blocks') = 0,'range excludes nonoverlap');
  perform pg_temp.assert_true(jsonb_array_length(public.admin_snapshot(d-1,d-1)->'blocks') = 1,'overlap visible on both days');
  reset role;
end
$test$;

rollback;

-- A pre-lock snapshot must never silently decide a write under REPEATABLE READ.
begin isolation level repeatable read;
do $$ begin
  begin
    perform public.create_booking('{}'::jsonb);
    raise exception 'ASSERTION FAILED: REPEATABLE READ should require retry';
  exception when serialization_failure then null;
  end;
end $$;
rollback;
