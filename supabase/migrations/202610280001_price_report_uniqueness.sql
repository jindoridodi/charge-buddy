-- A unique constraint enforces duplicates without querying private columns as the submitting account.
alter table public.community_price_reports
  add constraint community_price_reports_charger_reporter_date_key
  unique (charger_id, reporter_id, observed_at);

drop trigger reject_duplicate_price_report on public.community_price_reports;
drop function public.reject_duplicate_price_report();
