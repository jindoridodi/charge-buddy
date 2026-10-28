create or replace function public.reject_duplicate_price_report()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1
    from public.community_price_reports
    where charger_id = new.charger_id
      and reporter_id = new.reporter_id
      and observed_at = new.observed_at
  ) then
    raise exception 'Only one price report per charger and observed date is allowed' using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger reject_duplicate_price_report
before insert on public.community_price_reports
for each row execute procedure public.reject_duplicate_price_report();

revoke select on public.community_price_reports from anon, authenticated;
grant select (id, charger_id, price_per_kwh, observed_at, note, state, created_at) on public.community_price_reports to anon, authenticated;
