import { z } from "zod";
import { PayloadTooLargeError, requestJson } from "@/lib/server/request-json";
import { requireUser } from "@/lib/supabase/server";
import { vehicleSchema } from "@/lib/vehicle-schema";

const connector = z.enum(["J1772", "CCS", "NACS", "CHAdeMO"]);
const schema = z.object({
  revision: z.number().int().nonnegative(),
  favorites: z.array(z.string().min(1).max(100)).max(100),
  vehicles: z.array(vehicleSchema).max(20),
  defaultVehicleId: z.string().uuid().nullable(),
  settings: z.object({ connectors: z.array(connector).max(4), maxDistance: z.number().finite().min(1).max(30), units: z.enum(["mi", "km"]), notifyEmail: z.boolean(), notifyPush: z.boolean(), notifyBookings: z.boolean(), defaultMargin: z.number().finite().min(0).max(100), theme: z.enum(["light", "dark"]) }),
}).superRefine((value, context) => {
  if (value.defaultVehicleId && !value.vehicles.some((vehicle) => vehicle.id === value.defaultVehicleId)) context.addIssue({ code: z.ZodIssueCode.custom, message: "Default vehicle must belong to this account", path: ["defaultVehicleId"] });
});

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireUser(request);
    if (!user) return Response.json({ error: "Sign in to access account data", code: "UNAUTHENTICATED" }, { status: 401 });
    const { data, error } = await supabase.rpc("read_account_data");
    if (error) throw error;
    return Response.json(data);
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not load account data" }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  try {
    const parsed = schema.safeParse(await requestJson(request));
    if (!parsed.success) return Response.json({ error: "Invalid account data", code: "VALIDATION_ERROR" }, { status: 400 });
    const { supabase, user } = await requireUser(request);
    if (!user) return Response.json({ error: "Sign in to save account data", code: "UNAUTHENTICATED" }, { status: 401 });
    const { revision, favorites, vehicles, defaultVehicleId, settings } = parsed.data;
    const { data, error } = await supabase.rpc("save_account_data", {
      p_revision: revision,
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
    if (!data) return Response.json({ error: "Account data changed in another session", code: "CONFLICT" }, { status: 409 });
    return Response.json({ revision: revision + 1 });
  } catch (error) {
    if (error instanceof PayloadTooLargeError) return Response.json({ error: error.message, code: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    return Response.json({ error: error instanceof Error ? error.message : "Could not save account data" }, { status: 500 });
  }
}
