import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";

import { hasCapability } from "@veyocast/auth";

import { requireTenantControlSession } from "../../../../../../lib/control-session";
import { loadDraftPreflight } from "../../../releases/data";
import { loadPlaylistStudio } from "../../data";
import { loadPublicationMediaPreview } from "../../publish-media-frame-preview.server";
import { getReadinessCopy } from "../../readiness-copy";
import { PublishJourney } from "./publish-journey";

type PublishJourneyPageProps = {
  params: Promise<{ playlistId: string }>;
  searchParams: Promise<{ fout?: string;screens?:string }>;
};

export default async function PublishJourneyPage({ params, searchParams }: PublishJourneyPageProps) {
  const session = await requireTenantControlSession("tenant.playlist.read");
  const { playlistId } = await params;
  const query = await searchParams;
  const studio = session.isLive && session.tenantId
    ? await loadPlaylistStudio(session.tenantId, playlistId)
    : null;
  if (session.isLive && !studio?.playlist && !studio?.error) notFound();

  const playlist = studio?.playlist ?? null;
  const enabledSections = new Set(
    studio?.sections.filter((section) => section.enabled).map((section) => section.id) ?? []
  );
  let publication: Awaited<ReturnType<typeof loadPublicationMediaPreview>> | null = null;
  let publicationError: string | null = null;
  if (studio && session.isLive && session.tenantId) {
    try { publication = await loadPublicationMediaPreview(session.tenantId, studio.items, enabledSections); }
    catch { publicationError = "De vaste media-ontwerpversie of achtergrond kon niet volledig worden gecontroleerd. Je concept blijft behouden; open de playlist opnieuw voordat je publiceert."; }
  }
  const preflight = session.isLive && session.tenantId && playlist && !publicationError
    ? await loadDraftPreflight(session.tenantId, publication?.targetItems ?? [])
    : { error: publicationError, screenStates: [], warning: null };
  const canPublish = Boolean(
    session.isLive &&
    !publicationError &&
    session.tenantStatus === "active" &&
    playlist?.status !== "archived" &&
    hasCapability(session.capabilities, "tenant.playlist.publish") &&
    studio?.readiness?.canPublish
  );
  const birthdayTimingChecks = studio?.items.flatMap((item) => {
    const sectionEnabled = item.sectionId === null || enabledSections.has(item.sectionId);
    const slide = item.dynamicSlideId
      ? studio.dynamicSlides.find((candidate) =>
          candidate.id === item.dynamicSlideId &&
          candidate.slideType === "sport_birthdays"
        )
      : null;
    if (!item.enabled || !sectionEnabled || !slide) return [];
    return [{
      actualDurationSeconds: item.durationSeconds,
      itemId: item.id,
      minimumDurationSeconds: slide.durationSeconds,
      name: slide.name,
      pageCount: slide.slideCount
    }];
  }) ?? [];
  const previewItems = publication?.previewItems ?? [];

  return <>
    {query.fout ? <p className="notice notice--critical" role="alert"><strong>Publicatie niet uitgevoerd.</strong> {query.fout}</p> : null}
    {studio?.error || preflight.error ? <p className="notice notice--critical" role="alert"><strong>Publicatiecontrole niet beschikbaar.</strong> {studio?.error ?? preflight.error}</p> : null}
    {playlist && studio && !publicationError ? (
      <PublishJourney
        canPublish={canPublish}
        initialScreenIds={(query.screens??'').split(',').filter(id=>preflight.screenStates.some(state=>state.screen.id===id))}
        idempotencyKey={randomUUID()}
        playlist={{
          id: playlist.id,
          name: playlist.name,
          revision: playlist.revision
        }}
        preflightError={preflight.error}
        preflightStates={preflight.screenStates.map((state) => ({
          heartbeatAt: state.heartbeatAt,
          preflight: state.preflight,
          screen: state.screen
        }))}
        preflightWarning={preflight.warning}
        birthdayTimingChecks={birthdayTimingChecks}
        previewItems={previewItems}
        readiness={{
          canPublish: studio.readiness?.canPublish ?? false,
          itemCount: studio.readiness?.itemCount ?? 0,
          reasons: studio.readiness?.reasons.map((reason) => {
            const copy = getReadinessCopy(reason);
            return `${copy.label}. ${copy.detail}`;
          }) ?? [],
          totalBytes: publication?.hasFrames ? publication.totalBytes : studio.readiness?.totalBytes ?? 0,
          totalDurationSeconds: studio.readiness?.totalDurationSeconds ?? 0
        }}
        tenantName={session.tenant}
      />
    ) : null}
  </>;
}
