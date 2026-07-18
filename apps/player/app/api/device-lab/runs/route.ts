import { NextResponse, type NextRequest } from "next/server";

import {
  deviceLabCookieName,
  isValidDeviceLabSession
} from "../../../_lib/device-lab-auth";
import {
  createPlayerAdminClient,
  isLivePlayerConfigured
} from "../../../_lib/player-supabase";

const maxReportBytes = 250_000;

export async function POST(request: NextRequest) {
  if (!isValidDeviceLabSession(request.cookies.get(deviceLabCookieName)?.value)) {
    return noStore({ error: "Diagnosesessie verlopen." }, 401);
  }

  const raw = await request.json().catch(() => null);
  if (!isObject(raw)) return noStore({ error: "Ongeldig testrapport." }, 400);

  const report = redactReport(raw);
  if (!isObject(report)) return noStore({ error: "Ongeldig testrapport." }, 400);
  const serialized = JSON.stringify(report);
  const runId = safeText(report.runId, 80);
  const capturedAt = safeText(report.capturedAt, 40);
  if (!runId || !capturedAt || new TextEncoder().encode(serialized).byteLength > maxReportBytes) {
    return noStore({ error: "Testrapport is incompleet of te groot." }, 400);
  }

  if (!isLivePlayerConfigured()) {
    return noStore({ centrallyStored: false, runId }, 202);
  }

  try {
    const admin = createPlayerAdminClient();
    const device = isObject(report.device) ? report.device : {};
    const { error } = await admin.from("player_device_lab_runs").insert({
      app_version: safeText(report.appVersion, 80) || "unknown",
      captured_at: capturedAt,
      deployment_sha: safeText(report.deploymentSha, 120) || "unknown",
      detected_platform: safeText(device.platform, 200),
      firmware_version: safeText(report.firmware, 160),
      lg_model: safeText(report.lgModel, 160),
      report,
      run_id: runId
    });

    if (error) {
      console.error("Device Lab-run centraal opslaan mislukt", error.code);
      return noStore({ centrallyStored: false, runId }, 503);
    }
    return noStore({ centrallyStored: true, runId }, 201);
  } catch (error) {
    console.error("Device Lab-runopslag niet beschikbaar", error instanceof Error ? error.name : "unknown");
    return noStore({ centrallyStored: false, runId }, 503);
  }
}

function redactReport(value: unknown, key = ""): unknown {
  if (/token|authorization|signed.?url|cookie|secret/i.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.slice(0, 500).map((item) => redactReport(item));
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 300)
        .map(([entryKey, entryValue]) => [entryKey, redactReport(entryValue, entryKey)])
    );
  }
  if (typeof value === "string") return value.slice(0, 2_000);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  return null;
}

function safeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function noStore(body: object, status: number) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    status
  });
}
