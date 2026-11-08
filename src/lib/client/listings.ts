import { getBrowserSupabase } from "@/lib/supabase/client";

export interface PeerListing {
  id: string; name: string; address: string; area: string; connector: string; power_kw: number; price: number; published: boolean;
}

export async function listingsRequest(method: "GET" | "POST" | "PATCH", listing?: Partial<PeerListing>) {
  const { data: { session } } = await getBrowserSupabase().auth.getSession();
  if (!session) throw new Error("Sign in to manage listings.");
  const response = await fetch("/api/listings", { method, headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, ...(listing ? { body: JSON.stringify(listing) } : {}) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Could not manage listings.");
  return body as { listing: PeerListing; listings: PeerListing[] };
}
