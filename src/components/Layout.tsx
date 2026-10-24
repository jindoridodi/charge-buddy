"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, Settings, User, X, Zap, LayoutDashboard, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApp } from "@/lib/store";
import { toast } from "sonner";
import { getBrowserSupabase } from "@/lib/supabase/client";

const NAV = [
  { to: "/chargers", label: "Find Chargers" },
  { to: "/route-planner", label: "Plan a Route" },
  { to: "/list-charger", label: "List Your Charger" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/about", label: "How It Works" },
] as const;

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-glow">
        <Zap className="h-4 w-4" fill="currentColor" />
      </span>
      Charge Buddy
    </Link>
  );
}

export function SiteHeader() {
  const { user, role, set } = useApp();
  const [open, setOpen] = useState(false);
  const navigate = useRouter();
  const pathname = usePathname();

  const logout = async () => {
    try { await getBrowserSupabase().auth.signOut(); } catch { /* local state is still cleared */ }
    set({ user: null });
    toast.success("Signed out");
    navigate.push("/");
  };

  return (
    <header className="sticky top-0 z-[1000] border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              href={n.to}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground ${pathname === n.to || pathname.startsWith(`${n.to}/`) ? "text-foreground bg-muted" : "text-muted-foreground"}`}
              aria-current={pathname === n.to ? "page" : undefined}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border p-1 pr-3 text-sm font-medium hover:bg-muted">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden sm:inline">{user.name.split(" ")[0]}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[1100] w-56">
                <DropdownMenuLabel>
                  {user.name}
                  <p className="text-xs font-normal text-muted-foreground">Viewing as {role}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate.push("/dashboard")}>
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const next = role === "driver" ? "host" : "driver";
                    set({ role: next });
                    toast(`Switched to ${next} mode`);
                    navigate.push("/dashboard");
                  }}
                >
                  <Repeat className="h-4 w-4" /> Switch to {role === "driver" ? "Host" : "Driver"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate.push("/settings")}>
                  <Settings className="h-4 w-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="h-4 w-4" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/auth">
                <User className="h-4 w-4" /> Login / Sign Up
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      {open && (
        <nav className="border-t bg-background px-4 py-3 lg:hidden">
          {NAV.map((n) => (
            <Link key={n.to} href={n.to} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted">
              {n.label}
            </Link>
          ))}
          {!user && (
            <Link href="/auth" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2.5 text-sm font-semibold text-primary">
              Login / Sign Up
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t bg-card">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm text-muted-foreground">Peer-to-peer EV charging. Charge closer, pay less, earn more.</p>
        </div>
        {([
          { h: "Drivers", l: [["/chargers", "Find Chargers"], ["/route-planner", "Plan a Route"], ["/compare", "Compare Chargers"]] },
          { h: "Hosts", l: [["/list-charger", "List Your Charger"], ["/dashboard", "Host Dashboard"]] },
          { h: "Company", l: [["/about", "About & FAQ"], ["/settings", "Settings"]] },
        ] as const).map((c) => (
          <div key={c.h}>
            <h4 className="mb-3 text-sm font-semibold">{c.h}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {c.l.map(([to, label]) => (
                <li key={to}>
                  <Link href={to} className="hover:text-foreground">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t py-5 text-center text-xs text-muted-foreground">
        © 2026 Charge Buddy · Demo experience — all data, bookings and payments are simulated.
      </div>
    </footer>
  );
}
