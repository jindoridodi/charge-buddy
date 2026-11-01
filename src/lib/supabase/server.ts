import { createClient } from "@supabase/supabase-js";

function config() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  if (!url || !key) throw new Error("Supabase is not configured");
  return { url, key };
}

export function supabaseForRequest(request: Request) {
  const { url, key } = config();
  const authorization = request.headers.get("authorization") ?? "";
  return createClient(url, key, { global: { headers: authorization ? { Authorization: authorization } : {} } });
}

export function serviceSupabase() {
  const { url } = config();
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for imports");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function requireUser(request: Request) {
  const supabase = supabaseForRequest(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null };
  return { supabase, user };
}
