import Link from "next/link";
import { Check, ShieldCheck } from "lucide-react";
import type { CSSProperties } from "react";
import { themeCatalog, themeCatalogOptions } from "@veyocast/content-templates/theme-catalog";
import { requireTenantControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

const families = ["Programma", "Uitslagen", "Stand", "Periodestand", "Wedstrijd van de dag", "Volgende wedstrijd", "Afgelastingen", "Kleedkamers", "Officials", "Teaminformatie", "Sponsors", "Clubactiviteiten", "Trainingen", "Vrijwilligers", "Verjaardagen", "Bezoekers welkom", "Scheidsrechters welkom"];
export default async function ThemesPage() {
  const session = await requireTenantControlSession();
  const client = session.isLive && session.tenantId ? await createControlSupabaseClient() : null;
  const profiles = client ? await client.from("tenant_theme_profiles").select("theme_id,revision,updated_at").eq("tenant_id", session.tenantId!).in("theme_id", themeCatalogOptions.map(theme => theme.id)) : null;
  return <div className="admin-page">
    <header className="section-header"><div><div className="eyebrow">BEHEER / THEMA’S</div><h1>Eén club. Meerdere stijlen.</h1><p>Vaste themapakketten voor iedere slide. Je inhoud blijft hetzelfde.</p></div></header>
    {profiles?.error ? <p className="notice notice--warning" role="alert">Je opgeslagen thema-instellingen konden niet worden gelezen. De catalogus blijft zichtbaar; open Huisstijl om opnieuw te proberen.</p> : null}
    <div className="ad-theme-grid">{themeCatalogOptions.map(theme => {
      const manifest = themeCatalog[theme.id];
      const trots = theme.id === "onzetrots-tv";
      const profile = profiles?.data?.find(row => row.theme_id === theme.id);
      return <article className="card ad-theme-card" key={theme.id}>
        <div className={`ad-theme-preview ${trots ? "trots" : ""}`} data-theme={theme.id} data-mode="light" style={{ "--theme-accent": manifest.accentDefault } as CSSProperties} aria-label={`${theme.name} stijlvoorbeeld`}>
          <div className="ad-theme-sample-brand">{trots ? "ONZE CLUB. ONZE TROTS." : "SAMEN VOOR DE CLUB"}</div><span>JOUW CLUB IN BEELD</span><h2>{trots ? <>DIT IS<br />ONZE CLUB.</> : "De club leeft."}</h2><div className="ad-theme-match"><span>{session.tenant}</span><b>14:30</b><span>Voorbeeld</span></div>
        </div>
        <div className="ad-theme-copy"><div className="row between"><h3>{theme.name}</h3><span className="badge badge-green">Beschikbaar</span></div><p>{trots ? "Een herkenbare, uitgesproken stijl voor jouw club." : "Een compleet, versiegebonden thema voor je club."}</p><div className="row between"><small>{theme.version} · 17 families · 2 formaten{profile ? ` · revisie ${profile.revision}` : ""}</small><Link className="btn btn-secondary" href={`/dashboard/themes/fieldflow?theme=${theme.id}`}>Instellen</Link></div></div>
      </article>;
    })}</div>
    <section className="card ad-padding"><div className="ad-section-head"><div><span className="ad-overline">VOLLEDIGE DEKKING</span><h2>Alle inhoud in iedere stijl</h2></div><span className="badge badge-green">Liggend + staand</span></div><div className="ad-family-cloud">{families.map(family => <span key={family}><Check size={18} />{family}</span>)}</div></section>
    <div className="notice notice--info"><ShieldCheck size={18} /><p>Een nieuwe themaversie wijzigt bestaande publicaties niet. Ontwerp, bronbinding en clubidentiteit blijven apart; het gekozen pakket wordt bij publicatie vastgelegd.</p></div>
  </div>;
}
