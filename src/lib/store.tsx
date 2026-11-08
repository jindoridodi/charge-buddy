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
import { toast } from "sonner";
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
  accountReady: boolean;
  set: (patch: Partial<State> | ((s: State) => Partial<State>)) => void;
  allChargers: Charger[];
  getCharger: (id: string) => Charger | undefined;
  defaultVehicle: Vehicle | undefined;
  toggleFavorite: (id: string) => void;
  toggleCompare: (id: string) => void;
  reset: () => void;
  flushAccount: () => Promise<boolean>;
  cancelSignOut: () => void;
  startSession: (user: User) => void;
};

const AppCtx = createContext<Ctx | null>(null);
export function stateForSession(user: User): State {
  return { ...initial, user, role: user.purpose === "host" ? "host" : "driver", favorites: [], vehicles: [], defaultVehicleId: "", reservations: [], listings: [], hostBookings: [], compare: [] };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [accountReady, setAccountReady] = useState(false);
  const hydratedFor = useRef<string | null>(null);
  const loadingFor = useRef<string | null>(null);
  const sessionGeneration = useRef(0);
  const revision = useRef(0);
  const savedSnapshot = useRef("");
  const pendingSave = useRef<Promise<boolean> | null>(null);
  const signingOut = useRef(false);
  const currentState = useRef(state);
  currentState.current = state;

  const snapshot = (s: State) => ({ favorites: s.favorites, vehicles: s.vehicles, defaultVehicleId: s.defaultVehicleId || null, settings: s.settings });

  const userFromSession = (user: { id: string; email?: string; user_metadata: Record<string, unknown> }): User => ({
    id: user.id,
    name: typeof user.user_metadata["full_name"] === "string" ? user.user_metadata["full_name"] : user.email?.split("@")[0] ?? "Member",
    email: user.email ?? "",
    phone: "",
    purpose: user.user_metadata["purpose"] === "host" || user.user_metadata["purpose"] === "both" ? user.user_metadata["purpose"] : "driver",
  });

  const loadAccount = async (user: User, generation: number) => {
    try {
      const { data: { session } } = await getBrowserSupabase().auth.getSession();
      if (!session || session.user.id !== user.id) throw new Error("Session unavailable");
      const account = await loadAccountData(session.access_token);
      if (generation !== sessionGeneration.current) return;
      hydratedFor.current = user.id;
      revision.current = account.revision;
      savedSnapshot.current = JSON.stringify({ favorites: account.favorites, vehicles: account.vehicles, defaultVehicleId: account.defaultVehicleId, settings: account.settings ?? initial.settings });
      setState((current) => current.user?.id !== user.id ? current : {
        ...stateForSession(user),
        favorites: account.favorites,
        vehicles: account.vehicles,
        defaultVehicleId: account.defaultVehicleId ?? "",
        settings: account.settings ?? initial.settings,
      });
    } catch {
      if (generation === sessionGeneration.current) {
        loadingFor.current = null;
        toast.error("Could not load account data.", { action: { label: "Retry", onClick: () => startSession(user) }, duration: Infinity });
      }
    } finally {
      if (generation === sessionGeneration.current && hydratedFor.current === user.id) setAccountReady(true);
    }
  };

  const startSession = (user: User) => {
    if (loadingFor.current === user.id) return;
    const generation = ++sessionGeneration.current;
    pendingSave.current = null;
    hydratedFor.current = null;
    loadingFor.current = user.id;
    setAccountReady(false);
    setState(stateForSession(user));
    void loadAccount(user, generation);
  };

  useEffect(() => {
    try {
      const supabase = getBrowserSupabase();
      const generation = sessionGeneration.current;
      void supabase.auth.getSession().then(({ data: { session } }) => { if (generation !== sessionGeneration.current) return; if (session) startSession(userFromSession(session.user)); else setAccountReady(true); }).catch(() => setAccountReady(true));
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") { signingOut.current = false; sessionGeneration.current++; hydratedFor.current = null; loadingFor.current = null; setAccountReady(true); setState(initial); }
        if (event === "SIGNED_IN" && session) startSession(userFromSession(session.user));
      });
      return () => subscription.unsubscribe();
    } catch { setAccountReady(true); return; }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.settings.theme === "dark");
  }, [state]);

  useEffect(() => {
    const warnUnsaved = (event: BeforeUnloadEvent) => {
      const current = currentState.current;
      if (current.user && hydratedFor.current === current.user.id && JSON.stringify(snapshot(current)) !== savedSnapshot.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warnUnsaved);
    return () => window.removeEventListener("beforeunload", warnUnsaved);
  }, []);

  const flushAccount = () => {
    if (!accountReady) return Promise.resolve(true);
    if (pendingSave.current) return pendingSave.current;
    const generation = sessionGeneration.current;
    const task = (async () => {
      try {
        while (generation === sessionGeneration.current) {
          const current = currentState.current;
          if (!current.user || hydratedFor.current !== current.user.id) return true;
          const account = snapshot(current);
          const serialized = JSON.stringify(account);
          if (serialized === savedSnapshot.current) return true;
          const { data: { session } } = await getBrowserSupabase().auth.getSession();
          if (!session || session.user.id !== current.user.id) throw new Error("Session expired");
          const result = await saveAccount(session.access_token, { ...account, revision: revision.current });
          if (generation !== sessionGeneration.current) return false;
          revision.current = result.revision;
          savedSnapshot.current = serialized;
        }
        return false;
      } catch {
        toast.error("Could not save account changes. Your data may have changed in another session; reload and try again.");
        return false;
      }
    })();
    pendingSave.current = task;
    void task.finally(() => { if (pendingSave.current === task) pendingSave.current = null; });
    return task;
  };

  useEffect(() => {
    if (accountReady && state.user && hydratedFor.current === state.user.id) void flushAccount();
  }, [state, accountReady]);

  const value = useMemo<Ctx>(() => {
    // Public chargers come from the Supabase/NREL catalog. Local state only owns peer listings and UI selections.
    const allChargers = state.listings.filter((l) => !l.disabled);
    const set: Ctx["set"] = (patch) =>
      setState((s) => signingOut.current || (s.user && !accountReady) ? s : ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
    return {
      ...state,
      accountReady,
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
      reset: () => { signingOut.current = false; sessionGeneration.current++; hydratedFor.current = null; loadingFor.current = null; setAccountReady(true); setState(initial); },
      flushAccount: async () => { signingOut.current = true; const saved = await flushAccount(); if (!saved) signingOut.current = false; return saved; },
      cancelSignOut: () => { signingOut.current = false; },
      startSession,
    };
  }, [state, accountReady]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used within AppProvider");
  return c;
}
