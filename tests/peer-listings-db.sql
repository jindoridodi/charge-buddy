reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
insert into public.peer_listings (name, address, area, latitude, longitude, connector, power_kw, price)
values ('Peer test', '123 Secret Street', 'Boston, MA', 42.361, -71.057, 'J1772', 7.2, 0.4);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
do $$
begin
  if exists (select 1 from public.peer_listings where name = 'Peer test') then raise exception 'private listing leaked to another account'; end if;
  update public.peer_listings set name = 'Stolen' where name = 'Peer test';
  if found then raise exception 'another account modified the listing'; end if;
  if not exists (select 1 from public.search_catalog(null, null, 15, '{}', '{}', 10, 0, false) where name = 'Peer test' and address = 'Approximate location' and latitude = 42.4 and longitude = -71.1) then raise exception 'safe public projection missing'; end if;
  if exists (select 1 from public.chargers where address = '123 Secret Street') then raise exception 'private address leaked'; end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
update public.peer_listings set published = false where name = 'Peer test';
set role anon;
do $$
begin
  if exists (select 1 from public.chargers where name = 'Peer test') then raise exception 'paused listing visible directly'; end if;
  if exists (select 1 from public.search_catalog(null, null, 15, '{}', '{}', 10, 0, false) where name = 'Peer test') then raise exception 'paused listing discoverable'; end if;
end $$;
reset role;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
update public.peer_listings set published = true where name = 'Peer test';
set role anon;
do $$
begin
  if not exists (select 1 from public.search_catalog(null, null, 15, '{}', '{}', 0.5, 0, false) where name = 'Peer test' and city = 'Boston' and state = 'MA' and host_price_per_kwh = 0.4 and effective_price_per_kwh = 0.4) then raise exception 'peer locality or host price missing'; end if;
  if exists (select 1 from public.search_catalog(null, null, 15, '{}', '{}', 0.3, 0, false) where name = 'Peer test') then raise exception 'peer price filter ignored'; end if;
end $$;
reset role;

