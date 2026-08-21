import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Layers3, RefreshCw, Sparkles, WandSparkles } from "lucide-react";

import { hasCapability } from "@veyocast/auth";
import { Button, SummaryStrip } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { PageHeader, StatusPill } from "../../_components/shell-primitives";
import styles from "../dynamic-content.module.css";

type PageProps = {
  searchParams: Promise<{ fout?: string; succes?: string }>;
};

export default async function SlidesPage({ searchParams }: PageProps) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.read");
  const params = await searchParams;
  const canWrite =
    session.isLive &&
    session.tenantStatus === "active" &&
    hasCapability(session.capabilities, "tenant.dynamic_slide.write");
  const [slides, menuStudioEnabled] = session.isLive
    ? await Promise.all([
        loadSlides(session.tenantId!),
        loadMenuStudioEnabled(session.tenantId!)
      ])
    : [[], false];

  return (
    <>
      <PageHeader
        actions={canWrite ? <div className={styles.heroActions}>{menuStudioEnabled ? <Button asChild><Link href="/dashboard/slides/menu-studio/new"><WandSparkles aria-hidden="true" />Open Menu Studio</Link></Button> : null}<Button asChild variant={menuStudioEnabled ? "secondary" : "primary"}><Link href="/dashboard/slides/new"><Sparkles aria-hidden="true" />Nieuwe dynamische slide</Link></Button></div> : null}
        description="Maak dynamische HTML/CSS-slides uit product- en nieuwsdata. Iedere snapshot krijgt daarnaast een immutable PNG als veilige fallback."
        eyebrow={session.tenant}
        title="Slides"
      />
      {params.fout ? <p className="notice notice--critical" role="alert">{params.fout}</p> : null}
      {params.succes ? <p className="notice notice--success" role="status">{params.succes}</p> : null}
      <SummaryStrip items={[
        { label: "Slides", value: slides.length },
        { label: "Gereed", value: slides.filter((slide) => slide.status === "ready").length },
        { label: "In verwerking", value: slides.filter((slide) => slide.status === "rendering").length }
      ]} />

      <section aria-labelledby="slides-list-title">
        <h2 className="sr-only" id="slides-list-title">Dynamische slides</h2>
        {slides.length ? (
          <div className={styles.grid}>
            {slides.map((slide) => (
              <article className={styles.card} key={slide.id}>
                <div className={styles.preview} data-orientation={slide.orientation}>
                  {slide.previewUrl ? (
                    <Image alt={`Voorbeeld van ${slide.name}`} fill sizes="(max-width: 680px) 100vw, 33vw" src={slide.previewUrl} unoptimized />
                  ) : (
                    <div className={styles.previewPlaceholder}>
                      {slide.status === "rendering" ? <RefreshCw aria-hidden="true" /> : <Layers3 aria-hidden="true" />}
                      <span>{slide.status === "rendering" ? "Immutable preview wordt gemaakt" : "Nog geen bruikbare preview"}</span>
                    </div>
                  )}
                  <span className={styles.previewTypeBadge}>
                    <Sparkles aria-hidden="true" />
                    HTML/CSS
                  </span>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardTop}>
                    <StatusPill {...slideStatus(slide.status)} />
                    <StatusPill {...dataHealthStatus(slide)} />
                  </div>
                  <div>
                    <h3 className={styles.cardTitle}>{slide.name}</h3>
                    <p className={styles.muted}>{slideTypeLabel(slide.slide_type)} · {slide.orientation === "portrait" ? "Staand" : "Liggend"} · {slide.selection_mode === "latest" ? "Volgt nieuwste snapshot" : "Vastgezet"}</p>
                    <p className={styles.cardDataMeta}>
                      {slide.itemCount} {slide.itemCount === 1 ? "item" : "items"} · {snapshotAge(slide.snapshotCreatedAt)}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="secondary"><Link href={slide.menuStudio ? `/dashboard/slides/menu-studio/${slide.id}` : `/dashboard/slides/${slide.id}`}>Open slide <ArrowRight aria-hidden="true" /></Link></Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={`empty-state ${styles.emptyState}`}>
            <Layers3 aria-hidden="true" />
            <h2>Nog geen dynamische slides</h2>
            <p>Kies een vast platformtemplate en koppel een gecontroleerde databron.</p>
            {canWrite ? <Button asChild><Link href="/dashboard/slides/new">Eerste slide maken</Link></Button> : null}
          </div>
        )}
      </section>
    </>
  );
}

async function loadMenuStudioEnabled(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return false;
  const result = await supabase
    .from("tenant_settings")
    .select("menu_document_v2_read_enabled, menu_studio_v2_authoring_enabled")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return !result.error && result.data?.menu_document_v2_read_enabled === true &&
    result.data.menu_studio_v2_authoring_enabled === true;
}

async function loadSlides(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("dynamic_slides")
    .select("id, name, slide_type, orientation, selection_mode, status, current_snapshot_id, data_source_id, last_error_code, updated_at, configuration_json")
    .eq("tenant_id", tenantId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("Dynamische slides laden mislukt", { code: error.code });
    return [];
  }
  const snapshotIds = (data ?? []).flatMap((slide) =>
    slide.current_snapshot_id ? [slide.current_snapshot_id] : []
  );
  const snapshots = snapshotIds.length
    ? await supabase
      .from("dynamic_slide_snapshots")
      .select("id, output_media_asset_id, snapshot_data_json, created_at, status, error_code")
      .in("id", snapshotIds)
    : { data: [], error: null };
  const assetIds = (snapshots.data ?? []).flatMap((snapshot) =>
    snapshot.output_media_asset_id ? [snapshot.output_media_asset_id] : []
  );
  const variants = assetIds.length
    ? await supabase
      .from("media_variants")
      .select("asset_id, storage_bucket, storage_path")
      .eq("variant_type", "original")
      .in("asset_id", assetIds)
    : { data: [], error: null };
  const signedUrls = new Map<string, string>();
  await Promise.all((variants.data ?? []).map(async (variant) => {
    const result = await supabase.storage
      .from(variant.storage_bucket)
      .createSignedUrl(variant.storage_path, 600);
    if (result.data?.signedUrl) signedUrls.set(variant.asset_id, result.data.signedUrl);
  }));
  const snapshotAssets = new Map(
    (snapshots.data ?? []).map((snapshot) => [
      snapshot.id,
      snapshot.output_media_asset_id
    ])
  );
  const snapshotById = new Map(
    (snapshots.data ?? []).map((snapshot) => [snapshot.id, snapshot])
  );
  return (data ?? []).map((slide) => ({
    ...slide,
    menuStudio: object(slide.configuration_json)?.schemaVersion === "menu-document.v2",
    itemCount: snapshotItemCount(
      slide.current_snapshot_id
        ? snapshotById.get(slide.current_snapshot_id)?.snapshot_data_json
        : null
    ),
    previewUrl: slide.current_snapshot_id
      ? signedUrls.get(snapshotAssets.get(slide.current_snapshot_id) ?? "") ?? null
      : null,
    snapshotCreatedAt: slide.current_snapshot_id
      ? snapshotById.get(slide.current_snapshot_id)?.created_at ?? null
      : null,
    snapshotErrorCode: slide.current_snapshot_id
      ? snapshotById.get(slide.current_snapshot_id)?.error_code ?? null
      : null
  }));
}

function slideStatus(status: string) {
  if (status === "ready") return { label: "Gereed", tone: "success" as const };
  if (status === "rendering") return { label: "Renderen", tone: "info" as const };
  if (status === "error") return { label: "Herstel nodig", tone: "critical" as const };
  return { label: "Concept", tone: "neutral" as const };
}

function dataHealthStatus(slide: {
  itemCount: number;
  last_error_code: string | null;
  snapshotCreatedAt: string | null;
  snapshotErrorCode: string | null;
}) {
  if (slide.last_error_code || slide.snapshotErrorCode) {
    return { label: "Laatste goede data", tone: "warning" as const };
  }
  if (!slide.itemCount) {
    return { label: "Geen inhoud", tone: "critical" as const };
  }
  const createdAt = slide.snapshotCreatedAt
    ? new Date(slide.snapshotCreatedAt).getTime()
    : 0;
  if (!createdAt || Date.now() - createdAt > 24 * 60 * 60 * 1000) {
    return { label: "Controleer actualiteit", tone: "warning" as const };
  }
  return { label: "Actuele inhoud", tone: "success" as const };
}

function snapshotItemCount(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const snapshot = value as Record<string, unknown>;
  const sport = object(snapshot.sport);
  if (Array.isArray(sport?.items)) return sport.items.length;
  const menu = object(snapshot.menu);
  if (Array.isArray(menu?.products)) return menu.products.length;
  const menuDocument = object(snapshot.menuDocument);
  if (Array.isArray(menuDocument?.pages)) {
    return menuDocument.pages.reduce((total, pageValue) => {
      const page = object(pageValue);
      if (!Array.isArray(page?.blocks)) return total;
      return total + page.blocks.reduce((pageTotal, blockValue) => {
        const block = object(blockValue);
        if (block?.type === "product-group") return pageTotal + 1;
        return pageTotal + (Array.isArray(block?.productNodes) ? block.productNodes.length : 0);
      }, 0);
    }, 0);
  }
  const news = object(snapshot.news);
  return Array.isArray(news?.articles) ? news.articles.length : 0;
}

function object(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function snapshotAge(value: string | null) {
  if (!value) return "nog geen snapshot";
  const elapsedMinutes = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 60_000)
  );
  if (elapsedMinutes < 2) return "zojuist bijgewerkt";
  if (elapsedMinutes < 60) return `${elapsedMinutes} min geleden bijgewerkt`;
  const hours = Math.round(elapsedMinutes / 60);
  if (hours < 24) return `${hours} uur geleden bijgewerkt`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "dag" : "dagen"} geleden bijgewerkt`;
}

function slideTypeLabel(value: string) {
  const labels: Record<string, string> = {
    menu: "Menubord",
    news: "Nieuws",
    sport_activities: "Clubagenda",
    sport_cancellations: "Afgelastingen",
    sport_dressing_rooms: "Veld- en kleedkamerindeling",
    sport_next_match: "Volgende wedstrijd",
    sport_officials: "Scheidsrechtersaanstellingen",
    sport_program: "Programma",
    sport_results: "Uitslagen",
    sport_standing: "Competitiestand"
  };
  return labels[value] ?? value.replace(/^sport_/, "").replaceAll("_", " ");
}
