import Link from "next/link";
import {hasCapability} from "@veyocast/auth";
import { requireControlSession } from "../../../../lib/control-session";
import { loadMatchdayWorkspace } from "../../../../lib/matchday-service";
import { MatchdayWorkbench } from "./workbench";

export default async function MatchdayPage({searchParams}:{searchParams:Promise<{runbook?:string;day?:string}>}) {
  const session=await requireControlSession();
  const query=await searchParams;
  const result=await loadMatchdayWorkspace(query.runbook??null,query.day??null);
  if (!result.ok) return <div className="px-pages"><Link href="/dashboard">Terug naar Vandaag</Link><h1>Wedstrijddag</h1><p role="alert">{result.message}</p><p>{result.recovery}</p><Link href="/dashboard/matchday">Opnieuw laden</Link></div>;
  const actorScope=`${session.tenantId}:${session.userId}`;
  return <MatchdayWorkbench key={`${actorScope}:${result.workspace.selected?.id??"new"}`} actorScope={actorScope} canReadScreens={hasCapability(session.capabilities,"tenant.screen.read")} workspace={result.workspace} tenantName={session.tenant} timezone={session.timezoneName} />;
}
