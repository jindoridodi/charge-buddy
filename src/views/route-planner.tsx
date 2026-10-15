"use client";

import Link from "next/link";

import { useState } from "react";
import { Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { PageHeader, Section, Field, NativeSelect } from "@/components/PageHeader";
import { estimateCost, money } from "@/lib/data";
import { useApp } from "@/lib/store";

export default function Page() {
  const { vehicles, defaultVehicleId, allChargers } = useApp();
  const [from, setFrom] = useState("Downtown San Jose");
  const [to, setTo] = useState("Santa Cruz, CA");
  const [miles, setMiles] = useState(35);
  const [battery, setBattery] = useState(40);
  const [vid, setVid] = useState(defaultVehicleId);
  const [planned, setPlanned] = useState(false);
  const v = vehicles.find((x) => x.id === vid) ?? vehicles[0];
  const range = v ? (v.batteryKwh * battery) / 100 * v.efficiency : 0;
  const needed = Math.max(0, miles * 1.15 - range);
  const kwhNeeded = v ? Math.ceil(needed / v.efficiency) : 0;
  const stops = allChargers
    .filter((c) => c.status === "Available" && (!v || c.connector === v.connector || c.level === "DC Fast"))
    .map((c) => ({ c, cost: estimateCost(c, Math.max(kwhNeeded, 10), v?.efficiency ?? 3.5) }))
    .sort((a, b) => a.cost.total - b.cost.total)
    .slice(0, 4);

  return (
    <div>
      <PageHeader title="Route Planner" subtitle="See if you can make it — and where to top up cheaply before you go." />
      <Section className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="h-fit space-y-4 rounded-2xl border bg-card p-5">
          <Field label="Starting point"><Input value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Destination"><Input value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field label={`Trip distance: ${miles} mi`}><Slider min={5} max={300} step={5} value={[miles]} onValueChange={([x]) => setMiles(x ?? 35)} /></Field>
          <Field label="Vehicle"><NativeSelect value={vid} onChange={(e) => setVid(e.target.value)}>{vehicles.map((x) => <option key={x.id} value={x.id}>{x.nickname}</option>)}</NativeSelect></Field>
          <Field label={`Current battery: ${battery}%`}><Slider min={5} max={100} step={5} value={[battery]} onValueChange={([x]) => setBattery(x ?? 40)} /></Field>
          <Button className="w-full" onClick={() => setPlanned(true)}><Navigation className="h-4 w-4" />Plan route</Button>
        </div>
        <div className="space-y-4">
          {!planned ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">Enter your trip details and press Plan route.</div>
          ) : (<>
            <div className="rounded-2xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">{from} → {to}</p>
              <p className="mt-1 text-2xl font-bold">{needed === 0 ? "You can make it without charging" : `Charge about ${kwhNeeded} kWh before you leave`}</p>
              <p className="mt-1 text-sm text-muted-foreground">Estimated range now: {Math.round(range)} mi · Trip with 15% buffer: {Math.round(miles * 1.15)} mi</p>
            </div>
            <h2 className="text-lg font-semibold">{needed === 0 ? "Optional top-up spots" : "Recommended charging stops"}</h2>
            {stops.map(({ c, cost }) => (
              <Link key={c.id} href={`/chargers/${encodeURIComponent(c.id)}`} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 hover:border-primary">
                <div><p className="font-semibold">{c.name}</p><p className="text-sm text-muted-foreground">{c.neighborhood} · {c.connector} · {c.powerKw} kW · {cost.distance.toFixed(1)} mi</p></div>
                <span className="font-bold">{money(cost.total)}</span>
              </Link>
            ))}
          </>)}
        </div>
      </Section>
    </div>
  );
}
