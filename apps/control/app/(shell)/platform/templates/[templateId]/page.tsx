import Link from "next/link";
import { notFound } from "next/navigation";

import { hasCapability } from "@veyocast/auth";
import { Button } from "@veyocast/ui";
import { renderDynamicTemplate } from "@veyocast/integrations";
import { dynamicTemplateManifestSchema } from "@veyocast/contracts";

import { requireControlCapability } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { PageHeader, StatusPill } from "../../../_components/shell-primitives";
import styles from "../../../dashboard/dynamic-content.module.css";
import {
  createTemplateVersion,
  publishTemplateVersion,
  updateDynamicTemplate,
  withdrawTemplate
} from "../actions";
import { TemplateForm } from "../template-form";

type PageProps = {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ fout?: string; succes?: string }>;
};

export default async function DynamicTemplateDetailPage({ params, searchParams }: PageProps) {
  const session = await requireControlCapability("platform.dynamic_template.read");
  const { templateId } = await params;
  const query = await searchParams;
  const data = await loadTemplate(templateId);
  if (!data) notFound();
  const draft = data.versions.find((version) => version.status === "draft");
  const selected = draft ?? data.versions[0];
  if (!selected) notFound();
  const canWrite = hasCapability(session.capabilities, "platform.dynamic_template.write");
  const canPublish = hasCapability(session.capabilities, "platform.dynamic_template.publish");
  const preview = safePreview(selected);

  return (
    <>
      <PageHeader
        actions={<div className={styles.heroActions}><Button asChild variant="ghost"><Link href="/platform/templates">Terug</Link></Button>{canWrite && !draft && data.template.current_published_version_id ? <form action={createTemplateVersion}><input name="templateId" type="hidden" value={templateId} /><Button type="submit" variant="secondary">Nieuwe conceptversie</Button></form> : null}{canPublish && draft ? <form action={publishTemplateVersion}><input name="templateId" type="hidden" value={templateId} /><input name="versionId" type="hidden" value={draft.id} /><Button type="submit">Versie publiceren</Button></form> : null}{canPublish && data.template.status === "published" && !draft ? <form action={withdrawTemplate}><input name="templateId" type="hidden" value={templateId} /><Button type="submit" variant="secondary">Intrekken</Button></form> : null}</div>}
        description="Gepubliceerde bronversies zijn immutable. Nieuwe wijzigingen beginnen altijd in een afzonderlijk concept."
        eyebrow="Dynamisch platformtemplate"
        status={templateStatus(data.template.status)}
        title={data.template.name}
      />
      {query.fout ? <p className="notice notice--critical" role="alert">{query.fout}</p> : null}
      {query.succes ? <p className="notice notice--success" role="status">{query.succes}</p> : null}
      <div className={styles.split}>
        <section className={styles.svgPreview} aria-label="Deterministische templatepreview" dangerouslySetInnerHTML={{ __html: preview }} />
        <section className={styles.formSection}>
          <h2>Versiehistorie</h2>
          <div className={styles.codeStack}>{data.versions.map((version) => <div className={styles.metaRow} key={version.id}><span>Versie {version.version}</span><StatusPill {...templateStatus(version.status)} /></div>)}</div>
          <p className={styles.muted}>Preview: versie {selected.version}{draft ? " · huidig concept" : " · laatste publicatie"}</p>
        </section>
      </div>
      {canWrite && draft ? (
        <TemplateForm
          action={updateDynamicTemplate}
          initial={{
            css: draft.css,
            description: data.template.description,
            manifest: draft.manifest_json,
            markup: draft.markup,
            name: data.template.name,
            orientation: data.template.orientation,
            revision: Number(draft.revision),
            sample: draft.sample_data_json,
            slideType: data.template.slide_type,
            slug: data.template.slug,
            templateId,
            versionId: draft.id
          }}
        />
      ) : null}
    </>
  );
}

async function loadTemplate(templateId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return null;
  const [templateResult, versionsResult] = await Promise.all([
    supabase.from("dynamic_templates").select("*").eq("id", templateId).maybeSingle(),
    supabase.from("dynamic_template_versions").select("*").eq("template_id", templateId).order("version", { ascending: false })
  ]);
  if (!templateResult.data || templateResult.error || versionsResult.error) return null;
  return { template: templateResult.data, versions: versionsResult.data ?? [] };
}

function safePreview(version: Record<string, unknown>) {
  try {
    return renderDynamicTemplate(
      {
        css: String(version.css ?? ""),
        manifest: dynamicTemplateManifestSchema.parse(version.manifest_json),
        markup: String(version.markup ?? "")
      },
      version.sample_data_json
    );
  } catch {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="100%" height="100%" fill="#f4f4f0"/><text x="50%" y="50%" text-anchor="middle" font-family="Inter" fill="#4d4d49">Preview kon niet veilig worden gerenderd</text></svg>';
  }
}

function templateStatus(status: string) {
  if (status === "published") return { label: "Gepubliceerd", tone: "success" as const };
  if (status === "withdrawn") return { label: "Ingetrokken", tone: "warning" as const };
  if (status === "draft") return { label: "Concept", tone: "info" as const };
  return { label: "Gearchiveerd", tone: "neutral" as const };
}
