"use client";

import Link from "next/link";
import { Heart, MapPin, Plug, Zap } from "lucide-react";
import type { CatalogCharger } from "@/lib/catalog/types";
import { useApp } from "@/lib/store";

export function CatalogChargerCard({ charger, active, onHover }: { charger: CatalogCharger; active?: boolean; onHover?: (id: string | null) => void }) {
  const { accountReady, favorites, toggleFavorite } = useApp();
  const price = charger.price_summary;
  const place = [charger.city, charger.state, charger.zip].filter(Boolean).join(", ");
  const favorite = favorites.includes(charger.id);
  return <div onMouseEnter={() => onHover?.(charger.id)} className={`rounded-2xl border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 ${active ? "ring-2 ring-primary" : ""}`}>
    <div className="flex items-start justify-between gap-3"><Link href={`/chargers/${charger.id}`} className="min-w-0 flex-1"><h2 className="font-semibold">{charger.name}</h2><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{charger.address}{place ? `, ${place}` : ""}</p></Link><div className="flex shrink-0 items-start gap-2"><div className="text-right"><p className="text-lg font-bold">{price?.price_per_kwh != null ? `$${price.price_per_kwh.toFixed(2)}/kWh` : "Price unknown"}</p><p className="text-xs text-muted-foreground">{price?.status === "host" ? "Host-reported price" : price?.status === "community" ? `Community report · ${price.observed_at}` : "No current community report"}</p></div><button type="button" aria-label="Favorite" aria-pressed={favorite} disabled={!accountReady} onClick={() => toggleFavorite(charger.id)}><Heart className={`h-5 w-5 ${favorite ? "fill-destructive text-destructive" : "text-muted-foreground"}`} /></button></div></div>
    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1"><Plug className="h-3 w-3" />{charger.connector_types.join(", ") || "Connector unknown"}</span><span className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1"><Zap className="h-3 w-3" />{charger.network || "Public charger"}</span></div>
    <p className="mt-3 text-xs text-muted-foreground">{`Availability ${charger.availability_status ?? "unknown"}`}</p>
    {charger.operator_pricing && <p className="mt-3 text-xs text-muted-foreground">Operator-reported price: {charger.operator_pricing}</p>}
  </div>;
}
