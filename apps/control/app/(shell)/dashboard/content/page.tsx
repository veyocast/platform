import { randomUUID } from "node:crypto";
import { hasCapability } from "@veyocast/auth";
import { mediaFrameSettingsSchema } from "@veyocast/contracts";
import { Loader2, Search, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";
import { requireTenantControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { getSupabasePublicConfig } from "../../../../lib/supabase/config";
import { MediaUploadDialog } from "../media/media-overlays";
import { SyncStudioCreateDialog } from "../studio/sync-studio-create-dialog";
import { ContentWorkspace } from "./content-workspace";
import { readContentPlacement, type ContentItem } from "./model";

const filters = [
  ["all", "Alles"],
  ["slides", "Ontwerpen"],
  ["media", "Foto’s & video’s"],
  ["attention", "In bewerking"],
  ["archive", "Archief"],
] as const;
export default async function ContentLibrary({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireTenantControlSession();
  const params = await searchParams;
  const query =
    typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const filter =
    typeof params.filter === "string" &&
    filters.some(([id]) => id === params.filter)
      ? params.filter
      : "all";
  const page = Math.min(
      100000,
      Math.max(1, Math.floor(Number(params.page)) || 1),
    ),
    size = 48;
  const client =
    session.isLive && session.tenantId
      ? await createControlSupabaseClient()
      : null;
  let request = client
    ?.from("sync_content_library_v1")
    .select(
      "id,content_key,title,kind,family,status,archived,orientation,duration_seconds,updated_at,width,height,preview_asset_id,placement,revision,media_frame_id,media_frame_version_id",
      { count: "exact" },
    )
    .eq("tenant_id", session.tenantId!)
    .eq("archived", filter === "archive");
  if (query)
    request = request?.ilike("title", `%${query.replace(/[\\%_]/g, "\\$&")}%`);
  if (filter === "media") request = request?.eq("kind", "media");
  if (filter === "slides") request = request?.neq("kind", "media");
  if (filter === "attention")
    request = request?.in("status", [
      "draft",
      "uploading",
      "processing",
      "rendering",
      "error",
      "validation_failed",
      "quarantined",
    ]);
  const [result, live, ready, processing] = await Promise.all([
    request
      ? request
          .order("updated_at", { ascending: false })
          .order("content_key")
          .range((page - 1) * size, page * size - 1)
      : null,
    client
      ?.from("sync_content_library_v1")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", session.tenantId!)
      .eq("archived", false),
    client
      ?.from("sync_content_library_v1")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", session.tenantId!)
      .eq("archived", false)
      .in("status", ["ready", "published"]),
    client
      ?.from("sync_content_library_v1")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", session.tenantId!)
      .eq("archived", false)
      .in("status", ["uploading", "processing", "rendering"]),
  ]);
  const failed =
    !result ||
    Boolean(result.error || live?.error || ready?.error || processing?.error);
  const rows = result?.data ?? [];
  const ids = [
    ...new Set(
      rows.flatMap((row) =>
        row.preview_asset_id ? [String(row.preview_asset_id)] : [],
      ),
    ),
  ];
  const variants =
    client && ids.length
      ? await client
          .from("media_variants")
          .select("asset_id,storage_path,variant_type")
          .eq("tenant_id", session.tenantId!)
          .in("asset_id", ids)
          .in("variant_type", ["original", "thumbnail"])
          .like("mime_type", "image/%")
          .order("variant_type")
      : null;
  const previews = new Map<string, string>();
  if (client && variants?.data?.length) {
    const safe = variants.data.filter((v) =>
      v.storage_path.startsWith(
        `tenants/${session.tenantId}/assets/${v.asset_id}/`,
      ),
    );
    const signed = await client.storage.from("tenant-media").createSignedUrls(
      safe.map((v) => v.storage_path),
      600,
    );
    for (const [index, variant] of safe.entries()) {
      const url = signed.data?.[index]?.signedUrl;
      if (url) previews.set(variant.asset_id, url);
    }
  }
  const items: ContentItem[] = rows.map((item) => ({
    id: item.id,
    key: item.content_key,
    title: item.title,
    kind: item.kind,
    family: item.family,
    status: item.status,
    archived: item.archived,
    orientation: item.orientation,
    duration:
      item.duration_seconds === null ? null : Number(item.duration_seconds),
    width: item.width,
    height: item.height,
    preview: previews.get(item.preview_asset_id) ?? null,
    href:
      item.kind === "media"
        ? item.media_frame_id ? `/dashboard/content/media/${item.media_frame_id}` : ["ready", "archived"].includes(item.status) ? `/dashboard/content/media/source/${item.id}` : `/dashboard/media?asset=${item.id}`
        : item.kind === "dynamic"
          ? ["menu", "price_list"].includes(item.family)
            ? `/dashboard/slides/menu-studio/${item.id}`
            : `/dashboard/slides/${item.id}`
          : `/dashboard/studio/${item.id}`,
    placement: readContentPlacement(item.placement),
    revision: item.revision === null ? null : Number(item.revision),
    restoreKey: item.archived && item.kind === "media" ? randomUUID() : undefined,
    mediaFrameId: item.media_frame_id ?? undefined,
    mediaFrameVersionId: item.media_frame_version_id ?? undefined,
  }));
  const studioIds = items.filter(item => item.kind === "studio").map(item => item.id);
  const frameIds = items.flatMap(item => item.mediaFrameId ? [item.mediaFrameId] : []);
  if (client && frameIds.length) {
    const versionIds = items.flatMap(item => item.mediaFrameVersionId ? [item.mediaFrameVersionId] : []);
    const [versions, refs] = await Promise.all([
      client.from("media_frame_versions").select("id,frame_id,settings_json").eq("tenant_id", session.tenantId!).in("id", versionIds),
      client.from("media_frame_version_assets").select("version_id,role,media_asset_id,storage_bucket,storage_path,mime_type,checksum_sha256").eq("tenant_id", session.tenantId!).in("version_id", versionIds),
    ]);
    const safeRefs = !refs.error ? (refs.data ?? []).filter(ref => ref.storage_bucket === "tenant-media" && typeof ref.storage_path === "string" && ref.storage_path.startsWith(`tenants/${session.tenantId}/assets/${ref.media_asset_id}/`) && !ref.storage_path.split("/").some((part: string) => part === "." || part === "..") && !(/[\\?#]/.test(ref.storage_path) || Array.from(ref.storage_path).some(character => character.charCodeAt(0) < 32))) : [];
    const paths = [...new Set(safeRefs.map(ref => String(ref.storage_path)))];
    const urls = paths.length ? await client.storage.from("tenant-media").createSignedUrls(paths, 600) : null;
    const byPath = new Map(paths.map((path, index) => [path, urls?.data?.[index]?.signedUrl]));
    for (const item of items.filter(item => item.mediaFrameId)) {
      item.preview = null;
      const version = !versions.error ? versions.data.find(row => row.id === item.mediaFrameVersionId && row.frame_id === item.mediaFrameId) : undefined;
      const parsed = mediaFrameSettingsSchema.safeParse(version?.settings_json);
      if (!parsed.success) continue;
      const settings = parsed.data, choice = settings.appearance.background;
      item.themeName = settings.appearance.themeId === "fieldflow" ? "FieldFlow" : "OnzeTrots TV";
      const main = safeRefs.find(ref => ref.version_id === item.mediaFrameVersionId && ref.role === "media");
      const background = choice.kind === "image" ? safeRefs.find(ref => ref.version_id === item.mediaFrameVersionId && ref.role === "background" && ref.media_asset_id === choice.mediaAssetId && ref.mime_type.startsWith("image/")) : undefined;
      const sourceUrl = main ? byPath.get(main.storage_path) : undefined, backgroundUrl = background ? byPath.get(background.storage_path) : undefined;
      if (!main || !sourceUrl || choice.kind === "image" && (!backgroundUrl || !/^[a-f0-9]{64}$/.test(String(background?.checksum_sha256)))) continue;
      item.mediaFramePreview = { settings, sourceUrl, kind: main.mime_type === "video/mp4" ? "video" : "image", ...(backgroundUrl ? { backgroundUrl, backgroundChecksumSha256: background!.checksum_sha256 } : {}) };
    }
  }
  if (client && studioIds.length) {
    const themes = await client.from("studio_project_drafts").select("project_id,theme:document_json->syncPresentation->>theme")
      .eq("tenant_id", session.tenantId!).in("project_id", studioIds);
    if (!themes.error) for (const item of items) {
      const theme = themes.data.find(row => row.project_id === item.id)?.theme;
      item.themeName = theme === "fieldflow" ? "FieldFlow" : theme === "onzetrots-tv" ? "OnzeTrots TV" : null;
    }
  }
  const href = (target: number, nextFilter = filter) =>
    `/dashboard/content?${new URLSearchParams({ q: query, filter: nextFilter, page: String(target) })}`;
  const canCreate =
    hasCapability(session.capabilities, "tenant.studio.create") &&
    session.tenantStatus === "active";
  const canUpload =
    hasCapability(session.capabilities, "tenant.media.write") &&
    session.tenantStatus === "active";
  const publicConfig = getSupabasePublicConfig();
  return (
    <div className="vc-content-page">
      <header className="section-header">
        <div>
          <div className="eyebrow">JE CREATIEVE THUISBASIS</div>
          <h1>Contentbibliotheek</h1>
          <p>
            Al je ontwerpen, beelden en video&apos;s. Op één plek, klaar voor je
            schermen.
          </p>
        </div>
        <div className="row">
          {canUpload && (
            <Link
              className="btn btn-secondary"
              href="/dashboard/content?upload=1"
            >
              <Upload size={18} strokeWidth={1.7}/>
              Media uploaden
            </Link>
          )}
          {canCreate && (
            <SyncStudioCreateDialog tenantId={session.tenantId} tenantName={session.tenant} canCreate={canCreate && session.isLive}/>
          )}
        </div>
      </header>
      <div className="vc-library-stats">
        <span>
          <strong>{failed ? "—" : (live?.count ?? 0)}</strong> items in je
          bibliotheek
        </span>
        <span>
          <i className="green-dot" />
          {failed ? "—" : (ready?.count ?? 0)} gereed voor gebruik
        </span>
        {!failed && (processing?.count ?? 0) > 0 && (
          <span>
            <Loader2 size={14} className="vc-spin" />
            {processing!.count} in verwerking
          </span>
        )}
        <span className="vc-library-stats-end">
          <ShieldCheck size={14} />
          {session.tenant}
        </span>
      </div>
      {failed && (
        <div className="vc-content-empty" role="alert">
          <h2>De bibliotheek kon niet worden geladen</h2>
          <p>
            De gegevens zijn niet gewijzigd. Vernieuw de pagina om opnieuw te
            proberen.
          </p>
          <Link href={href(page)}>Opnieuw proberen</Link>
        </div>
      )}
      <ContentWorkspace
        key={`${query}:${filter}:${page}`}
        items={failed ? [] : items}
        canCreate={!failed && canCreate}
        canAdd={
          !failed &&
          session.isLive &&
          session.tenantStatus === "active" &&
          hasCapability(session.capabilities, "tenant.playlist.write")
        }
        actionScope={session.isLive && session.tenantId && session.userId ? `${session.tenantId}:${session.userId}` : undefined}
        canArchiveMedia={canUpload && session.isLive}
        canArchiveStudio={session.isLive && session.tenantStatus === "active" && hasCapability(session.capabilities, "tenant.studio.archive")}
        canDuplicateStudio={canCreate && session.isLive && (hasCapability(session.capabilities, "tenant.studio.edit_own") || hasCapability(session.capabilities, "tenant.studio.edit_all"))}
        query={query}
        filter={filter}
      >
        <nav className="vc-filter-tabs" aria-label="Contentfilter">
          {filters.map(([id, label]) => (
            <Link
              key={id}
              href={href(1, id)}
              className={filter === id ? "active" : undefined}
              aria-current={filter === id ? "page" : undefined}
            >
              {label}
              {id === "all" && <span>{failed ? "—" : (live?.count ?? 0)}</span>}
            </Link>
          ))}
        </nav>
      </ContentWorkspace>
      {!failed && rows.length === 0 && (
        <div className="vc-content-empty">
          <Search size={28} aria-hidden="true"/>
          <h2 className="vc-content-empty__title">Geen content gevonden</h2>
          <p>Probeer een andere zoekterm of kies een ander filter.</p>
          <Link className="btn btn-secondary" href="/dashboard/content">
            Filters wissen
          </Link>
        </div>
      )}
      {!failed && (result?.count ?? 0) > size && (
        <nav aria-label="Pagina’s in de contentbibliotheek" className="row">
          {page > 1 && <Link href={href(page - 1)}>Vorige</Link>}
          <span>
            Pagina {page} van {Math.ceil((result?.count ?? 0) / size)}
          </span>
          {page * size < (result?.count ?? 0) && (
            <Link href={href(page + 1)}>Volgende</Link>
          )}
        </nav>
      )}
      <MediaUploadDialog
        anonKey={publicConfig?.anonKey ?? ""}
        canUpload={session.isLive && canUpload && Boolean(publicConfig)}
        closeHref={href(page)}
        open={params.upload === "1"}
        supabaseUrl={publicConfig?.url ?? ""}
      />
    </div>
  );
}
