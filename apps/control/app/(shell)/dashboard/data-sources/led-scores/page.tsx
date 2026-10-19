import { hasCapability } from "@veyocast/auth";
import { requireTenantControlSession } from "../../../../../lib/control-session";
import { emptyLedSourceData, loadLedSourceData } from "./source-data.server";
import { LedSourceWorkspace } from "./source-workspace.server";

export default async function LedScoresPage({ searchParams }: { searchParams: Promise<{ fout?: string; succes?: string }> }) {
  const session = await requireTenantControlSession("tenant.data_source.read");
  const data = session.isLive ? await loadLedSourceData(session.tenantId!) : emptyLedSourceData();
  const canManage = session.isLive && session.tenantStatus === "active" && hasCapability(session.capabilities, "tenant.data_source.manage");
  return <LedSourceWorkspace data={data} canManage={canManage} timezoneName={session.timezoneName} params={await searchParams} />;
}
