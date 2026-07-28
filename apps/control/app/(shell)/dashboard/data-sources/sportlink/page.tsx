import Link from "next/link";
import { Database, ShieldCheck } from "lucide-react";

import { hasCapability } from "@veyocast/auth";
import { Button, SummaryStrip } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { PageHeader, StatusPill } from "../../../_components/shell-primitives";
import styles from "../../dynamic-content.module.css";
import {
  connectSportlink,
  requestSportlinkSync,
  updateSportlinkPolicy
} from "./actions";

type Props = { searchParams: Promise<{ fout?: string; succes?: string }> };

export default async function SportlinkPage({ searchParams }: Props) {
  const session = await requireTenantControlSession("tenant.data_source.read");
  const params = await searchParams;
  const data = session.isLive ? await loadConnection(session.tenantId!) : null;
  const connection = data?.connection ?? null;
  const canManage = session.tenantStatus === "active" &&
    hasCapability(session.capabilities, "tenant.data_source.manage");
  return <>
    <PageHeader
      actions={<Button asChild variant="ghost"><Link href="/dashboard/data-sources">Alle databronnen</Link></Button>}
      description="Sportlink wordt uitsluitend server-side opgehaald, geminimaliseerd en als veilige immutable Player-snapshot gepubliceerd."
      eyebrow="Databronnen"
      title="Sportlink Club.Dataservice"
    />
    {params.fout ? <p className="notice notice--critical" role="alert">
      <strong>Verbinding niet bijgewerkt.</strong> {errorCopy(params.fout)}
    </p> : null}
    {params.succes ? <p className="notice notice--success" role="status">{params.succes}</p> : null}
    <SummaryStrip items={[
      { label: "Status", value: connection ? "Verbonden" : "Niet verbonden",
        tone: connection ? "success" : "warning" },
      { label: "Club", value: connection?.detected_club_name ?? "Nog onbekend" },
      { label: "Laatste test", value: formatDate(connection?.last_tested_at ?? null) }
    ]} />
    {connection ? <section className="workspace-section">
      <div className={styles.card}><div className={styles.cardBody}>
        <div className={styles.cardTop}><Database aria-hidden="true" />
          <StatusPill label={connection.status === "active" ? "Actief" : "Aandacht nodig"}
            tone={connection.status === "active" ? "success" : "warning"} /></div>
        <h2>{connection.detected_club_name}</h2>
        <p className={styles.muted}>Client ID ·•••• {connection.client_id_suffix}</p>
        <dl className={styles.definitionList}>
          <div><dt>Frequenties</dt><dd>Uur, dag, week of maand per dataset</dd></div>
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
      <div className={styles.grid}>
        {(data?.policies ?? []).map((policy) => (
          <form action={updateSportlinkPolicy} className={styles.card} key={policy.id}>
            <div className={styles.cardBody}>
              <div className={styles.cardTop}>
                <h3 className={styles.cardTitle}>{datasetLabel(policy.dataset_group)}</h3>
                <StatusPill
                  label={policy.enabled ? "Actief" : "Gepauzeerd"}
                  tone={policy.enabled ? "success" : "neutral"}
                />
              </div>
              <input name="connectionId" type="hidden" value={connection.id} />
              <input name="datasetGroup" type="hidden" value={policy.dataset_group} />
              <label className={styles.field}>
                <span>Frequentie</span>
                <select defaultValue={policy.frequency} disabled={!canManage} name="frequency">
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
              <label className={styles.field}>
                <span><input defaultChecked={policy.enabled} disabled={!canManage} name="enabled" type="checkbox" /> Dataset actief</span>
              </label>
              <p className={styles.muted}>Volgende sync · {formatDate(policy.next_sync_at)}</p>
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
    .select("id,status,detected_club_name,client_id_suffix,last_tested_at")
    .eq("tenant_id", tenantId).neq("status", "revoked").maybeSingle();
  if (!result.data) return null;
  const policies = await supabase.from("sportlink_sync_policies")
    .select("id,dataset_group,frequency,enabled,next_sync_at")
    .eq("connection_id", result.data.id).order("dataset_group");
  return { connection: result.data, policies: policies.data ?? [] };
}
function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium", timeStyle: "short"
  }).format(new Date(value)) : "Nog niet";
}
function errorCopy(code: string) {
  const copy: Record<string, string> = {
    SPORTLINK_CLIENT_ID_INVALID: "De Client ID is ongeldig.",
    CONFIGURATION_UNAVAILABLE: "De serverconfiguratie voor versleutelde opslag ontbreekt.",
    CLUB_NOT_FOUND: "Sportlink gaf geen bruikbare clubidentiteit terug.",
    POLICY_INVALID: "De synchronisatie-instelling is ongeldig.",
    POLICY_SAVE_FAILED: "Het synchronisatiebeleid kon niet worden opgeslagen.",
    PRIVACY_OPT_IN_REQUIRED: "Persoonsfeeds vereisen eerst een expliciete privacy-activering.",
    SAVE_FAILED: "De geteste verbinding kon niet veilig worden opgeslagen.",
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
