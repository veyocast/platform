import Link from "next/link";
import { Database, ShieldCheck } from "lucide-react";

import { hasCapability } from "@veyocast/auth";
import { Button, SummaryStrip } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { formatTenantDateTime } from "../../../../../lib/tenant-time";
import { PageHeader, StatusPill } from "../../../_components/shell-primitives";
import styles from "../../dynamic-content.module.css";
import {
  connectSportlink,
  deleteBirthdayEnrichments,
  requestBirthdaySync,
  requestSportlinkSync,
  resolveBirthdayConflict,
  rollbackBirthdayImport,
  setSportlinkBirthdays,
  updateSportlinkPolicy
} from "./actions";
import { SitesSportlinkSourceHealth } from "./sites-sportlink-source-health";
import { SitesSportlinkConnectionWizard } from "./sites-sportlink-connection-wizard";
import { BirthdayIntegrationPanel } from "./birthday-integration-panel";
import { SportlinkSyncRefresh } from "./sportlink-sync-refresh";
import {
  loadLatestSportlinkRuns,
  safeSportlinkErrorCode,
  sportlinkConnectionStatus,
  sportlinkDatasetStatus,
  sportlinkSyncFailureCopy
} from "./sportlink-status";

type Props = { searchParams: Promise<{ fout?: string; succes?: string }> };

