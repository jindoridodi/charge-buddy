insert into auth.users(id) values ('00000000-0000-0000-0000-000000000006');
insert into public.chargers(id, nrel_station_id, name, address, latitude, longitude)
values ('00000000-0000-0000-0000-000000000050', 50, 'Admin review', 'Test only', 37, -122);
insert into public.community_price_reports(id, charger_id, reporter_id, price_per_kwh, observed_at)
values ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000001', 0.35, current_date);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000006', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000006","app_metadata":{"role":"admin"}}', false);

-- Match the administrator API's UPDATE ... RETURNING public fields on another account's report.
update public.community_price_reports set state = 'removed'
where id = '00000000-0000-0000-0000-000000000051'
returning id, charger_id, price_per_kwh, observed_at, note, state, created_at;
do $$
begin
  if (select state from public.community_price_reports where id = '00000000-0000-0000-0000-000000000051') is distinct from 'removed' then
    raise exception 'Administrator could not remove another account''s report';
  end if;
  begin
    perform reporter_id from public.community_price_reports;
    raise exception 'Administrator could read private reporter identities';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claims', '{}', false);
do $$
begin
  if exists (select id from public.community_price_reports where id = '00000000-0000-0000-0000-000000000051') then
    raise exception 'Anonymous caller could read the removed report';
  end if;
  if (select community_price_per_kwh from public.catalog_charger_prices where id = '00000000-0000-0000-0000-000000000050') is not null then
    raise exception 'Removed report still contributes to public price ranking';
  end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","user_metadata":{"role":"admin"}}', false);
do $$
declare changed integer;
begin
  if exists (select id from public.community_price_reports where id = '00000000-0000-0000-0000-000000000051') then
    raise exception 'Ordinary caller or user_metadata admin could read another account''s removed report';
  end if;
  update public.community_price_reports set state = 'visible' where id = '00000000-0000-0000-0000-000000000051';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Ordinary caller could restore another account''s report'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","app_metadata":{}}', false);
do $$
declare changed integer;
begin
  if not exists (select id from public.community_price_reports where id = '00000000-0000-0000-0000-000000000051') then
    raise exception 'Reporter lost existing access to their own removed report';
  end if;
  update public.community_price_reports set state = 'visible' where id = '00000000-0000-0000-0000-000000000051';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Ordinary reporter could restore their own report'; end if;
  begin
    insert into public.community_price_reports(charger_id, reporter_id, price_per_kwh, observed_at, state)
    values ('00000000-0000-0000-0000-000000000050', auth.uid(), 0.40, current_date - 1, 'removed');
    raise exception 'Ordinary reporter could insert a moderation state';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000006', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000006","app_metadata":{"role":"admin"}}', false);
update public.community_price_reports set state = 'visible'
where id = '00000000-0000-0000-0000-000000000051'
returning id, charger_id, price_per_kwh, observed_at, note, state, created_at;
do $$
begin
  if (select state from public.community_price_reports where id = '00000000-0000-0000-0000-000000000051') is distinct from 'visible' then
    raise exception 'Administrator could not restore another account''s removed report';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","app_metadata":{}}', false);
do $$
declare changed integer;
begin
  update public.community_price_reports set state = 'removed' where id = '00000000-0000-0000-0000-000000000051';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Ordinary caller could remove a visible report'; end if;
end;
$$;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claims', '{}', false);
do $$
declare changed integer;
begin
  if (select community_price_per_kwh from public.catalog_charger_prices where id = '00000000-0000-0000-0000-000000000050') is distinct from 0.35 then
    raise exception 'Administrator restoration did not restore public price ranking';
  end if;
  update public.community_price_reports set state = 'removed' where id = '00000000-0000-0000-0000-000000000051';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Anonymous caller could moderate a visible report'; end if;
end;
$$;
reset role;
\echo 'PASS administrator removal/restoration, private identities, and ordinary-account restrictions'
