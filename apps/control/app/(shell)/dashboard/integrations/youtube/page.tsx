import { hasCapability } from "@veyocast/auth";
import { Button, StatusPill } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../../lib/control-session";
import { saveYouTubeSource } from "./actions";
import { loadYouTubeWorkspace } from "./data";
import styles from "./youtube.module.css";

export default async function YouTubeIntegrationPage({ searchParams }: { searchParams: Promise<{ fout?: string; succes?: string }> }) {
  const session = await requireTenantControlSession("tenant.data_source.read");
  const data = await loadYouTubeWorkspace(session.tenantId ?? "");
  const params = await searchParams;
  const canManage = session.isLive && hasCapability(session.capabilities,"tenant.data_source.manage");
  const adapterConfigured = Boolean(process.env.YOUTUBE_DATA_API_KEY?.trim());
  return <div className={styles.shell}>
    <header><p className="page-eyebrow">{session.tenant} · Integraties</p><h1 className="page-title">YouTube</h1><p className="page-description">Officiële online playback met vooraf gevalideerde insluitbaarheid. Iedere bron heeft een lokale VeyoCast-fallback voor netwerkverlies en Player-continuïteit.</p></header>
    {params.succes ? <p className={styles.status} role="status">YouTube-bron gecontroleerd en opgeslagen.</p> : null}
    {params.fout ? <p className={styles.status} role="alert"><strong>Bron niet opgeslagen.</strong> Controleer de URL, officiële API-configuratie, insluitbaarheid en fallbackmedia. Code: {params.fout}.</p> : null}
    {!data.enabled ? <section className={styles.panel}><StatusPill label="Niet geactiveerd" tone="warning" /><h2>Gecontroleerde rollout</h2><p className={styles.meta}>YouTube staat voor deze tenant uit. Een platformbeheerder activeert de featureflag; rechten en preflight blijven daarnaast verplicht.</p></section> : <div className={styles.grid}>
      <section className={styles.panel}><h2>Geverifieerde bronnen</h2><p className={styles.meta}>YouTube-video's worden niet gedownload, getranscodeerd of als offline media gecachet.</p><ul className={styles.list}>{data.sources.map((source) => <li className={styles.source} key={source.id}><div><strong>{source.title}</strong><small>{source.channel_title ?? "Onbekend kanaal"} · video {source.video_id}</small><small>Lokale fallback: {data.assets.find((asset) => asset.id === source.fallback_media_asset_id)?.title ?? "Niet beschikbaar"}</small></div><StatusPill label={source.validation_status === "verified" && source.embeddable ? "Insluitbaar · online" : "Aandacht"} tone={source.validation_status === "verified" && source.embeddable ? "success" : "warning"} /></li>)}</ul>{!data.sources.length ? <p>Nog geen YouTube-bronnen.</p> : null}</section>
      <aside className={styles.panel}><h2>Bron toevoegen</h2><p className={styles.meta}>De officiële Data API controleert titel, kanaal, privacy en insluitbaarheid. Publicatie blijft geblokkeerd zonder fallback.</p>{!adapterConfigured ? <p className={styles.status} role="status"><strong>Externe gate:</strong> configureer server-side <code>YOUTUBE_DATA_API_KEY</code>. Er wordt geen sleutel naar de browser gestuurd.</p> : null}{canManage ? <form action={saveYouTubeSource} className={styles.form}><label className={styles.field}><span>YouTube-link</span><input name="url" type="url" required placeholder="https://www.youtube.com/watch?v=…" /></label><label className={styles.field}><span>Offline fallback</span><select name="fallbackMediaAssetId" required><option value="">Kies lokale media</option>{data.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.title} · {asset.kind}</option>)}</select></label><Button disabled={!adapterConfigured || !data.assets.length} type="submit" variant="primary">Valideren en opslaan</Button></form> : null}</aside>
    </div>}
    <section className={styles.panel}><h2>Playercontract</h2><ul className={styles.rules}><li>Playback gebruikt uitsluitend de officiële IFrame Player.</li><li>Preflight vereist internet, embedcapability en een geldige lokale fallback.</li><li>Bij offline, autoplay-block of providerfout blijft de laatste veilige VeyoCast-content spelen.</li><li>YouTube-content telt niet als offline media en komt niet in tenantopslag of mediagebruik.</li></ul></section>
  </div>;
}
