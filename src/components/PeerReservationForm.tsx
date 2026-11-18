"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/PageHeader";
import { useApp } from "@/lib/store";
import { reservationsRequest, type SavedReservation } from "@/lib/client/reservations";
import type { CatalogCharger } from "@/lib/catalog/types";

function nextHour() {
  const date = new Date(Date.now() + 60 * 60_000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function PeerReservationForm({ charger }: { charger: CatalogCharger }) {
  const { user } = useApp();
  const [startsAt, setStartsAt] = useState("");
  useEffect(() => setStartsAt(nextHour()), []);
  const [hours, setHours] = useState("2");
  const [energy, setEnergy] = useState(String(Math.min(10, Number(charger.power_kw ?? 5) * 2)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SavedReservation | null>(null);
  const price = charger.price_summary?.price_per_kwh;

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const start = new Date(startsAt);
      const end = new Date(start.getTime() + Number(hours) * 60 * 60_000);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) throw new Error("Choose a valid start time.");
      const { reservation } = await reservationsRequest("POST", { listingId: charger.id, startsAt: start.toISOString(), endsAt: end.toISOString(), requestedKwh: Number(energy) });
      setSaved(reservation);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not reserve this charger."); }
    finally { setBusy(false); }
  }

  return <section className="rounded-2xl border bg-card p-5" aria-labelledby="reservation-title">
    <h2 id="reservation-title" className="text-lg font-semibold">Reserve charger</h2>
    <p className="mt-1 text-sm text-muted-foreground">Reserve a time slot. Payment is not collected and charger access is not automated.</p>
    {!user && <p className="mt-3"><Link className="font-semibold text-primary" href="/auth">Sign in to reserve</Link></p>}
    {saved ? <div role="status" className="mt-4 space-y-2"><p className="font-semibold">Reservation confirmed</p><p>{new Date(saved.starts_at).toLocaleString()} · {Number(saved.requested_kwh)} kWh · ${Number(saved.estimated_total).toFixed(2)} estimated charging cost</p><p className="text-xs">Reference: {saved.id}</p><Link className="font-semibold text-primary" href="/dashboard">View my reservations →</Link></div> :
      <form onSubmit={submit} className="mt-4 space-y-3">
        <Field label="Reservation start" hint="Times use your device's local time zone."><Input aria-label="Reservation start" required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></Field>
        <Field label="Duration (hours)"><Input required type="number" min="0.25" max="24" step="0.25" value={hours} onChange={(event) => setHours(event.target.value)} /></Field>
        <Field label="Requested charging energy (kWh)" hint={`Charger power: ${charger.power_kw ?? "unknown"} kW. Confirm your vehicle supports ${charger.connector_types.join(", ")}.`}><Input aria-label="Requested charging energy (kWh)" required type="number" min="0.01" max="500" step="0.01" value={energy} onChange={(event) => setEnergy(event.target.value)} /></Field>
        <p className="text-sm">Estimated charging cost: {price == null ? "Unknown" : `$${(Number(energy) * price).toFixed(2)}`} · excludes travel. The server confirms the current listing price.</p>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <Button type="submit" disabled={!user || busy || price == null}>{busy ? "Reserving…" : "Reserve time slot"}</Button>
      </form>}
  </section>;
}
