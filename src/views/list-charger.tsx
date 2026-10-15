"use client";

import { useRouter } from "next/navigation";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, Section, Field, NativeSelect } from "@/components/PageHeader";
import { CONNECTORS, LEVELS, PHOTOS, money, suggestPrice, type Charger, type Connector, type Level } from "@/lib/data";
import { useApp } from "@/lib/store";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STEPS = ["Charger", "Location", "Availability", "Pricing"];

export default function Page() {
  const { set, settings } = useApp();
  const nav = useRouter();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    name: "", connector: "J1772" as Connector, level: "Level 2" as Level, powerKw: 7.2, description: "",
    address: "", neighborhood: "", parking: "",
    start: "07:00", end: "22:00", days: DAYS,
    homeRate: 0.24, price: 0, hostFee: 1,
  });
  const u = (p: Partial<typeof f>) => setF((s) => ({ ...s, ...p }));
  const sug = suggestPrice(f.homeRate);
  const price = f.price || Math.round(f.homeRate * (1 + settings.defaultMargin / 100) * 100) / 100;

  const submit = () => {
    const listing: Charger = {
      id: `mine-${Date.now()}`, name: f.name || "My Charger", host: "You", hostSince: "2026", neighborhood: f.neighborhood || "San Jose",
      address: f.address || "San Jose, CA", lat: 37.33 + (Math.random() - 0.5) * 0.06, lng: -121.88 + (Math.random() - 0.5) * 0.06,
      pricePerKwh: price, hostFee: f.hostFee, connector: f.connector, level: f.level, powerKw: f.powerKw, status: "Available",
      rating: 5, reviewCount: 0, photos: [PHOTOS[0]!, PHOTOS[1]!], description: f.description || "A new home charger.",
      parking: f.parking || "Park in the driveway.", hours: { start: f.start, end: f.end, days: f.days }, reviews: [], ownedByMe: true,
    };
    set((s) => ({ listings: [...s.listings, listing], role: "host" }));
    toast.success("Your charger is live!");
    nav.push("/dashboard");
  };

  return (
    <div>
      <PageHeader title="List Your Charger" subtitle="Turn your home charger into extra income in a few minutes." />
      <Section className="max-w-3xl">
        <div className="mb-6 flex gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
              <p className={`mt-1 text-xs ${i === step ? "font-semibold" : "text-muted-foreground"}`}>{s}</p>
            </div>
          ))}
        </div>
        <div className="space-y-4 rounded-2xl border bg-card p-6">
          {step === 0 && (<>
            <Field label="Listing name"><Input value={f.name} onChange={(e) => u({ name: e.target.value })} placeholder="e.g. Willow Glen Garage Charger" /></Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Connector"><NativeSelect value={f.connector} onChange={(e) => u({ connector: e.target.value as Connector })}>{CONNECTORS.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field>
              <Field label="Level"><NativeSelect value={f.level} onChange={(e) => u({ level: e.target.value as Level })}>{LEVELS.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field>
              <Field label="Power (kW)"><Input type="number" value={f.powerKw} onChange={(e) => u({ powerKw: +e.target.value })} /></Field>
            </div>
            <Field label="Description"><Textarea value={f.description} onChange={(e) => u({ description: e.target.value })} /></Field>
            <Field label="Photos" hint="Photo upload is a preview — sample photos will be used."><Input type="file" accept="image/*" multiple /></Field>
          </>)}
          {step === 1 && (<>
            <Field label="Street address" hint="Only the street name is shown publicly until a booking is confirmed."><Input value={f.address} onChange={(e) => u({ address: e.target.value })} /></Field>
            <Field label="Neighborhood"><Input value={f.neighborhood} onChange={(e) => u({ neighborhood: e.target.value })} /></Field>
            <Field label="Parking instructions"><Textarea value={f.parking} onChange={(e) => u({ parking: e.target.value })} /></Field>
          </>)}
          {step === 2 && (<>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Available from"><Input type="time" value={f.start} onChange={(e) => u({ start: e.target.value })} /></Field>
              <Field label="Until"><Input type="time" value={f.end} onChange={(e) => u({ end: e.target.value })} /></Field>
            </div>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <button key={d} onClick={() => u({ days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d] })} className={`rounded-full border px-3 py-1 text-sm ${f.days.includes(d) ? "border-primary bg-accent text-accent-foreground" : ""}`}>{d}</button>
              ))}
            </div>
          </>)}
          {step === 3 && (<>
            <Field label="Your home electricity rate ($/kWh)"><Input type="number" step="0.01" value={f.homeRate} onChange={(e) => u({ homeRate: +e.target.value })} /></Field>
            <div className="rounded-xl bg-accent p-4 text-sm text-accent-foreground">Suggested price: <b>{money(sug.suggested)}/kWh</b> — about {money(sug.profit)} profit per kWh.</div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Your price ($/kWh)"><Input type="number" step="0.01" value={price} onChange={(e) => u({ price: +e.target.value })} /></Field>
              <Field label="Flat host fee ($)"><Input type="number" step="0.5" value={f.hostFee} onChange={(e) => u({ hostFee: +e.target.value })} /></Field>
            </div>
            <p className="text-sm text-muted-foreground">A 30 kWh session would earn you about <b>{money(30 * (price - f.homeRate) + f.hostFee)}</b>.</p>
          </>)}
          <div className="flex justify-between pt-2">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
            {step < 3 ? <Button onClick={() => setStep(step + 1)}>Continue</Button> : <Button onClick={submit}>Publish listing</Button>}
          </div>
        </div>
      </Section>
    </div>
  );
}
