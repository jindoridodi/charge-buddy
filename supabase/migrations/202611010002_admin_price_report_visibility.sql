create policy "admins read reports for moderation"
on public.community_price_reports for select to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
