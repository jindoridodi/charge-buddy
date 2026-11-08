"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Section, Field, NativeSelect } from "@/components/PageHeader";
import { CONNECTORS } from "@/lib/data";
import { listingsRequest, type PeerListing } from "@/lib/client/listings";

const blank: PeerListing = { id: "", name: "", address: "", area: "", connector: "J1772", power_kw: 7.2, price: 0.3, published: true };
export default function Page() {
  const router = useRouter();
  const [listing, setListing] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) { setLoading(false); return; }
    void listingsRequest("GET").then(({ listings }) => {
      const found = listings.find((item) => item.id === id);
      if (!found) throw new Error("Listing not found.");
      setListing(found);
    }).catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load listing."))
      .finally(() => setLoading(false));
  }, []);
  const update = (patch: Partial<PeerListing>) => setListing((current) => ({ ...current, ...patch }));
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await listingsRequest(listing.id ? "PATCH" : "POST", listing);
      toast.success("Listing saved."); router.push("/dashboard?host=1");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save listing."); }
    finally { setBusy(false); }
  }
  return <div><PageHeader title={listing.id ? "Edit listing" : "List Your Charger"} subtitle="Share your charger with other drivers." /><Section className="max-w-3xl">
    {loading ? <p>Loading listing…</p> : <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-6">
      <Field label="Listing name"><Input required maxLength={100} value={listing.name} onChange={(e) => update({ name: e.target.value })} /></Field>
      <Field label="Street address" hint="Your exact address is private and is never shown in the public catalog."><Input required maxLength={200} value={listing.address} onChange={(e) => update({ address: e.target.value })} /></Field>
      <Field label="City and state" hint="Enter a city and two-letter state, for example Boston, MA. This area is public."><Input required maxLength={100} value={listing.area} onChange={(e) => update({ area: e.target.value })} /></Field>
      <Field label="Connector"><NativeSelect value={listing.connector} onChange={(e) => update({ connector: e.target.value })}>{CONNECTORS.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field>
      <Field label="Power (kW)"><Input required type="number" min="0.01" max="1000" step="any" value={listing.power_kw} onChange={(e) => update({ power_kw: Number(e.target.value) })} /></Field>
      <Field label="Price ($/kWh)"><Input required type="number" min="0.01" max="9.99" step="0.01" value={listing.price} onChange={(e) => update({ price: Number(e.target.value) })} /></Field>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <Button disabled={busy}>{busy ? "Saving…" : "Save listing"}</Button>
    </form>}
  </Section></div>;
}
