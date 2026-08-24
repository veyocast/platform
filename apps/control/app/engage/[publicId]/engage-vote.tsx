"use client";

import { useEffect, useState } from "react";
import type { EngagePublicCampaign, EngageVoteResult } from "@veyocast/contracts";

import styles from "./engage-public.module.css";

export function EngageVote({ initialCampaign, publicId }: { initialCampaign: EngagePublicCampaign; publicId: string }) {
  const [campaign, setCampaign] = useState(initialCampaign);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const refresh = async () => {
      const response = await fetch(`/api/engage/${publicId}`, { cache: "no-store" });
      if (response.ok) setCampaign(await response.json() as EngagePublicCampaign);
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => window.clearInterval(timer);
  }, [publicId]);
  const vote = async (optionId: string) => {
    setPending(true); setMessage(null);
    const response = await fetch(`/api/engage/${publicId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ optionId }) });
    const payload = await response.json().catch(() => null) as EngageVoteResult | { error?: string } | null;
    if (response.ok && payload && "campaign" in payload) {
      setCampaign(payload.campaign);
      setMessage(payload.accepted ? "Je stem telt mee. Dank je wel!" : "Je stem was al geregistreerd.");
    } else setMessage(payload && "error" in payload ? payload.error ?? "Stemmen mislukt." : "Stemmen mislukt.");
    setPending(false);
  };
  return <>
    {message ? <p className={styles.status} role="status">{message}</p> : null}
    <div aria-label="Keuzes" className={styles.options}>{campaign.options.map((option) => {
      const count = option.voteCount ?? 0;
      const percent = campaign.totalVotes ? Math.round(count / campaign.totalVotes * 100) : 0;
      return <button className={styles.option} disabled={pending || campaign.status === "closed"} key={option.id} onClick={() => void vote(option.id)} type="button"><span>{option.label}</span>{campaign.resultsVisible ? <><span className={styles.bar}><span className={styles.fill} style={{ width: `${percent}%` }} /></span><span className={styles.meta}>{percent}% · {count} {count === 1 ? "stem" : "stemmen"}</span></> : null}</button>;
    })}</div>
    <p className={styles.notice}>{campaign.privacyNotice} Er worden geen naam of ruwe netwerkgegevens opgeslagen.</p>
  </>;
}
