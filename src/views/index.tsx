"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useState } from "react";
import { ArrowRight, BadgeDollarSign, Car, Home, LocateFixed, MapPin, Search, Leaf, Clock, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import hero from "@/assets/hero.jpg";
import { ChargerCard } from "@/components/ChargerCard";
import { useApp } from "@/lib/store";
import { toast } from "sonner";

export default function Index() {
  const [q, setQ] = useState("");
  const navigate = useRouter();
  const { allChargers } = useApp();
  const featured = [...allChargers].sort((a, b) => b.rating - a.rating).slice(0, 4);

  const go = (query: string) => navigate.push(`/chargers?q=${encodeURIComponent(query)}`);

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 md:py-24 lg:grid-cols-2">
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              <Zap className="h-3 w-3" /> 1,200+ home chargers in the Bay Area
            </span>
            <h1 className="text-4xl font-extrabold leading-tight md:text-6xl">
              Your Next Charge Is <span className="bg-gradient-primary bg-clip-text text-transparent">Closer</span> Than You Think.
            </h1>
            <p className="max-w-lg text-lg text-muted-foreground">
              Discover affordable EV charging nearby or earn money by sharing your home charger.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                go(q);
              }}
              className="flex max-w-xl items-center gap-2 rounded-2xl border bg-card p-2 shadow-card"
            >
              <MapPin className="ml-2 h-5 w-5 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="City, ZIP code, or address" className="border-0 shadow-none focus-visible:ring-0" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Use current location"
                onClick={() => {
                  toast.success("Using your location: Downtown San Jose (simulated)");
                  go("Downtown San Jose");
                }}
              >
                <LocateFixed className="h-4 w-4" />
              </Button>
              <Button type="submit">
                <Search className="h-4 w-4" /> Search
              </Button>
            </form>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-gradient-primary shadow-glow">
                <Link href="/chargers">Find a Charger <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/list-charger">List Your Charger</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <img src={hero.src} alt="Electric car charging at a home wall charger" width={1536} height={1024} className="aspect-[4/3] w-full rounded-3xl object-cover shadow-card" />
            <div className="absolute -bottom-5 left-5 rounded-2xl border bg-card p-4 shadow-card">
              <p className="text-xs text-muted-foreground">Avg. savings vs public fast charging</p>
              <p className="font-display text-2xl font-bold text-primary">42%</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold">How it works</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {[
            { icon: Car, title: "For Drivers", steps: ["Search for available chargers.", "Compare prices and distances.", "Reserve a charger.", "Navigate to the location and charge."] },
            { icon: Home, title: "For Hosts", steps: ["Create an account.", "List your home EV charger.", "Set your pricing and availability.", "Earn money when drivers use your charger."] },
          ].map((b) => (
            <div key={b.title} className="rounded-3xl border bg-card p-8 shadow-card">
              <div className="mb-6 flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-accent-foreground"><b.icon className="h-5 w-5" /></span>
                <h3 className="text-xl font-bold">{b.title}</h3>
              </div>
              <ol className="space-y-4">
                {b.steps.map((s, i) => (
                  <li key={s} className="flex items-center gap-4">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card py-20">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-3xl font-bold">Why peer-to-peer charging?</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: BadgeDollarSign, t: "Lower charging costs", d: "Home rates beat most public networks." },
              { icon: MapPin, t: "Convenient locations", d: "Chargers in the neighborhoods you already visit." },
              { icon: Home, t: "Extra income", d: "Hosts earn from a charger that sits idle." },
              { icon: Leaf, t: "Better infrastructure", d: "More access without new construction." },
            ].map((f) => (
              <div key={f.t} className="rounded-2xl border p-6 transition-shadow hover:shadow-card">
                <f.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-4 font-semibold">{f.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="flex items-end justify-between">
          <h2 className="text-3xl font-bold">Top-rated near San Jose</h2>
          <Link href="/chargers" className="text-sm font-semibold text-primary">View all →</Link>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {featured.map((c) => <ChargerCard key={c.id} charger={c} />)}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4">
        <div className="grid gap-6 rounded-3xl bg-gradient-primary p-10 text-primary-foreground md:grid-cols-3">
          {[
            { icon: Shield, t: "Verified hosts", d: "Every listing is reviewed by the community." },
            { icon: Clock, t: "Book in seconds", d: "Reserve a time slot and skip the queue." },
            { icon: Zap, t: "Smart cost estimates", d: "Includes fees and travel, not just $/kWh." },
          ].map((f) => (
            <div key={f.t}>
              <f.icon className="h-6 w-6" />
              <h3 className="mt-3 font-semibold">{f.t}</h3>
              <p className="text-sm opacity-90">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
