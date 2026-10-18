/* eslint-disable @next/next/no-img-element -- Uses the supplied locked brand asset. */
import { ArrowRight, CalendarDays, CheckCircle2, ChevronRight, Layers3, MapPin, Monitor, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { syncPlaybackEvidence } from "../../../../lib/sync-playback-evidence";
import type { FrozenReleasePreview } from "../../../../lib/release-preview.server";
import type { FleetDevice, FleetScreen, ScreenFleetData } from "./data";

export function SyncFleetView({ data, screens, devices, query, status, group, setup, advanced, previews }: {
  data: ScreenFleetData; screens: FleetScreen[]; devices: Map<string, FleetDevice>;
  query: string; status: string; group: string; setup: ReactNode; advanced: ReactNode;
  previews: ReadonlyMap<string, FrozenReleasePreview>;
}) {
  const evidence = (device?: FleetDevice) => syncPlaybackEvidence(device ? {
    active_release_id: device.activeReleaseId, desired_release_id: device.desiredReleaseId,
    current_sync_detail: device.syncDetail, last_seen_at: device.lastSeenAt,
    last_error_code: device.lastErrorCode, status: device.status
  } : undefined);
  const online = data.screens.filter(screen => screen.status === "active" && evidence(devices.get(screen.id)).contact === "online").length;
  const confirmed = data.screens.filter(screen => screen.status === "active" && evidence(devices.get(screen.id)).desiredConfirmed).length;
  const releaseById = new Map(data.releases.map(release => [release.id, release]));
  return <div className="px-pages">
    <header className="section-header"><div><div className="eyebrow">SCREEN CONTROL</div><h1>Jouw club. Overal in beeld.</h1><p>Van de kantine tot de ontvangst. Zie wat speelt en houd ieder scherm in de hand.</p></div><div className="header-actions">{setup}</div></header>
    <section className="px-fleet-hero" aria-label="Samenvatting schermvloot"><div><div className="px-live-eyebrow"><i />FLEET OVERVIEW</div><h2>Alles op één plek.<br /><span>Overal hetzelfde verhaal.</span></h2><p>Een playlist klaarzetten is het begin. Een zichtbaar bevestigd beeld is het resultaat.</p><div className="px-hero-stats"><div><b>{data.screens.length}</b><span>schermen</span></div><div><b>{online}</b><span>verbonden</span></div><div><b>{confirmed}</b><span>bijgewerkt</span></div></div></div><div className="px-hero-screens"><div className="px-hero-screen back"><Brand /><span>VAN WELKOM TOT WINST.</span></div><div className="px-hero-screen front"><Brand /><span className="px-live-pill"><i />JE VERHAAL IN BEELD</span></div><div className="px-hero-orb one" /><div className="px-hero-orb two" /></div></section>
    <form className="px-fleet-toolbar" action="/dashboard/screens" role="search"><div className="px-search"><Monitor size={17} /><input type="search" name="q" aria-label="Zoek scherm" placeholder="Zoek een scherm of locatie…" defaultValue={query} /></div><select name="group" aria-label="Schermgroep" defaultValue={group}><option value="">Alle groepen</option>{data.groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select name="status" aria-label="Schermstatus" defaultValue={status}>{[["all", "Alle statussen"], ["online", "Bereikbaar"], ["offline", "Offline"], ["unknown", "Status onbekend"], ["syncing", "Synchroniseren"], ["unpaired", "Niet gekoppeld"], ["maintenance", "Onderhoud"], ["disabled", "Uitgeschakeld"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="btn btn-secondary" type="submit">Toepassen</button><div className="px-view-toggle"><Link className="active" href="/dashboard/screens"><Layers3 size={16} />Schermen</Link><Link href="/dashboard/screens/locations"><MapPin size={16} />Locaties</Link></div></form>
    <h2 className="sync-sr-only">Schermen in deze selectie</h2><div className="px-screen-grid">{screens.map(screen => {
      const device = devices.get(screen.id), state = evidence(device);
      const active = state.confirmedReleaseId ? releaseById.get(state.confirmedReleaseId) : undefined;
      const preview = active ? previews.get(active.id) : undefined;
      const desired = device?.desiredReleaseId ? releaseById.get(device.desiredReleaseId) : undefined;
      const label = screen.status === "disabled" ? "Uitgeschakeld" : screen.status === "maintenance" ? "Onderhoud" : state.contact === "online" ? "Bereikbaar" : state.contact === "offline" ? "Offline" : "Status onbekend";
      return <article className="px-screen-card" key={screen.id}><Link className="px-screen-art" href={`/dashboard/screens/${screen.id}`} aria-label={`${screen.name} bekijken`}><div className={`px-device-frame${screen.orientation === "portrait" ? " portrait" : ""}`}>{preview ? <img src={preview.url} alt={`Voorbeeld bevestigde publicatie: ${preview.title}`} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Brand />}</div><span className={`px-screen-live${state.contact === "online" ? " is-live" : ""}`}><span />{label}</span><span className="px-screen-platform"><Monitor size={14} />{device?.platform || "Nog geen Player"}</span></Link><div className="px-screen-body"><div className="row between"><Link className="px-text-button px-screen-title" href={`/dashboard/screens/${screen.id}`}>{screen.name}</Link><Link className="px-icon-button" aria-label={`${screen.name} status bekijken`} href={`/dashboard/screens/${screen.id}`}><ChevronRight size={17} /></Link></div><div className="px-subline"><MapPin size={13} />{screen.location || "Geen locatie"}<span>·</span>{screen.orientation === "portrait" ? "9:16" : "16:9"}</div><div className="px-assignment"><div><span className="px-overline">LAATST BEVESTIGDE PUBLICATIE</span><strong>{active?.playlistName || "Nog geen bevestigde playlist"}</strong></div><span className={`px-tiny-status${state.desiredConfirmed ? " good" : ""}`}>{state.desiredConfirmed ? <CheckCircle2 size={14} /> : <RefreshCw size={14} />}{state.desiredConfirmed ? "Bijgewerkt" : device?.desiredReleaseId ? "Wacht op bevestiging" : "Wacht op inhoud"}</span></div><div className="px-version-row"><span>Bevestigd <b>{active ? `v${active.version}` : "—"}</b></span><span>Gewenst <b>{desired ? `v${desired.version}` : "—"}</b></span></div></div></article>;
    })}<Link className="px-add-screen" href="/dashboard/screens/new"><span><Plus size={24} /></span><strong>Een nieuw scherm</strong><p>Koppel met een code.<br />Publiceer je eerste verhaal.</p><span className="px-add-arrow">Beginnen <ArrowRight size={15} /></span></Link></div>
    {!screens.length && data.screens.length ? <div className="empty"><Monitor size={32} /><h2>Geen schermen gevonden</h2><p>Probeer een andere zoekterm of wis de filters.</p><Link className="btn btn-secondary" href="/dashboard/screens">Filters wissen</Link></div> : null}
    <div className="px-fleet-bottom"><ShieldCheck size={22} /><div><strong>Je laatste goede verhaal blijft spelen.</strong><p>Ook bij een onderbreking. Nieuwe inhoud wordt eerst gedownload en gecontroleerd.</p></div><Link className="btn btn-ghost" href="/dashboard/publications">Publicaties bekijken <ArrowRight size={16} /></Link></div>
    <details className="sync-fleet-advanced"><summary><CalendarDays size={17} />Indelingen en groepsacties</summary>{advanced}</details>
  </div>;
}
function Brand() { return <img src="/assets/full-light.svg" className="brand" alt="VeyoCast · nog geen publicatievoorbeeld" />; }
