import Link from "next/link";

import { Button } from "@veyocast/ui";

import { requireControlCapability } from "../../../../../lib/control-session";
import { PageHeader } from "../../../_components/shell-primitives";
import { createDynamicTemplate } from "../actions";
import { TemplateForm } from "../template-form";

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
