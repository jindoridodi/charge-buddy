"use client";

import Link from "next/link";

import { toast } from "sonner";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Section } from "@/components/PageHeader";
import { ChargerCard } from "@/components/ChargerCard";
import { EARNINGS_HISTORY, money } from "@/lib/data";
import { useApp } from "@/lib/store";

function Stat({ k, v }: { k: string; v: string }) {
  return <div className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="text-2xl font-bold">{v}</p></div>;
}

export default function Page() {
  const app = useApp();
  const { role, set } = app;
  const completed = app.reservations.filter((r) => r.status === "Completed");
  const spent = completed.reduce((s, r) => s + r.total, 0);
  const kwh = completed.reduce((s, r) => s + r.kwh, 0);
  const hostDone = app.hostBookings.filter((b) => b.status === "Completed");
  const earned = hostDone.reduce((s, b) => s + b.earnings, 0);

  const updateBooking = (id: string, status: "Accepted" | "Declined") => {
    set((s) => ({ hostBookings: s.hostBookings.map((b) => (b.id === id ? { ...b, status } : b)) }));
    toast.success(`Booking ${status.toLowerCase()}`);
  };

  return (
    <div>
      <PageHeader title={`Welcome back${app.user ? `, ${app.user.name.split(" ")[0]}` : ""}`} subtitle="Your charging activity at a glance.">
        <div className="flex rounded-full border bg-card p-1">
          {(["driver", "host"] as const).map((r) => (
            <button key={r} onClick={() => set({ role: r })} className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${role === r ? "bg-primary text-primary-foreground" : ""}`}>{r}</button>
          ))}
        </div>
      </PageHeader>
      <Section>
        {role === "driver" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat k="Sessions completed" v={String(completed.length)} />
              <Stat k="Energy charged" v={`${kwh} kWh`} />
              <Stat k="Total spent" v={money(spent)} />
            </div>
            <Tabs defaultValue="upcoming" className="mt-6">
              <TabsList><TabsTrigger value="upcoming">Upcoming</TabsTrigger><TabsTrigger value="history">History</TabsTrigger><TabsTrigger value="favorites">Favorites</TabsTrigger></TabsList>
              {(["upcoming", "history"] as const).map((tab) => (
                <TabsContent key={tab} value={tab} className="space-y-3">
                  {app.reservations.filter((r) => (tab === "upcoming" ? r.status === "Upcoming" : r.status !== "Upcoming")).map((r) => {
                    const c = app.getCharger(r.chargerId);
                    return (
                      <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
                        <div>
                          <p className="font-semibold">{c?.name ?? "Charger"}</p>
                          <p className="text-sm text-muted-foreground">{r.date} · {r.start} · {r.durationHrs} hr · {r.kwh} kWh · {r.payment}</p>
                          <p className="text-xs text-muted-foreground">#{r.id} · {r.status}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold">{money(r.total)}</span>
                          {r.status === "Upcoming" && (
                            <Button size="sm" variant="outline" onClick={() => { set((s) => ({ reservations: s.reservations.map((x) => (x.id === r.id ? { ...x, status: "Cancelled" } : x)) })); toast("Reservation cancelled"); }}>Cancel</Button>
                          )}
                          {r.status === "Completed" && c && <Button size="sm" variant="outline" asChild><Link href={`/chargers/${encodeURIComponent(c.id)}`}>Book again</Link></Button>}
                        </div>
                      </div>
                    );
                  })}
                  {!app.reservations.some((r) => (tab === "upcoming" ? r.status === "Upcoming" : r.status !== "Upcoming")) && <p className="text-muted-foreground">Nothing here yet.</p>}
                </TabsContent>
              ))}
              <TabsContent value="favorites" className="space-y-3">
                {app.favorites.map(app.getCharger).map((c) => c && <ChargerCard key={c.id} charger={c} />)}
                {!app.favorites.length && <p className="text-muted-foreground">No favorites yet.</p>}
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat k="Active listings" v={String(app.listings.filter((l) => !l.disabled).length)} />
              <Stat k="Pending requests" v={String(app.hostBookings.filter((b) => b.status === "Pending").length)} />
              <Stat k="Completed sessions" v={String(hostDone.length)} />
              <Stat k="Total earned" v={money(earned)} />
            </div>
            <div className="mt-6 rounded-2xl border bg-card p-4">
              <h2 className="mb-3 font-semibold">Monthly earnings</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={EARNINGS_HISTORY}><XAxis dataKey="month" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Bar dataKey="earnings" fill="var(--color-primary)" radius={[6, 6, 0, 0]} /></BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <h2 className="mb-3 mt-6 text-lg font-semibold">Booking requests</h2>
            <div className="space-y-3">
              {app.hostBookings.map((b) => (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
                  <div>
                    <p className="font-semibold">{b.driver} · {b.vehicle}</p>
                    <p className="text-sm text-muted-foreground">{app.getCharger(b.chargerId)?.name} · {b.date} {b.start} · {b.kwh} kWh</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">{money(b.earnings)}</span>
                    {b.status === "Pending" ? (
                      <><Button size="sm" onClick={() => updateBooking(b.id, "Accepted")}>Accept</Button><Button size="sm" variant="outline" onClick={() => updateBooking(b.id, "Declined")}>Decline</Button></>
                    ) : <span className="text-sm text-muted-foreground">{b.status}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="mb-3 mt-6 flex items-center justify-between"><h2 className="text-lg font-semibold">My listings</h2><Button asChild size="sm"><Link href="/list-charger">Add listing</Link></Button></div>
            <div className="space-y-3">
              {app.listings.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <img src={l.photos[0]} alt="" className="h-14 w-20 rounded-lg object-cover" />
                    <div><p className="font-semibold">{l.name}</p><p className="text-sm text-muted-foreground">{l.connector} · {money(l.pricePerKwh)}/kWh</p></div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">{l.disabled ? "Paused" : "Live"}<Switch checked={!l.disabled} onCheckedChange={(on) => set((s) => ({ listings: s.listings.map((x) => (x.id === l.id ? { ...x, disabled: !on } : x)) }))} /></label>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>
    </div>
  );
}
