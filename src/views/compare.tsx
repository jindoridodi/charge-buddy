"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader, Section } from "@/components/PageHeader";
import { catalogQuote } from "@/lib/quote";
import type { CatalogCharger } from "@/lib/catalog/types";
import { useApp } from "@/lib/store";

type Selection = { id: string; charger: CatalogCharger | null; message: string };

export default function Page() {
  const { compare, toggleCompare, quoteOrigin, quoteEnergy, quoteVehicleId, vehicles, defaultVehicle } = useApp();
  const [items, setItems] = useState<Selection[]>([]);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setItems(compare.map((id) => ({ id, charger: null, message: "Loading charger…" })));
    // Read the same public projection used by discovery, including for hosts' own listings.
    void Promise.all(compare.map(async (id): Promise<Selection> => {
      try {
        const response = await fetch(`/api/chargers/${encodeURIComponent(id)}`, { signal: controller.signal });
        if (response.status === 404) return { id, charger: null, message: "Charger unavailable or no longer published." };
        if (!response.ok) throw new Error("Could not load charger. Retry or remove this selection.");
        const body = await response.json() as { charger?: CatalogCharger };
        if (!body.charger) throw new Error("Could not load charger. Retry or remove this selection.");
        return { id, charger: body.charger, message: "" };
      } catch (error) {
        return { id, charger: null, message: error instanceof Error ? error.message : "Could not load charger." };
      }
    })).then((selections) => { if (!controller.signal.aborted) setItems(selections); });
    return () => controller.abort();
  }, [compare, retry]);

  const efficiency = vehicles.find((v) => v.id === quoteVehicleId)?.efficiency ?? defaultVehicle?.efficiency ?? 3.5;
  const rows = items.filter((item) => compare.includes(item.id)).map((item) => ({ ...item, quote: item.charger ? catalogQuote(item.charger, quoteOrigin, quoteEnergy, efficiency) : null }));
  const best = rows.filter((r) => r.quote?.total != null).sort((a, b) => a.quote!.total! - b.quote!.total! || a.id.localeCompare(b.id))[0]?.id;
  const amount = (value: number | null | undefined) => value == null ? "Unknown" : `$${value.toFixed(2)}`;

  return <div><PageHeader title="Compare Chargers" subtitle={`Estimated costs for ${quoteEnergy} kWh${quoteOrigin ? ", including straight-line round-trip travel at $0.32/kWh" : "; set an origin to include travel"}.`} /><Section>
    {compare.length < 2 ? <p>Select at least two chargers to compare. <Link href="/chargers">Browse chargers →</Link></p> : <>
      <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Charging, fee and travel estimates for selected chargers</caption><thead><tr><th scope="col" className="p-3 text-left">Charger</th><th scope="col">Electricity</th><th scope="col">Host fee</th><th scope="col">Travel</th><th scope="col">Estimated total</th><th scope="col">Price per kWh</th><th scope="col">Actions</th></tr></thead><tbody>{rows.map(({ id, charger, quote, message }) => <tr key={id} className="border-b"><th scope="row" className="p-3 text-left">{charger ? <><Link href={`/chargers/${encodeURIComponent(id)}`}>{charger.name}</Link>{id === best && <span className="ml-2">Lowest estimated cost</span>}</> : <><span>{id}</span><p role="status" className="font-normal">{message}</p></>}</th><td className="p-3">{amount(quote?.electricity)}</td><td className="p-3">{amount(quote?.hostFee)}</td><td className="p-3">{quote ? amount(quote.travel) : "Unknown"}</td><td className="p-3">{quote?.total == null ? "Price unknown" : amount(quote.total)}</td><td className="p-3">{amount(charger?.price_summary?.price_per_kwh)}</td><td className="p-3"><Button size="sm" variant="outline" onClick={() => toggleCompare(id)}>Remove</Button></td></tr>)}</tbody></table></div>
      {rows.some((row) => !row.charger && !row.message.startsWith("Loading")) && <Button className="mt-4" variant="outline" onClick={() => setRetry((value) => value + 1)}>Retry selected chargers</Button>}
    </>}
  </Section></div>;
}
