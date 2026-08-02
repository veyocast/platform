import type { FleetDevice } from "../data";
import { formatTenantDateTime } from "../../../../../lib/tenant-time";
import {
  type AutomationCapabilityView,
  type AutomationSupportStatus,
  type ScreenAutomationView
} from "./automation-data";
import { AutomationProgressRefresh } from "./automation-progress-refresh";
import { ScreenAutomationForm } from "./screen-automation-form";
import { ScreenAutomationTest } from "./screen-automation-test";
import styles from "./screen-automation.module.css";

type ScreenAutomationProps = {
  automation: ScreenAutomationView;
  canManage: boolean;
  capabilities: AutomationCapabilityView;
  device: FleetDevice | null;
  screenId: string;
};

const activeCommandStates = new Set([
  "requested",
  "received",
  "wake_requested",
  "player_started"
]);

export function ScreenAutomation({
  automation,
  canManage,
  capabilities,
  device,
  screenId
}: ScreenAutomationProps) {
  const formatDate = (value: string) =>
    formatTenantDateTime(value, automation.settings.timezone);
  const latestCommand = automation.commands[0] ?? null;
  const latestEvent = automation.events[0] ?? null;
  const isOnline = Boolean(
    device?.lastSeenAt && Date.now() - Date.parse(device.lastSeenAt) <= 120_000
  );
  const hasActiveCommand = Boolean(
    latestCommand && activeCommandStates.has(latestCommand.status)
  );

  return (
    <div className={styles.layout}>
      <AutomationProgressRefresh active={hasActiveCommand} />
      {automation.error ? (
        <p className="notice notice--critical" role="alert">
          <strong>Automatisering onvolledig.</strong> {automation.error}
        </p>
      ) : null}

      <section className={styles.hero} aria-labelledby="automation-title">
        <div>
          <p className={styles.eyebrow}>Lokale Player-automatisering</p>
          <h2 id="automation-title">Bedrijfstijden en startgedrag</h2>
          <p>
            Stel per scherm in wanneer de Player actief hoort te zijn. Planning
            wordt lokaal uitgevoerd, zodat een tijdelijke netwerkstoring de
            laatst gevalideerde configuratie niet direct uitschakelt.
          </p>
        </div>
        <div className={styles.heroActions}>
          <SupportBadge status={capabilities.automationSupport} />
          <ScreenAutomationTest
            canTest={canManage && isOnline && capabilities.scheduledWake !== "unavailable"}
            screenId={screenId}
          />
        </div>
      </section>

      <section className={styles.capabilities} aria-labelledby="capabilities-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="capabilities-title">Apparaatondersteuning</h2>
            <p>Feiten uit de laatst ontvangen Player-heartbeat.</p>
          </div>
          <SupportBadge status={isOnline ? "supported" : "untested"} label={isOnline ? "Online" : "Niet recent online"} />
        </div>
        <dl className={styles.deviceSummary}>
          <Summary label="Player" value={device?.deviceName || "Niet gekoppeld"} />
          <Summary label="Platform" value={capabilities.platform} />
          <Summary label="Besturingssysteem" value={capabilities.operatingSystem} />
          <Summary label="Appversie" value={capabilities.appVersion || "Niet gerapporteerd"} />
          <Summary
            label="Laatste contact"
            value={device?.lastSeenAt ? formatDate(device.lastSeenAt) : "Nog nooit"}
          />
          <Summary
            label="Laatste lokale uitvoering"
            value={capabilities.lastAutomationExecutionAt
              ? formatDate(capabilities.lastAutomationExecutionAt)
              : "Nog niet gerapporteerd"}
          />
        </dl>
        <div className={styles.capabilityGrid}>
          <Capability label="Lokaal weekschema" status={capabilities.localSchedule} />
          <Capability label="Geplande startpoging" status={capabilities.scheduledWake} />
          <Capability label="Herstel na reboot" status={capabilities.bootRestore} />
          <Capability label="Scherm actief houden" status={capabilities.keepAwake} />
          <Capability label="HDMI-CEC startpoging" status={capabilities.hdmiCec} />
        </div>
      </section>

      <ScreenAutomationForm
        canManage={canManage}
        disclaimerAcceptedAt={automation.disclaimerAcceptedAt}
        initial={automation.settings}
        revision={automation.revision}
        screenId={screenId}
      />

      <section className={styles.compatibility} aria-labelledby="compatibility-title">
        <div>
          <h2 id="compatibility-title">Compatibiliteit en installatie</h2>
          <p>
            Automatisch starten is best effort. Android kan inexacte alarmen
            uitstellen en een appstart vanuit de achtergrond blokkeren. Houd het
            afspeelapparaat onder stroom, sluit het op de juiste HDMI-poort aan en
            schakel HDMI-CEC in op beide apparaten.
          </p>
        </div>
        <ul>
          <li>LG noemt HDMI-CEC <strong>Simplink</strong>.</li>
          <li>Samsung noemt HDMI-CEC <strong>Anynet+</strong>.</li>
          <li>Philips noemt HDMI-CEC <strong>EasyLink</strong>.</li>
          <li>Sony noemt HDMI-CEC <strong>BRAVIA Sync</strong>.</li>
        </ul>
      </section>

      <section className={styles.history} aria-labelledby="automation-history-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="automation-history-title">Test- en uitvoeringshistorie</h2>
            <p>
              Playerstappen zijn technische bevestigingen; controle van het
              fysieke TV-beeld blijft een handmatige stap.
            </p>
          </div>
          <span className={styles.count}>{automation.events.length} gebeurtenissen</span>
        </div>
        {latestCommand ? (
          <div className={styles.latestResult}>
            <div>
              <span>Laatste testopdracht</span>
              <strong>{commandStatus(latestCommand.status)}</strong>
            </div>
            <div>
              <span>Aangevraagd</span>
              <strong>{formatDate(latestCommand.requestedAt)}</strong>
            </div>
            <div>
              <span>Resultaat</span>
              <strong>{latestCommand.resultCode || "Nog niet afgerond"}</strong>
            </div>
          </div>
        ) : null}
        {automation.events.length ? (
          <ol className={styles.timeline}>
            {automation.events.map((event) => (
              <li key={event.id}>
                <span className={styles.timelineMarker} aria-hidden="true" />
                <div>
                  <strong>{eventLabel(event.eventType)}</strong>
                  <p>
                    {formatDate(event.occurredAt)}
                    {event.scheduledFor ? ` · gepland ${formatDate(event.scheduledFor)}` : ""}
                    {event.diagnosticCode ? ` · ${event.diagnosticCode}` : ""}
                  </p>
                </div>
                <span>{eventStatus(event.status)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.empty}>
            Nog geen lokale uitvoeringen of testopdrachten gerapporteerd.
          </p>
        )}
        {latestEvent && capabilities.lastAutomationResult ? (
          <p className={styles.technicalNote}>
            Laatste Playerresultaat: {capabilities.lastAutomationResult}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function Capability({
  label,
  status
}: {
  label: string;
  status: AutomationSupportStatus;
}) {
  return (
    <div className={styles.capability}>
      <span>{label}</span>
      <SupportBadge status={status} />
    </div>
  );
}

function SupportBadge({
  label,
  status
}: {
  label?: string;
  status: AutomationSupportStatus;
}) {
  const copy = label ?? ({
    supported: "Ondersteund",
    probably_supported: "Waarschijnlijk ondersteund",
    unavailable: "Niet beschikbaar",
    untested: "Nog niet getest"
  } satisfies Record<AutomationSupportStatus, string>)[status];
  return (
    <span className={`${styles.badge} ${styles[`badge_${status}`]}`}>
      <span aria-hidden="true" />
      {copy}
    </span>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function commandStatus(status: string) {
  return ({
    completed: "Playerstart gerapporteerd",
    expired: "Verlopen",
    failed: "Mislukt",
    heartbeat_received: "Heartbeat bevestigd",
    player_started: "Player zichtbaar",
    received: "Ontvangen door Player",
    requested: "Wacht op Player",
    wake_requested: "Lokale start aangevraagd"
  } as Record<string, string>)[status] ?? status;
}

function eventLabel(value: string) {
  return ({
    "activity-start-requested": "Android-appstart aangevraagd",
    "automation-config-received": "Configuratie ontvangen",
    "automation-config-stored": "Configuratie lokaal opgeslagen",
    "command-received": "Testopdracht ontvangen",
    "execution-failed": "Lokale uitvoering mislukt",
    "heartbeat-sent": "Heartbeat na start bevestigd",
    "keep-awake-disabled": "Keep-awake uitgeschakeld",
    "keep-awake-enabled": "Keep-awake ingeschakeld",
    "player-visible": "Player zichtbaar geworden",
    "schedule-evaluated": "Schema lokaal geëvalueerd",
    "wake-scheduled": "Startpoging ingepland",
    "wake-triggered": "Lokale startpoging geactiveerd"
  } as Record<string, string>)[value] ?? value;
}

function eventStatus(value: string) {
  return value === "success"
    ? "Uitgevoerd"
    : value === "failed"
      ? "Mislukt"
      : "Informatie";
}
