"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@veyocast/ui";
import { watchVisibleRouteRefresh } from "../../../../lib/visible-route-refresh";
import { readAgentPlayerStatusAction } from "./actions";

type Status = { observedAt: string; screens: Array<{ id: string; name: string; assigned_release_id: string | null }>; devices: Array<{ id: string; screen_id: string; active_release_id: string | null; last_seen_at: string | null; current_sync_phase: string | null }> };

export function AgentPlayerStatus({ screenIds, releaseId }: { screenIds: string[]; releaseId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [started] = useState(() => Date.now());
  const scope = JSON.stringify(screenIds);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void readAgentPlayerStatusAction(JSON.parse(scope) as string[]).then(result => { if (!active) return; if (result.ok) { setStatus(result.status as Status); setError(null); } else setError(result.error); }).catch(() => { if (active) setError("De ontvangststatus kon niet bevestigd worden. De vorige uitzending blijft beschikbaar; controleer opnieuw zodra je verbonden bent."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [scope, refresh]);
  const pending = !status || status.screens.some(screen => screen.assigned_release_id === releaseId && !status.devices.some(device => device.screen_id === screen.id && device.active_release_id === releaseId && device.last_seen_at && Date.parse(status.observedAt) - Date.parse(device.last_seen_at) < 120000));
  useEffect(() => {
    if (loading || !pending || Date.now() - started >= 10 * 60_000) return;
    return watchVisibleRouteRefresh({ document, window, intervalMs: 8000, refresh: () => setRefresh(value => value + 1) });
  }, [pending, refresh, started, loading]);
  return <section aria-label="Werkelijke playerbevestigingen"><h4>Ontvangst per scherm</h4><p>Bevestiging voor deze publicatie: {releaseId}</p>{error && <p role="alert">{error}</p>}{status ? <ul>{status.screens.map(screen => { const devices = status.devices.filter(device => device.screen_id === screen.id); const received = devices.some(device => device.active_release_id === releaseId && device.last_seen_at && Date.parse(status.observedAt) - Date.parse(device.last_seen_at) < 120000); return <li key={screen.id}><Link href={`/dashboard/screens/${screen.id}`}>{screen.name}</Link>: {received ? "deze release recent actief gemeld door Player" : screen.assigned_release_id !== releaseId ? "scherm volgt volgens huidige toewijzing of planning een andere publicatie; geen recente bevestiging van deze release" : "nog geen recente bevestiging van deze release"}. {devices[0]?.last_seen_at && `Laatste devicecontact: ${devices[0].last_seen_at}.`}</li>; })}</ul> : <p role="status">Actuele devicebevestigingen laden…</p>}<p>Een opgeslagen of gepubliceerde release bewijst geen ontvangst. We lezen devicebevestigingen iedere acht seconden zolang dit onderdeel zichtbaar en online is, maximaal tien minuten. Een heartbeat bewijst niet dat iemand het fysieke scherm heeft gezien.</p><Button variant="secondary" disabled={loading} onClick={() => setRefresh(value => value + 1)}>Ontvangst opnieuw controleren</Button></section>;
}
