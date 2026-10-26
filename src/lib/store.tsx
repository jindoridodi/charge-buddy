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
const KEY = "charge-buddy-state-v1";

export function stateForSession(user: User): State {
  return { ...initial, user, role: user.purpose === "host" ? "host" : "driver" };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...initial, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (loaded.current) localStorage.setItem(KEY, JSON.stringify(state));
    document.documentElement.classList.toggle("dark", state.settings.theme === "dark");
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
      reset: () => setState(initial),
      startSession: (user) => setState(stateForSession(user)),
    };
  }, [state]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used within AppProvider");
  return c;
}
