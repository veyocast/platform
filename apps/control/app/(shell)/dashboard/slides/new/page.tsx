import Link from "next/link";
import { redirect } from "next/navigation";
import { Database, LayoutTemplate } from "lucide-react";

import { themeSelectionSchema } from "@veyocast/contracts";
import {
  platformDefaultThemeSelection,
  resolveThemeDefinition
} from "@veyocast/content-templates/theme-catalog";
import { Button, PageHeader } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import styles from "../../dynamic-content.module.css";
import {
  SlideComposerForm,
  type SlideSourceOption
} from "./slide-composer-form";

type PageProps = {
  searchParams: Promise<{ family?: string; fout?: string }>;
};

export default async function NewSlidePage({ searchParams }: PageProps) {
  const params = await searchParams;
  if (params.family !== "news") redirect("/dashboard/studio/new");

  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const data = session.isLive && session.tenantId
    ? await loadNewsOptions(session.tenantId)
    : {
        defaultThemeSelection: platformDefaultThemeSelection,
        primaryColor: resolveThemeDefinition(platformDefaultThemeSelection).accentDefault,
        sources: [] as SlideSourceOption[],
        templates: []
      };

  if (!data.sources.length || !data.templates.length) {
    return (
      <>
        <PageHeader
          actions={<Button asChild variant="secondary"><Link href="/dashboard/studio/new">Terug naar Studio</Link></Button>}
          breadcrumbs={[{ href: "/dashboard/studio", label: "Studio" }, { href: "/dashboard/studio/new", label: "Nieuwe slide" }, { label: "Nieuws & RSS" }]}
          description="Koppel een gecontroleerde bron en gebruik alleen gepubliceerde VeyoCast-templates."
          title="Nieuwsslide maken"
        />
        {params.fout ? <p className="notice notice--critical" role="alert"><strong>Slide niet gemaakt.</strong> {params.fout}</p> : null}
        {!data.sources.length ? (
          <section className={`empty-state ${styles.emptyState}`}>
            <Database aria-hidden="true" />
            <h2>Eerst een RSS- of Atom-bron nodig</h2>
            <p>Koppel en synchroniseer een publieke nieuwsbron. Een tijdelijke providerfout behoudt daarna altijd de laatste goede inhoud.</p>
            <Button asChild><Link href="/dashboard/data-sources">Databron toevoegen</Link></Button>
          </section>
        ) : (
          <section className={`empty-state ${styles.emptyState}`}>
            <LayoutTemplate aria-hidden="true" />
            <h2>Geen gepubliceerd nieuwstemplate</h2>
            <p>Een platformbeheerder moet eerst een geschikt Editorial Arena-nieuwstemplate publiceren.</p>
          </section>
        )}
      </>
    );
  }

  return (
    <>
      {params.fout ? <p className="notice notice--critical" role="alert"><strong>Slide niet gemaakt.</strong> {params.fout}</p> : null}
      <SlideComposerForm
        defaultThemeSelection={data.defaultThemeSelection}
        primaryColor={data.primaryColor}
        products={[]}
        sources={data.sources}
        templates={data.templates}
      />
    </>
  );
}

async function loadNewsOptions(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) {
    return {
      defaultThemeSelection: platformDefaultThemeSelection,
      primaryColor: resolveThemeDefinition(platformDefaultThemeSelection).accentDefault,
      sources: [] as SlideSourceOption[],
      templates: []
    };
  }
  const [sourcesResult, templatesResult, settingsResult] = await Promise.all([
    supabase
      .from("dynamic_data_sources")
      .select("id,name,kind,provider_status,last_successful_sync_at,last_error_code")
      .eq("tenant_id", tenantId)
      .eq("kind", "rss")
      .eq("status", "active")
      .order("name"),
    supabase
      .from("dynamic_templates")
      .select("slug,name,description,slide_type,orientation,current_published_version_id")
      .eq("status", "published")
      .eq("slide_type", "news")
      .like("slug", "editorial-arena-%")
      .order("name"),
    supabase
      .from("tenant_settings")
      .select("primary_color,default_theme_id,default_theme_version,theme_mode_policy,theme_accent,theme_support")
      .eq("tenant_id", tenantId)
      .maybeSingle()
  ]);
  if (sourcesResult.error || templatesResult.error || settingsResult.error) {
    console.error("Nieuws Studio-opties laden mislukt", {
      sources: sourcesResult.error?.code,
      templates: templatesResult.error?.code,
      settings: settingsResult.error?.code
    });
  }
  const sources = await Promise.all((sourcesResult.data ?? []).map(async (source): Promise<SlideSourceOption> => {
    const countResult = await supabase
      .from("dynamic_news_articles")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("data_source_id", source.id);
    return {
      id: source.id,
      itemCount: countResult.count ?? 0,
      kind: source.kind,
      lastErrorCode: source.last_error_code,
      lastSuccessfulSyncAt: source.last_successful_sync_at,
      name: source.name,
      products: [],
      providerStatus: source.provider_status,
      sportAvailability: [],
      sportCompetitions: [],
      sportSeasons: [],
      sportTeams: [],
      successfulDatasetGroups: []
    };
  }));
  const defaultThemeSelection = tenantThemeSelection(settingsResult.data);
  return {
    defaultThemeSelection,
    primaryColor: normalizePrimaryColor(
      settingsResult.data?.primary_color,
      resolveThemeDefinition(defaultThemeSelection).accentDefault
    ),
    sources,
    templates: (templatesResult.data ?? []).flatMap((template) =>
      template.current_published_version_id ? [{
        description: template.description,
        name: template.name,
        orientation: template.orientation,
        slideType: template.slide_type,
        slug: template.slug,
        versionId: template.current_published_version_id
      }] : []
    )
  };
}

function tenantThemeSelection(settings: Record<string, unknown> | null) {
  const parsed = themeSelectionSchema.safeParse({
    accent: nonEmptyText(settings?.theme_accent),
    categoryOverrides: [],
    modePolicy: settings?.theme_mode_policy,
    ref: {
      catalog: "v2",
      id: settings?.default_theme_id,
      version: settings?.default_theme_version
    },
    support: nonEmptyText(settings?.theme_support)
  });
  return parsed.success ? parsed.data : platformDefaultThemeSelection;
}

function normalizePrimaryColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value)
    ? value.toUpperCase()
    : fallback;
}

function nonEmptyText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
