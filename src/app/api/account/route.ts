import { z } from "zod";
import { PayloadTooLargeError, requestJson } from "@/lib/server/request-json";
import { requireUser } from "@/lib/supabase/server";

const connector = z.enum(["J1772", "CCS", "NACS", "CHAdeMO"]);
const schema = z.object({
  favorites: z.array(z.string().min(1).max(100)).max(100),
  vehicles: z.array(z.object({ id: z.string().uuid(), nickname: z.string().trim().min(1).max(100), make: z.string().trim().min(1).max(100), model: z.string().trim().min(1).max(100), year: z.number().int().min(1886).max(2100), batteryKwh: z.number().finite().positive(), efficiency: z.number().finite().positive(), connector })).max(20),
  defaultVehicleId: z.string().uuid().nullable(),
  settings: z.object({ connectors: z.array(connector).max(4), maxDistance: z.number().finite().min(1).max(30), units: z.enum(["mi", "km"]), notifyEmail: z.boolean(), notifyPush: z.boolean(), notifyBookings: z.boolean(), defaultMargin: z.number().finite().min(0).max(100), theme: z.enum(["light", "dark"]) }),
}).superRefine((value, context) => {
  if (value.defaultVehicleId && !value.vehicles.some((vehicle) => vehicle.id === value.defaultVehicleId)) context.addIssue({ code: z.ZodIssueCode.custom, message: "Default vehicle must belong to this account", path: ["defaultVehicleId"] });
});

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireUser(request);
    if (!user) return Response.json({ error: "Sign in to access account data", code: "UNAUTHENTICATED" }, { status: 401 });
    const [preferences, vehicles, favorites] = await Promise.all([
      supabase.from("account_preferences").select("default_vehicle_id, connectors, max_distance, units, notify_email, notify_push, notify_bookings, default_margin, theme").maybeSingle(),
      supabase.from("account_vehicles").select("id, nickname, make, model, year, battery_kwh, efficiency, connector").order("nickname"),
      supabase.from("account_favorites").select("charger_id"),
    ]);
    if (preferences.error || vehicles.error || favorites.error) throw preferences.error ?? vehicles.error ?? favorites.error;
    return Response.json({
      favorites: favorites.data.map((favorite) => favorite.charger_id),
      vehicles: vehicles.data.map((vehicle) => ({ id: vehicle.id, nickname: vehicle.nickname, make: vehicle.make, model: vehicle.model, year: vehicle.year, batteryKwh: Number(vehicle.battery_kwh), efficiency: Number(vehicle.efficiency), connector: vehicle.connector })),
      defaultVehicleId: preferences.data?.default_vehicle_id ?? null,
      settings: preferences.data && { connectors: preferences.data.connectors, maxDistance: Number(preferences.data.max_distance), units: preferences.data.units, notifyEmail: preferences.data.notify_email, notifyPush: preferences.data.notify_push, notifyBookings: preferences.data.notify_bookings, defaultMargin: Number(preferences.data.default_margin), theme: preferences.data.theme },
    });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not load account data" }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  try {
    const parsed = schema.safeParse(await requestJson(request));
    if (!parsed.success) return Response.json({ error: "Invalid account data", code: "VALIDATION_ERROR" }, { status: 400 });
    const { supabase, user } = await requireUser(request);
    if (!user) return Response.json({ error: "Sign in to save account data", code: "UNAUTHENTICATED" }, { status: 401 });
    const { favorites, vehicles, defaultVehicleId, settings } = parsed.data;
    const { error } = await supabase.rpc("replace_account_data", {
      p_favorites: favorites,
      p_vehicles: vehicles.map((vehicle) => ({ ...vehicle, battery_kwh: vehicle.batteryKwh, efficiency: vehicle.efficiency })),
      p_default_vehicle_id: defaultVehicleId,
      p_connectors: settings.connectors,
      p_max_distance: settings.maxDistance,
      p_units: settings.units,
      p_notify_email: settings.notifyEmail,
      p_notify_push: settings.notifyPush,
      p_notify_bookings: settings.notifyBookings,
      p_default_margin: settings.defaultMargin,
      p_theme: settings.theme,
    });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof PayloadTooLargeError) return Response.json({ error: error.message, code: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    return Response.json({ error: error instanceof Error ? error.message : "Could not save account data" }, { status: 500 });
  }
}
