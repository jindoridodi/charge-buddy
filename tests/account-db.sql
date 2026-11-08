insert into auth.users (id) values ('00000000-0000-0000-0000-000000000101'), ('00000000-0000-0000-0000-000000000102');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
do $$
begin
  if not public.save_account_data(0, array['first'], '[]', null, '{}', 15, 'mi', true, true, true, 40, 'light') then raise exception 'initial save failed'; end if;
  if public.save_account_data(0, array['stale'], '[]', null, '{}', 15, 'mi', true, true, true, 40, 'light') then raise exception 'stale save succeeded'; end if;
  if public.read_account_data()->'favorites' <> '["first"]'::jsonb then raise exception 'stale save changed data'; end if;
  begin
    insert into public.account_favorites (user_id, charger_id) values (auth.uid(), 'bypass');
    raise exception 'direct write bypassed revision check';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
do $$
begin
  if public.read_account_data()->'favorites' <> '[]'::jsonb then raise exception 'account data leaked'; end if;
  if not public.save_account_data(0, array['second'], '[]', null, '{}', 15, 'mi', true, true, true, 40, 'light') then raise exception 'second account save failed'; end if;
end $$;
