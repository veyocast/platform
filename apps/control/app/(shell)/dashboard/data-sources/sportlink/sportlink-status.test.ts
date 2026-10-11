import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  loadLatestSportlinkRuns,
  safeSportlinkErrorCode,
  sportlinkConnectionStatus,
  sportlinkDatasetStatus,
  sportlinkSyncFailureCopy,
  type SportlinkPolicyHealthInput
} from "./sportlink-status";

const now = Date.parse("2026-10-11T10:00:00.000Z");
const activeConnection = { status: "active", last_error_code: null };
const healthyPolicy: SportlinkPolicyHealthInput = {
  enabled: true,
  frequency: "five_minutes",
  last_error_code: null,
  last_run_status: "succeeded",
  last_success_at: "2026-10-11T09:57:00.000Z"
};

type Run = {
  connection_id: string;
  dataset_group: string;
  error_code: string | null;
  id: string;
  started_at: string;
  status: string;
  tenant_id: string;
};

function runClient(rows: Run[], failingGroup?: string) {
  const queries: Array<{
    filters: Record<string, string>;
    limit: number;
    orders: string[];
    table: string;
  }> = [];
  const client = {
    from(table: string) {
      const call = { filters: {} as Record<string, string>, limit: 0, orders: [] as string[], table };
      queries.push(call);
      const query = {
        eq(field: string, value: string) { call.filters[field] = value; return query; },
        limit(value: number) { call.limit = value; return query; },
        order(field: string) { call.orders.push(field); return query; },
        select() { return query; },
        async maybeSingle() {
          if (call.filters.dataset_group === failingGroup) {
            return { data: null, error: { message: "private details must stay private" } };
          }
          const filtered = rows.filter((row) => Object.entries(call.filters)
            .every(([key, value]) => row[key as keyof Run] === value))
            .sort((left, right) => right.started_at.localeCompare(left.started_at) || right.id.localeCompare(left.id));
          return { data: filtered[0] ?? null, error: null };
        }
      };
      return query;
    }
  };
  return { client: client as unknown as Pick<SupabaseClient, "from">, queries };
}

describe("Sportlink observation loading", () => {
  it("retains the daily birthday failure behind more than 100 unrelated match runs", async () => {
    const birthdays: Run = {
      connection_id: "club", dataset_group: "public_people", error_code: "SPORTLINK_BIRTHDAY_NORMALIZATION_EMPTY",
      id: "birthday-failure", started_at: "2026-10-10T09:00:00.000Z", status: "failed", tenant_id: "tenant-a"
    };
    const matches = Array.from({ length: 150 }, (_, index): Run => ({
      ...birthdays, dataset_group: "matches", error_code: null, id: `match-${index}`,
      started_at: "2026-10-11T09:57:00.000Z", status: "succeeded"
    }));
    const { client, queries } = runClient([
      birthdays, ...matches,
      { ...birthdays, tenant_id: "tenant-b", started_at: "2026-10-11T09:59:00.000Z", status: "succeeded" },
      { ...birthdays, connection_id: "other-club", started_at: "2026-10-11T09:59:00.000Z", status: "succeeded" }
    ]);
    const result = await loadLatestSportlinkRuns(client, "tenant-a", "club", ["matches", "public_people", "matches"]);
    expect(result.get("public_people")).toEqual({
      errorCode: "SPORTLINK_BIRTHDAY_NORMALIZATION_EMPTY", status: "failed", unavailable: false
    });
    expect(result.get("matches")?.status).toBe("succeeded");
    expect(queries).toHaveLength(2);
    expect(queries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        filters: { tenant_id: "tenant-a", connection_id: "club", dataset_group: "public_people" },
        limit: 1, orders: ["started_at", "id"], table: "sportlink_sync_runs"
      })
    ]));
  });

  it("keeps a failed status read distinct from a dataset with no observations", async () => {
    const { client } = runClient([], "public_people");
    const result = await loadLatestSportlinkRuns(client, "tenant-a", "club", ["matches", "public_people"]);
    expect(result.get("matches")).toEqual({ errorCode: null, status: null, unavailable: false });
    expect(result.get("public_people")).toEqual({ errorCode: null, status: null, unavailable: true });
  });
});

