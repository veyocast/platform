import Link from "next/link";
import { Activity, Database, ShieldCheck } from "lucide-react";

import { Button, SummaryStrip } from "@veyocast/ui";

import { requireControlCapability } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { PageHeader, StatusPill } from "../../../_components/shell-primitives";
import styles from "../../../dashboard/dynamic-content.module.css";

export default async function PlatformSportlinkPage() {
  const session = await requireControlCapability("platform.tenant.read");
  const data = session.isLive ? await loadSportlinkOverview() : {
    connections: [],
    error: false,
    tenants: new Map<string, string>()
  };
  const active = data.connections.filter((connection) => connection.status === "active");
  const withErrors = data.connections.filter((connection) => Boolean(connection.last_error_code));

  return (
    <>
      <PageHeader
        actions={<Button asChild variant="ghost"><Link href="/platform">Platformoverzicht</Link></Button>}
        description="Platformbreed, privacyveilig overzicht van tenantverbindingen en de lease-based synchronisatiewerker."
        eyebrow="Platform · Integraties"
        title="Sportlink Club.Dataservice"
      />
      {data.error ? (
        <p className="notice notice--critical" role="alert">
          <strong>Sportlink-overzicht niet beschikbaar.</strong> Er is niets gewijzigd. Vernieuw de pagina of probeer het later opnieuw.
        </p>
      ) : null}
      <SummaryStrip items={[
        { label: "Verbindingen", value: data.connections.length },
        { label: "Actief", tone: active.length ? "success" : "neutral", value: active.length },
        { label: "Aandacht nodig", tone: withErrors.length ? "warning" : "success", value: withErrors.length },
        { label: "Privacyfeeds", detail: "Expliciete tenantopt-in vereist", value: "Standaard uit" }
      ]} />
      <section className="workspace-section" aria-labelledby="sportlink-connections-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="sportlink-connections-title">Tenantverbindingen</h2>
            <p className="work-panel__meta">Client ID’s blijven versleuteld; dit overzicht toont alleen de gemaskeerde suffix en operationele metadata.</p>
          </div>
          <StatusPill label="Server-side" tone="success" />
        </div>
        {!data.connections.length && !data.error ? (
          <div className={styles.emptyState}>
            <Database aria-hidden="true" />
            <h3>Nog geen Sportlink-verbindingen</h3>
            <p>Een tenantbeheerder kan Sportlink via Databronnen veilig testen en koppelen.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {data.connections.map((connection) => (
              <article className={styles.card} key={connection.id}>
                <div className={styles.cardBody}>
                  <div className={styles.cardTop}>
                    {connection.last_error_code
                      ? <Activity aria-hidden="true" />
                      : <ShieldCheck aria-hidden="true" />}
                    <StatusPill
                      label={connectionStatus(connection.status, connection.last_error_code)}
                      tone={connection.last_error_code ? "warning" : connection.status === "active" ? "success" : "neutral"}
                    />
                  </div>
                  <div>
                    <h3 className={styles.cardTitle}>{connection.detected_club_name ?? "Clubnaam onbekend"}</h3>
                    <p className={styles.muted}>{data.tenants.get(connection.tenant_id) ?? "Onbekende tenant"} · Client ID •••• {connection.client_id_suffix}</p>
                  </div>
                  <dl className={styles.definitionList}>
                    <div><dt>Laatste succes</dt><dd>{formatDate(connection.last_success_at)}</dd></div>
                    <div><dt>Volgende sync</dt><dd>{formatDate(connection.next_sync_at)}</dd></div>
                    <div><dt>Duur</dt><dd>{connection.last_duration_ms === null ? "Nog onbekend" : `${connection.last_duration_ms} ms`}</dd></div>
                    <div><dt>Foutcode</dt><dd>{connection.last_error_code ?? "Geen"}</dd></div>
                  </dl>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/platform/tenants/${connection.tenant_id}`}>Tenant openen</Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

async function loadSportlinkOverview() {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return {
    connections: [],
    error: true,
    tenants: new Map<string, string>()
  };
  const connectionsResult = await supabase
    .from("sportlink_connections")
    .select("id,tenant_id,status,detected_club_name,client_id_suffix,last_success_at,next_sync_at,last_duration_ms,last_error_code")
    .order("updated_at", { ascending: false });
  if (connectionsResult.error) return {
    connections: [],
    error: true,
    tenants: new Map<string, string>()
  };
  const connections = connectionsResult.data ?? [];
  const tenantIds = [...new Set(connections.map((connection) => connection.tenant_id))];
  const tenantsResult = tenantIds.length
    ? await supabase.from("tenants").select("id,name").in("id", tenantIds)
    : { data: [], error: null };
  return {
    connections,
    error: Boolean(tenantsResult.error),
    tenants: new Map((tenantsResult.data ?? []).map((tenant) => [tenant.id, tenant.name]))
  };
}

function connectionStatus(status: string, errorCode: string | null) {
  if (errorCode) return "Aandacht nodig";
  if (status === "active") return "Actief";
  if (status === "paused") return "Gepauzeerd";
  if (status === "revoked") return "Ingetrokken";
  return "Niet beschikbaar";
}

function formatDate(value: string | null) {
  if (!value) return "Nog niet";
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
