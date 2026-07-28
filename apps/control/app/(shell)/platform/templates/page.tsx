import Link from "next/link";
import { Braces, FileCode2 } from "lucide-react";

import { hasCapability } from "@veyocast/auth";
import { Button, SummaryStrip } from "@veyocast/ui";

import { requireControlCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { PageHeader, StatusPill } from "../../_components/shell-primitives";
import styles from "../../dashboard/dynamic-content.module.css";

type PageProps = {
  searchParams: Promise<{ fout?: string; succes?: string }>;
};

export default async function PlatformTemplatesPage({ searchParams }: PageProps) {
  const session = await requireControlCapability("platform.dynamic_template.read");
  const params = await searchParams;
  const templates = session.isLive ? await loadTemplates() : [];
  const canWrite = hasCapability(session.capabilities, "platform.dynamic_template.write");

  return (
    <>
      <PageHeader
        actions={canWrite ? <Button asChild><Link href="/platform/templates/new"><FileCode2 aria-hidden="true" />Nieuw template</Link></Button> : null}
        description="Beheer veilige template-markup, CSS, manifests, testdata en immutable publicatieversies voor alle tenants."
        eyebrow="Platform"
        title="Dynamische templates"
      />
      {params.fout ? <p className="notice notice--critical" role="alert">{params.fout}</p> : null}
      {params.succes ? <p className="notice notice--success" role="status">{params.succes}</p> : null}
      <SummaryStrip items={[
        { label: "Templates", value: templates.length },
        { label: "Gepubliceerd", value: templates.filter((template) => template.status === "published").length },
        { label: "Concept of ingetrokken", value: templates.filter((template) => template.status !== "published").length }
      ]} />
      <section aria-labelledby="platform-template-list">
        <h2 className="sr-only" id="platform-template-list">Platformtemplates</h2>
        <div className={styles.grid}>
          {templates.map((template) => (
            <article className={styles.card} key={template.id}>
              <div className={styles.preview} data-orientation={template.orientation}>
                <div className={styles.previewPlaceholder}><Braces aria-hidden="true" /><span>{template.slide_type === "menu" ? "Menubord" : "Nieuws"} · veilige SVG/template-markup</span></div>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardTop}><StatusPill {...templateStatus(template.status)} /><span className={styles.muted}>v{template.currentVersion ?? "—"}</span></div>
                <div><h3 className={styles.cardTitle}>{template.name}</h3><p className={styles.muted}>{template.description || "Geen beschrijving."}</p></div>
                <Button asChild size="sm" variant="secondary"><Link href={`/platform/templates/${template.id}`}>Template en versies openen</Link></Button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

async function loadTemplates() {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return [];
  const { data } = await supabase.from("dynamic_templates").select("*").order("updated_at", { ascending: false });
  const versionIds = (data ?? []).flatMap((template) => template.current_published_version_id ? [template.current_published_version_id] : []);
  const versions = versionIds.length ? await supabase.from("dynamic_template_versions").select("id, version").in("id", versionIds) : { data: [] };
  const versionMap = new Map((versions.data ?? []).map((version) => [version.id, version.version]));
  return (data ?? []).map((template) => ({
    ...template,
    currentVersion: template.current_published_version_id ? versionMap.get(template.current_published_version_id) ?? null : null
  }));
}

function templateStatus(status: string) {
  if (status === "published") return { label: "Gepubliceerd", tone: "success" as const };
  if (status === "withdrawn") return { label: "Ingetrokken", tone: "warning" as const };
  return { label: "Concept", tone: "neutral" as const };
}
