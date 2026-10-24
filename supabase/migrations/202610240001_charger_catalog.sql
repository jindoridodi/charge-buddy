create table public.chargers (
  id uuid primary key default gen_random_uuid(),
  nrel_station_id bigint not null unique,
  name text not null,
  address text not null,
  city text,
  state text,
  zip text,
  latitude double precision not null,
  longitude double precision not null,
  network text,
  connector_types text[] not null default '{}',
  power_kw numeric,
  operational_status text,
  operator_pricing text,
  source_updated_at timestamptz,
  imported_at timestamptz not null default now()
);

create table public.community_price_reports (
  id uuid primary key default gen_random_uuid(),
  charger_id uuid not null references public.chargers(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  price_per_kwh numeric(7,4) not null check (price_per_kwh > 0 and price_per_kwh < 10),
  observed_at date not null check (observed_at <= current_date),
  note text check (char_length(note) <= 500),
  state text not null default 'visible' check (state in ('visible', 'needs_review', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.price_report_flags (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.community_price_reports(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 280),
  created_at timestamptz not null default now(),
  unique (report_id, reporter_id)
);

create index chargers_location_idx on public.chargers (state, latitude, longitude);
create index community_price_reports_charger_idx on public.community_price_reports (charger_id, observed_at desc);

create or replace function public.review_report_after_flags()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(distinct reporter_id) from public.price_report_flags where report_id = new.report_id) >= 3 then
    update public.community_price_reports set state = 'needs_review', updated_at = now()
    where id = new.report_id and state = 'visible';
  end if;
  return new;
end;
$$;

create trigger price_report_flag_review
after insert on public.price_report_flags
for each row execute procedure public.review_report_after_flags();

alter table public.chargers enable row level security;
alter table public.community_price_reports enable row level security;
alter table public.price_report_flags enable row level security;

create policy "catalog is publicly readable" on public.chargers for select using (true);
create policy "visible report history is publicly readable" on public.community_price_reports for select using (state in ('visible', 'needs_review'));
create policy "users insert own reports" on public.community_price_reports for insert to authenticated with check (reporter_id = auth.uid() and state = 'visible');
create policy "users read their reports" on public.community_price_reports for select to authenticated using (reporter_id = auth.uid());
create policy "users create own flags" on public.price_report_flags for insert to authenticated with check (reporter_id = auth.uid());
create policy "users read own flags" on public.price_report_flags for select to authenticated using (reporter_id = auth.uid());
create policy "admins review reports" on public.community_price_reports for update to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
