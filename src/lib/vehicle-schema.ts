import { z } from "zod";

export const vehicleSchema = z.object({
  id: z.string().uuid(),
  nickname: z.string().trim().min(1).max(100),
  make: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  year: z.number().int().min(1886).max(2100),
  batteryKwh: z.number().finite().positive(),
  efficiency: z.number().finite().positive(),
  connector: z.enum(["J1772", "CCS", "NACS", "CHAdeMO"]),
});
