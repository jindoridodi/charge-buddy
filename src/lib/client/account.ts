import type { Vehicle } from "@/lib/data";
import type { Settings } from "@/lib/store";

export type AccountData = { favorites: string[]; vehicles: Vehicle[]; defaultVehicleId: string | null; settings: Settings | null };

export async function loadAccount(accessToken: string) {
  const response = await fetch("/api/account", { headers: { Authorization: `Bearer ${accessToken}` } });
  return response.ok ? response.json() as Promise<AccountData> : null;
}

export async function saveAccount(accessToken: string, account: Omit<AccountData, "settings"> & { settings: Settings }) {
  return fetch("/api/account", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(account),
  });
}
