"use client";

import { useEffect, useState, type CSSProperties } from "react";

import {
  engagePublicCampaignSchema,
  type EngagePublicCampaign
} from "@veyocast/contracts";

import type { PlayerManifestItem } from "../_lib/player-manifest";

export function EngagePlaybackMedia({
  item,
  onReady,
  passive,
  paused = false
}: {
  item: PlayerManifestItem;
  onFailure: (itemId: string, code: "VIDEO_ERROR") => void;
  onReady: (itemId: string) => void;
  passive: boolean;
  paused?: boolean;
}) {
  const [campaign, setCampaign] = useState<EngagePublicCampaign | null>(null);
  const binding = item.onlinePlayback?.kind === "engage"
    ? item.onlinePlayback
    : null;

  useEffect(() => {
    if (!binding || passive || paused || navigator.onLine === false) return;
    let disposed = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/player/engage/${binding.publicId}`, {
          cache: "no-store"
        });
        const parsed = engagePublicCampaignSchema.safeParse(
          response.ok ? await response.json() : null
        );
        if (!disposed && parsed.success) {
          setCampaign(parsed.data);
          onReady(item.id);
          return;
        }
      } catch {
        // A bounded retry keeps the last live projection visible.
      }
    };
    void load();
    const interval = window.setInterval(load, 5_000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [binding, item.id, onReady, passive, paused]);

  if (!campaign || !binding) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={item.accessibilityName ?? item.title} className={`playback-media playback-media--${item.fitMode}`} onLoad={() => onReady(item.id)} src={item.source.url} />;
  }

  const maxVotes = Math.max(
    1,
    ...campaign.options.map((option) => option.voteCount ?? 0)
  );
  return (
    <section className="engage-playback" aria-label={campaign.title}>
      <div className="engage-playback__copy">
        <p>{campaign.status === "closed" ? "Eindresultaat" : "Doe mee"}</p>
        <h1>{campaign.question}</h1>
        <ol>
          {campaign.options.map((option) => (
            <li key={option.id}>
              <span>{option.label}</span>
              {campaign.resultsVisible ? (
                <><span className="engage-playback__bar" style={{ "--engage-width": `${Math.max(4, ((option.voteCount ?? 0) / maxVotes) * 100)}%` } as CSSProperties} /><strong>{option.voteCount ?? 0}</strong></>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
      <aside className="engage-playback__qr">
        {/* The QR SVG is generated locally by the Player server. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={`QR-code voor ${campaign.title}`} src={`/api/player/engage/${binding.publicId}/qr`} />
        <strong>Scan en stem</strong>
        <span>{campaign.totalVotes} geldige stemmen</span>
      </aside>
    </section>
  );
}
