"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { useEffect, useState } from "react";
import { Heart, MapPin, Star, Zap, Clock, Car, GitCompare, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Section, Field, NativeSelect } from "@/components/PageHeader";
import { StatusBadge } from "@/components/ChargerCard";
import { estimateCost, money } from "@/lib/data";
import { useApp } from "@/lib/store";
import type { CatalogCharger, CommunityPriceReport } from "@/lib/catalog/types";
import { getBrowserSupabase } from "@/lib/supabase/client";

export default function ChargerDetail() {
  const { id } = useParams<{ id: string }>();
  const app = useApp();
  const c = app.getCharger(id);
  const [publicCharger, setPublicCharger] = useState<CatalogCharger | null>(null);
  const [reports, setReports] = useState<CommunityPriceReport[]>([]);
  const [reportPrice, setReportPrice] = useState("");
  const [reportNote, setReportNote] = useState("");
  const [observedAt, setObservedAt] = useState(new Date().toISOString().slice(0, 10));
  useEffect(() => {
    if (c) return;
    fetch(`/api/chargers/${id}`).then(async (response) => { const body = await response.json(); if (response.ok) { setPublicCharger(body.charger); setReports(body.reports ?? []); } }).catch(() => undefined);
  }, [c, id]);
  const [photo, setPhoto] = useState(0);
  const [date, setDate] = useState("2026-10-20");
  const [start, setStart] = useState("10:00");
  const [hrs, setHrs] = useState(3);
  const [kwh, setKwh] = useState(30);
  const [vehicleId, setVehicleId] = useState(app.defaultVehicleId);
  const [payment, setPayment] = useState("Visa •••• 4242");
  const [confirmed, setConfirmed] = useState<string | null>(null);

  const submitReport = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const session = await getBrowserSupabase().auth.getSession();
      const response = await fetch(`/api/chargers/${id}/price-reports`, { method: "POST", headers: { "Content-Type": "application/json", ...(session.data.session ? { Authorization: `Bearer ${session.data.session.access_token}` } : {}) }, body: JSON.stringify({ pricePerKwh: Number(reportPrice), observedAt, note: reportNote }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setReports((old) => [body.report, ...old]); setReportPrice(""); setReportNote(""); toast.success("Price report is visible now and will affect rankings.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not submit report"); }
  };
  const flag = async (reportId: string) => {
    try {
      const session = await getBrowserSupabase().auth.getSession();
      const response = await fetch(`/api/price-reports/${reportId}/flags`, { method: "POST", headers: { "Content-Type": "application/json", ...(session.data.session ? { Authorization: `Bearer ${session.data.session.access_token}` } : {}) }, body: JSON.stringify({ reason: "Price appears inaccurate" }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error); toast.success("Report flagged for review.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not flag report"); }
  };
  if (!c && publicCharger) return <Section><Link href="/chargers" className="text-sm text-muted-foreground hover:text-foreground">← All chargers</Link><div className="mt-4 grid gap-8 lg:grid-cols-[1fr_360px]"><div className="space-y-6"><div><h1 className="text-3xl font-bold">{publicCharger.name}</h1><p className="mt-2 text-muted-foreground">{publicCharger.address}, {[publicCharger.city, publicCharger.state, publicCharger.zip].filter(Boolean).join(", ")}</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Network", publicCharger.network || "Unknown"], ["Connectors", publicCharger.connector_types.join(", ") || "Unknown"], ["Status", publicCharger.operational_status || "Unknown"], ["Price", publicCharger.price_summary?.price_per_kwh != null ? `$${publicCharger.price_summary.price_per_kwh.toFixed(2)}/kWh` : "Price unknown"]].map(([k, v]) => <div key={k} className="rounded-xl border bg-card p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="font-semibold">{v}</p></div>)}</div><div className="rounded-xl border bg-card p-4"><h2 className="font-semibold">Operator-reported price</h2><p className="mt-1 text-muted-foreground">{publicCharger.operator_pricing || "No operator price provided by NREL."}</p><p className="mt-2 text-xs text-muted-foreground">NREL source updated: {publicCharger.source_updated_at ? new Date(publicCharger.source_updated_at).toLocaleDateString() : "unknown"}; imported {new Date(publicCharger.imported_at).toLocaleDateString()}.</p></div><div><h2 className="mb-3 text-lg font-semibold">Community report history</h2><div className="space-y-2">{reports.map((r) => <div key={r.id} className="rounded-xl border p-3"><div className="flex justify-between gap-2"><span className="font-semibold">${Number(r.price_per_kwh).toFixed(2)}/kWh · {r.observed_at}</span>{r.state === "needs_review" ? <span className="text-xs text-warning">Under review</span> : <Button size="sm" variant="ghost" onClick={() => flag(r.id)}>Flag</Button>}</div>{r.note && <p className="mt-1 text-sm text-muted-foreground">{r.note}</p>}</div>)}{!reports.length && <p className="text-sm text-muted-foreground">No community price reports yet.</p>}</div></div></div><aside className="h-fit rounded-2xl border bg-card p-5"><h2 className="text-lg font-semibold">Report price</h2><p className="mt-1 text-sm text-muted-foreground">USD per kWh only. Reports are visible immediately.</p><form onSubmit={submitReport} className="mt-4 space-y-3"><Field label="Price (USD/kWh)"><Input required min="0.01" max="9.99" step="0.001" type="number" value={reportPrice} onChange={(e) => setReportPrice(e.target.value)} /></Field><Field label="Observed date"><Input required type="date" value={observedAt} onChange={(e) => setObservedAt(e.target.value)} /></Field><Field label="Note (optional)"><Input maxLength={500} value={reportNote} onChange={(e) => setReportNote(e.target.value)} /></Field><Button className="w-full">Submit report</Button></form></aside></div></Section>;
  if (!c) {
    return (
      <Section>
        <p className="text-muted-foreground">Charger not found.</p>
        <Link href="/chargers" className="font-semibold text-primary">Back to chargers →</Link>
      </Section>
    );
  }
  const vehicle = app.vehicles.find((v) => v.id === vehicleId) ?? app.defaultVehicle;
  const cost = estimateCost(c, kwh, vehicle?.efficiency ?? 3.5);
  const fav = app.favorites.includes(c.id);
  const comparing = app.compare.includes(c.id);

  const book = () => {
    const resId = `CB-${Math.floor(10000 + Math.random() * 89999)}`;
    app.set((s) => ({
      reservations: [{ id: resId, chargerId: c.id, date, start, durationHrs: hrs, kwh, vehicleId: vehicle?.id ?? "v1", total: Math.round(cost.total * 100) / 100, status: "Upcoming", payment }, ...s.reservations],
    }));
    setConfirmed(resId);
  };

  return (
    <Section>
      <Link href="/chargers" className="text-sm text-muted-foreground hover:text-foreground">← All chargers</Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div>
            <img src={c.photos[photo]} alt={c.name} className="aspect-[16/9] w-full rounded-2xl object-cover" />
            <div className="mt-2 flex gap-2">
              {c.photos.map((p, i) => (
                <button key={i} onClick={() => setPhoto(i)} className={`h-16 w-24 overflow-hidden rounded-lg border-2 ${i === photo ? "border-primary" : "border-transparent"}`}>
                  <img src={p} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold">{c.name}</h1>
              <p className="mt-1 flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" />{c.address} · {cost.distance.toFixed(1)} mi away</p>
              <p className="mt-1 flex items-center gap-2 text-sm"><Star className="h-4 w-4 fill-warning text-warning" />{c.rating} ({c.reviewCount} reviews) <StatusBadge status={c.status} /></p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => app.toggleFavorite(c.id)}><Heart className={`h-4 w-4 ${fav ? "fill-destructive text-destructive" : ""}`} />{fav ? "Saved" : "Save"}</Button>
              <Button variant="outline" onClick={() => app.toggleCompare(c.id)}><GitCompare className="h-4 w-4" />{comparing ? "Comparing" : "Compare"}</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Connector", c.connector], ["Level", c.level], ["Power", `${c.powerKw} kW`], ["Price", `${money(c.pricePerKwh)}/kWh`]].map(([k, v]) => (
              <div key={k} className="rounded-xl border bg-card p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="font-semibold">{v}</p></div>
            ))}
          </div>
          <div><h2 className="mb-2 text-lg font-semibold">About this charger</h2><p className="text-muted-foreground">{c.description}</p></div>
          <div><h2 className="mb-2 flex items-center gap-2 text-lg font-semibold"><Clock className="h-5 w-5" />Hours</h2><p className="text-muted-foreground">{c.hours.start} – {c.hours.end} · {c.hours.days.join(", ")}</p></div>
          <div><h2 className="mb-2 flex items-center gap-2 text-lg font-semibold"><Car className="h-5 w-5" />Parking instructions</h2><p className="text-muted-foreground">{c.parking}</p></div>
          <div className="rounded-xl border bg-card p-4"><p className="font-semibold">Hosted by {c.host}</p><p className="text-sm text-muted-foreground">Host since {c.hostSince}</p></div>
          <div>
            <h2 className="mb-3 text-lg font-semibold">Reviews</h2>
            <div className="space-y-3">
              {c.reviews.map((r, i) => (
                <div key={i} className="rounded-xl border bg-card p-4">
                  <div className="flex justify-between text-sm"><span className="font-semibold">{r.author}</span><span className="text-muted-foreground">{r.date}</span></div>
                  <p className="text-sm text-warning">{"★".repeat(r.rating)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{r.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="h-fit space-y-4 rounded-2xl border bg-card p-5 shadow-sm lg:sticky lg:top-20">
          <p className="text-2xl font-bold">{money(c.pricePerKwh)}<span className="text-sm font-normal text-muted-foreground">/kWh</span></p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Start"><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          </div>
          <Field label={`Duration: ${hrs} hr`}><Slider min={1} max={8} step={1} value={[hrs]} onValueChange={([v]) => setHrs(v ?? 1)} /></Field>
          <Field label={`Energy: ${kwh} kWh`}><Slider min={5} max={80} step={5} value={[kwh]} onValueChange={([v]) => setKwh(v ?? 30)} /></Field>
          <Field label="Vehicle">
            <NativeSelect value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              {app.vehicles.map((v) => <option key={v.id} value={v.id}>{v.nickname} ({v.make} {v.model})</option>)}
            </NativeSelect>
          </Field>
          {vehicle && vehicle.connector !== c.connector && <p className="rounded-md bg-warning/15 p-2 text-xs">Heads up: your vehicle uses {vehicle.connector}; this charger is {c.connector}. An adapter may be needed.</p>}
          <Field label="Payment">
            <NativeSelect value={payment} onChange={(e) => setPayment(e.target.value)}>
              <option>Visa •••• 4242</option><option>Apple Pay</option><option>Google Pay</option>
            </NativeSelect>
          </Field>
          <div className="space-y-1 border-t pt-3 text-sm">
            <Row k={`Electricity (${kwh} kWh)`} v={money(cost.electricity)} />
            <Row k="Host fee" v={money(cost.hostFee)} />
            <Row k={`Travel (${(cost.distance * 2).toFixed(1)} mi round trip)`} v={money(cost.travel)} />
            <div className="flex justify-between pt-2 text-base font-bold"><span>Estimated total</span><span>{money(cost.total)}</span></div>
          </div>
          <Button className="w-full" size="lg" disabled={c.status === "Offline"} onClick={book}><Zap className="h-4 w-4" />{c.status === "Offline" ? "Currently offline" : "Reserve charger"}</Button>
          <p className="text-center text-xs text-muted-foreground">Demo only — no payment is charged.</p>
        </aside>
      </div>

      <Dialog open={!!confirmed} onOpenChange={(o) => !o && setConfirmed(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-success" />Reservation confirmed</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Booking <b>{confirmed}</b> at {c.name} on {date} at {start}. Estimated total {money(cost.total)}.</p>
          <div className="flex gap-2">
            <Button asChild><Link href="/dashboard">View my reservations</Link></Button>
            <Button variant="outline" onClick={() => { setConfirmed(null); toast.success("Added to calendar"); }}>Add to calendar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between text-muted-foreground"><span>{k}</span><span>{v}</span></div>;
}
