import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../../../lib/control-session";
import { PageHeader } from "../../../../_components/shell-primitives";
import { loadMenuStudioSlide, menuStudioTemplateVersionIds } from "../data";
import { MenuStudioEditor } from "../menu-studio-editor";

type PageProps = {
  params: Promise<{ slideId: string }>;
  searchParams: Promise<{ succes?: string }>;
};

export default async function EditMenuStudioPage({ params, searchParams }: PageProps) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const [{ slideId }, query] = await Promise.all([params, searchParams]);
  const data = session.isLive && session.tenantId
    ? await loadMenuStudioSlide(session.tenantId, slideId)
    : null;
  if (!data || !data.source || !data.flags.read || !data.flags.authoring) notFound();

  return (
    <>
      <PageHeader
        actions={<Button asChild variant="ghost"><Link href="/dashboard/slides">Terug naar slides</Link></Button>}
        description="Wijzigingen worden als getypeerde, revision-aware operaties opgeslagen. Publiceren maakt een nieuwe immutable snapshot; de laatste goede release blijft actief bij fouten."
        eyebrow={session.tenant}
        status={data.lastPublishedRevision === data.document.revision
          ? { label: "Gepubliceerd", tone: "success" }
          : { label: "Concept gewijzigd", tone: "warning" }}
        title={data.slide.name}
      />
      {query.succes ? <p className="notice notice--success" role="status">{query.succes}</p> : null}
      <MenuStudioEditor
        initialOrientation={data.slide.orientation === "portrait" ? "portrait" : "landscape"}
        initialDocument={data.document}
        linkedGroupsEnabled={data.flags.linkedGroups}
        media={data.media}
        mediaEnabled={data.flags.media}
        mode="edit"
        products={data.products}
        publishEnabled={data.flags.publish && data.flags.player}
        slideId={slideId}
        sourceId={data.source.id}
        sourceName={data.source.name}
        templateVersionIds={menuStudioTemplateVersionIds(
          data.templates,
          data.slide.template_version_id
        )}
      />
    </>
  );
}
