-- Reservations are real time-slot bookings. Payments and charger control are separate.
create table public.peer_reservations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.peer_listings(id),
  driver_id uuid not null references auth.users(id) on delete cascade,
  host_id uuid not null references auth.users(id) on delete cascade,
  charger_name text not null,
  area text not null,
  connector text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  requested_kwh numeric not null check (requested_kwh > 0 and requested_kwh <= 500),
  price_per_kwh numeric not null check (price_per_kwh > 0 and price_per_kwh < 10),
  estimated_total numeric not null check (estimated_total >= 0 and estimated_total < 5000),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  check (driver_id <> host_id),
  check (isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at
    and ends_at - starts_at between interval '15 minutes' and interval '24 hours')
);
create index peer_reservations_slot_idx on public.peer_reservations(listing_id, starts_at, ends_at) where status = 'confirmed';
create index peer_reservations_driver_idx on public.peer_reservations(driver_id, created_at desc);
create index peer_reservations_host_idx on public.peer_reservations(host_id, created_at desc);
alter table public.peer_reservations enable row level security;
revoke all on public.peer_reservations from public, anon, authenticated;
grant select on public.peer_reservations to authenticated;
create policy "participants read their reservations" on public.peer_reservations
  for select to authenticated using (auth.uid() = driver_id or auth.uid() = host_id);

create function public.reserve_peer_listing(p_listing_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_requested_kwh numeric)
returns public.peer_reservations language plpgsql security definer set search_path = public, pg_temp as $$
declare account_id uuid := auth.uid(); listing public.peer_listings; booked public.peer_reservations;
begin
  if account_id is null then raise exception 'Sign in to reserve a charger' using errcode = '42501'; end if;
  if p_starts_at is null or p_ends_at is null or not isfinite(p_starts_at) or not isfinite(p_ends_at)
    or p_starts_at <= now() or p_ends_at - p_starts_at not between interval '15 minutes' and interval '24 hours'
    or p_requested_kwh is null or p_requested_kwh not between 0.01 and 500 then
    raise exception 'Choose a future slot of 15 minutes to 24 hours and valid energy' using errcode = '23514';
  end if;
  -- Serialize bookings with publication changes and other bookings for this listing.
  select * into listing from public.peer_listings where id = p_listing_id for update;
  if not found or not listing.published then raise exception 'Listing is unavailable' using errcode = 'P0002'; end if;
  if listing.owner_id = account_id then raise exception 'You cannot reserve your own listing' using errcode = '23514'; end if;
  if p_requested_kwh > listing.power_kw * extract(epoch from (p_ends_at - p_starts_at)) / 3600 then
    raise exception 'Requested energy exceeds the charger power for this time slot' using errcode = '23514';
  end if;
  if exists (select 1 from public.peer_reservations where listing_id = listing.id and status = 'confirmed'
    and starts_at < p_ends_at and ends_at > p_starts_at) then
    raise exception 'This time slot is already reserved. Choose another time.' using errcode = '23P01';
  end if;
  insert into public.peer_reservations(listing_id, driver_id, host_id, charger_name, area, connector,
    starts_at, ends_at, requested_kwh, price_per_kwh, estimated_total)
  values (listing.id, account_id, listing.owner_id, listing.name, listing.area, listing.connector,
    p_starts_at, p_ends_at, p_requested_kwh, listing.price, round(p_requested_kwh * listing.price, 2))
  returning * into booked;
  return booked;
end;
$$;

create function public.cancel_peer_reservation(p_reservation_id uuid)
returns public.peer_reservations language plpgsql security definer set search_path = public, pg_temp as $$
declare account_id uuid := auth.uid(); booked public.peer_reservations;
begin
  if account_id is null then raise exception 'Sign in to manage reservations' using errcode = '42501'; end if;
  select * into booked from public.peer_reservations
    where id = p_reservation_id and (driver_id = account_id or host_id = account_id) for update;
  if not found then raise exception 'Reservation not found' using errcode = 'P0002'; end if;
  if booked.status = 'cancelled' then return booked; end if;
  if booked.starts_at <= now() then raise exception 'A started reservation cannot be cancelled' using errcode = '23514'; end if;
  update public.peer_reservations set status = 'cancelled' where id = booked.id returning * into booked;
  return booked;
end;
$$;
revoke all on function public.reserve_peer_listing(uuid, timestamptz, timestamptz, numeric) from public, anon;
revoke all on function public.cancel_peer_reservation(uuid) from public, anon;
grant execute on function public.reserve_peer_listing(uuid, timestamptz, timestamptz, numeric) to authenticated;
grant execute on function public.cancel_peer_reservation(uuid) to authenticated;
