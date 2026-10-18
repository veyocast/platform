import { notFound } from "next/navigation";

import { hasCapability } from "@veyocast/auth";

import {readControlSitesAuthoringPaused,sitesAuthoringPausedMessage} from "../../../../../lib/sites-authoring-state";
import { requireTenantControlSession } from "../../../../../lib/control-session";
import { loadStudioProject, loadStudioSeries } from "../data";
import { StudioEditorLoader } from "./studio-editor-loader";
import {loadPublisherLibrary} from '../../playlists/library';

type StudioEditorPageProps = {
  params: Promise<{ designId: string }>;
  searchParams: Promise<{ render?: string; succes?: string }>;
};

export default async function StudioEditorPage({
  params,
  searchParams
}: StudioEditorPageProps) {
  const session = await requireTenantControlSession("tenant.studio.read");
  const { designId } = await params;
  const query = await searchParams;
  const series = await loadStudioSeries(session.tenantId,session.isLive,designId);
  const data = await loadStudioProject(
    session.tenantId,
    session.isLive,
    series?.id===designId?series.items[0]!.id:designId
  );
  if (!data.project) notFound();
  let sourceLibraryError:string|null=null;
  const sourceLibrary=session.isLive&&session.tenantId&&data.project.document.syncPresentation
    ? await loadPublisherLibrary(session.tenantId,{tab:'studio'}).then(page=>page.syncProjects??[]).catch(()=>{sourceLibraryError='De bibliotheekvoorbeelden konden niet worden geladen. Je huidige ontwerp blijft open; herlaad de pagina om de bibliotheek opnieuw te controleren.';return [];})
    : [];

  const authoringPaused=data.project.document.sitesPresentation||data.project.document.syncPresentation?await readControlSitesAuthoringPaused(session.tenantId,session.isLive):false;
  const permissions = {
    canArchive: hasCapability(
      session.capabilities,
      "tenant.studio.archive"
    ),
    canCreate: !authoringPaused && hasCapability(session.capabilities, "tenant.studio.create"),
    canEdit: !authoringPaused && (
      hasCapability(session.capabilities, "tenant.studio.edit_all") ||
      (data.project.ownerUserId === session.userId &&
        hasCapability(session.capabilities, "tenant.studio.edit_own"))),
    canManageBrand: hasCapability(
      session.capabilities,
      "tenant.settings.manage"
    ),
    canManageJobs: hasCapability(
      session.capabilities,
      "tenant.studio.job.manage"
    ),
    canManageTemplate: hasCapability(
      session.capabilities,
      "tenant.studio.template.manage"
    ),
    canRender: hasCapability(session.capabilities, "tenant.studio.render"),
    canUploadMedia: hasCapability(session.capabilities,"tenant.media.write")
  };

  return (
    <StudioEditorLoader
      series={series}
      sourceLibrary={sourceLibrary}
      assets={data.assets}
      error={authoringPaused?sitesAuthoringPausedMessage:data.error??sourceLibraryError}
      initialRenderId={query.render ?? null}
      isLive={session.isLive}
      permissions={permissions}
      project={data.project}
      renderJobs={data.renderJobs}
      revisions={data.revisions}
      tenantBrand={
        data.brandKit
          ? {
              colors: [
                data.brandKit.primaryColor,
                data.brandKit.secondaryColor
              ],
              logoAssetId: data.brandKit.logoMediaAssetId,
              name: session.tenant
            }
          : null
      }
      tenantId={session.tenantId ?? "demo"}
    />
  );
}
