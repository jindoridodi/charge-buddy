# Supabase and NREL setup

1. Create a free Supabase project, then copy its project URL and anon key to `.env.local` from `.env.example`.
2. In Supabase SQL Editor, run the migrations in [`supabase/migrations`](../supabase/migrations) in filename order.
3. Enable Email authentication in **Authentication → Providers → Email**. For local demonstrations, disable email confirmation if immediate sign-in is preferred.
4. Add the service-role key only to `.env.local`; never expose it in browser code.
5. Request a free NREL API key and set `NREL_API_KEY`.
6. Import the nationwide public catalog before a demonstration:

   ```powershell
   npm run import:nrel
   ```

The importer requests active (`status=E`) public US electric stations in pages, upserts on `nrel_station_id`, and keeps NREL `ev_pricing` as raw operator text. It does not parse that text or use it in rankings.

To make an administrator, set `app_metadata.role` to `admin` for that Supabase Auth user. Administrators can restore a reviewed report (`state: "visible"`) or remove it (`state: "removed"`) through `PATCH /api/price-reports/:id`.

## Price rules

- A visible community report is current for 30 days after its observed date.
- The newest current community report is the only price used for catalog rankings.
- A report reaches `needs_review` after three flags from distinct users. It remains visible in report history, but is excluded from rankings.
- Chargers without a current community report display **Price unknown** and sort after known prices.
- Peer-hosted listing prices remain authoritative in local listing records.
