// Run with: node --import tsx --import ./scripts/test-setup.mjs scripts/verify-shared-listings.mjs
// Creates three temporary confirmed Auth accounts, exercises real API handlers against
// the configured Supabase project, then removes only the records it created.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { POST as createListing, GET as ownListings, PATCH as editListing } from "../src/app/api/listings/route.ts";
import { GET as catalog } from "../src/app/api/chargers/route.ts";
import { GET as detail } from "../src/app/api/chargers/[id]/route.ts";
import { POST as reserve, GET as reservations, PATCH as cancel } from "../src/app/api/reservations/route.ts";
import { GET as account, PATCH as saveAccount } from "../src/app/api/account/route.ts";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url && anon && service, "Configure Supabase before running the live verification.");
const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const prefix = `cb-verify-${randomUUID().slice(0, 8)}`;
const users = [], listingIds = [];
function req(path, method, token, body) {
  return new Request(`https://charge-buddy.test${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function body(response, expected) {
  const data = await response.json();
  assert.equal(response.status, expected, JSON.stringify(data));
  return data;
}
async function identity(label) {
  const email = `${prefix}-${label}@charge-buddy-test.invalid`, password = randomUUID() + "aB1!";
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(created.error, null, created.error?.message);
  users.push(created.data.user.id);
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await client.auth.signInWithPassword({ email, password });
  assert.equal(signed.error, null, signed.error?.message);
  return { id: created.data.user.id, token: signed.data.session.access_token };
}
try {
  const host = await identity("host"), driver = await identity("driver"), stranger = await identity("stranger");
  const listing = { name: `${prefix} verification-only charger`, address: "Private verification address", area: "Boston, MA", connector: "CCS", power_kw: 7.2, price: 0.4, published: true, approximateLocation: { lat: 42.4, lng: -71.1 } };
  const created = await body(await createListing(req("/api/listings", "POST", host.token, listing)), 201);
  const id = created.listing.id; listingIds.push(id);
  assert.equal((await admin.from("peer_listings").select("id").eq("id", id).single()).data.id, id);
  assert.equal((await body(await ownListings(req("/api/listings", "GET", driver.token)), 200)).listings.length, 0);
  const discovered = await body(await catalog(new NextRequest(`https://charge-buddy.test/api/chargers?q=${encodeURIComponent(prefix)}`)), 200);
  assert.ok(discovered.chargers.some((item) => item.id === id));
  assert.equal(JSON.stringify(discovered).includes(listing.address), false);
  const publicDetail = await body(await detail(req(`/api/chargers/${id}`, "GET"), { params: Promise.resolve({ id }) }), 200);
  assert.equal(publicDetail.charger.price_summary.status, "host");
  assert.equal(publicDetail.charger.address, "Approximate location");
  await body(await editListing(req("/api/listings", "PATCH", driver.token, { ...listing, id, published: false })), 404);
  console.log("PASS database persistence, cross-account discovery, private-address protection and listing ownership");

  const originalAccount = await body(await account(req("/api/account", "GET", driver.token)), 200);
  const settings = { connectors: ["CCS"], maxDistance: 15, units: "mi", notifyEmail: false, notifyPush: false, notifyBookings: false, defaultMargin: 40, theme: "light" };
  await body(await saveAccount(req("/api/account", "PATCH", driver.token, { revision: originalAccount.revision, favorites: [id], vehicles: [], defaultVehicleId: null, settings })), 200);
  assert.deepEqual((await body(await account(req("/api/account", "GET", driver.token)), 200)).favorites, [id]);
  assert.deepEqual((await body(await account(req("/api/account", "GET", stranger.token)), 200)).favorites, []);
  console.log("PASS persisted account favorites and account isolation");

  const slot = { listingId: id, startsAt: new Date(Date.now() + 3 * 86400_000).toISOString(), endsAt: new Date(Date.now() + 3 * 86400_000 + 7200_000).toISOString(), requestedKwh: 5 };
  const simultaneous = await Promise.all([reserve(req("/api/reservations", "POST", driver.token, slot)), reserve(req("/api/reservations", "POST", stranger.token, slot))]);
  assert.deepEqual(simultaneous.map((result) => result.status).sort(), [201, 409]);
  const index = simultaneous.findIndex((result) => result.status === 201);
  const booked = await body(simultaneous[index], 201);
  const winner = index === 0 ? driver : stranger, outsider = index === 0 ? stranger : driver;
  assert.equal(Number(booked.reservation.estimated_total), 2);
  const bookingId = booked.reservation.id;
  assert.ok((await body(await reservations(req("/api/reservations", "GET", winner.token)), 200)).reservations.some((item) => item.id === bookingId));
  assert.ok((await body(await reservations(req("/api/reservations", "GET", host.token)), 200)).reservations.some((item) => item.id === bookingId));
  assert.equal((await body(await reservations(req("/api/reservations", "GET", outsider.token)), 200)).reservations.length, 0);
  await body(await cancel(req("/api/reservations", "PATCH", outsider.token, { id: bookingId })), 404);
  await body(await cancel(req("/api/reservations", "PATCH", winner.token, { id: bookingId })), 200);
  await body(await reserve(req("/api/reservations", "POST", outsider.token, slot)), 201);
  await body(await editListing(req("/api/listings", "PATCH", host.token, { ...listing, id, published: false })), 200);
  await body(await detail(req(`/api/chargers/${id}`, "GET"), { params: Promise.resolve({ id }) }), 404);
  await body(await reserve(req("/api/reservations", "POST", winner.token, { ...slot, startsAt: new Date(Date.now() + 5 * 86400_000).toISOString(), endsAt: new Date(Date.now() + 5 * 86400_000 + 7200_000).toISOString() })), 404);
  console.log("PASS simultaneous booking protection, server pricing, participant visibility, cancellation, slot reuse and paused-listing rejection");
} finally {
  const failures = [];
  if (listingIds.length) {
    for (const table of ["peer_reservations", "peer_listings"]) {
      const result = await admin.from(table).delete().in(table === "peer_reservations" ? "listing_id" : "id", listingIds);
      if (result.error) failures.push(`${table}: ${result.error.message}`);
    }
  }
  for (const id of users) {
    const result = await admin.auth.admin.deleteUser(id);
    if (result.error) failures.push(`Test account ${id}: ${result.error.message}`);
  }
  assert.deepEqual(failures, [], "Live test cleanup failed; remove the recorded verification-only rows before proceeding.");
  console.log("PASS verification-only listings, reservations and Auth accounts removed");
}
