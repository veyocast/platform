import Link from "next/link";
import { Check, ShieldCheck } from "lucide-react";
import { hasCapability } from "@veyocast/auth";
import { Button } from "@veyocast/ui";
import { themeCatalogOptions } from "@veyocast/content-templates/theme-catalog";
import { requireTenantControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { loadSyncThemeCreationDefaults } from "./sync-theme-defaults-data.server";
import { SyncThemeDefaultsDialog } from "./sync-theme-defaults-dialog";
import { SyncThemeCatalogPreview } from "./sync-theme-catalog-preview";
import styles from "./sync-theme-catalog-preview.module.css";

const families = ["Programma", "Uitslagen", "Stand", "Periodestand", "Wedstrijd van de dag", "Volgende wedstrijd", "Afgelastingen", "Kleedkamers", "Officials", "Teaminformatie", "Sponsors", "Clubactiviteiten", "Trainingen", "Vrijwilligers", "Verjaardagen", "Bezoekers welkom", "Scheidsrechters welkom"];
export default async function ThemesPage() {
  const session = await requireTenantControlSession("tenant.settings.read");
  const client = session.isLive && session.tenantId ? await createControlSupabaseClient() : null;
  const profiles = client ? await client.from("tenant_theme_profiles").select("theme_id,revision,updated_at").eq("tenant_id", session.tenantId!).in("theme_id", themeCatalogOptions.map(theme => theme.id)) : null;
  const creationDefaults = client && session.tenantId ? await loadSyncThemeCreationDefaults(client, session.tenantId) : null;
  const canWrite = session.isLive && session.tenantStatus === "active" && hasCapability(session.capabilities, "tenant.settings.manage");
  const actorScope = session.tenantId ? `${session.tenantId}:${session.userId}` : "";
  return <div className={`admin-page ${styles.catalog}`}>
    <header className="section-header"><div><div className="eyebrow">BEHEER / THEMA’S</div><h1>Eén club. Meerdere stijlen.</h1><p>Vaste themapakketten voor iedere slide. Je inhoud blijft hetzelfde.</p></div></header>
    {profiles?.error ? <p className="notice notice--warning" role="alert">Je bestaande huisstijluitrol kon niet worden gelezen. De catalogus blijft zichtbaar; open Geavanceerde huisstijluitrol om opnieuw te proberen.</p> : null}
    {!creationDefaults?.ok ? <p className="notice notice--critical" role="alert">{creationDefaults?.message ?? "Log in bij een actieve club om nieuwe-ontwerpinstellingen te lezen."} Er wordt niets opgeslagen. Laad deze pagina opnieuw om opnieuw te proberen.</p> : null}
    {creationDefaults?.ok && !themeCatalogOptions.some(theme => theme.id === creationDefaults.value.defaultThemeId) ? <p className="notice notice--warning" role="status">De opgeslagen standaardkeuze wordt door deze nieuwe ontwerpflow niet ondersteund. Nieuwe ontwerpen gebruiken de zichtbare starterfallback; je bestaande keuze wordt niet overschreven.</p> : null}
    <div className="ad-theme-grid">{themeCatalogOptions.map(theme => {
      const trots = theme.id === "onzetrots-tv";
      const profile = profiles?.data?.find(row => row.theme_id === theme.id);
      const defaultsProfile = creationDefaults?.ok ? creationDefaults.value.profiles.find(value => value.themeId === theme.id) : undefined;
      return <article className="card ad-theme-card" key={theme.id}>
        <SyncThemeCatalogPreview themeId={theme.id} themeName={theme.name} tenantName={session.tenant} profile={defaultsProfile} />
        <div className="ad-theme-copy"><div className="row between"><h3>{theme.name}</h3><span className="badge badge-green">Beschikbaar</span></div><p>{trots ? "Een herkenbare, uitgesproken stijl voor jouw club." : "Een compleet, versiegebonden thema voor je club."}</p><div className="row between"><small>{theme.version} · 17 families · 2 formaten{profile ? ` · uitrolrevisie ${profile.revision}` : ""}</small>{defaultsProfile && session.tenantId ? <SyncThemeDefaultsDialog tenantId={session.tenantId} actorScope={actorScope} tenantName={session.tenant} themeId={theme.id} themeName={theme.name} profile={defaultsProfile} canWrite={canWrite} /> : <Button variant="secondary" size="md" disabled>Instellen</Button>}</div></div>
      </article>;
    })}</div>
    <section className="card ad-padding"><div className="ad-section-head"><div><span className="ad-overline">VOLLEDIGE DEKKING</span><h2>Alle inhoud in iedere stijl</h2></div><span className="badge badge-green">Liggend + staand</span></div><div className="ad-family-cloud">{families.map(family => <span key={family}><Check size={18} />{family}</span>)}</div></section>
    <div className="notice notice--info"><ShieldCheck size={18} /><p>Een nieuwe themaversie wijzigt bestaande publicaties niet. Ontwerp, bronbinding en clubidentiteit blijven apart; het gekozen pakket wordt bij publicatie vastgelegd.</p></div>
    <div className="notice notice--info"><Link className="btn btn-secondary" href="/dashboard/themes/fieldflow">Geavanceerde huisstijluitrol</Link><p>De bestaande tenantbrede uitrol voor ontwerpen en schermen heeft een eigen publicatie- en herstelstroom.</p></div>
  </div>;
}
