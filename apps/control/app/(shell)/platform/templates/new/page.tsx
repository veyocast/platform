import Link from "next/link";

import { Button } from "@veyocast/ui";

import { requireControlCapability } from "../../../../../lib/control-session";
import { PageHeader } from "../../../_components/shell-primitives";
import styles from "../../../dashboard/dynamic-content.module.css";
import { createDynamicTemplate } from "../actions";
import {
  defaultDynamicCss,
  defaultDynamicManifest,
  defaultDynamicMarkup,
  defaultDynamicSample
} from "../template-defaults";

type PageProps = { searchParams: Promise<{ fout?: string }> };

export default async function NewDynamicTemplatePage({ searchParams }: PageProps) {
  await requireControlCapability("platform.dynamic_template.write");
  const params = await searchParams;
  return (
    <>
      <PageHeader
        actions={<Button asChild variant="ghost"><Link href="/platform/templates">Annuleren</Link></Button>}
        description="Alleen de VeyoCast safe-template-v1 taal is toegestaan. Scripts, eventhandlers, imports en externe URLs worden geweigerd."
        eyebrow="Platformtemplate"
        title="Nieuw templateconcept"
      />
      {params.fout ? <p className="notice notice--critical" role="alert">{params.fout}</p> : null}
      <TemplateForm action={createDynamicTemplate} />
    </>
  );
}

export function TemplateForm({
  action,
  initial
}: {
  action: (formData: FormData) => void | Promise<void>;
  initial?: {
    css: string;
    description: string;
    manifest: unknown;
    markup: string;
    name: string;
    orientation: string;
    revision: number;
    sample: unknown;
    slideType: string;
    slug: string;
    templateId: string;
    versionId: string;
  };
}) {
  return (
    <form action={action} className={styles.form}>
      {initial ? <><input name="templateId" type="hidden" value={initial.templateId} /><input name="versionId" type="hidden" value={initial.versionId} /><input name="revision" type="hidden" value={initial.revision} /></> : null}
      <section className={styles.formSection}>
        <h2>Template-identiteit</h2>
        <div className={styles.fieldGrid}>
          <label className={styles.field}><span>Naam</span><input defaultValue={initial?.name} maxLength={120} name="name" required /></label>
          <label className={styles.field}><span>Slug</span><input defaultValue={initial?.slug} disabled={Boolean(initial)} name="slug" pattern="[a-z0-9][a-z0-9-]{1,78}[a-z0-9]" required /></label>
          {initial ? <input name="slug" type="hidden" value={initial.slug} /> : null}
          <label className={`${styles.field} ${styles.fieldWide}`}><span>Beschrijving</span><input defaultValue={initial?.description} maxLength={500} name="description" /></label>
          <label className={styles.field}><span>Slidetype</span><select defaultValue={initial?.slideType ?? "menu"} disabled={Boolean(initial)} name="slideType"><option value="menu">Menubord</option><option value="news">Nieuws</option></select></label>
          {initial ? <input name="slideType" type="hidden" value={initial.slideType} /> : null}
          <label className={styles.field}><span>Oriëntatie</span><select defaultValue={initial?.orientation ?? "landscape"} disabled={Boolean(initial)} name="orientation"><option value="landscape">Liggend</option><option value="portrait">Staand</option></select></label>
          {initial ? <input name="orientation" type="hidden" value={initial.orientation} /> : null}
        </div>
      </section>
      <section className={styles.formSection}>
        <h2>Bron en contract</h2>
        <div className={styles.codeGrid}>
          <div className={styles.codeStack}>
            <label className={styles.field}><span>Veilige SVG/template-markup</span><textarea defaultValue={initial?.markup ?? defaultDynamicMarkup} name="markup" required /></label>
            <label className={styles.field}><span>CSS</span><textarea defaultValue={initial?.css ?? defaultDynamicCss} name="css" /></label>
          </div>
          <div className={styles.codeStack}>
            <label className={styles.field}><span>Manifest JSON</span><textarea defaultValue={JSON.stringify(initial?.manifest ?? defaultDynamicManifest, null, 2)} name="manifest" required /></label>
            <label className={styles.field}><span>Testdata JSON</span><textarea defaultValue={JSON.stringify(initial?.sample ?? defaultDynamicSample, null, 2)} name="sample" required /></label>
          </div>
        </div>
        <div className={styles.formActions}><p className={styles.muted}>Opslaan valideert het manifest én rendert testdata door dezelfde engine als de worker.</p><Button type="submit">{initial ? "Concept en preview opslaan" : "Templateconcept maken"}</Button></div>
      </section>
    </form>
  );
}