describe("Sportlink dataset health", () => {
  it("prioritizes paused and failed observations over old success", () => {
    expect(sportlinkDatasetStatus({ ...healthyPolicy, enabled: false }, now))
      .toMatchObject({ kind: "paused", label: "Gepauzeerd", tone: "neutral" });
    expect(sportlinkDatasetStatus({ ...healthyPolicy, last_run_status: "failed" }, now))
      .toMatchObject({ kind: "failed", label: "Mislukt", tone: "critical" });
    expect(sportlinkDatasetStatus({ ...healthyPolicy, last_error_code: "SPORTLINK_SYNC_COMPLETE_57014" }, now).kind)
      .toBe("failed");
  });

  it.each([
    ["five_minutes", 10 * 60_000],
    ["hourly", 2 * 60 * 60_000],
    ["daily", 2 * 24 * 60 * 60_000],
    ["weekly", 14 * 24 * 60 * 60_000],
    ["monthly", 62 * 24 * 60 * 60_000]
  ])("reports stale data after a missed %s observation", (frequency, age) => {
    const policy = { ...healthyPolicy, frequency, last_success_at: new Date(now - age).toISOString() };
    expect(sportlinkDatasetStatus(policy, now)).toMatchObject({ kind: "stale", label: "Verouderd", tone: "warning" });
    expect(sportlinkDatasetStatus(policy, now - 1).kind).toBe("ready");
  });

  it("does not claim readiness for unknown, queued or partial observations", () => {
    expect(sportlinkDatasetStatus({ ...healthyPolicy, run_status_unavailable: true }, now).kind).toBe("unknown");
    expect(sportlinkDatasetStatus({ ...healthyPolicy, last_success_at: "invalid" }, now).kind).toBe("unknown");
    expect(sportlinkDatasetStatus({ ...healthyPolicy, last_run_status: "queued" }, now).kind).toBe("pending");
    expect(sportlinkDatasetStatus({ ...healthyPolicy, last_run_status: "partial" }, now).kind).toBe("partial");
    expect(sportlinkDatasetStatus({ ...healthyPolicy, last_run_status: "running" }, now).kind).toBe("running");
  });
});

describe("Sportlink aggregate health", () => {
  it("cannot show synchronized while a slower dataset failed or went stale", () => {
    expect(sportlinkConnectionStatus(activeConnection, [healthyPolicy, {
      ...healthyPolicy, frequency: "daily", last_run_status: "failed", last_success_at: "2026-09-28T02:55:00.000Z"
    }], now)).toMatchObject({ label: "Aandacht nodig", tone: "critical" });
    expect(sportlinkConnectionStatus(activeConnection, [healthyPolicy, {
      ...healthyPolicy, frequency: "daily", last_success_at: "2026-09-28T02:55:00.000Z"
    }], now)).toMatchObject({ label: "Gegevens verouderd", tone: "warning" });
  });

  it("confirms synchronization only for the enabled healthy policies", () => {
    expect(sportlinkConnectionStatus(activeConnection, [healthyPolicy, { ...healthyPolicy, enabled: false }], now))
      .toMatchObject({ label: "Gesynchroniseerd", tone: "success" });
    expect(sportlinkConnectionStatus(activeConnection, [{ ...healthyPolicy, enabled: false }], now).kind).toBe("paused");
    expect(sportlinkConnectionStatus({ ...activeConnection, last_error_code: "SPORTLINK_SYNC_COMPLETE_57014" }, [healthyPolicy], now).kind)
      .toBe("failed");
    expect(sportlinkConnectionStatus(activeConnection, [healthyPolicy], now, true).kind).toBe("unknown");
    expect(sportlinkConnectionStatus({ ...activeConnection, status: "paused" }, [healthyPolicy], now).kind).toBe("paused");
  });
});

describe("Sportlink recovery messages", () => {
  it("explains cause, preserved content and recovery for the reported timeout", () => {
    const message = sportlinkSyncFailureCopy("SPORTLINK_SYNC_COMPLETE_57014");
    expect(message).toContain("tijdslimiet");
    expect(message).toContain("laatste goede inhoud");
    expect(message).toContain("Start de synchronisatie opnieuw");
  });

  it("shows bounded codes without echoing arbitrary provider details", () => {
    expect(safeSportlinkErrorCode("SPORTLINK_SYNC_COMPLETE_57014")).toBe("SPORTLINK_SYNC_COMPLETE_57014");
    for (const value of ["private-client-id", "SPORTLINK_ERROR\nprivate details", "x".repeat(100), null]) {
      expect(safeSportlinkErrorCode(value)).toBe("SPORTLINK_SYNC_FAILED");
    }
    expect(sportlinkSyncFailureCopy("secret provider response")).not.toContain("secret provider response");
  });
});
