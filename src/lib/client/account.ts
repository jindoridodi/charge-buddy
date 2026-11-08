import type { Vehicle } from "@/lib/data";
import type { Settings } from "@/lib/store";

export type AccountData = { revision: number; favorites: string[]; vehicles: Vehicle[]; defaultVehicleId: string | null; settings: Settings | null };

export async function loadAccount(accessToken: string) {
  const response = await fetch("/api/account", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("Could not load account data");
  return response.json() as Promise<AccountData>;
}

export async function saveAccount(accessToken: string, account: Omit<AccountData, "settings"> & { settings: Settings }) {
  const response = await fetch("/api/account", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(account),
  });
  if (!response.ok) throw new Error("Could not save account data");
  return response.json() as Promise<{ revision: number }>;
}
