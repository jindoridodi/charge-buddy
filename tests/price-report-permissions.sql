insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');
insert into public.chargers (id, nrel_station_id, name, address, latitude, longitude)
values ('00000000-0000-0000-0000-000000000010', 1, 'Test charger', 'Test location', 37, -122);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);

-- Match the API's INSERT ... RETURNING public fields, including its session-derived reporter ID.
insert into public.community_price_reports (charger_id, reporter_id, price_per_kwh, observed_at)
values ('00000000-0000-0000-0000-000000000010', auth.uid(), 0.35, current_date)
returning id, charger_id, price_per_kwh, observed_at, note, state, created_at;

do $$
begin
  if (select count(id) from public.community_price_reports) <> 1 then
    raise exception 'The authenticated report was not saved';
  end if;
  begin
    insert into public.community_price_reports (charger_id, reporter_id, price_per_kwh, observed_at)
    values ('00000000-0000-0000-0000-000000000010', auth.uid(), 0.40, current_date);
    raise exception 'Duplicate report was accepted';
  exception when unique_violation then null;
  end;
  begin
    perform reporter_id from public.community_price_reports;
    raise exception 'Authenticated caller could read reporter identities';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.community_price_reports (charger_id, reporter_id, price_per_kwh, observed_at)
    values ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', 0.40, current_date);
    raise exception 'Caller could impersonate another account';
  exception when insufficient_privilege then null;
  end;
end;
$$;
\echo 'PASS authenticated insert, duplicate rejection (23505), private identities, and ownership enforcement'

insert into public.community_price_reports (charger_id, reporter_id, price_per_kwh, observed_at)
values ('00000000-0000-0000-0000-000000000010', auth.uid(), 0.36, current_date - 1);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
insert into public.community_price_reports (charger_id, reporter_id, price_per_kwh, observed_at)
values ('00000000-0000-0000-0000-000000000010', auth.uid(), 0.37, current_date);

set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
begin
  if (select count(id) from public.community_price_reports) <> 3 then
    raise exception 'Distinct accounts or observation dates were incorrectly blocked';
  end if;
  perform id, charger_id, price_per_kwh, observed_at, note, state, created_at
  from public.community_price_reports;
  begin
    perform reporter_id from public.community_price_reports;
    raise exception 'Anonymous caller could read reporter identities';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.community_price_reports (charger_id, reporter_id, price_per_kwh, observed_at)
    values ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 0.40, current_date - 2);
    raise exception 'Anonymous caller could submit a report';
  exception when insufficient_privilege then null;
  end;
end;
$$;
\echo 'PASS distinct accounts/dates, anonymous public reads, private identities, and rejected anonymous insert'
