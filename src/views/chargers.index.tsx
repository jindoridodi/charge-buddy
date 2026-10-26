"use client";

import Link from "next/link";

import { useEffect, useMemo, useState } from "react";
import { GitCompare, Search, SlidersHorizontal, Map as MapIcon, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { MapView } from "@/components/MapView";
import { NativeSelect } from "@/components/PageHeader";
import { CONNECTORS, LEVELS, distanceMiles, USER_LOC } from "@/lib/data";
import { useApp } from "@/lib/store";
import type { CatalogCharger } from "@/lib/catalog/types";
import { CatalogChargerCard } from "@/components/CatalogChargerCard";


const SORTS = {
  recommended: "Recommended / Best Value",
  price: "Lowest electricity price",
  distance: "Closest distance",
  rating: "Highest rated",
} as const;

export default function FindChargers({ q = "" }: { q?: string }) {
  const { compare, settings } = useApp();
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

  useEffect(() => {
    const params = new URLSearchParams({ limit: "100", ...(query.trim() ? { q: query.trim() } : {}), ...(sort === "price" ? { sort } : {}) });
    const timer = window.setTimeout(() => fetch(`/api/chargers?${params}`).then(async (response) => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error); setCatalog(body.chargers ?? []); setCatalogError(null);
    }).catch((error: unknown) => setCatalogError(error instanceof Error ? error.message : "Could not load public catalog")), 250);
    return () => window.clearTimeout(timer);
  }, [query, sort]);

  const filteredCatalog = useMemo(() => catalog.filter((charger) => {
    const price = charger.price_summary?.price_per_kwh;
    const chargerConnectors = charger.connector_types.map((connector) => connector === "J1772COMBO" ? "CCS" : connector);
    const power = charger.power_kw == null ? 0 : Number(charger.power_kw);
    const level = power <= 2 ? "Level 1" : power < 20 ? "Level 2" : "DC Fast";
    if (distanceMiles(USER_LOC, { lat: charger.latitude, lng: charger.longitude }) > radius) return false;
    if (connectors.length && !chargerConnectors.some((connector) => connectors.includes(connector))) return false;
    if (levels.length && !levels.includes(level)) return false;
    if (price != null && price > maxPrice) return false;
    if (power < minPower) return false;
    if (time === "operational" && charger.availability_status === "unavailable") return false;
    return true;
  }), [catalog, radius, connectors, levels, maxPrice, minPower, time]);

  const markers = useMemo(() => filteredCatalog.map((charger) => ({ id: charger.id, lat: charger.latitude, lng: charger.longitude, label: charger.price_summary?.price_per_kwh != null ? `$${charger.price_summary.price_per_kwh.toFixed(2)}` : "?" })), [filteredCatalog]);
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
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Operational status</p>
              <NativeSelect value={time} onChange={(e) => setTime(e.target.value)}>
                <option value="any">Any time</option>
                <option value="operational">Last known operational</option>
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
          <p className="mb-3 text-sm text-muted-foreground">{filteredCatalog.length} chargers · public catalog uses community prices for rankings</p>
          <div className="space-y-3">
            {filteredCatalog.map((c) => <CatalogChargerCard key={c.id} charger={c} active={active === c.id} onHover={setActive} />)}
            {!filteredCatalog.length && <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">{catalogError ?? "No chargers match these filters. Import the NREL catalog to begin."}</div>}
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
