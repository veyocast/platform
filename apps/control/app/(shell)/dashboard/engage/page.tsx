import { hasCapability } from "@veyocast/auth";
import { Button, StatusPill } from "@veyocast/ui";
import Image from "next/image";
import QRCode from "qrcode";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { saveEngageCampaign, transitionEngageCampaign } from "./actions";
import { loadEngageWorkspace } from "./data";
import styles from "./engage.module.css";

const tones = { archived: "neutral", closed: "neutral", draft: "warning", live: "success", scheduled: "info" } as const;

export default async function EngagePage({ searchParams }: { searchParams: Promise<{ fout?: string; succes?: string }> }) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.read");
  const data = await loadEngageWorkspace(session.tenantId ?? "");
  const params = await searchParams;
  const canWrite = session.isLive && hasCapability(session.capabilities, "tenant.dynamic_slide.write");
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
  const qrCodes = new Map<string, string>();
  for (const campaign of data.campaigns.filter((item) => item.status === "live" || item.status === "scheduled")) {
    qrCodes.set(campaign.id, await QRCode.toDataURL(`${baseUrl}/engage/${campaign.public_id}`, { margin: 1, width: 224 }));
  }

  return <div className={styles.shell}>
    <header className={styles.hero}><p className={styles.eyebrow}>{session.tenant} · Premium module</p><h1>Engage</h1><p>Maak een publieksactie, deel één privacybewuste QR-link en volg live stemmen zonder namen, ruwe IP-adressen of verborgen tracking.</p></header>
    {params.succes ? <p className={styles.banner} role="status">Wijziging opgeslagen.</p> : null}
    {params.fout ? <p className={styles.banner} role="alert"><strong>Wijziging mislukt.</strong> Controleer de invoer, status en rollout.</p> : null}
    {!data.enabled ? <section className={`${styles.panel} ${styles.gate}`}><StatusPill label="Niet geactiveerd" tone="warning" /><h2>Engage staat achter een gecontroleerde featureflag</h2><p className={styles.meta}>Een platformbeheerder activeert de pilot per tenant. De flag verleent geen rechten en publieke campagnes blijven tot dat moment onbereikbaar.</p></section> : null}
    {data.enabled ? <>
      <section className={styles.grid}>
        <article className={styles.panel}><h2>Campagnes</h2><p className={styles.meta}>{data.campaigns.length} campagnes · {data.metrics.reduce((total, metric) => total + Number(metric.total_votes), 0)} geldige stemmen</p><ul className={styles.list}>{data.campaigns.map((campaign) => {
          const options = data.options.filter((option) => option.campaign_id === campaign.id);
          const campaignVotes = Number(data.metrics.find((metric) => metric.campaign_id === campaign.id)?.total_votes ?? 0);
          return <li className={styles.campaign} key={campaign.id}><div><strong>{campaign.title}</strong><small>{campaign.question}</small><small>{options.length} keuzes · {campaignVotes} stemmen · resultaten {visibilityLabel(campaign.result_visibility)}</small></div><div className={styles.actions}><StatusPill label={statusLabel(campaign.status)} tone={tones[campaign.status as keyof typeof tones] ?? "neutral"} />{qrCodes.get(campaign.id) ? <Image alt={`QR-code voor ${campaign.title}`} className={styles.qr} height={112} src={qrCodes.get(campaign.id) ?? ""} unoptimized width={112} /> : null}{canWrite ? <LifecycleActions id={campaign.id} status={campaign.status} /> : null}</div></li>;
        })}</ul>{!data.campaigns.length ? <p>Nog geen campagnes. Maak rechts het eerste concept.</p> : null}</article>
        {canWrite ? <article className={styles.panel}><h2>Nieuwe publieksactie</h2><p className={styles.meta}>Eén optie per regel. Een concept is pas publiek nadat je het start.</p><form action={saveEngageCampaign} className={styles.form}>
          <div className={styles.formGrid}><label className={styles.field}><span>Type</span><select name="kind"><option value="poll">Poll</option><option value="motm">Man/vrouw van de wedstrijd</option></select></label><label className={styles.field}><span>Resultaten tonen</span><select name="resultVisibility"><option value="after_vote">Na stemmen</option><option value="after_close">Na sluiten</option><option value="live">Direct live</option></select></label></div>
          <label className={styles.field}><span>Campagnenaam</span><input name="title" maxLength={160} required placeholder="Man van de wedstrijd" /></label>
          <label className={styles.field}><span>Vraag aan het publiek</span><input name="question" maxLength={160} required placeholder="Wie was vandaag de uitblinker?" /></label>
          <label className={styles.field}><span>Keuzes</span><textarea name="options" required placeholder={"Speler 1\nSpeler 2\nSpeler 3"} /></label>
          <div className={styles.formGrid}><label className={styles.field}><span>Start (optioneel)</span><input name="startsAt" type="datetime-local" /></label><label className={styles.field}><span>Einde (optioneel)</span><input name="endsAt" type="datetime-local" /></label></div>
          <Button type="submit" variant="primary">Concept opslaan</Button>
        </form></article> : null}
      </section>
      <section className={styles.panel}><h2>Scherm- en QR-flow</h2><p className={styles.meta}>De publieke link is geschikt voor een lokale QR-code en live resultaatweergave. Stemdata verandert de campagneconfiguratie niet: publicatieconfiguratie en runtime-resultaten blijven gescheiden.</p></section>
    </> : null}
  </div>;
}

function LifecycleActions({ id, status }: { id: string; status: string }) {
  const target = status === "draft" ? "live" : status === "live" ? "closed" : status === "closed" ? "archived" : null;
  if (!target) return null;
  return <form action={transitionEngageCampaign}><input name="campaignId" type="hidden" value={id} /><input name="targetStatus" type="hidden" value={target} /><Button type="submit" variant={target === "live" ? "primary" : "secondary"}>{target === "live" ? "Start" : target === "closed" ? "Sluit" : "Archiveer"}</Button></form>;
}
function statusLabel(status: string) { return ({ archived: "Gearchiveerd", closed: "Gesloten", draft: "Concept", live: "Live", scheduled: "Gepland" } as Record<string,string>)[status] ?? status; }
function visibilityLabel(value: string) { return ({ after_close: "na sluiten", after_vote: "na stemmen", live: "direct" } as Record<string,string>)[value] ?? value; }
