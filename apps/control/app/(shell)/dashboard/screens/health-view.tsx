import { StatusPill } from "@veyocast/ui";
import { Activity, HardDrive, Monitor, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { deriveScreenHealth } from "../../../../lib/screen-health";
import type { ScreenFleetData } from "./data";
import styles from "./venue-view.module.css";

export function HealthView({ data }: { data: ScreenFleetData }) {
  if (!data.features.healthView) {
    return <section className={styles.gated} aria-labelledby="health-gated-title"><Activity aria-hidden="true" /><div><p className={styles.eyebrow}>Gecontroleerde UI-uitrol</p><h2 id="health-gated-title">Health-weergave staat voor deze organisatie uit</h2><p>De onderliggende telemetry blijft beschikbaar in Screen 360. Een platformcohort activeert deze samengestelde vlootweergave; de vlag verandert geen Player- of schermrechten.</p></div><StatusPill label="Niet vrijgegeven" tone="warning" /></section>;
  }

  const deviceByScreen = new Map(data.devices.filter((device) => device.status === "paired").map((device) => [device.screenId, device]));
  return <section className={styles.health} aria-labelledby="health-title"><div className={styles.panelHeading}><div><p className={styles.eyebrow}>Fleet health</p><h2 id="health-title">Echte telemetry, zonder schijnzekerheid</h2><p>Online, verouderd, offline en onbekend blijven afzonderlijke toestanden.</p></div></div><ul>{data.screens.map((screen) => {
    const device = deviceByScreen.get(screen.id);
    const status = deriveScreenHealth({ activeReleaseId: device?.activeReleaseId, desiredReleaseId: device?.desiredReleaseId, deviceStatus: device?.status, lastSeenAt: device?.lastSeenAt, screenStatus: screen.status });
    const storage = storageLabel(device?.storageUsedBytes, device?.storageQuotaBytes);
    return <li key={screen.id}><span className={styles.healthIcon}>{device?.lastErrorCode ? <TriangleAlert aria-hidden="true" /> : <Monitor aria-hidden="true" />}</span><span><strong>{screen.name}</strong><small>{status.explanation}</small></span><span><StatusPill label={status.label} tone={status.tone} /><small><HardDrive aria-hidden="true" /> {storage}</small></span><Link href={`/dashboard/screens/${screen.id}?tab=health`}>Diagnose</Link></li>;
  })}</ul>{!data.screens.length ? <p className={styles.listEmpty}>Er zijn nog geen schermen om te bewaken.</p> : null}</section>;
}

function storageLabel(used: number | null | undefined, quota: number | null | undefined) {
  if (used === null || used === undefined || quota === null || quota === undefined || quota <= 0) return "Opslag onbekend";
  return `${Math.round((used / quota) * 100)}% gebruikt`;
}
