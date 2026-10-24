"use client";

import Link from "next/link";

import { useEffect, useMemo, useState } from "react";
import { GitCompare, Search, SlidersHorizontal, Map as MapIcon, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ChargerCard } from "@/components/ChargerCard";
import { MapView } from "@/components/MapView";
import { NativeSelect } from "@/components/PageHeader";
import { CONNECTORS, LEVELS, estimateCost } from "@/lib/data";
import { useApp } from "@/lib/store";
import type { CatalogCharger } from "@/lib/catalog/types";
import { CatalogChargerCard } from "@/components/CatalogChargerCard";


const SORTS = {
  recommended: "Recommended / Best Value",
  price: "Lowest electricity price",
  total: "Lowest estimated total cost",
  distance: "Closest distance",
  rating: "Highest rated",
} as const;

export default function FindChargers({ q = "" }: { q?: string }) {
  const { allChargers, defaultVehicle, compare, settings } = useApp();
  const [catalog, setCatalog] = useState<CatalogCharger[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [query, setQuery] = useState(q ?? "");
  const [radius, setRadius] = useState(settings.maxDistance);
  const [connectors, setConnectors] = useState<string[]>(settings.connectors);
  const [levels, setLevels] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(0.5);
  const [minPower, setMinPower] = useState(0);
  const [time, setTime] = useState("any");
  const [sort, setSort] = useState<keyof typeof SORTS>("recommended");
  const [active, setActive] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [mobileMap, setMobileMap] = useState(false);
  const eff = defaultVehicle?.efficiency ?? 3.5;
  const kwh = 30;

  useEffect(() => {
    const params = new URLSearchParams({ limit: "100", ...(query.trim() ? { q: query.trim() } : {}), ...(sort === "price" || sort === "total" ? { sort } : {}) });
    const timer = window.setTimeout(() => fetch(`/api/chargers?${params}`).then(async (response) => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error); setCatalog(body.chargers ?? []); setCatalogError(null);
    }).catch((error: unknown) => setCatalogError(error instanceof Error ? error.message : "Could not load public catalog")), 250);
    return () => window.clearTimeout(timer);
  }, [query, sort]);

  const results = useMemo(() => {
    const ql = query.toLowerCase().trim();
    const list = allChargers
      .map((c) => ({ c, cost: estimateCost(c, kwh, eff) }))
      .filter(({ c, cost }) => {
        if (ql && !["san jose", "downtown san jose", "951"].some((k) => ql.includes(k)) && !`${c.name} ${c.neighborhood} ${c.address}`.toLowerCase().includes(ql)) return false;
        if (cost.distance > radius) return false;
        if (connectors.length && !connectors.includes(c.connector)) return false;
        if (levels.length && !levels.includes(c.level)) return false;
        if (c.pricePerKwh > maxPrice) return false;
        if (c.powerKw < minPower) return false;
        if (time === "now" && c.status !== "Available") return false;
        if (time === "evening" && c.hours.end < "22:00") return false;
        if (time === "morning" && c.hours.start > "06:00") return false;
        return true;
      });
    const score = (x: (typeof list)[number]) => x.cost.total - x.c.rating * 1.5;
    list.sort((a, b) =>
      sort === "price" ? a.c.pricePerKwh - b.c.pricePerKwh
      : sort === "total" ? a.cost.total - b.cost.total
      : sort === "distance" ? a.cost.distance - b.cost.distance
      : sort === "rating" ? b.c.rating - a.c.rating
      : score(a) - score(b),
    );
    return list;
  }, [allChargers, query, radius, connectors, levels, maxPrice, minPower, time, sort, eff]);

  const bestId = [...results].sort((a, b) => a.cost.total - b.cost.total)[0]?.c.id;
  const markers = useMemo(() => [...catalog.map((c) => ({ id: c.id, lat: c.latitude, lng: c.longitude, label: c.price_summary?.price_per_kwh != null ? `$${c.price_summary.price_per_kwh.toFixed(2)}` : "?" })), ...results.map(({ c }) => ({ id: c.id, lat: c.lat, lng: c.lng, label: `$${c.pricePerKwh.toFixed(2)}`, mine: true }))], [catalog, results]);
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const select = (id: string) => {
    setActive(id);
    document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Address, city, ZIP or neighborhood" className="pl-9" />
          </div>
          <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)} className="w-auto">
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
          <Button variant={showFilters ? "default" : "outline"} onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal className="h-4 w-4" /> Filters
          </Button>
          {compare.length >= 2 && (
            <Button asChild variant="secondary"><Link href="/compare"><GitCompare className="h-4 w-4" /> Compare ({compare.length})</Link></Button>
          )}
        </div>
        {showFilters && (
          <div className="mt-4 grid gap-5 animate-in fade-in slide-in-from-top-2 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Radius: {radius} mi</p>
              <Slider min={1} max={30} step={1} value={[radius]} onValueChange={([v]) => setRadius(v ?? 15)} />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Max price: ${maxPrice.toFixed(2)}/kWh</p>
              <Slider min={0.15} max={0.5} step={0.01} value={[maxPrice]} onValueChange={([v]) => setMaxPrice(v ?? 0.5)} />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Min power: {minPower} kW</p>
              <Slider min={0} max={60} step={1} value={[minPower]} onValueChange={([v]) => setMinPower(v ?? 0)} />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Available</p>
              <NativeSelect value={time} onChange={(e) => setTime(e.target.value)}>
                <option value="any">Any time</option>
                <option value="now">Available now</option>
                <option value="morning">Early morning (6am)</option>
                <option value="evening">Late evening (10pm+)</option>
              </NativeSelect>
            </div>
            <div className="sm:col-span-2">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Connector</p>
              <div className="flex flex-wrap gap-2">
                {CONNECTORS.map((c) => (
                  <button key={c} onClick={() => toggle(connectors, setConnectors, c)} className={`rounded-full border px-3 py-1 text-sm ${connectors.includes(c) ? "border-primary bg-accent text-accent-foreground" : ""}`}>{c === "NACS" ? "NACS/Tesla" : c}</button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Level</p>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((c) => (
                  <button key={c} onClick={() => toggle(levels, setLevels, c)} className={`rounded-full border px-3 py-1 text-sm ${levels.includes(c) ? "border-primary bg-accent text-accent-foreground" : ""}`}>{c}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="relative flex min-h-0 flex-1">
        <div className={`w-full overflow-y-auto p-4 lg:w-[52%] ${mobileMap ? "hidden lg:block" : ""}`}>
          <p className="mb-3 text-sm text-muted-foreground">{catalog.length + results.length} chargers · public catalog uses community prices for rankings</p>
          <div className="space-y-3">
            {catalog.map((c) => <CatalogChargerCard key={c.id} charger={c} active={active === c.id} onHover={setActive} />)}
            {results.map(({ c }) => (
              <div key={c.id} onClick={() => setActive(c.id)}>
                <ChargerCard charger={c} active={active === c.id} onHover={setActive} kwh={kwh} bestValue={c.id === bestId} />
              </div>
            ))}
            {!results.length && !catalog.length && <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">{catalogError ?? "No chargers match these filters. Import the NREL catalog to begin."}</div>}
          </div>
        </div>
        <div className={`flex-1 ${mobileMap ? "block" : "hidden lg:block"}`}>
          <MapView markers={markers} activeId={active} onSelect={select} />
        </div>
        <Button className="absolute bottom-6 left-1/2 z-[500] -translate-x-1/2 rounded-full shadow-glow lg:hidden" onClick={() => setMobileMap(!mobileMap)}>
          {mobileMap ? <><List className="h-4 w-4" /> List</> : <><MapIcon className="h-4 w-4" /> Map</>}
        </Button>
      </div>
    </div>
  );
}
