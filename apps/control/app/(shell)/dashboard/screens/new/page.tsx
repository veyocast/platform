import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { hasCapability } from "@veyocast/auth";
import { requireTenantControlSession } from "../../../../../lib/control-session";
import { formatTenantDateTime } from "../../../../../lib/tenant-time";
import { claimScreenPairing } from "../actions";
import { ScreenPlayerInstructions, ScreenSetupDialog } from "../screen-setup-dialog";
import { loadCompositionWorkspace } from "../screen-composition-data";
import { loadScreenDetail, loadScreenFleet } from "../data";
import { currentPlayerHeartbeats } from "../sync-screen-detail-model";
import { OnboardingStatusRefresh } from "./onboarding-status-refresh";
import styles from "../sync-screen-setup.module.css";

type NewScreenPageProps = {
  searchParams: Promise<{ code?: string; fout?: string; screen?: string; succes?: string }>;
};

export default async function NewScreenPage({ searchParams }: NewScreenPageProps) {
  const session = await requireTenantControlSession("tenant.screen.read");
  const query = await searchParams;
  const pairingCode = query.code?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
  const fleet = session.isLive && session.tenantId ? await loadScreenFleet(session.tenantId) : null;
  const selectedScreen = fleet?.screens.find(screen => screen.id === query.screen) ?? null;
  const composition = await loadCompositionWorkspace(session.tenantId, session.isLive, session.tenant);
  const detail = selectedScreen && session.tenantId ? await loadScreenDetail(session.tenantId, selectedScreen.id) : null;
  const pairedDevice = detail?.devices.find(device => device.status === "paired") ?? null;
  const firstHeartbeat = currentPlayerHeartbeats(pairedDevice, detail?.heartbeats ?? [])[0] ?? null;
  const canManage = Boolean(session.isLive && session.tenantStatus === "active" && hasCapability(session.capabilities, "tenant.screen.manage"));
  const limitReached = Boolean(fleet && fleet.screens.length >= fleet.limit);
  return <div className={`px-pages ${styles.page}`}>
    <Link className="px-back" href="/dashboard/screens"><ArrowLeft size={16} aria-hidden="true" />Alle schermen</Link>
    <header className="section-header"><div><div className="eyebrow">SCREEN CONTROL</div><h1>{pairedDevice ? "Je scherm is gekoppeld" : "Een scherm toevoegen"}</h1><p>{selectedScreen ? `${selectedScreen.name} · ${selectedScreen.location || "Geen locatie"} · ${selectedScreen.orientation === "portrait" ? "9:16" : "16:9"}` : "Een nieuwe plek voor je verhaal. Begin bij de Player op je scherm."}</p></div>{selectedScreen ? <div className="header-actions"><Link className="btn btn-secondary" href={`/dashboard/screens/${selectedScreen.id}`}>Open schermdetail <ArrowRight size={16} aria-hidden="true" /></Link></div> : null}</header>
    {query.fout ? <p className="notice notice--critical" role="alert"><strong>Stap niet voltooid.</strong> {query.fout}</p> : null}
    {query.succes ? <p className="notice notice--success" role="status">{query.succes}</p> : null}
    {fleet?.error || detail?.error ? <p className="notice notice--critical" role="alert"><strong>Onboardingdata onvolledig.</strong> {fleet?.error || detail?.error}</p> : null}
    {query.screen && !selectedScreen ? <p className="notice notice--warning" role="status">Het gekozen scherm hoort niet bij deze vereniging of bestaat niet meer. Start een nieuwe onboarding vanuit de schermvloot.</p> : null}
    {!selectedScreen ? <section className={styles.surface} aria-label="Scherm toevoegen">{limitReached ? <p className="notice notice--warning" role="status">De schermlimiet is bereikt. Er wordt niets aangemaakt; vraag een platformbeheerder om de limiet te verhogen.</p> : null}<ScreenSetupDialog defaultOpen={!limitReached} disabled={!canManage || limitReached} groups={fleet?.groups ?? []} releases={fleet?.assignableReleases ?? []} previews={composition.playlists} settings={fleet?.settings ?? { width: 1920, height: 1080, orientation: "landscape" }} pairingCode={pairingCode} triggerLabel="Scherm koppelen" /></section> : !pairedDevice ? <section className={styles.surface} aria-labelledby="pairing-step-title">
      <ScreenPlayerInstructions />
      <div><span className="px-overline">SCHERMGEGEVENS OPGESLAGEN</span><h2 id="pairing-step-title">Koppel je echte Player</h2><p className="muted">Neem de tijdelijke code van je Player over. De schermgegevens en gekozen publicatie zijn bewaard; de Player is nog niet gekoppeld.</p></div>
      <form action={claimScreenPairing} className={`${styles.form} ${styles.pairForm}`}><input name="flow" type="hidden" value="onboarding" /><input name="screenId" type="hidden" value={selectedScreen.id} /><div className={styles.grid}><label className="field"><span>Koppelcode</span><input autoCapitalize="characters" autoComplete="one-time-code" className="px-code-input" defaultValue={pairingCode} disabled={!canManage || selectedScreen.status !== "active"} inputMode="text" maxLength={7} name="pairingCode" pattern="[A-Za-z2-9]{3}[ -]?[A-Za-z2-9]{3}" placeholder="Code van je Player" required type="text" /></label><label className="field"><span>Playernaam</span><input defaultValue="VeyoCast Player" disabled={!canManage || selectedScreen.status !== "active"} maxLength={120} name="deviceName" type="text" /></label></div><p className={styles.notice}>De tijdelijke code is eenmalig en verloopt. Een pairingtoken of device secret verschijnt nooit in Control, logs of de URL. Een mislukte koppeling verandert je opgeslagen schermgegevens niet.</p><div className="row"><button className="btn btn-primary" disabled={!canManage || selectedScreen.status !== "active"} type="submit">Player veilig koppelen <ArrowRight size={16} aria-hidden="true" /></button></div></form>
    </section> : <section className={styles.surface} aria-label="Koppelresultaat"><div className={styles.success}><CheckCircle2 size={58} aria-hidden="true" /><h2>Een nieuwe plek voor je verhaal.</h2>{firstHeartbeat ? <p role="status"><strong>Onboarding voltooid.</strong> {selectedScreen.name} heeft het eerste contact gemeld. Een nieuwe publicatie wordt pas actief na volledige download, verificatie en een bevestigd zichtbaar frame.</p> : <><OnboardingStatusRefresh /><p role="status">De Player is gekoppeld. Laat hem online en open; we wachten op de eerste heartbeat.</p></>}<Link className="btn btn-primary" href={`/dashboard/screens/${selectedScreen.id}`}>{firstHeartbeat ? "Onboarding afronden" : "Naar schermdetail"}<ArrowRight size={16} aria-hidden="true" /></Link></div><details><summary>Playergegevens en eerste contact</summary><dl className={styles.facts}><SummaryItem label="Player" value={pairedDevice.deviceName || "VeyoCast Player"} /><SummaryItem label="Platform" value={pairedDevice.platform || "Nog niet gerapporteerd"} /><SummaryItem label="Appversie" value={firstHeartbeat?.appVersion || pairedDevice.appVersion || "Nog niet gerapporteerd"} /><SummaryItem label="Runtime" value={firstHeartbeat?.runtimeState || "Nog niet gerapporteerd"} /><SummaryItem label="Opslag" value={firstHeartbeat ? formatStorage(firstHeartbeat.storageUsedBytes, firstHeartbeat.storageQuotaBytes) : "Wordt bij de eerste heartbeat gemeten"} /><SummaryItem label="Door Player gemelde release" value={releaseLabel(firstHeartbeat?.activeReleaseId ?? null, detail?.releases ?? [])} /><SummaryItem label="Gewenste release" value={releaseLabel(pairedDevice.desiredReleaseId, detail?.releases ?? [])} /><SummaryItem label="Eerste status" value={firstHeartbeat ? formatTenantDateTime(firstHeartbeat.createdAt, null) : "Nog geen heartbeat"} /></dl></details></section>}
  </div>;
}

function SummaryItem({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function releaseLabel(releaseId: string | null, releases: Array<{ id: string; label: string }>) { return releaseId ? releases.find(release => release.id === releaseId)?.label ?? `Release ${releaseId.slice(0, 8)}` : "Nog niet gerapporteerd"; }
function formatStorage(used: number | null, quota: number | null) { return used === null || quota === null ? "Onbekend" : `${formatBytes(used)} / ${formatBytes(quota)}`; }
function formatBytes(value: number) { if (value < 1024 ** 2) return `${Math.round(value / 1024)} kB`; if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`; return `${(value / 1024 ** 3).toFixed(1)} GB`; }
