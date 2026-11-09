import Link from "next/link";
import { hasCapability } from "@veyocast/auth";
import { Button, PageHeader } from "@veyocast/ui";
import { requireTenantControlSession } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { loadEffectivePlanning } from "../effective-planning-data.server";
import { EffectivePlanningView } from "../effective-planning-view";
import { isoToZonedDateTimeLocal, zonedLocalDateTimeToIso } from "../schedule-time";
import styles from "../effective-planning.module.css";

export default async function EffectivePlanningPage({ searchParams }: {
  searchParams: Promise<{ screen?: string; at?: string; q?: string }>;
}) {
  const session = await requireTenantControlSession("tenant.release.read");
  const query = await searchParams;
  const supabase = session.isLive && session.tenantId && hasCapability(session.capabilities, "tenant.screen.read")
    ? await createControlSupabaseClient() : null;
  const search = (query.q ?? "").trim().slice(0, 100);
  let screenQuery = supabase && session.tenantId ? supabase.from("screens").select("id,name")
    .eq("tenant_id", session.tenantId).is("deleted_at", null).order("name").order("id").limit(101) : null;
  // imatch preserves a literal '*'; PostgREST translates it to '%' for ilike.
  if (screenQuery && search) screenQuery = screenQuery.filter("name", "imatch", search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const [screens, settings] = supabase && session.tenantId ? await Promise.all([
    screenQuery!,
    supabase.from("tenant_settings").select("timezone_name").eq("tenant_id", session.tenantId).maybeSingle()
  ]) : [{ data: [], error: null }, { data: null, error: null }];
  const timezone = settings.data?.timezone_name ?? "Europe/Amsterdam";
  const options = screens.data ?? [];
  const canSelectAll = options.length > 0 && options.length <= 50;
  const selected = query.screen ?? (canSelectAll ? "all" : options[0]?.id ?? "");
  const screenIds = selected === "all" && canSelectAll ? options.map(screen => screen.id)
    : options.some(screen => screen.id === selected) ? [selected] : [];
  const now = new Date();
  let at = now.toISOString();
  let error = screens.error || settings.error ? "De schermen of verenigingstijdzone konden niet volledig worden geladen." : null;
  if (!supabase) error = "Een actieve datasessie en leesrechten voor planning en schermen zijn nodig.";
  if (query.at) {
    try { at = zonedLocalDateTimeToIso(query.at, timezone); }
    catch (cause) { error = cause instanceof Error ? cause.message : "Het gekozen lokale tijdstip is ongeldig."; }
  }
  if (query.screen && !screenIds.length) error = "Het gekozen scherm is niet beschikbaar binnen deze vereniging.";
  const result = !error && session.tenantId && screenIds.length
    ? await loadEffectivePlanning(session.tenantId, { screenIds, at }) : null;
  return <div>
    <PageHeader title="Nu, Hierna en Waarom" eyebrow="Planning" description="Bekijk per scherm de effectieve planning, de volgende werkelijke wissel en de afzonderlijke playerbevestiging."/>
    <Button asChild variant="secondary"><Link href="/dashboard/planning">Terug naar Planning</Link></Button>
    <form className={styles.filters}>
      <div className="field"><label htmlFor="effective-search">Zoek scherm op naam</label><input defaultValue={search} id="effective-search" name="q" maxLength={100} type="search"/></div>
      <div className="field"><label htmlFor="effective-screen">Scherm</label><select defaultValue={selected} id="effective-screen" name="screen">
        {canSelectAll ? <option value="all">{search ? "Alle gevonden schermen" : "Alle schermen"}</option> : null}
        {options.slice(0, 100).map(screen => <option key={screen.id} value={screen.id}>{screen.name}</option>)}
      </select></div>
      <div className="field"><label htmlFor="effective-at">Lokaal tijdstip ({timezone})</label><input defaultValue={query.at ?? isoToZonedDateTimeLocal(at, timezone)} id="effective-at" name="at" type="datetime-local" required/></div>
      <Button disabled={!supabase || !options.length} type="submit">Vooruitblik controleren</Button>
    </form>
    {options.length > 50 ? <p className="notice notice--info">Kies één scherm. Een gezamenlijke vooruitblik ondersteunt maximaal vijftig schermen.</p> : null}
    {options.length > 100 ? <p className="notice notice--warning">De eerste honderd schermen zijn beschikbaar. Zoek op naam om een ander scherm te vinden.</p> : null}
    {error || result?.error ? <p className="notice notice--critical" role="alert">{error ?? result?.error} Er is niets gewijzigd.</p> : null}
    {!error && !options.length ? <p className="notice notice--info">Er zijn geen beschikbare schermen om te beoordelen.</p> : null}
    {result?.report ? <><h2>Effectieve planning per scherm</h2><EffectivePlanningView report={result.report}/></> : null}
  </div>;
}
