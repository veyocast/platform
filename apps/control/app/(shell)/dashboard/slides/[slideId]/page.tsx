import Image from "next/image";
import Link from "next/link";
import { ListPlus, PencilLine, RefreshCw } from "lucide-react";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

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
import { createOrResumeDynamicSlideVersion } from "../version-actions";
import { loadDynamicSlideVersionState } from "../version-data";
import { slideEditorKind } from "../slide-management";
import { VersionHistory } from "../version-history";

type PageProps = {
  params: Promise<{ slideId: string }>;
  searchParams: Promise<{ fout?: string; succes?: string }>;
};

type NewsPreviewStyle = CSSProperties & {
  "--news-accent": string;
};

export default async function SlideDetailPage({ params, searchParams }: PageProps) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.read");
  const { slideId } = await params;
  const query = await searchParams;
  const data = session.isLive
    ? await loadSlide(slideId, session.tenantId!)
    : null;
  if (!data) notFound();
  const versionState = session.isLive
    ? await loadDynamicSlideVersionState(session.tenantId!, slideId)
    : null;
  const canWrite = hasCapability(session.capabilities, "tenant.dynamic_slide.write");
  const isVersionedSportlink = slideEditorKind(data.slide.configuration_json) === "sportlink";
  const activeVersion = versionState?.versions.find((version) =>
    version.id === versionState.activeDraftVersionId
  );
  const canAdd = data.slide.status === "ready" &&
    hasCapability(session.capabilities, "tenant.playlist.write");

  return (
    <>
      <PageHeader
        actions={<div className={styles.heroActions}>
          <Button asChild variant="ghost"><Link href="/dashboard/slides">Terug</Link></Button>
          {canWrite && isVersionedSportlink && activeVersion?.status === "draft" ? (
            <Button asChild variant="secondary"><Link href={`/dashboard/slides/${slideId}/edit`}><PencilLine aria-hidden="true" />Concept verder bewerken</Link></Button>
          ) : canWrite && isVersionedSportlink && activeVersion?.status === "publishing" ? (
            <Button disabled variant="secondary"><RefreshCw aria-hidden="true" />Nieuwe versie wordt gepubliceerd</Button>
          ) : canWrite && isVersionedSportlink && versionState?.currentVersionId ? (
            <form action={createOrResumeDynamicSlideVersion}>
              <input name="editor" type="hidden" value="sportlink" />
              <input name="slideId" type="hidden" value={slideId} />
              <Button type="submit" variant="secondary"><PencilLine aria-hidden="true" />Nieuwe versie maken</Button>
            </form>
          ) : null}
          {canWrite && !versionState?.activeDraftVersionId ? <form action={refreshDynamicSlide}><input name="slideId" type="hidden" value={slideId} /><Button type="submit" variant="secondary"><RefreshCw aria-hidden="true" />Nieuwe snapshot</Button></form> : null}
        </div>}
        description="Controleer de huidige immutable output en voeg die bewust toe aan een playlistconcept."
        eyebrow={session.tenant}
        status={slideStatus(data.slide.status)}
        title={data.slide.library_name ?? data.slide.name}
      />
      {query.fout ? <p className="notice notice--critical" role="alert">{query.fout}</p> : null}
      {query.succes ? <p className="notice notice--success" role="status">{query.succes}</p> : null}
      <div className={styles.split}>
        <section className={styles.card} aria-labelledby="slide-preview-title">
          <h2 className="sr-only" id="slide-preview-title">
            Huidige HTML/CSS-weergave
          </h2>
          <div
            className={`${styles.preview} ${
              data.newsPreview ? styles.newsPreviewStage : ""
            }`}
            data-orientation={data.slide.orientation}
          >
            {data.newsPreview ? (
              <div
                className={styles.newsHtmlPreview}
                style={{
                  "--news-accent": data.newsPreview.primaryColor
                } as NewsPreviewStyle}
              >
                {data.newsPreview.heroUrl ? (
                  <Image
                    alt=""
                    className={styles.newsHtmlPreviewHero}
                    fill
                    sizes="70vw"
                    src={data.newsPreview.heroUrl}
                    unoptimized
                  />
                ) : null}
                <span
                  aria-hidden="true"
                  className={styles.newsHtmlPreviewGrade}
                />
                <header>
                  {data.newsPreview.logoUrl ? (
                    <Image
                      alt={data.newsPreview.sourceName}
                      height={75}
                      src={data.newsPreview.logoUrl}
                      unoptimized
                      width={130}
                    />
                  ) : (
                    <strong>{data.newsPreview.sourceName}</strong>
                  )}
                  <p>{data.newsPreview.sectionTitle}</p>
                </header>
                <article>
                  <h3>{data.newsPreview.articleTitle}</h3>
                  <span aria-hidden="true" />
                  <p>{data.newsPreview.intro}</p>
                  <small>{data.newsPreview.meta}</small>
                </article>
              </div>
            ) : data.previewUrl ? (
              <Image alt={`Offline fallback van ${data.slide.name}`} fill sizes="70vw" src={data.previewUrl} unoptimized />
            ) : (
              <div className={styles.previewPlaceholder}><RefreshCw aria-hidden="true" /><span>De eerste workerpreview is nog niet gereed.</span></div>
            )}
          </div>
          <div className={styles.cardBody}>
            <dl className={styles.definitionList}>
              <div><dt>Type</dt><dd>{slideTypeLabel(data.slide.slide_type)}</dd></div>
              <div><dt>Formaat</dt><dd>{data.slide.orientation === "portrait" ? "Staand" : "Liggend"}</dd></div>
              <div><dt>Selectie</dt><dd>{data.slide.selection_mode === "latest" ? "Nieuwste goede snapshot" : "Vastgezet"}</dd></div>
              {data.sportSelection?.team ? (
                <div>
                  <dt>Team</dt>
                  <dd>{data.sportSelection.team}</dd>
                </div>
              ) : null}
              {data.sportSelection?.competition ? (
                <div>
                  <dt>Competitie / fase</dt>
                  <dd>{data.sportSelection.competition}</dd>
                </div>
              ) : null}
              {data.newsPlayback ? (
                <div>
                  <dt>Afspelen</dt>
                  <dd>
                    {data.newsPlayback.slideCount} slides ×{" "}
                    {data.newsPlayback.secondsPerSlide} seconden
                  </dd>
                </div>
              ) : null}
              <div><dt>Laatste foutcode</dt><dd>{data.slide.last_error_code ?? "Geen"}</dd></div>
            </dl>
          </div>
        </section>
        <aside className={styles.formSection}>
          <h2>Beschikbaar in playlistmaker</h2>
          <p className={styles.muted}>
            De Player toont deze slide als echte HTML/CSS. De immutable PNG
            blijft uitsluitend beschikbaar als technische offline fallback
            voor oudere apparaten.
          </p>
          {canAdd && data.playlists.length ? (
            <form action={addDynamicSlideToPlaylist} className={styles.form}>
              <input name="slideId" type="hidden" value={slideId} />
              <label className={styles.field}><span>Playlistconcept</span><select name="playlistId">{data.playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}</select></label>
              {data.newsPlayback ? (
                <>
                  <input
                    name="duration"
                    type="hidden"
                    value={data.newsPlayback.totalSeconds}
                  />
                  <p className={styles.inlineGuidance}>
                    <strong>
                      Totale duur: {data.newsPlayback.totalSeconds} seconden
                    </strong>
                    <span>
                      De ingestelde tijd per nieuwsslide wordt automatisch
                      toegepast.
                    </span>
                  </p>
                </>
              ) : (
                <label className={styles.field}><span>Duur in seconden</span><input defaultValue="10" min="5" max="3600" name="duration" type="number" /></label>
              )}
              <Button type="submit"><ListPlus aria-hidden="true" />Aan playlist toevoegen</Button>
            </form>
          ) : <p className="notice notice--warning">{data.slide.status === "ready" ? "Maak eerst een playlistconcept of vraag schrijfrechten." : "Wacht tot de snapshot gereed is."}</p>}
        </aside>
      </div>
      {versionState ? <VersionHistory canWrite={canWrite} editor="sportlink" slideId={slideId} versions={versionState.versions} /> : null}
    </>
  );
}

