import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";

import { hasCapability } from "@veyocast/auth";

import { requireTenantControlSession } from "../../../../../../lib/control-session";
import { loadDraftPreflight } from "../../../releases/data";
import { loadPlaylistStudio } from "../../data";
import type { PlaylistPreviewItem } from "../../playlist-preview";
import { getReadinessCopy } from "../../readiness-copy";
import { PublishJourney } from "./publish-journey";

type PublishJourneyPageProps = {
  params: Promise<{ playlistId: string }>;
  searchParams: Promise<{ fout?: string }>;
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
  const targetItems = studio?.items.flatMap((item) => item.enabled &&
    (item.sectionId === null || enabledSections.has(item.sectionId)) &&
    item.asset?.variant
    ? [{ checksumSha256: item.asset.variant.checksumSha256, fileSizeBytes: item.asset.variant.fileSizeBytes }]
    : []) ?? [];
  const preflight = session.isLive && session.tenantId && playlist
    ? await loadDraftPreflight(session.tenantId, targetItems)
    : { error: null, screenStates: [] };
  const canPublish = Boolean(
    session.isLive &&
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
  const previewItems: PlaylistPreviewItem[] = studio?.items.flatMap((item) => {
    if (!item.asset?.variant?.previewUrl) return [];
    return [{
      accessibilityName: item.accessibilityName || undefined,
      backgroundColor: item.backgroundColor || undefined,
      cropFocus: { x: item.cropFocusX, y: item.cropFocusY },
      displayTitle: item.displayTitle || undefined,
      durationSeconds: item.durationSeconds,
      enabled: item.enabled,
      fitMode: item.fitMode,
      id: item.id,
      kind: item.asset.kind,
      muted: item.muted,
      title: item.asset.title,
      transition: item.transition,
      trim: {
        endSeconds: item.trimEndSeconds ?? undefined,
        startSeconds: item.trimStartSeconds
      },
      url: item.asset.variant.previewUrl,
      visibility: item.visibleFrom || item.visibleUntil
        ? { from: item.visibleFrom ?? undefined, until: item.visibleUntil ?? undefined }
        : undefined,
      volumePercent: item.volumePercent
    }];
  }) ?? [];

  return <>
    {query.fout ? <p className="notice notice--critical" role="alert"><strong>Publicatie niet uitgevoerd.</strong> {query.fout}</p> : null}
    {studio?.error || preflight.error ? <p className="notice notice--critical" role="alert"><strong>Publicatiecontrole onvolledig.</strong> {studio?.error ?? preflight.error}</p> : null}
    {playlist && studio ? (
      <PublishJourney
        canPublish={canPublish}
        idempotencyKey={randomUUID()}
        nextVersion={studio.releases[0] ? studio.releases[0].version + 1 : 1}
        playlist={{
          id: playlist.id,
          name: playlist.name,
          revision: playlist.revision
        }}
        preflightStates={preflight.screenStates.map((state) => ({
          heartbeatAt: state.heartbeatAt,
          preflight: state.preflight,
          screen: state.screen
        }))}
        birthdayTimingChecks={birthdayTimingChecks}
        previewItems={previewItems}
        readiness={{
          canPublish: studio.readiness?.canPublish ?? false,
          itemCount: studio.readiness?.itemCount ?? 0,
          reasons: studio.readiness?.reasons.map((reason) => {
            const copy = getReadinessCopy(reason);
            return `${copy.label}. ${copy.detail}`;
          }) ?? [],
          totalBytes: studio.readiness?.totalBytes ?? 0,
          totalDurationSeconds: studio.readiness?.totalDurationSeconds ?? 0
        }}
        tenantName={session.tenant}
      />
    ) : null}
  </>;
}
