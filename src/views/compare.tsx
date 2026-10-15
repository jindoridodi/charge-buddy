"use client";

import Link from "next/link";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Section } from "@/components/PageHeader";
import { estimateCost, money } from "@/lib/data";
import { useApp } from "@/lib/store";

export default function Page() {
  const { compare, getCharger, toggleCompare, defaultVehicle } = useApp();
  const items = compare.map(getCharger).filter((c): c is NonNullable<typeof c> => !!c);
  const eff = defaultVehicle?.efficiency ?? 3.5;
  const rows = items.map((c) => ({ c, cost: estimateCost(c, 30, eff) }));
  const best = [...rows].sort((a, b) => a.cost.total - b.cost.total)[0]?.c.id;

  const fields: Array<[string, (r: (typeof rows)[number]) => string]> = [
    ["Neighborhood", (r) => r.c.neighborhood],
    ["Distance", (r) => `${r.cost.distance.toFixed(1)} mi`],
    ["Connector", (r) => r.c.connector],
    ["Level", (r) => r.c.level],
    ["Power", (r) => `${r.c.powerKw} kW`],
    ["Price / kWh", (r) => money(r.c.pricePerKwh)],
    ["Host fee", (r) => money(r.c.hostFee)],
    ["Travel cost", (r) => money(r.cost.travel)],
    ["Est. total (30 kWh)", (r) => money(r.cost.total)],
    ["Rating", (r) => `${r.c.rating} ★ (${r.c.reviewCount})`],
    ["Status", (r) => r.c.status],
  ];

  return (
    <div>
      <PageHeader title="Compare Chargers" subtitle="Side-by-side comparison of the chargers you've selected (up to 4)." />
      <Section>
        {rows.length < 2 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
            Select at least two chargers to compare. <Link href="/chargers" className="font-semibold text-primary">Browse chargers →</Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-3 text-left" />
                  {rows.map(({ c }) => (
                    <th key={c.id} className="min-w-[180px] p-3 text-left align-top">
                      <img src={c.photos[0]} alt="" className="mb-2 h-24 w-full rounded-lg object-cover" />
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/chargers/${encodeURIComponent(c.id)}`} className="font-semibold hover:text-primary">{c.name}</Link>
                        <button onClick={() => toggleCompare(c.id)} aria-label="Remove"><X className="h-4 w-4" /></button>
                      </div>
                      {c.id === best && <span className="mt-1 inline-block rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">Best value</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fields.map(([label, fn]) => (
                  <tr key={label} className="border-b last:border-0">
                    <td className="p-3 font-medium text-muted-foreground">{label}</td>
                    {rows.map((r) => <td key={r.c.id} className="p-3">{fn(r)}</td>)}
                  </tr>
                ))}
                <tr>
                  <td />
                  {rows.map(({ c }) => <td key={c.id} className="p-3"><Button asChild size="sm"><Link href={`/chargers/${encodeURIComponent(c.id)}`}>Book</Link></Button></td>)}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