async function loadSlide(slideId: string, tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return null;
  const [slideResult, playlistsResult] = await Promise.all([
    supabase.from("dynamic_slides").select("*").eq("tenant_id", tenantId).eq("id", slideId).maybeSingle(),
    supabase.from("playlists").select("id, name, revision").eq("tenant_id", tenantId).neq("status", "archived").order("name")
  ]);
  if (!slideResult.data || slideResult.error) return null;
  const currentVersion = slideResult.data.current_published_version_id
    ? await supabase
      .from("dynamic_slide_versions")
      .select("name,slide_type,orientation,selection_mode,configuration_json,template_version_id,data_source_id")
      .eq("tenant_id", tenantId)
      .eq("id", slideResult.data.current_published_version_id)
      .maybeSingle()
    : null;
  const slide = currentVersion?.data ? {
    ...slideResult.data,
    ...currentVersion.data
  } : slideResult.data;
  let previewUrl: string | null = null;
  let newsPreview: {
    articleTitle: string;
    heroUrl: string | null;
    intro: string;
    logoUrl: string | null;
    meta: string;
    primaryColor: string;
    sectionTitle: string;
    sourceName: string;
  } | null = null;
  let newsPlayback: {
    secondsPerSlide: number;
    slideCount: number;
    totalSeconds: number;
  } | null = null;
  let sportSelection: {
    competition: string | null;
    team: string | null;
  } | null = null;
  if (slide.current_snapshot_id) {
    const snapshot = await supabase.from("dynamic_slide_snapshots").select("output_media_asset_id, snapshot_data_json").eq("id", slide.current_snapshot_id).maybeSingle();
    if (snapshot.data?.output_media_asset_id) {
      const variant = await supabase.from("media_variants").select("storage_path").eq("asset_id", snapshot.data.output_media_asset_id).eq("variant_type", "original").maybeSingle();
      if (variant.data?.storage_path) {
        const signed = await supabase.storage.from("tenant-media").createSignedUrl(variant.data.storage_path, 600);
        previewUrl = signed.data?.signedUrl ?? null;
      }
    }
    if (slide.slide_type === "news" && snapshot.data) {
      const snapshotData = readRecord(snapshot.data.snapshot_data_json);
      const news = readRecord(snapshotData?.news);
      const brand = readRecord(snapshotData?.brand);
      const articles = Array.isArray(news?.articles) ? news.articles : [];
      const article = readRecord(articles[0]);
      const secondsPerSlide = boundedInteger(
        news?.secondsPerSlide,
        5,
        120,
        5
      );
      const slideCount = Math.max(articles.length, 1);
      newsPlayback = {
        secondsPerSlide,
        slideCount,
        totalSeconds: slideCount * secondsPerSlide
      };
      if (article) {
        const [heroUrl, logoUrl] = await Promise.all([
          signedMediaUrl(supabase, article.heroMediaAssetId),
          signedMediaUrl(supabase, news?.providerLogoMediaAssetId)
        ]);
        const author = safeString(article.author);
        const sourceName = safeString(news?.sourceName) || "Clubnieuws";
        newsPreview = {
          articleTitle: safeString(article.title) || "Actueel nieuws",
          heroUrl,
          intro: safeString(article.intro),
          logoUrl,
          meta: [
            formatNewsDate(article.publishedAt),
            author || sourceName
          ].filter(Boolean).join(" · "),
          primaryColor: normalizePrimaryColor(brand?.primaryColor),
          sectionTitle: safeString(news?.title) || "Nieuws",
          sourceName
        };
      }
    }
    if (slide.slide_type.startsWith("sport_") && snapshot.data) {
      const snapshotData = readRecord(snapshot.data.snapshot_data_json);
      const sport = readRecord(snapshotData?.sport);
      const selection = readRecord(sport?.selection);
      const team = readRecord(selection?.team);
      const competition = readRecord(selection?.competition);
      const competitionParts = [
        safeString(competition?.type),
        safeString(competition?.name),
        safeString(competition?.period),
        safeString(competition?.poolName)
      ].filter((value, index, values) =>
        Boolean(value) &&
        values.findIndex((candidate) =>
          candidate.toLocaleLowerCase("nl-NL") ===
          value.toLocaleLowerCase("nl-NL")
        ) === index
      );
      if (team || competition) {
        sportSelection = {
          competition: competitionParts.join(" · ") || null,
          team: safeString(team?.name) || null
        };
      }
    }
  }
  return {
    newsPlayback,
    newsPreview,
    playlists: playlistsResult.data ?? [],
    previewUrl,
    slide,
    sportSelection
  };
}

