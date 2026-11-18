"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHeader, Section } from "@/components/PageHeader";
import { CatalogChargerCard } from "@/components/CatalogChargerCard";
import { ReservationList } from "@/components/ReservationList";
import type { CatalogCharger } from "@/lib/catalog/types";
import { useApp } from "@/lib/store";
import { listingsRequest, type PeerListing } from "@/lib/client/listings";

export default function Page() {
  const { user } = useApp();
  return <Dashboard key={user?.id ?? "anonymous"} />;
}

function Dashboard() {
  const app = useApp();
  const { role, set } = app;
  const [peerListings, setPeerListings] = useState<PeerListing[]>([]);
  const [listingError, setListingError] = useState("");
  const [listingRefresh, setListingRefresh] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<CatalogCharger[]>([]);
  useEffect(() => {
    let cancelled = false;
    setPeerListings([]); setListingError("");
    if (!app.user) return;
    void listingsRequest("GET").then(({ listings }) => { if (!cancelled) setPeerListings(listings); })
      .catch((error: unknown) => { if (!cancelled) setListingError(error instanceof Error ? error.message : "Could not load listings."); });
    return () => { cancelled = true; };
  }, [app.user?.id, listingRefresh]);
  useEffect(() => { if (new URLSearchParams(window.location.search).has("host")) set({ role: "host" }); }, [app.accountReady]);
  useEffect(() => {
    let cancelled = false;
    setFavorites([]);
    void Promise.all(app.favorites.map(async (id) => {
      try {
        const response = await fetch(`/api/chargers/${encodeURIComponent(id)}`);
        return response.ok ? (await response.json() as { charger: CatalogCharger }).charger : null;
      } catch { return null; }
    })).then((items) => { if (!cancelled) setFavorites(items.filter((item): item is CatalogCharger => item != null)); });
    return () => { cancelled = true; };
  }, [app.favorites, app.user?.id]);
  async function toggleListing(listing: PeerListing, published: boolean) {
    setBusy(listing.id); setListingError("");
    try {
      const { listing: saved } = await listingsRequest("PATCH", { ...listing, published });
      setPeerListings((items) => items.map((item) => item.id === saved.id ? saved : item));
    } catch (error) { setListingError(error instanceof Error ? error.message : "Could not update listing."); }
    finally { setBusy(null); }
  }

  return <div><PageHeader title={`Welcome back${app.user ? `, ${app.user.name.split(" ")[0]}` : ""}`} subtitle="Your saved listings, favorites and reservations.">
    <div className="flex rounded-full border bg-card p-1">{(["driver", "host"] as const).map((mode) => <Button key={mode} variant={role === mode ? "default" : "ghost"} onClick={() => set({ role: mode })} className="capitalize">{mode}</Button>)}</div>
  </PageHeader><Section className="space-y-8">
    <p className="rounded-xl border bg-muted/30 p-4 text-sm">Listings and reservations are saved to your account. Reservations book a time slot; payments, payouts and charger control are unavailable.</p>
    <ReservationList key={app.user?.id ?? "anonymous"} mode={role} />
    {role === "host" ? <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">My listings</h2><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setListingRefresh((value) => value + 1)}>Refresh listings</Button><Button asChild size="sm"><Link href="/list-charger">Add listing</Link></Button></div></div>
      {listingError && <p role="alert" className="text-destructive">{listingError}</p>}
      {!peerListings.length && !listingError && <p className="text-muted-foreground">No listings yet. Publish a charger to make it discoverable to other accounts.</p>}
      {peerListings.map((listing) => <article key={listing.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"><div><p className="font-semibold">{listing.name}</p><p className="text-sm text-muted-foreground">{listing.connector} · ${Number(listing.price).toFixed(2)}/kWh · {listing.area}</p></div><div className="flex flex-wrap items-center gap-3">{listing.published && <Button asChild size="sm" variant="outline"><Link href={`/chargers/${encodeURIComponent(listing.id)}`}>View listing</Link></Button>}<Button asChild size="sm" variant="outline"><Link href={`/list-charger?id=${encodeURIComponent(listing.id)}`}>Edit</Link></Button><label className="flex items-center gap-2 text-sm">{listing.published ? "Published" : "Paused"}<Switch aria-label={`Publish ${listing.name}`} disabled={busy === listing.id} checked={listing.published} onCheckedChange={(published) => void toggleListing(listing, published)} /></label></div></article>)}
    </section> : <section className="space-y-3"><h2 className="text-lg font-semibold">Favorites</h2>{favorites.map((charger) => <CatalogChargerCard key={charger.id} charger={charger} />)}{!favorites.length && <p className="text-muted-foreground">No available favorites yet. <Link className="text-primary" href="/chargers">Browse chargers →</Link></p>}</section>}
  </Section></div>;
}
