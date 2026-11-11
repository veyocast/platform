import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../../../lib/control-session";
import { loadTenantStyleData } from "../../../../../../lib/tenant-style-data";
import { PageHeader } from "../../../../_components/shell-primitives";
import { createOrResumeDynamicSlideVersion } from "../../version-actions";
import { loadDynamicSlideVersionState } from "../../version-data";
import { VersionHistory } from "../../version-history";
import { loadMenuStudioSlide, menuStudioTemplateVersionIds } from "../data";
import { SitesMenuWizard } from "../sites-menu-wizard";
import {SyncExportDownload}from"../../sync-export-download";
import { MenuStudioEditor } from "../menu-studio-editor";
import { MenuDomPreview } from "../../../playlists/playlist-preview";
import styles from "../../../dynamic-content.module.css";

type PageProps = {
  params: Promise<{ slideId: string }>;
  searchParams: Promise<{ succes?: string; geavanceerd?: string }>;
};

export default async function EditMenuStudioPage({ params, searchParams }: PageProps) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const [{ slideId }, query] = await Promise.all([params, searchParams]);
  const [data, tenantStyle] = await Promise.all([
    session.isLive && session.tenantId
      ? loadMenuStudioSlide(session.tenantId, slideId)
      : null,
    loadTenantStyleData(session.tenantId, session.isLive)
  ]);
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
          {!versionState.activeDraftVersionId&&data.exportSnapshotId?<SyncExportDownload key={data.exportSnapshotId} snapshotId={data.exportSnapshotId}/>:null}
          {!versionState.activeDraftVersionId && versionState.currentVersionId ? (
            <form action={createOrResumeDynamicSlideVersion}>
              <input name="editor" type="hidden" value="menu" />
              <input name="slideId" type="hidden" value={slideId} />
              <Button type="submit">Nieuwe versie maken</Button>
            </form>
          ) : null}
        </div>}
        description="Bekijk je opgeslagen menu. Maak een nieuwe versie om wijzigingen te publiceren; de huidige versie blijft ondertussen actief."
        eyebrow={session.tenant}
        status={draftVersion
          ? { label: `${draftVersion.status === "publishing" ? "Publiceren" : "Concept"} v${draftVersion.versionNumber}`, tone: "warning" }
          : currentVersion
            ? { label: `Huidige versie v${currentVersion.versionNumber}`, tone: "success" }
            : { label: "Concept", tone: "warning" }}
        title={data.slide.name}
      />
      {query.succes ? <p className="notice notice--success" role="status">{query.succes}</p> : null}
      {draftVersion?.status === "draft" ? data.document.sitesConfiguration && query.geavanceerd !== "1" ? <SitesMenuWizard clubName={session.tenant}  initialDocument={data.document} initialName={data.slide.name} initialOrientation={data.slide.orientation === "portrait" ? "portrait" : "landscape"} media={data.media} products={data.products} slideId={slideId} sourceId={data.source.id} templateVersionIds={menuStudioTemplateVersionIds(data.templates, data.slide.template_version_id)} /> : <MenuStudioEditor
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
        tenantStyle={tenantStyle}
        templateVersionIds={menuStudioTemplateVersionIds(
          data.templates,
          data.slide.template_version_id
        )}
      /> : draftVersion?.status === "publishing" ? (
        <section className="data-surface">
          <h2>Versie v{draftVersion.versionNumber} wordt gepubliceerd</h2>
          <p>Je kunt het opgeslagen ontwerp hieronder al bekijken. De nieuwe versie wordt gecontroleerd voor gebruik in playlists; de huidige versie blijft ondertussen actief op je schermen.</p>
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
      {draftVersion?.status !== "draft" && data.savedPreview?.kind === "menu" ? (
        <section className={styles.card} aria-labelledby="saved-menu-preview-title">
          <h2 id="saved-menu-preview-title">Opgeslagen schermvoorbeeld</h2>
          <div className={styles.preview} data-orientation={data.savedPreview.presentation.kind === "dynamic" ? data.savedPreview.presentation.configuration.orientation : data.slide.orientation}>
            <MenuDomPreview presentation={data.savedPreview.presentation} assetUrls={data.savedPreview.assetUrls} />
          </div>
        </section>
      ) : null}
      <VersionHistory canWrite editor="menu" slideId={slideId} versions={versionState.versions} />
      <style>{`.menu-version-actions{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}`}</style>
    </>
  );
}
