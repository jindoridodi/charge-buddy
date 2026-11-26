# Shared listings and reservations

Verified November 17, 2026 on the local `release-completion` branch. All GitHub branch/PR revisions were fetched; see [local integration inventory](LOCAL_GITHUB_INTEGRATION.md). The November 16 audit is a historical checkpoint, not the latest database status.

## Supported flow

1. Sign in and use **List Your Charger**. Enter the private street address, public city/state, connector, power and price.
2. Enter approximate map coordinates or choose **Use my location for this listing** while at the charger. This supports publishing without a configured geocoder. If leaving coordinates empty, a working `NOMINATIM_URL` is required.
3. Save. The API writes `peer_listings` using the verified Supabase session; a database trigger publishes a sanitized record in the shared charger catalog. Public coordinates are rounded to a tenth of a degree, and the public address is `Approximate location`.
4. A separate account can find it in **Find Chargers**. Search uses the shared catalog, not the host's local browser storage. Select the listing and choose a future reservation start, duration and requested energy.
5. **Reserve time slot** creates a confirmed reservation in `peer_reservations`. The reservation appears in the driver's and host's dashboards, including after a reload. Refresh reservations or focus the window to retrieve changes.
6. The driver or host can cancel before the start. Other accounts cannot read or cancel that reservation. A cancelled slot can be reserved again. Pausing a listing removes it from public discovery and prevents new reservations; existing reservations remain visible to their participants.

Reservations book time only. No payments, payouts, email notifications, host approvals, hardware control or charging guarantees are implemented. Reservation costs are snapshots of the current host electricity price times the requested kWh; driver travel estimates are not charged. Exact addresses remain private, including in reservation rows.

Hosts may enter their electricity rate to suggest a listing price. The suggestion is the larger of the rate plus the saved default host markup or the rate plus $0.05/kWh, rounded to cents. Entering a valid rate fills the listing price; the host may override it, and the app saves the price shown in the price field. An existing listing's price stays unchanged until the host edits it. Suggestions of $10/kWh or more exceed the supported listing price and require a valid manual price.

Existing browser-only demo listings are not automatically claimed by an authenticated account. Recreate/publish them once through the database-backed listing form.

## Database rules

`reserve_peer_listing` derives driver/host identities and prices in the database. It locks the listing row while checking publication and overlapping confirmed slots, so concurrent attempts cannot double-book a slot. Durations are 15 minutes to 24 hours, start times must be in the future, and requested energy must fit the charger's power times the duration. Owners cannot book their own chargers. Reservation table writes are restricted to the validated functions; row security permits reads only for the driver and host. Cancellation checks the verified participant and locks the reservation.

## Migration record

The connected database already contained the three Account tables and `replace_account_data` but lacked their `202611020001` migration-history entry. Column definitions, constraints, row-security policies and the function were inspected and matched the migration. That version was recorded as applied without recreating tables or deleting data.

The following missing migrations were first exercised with synthetic identities in a transaction that rolled back; no test identities or rehearsal tables remained. Then the CLI applied these migrations normally:

- `202611080001_account_revision.sql`
- `202611080002_validate_account_writes.sql`
- `202611080003_peer_listings.sql`
- `202611080004_quote_ranking.sql`
- `202611170001_peer_reservations.sql`

The project target came from `.env.local`; no credentials were committed. Existing account/catalog data was retained. New databases should use the normal full ordered migration history rather than replaying the history repair above.

## Verification

- Real Supabase Auth/API verification with three temporary confirmed accounts passed: persisted listing, cross-account discovery, private-address protection, owner-only editing, persisted favorites, account isolation, simultaneous booking conflict, server-side price, participant-only reservation visibility, cancellation, slot reuse and paused-listing rejection.
- All verification-only listings, reservations and Auth accounts were deleted in cleanup. No emails or payments were sent.
- Account and reservation SQL permission regressions passed in the rolled-back database rehearsal.
- The full unit suite passed all 86 cases across 19 discovered files. TypeScript and the webpack production build passed. The browser suite passed all 20 cases, including publication and reservation from separate signed-in browser contexts, both participant dashboards and cancellation. Smoke checks passed all 12 pages plus CSS/image requests. Browser API responses are synthetic; the separate live verification above uses real Supabase Auth and database records.
- Focused API regressions cover malformed input, forged ownership/price, oversized payloads, unauthenticated access, valid RPC inputs, conflicts, unavailable records and coordinate-based publication.

To repeat the real test against a project you are authorized to modify:

```sh
npm run verify:shared-listings
```

This command creates and deletes temporary test accounts/data in the configured project. It requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and server-only `SUPABASE_SERVICE_ROLE_KEY`. It does not mock the database or send email.

The current routing/geocoding URLs were placeholders during verification. Listing publication works with explicit approximate coordinates; live trip routing still requires deployed routing/geocoding services. Nationwide coverage and backup/restore are separate remaining release checks.