async function signedMediaUrl(
  supabase: NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>,
  value: unknown
) {
  if (typeof value !== "string" || !uuidPattern.test(value)) return null;
  const variant = await supabase
    .from("media_variants")
    .select("storage_bucket, storage_path")
    .eq("asset_id", value)
    .eq("variant_type", "original")
    .maybeSingle();
  if (!variant.data || variant.error) return null;
  const signed = await supabase.storage
    .from(variant.data.storage_bucket)
    .createSignedUrl(variant.data.storage_path, 600);
  return signed.data?.signedUrl ?? null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}


function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePrimaryColor(value: unknown) {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value)
    ? value.toUpperCase()
    : "#FF5C20";
}

function boundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number
) {
  const numeric = Number(value);
  return Number.isInteger(numeric)
    ? Math.min(maximum, Math.max(minimum, numeric))
    : fallback;
}

function formatNewsDate(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    return "";
  }
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function slideStatus(status: string) {
  if (status === "ready") return { label: "Gereed", tone: "success" as const };
  if (status === "rendering") return { label: "Renderen", tone: "info" as const };
  if (status === "error") return { label: "Herstel nodig", tone: "critical" as const };
  return { label: "Concept", tone: "neutral" as const };
}

function slideTypeLabel(value: string) {
  const labels: Record<string, string> = {
    menu: "Menubord",
    news: "Nieuws",
    sport_activities: "Clubagenda",
    sport_birthdays: "Jarigen",
    sport_cancellations: "Afgelastingen",
    sport_dressing_rooms: "Veld- en kleedkamerindeling",
    sport_match_of_the_day: "Match of the Day",
    sport_next_match: "Volgende wedstrijd",
    sport_officials: "Scheidsrechtersaanstellingen",
    sport_period_standing: "Periodestand",
    sport_program: "Programma",
    sport_referee_arrivals: "Aankomst scheidsrechters",
    sport_results: "Uitslagen",
    sport_sponsor: "Teamsponsor",
    sport_standing: "Competitiestand",
    sport_team: "Teamvoorstelling",
    sport_trainings: "Trainingsoverzicht",
    sport_volunteers: "Vrijwilligers",
    sport_visitor_arrivals: "Aankomst bezoekende teams"
  };
  return labels[value] ?? value;
}
