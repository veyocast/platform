"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import {
  menuDocumentV2Schema,
  menuStudioCommandSchema,
  type MenuDocumentV2,
  type MenuStudioCommand
} from "@veyocast/contracts";
import { applyMenuStudioCommand } from "@veyocast/domain";

import { requireTenantControlSession } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";

export type MenuStudioActionResult =
  | {
      document: MenuDocumentV2;
      ok: true;
      outcome: "already_applied" | "applied";
      revision: number;
      slideId: string;
    }
  | { code: string; message: string; ok: false };

export async function createMenuStudioDraft(input: {
  dataSourceId: string;
  document: unknown;
  name: string;
  operationId?: string;
  templateVersionId: string;
}): Promise<MenuStudioActionResult> {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const parsed = menuDocumentV2Schema.safeParse(input.document);
  const operationId = input.operationId ?? randomUUID();
  const name = input.name.trim();
  if (
    !parsed.success ||
    !uuidPattern.test(input.dataSourceId) ||
    !uuidPattern.test(input.templateVersionId) ||
    !uuidPattern.test(operationId) ||
    name.length < 2 ||
    name.length > 120
  ) {
    return failure("MENU_DOCUMENT_INVALID", parsed.success
      ? "Controleer de naam, databron en het gekozen template."
      : parsed.error.issues[0]?.message ?? "Het menudocument is ongeldig.");
  }
  const supabase = await createControlSupabaseClient();
  if (!supabase || !session.tenantId) {
    return failure("MENU_STUDIO_UNAVAILABLE", "Menu Studio is momenteel niet beschikbaar.");
  }
  const result = await supabase.rpc("create_menu_studio_draft_v2", {
    p_data_source_id: input.dataSourceId,
    p_document: parsed.data,
    p_name: name,
    p_operation_id: operationId,
    p_selection_mode: "latest",
    p_template_version_id: input.templateVersionId,
    p_tenant_id: session.tenantId
  });
  if (result.error) return rpcFailure(result.error.code, "maken");
  const response = record(result.data);
  const document = menuDocumentV2Schema.safeParse(response?.document);
  const slideId = string(response?.slideId);
  if (!document.success || !slideId || !uuidPattern.test(slideId)) {
    return failure("MENU_STUDIO_RESPONSE_INVALID", "De server gaf geen geldig menudocument terug.");
  }
  revalidatePath("/dashboard/slides");
  return {
    document: document.data,
    ok: true,
    outcome: response?.outcome === "already_applied" ? "already_applied" : "applied",
    revision: document.data.revision,
    slideId
  };
}

export async function saveMenuStudioCommand(input: {
  command: MenuStudioCommand;
  slideId: string;
}): Promise<MenuStudioActionResult> {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const command = menuStudioCommandSchema.safeParse(input.command);
  if (!command.success || !uuidPattern.test(input.slideId)) {
    return failure(
      "MENU_COMMAND_INVALID",
      command.success ? "De gekozen slide is ongeldig." : command.error.issues[0]?.message ?? "Het commando is ongeldig."
    );
  }
  const supabase = await createControlSupabaseClient();
  if (!supabase || !session.tenantId) {
    return failure("MENU_STUDIO_UNAVAILABLE", "Menu Studio is momenteel niet beschikbaar.");
  }
  const current = await supabase
    .from("dynamic_slides")
    .select("configuration_json")
    .eq("tenant_id", session.tenantId)
    .eq("id", input.slideId)
    .neq("status", "archived")
    .maybeSingle();
  if (current.error || !current.data) {
    return failure("MENU_DOCUMENT_NOT_FOUND", "Het menu bestaat niet meer of is niet toegankelijk.");
  }
  const mutation = applyMenuStudioCommand(
    current.data.configuration_json,
    command.data,
    new Date().toISOString()
  );
  if (!mutation.ok) return failure(`MENU_${mutation.code.toUpperCase().replaceAll("-", "_")}`, mutation.message);

  const result = await supabase.rpc("save_menu_studio_document_v2", {
    p_command: command.data.operation,
    p_document: mutation.document,
    p_expected_revision: command.data.baseRevision,
    p_operation_id: command.data.operationId,
    p_slide_id: input.slideId
  });
  if (result.error) return rpcFailure(result.error.code, "opslaan");
  const response = record(result.data);
  const document = menuDocumentV2Schema.safeParse(response?.document);
  if (!document.success) {
    return failure(
      response?.outcome === "already_applied" ? "MENU_OPERATION_STALE" : "MENU_STUDIO_RESPONSE_INVALID",
      response?.outcome === "already_applied"
        ? "Deze bewerking was al verwerkt. Vernieuw het menu om de actuele versie te laden."
        : "De server gaf geen geldig menudocument terug."
    );
  }
  revalidatePath(`/dashboard/slides/menu-studio/${input.slideId}`);
  return {
    document: document.data,
    ok: true,
    outcome: response?.outcome === "already_applied" ? "already_applied" : "applied",
    revision: document.data.revision,
    slideId: input.slideId
  };
}

