reset role;
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000103') on conflict do nothing;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
insert into public.peer_listings(name,address,area,latitude,longitude,connector,power_kw,price)
values ('Reservation test','Private street','Boston, MA',42.4,-71.1,'CCS',7.2,0.4);
select set_config('test.listing_id', (select id::text from public.peer_listings where name='Reservation test'), false);
select set_config('test.starts', (now()+interval '2 days')::text, false);
select set_config('test.ends', (now()+interval '2 days 2 hours')::text, false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
select set_config('test.reservation_id', (public.reserve_peer_listing(current_setting('test.listing_id')::uuid,current_setting('test.starts')::timestamptz,current_setting('test.ends')::timestamptz,5)).id::text, false);
do $$ begin
  if not exists (select 1 from public.peer_reservations where id=current_setting('test.reservation_id')::uuid and estimated_total=2 and driver_id=auth.uid()) then raise exception 'reservation or server price missing'; end if;
  begin
    perform public.reserve_peer_listing(current_setting('test.listing_id')::uuid,current_setting('test.starts')::timestamptz,current_setting('test.ends')::timestamptz,5);
    raise exception 'double booking accepted';
  exception when exclusion_violation then null; end;
  begin
    perform public.reserve_peer_listing(current_setting('test.listing_id')::uuid,now()+interval '3 days',now()+interval '3 days 1 hour',100);
    raise exception 'impossible energy accepted';
  exception when check_violation then null; end;
  begin
    update public.peer_reservations set estimated_total=0;
    raise exception 'direct reservation write accepted';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', false);
do $$ begin
  if exists (select 1 from public.peer_reservations where listing_id=current_setting('test.listing_id')::uuid) then raise exception 'reservation leaked'; end if;
  begin
    perform public.cancel_peer_reservation(current_setting('test.reservation_id')::uuid);
    raise exception 'stranger cancelled reservation';
  exception when no_data_found then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
do $$ begin
  if not exists (select 1 from public.peer_reservations where id=current_setting('test.reservation_id')::uuid) then raise exception 'host cannot see booking'; end if;
  perform public.cancel_peer_reservation(current_setting('test.reservation_id')::uuid);
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', false);
select public.reserve_peer_listing(current_setting('test.listing_id')::uuid,current_setting('test.starts')::timestamptz,current_setting('test.ends')::timestamptz,5);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
update public.peer_listings set published=false where id=current_setting('test.listing_id')::uuid;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
do $$ begin
  begin
    perform public.reserve_peer_listing(current_setting('test.listing_id')::uuid,now()+interval '4 days',now()+interval '4 days 1 hour',5);
    raise exception 'paused listing booked';
  exception when no_data_found then null; end;
end $$;
reset role;
