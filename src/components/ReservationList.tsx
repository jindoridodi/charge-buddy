"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { reservationsRequest, type SavedReservation } from "@/lib/client/reservations";

export function ReservationList({ mode }: { mode: "driver" | "host" }) {
  const { user } = useApp();
  const [items, setItems] = useState<SavedReservation[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setItems([]); setError(""); setLoading(Boolean(user));
    if (!user) return;
    void reservationsRequest("GET").then(({ reservations }) => { if (!cancelled) setItems(reservations); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load reservations."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id, refresh]);
  useEffect(() => {
    const onFocus = () => setRefresh((value) => value + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  async function cancel(id: string) {
    setBusy(id); setError("");
    try {
      const { reservation } = await reservationsRequest("PATCH", { id });
      setItems((current) => current.map((item) => item.id === id ? reservation : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not cancel reservation."); }
    finally { setBusy(null); }
  }
  const visible = items.filter((item) => mode === "host" ? item.host_id === user?.id : item.driver_id === user?.id);
  return <section className="space-y-3" aria-label={mode === "host" ? "Host reservations" : "My reservations"}>
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{mode === "host" ? "Reservations for my chargers" : "My reservations"}</h2><Button variant="outline" size="sm" disabled={loading} onClick={() => setRefresh((value) => value + 1)}>Refresh reservations</Button></div>
    <p className="text-sm text-muted-foreground">Latest 100 reservations. Times are shown in your local time zone. Amounts are estimates; no payments are processed.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {loading && <p role="status">Loading reservations…</p>}
    {!user && <p><Link className="text-primary" href="/auth">Sign in</Link> to view your reservations.</p>}
    {!loading && user && !error && !visible.length && <p className="text-muted-foreground">No reservations yet.</p>}
    {visible.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4">
      <div><Link className="font-semibold text-primary" href={`/chargers/${encodeURIComponent(item.listing_id)}`}>{item.charger_name}</Link><p className="text-sm">{item.area} · {item.connector}</p><p className="text-sm">{new Date(item.starts_at).toLocaleString()} – {new Date(item.ends_at).toLocaleString()}</p><p className="text-sm">{Number(item.requested_kwh)} kWh · ${Number(item.estimated_total).toFixed(2)} estimated</p><p className="text-sm font-semibold">{item.status === "cancelled" ? "Cancelled" : Date.parse(item.ends_at) <= Date.now() ? "Time slot ended" : "Confirmed"}</p><p className="text-xs text-muted-foreground">Reference: {item.id}</p></div>
      {item.status === "confirmed" && Date.parse(item.starts_at) > Date.now() && <Button variant="outline" disabled={busy === item.id} onClick={() => void cancel(item.id)}>{busy === item.id ? "Cancelling…" : "Cancel reservation"}</Button>}
    </article>)}
  </section>;
}
