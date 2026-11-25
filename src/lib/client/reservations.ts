import { getBrowserSupabase } from "@/lib/supabase/client";

export interface SavedReservation {
  id: string; listing_id: string; driver_id: string; host_id: string; charger_name: string; area: string; connector: string;
  starts_at: string; ends_at: string; requested_kwh: number; price_per_kwh: number; estimated_total: number;
  status: "confirmed" | "cancelled"; created_at: string;
}

export async function reservationsRequest(method: "GET" | "POST" | "PATCH", body?: object) {
  const { data: { session } } = await getBrowserSupabase().auth.getSession();
  if (!session) throw new Error("Sign in to reserve a charger.");
  const response = await fetch("/api/reservations", { method, headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Could not load reservations.");
  return data as { reservation: SavedReservation; reservations: SavedReservation[] };
}
