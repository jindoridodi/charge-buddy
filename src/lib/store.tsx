"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DEFAULT_VEHICLES,
  MOCK_CHARGERS,
  MOCK_HOST_BOOKINGS,
  MOCK_RESERVATIONS,
  MY_LISTINGS,
  type Charger,
  type HostBooking,
  type Reservation,
  type Vehicle,
} from "./data";
import { getBrowserSupabase } from "./supabase/client";
import { loadAccount as loadAccountData, saveAccount } from "./client/account";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  purpose: "driver" | "host" | "both";
}

export interface Settings {
  connectors: string[];
  maxDistance: number;
  units: "mi" | "km";
  notifyEmail: boolean;
  notifyPush: boolean;
  notifyBookings: boolean;
  defaultMargin: number;
  theme: "light" | "dark";
}

interface State {
  user: User | null;
  role: "driver" | "host";
  favorites: string[];
  vehicles: Vehicle[];
  defaultVehicleId: string;
  reservations: Reservation[];
  listings: Charger[];
  hostBookings: HostBooking[];
  compare: string[];
  settings: Settings;
}

const initial: State = {
  user: null,
  role: "driver",
  favorites: [],
  vehicles: DEFAULT_VEHICLES,
  defaultVehicleId: "v1",
  reservations: MOCK_RESERVATIONS,
  listings: MY_LISTINGS,
  hostBookings: MOCK_HOST_BOOKINGS,
  compare: [],
  settings: {
    connectors: [],
    maxDistance: 15,
    units: "mi",
    notifyEmail: true,
    notifyPush: true,
    notifyBookings: true,
    defaultMargin: 40,
    theme: "light",
  },
};

type Ctx = State & {
  set: (patch: Partial<State> | ((s: State) => Partial<State>)) => void;
  allChargers: Charger[];
  getCharger: (id: string) => Charger | undefined;
  defaultVehicle: Vehicle | undefined;
  toggleFavorite: (id: string) => void;
  toggleCompare: (id: string) => void;
  reset: () => void;
  startSession: (user: User) => void;
};

const AppCtx = createContext<Ctx | null>(null);
export function stateForSession(user: User): State {
  return { ...initial, user, role: user.purpose === "host" ? "host" : "driver", favorites: [], vehicles: [], defaultVehicleId: "", reservations: [], listings: [], hostBookings: [], compare: [] };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const hydratedFor = useRef<string | null>(null);

  const userFromSession = (user: { id: string; email?: string; user_metadata: Record<string, unknown> }): User => ({
    id: user.id,
    name: typeof user.user_metadata["full_name"] === "string" ? user.user_metadata["full_name"] : user.email?.split("@")[0] ?? "Member",
    email: user.email ?? "",
    phone: "",
    purpose: user.user_metadata["purpose"] === "host" || user.user_metadata["purpose"] === "both" ? user.user_metadata["purpose"] : "driver",
  });

  const loadAccount = async (user: User) => {
    try {
      const { data: { session } } = await getBrowserSupabase().auth.getSession();
      if (!session || session.user.id !== user.id) return;
      const account = await loadAccountData(session.access_token);
      if (!account) return;
      setState((current) => current.user?.id !== user.id ? current : {
        ...stateForSession(user),
        favorites: account.favorites,
        vehicles: account.vehicles,
        defaultVehicleId: account.defaultVehicleId ?? "",
        settings: account.settings ?? initial.settings,
      });
    } catch {
      // Keeping an empty account state is safer than retaining another Account's data.
    } finally {
      hydratedFor.current = user.id;
    }
  };

  const startSession = (user: User) => {
    hydratedFor.current = null;
    setState(stateForSession(user));
    void loadAccount(user);
  };

  useEffect(() => {
    try {
      const supabase = getBrowserSupabase();
      void supabase.auth.getSession().then(({ data: { session } }) => { if (session) startSession(userFromSession(session.user)); });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") { hydratedFor.current = null; setState(initial); }
        if (event === "SIGNED_IN" && session) startSession(userFromSession(session.user));
      });
      return () => subscription.unsubscribe();
    } catch { return; }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.settings.theme === "dark");
  }, [state]);

  useEffect(() => {
    if (!state.user || hydratedFor.current !== state.user.id) return;
    const timer = window.setTimeout(async () => {
      try {
        const { data: { session } } = await getBrowserSupabase().auth.getSession();
        if (!session || session.user.id !== state.user?.id) return;
        await saveAccount(session.access_token, { favorites: state.favorites, vehicles: state.vehicles, defaultVehicleId: state.defaultVehicleId || null, settings: state.settings });
      } catch { /* Saving will retry after the next account change. */ }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [state]);

  const value = useMemo<Ctx>(() => {
    // Public chargers come from the Supabase/NREL catalog. Local state only owns peer listings and UI selections.
    const allChargers = state.listings.filter((l) => !l.disabled);
    const set: Ctx["set"] = (patch) =>
      setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
    return {
      ...state,
      set,
      allChargers,
      getCharger: (id) => state.listings.find((c) => c.id === id) ?? MOCK_CHARGERS.find((c) => c.id === id),
      defaultVehicle: state.vehicles.find((v) => v.id === state.defaultVehicleId) ?? state.vehicles[0],
      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id) ? s.favorites.filter((f) => f !== id) : [...s.favorites, id],
        })),
      toggleCompare: (id) =>
        set((s) => ({
          compare: s.compare.includes(id)
            ? s.compare.filter((f) => f !== id)
            : s.compare.length >= 4
              ? s.compare
              : [...s.compare, id],
        })),
      reset: () => { hydratedFor.current = null; setState(initial); },
      startSession,
    };
  }, [state]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used within AppProvider");
  return c;
}
