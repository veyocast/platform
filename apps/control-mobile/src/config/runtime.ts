import Constants from "expo-constants";
import { z } from "zod";

const runtimeSchema = z
  .object({
    controlOrigin: z.string().url(),
    supabaseAnonKey: z.string().min(20),
    supabaseUrl: z.string().url()
  })
  .strict();

export type MobileRuntimeConfig = z.infer<typeof runtimeSchema>;

export function readMobileRuntimeConfig():
  | { config: MobileRuntimeConfig; error: null }
  | { config: null; error: string } {
  const result = runtimeSchema.safeParse({
    controlOrigin:
      Constants.expoConfig?.extra?.controlOrigin ??
      process.env.EXPO_PUBLIC_CONTROL_ORIGIN,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL
  });
  if (result.success) return { config: result.data, error: null };
  return {
    config: null,
    error:
      "De beveiligde appconfiguratie ontbreekt. Installeer een geldige VeyoCast Control-build."
  };
}
