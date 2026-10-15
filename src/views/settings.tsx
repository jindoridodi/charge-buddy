"use client";


import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { PageHeader, Section, Field, NativeSelect } from "@/components/PageHeader";
import { CONNECTORS, type Connector, type Vehicle } from "@/lib/data";
import { useApp, type Settings } from "@/lib/store";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-4 rounded-2xl border bg-card p-5"><h2 className="text-lg font-semibold">{title}</h2>{children}</div>;
}

export default function Page() {
  const app = useApp();
  const s = app.settings;
  const setS = (p: Partial<Settings>) => app.set((st) => ({ settings: { ...st.settings, ...p } }));
  const [profile, setProfile] = useState({ name: app.user?.name ?? "", email: app.user?.email ?? "", phone: app.user?.phone ?? "" });
  const [nv, setNv] = useState({ nickname: "", make: "", model: "", year: 2024, batteryKwh: 60, efficiency: 3.5, connector: "CCS" as Connector });

  const addVehicle = () => {
    if (!nv.make || !nv.model) { toast.error("Enter make and model"); return; }
    const v: Vehicle = { ...nv, id: `v${Date.now()}`, nickname: nv.nickname || `${nv.make} ${nv.model}` };
    app.set((st) => ({ vehicles: [...st.vehicles, v] }));
    setNv({ ...nv, nickname: "", make: "", model: "" });
    toast.success("Vehicle added");
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your profile, vehicles and preferences." />
      <Section className="grid max-w-4xl gap-6">
        <Card title="Profile">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name"><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
          </div>
          <Button onClick={() => { app.set({ user: { ...profile, purpose: app.user?.purpose ?? "both" } }); toast.success("Profile saved"); }}>Save profile</Button>
        </Card>

        <Card title="My vehicles">
          {app.vehicles.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div><p className="font-semibold">{v.nickname} {v.id === app.defaultVehicleId && <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">Default</span>}</p>
                <p className="text-sm text-muted-foreground">{v.year} {v.make} {v.model} · {v.batteryKwh} kWh · {v.efficiency} mi/kWh · {v.connector}</p></div>
              <div className="flex gap-2">
                {v.id !== app.defaultVehicleId && <Button size="sm" variant="outline" onClick={() => app.set({ defaultVehicleId: v.id })}>Make default</Button>}
                <Button size="icon" variant="ghost" aria-label="Remove" disabled={app.vehicles.length <= 1} onClick={() => app.set((st) => ({ vehicles: st.vehicles.filter((x) => x.id !== v.id), defaultVehicleId: st.defaultVehicleId === v.id ? st.vehicles.find((x) => x.id !== v.id)!.id : st.defaultVehicleId }))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
          <div className="grid gap-3 border-t pt-4 sm:grid-cols-4">
            <Field label="Nickname"><Input value={nv.nickname} onChange={(e) => setNv({ ...nv, nickname: e.target.value })} /></Field>
            <Field label="Make"><Input value={nv.make} onChange={(e) => setNv({ ...nv, make: e.target.value })} /></Field>
            <Field label="Model"><Input value={nv.model} onChange={(e) => setNv({ ...nv, model: e.target.value })} /></Field>
            <Field label="Year"><Input type="number" value={nv.year} onChange={(e) => setNv({ ...nv, year: +e.target.value })} /></Field>
            <Field label="Battery (kWh)"><Input type="number" value={nv.batteryKwh} onChange={(e) => setNv({ ...nv, batteryKwh: +e.target.value })} /></Field>
            <Field label="Efficiency (mi/kWh)"><Input type="number" step="0.1" value={nv.efficiency} onChange={(e) => setNv({ ...nv, efficiency: +e.target.value })} /></Field>
            <Field label="Connector"><NativeSelect value={nv.connector} onChange={(e) => setNv({ ...nv, connector: e.target.value as Connector })}>{CONNECTORS.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field>
            <div className="flex items-end"><Button className="w-full" onClick={addVehicle}>Add vehicle</Button></div>
          </div>
        </Card>

        <Card title="Charging preferences">
          <p className="text-sm font-medium">Preferred connectors</p>
          <div className="flex flex-wrap gap-2">
            {CONNECTORS.map((c) => (
              <button key={c} onClick={() => setS({ connectors: s.connectors.includes(c) ? s.connectors.filter((x) => x !== c) : [...s.connectors, c] })} className={`rounded-full border px-3 py-1 text-sm ${s.connectors.includes(c) ? "border-primary bg-accent text-accent-foreground" : ""}`}>{c}</button>
            ))}
          </div>
          <Field label={`Default search radius: ${s.maxDistance} mi`}><Slider min={1} max={30} value={[s.maxDistance]} onValueChange={([v]) => setS({ maxDistance: v ?? 15 })} /></Field>
          <Field label={`Default host margin: ${s.defaultMargin}%`}><Slider min={0} max={100} step={5} value={[s.defaultMargin]} onValueChange={([v]) => setS({ defaultMargin: v ?? 40 })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Units"><NativeSelect value={s.units} onChange={(e) => setS({ units: e.target.value as "mi" | "km" })}><option value="mi">Miles</option><option value="km">Kilometers</option></NativeSelect></Field>
            <Field label="Theme"><NativeSelect value={s.theme} onChange={(e) => setS({ theme: e.target.value as "light" | "dark" })}><option value="light">Light</option><option value="dark">Dark</option></NativeSelect></Field>
          </div>
        </Card>

        <Card title="Notifications">
          {([["notifyEmail", "Email notifications"], ["notifyPush", "Push notifications"], ["notifyBookings", "Booking updates & reminders"]] as const).map(([k, label]) => (
            <label key={k} className="flex items-center justify-between"><span className="text-sm">{label}</span><Switch checked={s[k]} onCheckedChange={(v) => setS({ [k]: v })} /></label>
          ))}
        </Card>

        <Card title="Demo data">
          <p className="text-sm text-muted-foreground">Everything is stored in this browser only. Reset to restore the sample data.</p>
          <Button variant="destructive" onClick={() => { app.reset(); toast("Demo data reset"); }}>Reset demo data</Button>
        </Card>
      </Section>
    </div>
  );
}
