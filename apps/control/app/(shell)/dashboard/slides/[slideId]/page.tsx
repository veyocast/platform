import Image from "next/image";
import Link from "next/link";
import { ListPlus, RefreshCw } from "lucide-react";
import { notFound } from "next/navigation";

import { hasCapability } from "@veyocast/auth";
import { Button } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { PageHeader } from "../../../_components/shell-primitives";
import styles from "../../dynamic-content.module.css";
import {
  addDynamicSlideToPlaylist,
  refreshDynamicSlide
} from "../actions";

type PageProps = {
  params: Promise<{ slideId: string }>;
  searchParams: Promise<{ fout?: string; succes?: string }>;
};

export default async function SlideDetailPage({ params, searchParams }: PageProps) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.read");
  const { slideId } = await params;
  const query = await searchParams;
  const data = session.isLive
    ? await loadSlide(slideId, session.tenantId!)
    : null;
  if (!data) notFound();
  const canWrite = hasCapability(session.capabilities, "tenant.dynamic_slide.write");
  const canAdd = data.slide.status === "ready" &&
    hasCapability(session.capabilities, "tenant.playlist.write");

  return (
    <>
      <PageHeader
        actions={<div className={styles.heroActions}><Button asChild variant="ghost"><Link href="/dashboard/slides">Terug</Link></Button>{canWrite ? <form action={refreshDynamicSlide}><input name="slideId" type="hidden" value={slideId} /><Button type="submit" variant="secondary"><RefreshCw aria-hidden="true" />Nieuwe snapshot</Button></form> : null}</div>}
        description="Controleer de huidige immutable output en voeg die bewust toe aan een playlistconcept."
        eyebrow={session.tenant}
        status={slideStatus(data.slide.status)}
        title={data.slide.name}
      />
      {query.fout ? <p className="notice notice--critical" role="alert">{query.fout}</p> : null}
      {query.succes ? <p className="notice notice--success" role="status">{query.succes}</p> : null}
      <div className={styles.split}>
        <section className={styles.card} aria-labelledby="slide-preview-title">
          <h2 className="sr-only" id="slide-preview-title">Huidige output</h2>
          <div className={styles.preview} data-orientation={data.slide.orientation}>
            {data.previewUrl ? <Image alt={`Huidige output van ${data.slide.name}`} fill sizes="70vw" src={data.previewUrl} unoptimized /> : <div className={styles.previewPlaceholder}><RefreshCw aria-hidden="true" /><span>De eerste workerpreview is nog niet gereed.</span></div>}
          </div>
          <div className={styles.cardBody}>
            <dl className={styles.definitionList}>
              <div><dt>Type</dt><dd>{data.slide.slide_type === "menu" ? "Menubord" : "Nieuws"}</dd></div>
              <div><dt>Formaat</dt><dd>{data.slide.orientation === "portrait" ? "Staand" : "Liggend"}</dd></div>
              <div><dt>Selectie</dt><dd>{data.slide.selection_mode === "latest" ? "Nieuwste goede snapshot" : "Vastgezet"}</dd></div>
              <div><dt>Laatste foutcode</dt><dd>{data.slide.last_error_code ?? "Geen"}</dd></div>
            </dl>
          </div>
        </section>
        <aside className={styles.formSection}>
          <h2>Beschikbaar in playlistmaker</h2>
          <p className={styles.muted}>De huidige PNG wordt als normale mediareferentie toegevoegd. Een latere bronupdate wijzigt deze conceptregel niet stilzwijgend.</p>
          {canAdd && data.playlists.length ? (
            <form action={addDynamicSlideToPlaylist} className={styles.form}>
              <input name="slideId" type="hidden" value={slideId} />
              <label className={styles.field}><span>Playlistconcept</span><select name="playlistId">{data.playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}</select></label>
              <label className={styles.field}><span>Duur in seconden</span><input defaultValue="10" min="5" max="3600" name="duration" type="number" /></label>
              <Button type="submit"><ListPlus aria-hidden="true" />Aan playlist toevoegen</Button>
            </form>
          ) : <p className="notice notice--warning">{data.slide.status === "ready" ? "Maak eerst een playlistconcept of vraag schrijfrechten." : "Wacht tot de snapshot gereed is."}</p>}
        </aside>
      </div>
    </>
  );
}

async function loadSlide(slideId: string, tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return null;
  const [slideResult, playlistsResult] = await Promise.all([
    supabase.from("dynamic_slides").select("*").eq("tenant_id", tenantId).eq("id", slideId).maybeSingle(),
    supabase.from("playlists").select("id, name").eq("tenant_id", tenantId).neq("status", "archived").order("name")
  ]);
  if (!slideResult.data || slideResult.error) return null;
  let previewUrl: string | null = null;
  if (slideResult.data.current_snapshot_id) {
    const snapshot = await supabase.from("dynamic_slide_snapshots").select("output_media_asset_id").eq("id", slideResult.data.current_snapshot_id).maybeSingle();
    if (snapshot.data?.output_media_asset_id) {
      const variant = await supabase.from("media_variants").select("storage_path").eq("asset_id", snapshot.data.output_media_asset_id).eq("variant_type", "original").maybeSingle();
      if (variant.data?.storage_path) {
        const signed = await supabase.storage.from("tenant-media").createSignedUrl(variant.data.storage_path, 600);
        previewUrl = signed.data?.signedUrl ?? null;
      }
    }
  }
  return {
    playlists: playlistsResult.data ?? [],
    previewUrl,
    slide: slideResult.data
  };
}

function slideStatus(status: string) {
  if (status === "ready") return { label: "Gereed", tone: "success" as const };
  if (status === "rendering") return { label: "Renderen", tone: "info" as const };
  if (status === "error") return { label: "Herstel nodig", tone: "critical" as const };
  return { label: "Concept", tone: "neutral" as const };
}
