/* eslint-disable @next/next/no-img-element -- Signs an immutable release checksum, never a stock illustration. */
import { ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, ChevronRight, CircleHelp, FolderOpen, Layers, Monitor, Play, Plug, Plus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { deriveOperationalDashboard } from "../../../lib/control-operations";
import type { TenantOverview } from "../../../lib/control-overview";
import { syncPlaybackEvidence } from "../../../lib/sync-playback-evidence";
import { loadFrozenReleasePreviews } from "../../../lib/release-preview.server";
import type { ContentScheduleListItem } from "./planning/planning-types";
import { buildCalendarDays } from "./planning/schedule-calendar";
import { isoToZonedDateTimeLocal } from "./planning/schedule-time";
import { sourceOverviewHealth } from "./sources/sites-sources-model";

export async function SyncOverview({ canCreateStudio, canManageScreens, data, schedules, tenant, userName, tenantId, timezone = "Europe/Amsterdam", planningError, visualState }: {
  canCreateStudio: boolean; canManageScreens: boolean; data: TenantOverview; schedules: ContentScheduleListItem[];
  tenant: string; userName: string; tenantId?: string | null; timezone?: string;
  planningError?: string | null; visualState?: string;
}) {
  const now = Date.now();
  const operations = deriveOperationalDashboard(data, new Date(now));
  const devices = new Map(data.devices.filter(device => device.status === "paired").map(device => [device.screen_id, device]));
  const releases = new Map(data.releases.map(release => [release.id, release]));
  const playlists = new Map(data.playlists.map(playlist => [playlist.id, playlist]));
  const rows = data.screens.map(screen => {
    const device = devices.get(screen.id);
    const evidence = syncPlaybackEvidence(device, now);
    return { screen, device, evidence, release: evidence.confirmedReleaseId ? releases.get(evidence.confirmedReleaseId) : undefined };
  });
  const primary = rows.find(row => row.evidence.contact === "online" && row.release) ?? rows.find(row => row.release);
  const preview = tenantId && !visualState && primary?.release
    ? (await loadFrozenReleasePreviews(tenantId, [primary.release.id])).get(primary.release.id) : null;
  const confirmed = rows.filter(row => row.screen.status === "active" && row.evidence.desiredConfirmed).length;
  const concept = data.playlists.filter(playlist => !data.releases.some(release => release.playlist_id === playlist.id)).length;
  const sources = [
    ...data.integrations.dynamicSources.map(source => {
      const config = source.config_json && typeof source.config_json === "object" && !Array.isArray(source.config_json) ? source.config_json as Record<string, unknown> : {};
      const refresh = typeof config.refreshMinutes === "number" && config.refreshMinutes >= 1 && config.refreshMinutes <= 1440 ? config.refreshMinutes : null;
      return { id: source.id, name: source.name, healthy: sourceOverviewHealth({ ...source, refreshMinutes: refresh }, now).tone === "success" };
    }),
    ...data.integrations.sportlinkConnections.map(source => ({ id: source.id, name: source.detected_club_name || "Sportlink",
      healthy: ["active", "connected"].includes(source.status) && Boolean(source.last_success_at) && !source.last_error_code && Boolean(source.stale_after && Date.parse(source.stale_after) > now) }))
  ];
  const today = isoToZonedDateTimeLocal(new Date(now).toISOString(), timezone).slice(0, 10);
  const occurrences = buildCalendarDays(schedules, "week", today, timezone, new Date(now)).find(day => day.isToday)?.occurrences ?? [];
  const primaryPlaylist = primary?.release ? playlists.get(primary.release.playlist_id) : undefined;
  const statusAvailable = !data.error && Object.values(data.availability).every(Boolean) && operations.status.id === "healthy";
  return <div className="ov-page ov-sync" data-visual-state={visualState}>
    <header className="ov-page-header"><div><span className="ov-eyebrow">JOUW WERKPLEK · {tenant}</span><h1>Mooi dat je er bent, {userName.split(/\s+/)[0] || "welkom"}<span>.</span></h1><p>De club in beeld. Jij houdt het overzicht.</p></div><div className="ov-quick-actions"><Link className="btn btn-secondary" href="/dashboard/planning"><CalendarDays size={18} />Planning</Link>{canCreateStudio ? <Link className="btn btn-primary" href="/dashboard/studio"><Plus size={18} />Content maken</Link> : null}</div></header>
    {data.error ? <p className="notice notice--critical" role="alert"><strong>Niet alle actuele gegevens zijn beschikbaar.</strong> Ontbrekende controles blijven onbekend. <Link href="/dashboard">Opnieuw proberen</Link></p> : null}
    {planningError ? <p className="notice notice--critical" role="alert">De dagplanning kon niet worden geladen. <Link href="/dashboard/planning">Open Planning om opnieuw te proberen.</Link></p> : null}
    <section className="ov-metrics" aria-label="Belangrijkste cijfers">
      <Metric icon={<Monitor size={18} />} label="Schermen bereikbaar" value={data.availability.screens && data.availability.devices ? <>{operations.onlineScreenCount}<em> / {data.screens.length}</em></> : "—"} note={`${rows.filter(row => row.evidence.contact === "unknown").length} zonder recente status`} />
      <Metric icon={<CheckCircle2 size={18} />} label="Publicatie bevestigd" value={data.availability.devices ? confirmed : "—"} note="Bereikbaar en gewenste versie actief" />
      <Metric icon={<Layers size={18} />} label="Conceptplaylists" value={data.availability.playlists ? concept : "—"} note="Nog niet gepubliceerd" />
      <Metric icon={<Plug size={18} />} label="Bronnen actueel" value={data.availability.integrations ? <>{sources.filter(source => source.healthy).length}<em> / {sources.length}</em></> : "—"} note="Volgens laatste bronstatus" />
    </section>
    <div className="ov-sync-feature">
      <section className="ov-today-hero"><div className="ov-today-copy"><span className="ov-eyebrow"><i className="ov-live-dot" /> VANDAAG · {formatDate(new Date(now).toISOString(), timezone)}</span><h2>Een mooie dag<br />voor jouw club.</h2><p>{primaryPlaylist?.name ?? "Je verhaal begint hier."}<br />{confirmed} schermen hebben de gewenste publicatie bevestigd.</p><div className="ov-hero-actions"><Link className="btn btn-primary" href={primary ? `/dashboard/screens/${primary.screen.id}` : "/dashboard/screens"}><Play size={18} />Player bekijken</Link><Link className="ov-text-link" href={primary?.release ? `/dashboard/playlists/${primary.release.playlist_id}` : "/dashboard/playlists"}>Playlist openen <ArrowUpRight size={15} /></Link></div></div><div className="ov-today-visual"><div className="ov-preview">{preview ? <img src={preview.url} alt={`Bevroren publicatievoorbeeld: ${preview.title}`} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <div className="ov-preview-empty"><Monitor size={32} /><strong>{primary?.release ? "Publicatievoorbeeld niet beschikbaar" : "Nog geen bevestigde inhoud"}</strong><span>{primary?.release ? "Open het scherm voor de bevestigde release en status." : "Koppel een scherm en publiceer je eerste playlist."}</span></div>}</div><div className="ov-preview-caption"><span>Voorbeeld bevestigde publicatie · geen live screenshot</span><strong>{primary?.release ? `Versie ${primary.release.version}` : "Nog geen versie"} · {primary?.evidence.confirmedAt ? formatTime(primary.evidence.confirmedAt, timezone) : "Geen afspeelbewijs"}</strong></div></div></section>
      <section className="ov-panel ov-attention-panel"><Heading eyebrow="EVEN BIJKIJKEN" title="Vraagt je aandacht" action={<span className="ov-count">{operations.signals.length}</span>} /><div className="ov-attentions">{operations.signals.slice(0, 3).map(signal => <Link className={`ov-attention ${signal.severity === "info" ? "blue" : "amber"}`} key={signal.id} href={signal.href} title={`${signal.cause} ${signal.effect} ${signal.recovery}`}><span className="ov-attention-icon"><TriangleAlert size={18} /></span><span><strong>{signal.resource} · {signal.label}</strong><small>{signal.cause}</small></span><ArrowUpRight size={16} /></Link>)}{!operations.signals.length ? <div className="ov-clear-state">{statusAvailable ? <CheckCircle2 size={18}/> : <CircleHelp size={18}/>}<strong>{statusAvailable ? "Alles rustig, alles in beeld." : "Status nog niet volledig bekend"}</strong><span>{statusAvailable ? "Er zijn geen actuele signalen die aandacht vragen." : "Niet alle gegevens zijn bevestigd. Vernieuw de pagina."}</span></div> : null}</div></section>
    </div>
    <div className="ov-main-columns">
      <section className="ov-panel"><Heading title="Jouw schermen" copy="Bereikbaarheid en bevestigde inhoud, naast elkaar." action={<Link className="ov-text-link" href="/dashboard/screens">Alle schermen <ArrowRight size={15} /></Link>} /><div className="ov-screen-rows">{rows.map(({ screen, device, evidence, release }) => <Link className="ov-screen-row" key={screen.id} href={`/dashboard/screens/${screen.id}`}><span className={`ov-device-icon ${evidence.contact}`}><Monitor size={18} /></span><span className="ov-screen-name"><strong>{screen.name}</strong><small>{screen.location || "Geen locatie"}</small></span><span className="ov-screen-publication"><strong>{release ? playlists.get(release.playlist_id)?.name ?? "Historische publicatie" : "Geen bevestigde publicatie"}</strong><small>{release ? `Versie ${release.version}` : device?.active_release_id ? "Actief gemeld · beeld onbevestigd" : "—"}{device?.desired_release_id && device.desired_release_id !== evidence.confirmedReleaseId ? ` → ${releases.has(device.desired_release_id) ? `versie ${releases.get(device.desired_release_id)!.version}` : "nieuwe publicatie"}` : ""}</small></span><span className="ov-screen-state"><span className={`badge badge-${evidence.contact === "online" ? "green" : evidence.contact === "offline" ? "amber" : "neutral"}`}>{evidence.contact === "online" ? "Bereikbaar" : evidence.contact === "offline" ? "Offline" : "Status onbekend"}</span><small>{device?.last_seen_at ? `Laatste contact ${formatDate(device.last_seen_at, timezone)} ${formatTime(device.last_seen_at, timezone)}` : "Nog geen contact"}</small></span><ChevronRight size={16} /></Link>)}{!rows.length ? <div className="empty"><FolderOpen size={36} /><h3>Je eerste scherm wacht op je</h3><p>Maak een scherm aan en koppel de Player.</p><Link className="btn btn-secondary" href={canManageScreens ? "/dashboard/screens/new" : "/dashboard/screens"}>{canManageScreens ? "Scherm koppelen" : "Schermen bekijken"}</Link></div> : null}</div></section>
      <section className="ov-panel"><Heading title="Op de planning" action={<Link className="ov-icon-link" aria-label="Planning openen" href="/dashboard/planning"><ArrowUpRight size={18} /></Link>} /><div className="ov-schedule-list">{occurrences.slice(0, 3).map(item => <Link className="ov-schedule-item" key={`${item.scheduleId}-${item.startsAt}`} href={`/dashboard/planning?date=${today}`}><span className="ov-schedule-date">{formatDate(item.startsAt, timezone)}<strong>{formatTime(item.startsAt, timezone)}</strong></span><span><strong>{item.name}</strong><small>{item.targetName} · {item.isRecurring ? "Terugkerend" : "Eenmalig"}</small></span><ArrowUpRight size={17} /></Link>)}{!occurrences.length ? <div className="ov-list-empty">{planningError ? "Planning niet beschikbaar. Probeer opnieuw." : "Nog niets gepland. Maak ruimte voor je volgende clubmoment."}</div> : null}</div><div className="ov-panel-divider" /><Heading title="Zojuist gebeurd" /><div className="ov-activity">{data.auditEvents.slice(0, 2).map(event => <div className="ov-activity-item" key={event.id}><span className="ov-activity-dot" /><div><strong>{event.action.replace(/[._]/g, " ")}{event.target_name ? ` · ${event.target_name}` : ""}</strong><small>{event.actor_name} · {formatTime(event.created_at, timezone)}</small></div></div>)}{!data.auditEvents.length ? <div className="ov-list-empty">{data.availability.audit ? "Je eerste wijziging verschijnt hier." : "Activiteit kon niet worden geladen."}</div> : null}</div></section>
    </div><div className="ov-sources-strip"><span>Je bronnen</span>{sources.map(source => <Link key={source.id} href="/dashboard/sources"><i className={source.healthy ? "healthy" : "warning"} />{source.name}<span className="sync-sr-only">{source.healthy ? "Actueel" : "Status vraagt aandacht"}</span><ArrowUpRight size={13} /></Link>)}</div>
  </div>;
}
function Metric({ icon, label, value, note }: { icon: ReactNode; label: string; value: ReactNode; note: string }) {
  return <div className="ov-metric"><span className="ov-metric-icon">{icon}</span><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}
function Heading({ eyebrow, title, copy, action }: { eyebrow?: string; title: string; copy?: string; action?: ReactNode }) {
  return <div className="ov-heading"><div>{eyebrow ? <span className="ov-eyebrow">{eyebrow}</span> : null}<h2>{title}</h2>{copy ? <p>{copy}</p> : null}</div>{action}</div>;
}
function formatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(value));
}
function formatDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", timeZone }).format(new Date(value));
}
