import Link from "next/link";

import { hasCapability } from "@veyocast/auth";
import { Button, StatusPill } from "@veyocast/ui";

import { requireControlSession } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { resolveTenantThemeAuthority } from "../../../../../lib/tenant-theme";
import { PageHeader } from "../../../_components/shell-primitives";
import { SettingsDirtySavebar } from "../../settings/settings-dirty-savebar";
import { TenantThemeEditor } from "../../settings/tenant-theme-editor";
import { retryTenantThemeRollout, updateTenantTheme } from "./actions";
import { ThemeRolloutRefresh } from "./theme-rollout-refresh";

type PageProps = {
  searchParams: Promise<{ fout?: string; succes?: string }>;
};

export default async function FieldFlowThemePage({ searchParams }: PageProps) {
  const session = await requireControlSession();
  const query = await searchParams;
  const data = await loadTheme(session.tenantId, session.isLive);
  const canManage = session.isLive &&
    session.tenantStatus === "active" &&
    hasCapability(session.capabilities, "tenant.settings.manage") &&
    !data.error;

  return (
    <>
      <PageHeader
        actions={<Button asChild variant="ghost"><Link href="/dashboard/themes">Terug naar thema's</Link></Button>}
        description="Beheer FieldFlow als één theme-profiel en rol wijzigingen veilig uit zonder gepubliceerde releases te muteren."
        eyebrow={session.tenant}
        status={{ label: canManage ? "Tenantbreed" : "Alleen bekijken", tone: canManage ? "success" : "warning" }}
        title="FieldFlow"
      />
      {query.fout ? (
        <p className="notice notice--critical" role="alert">
          <strong>Opslaan mislukt.</strong> {query.fout}
        </p>
      ) : null}
      {query.succes ? <p className="notice notice--success" role="status">{query.succes}</p> : null}
      {data.error ? (
        <p className="notice notice--critical" role="alert">
          <strong>Theme niet volledig geladen.</strong> {data.error}
        </p>
      ) : null}

      <div className="settings-theme-layout">
        <aside className="data-surface settings-theme-impact">
          <p className="section-kicker">Impact</p>
          <h2>Veilige live-uitrol</h2>
          <p>
            Opslaan maakt opvolgende snapshots en releases. Schermen wisselen
            pas nadat alle assets compleet zijn; hun last-known-good blijft
            beschikbaar.
          </p>
          <dl className="summary-list">
            <div><dt>Dynamische slides</dt><dd>{data.slideCount}</dd></div>
            <div><dt>Actieve schermen</dt><dd>{data.screenCount}</dd></div>
          </dl>
          {data.rollout ? (
            <div
              aria-busy={data.rollout.status === "queued" || data.rollout.status === "rendering"}
              aria-live="polite"
              className="settings-theme-rollout"
            >
              <ThemeRolloutRefresh
                active={data.rollout.status === "queued" || data.rollout.status === "rendering"}
              />
              <StatusPill
                label={rolloutLabel(data.rollout.status)}
                tone={rolloutTone(data.rollout.status)}
              />
              <p>
                {data.rollout.ready_snapshot_count} van {data.rollout.snapshot_count}
                {" "}presentaties gereed · {data.rollout.release_count} van {data.rollout.release_target_count}
                {" "}actieve releasetakken bijgewerkt
              </p>
              {data.rollout.error_code ? (
                <p className="notice notice--critical">
                  {rolloutRecoveryCopy(data.rollout.error_code)}
                </p>
              ) : null}
              {data.rollout.status === "failed" && canManage ? (
                <form action={retryTenantThemeRollout}>
                  <input name="rolloutId" type="hidden" value={data.rollout.id} />
                  <Button type="submit" variant="secondary">
                    Uitrol opnieuw proberen
                  </Button>
                </form>
              ) : null}
            </div>
          ) : <p className="work-panel__meta">Nog geen theme-uitrol geregistreerd.</p>}
        </aside>

        <form action={updateTenantTheme} className="settings-workspace-form settings-theme-form">
          <input name="themeSettingsRevision" type="hidden" value={data.revision} />
          <input name="timezoneName" type="hidden" value={data.timezone} />
          <section className="data-surface">
            <TenantThemeEditor
              defaults={data.authority.defaults}
              disabled={!canManage}
              initialAppearance={data.authority.appearance}
              initialSelection={data.authority.selection}
              initialTheme={data.authority.theme}
            />
          </section>
          <SettingsDirtySavebar
            disabled={!canManage}
            validationFieldName="themeSaveReadiness"
          />
        </form>
      </div>
    </>
  );
}

function rolloutRecoveryCopy(errorCode: string) {
  if (errorCode === "THEME_RELEASE_FAILED") {
    return "De presentaties zijn gereed, maar de actieve releasekoppeling kon niet veilig worden vernieuwd. De oude release blijft spelen. Probeer de immutable uitrol opnieuw; neem contact op met een platformbeheerder als dit terugkomt.";
  }
  if (errorCode === "THEME_RENDER_FAILED") {
    return "Minstens één nieuwe presentatie kon niet worden gerenderd. De oude release blijft spelen. Probeer de immutable uitrol opnieuw nadat de renderworker beschikbaar is.";
  }
  if (errorCode === "THEME_ROLLOUT_SUPERSEDED") {
    return "Deze uitrol is ingehaald door een nieuwere theme-wijziging. De nieuwere wijziging is leidend; controleer de meest recente uitrolstatus.";
  }
  return "De immutable theme-uitrol is niet voltooid. De oude release blijft veilig spelen. Probeer de uitrol opnieuw en neem contact op met een platformbeheerder als dit terugkomt.";
}

async function loadTheme(tenantId: string | null, isLive: boolean) {
  const fallback = resolveTenantThemeAuthority({
    default_theme_id: "fieldflow",
    default_theme_version: "1.0.0",
    theme_mode_policy: { kind: "fixed", mode: "light" },
    timezone_name: "Europe/Amsterdam"
  }, "2026-01-01T12:00:00.000Z");
  if (!tenantId || !isLive) {
    return {
      authority: fallback, error: null, revision: 0, rollout: null,
      screenCount: 0, slideCount: 0, timezone: "Europe/Amsterdam"
    };
  }
  const supabase = await createControlSupabaseClient();
  if (!supabase) {
    return {
      authority: fallback, error: "De beveiligde datasessie ontbreekt.",
      revision: 0, rollout: null, screenCount: 0, slideCount: 0,
      timezone: "Europe/Amsterdam"
    };
  }
  const [settings, profile, rollout, slides, screens] = await Promise.all([
    supabase.from("tenant_settings").select("default_theme_id,default_theme_version,theme_mode_policy,theme_accent,theme_support,theme_color_overrides,theme_settings_revision,timezone_name").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("tenant_theme_profiles").select("appearance_config,color_overrides,revision,selection_json,theme_version").eq("tenant_id", tenantId).eq("theme_id", "fieldflow").maybeSingle(),
    supabase.from("tenant_theme_rollouts").select("id,status,snapshot_count,ready_snapshot_count,release_count,release_target_count,error_code,created_at").eq("tenant_id", tenantId).eq("theme_id", "fieldflow").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("dynamic_slides").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).neq("status", "archived"),
    supabase.from("screens").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).neq("status", "disabled").is("deleted_at", null)
  ]);
  const error = settings.error ?? profile.error ?? rollout.error ?? slides.error ?? screens.error;
  const missingThemeAuthority = !settings.data || !profile.data;
  const selection = record(profile.data?.selection_json);
  const combined = {
    ...(settings.data ?? {}),
    appearance_config: profile.data?.appearance_config,
    default_theme_version: profile.data?.theme_version ?? settings.data?.default_theme_version,
    theme_accent: selection?.accent ?? settings.data?.theme_accent,
    theme_color_overrides: profile.data?.color_overrides ?? settings.data?.theme_color_overrides,
    theme_mode_policy: selection?.modePolicy ?? settings.data?.theme_mode_policy,
    theme_support: selection?.support ?? settings.data?.theme_support
  };
  return {
    authority: resolveTenantThemeAuthority(combined),
    error: error || missingThemeAuthority
      ? "De actuele theme-status kon niet veilig worden gelezen. Opslaan is geblokkeerd om bestaande instellingen te beschermen."
      : null,
    revision: Number(profile.data?.revision ?? settings.data?.theme_settings_revision ?? 0),
    rollout: rollout.data,
    screenCount: screens.count ?? 0,
    slideCount: slides.count ?? 0,
    timezone: settings.data?.timezone_name ?? "Europe/Amsterdam"
  };
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
function rolloutLabel(status: string) {
  return ({ failed: "Actie nodig", queued: "In wachtrij", ready: "Uitrol gereed", rendering: "Wordt opgebouwd" } as Record<string, string>)[status] ?? "In behandeling";
}
function rolloutTone(status: string): "critical" | "info" | "success" | "warning" {
  if (status === "failed") return "critical";
  if (status === "ready") return "success";
  if (status === "rendering") return "info";
  return "warning";
}
