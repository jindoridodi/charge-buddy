create or replace function public.review_report_after_flags()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Serialize counts without conflicting with flag inserts' foreign-key key-share locks.
  perform 1 from public.community_price_reports where id = new.report_id for no key update;
  if (select count(distinct reporter_id) from public.price_report_flags where report_id = new.report_id) >= 3 then
    update public.community_price_reports set state = 'needs_review', updated_at = now()
    where id = new.report_id and state = 'visible';
  end if;
  return new;
end;
$$;
