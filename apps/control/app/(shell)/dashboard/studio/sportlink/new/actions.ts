"use server";

import {
  createSportlinkSlideBatchSchema,
  sportlinkSlideBatchMaxDrafts
} from "@veyocast/contracts";

import { requireTenantControlSession } from "../../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../../lib/supabase/server";

export type SportlinkSlideBatchActionResult =
  | {
      batchId: string;
      count: number;
      ok: true;
      slides: Array<{
        blueprintKey: string;
        name: string;
        slideId: string;
        snapshotId: string;
        teamCount: number;
      }>;
    }
  | {
      message: string;
      ok: false;
    };

export async function createSportlinkSlideBatch(
  formData: FormData
): Promise<SportlinkSlideBatchActionResult> {
  const session = await requireTenantControlSession(
    "tenant.dynamic_slide.write"
  );
  const parsedJson = safeJson(String(formData.get("payload") ?? ""));
  const parsed = createSportlinkSlideBatchSchema.safeParse(parsedJson);
  if (!parsed.success) {
    const durationInvalid = parsed.error.issues.some((issue) =>
      issue.path.includes("minutesBefore") ||
      issue.path.includes("minutesAfter")
    );
    const batchTooLarge = parsed.error.issues.some((issue) =>
      issue.path[0] === "drafts" && issue.code === "too_big"
    );
    const matchLocationInvalid = parsed.error.issues.some((issue) =>
      issue.path.includes("matchLocation")
    );
    return {
      message: durationInvalid
        ? "De gekozen periode is niet geldig. Kies een waarde van 0 minuten tot en met 42 dagen en probeer opnieuw."
        : batchTooLarge
          ? "Kies maximaal " + sportlinkSlideBatchMaxDrafts +
            " slides per batch. Er is niets aangemaakt."
          : matchLocationInvalid
            ? "Kies voor iedere clubslide Thuis en uit, Alleen thuis of Alleen uit. Er is niets aangemaakt."
          : "De selectie is niet meer volledig. Kies opnieuw minimaal één team of Alle teams en controleer de competitiecontext.",
      ok: false
    };
  }

  const supabase = await createControlSupabaseClient();
  if (!supabase || !session.tenantId) {
    return {
      message: "De veilige verbinding is niet beschikbaar. Probeer het later opnieuw.",
      ok: false
    };
  }

  const { data, error } = await supabase.rpc(
    "create_sportlink_slide_batch_v4",
    {
      p_data_source_id: parsed.data.dataSourceId,
      p_drafts: parsed.data.drafts,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_tenant_id: session.tenantId
    }
  );
  if (error || !data) {
    console.error("Sportlink batch maken mislukt", {
      code: error?.code ?? "empty_result"
    });
    return {
      message: error?.code === "42501"
        ? "Je hebt geen toestemming om Sportlink-slides te maken."
        : "De batch kon niet veilig worden gemaakt. Er zijn geen gedeeltelijke slides bewaard; probeer het opnieuw.",
      ok: false
    };
  }

  const result = parseBatchResult(data);
  if (!result) {
    console.error("Sportlink batch gaf een ongeldig resultaat", {
      kind: typeof data
    });
    return {
      message: "De batch is verwerkt, maar het resultaat kon niet worden bevestigd. Probeer opnieuw; dezelfde batchsleutel voorkomt dubbele slides.",
      ok: false
    };
  }
  return result;
}

function parseBatchResult(value: unknown): SportlinkSlideBatchActionResult | null {
  if (!isRecord(value) || !validId(value.batchId) || !Array.isArray(value.slides)) {
    return null;
  }
  const slides = value.slides.flatMap((candidate) => {
    if (
      !isRecord(candidate) ||
      !validId(candidate.slideId) ||
      !validId(candidate.snapshotId) ||
      typeof candidate.name !== "string" ||
      typeof candidate.blueprintKey !== "string"
    ) return [];
    return [{
      blueprintKey: candidate.blueprintKey,
      name: candidate.name,
      slideId: candidate.slideId,
      snapshotId: candidate.snapshotId,
      teamCount: typeof candidate.teamCount === "number" &&
        Number.isSafeInteger(candidate.teamCount) &&
        candidate.teamCount >= 0
        ? candidate.teamCount
        : 1
    }];
  });
  if (
    slides.length !== value.slides.length ||
    typeof value.count !== "number" ||
    !Number.isSafeInteger(value.count) ||
    value.count !== slides.length
  ) return null;
  return {
    batchId: value.batchId,
    count: value.count,
    ok: true,
    slides
  };
}

function validId(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
      .test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
