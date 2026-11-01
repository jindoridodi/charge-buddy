-- Extend the NREL catalog so peer listings and planning metadata share one
-- source-aware representation. Existing NREL rows remain unchanged.
alter table public.chargers alter column nrel_station_id drop not null;
alter table public.chargers add column if not exists source text not null default 'nrel' check (source in ('nrel', 'peer'));
alter table public.chargers add column if not exists source_external_id text;
alter table public.chargers add column if not exists public_access boolean not null default true;
alter table public.chargers add column if not exists availability_status text not null default 'unknown' check (availability_status in ('available', 'unknown', 'unavailable'));
alter table public.chargers add column if not exists opening_hours_confidence text not null default 'unknown' check (opening_hours_confidence in ('verified', 'reported', 'unknown'));
alter table public.chargers add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.chargers add column if not exists updated_at timestamptz not null default now();
create unique index if not exists chargers_source_external_id_idx on public.chargers (source, source_external_id) where source_external_id is not null;

create table public.vehicle_models (
  id text primary key,
  name text not null,
  usable_battery_kwh numeric(6,2) not null check (usable_battery_kwh > 0),
  consumption_wh_per_mile numeric(7,2) not null check (consumption_wh_per_mile > 0),
  connector text not null,
  max_dc_kw numeric(7,2) not null check (max_dc_kw > 0),
  stop_overhead_minutes numeric(5,2) not null check (stop_overhead_minutes >= 0),
  precision text not null check (precision in ('curated', 'custom')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicle_charge_curve_points (
  vehicle_model_id text not null references public.vehicle_models(id) on delete cascade,
  soc_percent numeric(5,2) not null check (soc_percent >= 0 and soc_percent <= 100),
  power_kw numeric(7,2) not null check (power_kw > 0),
  primary key (vehicle_model_id, soc_percent)
);

alter table public.vehicle_models enable row level security;
alter table public.vehicle_charge_curve_points enable row level security;
create policy "vehicle catalog is publicly readable" on public.vehicle_models for select using (true);
create policy "vehicle curves are publicly readable" on public.vehicle_charge_curve_points for select using (true);
