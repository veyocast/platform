import { hasCapability } from "@veyocast/auth";
import { Loader2, Search, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";
import { requireTenantControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { getSupabasePublicConfig } from "../../../../lib/supabase/config";
import { MediaUploadDialog } from "../media/media-overlays";
import { SyncStudioCreateDialog } from "../studio/sync-studio-create-dialog";
import { ContentWorkspace } from "./content-workspace";
import { contentLibraryColumns, mapContentLibraryRows } from "./content-data.server";

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
      contentLibraryColumns,
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
  const items = await mapContentLibraryRows(client, session.tenantId!, rows);
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
