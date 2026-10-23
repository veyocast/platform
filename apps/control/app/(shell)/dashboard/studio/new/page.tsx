import Link from "next/link";
import { notFound } from "next/navigation";
import { hasCapability } from "@veyocast/auth";
import { syncContentFamilies } from "@veyocast/contracts";
import { Button } from "@veyocast/ui";
import { requireTenantControlSession } from "../../../../../lib/control-session";
import { SyncStudioCreateDialog } from "../sync-studio-create-dialog";
import { loadSyncCreateWizardData } from "../sync-create-wizard-data.server";
import { SyncCreateWizard } from "../sync-create-wizard";

export default async function NewStudioPage({ searchParams }: { searchParams: Promise<{ family?: string; mode?: string; group?: string; source?: string }> }) {
  const session = await requireTenantControlSession();
  const query = await searchParams;
  if (query.family) {
    const family = syncContentFamilies.find(value => value.id === query.family);
    if (!family) notFound();
    const data = await loadSyncCreateWizardData(family.id, query.mode === "connected" || query.mode === "manual" ? query.mode : undefined, query.source);
    if (!data) return <p role="alert" className="notice notice--critical">De beveiligde wizard kan niet worden geopend. Er is niets aangemaakt; meld je opnieuw aan en probeer nogmaals.</p>;
    return <SyncCreateWizard key={`${data.actorScope}:${data.family}`} data={data} />;
  }
  const canCreate = session.isLive && session.tenantStatus === "active" && (hasCapability(session.capabilities, "tenant.studio.create") || hasCapability(session.capabilities, "tenant.dynamic_slide.write"));
  return <>
    <header className="section-header"><div><div className="eyebrow">JE CREATIEVE THUISBASIS</div><h1>Nieuw ontwerp</h1><p>Kies een template en maak het van jouw club.</p></div><Button asChild variant="secondary"><Link href="/dashboard/content">Naar de bibliotheek</Link></Button></header>
    <SyncStudioCreateDialog tenantId={session.tenantId} tenantName={session.tenant} actorScope={`${session.tenantId}:${session.userId}`} canCreate={canCreate} initialOpen initialGroup={query.group} preferredMode={query.mode === "connected" || query.mode === "manual" ? query.mode : undefined} />
  </>;
}
