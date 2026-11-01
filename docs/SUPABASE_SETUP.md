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

The command loads `.env.local` using Next.js environment loading and the same normalizer exercised by catalog tests. An operational station has **unknown live availability**; operational status does not establish occupancy or access at departure time.

To make an administrator, set `app_metadata.role` to `admin` for that Supabase Auth user. Administrators can restore a reviewed report (`state: "visible"`) or remove it (`state: "removed"`) through `PATCH /api/price-reports/:id`.

## Price rules

- A visible community report is current through the UTC date 30 days after its observed date; SQL catalog, detail, and trip calculations use this same date boundary.
- The newest current community report is the only price used for catalog rankings.
- A report reaches `needs_review` after three flags from distinct users. It remains visible in report history, but is excluded from rankings.
- Apply `202611010001_serialize_report_flags.sql` after the earlier migrations. It locks each report before counting flags so concurrent submissions cannot miss that threshold; existing ownership policies and public report grants stay unchanged.
- Chargers without a current community report display **Price unknown** in ordinary discovery and are excluded from electricity-price-ranked results before pagination.
- Peer-hosted listing prices remain authoritative in local listing records.

## Price-report permission repair

Apply `202610280001_price_report_uniqueness.sql` after the preceding migrations. It replaces the duplicate-check trigger, which cannot read the private reporter column as an authenticated caller, with a unique constraint on charger, reporter, and observed date. Existing public-column grants and ownership policies stay enforced, and duplicates still return `23505` for the API's 409 response.

If older data already contains duplicate charger/reporter/date combinations, the constraint creation fails before removing the old trigger. Review those records before retrying; the migration does not delete or rewrite reports automatically. Verify locally with `npm run test:reports:db` before applying migrations to a shared environment.

## Catalog and corridor corrections

Apply `202610280002_corridor_segments.sql` and `202610280003_catalog_search.sql` in order before deploying the updated catalog API. They repair imported availability values, include chargers between sparse route vertices, and provide the `search_catalog` RPC so geographic and eligibility filters run before pagination. The API requires the new RPC.

Then apply `202610280004_utc_price_freshness.sql` so catalog price freshness uses UTC observation dates even when a database connection changes its session time zone.

Discovery starts nationwide. Set a U.S. location to apply a clearly labeled straight-line radius, use the separate text filter to narrow results, and load subsequent pages as needed. Local demo listings remain browser-only and appear separately; shared Peer listing persistence remains future work.

Import reconciliation and trip corridor reads page through all records in stable ID order. Trip pricing reads the current-price view in batches of 50 station IDs; a failed price read returns a service failure rather than an infeasible plan. Deactivated imported stations return not found from the public detail API.

Trip search evaluates at most 10,000 corridor records and 50 compatible candidates, 3,000 states, 10,000 transitions, and 2,000 queued states. Hitting a limit returns `search_bounds_reached` rather than claiming infeasibility. These bounds appear in the result assumptions. Import reconciliation continues through every page because it is an administrative task, outside the public trip request.

Trip mileage includes estimated out-and-back charging detours. Additional detour driving time assumes 55 mph; the map still shows the original road corridor. Location/no-route rejections use HTTP 422 with `invalid_location`; other routing failures use HTTP 503. The adapter recognizes the location codes documented in [Valhalla's error definitions](https://github.com/valhalla/valhalla/blob/master/src/exceptions.cc).

Charger detail returns 404 for missing or deactivated records and 503 for catalog failures. The UI distinguishes loading and not-found states from retryable failures. Successful price reports and flags reload the detail response so its displayed price uses the server's current-report selection.
