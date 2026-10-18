"use server";

import {
  parseStudioDocument,
  studioDocumentAssetIds,
  type StudioDocument,
} from "@veyocast/studio";
import { revalidatePath } from "next/cache";
import { requireTenantControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

/** Uses the existing tenant writer and its original idempotent receipt. */
export async function createSyncStudioProjectAction(input: {
  document: StudioDocument;
  idempotencyKey: string;
}): Promise<
  | { ok: true; projectId: string }
  | { ok: false; error: string; rejected?: boolean }
> {
  const session = await requireTenantControlSession("tenant.studio.create");
  if (!session.isLive || !session.tenantId || session.tenantStatus !== "active")
    return {
      ok: false,
      rejected: true,
      error:
        "Deze vereniging kan momenteel geen ontwerpen maken. Je keuze blijft hier; controleer je sessie en rechten.",
    };
  let document: StudioDocument;
  try {
    document = parseStudioDocument(input.document);
    if (
      !document.syncPresentation ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        input.idempotencyKey,
      )
    )
      throw Error("Invalid command");
  } catch {
    return {
      ok: false,
      rejected: true,
      error:
        "Het ontwerp voldoet niet aan de veilige invoergrenzen. Kies een template opnieuw.",
    };
  }
  const client = await createControlSupabaseClient();
  if (!client)
    return {
      ok: false,
      error:
        "De beveiligde verbinding ontbreekt. Bevestig dezelfde keuze opnieuw zodra je verbonden bent.",
    };
  const result = await client.rpc("create_studio_project_v1", {
    p_tenant_id: session.tenantId,
    p_document: document,
    p_name: document.syncPresentation!.name.trim(),
    p_orientation: document.artboard.orientation,
    p_project_kind: "design",
    p_referenced_asset_ids: studioDocumentAssetIds(document),
    p_idempotency_key: input.idempotencyKey,
  });
  if (result.error)
    return {
      ok: false,
      rejected: [
        "22023",
        "23514",
        "23503",
        "42501",
        "P0002",
        "55000",
        "23505",
      ].includes(result.error.code),
      error:
        "Het ontwerp kon niet worden bevestigd. Je keuze blijft behouden; controleer je rechten en verbinding en probeer dezelfde keuze opnieuw.",
    };
  const data =
    result.data &&
    typeof result.data === "object" &&
    !Array.isArray(result.data)
      ? (result.data as Record<string, unknown>)
      : null;
  if (typeof data?.projectId !== "string")
    return {
      ok: false,
      error:
        "De server gaf geen volledig ontvangstbewijs. Bevestig dezelfde keuze opnieuw.",
    };
  revalidatePath("/dashboard/studio");
  revalidatePath("/dashboard/content");
  return { ok: true, projectId: data.projectId };
}

type SyncDraftRead =
  | { ok: true; document: StudioDocument; revision: number }
  | { ok: false; error: string };

/** An authenticated current read; command receipts are still recovered by their original writer. */
export async function readSyncStudioDraftAction(input: {
  projectId: string;
}): Promise<SyncDraftRead> {
  const session = await requireTenantControlSession("tenant.studio.read");
  if (!session.isLive || !session.tenantId)
    return {
      ok: false,
      error:
        "De beveiligde sessie ontbreekt. Je invoer blijft hier staan; meld je opnieuw aan.",
    };
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.projectId,
    )
  )
    return {
      ok: false,
      error:
        "Dit ontwerp is niet geldig. Open het opnieuw vanuit de bibliotheek.",
    };
  const client = await createControlSupabaseClient();
  if (!client)
    return {
      ok: false,
      error:
        "De beveiligde gegevensverbinding ontbreekt. Je invoer blijft hier staan; probeer opnieuw.",
    };
  const result = await client
    .from("studio_project_drafts")
    .select("document_json,draft_revision")
    .eq("tenant_id", session.tenantId)
    .eq("project_id", input.projectId)
    .maybeSingle();
  if (result.error || !result.data)
    return {
      ok: false,
      error:
        "De actuele versie kon niet worden gelezen. Je invoer blijft hier staan; open het ontwerp opnieuw vanuit de bibliotheek of probeer opnieuw.",
    };
  try {
    return {
      ok: true,
      document: parseStudioDocument(result.data.document_json),
      revision: result.data.draft_revision,
    };
  } catch {
    return {
      ok: false,
      error:
        "De opgeslagen versie kan hier niet veilig worden geopend. Je invoer blijft hier staan; herlaad de werkplek.",
    };
  }
}
