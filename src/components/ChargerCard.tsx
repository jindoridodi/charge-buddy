"use client";

import Link from "next/link";
import { Heart, MapPin, Plug, Star, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { estimateCost, money, type Charger } from "@/lib/data";
import { useApp } from "@/lib/store";
import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: Charger["status"] }) {
  const cls =
    status === "Available"
      ? "bg-success/15 text-success"
      : status === "Busy"
        ? "bg-warning/20 text-foreground"
        : "bg-muted text-muted-foreground";
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", cls)}>{status}</span>;
}

export function ChargerCard({
  charger,
  active,
  onHover,
  kwh = 30,
  bestValue,
}: {
  charger: Charger;
  active?: boolean;
  onHover?: (id: string | null) => void;
  kwh?: number;
  bestValue?: boolean;
}) {
  const { favorites, toggleFavorite, defaultVehicle, compare, toggleCompare } = useApp();
  const fav = favorites.includes(charger.id);
  const cost = estimateCost(charger, kwh, defaultVehicle?.efficiency ?? 3.5);
  const inCompare = compare.includes(charger.id);
  const incompatible = defaultVehicle && defaultVehicle.connector !== charger.connector;

  return (
    <div
      id={`card-${charger.id}`}
      onMouseEnter={() => onHover?.(charger.id)}
      className={cn(
        "group flex gap-4 rounded-2xl border bg-card p-3 shadow-card transition-all hover:-translate-y-0.5",
        active && "ring-2 ring-primary",
      )}
    >
      <Link href={`/chargers/${encodeURIComponent(charger.id)}`} className="relative w-32 shrink-0 overflow-hidden rounded-xl sm:w-40">
        <img src={charger.photos[0]} alt={charger.name} loading="lazy" width={1024} height={768} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        {bestValue && <Badge className="absolute left-2 top-2">Best value</Badge>}
      </Link>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/chargers/${encodeURIComponent(charger.id)}`} className="truncate font-semibold hover:text-primary">
            {charger.name}
          </Link>
          <button onClick={() => toggleFavorite(charger.id)} aria-label="Favorite" className="shrink-0">
            <Heart className={cn("h-5 w-5 transition-colors", fav ? "fill-destructive text-destructive" : "text-muted-foreground")} />
          </button>
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" /> {charger.neighborhood} · {cost.distance.toFixed(1)} mi · Host {charger.host}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5"><Plug className="h-3 w-3" />{charger.connector}</span>
          <span className="flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5"><Zap className="h-3 w-3" />{charger.powerKw} kW</span>
          <StatusBadge status={charger.status} />
          <span className="flex items-center gap-0.5 font-semibold"><Star className="h-3 w-3 fill-warning text-warning" />{charger.rating}</span>
        </div>
        {incompatible && <p className="text-xs text-destructive">Not compatible with {defaultVehicle.nickname}</p>}
        <div className="flex items-end justify-between pt-1">
          <div>
            <p className="text-lg font-bold">{money(charger.pricePerKwh)}<span className="text-xs font-normal text-muted-foreground">/kWh</span></p>
            <p className="text-xs text-muted-foreground">+{money(charger.hostFee)} fee · est. {money(cost.total)} for {kwh} kWh</p>
          </div>
          <label className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground">
            <input type="checkbox" checked={inCompare} onChange={() => toggleCompare(charger.id)} className="accent-primary" />
            Compare
          </label>
        </div>
      </div>
    </div>
  );
}
