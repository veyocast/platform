import { describe, expect, it } from "vitest";
import { parseSourceSelection, sourceSelectionHref, sourceOverviewErrorCopy, sourceOverviewHealth, sourceOverviewLedHealth, sourceOverviewSportlinkHealth, worstSourceOverviewHealth, type SourceOverviewRow } from "./sites-sources-model";
const now = Date.parse("2026-10-11T14:00:00Z");
const source: SourceOverviewRow = { id: "stored-source", name: "Actuele feed", kind: "rss", status: "active", provider_status: "ready", last_successful_sync_at: new Date(now - 60_000).toISOString(), last_error_code: null, refreshMinutes: 5 };
describe("Source dialog identities are real resources rather than provider labels", () => {
  const id = "23400000-0000-4000-8000-000000000001";
  it("round trips every provider without inventing a resource for creation", () => {
    for (const provider of ["sportlink", "rss", "twelve", "led", "youtube"] as const) {
      const selection = { mode: "detail" as const, provider, id };
      const params = Object.fromEntries(new URL(sourceSelectionHref(selection), "https://control.example").searchParams);
      expect(parseSourceSelection(params)).toEqual(selection);
      expect(parseSourceSelection({ connect: provider })).toEqual({ mode: "create", provider });
    }
  });
  it("rejects labels, extra segments, unsupported providers and malformed UUIDs", () => {
    for (const value of ["sportlink", "led:led", `unknown:${id}`, `rss:${id}:extra`, `rss:${id}/settings`, "rss:123"]) expect(parseSourceSelection({ source: value })).toBeNull();
    expect(parseSourceSelection({ source: "bad", connect: "rss" })).toBeNull();
    expect(parseSourceSelection({ connect: "not-a-provider" })).toBeNull();
    expect(parseSourceSelection({})).toBeNull();
  });
});
describe("Bronoverzicht behoudt recente fouten en actuele leases", () => {
  it("laat de laatste datasetfout vóór oude success zien en bewaart paused prioriteit", () => {
    const policies = [{ enabled: true, frequency: "five_minutes", last_success_at: new Date(now - 60_000).toISOString(), last_run_status: "failed", last_error_code: "SPORTLINK_SYNC_COMPLETE_57014" }];
    expect(sourceOverviewSportlinkHealth({ status: "active", last_error_code: null }, policies, false, now)).toMatchObject({ label: "Aandacht nodig", tone: "critical" });
    expect(sourceOverviewSportlinkHealth({ status: "paused", last_error_code: null }, policies, false, now)).toMatchObject({ label: "Gepauzeerd", tone: "neutral" });
    expect(sourceOverviewSportlinkHealth({ status: "active", last_error_code: null }, [{ ...policies[0]!, last_run_status: "success", last_error_code: null, last_success_at: new Date(now - 600_000).toISOString() }], false, now)).toMatchObject({ label: "Gegevens verouderd", tone: "warning" });
  });
  it("toont een verlopen LED-workerlease ook wanneer de bewaarde status verbonden is", () => {
    expect(sourceOverviewLedHealth([{ status: "active", health_status: "connected", last_connected_at: new Date(now - 120_000).toISOString(), last_source_message_at: new Date(now - 60_000).toISOString(), lease_expires_at: new Date(now - 1).toISOString() }], now)).toMatchObject({ label: "Verbinding verlopen", tone: "warning" });
    expect(worstSourceOverviewHealth([{ label: "Verbonden", tone: "success" }, { label: "Verbindingsfout", tone: "critical" }])).toMatchObject({ label: "Verbindingsfout" });
  });
  it("gebruikt de echte RSS-refreshfrequentie en doet geen automatische syncclaim voor producten", () => {
    expect(sourceOverviewHealth(source, now)).toMatchObject({ label: "Gereed" });
    expect(sourceOverviewHealth({ ...source, last_successful_sync_at: new Date(now - 600_000).toISOString() }, now)).toMatchObject({ label: "Gegevens verouderd" });
    expect(sourceOverviewHealth({ ...source, last_error_code: "rss_fetch_unavailable" }, now)).toMatchObject({ tone: "critical" });
    expect(sourceOverviewHealth({ ...source, kind: "twelve_excel", last_successful_sync_at: null }, now)).toMatchObject({ label: "Excel-import" });
    expect(sourceOverviewHealth({ ...source, kind: "manual_products", last_successful_sync_at: null }, now)).toMatchObject({ label: "Handmatig beheer" });
  });
  it("geeft ontbrekende status en onveilige codes geen vals succes of providerdetails", () => {
    expect(sourceOverviewSportlinkHealth({ status: "active", last_error_code: null }, [], true, now)).toMatchObject({ label: "Status onbekend" });
    expect(worstSourceOverviewHealth([])).toMatchObject({ label: "Nog niet ingesteld" });
    expect(sourceOverviewErrorCopy("SECRET_raw_provider_message")).not.toContain("SECRET");
    expect(sourceOverviewErrorCopy("rss_fetch_unavailable")).toContain("Probeer synchroniseren opnieuw");
  });
});
