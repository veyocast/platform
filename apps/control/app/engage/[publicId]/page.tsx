import { engagePublicCampaignSchema } from "@veyocast/contracts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createControlAdminClient } from "../../../lib/supabase/admin";
import styles from "./engage-public.module.css";
import { EngageVote } from "./engage-vote";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Publieksactie · VeyoCast Engage"
};

export default async function PublicEngagePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(publicId)) notFound();
  const admin = createControlAdminClient();
  const result = await admin.rpc("get_engage_campaign_public_v1", { p_public_id: publicId });
  const parsed = engagePublicCampaignSchema.safeParse(result.data);
  if (!parsed.success) notFound();
  const campaign = parsed.data;
  return <main className={styles.page}><div className={styles.shell}><div className={styles.brand}><span aria-hidden="true">▼</span> VeyoCast Engage</div><header className={styles.hero}><p className={styles.eyebrow}>{campaign.tenantName} · {campaign.kind === "motm" ? "Man/vrouw van de wedstrijd" : "Publiekspoll"}</p><h1>{campaign.title}</h1><p>{campaign.question}</p></header><EngageVote initialCampaign={campaign} publicId={publicId} /></div></main>;
}
