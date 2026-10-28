"use client";

import Link from "next/link";

import { useEffect, useMemo, useState } from "react";
import { GitCompare, Search, SlidersHorizontal, Map as MapIcon, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { MapView } from "@/components/MapView";
import { NativeSelect } from "@/components/PageHeader";
import { CONNECTORS, LEVELS } from "@/lib/data";
import { useApp } from "@/lib/store";
import type { CatalogCharger } from "@/lib/catalog/types";
import { CatalogChargerCard } from "@/components/CatalogChargerCard";
import { ChargerCard } from "@/components/ChargerCard";
import { filterLocalListings } from "@/lib/catalog/local-listings";
import type { Coordinates } from "@/lib/trips/types";


const SORTS = {
  name: "Name (A–Z)",
  price: "Lowest electricity price",
} as const;

export default function FindChargers({ q = "" }: { q?: string }) {
  const { compare, settings, listings } = useApp();
  const [catalog, setCatalog] = useState<CatalogCharger[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState(q);
  const [locationSearch, setLocationSearch] = useState({ query: q });
  const [origin, setOrigin] = useState<Coordinates | null>(null);
  const [locationLabel, setLocationLabel] = useState("Nationwide");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationBusy, setLocationBusy] = useState(Boolean(q));
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [radius, setRadius] = useState(settings.maxDistance);
  const [connectors, setConnectors] = useState<string[]>(settings.connectors);
  const [levels, setLevels] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(0.5);
  const [minPower, setMinPower] = useState(0);
  const [time, setTime] = useState("any");
  const [sort, setSort] = useState<keyof typeof SORTS>("name");
  const [active, setActive] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [mobileMap, setMobileMap] = useState(false);

  useEffect(() => {
    setLocationQuery(q);
    setLocationSearch({ query: q });
  }, [q]);

  useEffect(() => {
    const controller = new AbortController();
    setOrigin(null); setCatalog([]); setTotal(0); setLocationError(null);
    if (!locationSearch.query) { setLocationLabel("Nationwide"); setLocationBusy(false); return; }
    setLocationBusy(true);
    fetch(`/api/locations?q=${encodeURIComponent(locationSearch.query)}`, { signal: controller.signal }).then(async (response) => {
      const body = await response.json() as { places?: { label: string; location: Coordinates }[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Location search is unavailable.");
      const place = body.places?.[0];
      if (!place) throw new Error("No U.S. location found. Try a city and state or ZIP code.");
      if (!controller.signal.aborted) { setOrigin(place.location); setLocationLabel(place.label); }
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setLocationError(error instanceof Error ? error.message : "Could not resolve location.");
    }).finally(() => { if (!controller.signal.aborted) setLocationBusy(false); });
    return () => controller.abort();
  }, [locationSearch]);

  useEffect(() => { setPage(1); }, [query, origin, radius, connectors, levels, maxPrice, minPower, time, sort]);

  useEffect(() => {
    if (locationBusy || (locationSearch.query && !origin)) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: "100", page: String(page), sort,
      q: query.trim(), radius: String(radius), maxPrice: String(maxPrice), minPower: String(minPower),
      connectors: connectors.join(","), levels: levels.join(","), operational: String(time === "operational"),
      ...(origin ? { lat: String(origin.lat), lng: String(origin.lng) } : {}),
    });
    setLoading(true); setCatalogError(null);
    if (page === 1) { setCatalog([]); setTotal(0); }
    const timer = window.setTimeout(() => fetch(`/api/chargers?${params}`, { signal: controller.signal }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (!controller.signal.aborted) { setCatalog((previous) => page === 1 ? body.chargers ?? [] : [...previous, ...(body.chargers ?? [])]); setTotal(body.total ?? 0); }
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setCatalogError(error instanceof Error ? error.message : "Could not load public catalog");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); }), 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, sort, page, origin, radius, connectors, levels, maxPrice, minPower, time, locationBusy, locationSearch, retry]);

  const localListings = useMemo(() => locationSearch.query && !origin ? [] : filterLocalListings(listings, {
    query, origin, radius, connectors, levels, maxPrice, minPower, operational: time === "operational",
  }), [listings, query, origin, radius, connectors, levels, maxPrice, minPower, time, locationSearch]);
  const markers = useMemo(() => [
    ...catalog.map((charger) => ({ id: charger.id, lat: charger.latitude, lng: charger.longitude, label: charger.price_summary?.price_per_kwh != null ? `$${charger.price_summary.price_per_kwh.toFixed(2)}` : "?" })),
    ...localListings.map((charger) => ({ id: charger.id, lat: charger.lat, lng: charger.lng, label: `$${charger.pricePerKwh.toFixed(2)}`, mine: true })),
  ], [catalog, localListings]);
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const select = (id: string) => {
    setActive(id);
    document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <h1 className="sr-only">Find Chargers</h1>
      <div className="border-b bg-card px-4 py-3">
        <form className="mb-3 flex flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); setLocationSearch({ query: locationQuery.trim() }); }}>
          <Input aria-label="Search location" value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder="Search near a U.S. city, address or ZIP" className="min-w-[200px] flex-1" />
          <Button type="submit" disabled={locationBusy}>Set location</Button>
          <Button type="button" variant="outline" onClick={() => { setLocationQuery(""); setLocationSearch({ query: "" }); }}>Nationwide</Button>
        </form>
        <p className="mb-3 text-xs text-muted-foreground" role="status">{locationBusy ? "Finding location…" : locationError ?? `${locationLabel}${origin ? " · radius uses straight-line distance" : " · set a location to apply a radius"}`}</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Filter chargers" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Charger name, city, ZIP or address" className="pl-9" />
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
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Straight-line radius: {radius} mi{!origin && " (set a location)"}</p>
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
          <p className="mb-3 text-sm text-muted-foreground">{catalog.length} of {total} public chargers · community prices determine price ranking</p>
          <div className="space-y-3">
            {catalog.map((c) => <div id={`card-${c.id}`} key={c.id}><CatalogChargerCard charger={c} active={active === c.id} onHover={setActive} /></div>)}
            {catalogError && <p role="alert" className="text-sm text-destructive">{catalogError}</p>}
            {(catalogError || catalog.length < total) && <Button variant="outline" disabled={loading} onClick={() => catalogError ? setRetry((value) => value + 1) : setPage((value) => value + 1)}>{catalogError ? "Retry loading chargers" : "Load more chargers"}</Button>}
            {!catalog.length && <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">{locationBusy || loading ? "Loading chargers…" : locationError ?? catalogError ?? "No public chargers match these filters."}</div>}
            {!!localListings.length && <><h2 className="pt-4 text-sm font-semibold">Local demo listings · stored only in this browser</h2>{localListings.map((charger) => <ChargerCard key={charger.id} charger={charger} active={active === charger.id} onHover={setActive} />)}</>}
          </div>
        </div>
        <div className={`flex-1 ${mobileMap ? "block" : "hidden lg:block"}`}>
          <MapView markers={markers} activeId={active} onSelect={select} center={origin ? [origin.lat, origin.lng] : undefined} />
        </div>
        <Button className="absolute bottom-6 left-1/2 z-[500] -translate-x-1/2 rounded-full shadow-glow lg:hidden" onClick={() => setMobileMap(!mobileMap)}>
          {mobileMap ? <><List className="h-4 w-4" /> List</> : <><MapIcon className="h-4 w-4" /> Map</>}
        </Button>
      </div>
    </div>
  );
}
