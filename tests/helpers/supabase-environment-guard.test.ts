import { describe, expect, it } from "vitest";

import {
  assertMutatingPlaywrightUsesLocalSupabase,
  enabledMutatingPlaywrightFlags,
  isLocalSupabaseUrl,
  isMutatingPlaywrightRun
} from "./supabase-environment-guard";

describe("mutating Playwright Supabase guard", () => {
  it("weigert muterende suites zonder lokale Supabase-configuratie", () => {
    expect(() => assertMutatingPlaywrightUsesLocalSupabase({
      NEXT_PUBLIC_SUPABASE_URL: "https://production.supabase.co",
      VEYOCAST_LIVE_PILOT: "1"
    })).toThrow(/Muterende Playwright-suite geweigerd/);
    expect(() => assertMutatingPlaywrightUsesLocalSupabase({
      VEYOCAST_LIVE_STUDIO_E2E: "1"
    })).toThrow(/verse lokale Supabase-stack/);
    expect(() => assertMutatingPlaywrightUsesLocalSupabase({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      PLAYWRIGHT_EXTERNAL_SERVERS: "1",
      VEYOCAST_LIVE_MEDIA_E2E: "1"
    })).toThrow(/Externe of vooraf gestarte applicaties/);
  });

  it("accepteert alleen exacte loopback-hostnamen", () => {
    expect(isLocalSupabaseUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalSupabaseUrl("http://localhost:54321")).toBe(true);
    expect(isLocalSupabaseUrl("http://[::1]:54321")).toBe(true);
    expect(isLocalSupabaseUrl("https://localhost.example.com")).toBe(false);
    expect(isLocalSupabaseUrl("not-a-url")).toBe(false);
  });

  it("laat niet-muterende runs en expliciete Atelier-demo's ongemoeid", () => {
    expect(() => assertMutatingPlaywrightUsesLocalSupabase({
      NEXT_PUBLIC_SUPABASE_URL: "https://staging.supabase.co"
    })).not.toThrow();
    expect(enabledMutatingPlaywrightFlags({
      ATELIER_IVORY_DEMO: "1",
      ATELIER_IVORY_EVIDENCE: "1"
    })).toEqual([]);
    expect(enabledMutatingPlaywrightFlags({ S146_VISUAL_EVIDENCE: "1" })).toEqual([
      "S146_VISUAL_EVIDENCE"
    ]);
    expect(isMutatingPlaywrightRun({ VEYOCAST_VISUAL_EVIDENCE: "1" })).toBe(true);
  });
});
