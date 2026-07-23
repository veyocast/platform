import { notFound } from "next/navigation";

import { hasCapability } from "@veyocast/auth";
import type { PlayerPlaybackItem } from "@veyocast/contracts";

import { requireControlSession } from "../../../../../lib/control-session";
import { PublisherStudioWorkspace } from "../_components/publisher-studio-workspace";
import { loadPlaylistStudio } from "../data";
import type { PlaylistPreviewItem } from "../playlist-preview";
import { getReadinessCopy } from "../readiness-copy";

type PlaylistStudioPageProps = {
  params: Promise<{ playlistId: string }>;
  searchParams: Promise<{
    actual?: string;
    conflict?: string;
    expected?: string;
    fout?: string;
    operation?: string;
    succes?: string;
  }>;
};

export default async function PlaylistStudioPage({
  params,
  searchParams
}: PlaylistStudioPageProps) {
  const session = await requireControlSession();
  const { playlistId } = await params;
  const query = await searchParams;
  const data =
    session.isLive && session.tenantId
      ? await loadPlaylistStudio(session.tenantId, playlistId)
      : {
          assets: [],
          error: null,
          items: [],
          playlist: null,
          readiness: null,
          releases: [],
          sections: [],
          screens: []
        };
  if (session.isLive && !data.playlist && !data.error) notFound();

  const playlist = data.playlist;
  const tenantIsMutable =
    session.isLive &&
    session.tenantStatus === "active" &&
    playlist?.status !== "archived";
  const canWrite = Boolean(
    tenantIsMutable &&
      hasCapability(session.roles, "tenant.playlist.write")
  );
  const canManage = Boolean(
    tenantIsMutable &&
      hasCapability(session.roles, "tenant.playlist.archive")
  );
  const previewItems: PlaylistPreviewItem[] = data.items.flatMap((item) => {
    const asset = item.asset;
    const url = asset?.variant?.previewUrl;
    if (!asset || !url) return [];
    const playback: PlayerPlaybackItem = {
      accessibilityName: item.accessibilityName || undefined,
      backgroundColor: item.backgroundColor || undefined,
      cropFocus: { x: item.cropFocusX, y: item.cropFocusY },
      displayTitle: item.displayTitle || undefined,
      durationSeconds: item.durationSeconds,
      enabled: item.enabled,
      fitMode: item.fitMode,
      id: item.id,
      kind: asset.kind,
      muted: item.muted,
      section: item.sectionId
        ? data.sections
            .filter((section) => section.id === item.sectionId)
            .map((section) => ({
              name: section.name,
              positionKey: section.positionKey,
              sourceSectionId: section.id
            }))[0]
        : undefined,
      title: asset.title,
      transition: item.transition,
      trim: {
        endSeconds: item.trimEndSeconds ?? undefined,
        startSeconds: item.trimStartSeconds
      },
      visibility: item.visibleFrom || item.visibleUntil
        ? {
            from: item.visibleFrom ?? undefined,
            until: item.visibleUntil ?? undefined
          }
        : undefined,
      volumePercent: item.volumePercent
    };
    return [{ ...playback, url }];
  });

  return (
    <>
      {query.fout ? (
        <p className="notice notice--critical" role="alert">
          <strong>Actie mislukt.</strong> {query.fout}
        </p>
      ) : null}
      {query.succes ? (
        <p className="notice notice--success" role="status">
          {query.succes}
        </p>
      ) : null}
      {data.error ? (
        <p className="notice notice--critical" role="alert">
          <strong>Playlist Studio niet volledig geladen.</strong> {data.error}
        </p>
      ) : null}
      {!session.isLive ? (
        <p className="notice notice--warning" role="status">
          Playlist Studio gebruikt alleen live tenantdata. Configureer Supabase
          en log opnieuw in.
        </p>
      ) : null}
      {query.conflict && playlist ? (
        <ConflictPanel
          actual={query.actual}
          expected={query.expected}
          operation={query.operation}
          playlistId={playlist.id}
          updatedBy={playlist.updatedBy}
        />
      ) : null}

      {playlist ? (
        <PublisherStudioWorkspace
          assets={data.assets}
          canManage={canManage}
          canWrite={canWrite}
          items={data.items}
          latestReleaseVersion={data.releases[0]?.version ?? null}
          playlist={playlist}
          previewItems={previewItems}
          readiness={
            data.readiness
              ? {
                  canPublish: data.readiness.canPublish,
                  itemCount: data.readiness.itemCount,
                  messages: data.readiness.reasons.map((reason) =>
                    getReadinessCopy(reason)
                  ),
                  totalBytes: data.readiness.totalBytes,
                  totalDurationSeconds:
                    data.readiness.totalDurationSeconds
                }
              : null
          }
          sections={data.sections}
          screenCount={
            data.screens.filter(
              (screen) => screen.assignedPlaylistId === playlist.id
            ).length
          }
          serverAcknowledged={Boolean(query.succes)}
          serverConflict={Boolean(query.conflict)}
        />
      ) : null}
    </>
  );
}

function ConflictPanel({
  actual,
  expected,
  operation,
  playlistId,
  updatedBy
}: {
  actual?: string;
  expected?: string;
  operation?: string;
  playlistId: string;
  updatedBy: string;
}) {
  return (
    <section
      className="notice notice--warning playlist-conflict"
      id="playlist-conflict"
      role="alert"
    >
      <div>
        <strong>Dit concept is ondertussen gewijzigd.</strong>
        <p>
          Jouw actie is niet uitgevoerd. De nieuwste revisie blijft intact,
          zodat er geen wijzigingen verloren gaan.
        </p>
      </div>
      <details>
        <summary>Revisies vergelijken</summary>
        <dl className="meta-list">
          <div>
            <dt>Jouw revisie</dt>
            <dd>{expected ?? "Onbekend"}</dd>
          </div>
          <div>
            <dt>Nieuwste revisie</dt>
            <dd>{actual ?? "Onbekend"}</dd>
          </div>
          <div>
            <dt>Laatste bewerker</dt>
            <dd>{updatedBy}</dd>
          </div>
          <div>
            <dt>Niet uitgevoerde actie</dt>
            <dd>{operationLabel(operation)}</dd>
          </div>
        </dl>
      </details>
      <div className="page-action-group">
        <a
          className="button-link button-link--primary"
          href={`/dashboard/playlists/${playlistId}`}
        >
          Nieuwste versie laden
        </a>
        <a
          className="button-link button-link--secondary"
          href="#storyboard-title"
        >
          Wijziging opnieuw invoeren
        </a>
      </div>
    </section>
  );
}

function operationLabel(operation?: string) {
  const labels: Record<string, string> = {
    add_item: "Media toevoegen",
    archive: "Archiveren",
    move_item: "Volgorde wijzigen",
    publish: "Publiceren",
    remove_item: "Item verwijderen",
    update_details: "Conceptgegevens opslaan",
    update_item: "Iteminstellingen opslaan"
  };
  return operation
    ? labels[operation] ?? "Concept wijzigen"
    : "Concept wijzigen";
}