export default async function SportlinkPage({ searchParams }: Props) {
  const session = await requireTenantControlSession("tenant.data_source.read");
  const params = await searchParams;
  const data = session.isLive ? await loadConnection(session.tenantId!) : null;
  const connection = data?.connection ?? null;
  const policies = data?.policies ?? [];
  const now = Date.now();
  const connectionHealth = sportlinkConnectionStatus(connection, policies, now, data?.policiesUnavailable);
  const formatDate = (value: string | null) =>
    formatTenantDateTime(value, session.timezoneName);
  const canManage = session.tenantStatus === "active" &&
    hasCapability(session.capabilities, "tenant.data_source.manage");
  const isSyncPending = policies.some((policy) =>
    policy.last_run_status === "running" || policy.last_run_status === "queued" ||
    (
      policy.enabled &&
      !policy.last_success_at &&
      new Date(policy.next_sync_at).getTime() <= Date.now()
    )
  );
  return <>
    <SportlinkSyncRefresh active={isSyncPending} />
    <PageHeader
      actions={<Button asChild variant="ghost"><Link href="/dashboard/data-sources">Alle databronnen</Link></Button>}
      description="Sportlinkgegevens worden server-side opgeslagen. Gepubliceerde schermen verversen vanuit deze gegevens; de laatste goede inhoud blijft beschikbaar."
      eyebrow="Databronnen"
      title="Sportlink Club.Dataservice"
    />
    {params.fout ? <p className="notice notice--critical" role="alert">
      <strong>Verbinding niet bijgewerkt.</strong> {errorCopy(params.fout)}
    </p> : null}
    {params.succes ? <p className="notice notice--success" role="status">{params.succes}</p> : null}
    <SitesSportlinkConnectionWizard canManage={canManage} birthdaysAvailable={data?.birthdayStatus.featureEnabled ?? false} initial={connection ? { id: connection.id, clubName: connection.detected_club_name ?? "", revision: connection.authoring_revision, teamCodes: connection.selected_team_codes, birthdaysEnabled: connection.privacy_birthdays_enabled } : null} />
    <SitesSportlinkSourceHealth connection={connection} policies={policies} now={now} unavailable={data?.policiesUnavailable} />
    <SummaryStrip items={[
      { label: "Status", value: connectionHealth.label, tone: connectionHealth.tone },
      { label: "Club", value: connection?.detected_club_name ?? "Nog onbekend" },
      { label: "Laatste geslaagde sync",
        value: formatDate(connection?.last_success_at ?? null) }
    ]} />
    {connection ? <section className="workspace-section">
      <div className={styles.card}><div className={styles.cardBody}>
        <div className={styles.cardTop}><Database aria-hidden="true" />
          <StatusPill label={connectionHealth.kind === "ready" ? "Actief" : connectionHealth.label}
            tone={connectionHealth.tone} /></div>
        <h2>{connection.detected_club_name}</h2>
        <p className={styles.muted}>Client ID ·•••• {connection.client_id_suffix}</p>
        {!connection.last_success_at ? (
          <p className="notice notice--warning" role="status">
            <strong>De verbinding is getest, maar nog niet gesynchroniseerd.</strong>{" "}
            Een actief beleid plant alleen synchronisaties in. Wacht tot minimaal
            de benodigde dataset de status Gereed heeft.
          </p>
        ) : null}
        {connection.last_error_code ? (
          <div className="notice notice--critical" role="alert">
            <strong>De laatste synchronisatie is mislukt.</strong>{" "}
            {sportlinkSyncFailureCopy(connection.last_error_code)}
            <TechnicalErrorCode code={connection.last_error_code} />
          </div>
        ) : null}
        <dl className={styles.definitionList}>
          <div><dt>Frequenties</dt><dd>5 minuten, uur, dag, week of maand per dataset</dd></div>
          <div><dt>Privacy</dt><dd>Persoonsdatasets standaard uitgeschakeld</dd></div>
          <div><dt>Offline</dt><dd>Laatste geldige PNG blijft in de Playerrelease</dd></div>
        </dl>
      </div></div>
      {canManage ? (
        <form action={requestSportlinkSync}>
          <input name="connectionId" type="hidden" value={connection.id} />
          <Button type="submit" variant="secondary">Nu synchroniseren</Button>
        </form>
      ) : null}
      <BirthdayIntegrationPanel
        activateAction={setSportlinkBirthdays}
        canManage={canManage}
        conflicts={data?.birthdayConflicts ?? []}
        connection={connection}
        deleteAction={deleteBirthdayEnrichments}
        imports={data?.birthdayImports ?? []}
        members={data?.birthdayMembers ?? []}
        resolveAction={resolveBirthdayConflict}
        rollbackAction={rollbackBirthdayImport}
        status={data?.birthdayStatus ?? emptyBirthdayStatus()}
        syncAction={requestBirthdaySync}
      />
      <div className={styles.grid} id="datasetstatus">
        {policies.map((policy) => (
          <form action={updateSportlinkPolicy} className={styles.card} key={policy.id}>
            <div className={styles.cardBody}>
              <div className={styles.cardTop}>
                <h3 className={styles.cardTitle}>{datasetLabel(policy.dataset_group)}</h3>
                <StatusPill
                  label={sportlinkDatasetStatus(policy, now).label}
                  tone={sportlinkDatasetStatus(policy, now).tone}
                />
              </div>
              <input name="connectionId" type="hidden" value={connection.id} />
              <input name="datasetGroup" type="hidden" value={policy.dataset_group} />
              <label className={styles.field}>
                <span>Frequentie</span>
                <select defaultValue={policy.frequency} disabled={!canManage} name="frequency">
                  <option value="five_minutes">Elke 5 minuten</option>
                  <option value="hourly">Elk uur</option>
                  <option value="daily">Dagelijks</option>
                  <option value="weekly">Wekelijks</option>
                  <option value="monthly">Maandelijks</option>
                </select>
              </label>
              {["matches", "match_details"].includes(policy.dataset_group) &&
              ["weekly", "monthly"].includes(policy.frequency) ? (
                <p className="notice notice--warning">Deze frequentie kan programma, afgelastingen of kleedkamers zichtbaar verouderd maken.</p>
              ) : null}
              <label className={styles.checkboxField}>
                <input
                  defaultChecked={policy.enabled}
                  disabled={!canManage}
                  name="enabled"
                  type="checkbox"
                />
                <span>
                  <strong>Automatisch synchroniseren</strong>
                  <small>
                    Voert deze dataset uit volgens de gekozen frequentie.
                  </small>
                </span>
              </label>
              <p className={styles.muted}>
                Laatste geslaagde sync · {formatDate(policy.last_success_at)}
              </p>
              <p className={styles.muted}>
                Volgende poging · {formatDate(policy.next_sync_at)}
              </p>
              {sportlinkDatasetStatus(policy, now).kind === "failed" ? (
                <div className="notice notice--critical" role="alert">
                  <strong>Laatste poging mislukt.</strong>{" "}
                  {sportlinkSyncFailureCopy(policy.last_error_code)}
                  <TechnicalErrorCode code={policy.last_error_code ?? "SPORTLINK_SYNC_FAILED"} />
                </div>
              ) : null}
              {sportlinkDatasetStatus(policy, now).kind === "stale" ? (
                <p className="notice notice--warning" role="status">
                  <strong>Gegevens zijn verouderd.</strong>{" "}
                  Deze dataset is niet op tijd ververst. De laatste goede inhoud blijft beschikbaar;
                  start de synchronisatie opnieuw en controleer daarna de laatste geslaagde sync.
                </p>
              ) : null}
              {sportlinkDatasetStatus(policy, now).kind === "unknown" ? (
                <p className="notice notice--warning" role="status">
                  <strong>De synchronisatiestatus kon niet worden bevestigd.</strong>{" "}
                  De laatste goede inhoud blijft beschikbaar. Ververs deze pagina;
                  blijft de status onbekend, neem dan contact op met de beheerder.
                </p>
              ) : null}
              {canManage ? <Button size="sm" type="submit" variant="secondary">Beleid opslaan</Button> : null}
            </div>
          </form>
        ))}
      </div>
    </section> : canManage ? <section className="workspace-section">
      <form action={connectSportlink} className={styles.formSection}>
        <h2>Verbinding testen</h2>
        <p className={styles.muted}>VeyoCast controleert clubgegevens, clublogo en teams. De waarde wordt gemaskeerd en versleuteld opgeslagen.</p>
        <label className={styles.field}><span>Sportlink Client ID</span>
          <input autoComplete="off" maxLength={512} name="clientId" required type="password" /></label>
        <div><Button type="submit"><ShieldCheck aria-hidden="true" />Testen en verbinden</Button></div>
      </form>
    </section> : null}
  </>;
}

