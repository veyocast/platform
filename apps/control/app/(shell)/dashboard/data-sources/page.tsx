import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import { FileSpreadsheet, RefreshCw, Rss, Sparkles } from "lucide-react";
import { hasCapability } from "@veyocast/auth";
import { Button } from "@veyocast/ui";
import { requireTenantControlSession } from "../../../../lib/control-session";
import { loadSourcesOverview } from "../sources/sites-sources-data";
import { parseSourceSelection, type SourceOverviewData } from "../sources/sites-sources-model";
import { SourcesOverview } from "../sources/sites-sources-overview";
import { SourceNotice, SyncSourceDialogs } from "../sources/sync-source-dialogs";
import { loadSourceDetail } from "../sources/source-detail-data.server";
import { SportlinkSourceWorkspace } from "./sportlink/source-workspace.server";
import { SitesSportlinkConnectionWizard } from "./sportlink/sites-sportlink-connection-wizard";
import { requestSportlinkSync } from "./sportlink/actions";
import { LedSourceWorkspace } from "./led-scores/source-workspace.server";
import { SitesLedConnectionWizard } from "./led-scores/sites-led-connection-wizard";
import { testLedScoresSource } from "./led-scores/actions";
import { SitesYouTubeWorkspace } from "../integrations/youtube/sites-youtube-workspace";
import styles from "../sources/sync-source-dialogs.module.css";
import { createProductSource, createRssSource, syncRssSource } from "./actions";

