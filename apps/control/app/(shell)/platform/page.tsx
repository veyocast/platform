import Link from "next/link";

import { requireControlCapability } from "../../../lib/control-session";
import { loadPlatformOverview } from "../../../lib/control-overview";
import { MetricCard, PageHeader, StatusPill } from "../_components/shell-primitives";

export default async function PlatformPage() {
  const session = await requireControlCapability("platform.system.read");

  if (!session.isLive) return <DemoPlatformPage />;

  const data = await loadPlatformOverview();
  const activeTenants = data.tenants.filter((tenant) => tenant.status === "active").length;
  const onlineDevices = data.devices.filter((device) => isRecentlyOnline(device.last_seen_at)).length;
  const offlineDevices = data.devices.length - onlineDevices;

  return (
    <>
      <PageHeader
        actions={<Link className="button-link button-link--primary" href="/platform/tenants">Verenigingen bekijken</Link>}
        description="Platformstatus uit de stagingdatabase, zonder fictieve tenants of operationele claims."
        eyebrow="Platform"
        status={{ label: "Live platformdata", tone: "success" }}
        title="Platformoverzicht"
      />
      {data.error ? <p className="notice notice--critical" role="alert"><strong>Platformoverzicht niet beschikbaar.</strong> De gegevens konden niet veilig worden geladen. Vernieuw de pagina of log opnieuw in.</p> : null}
      <section className="metric-grid" aria-label="Platformoverzicht">
        <MetricCard detail={`${activeTenants} actief.`} label="Verenigingen" tone="success" value={String(data.tenants.length)} />
        <MetricCard detail="Geregistreerde schermbestemmingen." label="Schermen" value={String(data.screens.length)} />
        <MetricCard detail={`${onlineDevices} recent online.`} label="Gekoppelde Players" tone={offlineDevices ? "warning" : "success"} value={String(data.devices.length)} />
        <MetricCard detail="Zonder recente heartbeat." label="Players met aandacht" tone={offlineDevices ? "warning" : "success"} value={String(offlineDevices)} />
      </section>
      <section className="workspace-section" aria-labelledby="platform-status-title">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="platform-status-title">Operationele context</h2><p className="work-panel__meta">Alle waarden op deze pagina komen uit de live, RLS-beveiligde sessie.</p></div><StatusPill label="Server-side gecontroleerd" tone="success" /></div>
        {!data.tenants.length && !data.error ? <p className="notice" role="status">Nog geen verenigingen. Bootstrap eerst een platformeigenaar en maak daarna de eerste vereniging aan via een gecontroleerde beheeractie.</p> : null}
      </section>
    </>
  );
}

function DemoPlatformPage() {
  return <>
    <PageHeader description="Lokale ontwikkelpreview van de platformnavigatie." eyebrow="Platform" status={{ label: "Demodata", tone: "warning" }} title="Platformoverzicht" />
    <p className="notice notice--warning" role="status">Deze gegevens zijn uitsluitend een lokale ontwikkelfixture en worden niet in staging of productie gebruikt.</p>
    <section className="metric-grid" aria-label="Demo platformoverzicht"><MetricCard detail="Lokale fixture." label="Verenigingen" value="12" /><MetricCard detail="Lokale fixture." label="Schermen" value="246" /></section>
  </>;
}

function isRecentlyOnline(value: string | null) {
  return Boolean(value && Date.now() - new Date(value).getTime() < 5 * 60_000);
}