async function loadConnection(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return null;
  const result = await supabase.from("sportlink_connections")
    .select("id,status,detected_club_name,client_id_suffix,last_tested_at,last_success_at,last_error_code,privacy_birthdays_enabled,authoring_revision,selected_team_codes")
    .eq("tenant_id", tenantId).neq("status", "revoked").maybeSingle();
  if (!result.data) return null;
  const [policiesResult, birthdayStatusResult, birthdayConflictsResult, birthdayMembersResult, birthdayImportsResult] = await Promise.all([
    supabase.from("sportlink_sync_policies")
    .select("id,dataset_group,frequency,enabled,next_sync_at,last_success_at")
    .eq("tenant_id", tenantId).eq("connection_id", result.data.id).order("dataset_group"),
    supabase.rpc("get_sportlink_birthday_status_v1", { p_connection_id: result.data.id }),
    supabase.from("sportlink_birthdays").select("id,display_name,normalized_name").eq("tenant_id", tenantId).eq("connection_id", result.data.id).eq("active", true).eq("match_status", "ambiguous").order("display_name").limit(100),
    supabase.from("sportlink_team_members").select("id,display_name,normalized_name,role,team_assignments").eq("tenant_id", tenantId).eq("connection_id", result.data.id).eq("active", true).order("display_name").limit(500),
    supabase.from("sportlink_birthday_imports").select("id,source_file_name,status,valid_count,invalid_count,duplicate_count,conflict_count,created_at").eq("tenant_id", tenantId).eq("connection_id", result.data.id).order("created_at", { ascending: false }).limit(10)
  ]);
  const latestRunByGroup = await loadLatestSportlinkRuns(
    supabase, tenantId, result.data.id,
    (policiesResult.data ?? []).map((policy) => policy.dataset_group)
  );
  return {
    birthdayConflicts: birthdayConflictsResult.data ?? [],
    birthdayImports: birthdayImportsResult.data ?? [],
    birthdayMembers: birthdayMembersResult.data ?? [],
    birthdayStatus: birthdayStatus(birthdayStatusResult.data),
    connection: result.data,
    policiesUnavailable: Boolean(policiesResult.error),
    policies: (policiesResult.data ?? []).map((policy) => {
      const latestRun = latestRunByGroup.get(policy.dataset_group);
      return {
        ...policy,
        last_error_code: latestRun?.errorCode ?? null,
        last_run_status: latestRun?.status ?? null,
        run_status_unavailable: latestRun?.unavailable ?? false
      };
    })
  };
}

