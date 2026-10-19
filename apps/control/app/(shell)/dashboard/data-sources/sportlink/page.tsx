import { hasCapability } from "@veyocast/auth";
import { requireTenantControlSession } from "../../../../../lib/control-session";
import { loadSportlinkSourceData } from "./source-data.server";
import { SportlinkSourceWorkspace } from "./source-workspace.server";

export default async function SportlinkPage({ searchParams }: { searchParams: Promise<{ fout?: string; succes?: string }> }) {
  const session = await requireTenantControlSession("tenant.data_source.read");
  const data = session.isLive ? await loadSportlinkSourceData(session.tenantId!) : null;
  const canManage = session.tenantStatus === "active" && hasCapability(session.capabilities, "tenant.data_source.manage");
  return <SportlinkSourceWorkspace data={data} canManage={canManage} timezoneName={session.timezoneName} params={await searchParams} />;
}
