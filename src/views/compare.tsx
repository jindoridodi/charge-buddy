"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader, Section } from "@/components/PageHeader";
import { catalogQuote } from "@/lib/quote";
import type { CatalogCharger } from "@/lib/catalog/types";
import { useApp } from "@/lib/store";

export default function Page() {
  const { compare, toggleCompare, quoteOrigin, quoteEnergy, quoteVehicleId, vehicles, defaultVehicle, getCharger } = useApp();
  const [items, setItems] = useState<CatalogCharger[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    Promise.all(compare.map(async (id) => {
      const local = getCharger(id);
      if (local) return { id: local.id, name: local.name, latitude: local.lat, longitude: local.lng, price_summary: { status: "community", price_per_kwh: local.pricePerKwh, observed_at: null }, hostFee: local.hostFee } as CatalogCharger & { hostFee: number };
      const response = await fetch(`/api/chargers/${encodeURIComponent(id)}`, { signal: controller.signal });
      if (!response.ok) throw new Error("Could not load selected chargers.");
      return (await response.json()).charger as CatalogCharger;
    })).then(setItems).catch(() => { if (!controller.signal.aborted) setError("Could not load selected chargers."); });
    return () => controller.abort();
  }, [compare]);
  const efficiency = vehicles.find((v) => v.id === quoteVehicleId)?.efficiency ?? defaultVehicle?.efficiency ?? 3.5;
  const rows = items.map((charger) => ({ charger, quote: catalogQuote(charger, quoteOrigin, quoteEnergy, efficiency) }));
  const best = rows.filter((r) => r.quote.total != null).sort((a, b) => a.quote.total! - b.quote.total! || a.charger.id.localeCompare(b.charger.id))[0]?.charger.id;
  return <div><PageHeader title="Compare Chargers" subtitle={`Estimated costs for ${quoteEnergy} kWh${quoteOrigin ? ", including straight-line round-trip travel at $0.32/kWh" : "; set an origin to include travel"}.`} /><Section>
    {error && <p role="alert">{error}</p>}
    {compare.length < 2 ? <p>Select at least two chargers to compare. <Link href="/chargers">Browse chargers →</Link></p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th /><th>Estimated total</th><th>Price per kWh</th><th /></tr></thead><tbody>{rows.map(({ charger, quote }) => <tr key={charger.id} className="border-b"><th className="p-3 text-left"><Link href={`/chargers/${encodeURIComponent(charger.id)}`}>{charger.name}</Link>{charger.id === best && <span className="ml-2">Lowest estimated cost</span>}</th><td>{quote.total == null ? "Price unknown" : `$${quote.total.toFixed(2)}`}</td><td>{charger.price_summary?.price_per_kwh == null ? "Unknown" : `$${charger.price_summary.price_per_kwh.toFixed(2)}`}</td><td><button onClick={() => toggleCompare(charger.id)}>Remove</button></td></tr>)}</tbody></table></div>}
  </Section></div>;
}