export async function setMenuStudioOrientation(input: {
  expectedRevision: number;
  operationId?: string;
  orientation: "landscape" | "portrait";
  slideId: string;
  templateVersionId: string;
}): Promise<MenuStudioActionResult> {
  await requireTenantControlSession("tenant.dynamic_slide.write");
  const operationId = input.operationId ?? randomUUID();
  if (
    !uuidPattern.test(input.slideId) ||
    !uuidPattern.test(input.templateVersionId) ||
    !uuidPattern.test(operationId) ||
    !Number.isInteger(input.expectedRevision) ||
    input.expectedRevision < 1 ||
    (input.orientation !== "landscape" && input.orientation !== "portrait")
  ) {
    return failure("MENU_ORIENTATION_INVALID", "De gekozen schermstand is ongeldig.");
  }
  const supabase = await createControlSupabaseClient();
  if (!supabase) {
    return failure("MENU_STUDIO_UNAVAILABLE", "Menu Studio is momenteel niet beschikbaar.");
  }
  const result = await supabase.rpc("set_menu_studio_orientation_v2", {
    p_expected_revision: input.expectedRevision,
    p_operation_id: operationId,
    p_orientation: input.orientation,
    p_slide_id: input.slideId,
    p_template_version_id: input.templateVersionId
  });
  if (result.error) return rpcFailure(result.error.code, "omgezet");
  const response = record(result.data);
  const document = menuDocumentV2Schema.safeParse(response?.document);
  if (!document.success || response?.orientation !== input.orientation) {
    return failure(
      "MENU_STUDIO_RESPONSE_INVALID",
      "De server bevestigde de gekozen schermstand niet. De opgeslagen versie blijft behouden."
    );
  }
  revalidatePath(`/dashboard/slides/menu-studio/${input.slideId}`);
  revalidatePath(`/dashboard/slides/${input.slideId}`);
  revalidatePath("/dashboard/slides");
  return {
    document: document.data,
    ok: true,
    outcome: response?.outcome === "already_applied" ? "already_applied" : "applied",
    revision: document.data.revision,
    slideId: input.slideId
  };
}

export async function publishMenuStudio(input: {
  expectedRevision: number;
  operationId?: string;
  slideId: string;
}): Promise<
  | { ok: true; outcome: "already_applied" | "applied"; revision: number; snapshotId: string | null }
  | { code: string; message: string; ok: false }
> {
  await requireTenantControlSession("tenant.dynamic_slide.write");
  const operationId = input.operationId ?? randomUUID();
  if (
    !uuidPattern.test(input.slideId) ||
    !uuidPattern.test(operationId) ||
    !Number.isInteger(input.expectedRevision) ||
    input.expectedRevision < 1
  ) {
    return failure("MENU_PUBLISH_INVALID", "De publicatieopdracht is ongeldig.");
  }
  const supabase = await createControlSupabaseClient();
  if (!supabase) return failure("MENU_STUDIO_UNAVAILABLE", "Menu Studio is momenteel niet beschikbaar.");
  const result = await supabase.rpc("publish_menu_studio_document_v2", {
    p_expected_revision: input.expectedRevision,
    p_operation_id: operationId,
    p_slide_id: input.slideId
  });
  if (result.error) return rpcFailure(result.error.code, "publiceren");
  const response = record(result.data);
  const revision = number(response?.revision);
  if (!revision) return failure("MENU_STUDIO_RESPONSE_INVALID", "De server bevestigde de publicatie niet.");
  revalidatePath(`/dashboard/slides/menu-studio/${input.slideId}`);
  revalidatePath(`/dashboard/slides/${input.slideId}`);
  revalidatePath("/dashboard/slides");
  return {
    ok: true,
    outcome: response?.outcome === "already_applied" ? "already_applied" : "applied",
    revision,
    snapshotId: string(response?.snapshotId)
  };
}

function rpcFailure(code: string | undefined, action: string) {
  if (code === "40001") {
    return failure("MENU_REVISION_CONFLICT", "Het menu is intussen gewijzigd. Vernieuw de pagina en pas je wijziging opnieuw toe.");
  }
  if (code === "42501") {
    return failure("MENU_FORBIDDEN", "Je hebt geen toestemming voor deze actie of de benodigde Menu Studio-functie staat nog uit.");
  }
  if (code === "23505") {
    return failure("MENU_OPERATION_CONFLICT", "Deze bewerkingssleutel is al voor een andere wijziging gebruikt.");
  }
  if (code === "23514" || code === "22023") {
    return failure("MENU_DOCUMENT_INVALID", "Het menu voldoet niet aan de publicatieregels. Controleer groepen, prijzen en media.");
  }
  console.error(`Menu Studio ${action} mislukt`, { code: code ?? "unknown" });
  return failure("MENU_STUDIO_FAILED", `Het menu kon niet worden ${action}. De laatst opgeslagen versie blijft behouden.`);
}

function failure(code: string, message: string) {
  return { code, message, ok: false as const };
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function string(value: unknown) {
  return typeof value === "string" ? value : null;
}

function number(value: unknown) {
  const candidate = Number(value);
  return Number.isInteger(candidate) && candidate >= 1 ? candidate : null;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