function birthdayStatus(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyBirthdayStatus();
  const status = value as Record<string, unknown>;
  const counts = status.counts && typeof status.counts === "object" && !Array.isArray(status.counts)
    ? status.counts as Record<string, unknown> : {};
  return {
    active: status.active === true,
    counts: { ambiguous: Number(counts.ambiguous ?? 0), birthdays: Number(counts.birthdays ?? 0), knownAge: Number(counts.knownAge ?? 0), matched: Number(counts.matched ?? 0), withPhoto: Number(counts.withPhoto ?? 0) },
    featureEnabled: status.featureEnabled === true,
    freshness: String(status.freshness ?? "never"),
    lastErrorCode: typeof status.lastErrorCode === "string" ? status.lastErrorCode : null,
    lastSuccessAt: typeof status.lastSuccessAt === "string" ? status.lastSuccessAt : null,
    nextSyncAt: typeof status.nextSyncAt === "string" ? status.nextSyncAt : null
  };
}

function emptyBirthdayStatus() { return { active: false, counts: { ambiguous: 0, birthdays: 0, knownAge: 0, matched: 0, withPhoto: 0 }, featureEnabled: false, freshness: "never", lastErrorCode: null, lastSuccessAt: null, nextSyncAt: null }; }
function errorCopy(code: string) {
  const copy: Record<string, string> = {
    SPORTLINK_CLIENT_ID_INVALID: "De Client ID is ongeldig.",
    CONFIGURATION_UNAVAILABLE: "De serverconfiguratie voor versleutelde opslag ontbreekt.",
    CLUB_NOT_FOUND: "Sportlink gaf geen bruikbare clubidentiteit terug.",
    POLICY_INVALID: "De synchronisatie-instelling is ongeldig.",
    POLICY_SAVE_FAILED: "Het synchronisatiebeleid kon niet worden opgeslagen.",
    BIRTHDAYS_ACTIVATION_FAILED: "De verjaardagmodule kon niet worden gewijzigd. Controleer je rechten en de actieve Client ID.",
    BIRTHDAYS_MATCH_FAILED: "De handmatige koppeling kon niet worden opgeslagen. Controleer of beide personen nog actueel zijn.",
    BIRTHDAYS_ROLLBACK_FAILED: "De laatste import kon niet veilig worden teruggedraaid.",
    BIRTHDAYS_SYNC_COOLDOWN: "Er is recent al vernieuwd. De rate limit beschermt Sportlink; probeer het over vijftien minuten opnieuw.",
    PRIVACY_OPT_IN_REQUIRED: "Persoonsfeeds vereisen eerst een expliciete privacy-activering.",
    SAVE_FAILED: "De geteste verbinding kon niet veilig worden opgeslagen.",
    SPORTLINK_WORKER_LEASE_EXPIRED: "De synchronisatieworker werd onderbroken. De dataset is automatisch opnieuw ingepland; de laatste goede inhoud blijft beschikbaar.",
    SYNC_COOLDOWN: "Er is recent al een handmatige synchronisatie gestart. Probeer het over vijftien minuten opnieuw.",
    SYNC_FAILED: "De synchronisatie kon niet veilig worden ingepland."
  };
  return copy[code] ?? "Sportlink is tijdelijk niet bereikbaar. Probeer het later opnieuw.";
}

function datasetLabel(value: string) {
  const labels: Record<string, string> = {
    activities: "Clubagenda",
    club_profile: "Clubprofiel",
    competitions: "Competities en standen",
    match_details: "Wedstrijddetails",
    matches: "Programma en uitslagen",
    public_people: "Publieke personen",
    teams: "Teams",
    volunteers: "Vrijwilligers"
  };
  return labels[value] ?? value;
}

function TechnicalErrorCode({ code }: { code: string }) {
  return (
    <details className={styles.technicalDetails}>
      <summary>Technische code</summary>
      <code>{safeSportlinkErrorCode(code)}</code>
    </details>
  );
}
