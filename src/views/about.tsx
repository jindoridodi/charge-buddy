"use client";

import Link from "next/link";

import { Home, PiggyBank, Leaf, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Section } from "@/components/PageHeader";

const POINTS = [
  { icon: Home, t: "Neighborhood charging", d: "Thousands of home chargers sit idle most of the day. We make them available to drivers nearby." },
  { icon: PiggyBank, t: "Transparent pricing", d: "See the full cost up front — electricity, host fee and even the drive there." },
  { icon: Users, t: "Hosts earn", d: "Set your own price and hours, approve every booking, and get paid for sharing." },
  { icon: Leaf, t: "Cleaner commutes", d: "More places to charge means more people can confidently go electric." },
];

export default function Page() {
  return (
    <div>
      <PageHeader title="About Charge Buddy" subtitle="Peer-to-peer EV charging, starting in San Jose." />
      <Section className="space-y-10">
        <div className="grid gap-4 sm:grid-cols-2">
          {POINTS.map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-2xl border bg-card p-6">
              <Icon className="h-8 w-8 text-primary" />
              <h2 className="mt-3 text-lg font-semibold">{t}</h2>
              <p className="mt-1 text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild><Link href="/chargers">Find a charger</Link></Button>
          <Button asChild variant="outline"><Link href="/list-charger">List your charger</Link></Button>
        </div>
      </Section>
    </div>
  );
}
