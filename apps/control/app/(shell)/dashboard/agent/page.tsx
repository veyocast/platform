import Link from "next/link";
import { requireControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import type { AgentProposal } from "../../../../lib/agent/catalog";
import { PageHeader } from "../../_components/shell-primitives";
import { AgentWorkspace } from "./workspace";
import { getSupabasePublicConfig } from "../../../../lib/supabase/config";

export default async function AgentPage() {
  const session = await requireControlSession();
  const client = await createControlSupabaseClient();
  const state = session.isLive && session.tenantId && client ? await client.rpc("get_ai_agent_state_v1", { p_tenant_id: session.tenantId }) : null;
  const enabled = !state?.error && state?.data === true;
  const publicConfig = getSupabasePublicConfig();
  const conversation = enabled && client ? await client.from("ai_conversations").select("id").eq("tenant_id", session.tenantId).eq("user_id", session.userId).order("created_at", { ascending: false }).limit(1).maybeSingle() : null;
  const existing = enabled && client ? await client.from("ai_proposals").select("*").eq("tenant_id", session.tenantId).eq("user_id", session.userId).order("created_at", { ascending: false }).limit(20) : null;
  return <>
    <PageHeader eyebrow={`Beheer · ${session.tenant}`} title="AI-agent" description="Stel een vraag of maak een voorstel. Alleen jouw expliciete akkoord kan een beheeractie uitvoeren; je bestaande rechten blijven gelden." />
    {enabled ? <AgentWorkspace key={`${session.tenantId}:${session.userId}`} tenantName={session.tenant} timezone={session.timezoneName} initialConversationId={conversation?.data?.id ?? null} initialProposals={(existing?.data ?? []) as AgentProposal[]} videoConfig={publicConfig ? { anonKey: publicConfig.anonKey, supabaseUrl: publicConfig.url } : null} /> : <section className="workspace-section"><h2>AI is niet ingeschakeld</h2><p>Een bevoegde platformbeheerder kan de agent voor deze vereniging vrijgeven. Bij ontbrekende configuratie of een storing blijven de gewone beheerfuncties en bestaande playlists beschikbaar.</p><Link href="/dashboard/content">Gewone contentbediening openen</Link></section>}
  </>;
}
