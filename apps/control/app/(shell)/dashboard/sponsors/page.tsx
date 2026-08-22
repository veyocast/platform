import { hasCapability } from "@veyocast/auth";
import { Button, StatusPill } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import {
  addCreative,
  approveCampaign,
  createCampaign,
  createSponsor,
  initializeSponsorHub,
  placeCampaign,
  publishSponsorPlan,
  registerSponsorMedia,
  submitCampaign
} from "./actions";
import { loadSponsorHub } from "./data";
import styles from "./sponsor-hub.module.css";

const positionLabels: Record<string, string> = {
  corner: "Hoekpositie", footer: "Voetregel", fullscreen: "Volledig scherm",
  match_ball_sponsor: "Wedstrijdbalsponsor", match_sponsor: "Wedstrijdsponsor", presented_by: "Mede mogelijk gemaakt door"
};
const campaignTone = { approved: "success", draft: "neutral", ended: "neutral", paused: "warning", published: "success", rejected: "critical", submitted: "info" } as const;

export default async function SponsorHubPage({ searchParams }: { searchParams: Promise<{ fout?: string; succes?: string }> }) {
  const session = await requireTenantControlSession("tenant.sponsor.read");
  const params = await searchParams;
  const data = session.tenantId ? await loadSponsorHub(session.tenantId) : await loadSponsorHub("");
  const canWrite = session.isLive && hasCapability(session.capabilities, "tenant.sponsor.write");
  const canApprove = session.isLive && hasCapability(session.capabilities, "tenant.sponsor.approve");
  const canPublish = session.isLive && hasCapability(session.capabilities, "tenant.sponsor.publish");
  const activeCampaigns = data.campaigns.filter((campaign) => ["approved", "published", "submitted"].includes(campaign.status));
  const totalPlayedMs = data.events.reduce((sum, event) => sum + Number(event.played_ms), 0);

  return <div className={styles.shell}>
    <header className={styles.hero}>
      <p className={styles.eyebrow}>{session.tenant} · Sponsor operations</p>
      <h1>Sponsor Hub</h1>
      <p>Van relatie en campagne tot schermplaatsing, offline levering en controleerbaar bewijs van vertoning. Campagnes wisselen zonder de playlist te bewerken.</p>
    </header>
    <nav aria-label="Sponsor Hub onderdelen" className={styles.tabs}>
      {[["#actie","Actiecentrum"],["#sponsors","Sponsors"],["#campagnes","Campagnes"],["#media","Media"],["#kansen","Kansen"],["#schermen","Schermgroepen"],["#rapporten","Rapporten"],["#activiteit","Activiteit"]].map(([href,label]) => <a href={href} key={href}>{label}</a>)}
    </nav>
    {params.succes ? <p className={styles.banner} role="status">Wijziging opgeslagen: {params.succes}.</p> : null}
    {params.fout ? <p className={styles.banner} role="alert"><strong>Opslaan mislukt.</strong> Controleer rechten, vier-ogen-goedkeuring en verplichte media/plaatsing. Fout: {params.fout}.</p> : null}
    <section aria-label="Sponsor KPI's" className={styles.metrics}>
      <Metric label="Actieve sponsors" value={data.sponsors.filter((item) => item.status === "active").length} />
      <Metric label="Campagnes in operatie" value={activeCampaigns.length} />
      <Metric label="Vertoningen (30 dagen)" value={data.events.length} />
      <Metric label="Aangetoonde speeltijd" value={`${Math.round(totalPlayedMs / 60000)} min`} />
    </section>

    <section className={styles.grid} id="actie">
      <article className={styles.panel}>
        <PanelHeader title="Actiecentrum" description="Wat nu aandacht nodig heeft, zonder verborgen deadlines." />
        <ul className={styles.list}>
          <li><span><strong>Wacht op goedkeuring</strong><small>Vier-ogen-controle door een andere gebruiker</small></span><StatusPill label={String(data.campaigns.filter((item) => item.status === "submitted").length)} tone="info" /></li>
          <li><span><strong>Plan verloopt binnen 48 uur</strong><small>Publiceer een nieuwe immutable sponsorversie</small></span><StatusPill label={String(data.plans.filter((plan) => Date.parse(plan.expires_at) - Date.now() < 48 * 3600000).length)} tone="warning" /></li>
          <li><span><strong>Open taken</strong><small>Contract, materiaal of opvolging</small></span><StatusPill label={String(data.tasks.filter((task) => task.status === "open").length)} tone="neutral" /></li>
        </ul>
      </article>
      <article className={styles.panel}>
        <PanelHeader title="Levering" description="Sponsor- en contentrevisies worden samen in de player-envelope aangeboden." />
        <ul className={styles.list}>
          <li><span><strong>Laatste sponsorplan</strong><small>{data.plans[0] ? `Versie ${data.plans[0].version} · ${shortHash(data.plans[0].plan_hash)}` : "Nog niet gepubliceerd"}</small></span><StatusPill label={data.plans[0] ? "Immutable" : "Niet actief"} tone={data.plans[0] ? "success" : "neutral"} /></li>
          <li><span><strong>Doelschermen</strong><small>Actieve landscape- en portraitplayers</small></span><StatusPill label={String(data.screens.filter((screen) => screen.status === "active").length)} tone="info" /></li>
        </ul>
        <div className={styles.actions} style={{ marginTop: "1rem" }}>
          {canWrite && data.positions.length === 0 ? <form action={initializeSponsorHub}><Button type="submit" variant="secondary">Posities initialiseren</Button></form> : null}
          {canPublish ? <form action={publishSponsorPlan}><Button type="submit" variant="primary">Sponsorplan publiceren</Button></form> : null}
        </div>
      </article>
    </section>

    <section className={styles.grid} id="sponsors">
      <article className={styles.panel}>
        <PanelHeader title="Sponsors" description="Relaties blijven gescheiden van campagnes en materiaal." />
        <ul className={styles.list}>{data.sponsors.map((sponsor) => <li key={sponsor.id}><span><strong>{sponsor.name}</strong><small>{sponsor.website_url ?? "Geen website vastgelegd"}</small></span><StatusPill label={sponsor.status} tone={sponsor.status === "active" ? "success" : "neutral"} /></li>)}</ul>
        {!data.sponsors.length ? <p>Nog geen sponsors. Voeg de eerste relatie toe.</p> : null}
      </article>
      {canWrite ? <article className={styles.panel}><PanelHeader title="Sponsor toevoegen" description="Alleen feitelijke relatiegegevens; geen publieke claims." /><form action={createSponsor} className={styles.form}>
        <label className={styles.field}><span>Naam</span><input name="name" required maxLength={160} /></label>
        <label className={styles.field}><span>Website (optioneel)</span><input name="websiteUrl" type="url" maxLength={500} /></label>
        <label className={styles.field}><span>Interne notitie</span><textarea name="notes" maxLength={4000} /></label>
        <Button type="submit" variant="primary">Sponsor opslaan</Button>
      </form></article> : null}
    </section>

    <section className={styles.panel} id="campagnes">
      <PanelHeader title="Campagnes en goedkeuring" description="Creatives vergroten nooit automatisch het sponsoraandeel; weging gebeurt op campagneniveau." />
      <ul className={styles.list}>{data.campaigns.map((campaign) => <li key={campaign.id}><span><strong>{campaign.name}</strong><small>{formatDate(campaign.starts_at)} – {formatDate(campaign.ends_at)} · gewicht {campaign.weight}</small></span><div className={styles.actions}><StatusPill label={campaign.status} tone={campaignTone[campaign.status as keyof typeof campaignTone] ?? "neutral"} />{campaign.status === "draft" && canWrite ? <form action={submitCampaign}><input name="campaignId" type="hidden" value={campaign.id} /><Button type="submit" variant="secondary">Indienen</Button></form> : null}{campaign.status === "submitted" && canApprove ? <form action={approveCampaign}><input name="campaignId" type="hidden" value={campaign.id} /><Button type="submit" variant="primary">Goedkeuren</Button></form> : null}</div></li>)}</ul>
      {canWrite && data.sponsors.length ? <form action={createCampaign} className={styles.form} style={{ marginTop: "1.25rem" }}><div className={styles.formGrid}>
        <label className={styles.field}><span>Sponsor</span><select name="sponsorId" required>{data.sponsors.map((sponsor) => <option value={sponsor.id} key={sponsor.id}>{sponsor.name}</option>)}</select></label>
        <label className={styles.field}><span>Campagnenaam</span><input name="name" required maxLength={180} /></label>
        <label className={styles.field}><span>Start</span><input name="startsAt" type="datetime-local" required /></label>
        <label className={styles.field}><span>Einde</span><input name="endsAt" type="datetime-local" required /></label>
        <label className={styles.field}><span>Gewicht</span><input name="weight" type="number" min="0.1" max="1000" step="0.1" defaultValue="1" required /></label>
      </div><Button type="submit" variant="primary">Campagne maken</Button></form> : null}
    </section>

    <section className={styles.grid} id="media">
      <article className={styles.panel}><PanelHeader title="Sponsor media" description="Elke rendition is checksum-gepind; wijzigingen maken een nieuwe creative." /><ul className={styles.list}>{data.creatives.map((creative) => <li key={creative.id}><span><strong>{positionLabels[creative.position_key] ?? creative.position_key}</strong><small>{creative.orientation} · {creative.status}</small></span><StatusPill label="Vastgezet" tone="success" /></li>)}</ul></article>
      {canWrite && data.campaigns.length && data.assets.length ? <article className={styles.panel}><PanelHeader title="Creative koppelen" description="Gebruik een reeds verwerkte asset uit de tenantmediabibliotheek." /><form action={addCreative} className={styles.form}>
        <label className={styles.field}><span>Campagne</span><select name="campaignId">{data.campaigns.filter((item) => item.status === "draft").map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label className={styles.field}><span>Media</span><select name="mediaAssetId">{data.assets.map((asset) => <option value={asset.id} key={asset.id}>{asset.title} · {asset.kind}</option>)}</select></label>
        <div className={styles.formGrid}><label className={styles.field}><span>Positie</span><select name="positionKey">{Object.entries(positionLabels).map(([key,label]) => <option value={key} key={key}>{label}</option>)}</select></label><label className={styles.field}><span>Oriëntatie</span><select name="orientation"><option value="any">Beide</option><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></label><label className={styles.field}><span>Duur (seconden)</span><input name="durationSeconds" type="number" min="1" max="300" defaultValue="8" /></label></div>
        <Button type="submit" variant="primary">Creative vastzetten</Button>
      </form></article> : null}
      {canWrite && data.sponsors.length && data.tenantAssets.length ? <article className={styles.panel}><PanelHeader title="Media toelaten tot Sponsor Hub" description="Maak expliciet een sponsorafgeschermde koppeling voordat materiaal in een campagne kan komen." /><form action={registerSponsorMedia} className={styles.form}><label className={styles.field}><span>Sponsor</span><select name="sponsorId">{data.sponsors.map((sponsor) => <option value={sponsor.id} key={sponsor.id}>{sponsor.name}</option>)}</select></label><label className={styles.field}><span>Ready media</span><select name="mediaAssetId">{data.tenantAssets.map((asset) => <option value={asset.id} key={asset.id}>{asset.title}</option>)}</select></label><Button type="submit" variant="secondary">Toelaten als sponsormedia</Button></form></article> : null}
    </section>

    <section className={styles.grid} id="schermen">
      <article className={styles.panel}><PanelHeader title="Semantische posities" description="Alle tien thema's krijgen dezelfde betekenis; de player rendert de zone zelfstandig." /><ul className={styles.list}>{data.positions.map((position) => <li key={position.id}><span><strong>{position.name}</strong><small>{position.mode === "fixed" ? "Contextgebonden" : "Gewogen rotatie"}</small></span><StatusPill label={position.enabled ? "Actief" : "Uit"} tone={position.enabled ? "success" : "neutral"} /></li>)}</ul></article>
      {canWrite && data.campaigns.length && data.positions.length ? <article className={styles.panel}><PanelHeader title="Campagne plaatsen" description="Een poolreferentie blijft stabiel terwijl sponsors binnen de pool wijzigen." /><form action={placeCampaign} className={styles.form}><label className={styles.field}><span>Campagne</span><select name="campaignId">{data.campaigns.filter((item) => item.status === "draft").map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label className={styles.field}><span>Positie</span><select name="positionId">{data.positions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label className={styles.field}><span>Oriëntatie</span><select name="orientation"><option value="any">Beide</option><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></label><Button type="submit" variant="primary">Plaatsing opslaan</Button></form></article> : null}
    </section>

    <section className={styles.panel} id="kansen"><PanelHeader title="Kansenpipeline" description="Commercieel overzicht zonder fictieve omzet of sponsorclaims." /><div className={styles.pipeline}>{["lead","contacted","proposal","won","lost"].map((stage) => <div className={styles.stage} key={stage}><strong>{stage}</strong><span>{data.opportunities.filter((item) => item.stage === stage).length}</span></div>)}</div></section>

    <section className={styles.grid} id="rapporten">
      <article className={styles.panel}><PanelHeader title="Proof of Play" description="Device-events zijn dedupliceerbaar op UUID en claimen geen publiek of bereik." /><ul className={styles.list}><li><span><strong>Geaccepteerde events</strong><small>Laatste 30 dagen</small></span><StatusPill label={String(data.events.length)} tone="info" /></li><li><span><strong>Gemiddelde speeltijd</strong><small>Op basis van technisch afgemelde plays</small></span><StatusPill label={data.events.length ? `${Math.round(totalPlayedMs / data.events.length / 1000)} sec` : "—"} tone="neutral" /></li></ul></article>
      <article className={styles.panel} id="activiteit"><PanelHeader title="Activiteit" description="Append-only sponsoracties voor controle en herstelonderzoek." /><ul className={styles.list}>{data.audit.slice(0,8).map((event) => <li key={event.id}><span><strong>{actionLabel(event.action)}</strong><small>{event.entity_type} · {formatDateTime(event.created_at)}</small></span></li>)}</ul>{!data.audit.length ? <p>Nog geen sponsoractiviteit.</p> : null}</article>
    </section>
  </div>;
}

function Metric({ label, value }: { label: string; value: number | string }) { return <div className={styles.metric}><span>{label}</span><strong>{value}</strong></div>; }
function PanelHeader({ description, title }: { description: string; title: string }) { return <div className={styles.panelHeader}><div><h2>{title}</h2><p>{description}</p></div></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeZone: "Europe/Amsterdam" }).format(new Date(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" }).format(new Date(value)); }
function shortHash(value: string) { return `${value.slice(0,8)}…${value.slice(-6)}`; }
function actionLabel(value: string) { return value.split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" · "); }
