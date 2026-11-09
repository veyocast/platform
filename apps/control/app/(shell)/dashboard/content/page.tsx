import { hasCapability } from "@veyocast/auth";
import { Loader2, Search, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { getSupabasePublicConfig } from "../../../../lib/supabase/config";
import { MediaUploadDialog } from "../media/media-overlays";
import { SyncStudioCreateDialog } from "../studio/sync-studio-create-dialog";
import { ContentWorkspace } from "./content-workspace";

import { requireContentSession } from "./content-access.server";
import { contentFilters, contentStatuses, contentLibraryHref, parseContentLibraryQuery } from "./content-library";
import { loadContentLibrary } from "./content-library-data.server";
import { loadContentLiveSport } from "./content-live-data.server";
import styles from "./content-workspace.module.css";

export default async function ContentLibrary({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireContentSession();
  const params = await searchParams;
  const state = parseContentLibraryQuery(params);
  const { query, filter, page, size } = state;
  const client = session.isLive && session.tenantId ? await createControlSupabaseClient() : null;
  const [library, liveSport] = await Promise.all([
    loadContentLibrary(client, session.tenantId, session.capabilities, state),
    loadContentLiveSport(client, session.tenantId, session.capabilities, query, state.status === "archive"),
  ]);
  const { failed, items, count, total, ready, processing } = library;
  const href = (target: number) => contentLibraryHref(state, { page: target });
  const canCreateManual = session.tenantStatus === "active" && hasCapability(session.capabilities, "tenant.studio.create");
  const canCreateConnected = session.tenantStatus === "active" && hasCapability(session.capabilities, "tenant.dynamic_slide.write");
  const canCreate =
    (hasCapability(session.capabilities, "tenant.studio.create") || hasCapability(session.capabilities, "tenant.dynamic_slide.write")) &&
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
            Ontwerpen, automatische slides, menu’s en media voor je schermen.
          </p>
        </div>
        <div className="row">
          {canUpload && (
            <Link
              className="btn btn-secondary"
              href={`${href(page)}&upload=1`}
            >
              <Upload size={18} strokeWidth={1.7}/>
              Media uploaden
            </Link>
          )}
          {canCreate && (
            <SyncStudioCreateDialog tenantId={session.tenantId} tenantName={session.tenant} actorScope={`${session.tenantId}:${session.userId}`} canCreate={canCreate && session.isLive} canCreateManual={canCreateManual} canCreateConnected={canCreateConnected} liveSportAvailable={liveSport.available}/>
          )}
        </div>
      </header>
      <div className="vc-library-stats">
        <span>
          <strong>{failed ? "—" : total}</strong> items in je
          bibliotheek
        </span>
        <span>
          <i className="green-dot" />
          {failed ? "—" : ready} gereed voor gebruik
        </span>
        {!failed && processing > 0 && (
          <span>
            <Loader2 size={14} className="vc-spin" />
            {processing} in verwerking
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
      <nav className={styles.context} aria-label="Contentstatus">{contentStatuses.map(([id, label]) => <Link key={id} href={contentLibraryHref(state, { status: id, page: 1 })} aria-current={state.status === id ? "page" : undefined}>{label}</Link>)}</nav>
      <nav className={styles.context} aria-label="Content beheren">
        {hasCapability(session.capabilities, "tenant.media.read") && ["all", "media"].includes(filter) && <Link href="/dashboard/media">Mappen, tags en mediaverwerking</Link>}
        {hasCapability(session.capabilities, "tenant.studio.read") && ["all", "designs", "series", "slides"].includes(filter) && <Link href="/dashboard/studio?advanced=1">Ontwerpbeheer en exports</Link>}
        {hasCapability(session.capabilities, "tenant.dynamic_slide.read") && ["all", "automatic", "menus", "slides"].includes(filter) && <Link href="/dashboard/slides">Slideversies en verwerking</Link>}
        {hasCapability(session.capabilities, "tenant.product.read") && filter === "menus" && <Link href="/dashboard/products">Producten beheren</Link>}
      </nav>
      <ContentWorkspace
        key={`${query}:${filter}:${state.status}:${page}`}
        items={failed ? [] : items}
        canCreate={!failed && session.isLive && canCreate}
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
        status={state.status}
        pageSize={size}
      >
        <nav className={`vc-filter-tabs ${styles.filters}`} aria-label="Contenttype">
          {contentFilters.map(([id, label]) => (
            <Link
              key={id}
              href={contentLibraryHref(state, { filter: id, page: 1 })}
              className={filter === id ? "active" : undefined}
              aria-current={filter === id ? "page" : undefined}
            >
              {label}
              {id === "all" && <span>{failed ? "—" : total}</span>}
            </Link>
          ))}
        </nav>
      </ContentWorkspace>
      {!failed && items.length === 0 && (
        <div className="vc-content-empty">
          <Search size={28} aria-hidden="true"/>
          <h2 className="vc-content-empty__title">Geen content gevonden</h2>
          <p>Probeer een andere zoekterm of kies een ander filter.</p>
          <Link className="btn btn-secondary" href="/dashboard/content">
            Filters wissen
          </Link>
        </div>
      )}
      {!failed && (count > size || page > 1) && (
        <nav aria-label="Pagina’s in de contentbibliotheek" className={styles.pagination}>
          {page > 1 && <Link href={href(page - 1)}>Vorige</Link>}
          <span>
            Pagina {page} van {Math.max(1, Math.ceil(count / size))}
          </span>
          {page * size < count && (
            <Link href={href(page + 1)}>Volgende</Link>
          )}
        </nav>
      )}
      {filter === "menus" && canCreateConnected && <p><Link className="btn btn-secondary" href="/dashboard/slides/menu-studio/new">Nieuw menu</Link></p>}
      {liveSport.available && state.status === "active" && ["all", "automatic", "slides"].includes(filter) && <section className={styles.liveSport} aria-labelledby="content-live-sport"><h2 id="content-live-sport">Live sport en doelpuntenoverlays</h2><p>Deze ontwerpen behouden hun eigen live-editor, versies en schermkeuze.</p>{liveSport.failed ? <p role="alert">De overlays konden niet worden geladen. Er is niets gewijzigd; vernieuw de pagina.</p> : liveSport.items.length ? <ul>{liveSport.items.map(item => <li key={item.id}><Link href={item.href}>{item.name}</Link></li>)}</ul> : <p>Geen overlays gevonden voor deze selectie.</p>}<Link href="/dashboard/studio/led-scores">{liveSport.more ? "Alle overlays en live sport beheren" : "Live sport beheren"}</Link></section>}
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