type PageProps = { searchParams: Promise<{ fout?: string; succes?: string; source?: string; connect?: string }> };
export default async function DataSourcesPage({ searchParams }: PageProps) {
  const session = await requireTenantControlSession("tenant.data_source.read");
  const params = await searchParams;
  const canManage = session.isLive && session.tenantStatus === "active" && hasCapability(session.capabilities, "tenant.data_source.manage");
  const canDesign = session.isLive && session.tenantStatus === "active" && hasCapability(session.capabilities, "tenant.dynamic_slide.write");
  const canReadProducts = hasCapability(session.capabilities, "tenant.product.read");
  const selection = parseSourceSelection(params);
  const [data, selected] = await Promise.all([
    session.isLive && session.tenantId ? loadSourcesOverview(session.tenantId) : Promise.resolve<SourceOverviewData>({ failed: false, sources: [], resources: [], cards: [] }),
    loadSourceDetail(selection)
  ]);
  let createContent = null, dataContent = null, settingsContent = null, actions = null;
  if (selection?.provider === "rss") {
    createContent = <form action={createRssSource} className={styles.stack}><label className={styles.field}><span>Herkenbare naam</span><input name="name" required minLength={2} maxLength={120} placeholder="Bijvoorbeeld: Clubnieuws" /></label><label className={styles.field}><span>Publieke feed-URL</span><input name="url" required type="url" placeholder="https://club.nl/feed/" /></label><SourceNotice>Je feed wordt na bevestiging gecontroleerd en opgeslagen. Bij bronuitval blijven de laatst gevalideerde gegevens beschikbaar.</SourceNotice><Button type="submit"><Rss size={18} />Feed controleren en koppelen</Button></form>;
    settingsContent = <SourceNotice>De opgeslagen naam, feed en verversfrequentie staan hierboven. Je kunt deze bron synchroniseren of een andere nieuwsfeed verbinden.</SourceNotice>;
    if (selected?.detail) dataContent = <div className={styles.list}>{selected.detail.items.length ? await Promise.all(selected.detail.items.map(async (item, index) => <article className={styles.news} key={item.id}><span className={styles.newsArt}><Rss size={24} aria-hidden="true" /></span><div><small>ARTIKEL {index + 1}</small><h3>{item.title}</h3><p>{item.detail}</p>{item.href && <a href={item.href} target="_blank" rel="noopener noreferrer">{item.href}</a>}</div>{item.href && <Image alt={`QR-code naar ${item.title}`} width={66} height={66} unoptimized src={await QRCode.toDataURL(item.href, { margin: 1, width: 66 })} />}</article>)) : <p>Er zijn nog geen opgeslagen nieuwsartikelen beschikbaar.</p>}</div>;
    if (canManage && selected?.detail && selected.detail.status !== "paused") actions = <form action={syncRssSource}><input name="sourceId" type="hidden" value={selected.detail.id} /><Button type="submit" variant="secondary"><RefreshCw size={16} />Synchroniseren</Button></form>;
  } else if (selection?.provider === "twelve") {
    createContent = <form action={createProductSource} className={styles.stack}><label className={styles.field}><span>Herkenbare naam</span><input name="name" required minLength={2} maxLength={120} placeholder="Bijvoorbeeld: Kantinecatalogus" /></label><label className={styles.field}><span>Bronsoort</span><select name="kind"><option value="manual_products">Handmatige producten</option><option value="twelve_excel">Twelve Excel-export</option></select></label><SourceNotice>Dit is een importkoppeling. Excel of CSV wordt eerst gecontroleerd; importeren vervangt geen gepubliceerde menukaart.</SourceNotice><Button type="submit"><FileSpreadsheet size={18} />Productbron maken</Button></form>;
    settingsContent = <SourceNotice>De productcatalogus beheert producten en gecontroleerde imports. Een automatische Twelve-API-koppeling is hier niet actief.</SourceNotice>;
    if (canReadProducts) settingsContent = <>{settingsContent}<Button asChild variant="secondary"><Link href="/dashboard/integrations/twelve-products">Productcatalogus openen</Link></Button></>;
  } else if (selection?.provider === "sportlink" && selected) {
    const connection = selected.sportlink?.connection;
    createContent = <>{connection && <SourceNotice>Je vereniging heeft al een Sportlink-koppeling. Hieronder beheer je die bestaande verbinding.</SourceNotice>}<SitesSportlinkConnectionWizard inline canManage={canManage} birthdaysAvailable={selected.sportlink?.birthdayStatus.featureEnabled ?? false} initial={connection ? { id: connection.id, clubName: connection.detected_club_name ?? "", revision: connection.authoring_revision, teamCodes: connection.selected_team_codes, birthdaysEnabled: connection.privacy_birthdays_enabled } : null} /></>;
    settingsContent = <SportlinkSourceWorkspace embedded data={selected.sportlink ?? null} canManage={canManage} timezoneName={session.timezoneName} />;
    if (canManage && connection && selected.detail) actions = <form action={requestSportlinkSync}><input name="connectionId" type="hidden" value={connection.id} /><Button type="submit" variant="secondary"><RefreshCw size={16} />Synchroniseren</Button></form>;
  } else if (selection?.provider === "led" && selected?.led) {
    const led = selected.led;
    createContent = led.enabled ? <SitesLedConnectionWizard inline canManage={canManage} clubs={led.sportsClubs} teams={led.sportsTeams} /> : <LedSourceWorkspace embedded data={led} canManage={canManage} timezoneName={session.timezoneName} />;
    dataContent = <LedSourceWorkspace embedded panel="data" data={led} canManage={canManage} timezoneName={session.timezoneName} />;
    settingsContent = <LedSourceWorkspace embedded panel="settings" data={led} canManage={canManage} timezoneName={session.timezoneName} />;
    const connection = led.connections.find(item => item.id === selected.detail?.id);
    if (canManage && connection) actions = <form action={testLedScoresSource}><input name="connectionId" type="hidden" value={connection.id} /><input name="clubSlug" type="hidden" value={connection.club_slug} /><Button type="submit" variant="secondary">Verbinding testen</Button></form>;
  } else if (selection?.provider === "youtube" && selected?.youtube) {
    const youtube = selected.youtube;
    const control = youtube.enabled ? <SitesYouTubeWorkspace inline sourceId={selection.mode === "detail" ? selection.id : undefined} assets={youtube.assets} sources={youtube.sources} canManage={canManage} configured={Boolean(process.env.YOUTUBE_DATA_API_KEY?.trim())} /> : <SourceNotice>YouTube is voor deze vereniging nog niet actief. Vraag je beheerder de koppeling te activeren om video’s en playlists toe te voegen.</SourceNotice>;
    createContent = control; settingsContent = control;
  }
  return <>
    {params.fout && <p className="notice notice--critical" role="alert"><strong>Databron niet bijgewerkt.</strong> {params.fout}</p>}
    {params.succes && <p className="notice notice--success" role="status">{params.succes}</p>}
    {(params.source || params.connect) && !selection && <p className="notice notice--warning" role="alert">Deze bronkeuze is niet geldig. Er is niets gewijzigd. Kies een bron uit het overzicht.</p>}
    <SourcesOverview data={data} canManage={canManage} canDesign={canDesign} canReadProducts={canReadProducts}>
      <details><summary>Ook beheren</summary><div className="row">{hasCapability(session.capabilities, "tenant.sponsor.read") && <Button asChild variant="secondary"><Link href="/dashboard/sponsors">Sponsor Hub</Link></Button>}{canReadProducts && <Button asChild variant="secondary"><Link href="/dashboard/engage"><Sparkles size={16} />Engage</Link></Button>}<Button asChild variant="secondary"><Link href="/dashboard/slides">Opgeslagen ontwerpen</Link></Button></div></details>
    </SourcesOverview>
    <SyncSourceDialogs key={selection ? selection.mode === "detail" ? `${selection.provider}:${selection.id}` : `create:${selection.provider}` : "closed"} selection={selection} detail={selected?.detail ?? null} failed={selected?.failed} canManage={canManage} canReadProducts={canReadProducts} timezoneName={session.timezoneName} createContent={createContent} dataContent={dataContent} settingsContent={settingsContent} actions={actions} />
  </>;
}
