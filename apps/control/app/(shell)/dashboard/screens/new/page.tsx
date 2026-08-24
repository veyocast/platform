import Link from "next/link";

import { hasCapability } from "@veyocast/auth";

import { requireTenantControlSession } from "../../../../../lib/control-session";
import { formatTenantDateTime } from "../../../../../lib/tenant-time";
import { PageHeader, StatusPill } from "../../../_components/shell-primitives";
import { claimScreenPairing, createScreenOnboarding } from "../actions";
import { loadScreenDetail, loadScreenFleet } from "../data";
import { OnboardingStatusRefresh } from "./onboarding-status-refresh";

type NewScreenPageProps = {
  searchParams: Promise<{ code?: string; fout?: string; screen?: string; succes?: string }>;
};

export default async function NewScreenPage({ searchParams }: NewScreenPageProps) {
  const session = await requireTenantControlSession("tenant.screen.read");
  const query = await searchParams;
  const pairingCode = query.code?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
  const fleet = session.isLive && session.tenantId
    ? await loadScreenFleet(session.tenantId)
    : null;
  const selectedScreen = fleet?.screens.find((screen) => screen.id === query.screen) ?? null;
  const detail = selectedScreen && session.tenantId
    ? await loadScreenDetail(session.tenantId, selectedScreen.id)
    : null;
  const pairedDevice = detail?.devices.find((device) => device.status === "paired") ?? null;
  const firstHeartbeat = detail?.heartbeats[0] ?? null;
  const canManage = Boolean(
    session.isLive &&
    session.tenantStatus === "active" &&
    hasCapability(session.capabilities, "tenant.screen.manage")
  );
  const limitReached = Boolean(fleet && fleet.screens.length >= fleet.limit);

  return <>
    <Link className="breadcrumb-link" href="/dashboard/screens">← Terug naar schermvloot</Link>
    <PageHeader
      actions={selectedScreen ? <Link className="button-link button-link--secondary" href={`/dashboard/screens/${selectedScreen.id}`}>Open schermdetail</Link> : null}
      description="Doorloop schermdetails, optionele content, veilige pairing en de eerste heartbeat in één controleerbare flow."
      eyebrow={`${session.tenant} · Guided onboarding`}
      status={{
        label: firstHeartbeat ? "Onboarding voltooid" : selectedScreen ? "Onboarding bezig" : "Nieuwe onboarding",
        tone: firstHeartbeat ? "success" : "info"
      }}
      title="Scherm toevoegen"
    />

    {query.fout ? <p className="notice notice--critical" role="alert"><strong>Stap niet voltooid.</strong> {query.fout}</p> : null}
    {query.succes ? <p className="notice notice--success" role="status">{query.succes}</p> : null}
    {fleet?.error || detail?.error ? <p className="notice notice--critical" role="alert"><strong>Onboardingdata onvolledig.</strong> {fleet?.error || detail?.error}</p> : null}
    {query.screen && !selectedScreen ? <p className="notice notice--warning" role="status">Het gekozen scherm hoort niet bij deze vereniging of bestaat niet meer. Start een nieuwe onboarding vanuit de schermvloot.</p> : null}

    <ol className="screen-onboarding-steps" aria-label="Onboardingstappen">
      <OnboardingStep complete={Boolean(selectedScreen)} current={!selectedScreen} label="Schermdetails" />
      <OnboardingStep complete={Boolean(selectedScreen)} current={false} label={selectedScreen?.assignedReleaseId ? "Content gekozen" : "Content optioneel"} />
      <OnboardingStep complete={Boolean(pairedDevice)} current={Boolean(selectedScreen && !pairedDevice)} label="Player koppelen" />
      <OnboardingStep complete={Boolean(firstHeartbeat)} current={Boolean(pairedDevice && !firstHeartbeat)} label="Eerste heartbeat" />
      <OnboardingStep complete={Boolean(firstHeartbeat)} current={Boolean(firstHeartbeat)} label="Afronden" />
    </ol>

    {!selectedScreen ? (
      <section className="onboarding-workspace" aria-labelledby="screen-details-title">
        <div className="workspace-section__header">
          <div>
            <p className="eyebrow">Stap 1 en 2</p>
            <h2 className="workspace-section__title" id="screen-details-title">Schermdetails en eerste content</h2>
            <p className="work-panel__meta">De limiet wordt in dezelfde databasetransactie gecontroleerd. Content mag je veilig overslaan.</p>
          </div>
          <StatusPill
            label={fleet ? `${fleet.screens.length}/${fleet.limit} schermen` : "Live data vereist"}
            tone={limitReached ? "warning" : "neutral"}
          />
        </div>
        {limitReached ? <p className="notice notice--warning" role="status">De schermlimiet is bereikt. Er wordt niets aangemaakt; vraag een platformbeheerder om de limiet te verhogen.</p> : null}
        <form action={createScreenOnboarding} className="playlist-form onboarding-form">
          {pairingCode ? <input name="pairingCode" type="hidden" value={pairingCode} /> : null}
          <div className="field">
            <label htmlFor="screen-name">Schermnaam</label>
            <input disabled={!canManage || limitReached} id="screen-name" maxLength={120} name="name" placeholder="Bijvoorbeeld kantine hoofdscherm" required type="text" />
          </div>
          <div className="field">
            <label htmlFor="screen-location">Locatie</label>
            <input disabled={!canManage || limitReached} id="screen-location" maxLength={160} name="location" placeholder="Kantine" type="text" />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="screen-orientation">Oriëntatie</label>
              <select defaultValue={fleet?.settings.orientation ?? "landscape"} disabled={!canManage || limitReached} id="screen-orientation" name="orientation">
                <option value="landscape">Liggend</option>
                <option value="portrait">Staand</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="initial-release">Eerste content (optioneel)</label>
              <select defaultValue="" disabled={!canManage || limitReached} id="initial-release" name="initialReleaseId">
                <option value="">Later kiezen</option>
                {fleet?.releases.map((release) => <option key={release.id} value={release.id}>{release.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid">
            <div className="field"><label htmlFor="screen-width">Breedte</label><input defaultValue={fleet?.settings.width ?? 1920} disabled={!canManage || limitReached} id="screen-width" max={7680} min={320} name="resolutionWidth" required type="number" /></div>
            <div className="field"><label htmlFor="screen-height">Hoogte</label><input defaultValue={fleet?.settings.height ?? 1080} disabled={!canManage || limitReached} id="screen-height" max={4320} min={240} name="resolutionHeight" required type="number" /></div>
          </div>
          <button className="button-link button-link--primary" disabled={!canManage || limitReached} type="submit">Scherm maken en doorgaan</button>
        </form>
      </section>
    ) : (
      <section className="onboarding-workspace" aria-labelledby="pairing-step-title">
        <div className="workspace-section__header">
          <div>
            <p className="eyebrow">Stap 3 en 4</p>
            <h2 className="workspace-section__title" id="pairing-step-title">Player koppelen en eerste heartbeat</h2>
            <p className="work-panel__meta">{selectedScreen.name} · {selectedScreen.location || "Geen locatie"} · {selectedScreen.orientation === "portrait" ? "staand" : "liggend"}</p>
          </div>
          <StatusPill label={pairedDevice ? "Gekoppeld" : "Code vereist"} tone={pairedDevice ? "success" : "warning"} />
        </div>

        {!pairedDevice ? <>
          <div className="notice" role="status">
            <strong>Open de Player op het fysieke scherm.</strong> Neem alleen de tijdelijke zeskaraktercode over. Een pairingtoken of device secret verschijnt nooit in Control, logs of de URL.
          </div>
          <form action={claimScreenPairing} className="playlist-form onboarding-form">
            <input name="flow" type="hidden" value="onboarding" />
            <input name="screenId" type="hidden" value={selectedScreen.id} />
            <div className="field">
              <label htmlFor="pairing-code">Koppelcode</label>
              <input autoCapitalize="characters" autoComplete="one-time-code" defaultValue={pairingCode} disabled={!canManage || selectedScreen.status !== "active"} id="pairing-code" inputMode="text" maxLength={7} name="pairingCode" pattern="[A-Za-z2-9]{3}[ -]?[A-Za-z2-9]{3}" placeholder="ABC DEF" required type="text" />
              <p>De code verloopt na tien minuten, is eenmalig en wordt begrensd tegen herhaalde pogingen.</p>
            </div>
            <div className="field">
              <label htmlFor="device-name">Playernaam</label>
              <input defaultValue="LG webOS Signage" disabled={!canManage || selectedScreen.status !== "active"} id="device-name" maxLength={120} name="deviceName" type="text" />
            </div>
            <button className="button-link button-link--primary" disabled={!canManage || selectedScreen.status !== "active"} type="submit">Player veilig koppelen</button>
          </form>
        </> : !firstHeartbeat ? <>
          <OnboardingStatusRefresh />
          <p className="notice" role="status"><strong>Pairing is gereed; heartbeat wordt verwacht.</strong> Laat de Player online en open. De huidige lokale release blijft leidend totdat een nieuwe release volledig is geverifieerd.</p>
          <dl className="onboarding-summary">
            <SummaryItem label="Player" value={pairedDevice.deviceName || "VeyoCast Player"} />
            <SummaryItem label="Platform" value={pairedDevice.platform || "Nog niet gerapporteerd"} />
            <SummaryItem label="Appversie" value={pairedDevice.appVersion || "Nog niet gerapporteerd"} />
            <SummaryItem label="Opslag" value="Wordt bij de eerste heartbeat gemeten" />
          </dl>
          <p className="work-panel__meta">Deze status wordt automatisch vernieuwd.</p>
        </> : <>
          <p className="notice notice--success" role="status"><strong>Onboarding voltooid.</strong> De eerste heartbeat is ontvangen. Open het schermdetail voor content, Player, synchronisatie en gebeurtenissen.</p>
          <dl className="onboarding-summary">
            <SummaryItem label="Runtime" value={firstHeartbeat.runtimeState} />
            <SummaryItem label="Appversie" value={firstHeartbeat.appVersion || pairedDevice.appVersion || "Onbekend"} />
            <SummaryItem label="Opslag" value={formatStorage(firstHeartbeat.storageUsedBytes, firstHeartbeat.storageQuotaBytes)} />
            <SummaryItem label="Actieve release" value={releaseLabel(firstHeartbeat.activeReleaseId, detail?.releases ?? [])} />
            <SummaryItem label="Gewenste release" value={releaseLabel(pairedDevice.desiredReleaseId, detail?.releases ?? [])} />
            <SummaryItem label="Eerste status" value={formatDate(firstHeartbeat.createdAt)} />
          </dl>
          <Link className="button-link button-link--primary" href={`/dashboard/screens/${selectedScreen.id}`}>Onboarding afronden</Link>
        </>}
      </section>
    )}
  </>;
}

function OnboardingStep({ complete, current, label }: { complete: boolean; current: boolean; label: string }) {
  return <li aria-current={current ? "step" : undefined} data-complete={complete} data-current={current}>
    <span aria-hidden="true">{complete ? "✓" : "○"}</span>
    <strong>{label}</strong>
  </li>;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function releaseLabel(releaseId: string | null, releases: Array<{ id: string; label: string }>) {
  if (!releaseId) return "Nog geen actieve release";
  return releases.find((release) => release.id === releaseId)?.label ?? `Release ${releaseId.slice(0, 8)}`;
}

function formatStorage(used: number | null, quota: number | null) {
  if (used === null || quota === null) return "Onbekend";
  return `${formatBytes(used)} / ${formatBytes(quota)}`;
}

function formatBytes(value: number) {
  if (value < 1024 ** 2) return `${Math.round(value / 1024)} kB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

function formatDate(value: string) {
  return formatTenantDateTime(value, null);
}
