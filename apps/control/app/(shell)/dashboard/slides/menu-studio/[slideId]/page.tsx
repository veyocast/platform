import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../../../lib/control-session";
import { PageHeader } from "../../../../_components/shell-primitives";
import { createOrResumeDynamicSlideVersion } from "../../version-actions";
import { loadDynamicSlideVersionState } from "../../version-data";
import { VersionHistory } from "../../version-history";
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
  const versionState = await loadDynamicSlideVersionState(session.tenantId!, slideId);
  if (!versionState) notFound();
  const draftVersion = versionState.versions.find((version) =>
    version.id === versionState.activeDraftVersionId
  );
  const currentVersion = versionState.versions.find((version) => version.isCurrent);

  return (
    <>
      <PageHeader
        actions={<div className="menu-version-actions">
          <Button asChild variant="ghost"><Link href="/dashboard/slides">Terug naar slides</Link></Button>
          {!versionState.activeDraftVersionId && versionState.currentVersionId ? (
            <form action={createOrResumeDynamicSlideVersion}>
              <input name="editor" type="hidden" value="menu" />
              <input name="slideId" type="hidden" value={slideId} />
              <Button type="submit">Nieuwe versie maken</Button>
            </form>
          ) : null}
        </div>}
        description="Wijzigingen worden als getypeerde, revision-aware operaties opgeslagen. Publiceren maakt een nieuwe immutable snapshot; de laatste goede release blijft actief bij fouten."
        eyebrow={session.tenant}
        status={draftVersion
          ? { label: `Concept v${draftVersion.versionNumber}`, tone: "warning" }
          : currentVersion
            ? { label: `Huidige versie v${currentVersion.versionNumber}`, tone: "success" }
            : { label: "Concept", tone: "warning" }}
        title={data.slide.name}
      />
      {query.succes ? <p className="notice notice--success" role="status">{query.succes}</p> : null}
      {draftVersion?.status === "draft" ? <MenuStudioEditor
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
      /> : draftVersion?.status === "publishing" ? (
        <section className="data-surface">
          <h2>Versie v{draftVersion.versionNumber} wordt gepubliceerd</h2>
          <p>De nieuwe immutable preview wordt volledig opgebouwd en gecontroleerd. Tot die gereed is, blijft de vorige huidige versie actief in playlists en op schermen.</p>
        </section>
      ) : (
        <section className="data-surface">
          <h2>Dit menu staat gepubliceerd</h2>
          <p>Maak een nieuwe versie om producten, vrije tekst, media, layout, oriëntatie of thema veilig aan te passen. De huidige versie en alle playlistplaatsingen blijven actief totdat de nieuwe versie gereed is.</p>
          <form action={createOrResumeDynamicSlideVersion}>
            <input name="editor" type="hidden" value="menu" />
            <input name="slideId" type="hidden" value={slideId} />
            <Button type="submit">Nieuwe versie maken</Button>
          </form>
        </section>
      )}
      <VersionHistory canWrite editor="menu" slideId={slideId} versions={versionState.versions} />
      <style>{`.menu-version-actions{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}`}</style>
    </>
  );
}
