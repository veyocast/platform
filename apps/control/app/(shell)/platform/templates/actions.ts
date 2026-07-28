"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { dynamicTemplateManifestSchema } from "@veyocast/contracts";
import {
  DynamicTemplateError,
  renderDynamicTemplate
} from "@veyocast/integrations";

import { requireControlCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export async function createDynamicTemplate(formData: FormData) {
  await requireControlCapability("platform.dynamic_template.write");
  const parsed = parseTemplateForm(formData);
  if (!parsed.ok) redirect(`/platform/templates/new?fout=${encodeURIComponent(parsed.message)}`);
  const supabase = await createControlSupabaseClient();
  if (!supabase) redirect("/platform/templates/new?fout=De+beveiligde+platformsessie+ontbreekt.");
  const { data, error } = await supabase.rpc("create_dynamic_template_v1", {
    p_css: parsed.value.css,
    p_description: parsed.value.description,
    p_manifest_json: parsed.value.manifest,
    p_markup: parsed.value.markup,
    p_name: parsed.value.name,
    p_orientation: parsed.value.orientation,
    p_sample_data_json: parsed.value.sample,
    p_slide_type: parsed.value.slideType,
    p_slug: parsed.value.slug
  });
  const templateId = isRecord(data) && typeof data.templateId === "string"
    ? data.templateId
    : null;
  if (error || !templateId) {
    redirect("/platform/templates/new?fout=Het+templateconcept+kon+niet+worden+gemaakt.+Controleer+of+de+slug+uniek+is.");
  }
  revalidatePath("/platform/templates");
  redirect(`/platform/templates/${templateId}?succes=Templateconcept+is+opgeslagen.`);
}

export async function updateDynamicTemplate(formData: FormData) {
  await requireControlCapability("platform.dynamic_template.write");
  const templateId = String(formData.get("templateId") ?? "");
  const versionId = String(formData.get("versionId") ?? "");
  const revision = Number(formData.get("revision"));
  const parsed = parseTemplateForm(formData);
  if (
    !parsed.ok ||
    !uuidPattern.test(templateId) ||
    !uuidPattern.test(versionId) ||
    !Number.isSafeInteger(revision)
  ) {
    const message = parsed.ok ? "De templateversie is ongeldig." : parsed.message;
    redirect(`/platform/templates/${templateId}?fout=${encodeURIComponent(message)}`);
  }
  const supabase = await createControlSupabaseClient();
  if (!supabase) redirect(`/platform/templates/${templateId}?fout=De+beveiligde+platformsessie+ontbreekt.`);
  const { error } = await supabase.rpc("update_dynamic_template_draft_v1", {
    p_css: parsed.value.css,
    p_description: parsed.value.description,
    p_expected_revision: revision,
    p_manifest_json: parsed.value.manifest,
    p_markup: parsed.value.markup,
    p_name: parsed.value.name,
    p_sample_data_json: parsed.value.sample,
    p_version_id: versionId
  });
  if (error) {
    redirect(`/platform/templates/${templateId}?fout=Het+concept+is+intussen+gewijzigd+of+kon+niet+veilig+worden+opgeslagen.`);
  }
  revalidatePath(`/platform/templates/${templateId}`);
  redirect(`/platform/templates/${templateId}?succes=Templateconcept+en+preview+zijn+bijgewerkt.`);
}

export async function createTemplateVersion(formData: FormData) {
  await requireControlCapability("platform.dynamic_template.write");
  const templateId = String(formData.get("templateId") ?? "");
  const supabase = await createControlSupabaseClient();
  if (!supabase || !uuidPattern.test(templateId)) redirect("/platform/templates?fout=Ongeldig+template.");
  const { error } = await supabase.rpc("create_dynamic_template_version_v1", {
    p_template_id: templateId
  });
  if (error) redirect(`/platform/templates/${templateId}?fout=Er+bestaat+al+een+conceptversie.`);
  revalidatePath(`/platform/templates/${templateId}`);
  redirect(`/platform/templates/${templateId}?succes=Nieuwe+conceptversie+is+gemaakt.`);
}

export async function publishTemplateVersion(formData: FormData) {
  await requireControlCapability("platform.dynamic_template.publish", {
    aal2: true,
    returnTo: `/platform/templates/${String(formData.get("templateId") ?? "")}`
  });
  const templateId = String(formData.get("templateId") ?? "");
  const versionId = String(formData.get("versionId") ?? "");
  const supabase = await createControlSupabaseClient();
  if (!supabase || !uuidPattern.test(templateId) || !uuidPattern.test(versionId)) {
    redirect("/platform/templates?fout=Ongeldige+templateversie.");
  }
  const { error } = await supabase.rpc("publish_dynamic_template_version_v1", {
    p_version_id: versionId
  });
  if (error) redirect(`/platform/templates/${templateId}?fout=Publiceren+vereist+een+geldig+concept+en+actieve+MFA-sessie.`);
  revalidatePath("/platform/templates");
  redirect(`/platform/templates/${templateId}?succes=Immutable+templateversie+is+gepubliceerd.`);
}

export async function withdrawTemplate(formData: FormData) {
  await requireControlCapability("platform.dynamic_template.publish", {
    aal2: true,
    returnTo: `/platform/templates/${String(formData.get("templateId") ?? "")}`
  });
  const templateId = String(formData.get("templateId") ?? "");
  const supabase = await createControlSupabaseClient();
  if (!supabase || !uuidPattern.test(templateId)) redirect("/platform/templates?fout=Ongeldig+template.");
  const { error } = await supabase.rpc("withdraw_dynamic_template_v1", {
    p_template_id: templateId
  });
  if (error) redirect(`/platform/templates/${templateId}?fout=Het+template+kon+niet+worden+ingetrokken.`);
  revalidatePath("/platform/templates");
  redirect(`/platform/templates/${templateId}?succes=Template+is+ingetrokken.+Bestaande+snapshots+blijven+werken.`);
}

function parseTemplateForm(formData: FormData):
  | { message: string; ok: false }
  | {
      ok: true;
      value: {
        css: string;
        description: string;
        manifest: ReturnType<typeof dynamicTemplateManifestSchema.parse>;
        markup: string;
        name: string;
        orientation: "landscape" | "portrait";
        sample: Record<string, unknown>;
        slideType: "menu" | "news";
        slug: string;
      };
    } {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const markup = String(formData.get("markup") ?? "");
  const css = String(formData.get("css") ?? "");
  const slideType = String(formData.get("slideType") ?? "");
  const orientation = String(formData.get("orientation") ?? "");
  if (
    name.length < 2 ||
    name.length > 120 ||
    !/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/.test(slug) ||
    (slideType !== "menu" && slideType !== "news") ||
    (orientation !== "landscape" && orientation !== "portrait")
  ) {
    return { message: "Controleer naam, slug, type en oriëntatie.", ok: false };
  }
  try {
    const manifest = dynamicTemplateManifestSchema.parse(
      JSON.parse(String(formData.get("manifest") ?? "{}"))
    );
    const sample = JSON.parse(String(formData.get("sample") ?? "{}")) as unknown;
    if (!isRecord(sample)) throw new Error();
    if (
      manifest.slideType !== slideType ||
      (orientation === "landscape" && manifest.canvas.width <= manifest.canvas.height) ||
      (orientation === "portrait" && manifest.canvas.height <= manifest.canvas.width)
    ) {
      return { message: "Manifesttype en canvas passen niet bij de templatekeuze.", ok: false };
    }
    renderDynamicTemplate({ css, manifest, markup }, sample);
    return {
      ok: true,
      value: {
        css,
        description,
        manifest,
        markup,
        name,
        orientation,
        sample,
        slideType,
        slug
      }
    };
  } catch (error) {
    return {
      message: error instanceof DynamicTemplateError
        ? error.message
        : "Manifest en voorbeelddata moeten geldige JSON zijn.",
      ok: false
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
