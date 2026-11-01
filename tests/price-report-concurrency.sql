-- Hold both flag transactions open after their production triggers execute.
create extension if not exists dblink;
insert into auth.users(id) values
 ('00000000-0000-0000-0000-000000000003'),
 ('00000000-0000-0000-0000-000000000004'),
 ('00000000-0000-0000-0000-000000000005');
insert into public.chargers(id, nrel_station_id, name, address, latitude, longitude)
values ('00000000-0000-0000-0000-000000000040', 40, 'Concurrent flags', 'Test only', 37, -122);
insert into public.community_price_reports(id, charger_id, reporter_id, price_per_kwh, observed_at)
values ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000001', 0.35, current_date);
insert into public.price_report_flags(report_id, reporter_id, reason)
values ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000003', 'Test');

create function public.test_flag_barrier() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock_shared(28411);
  return new;
end;
$$;
create trigger zzz_test_flag_barrier after insert on public.price_report_flags
for each row execute function public.test_flag_barrier();
select pg_advisory_lock(28411);
select dblink_connect('flag_a', 'host=/tmp dbname=postgres user=postgres application_name=flag_a');
select dblink_connect('flag_b', 'host=/tmp dbname=postgres user=postgres application_name=flag_b');
select dblink_exec('flag_a', 'set statement_timeout = ''10s''; set role authenticated; set request.jwt.claim.sub = ''00000000-0000-0000-0000-000000000004''');
select dblink_exec('flag_b', 'set statement_timeout = ''10s''; set role authenticated; set request.jwt.claim.sub = ''00000000-0000-0000-0000-000000000005''');
select dblink_send_query('flag_a', 'insert into public.price_report_flags(report_id, reporter_id, reason) values (''00000000-0000-0000-0000-000000000041'', auth.uid(), ''Test A'') returning id');
select dblink_send_query('flag_b', 'insert into public.price_report_flags(report_id, reporter_id, reason) values (''00000000-0000-0000-0000-000000000041'', auth.uid(), ''Test B'') returning id');
do $$
declare deadline timestamptz := clock_timestamp() + interval '5 seconds';
begin
  loop
    perform pg_stat_clear_snapshot();
    exit when (select count(*) from pg_stat_activity where application_name in ('flag_a', 'flag_b') and wait_event_type = 'Lock') = 2;
    if clock_timestamp() > deadline then raise exception 'Concurrent flag transactions did not reach the barrier'; end if;
    perform pg_sleep(0.01);
  end loop;
end;
$$;
select pg_advisory_unlock(28411);
select * from dblink_get_result('flag_a') as result(id uuid);
select * from dblink_get_result('flag_b') as result(id uuid);
select dblink_disconnect('flag_a');
select dblink_disconnect('flag_b');
drop trigger zzz_test_flag_barrier on public.price_report_flags;
drop function public.test_flag_barrier();

set role anon;
do $$
begin
  if (select state from public.community_price_reports where id = '00000000-0000-0000-0000-000000000041') is distinct from 'needs_review' then
    raise exception 'Three concurrent flags left the report visible';
  end if;
  if (select community_price_per_kwh from public.catalog_charger_prices where id = '00000000-0000-0000-0000-000000000040') is not null then
    raise exception 'The flagged report still contributes to price ranking';
  end if;
end;
$$;
reset role;
\echo 'PASS concurrent flags trigger moderation and remove the report from ranking'
