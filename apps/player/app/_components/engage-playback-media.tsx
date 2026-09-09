"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  type CSSProperties
} from "react";

import {
  engagePublicCampaignSchema,
  type EngagePublicCampaign
} from "@veyocast/contracts";

import type { PlayerManifestItem } from "../_lib/player-manifest";
import {
  themePresentationFromDynamicData,
  type FrozenPlayerTheme
} from "./player-presentation-theme";

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
  const theme = useMemo(
    () => themePresentationFromDynamicData(item.dynamicTemplate?.data),
    [item.dynamicTemplate?.data]
  );

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
        // A bounded retry keeps the last valid live projection visible.
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
    // The immutable release poster remains the authority while live data is
    // unavailable. No score or percentage is manufactured in the Player.
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={item.accessibilityName ?? item.title} className={`playback-media playback-media--${item.fitMode}`} onLoad={() => onReady(item.id)} src={item.source.url} />;
  }

  return (
    <EngageCampaignSurface
      campaign={campaign}
      publicId={binding.publicId}
      theme={theme}
    />
  );
}

export function EngageCampaignSurface({
  campaign,
  publicId,
  theme = null
}: {
  campaign: EngagePublicCampaign;
  publicId: string;
  theme?: FrozenPlayerTheme | null;
}) {
  const active = campaign.status === "live";
  const visibleOptions = useMemo(
    () => [...campaign.options].sort((left, right) => (
      left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, "nl")
    )),
    [campaign.options]
  );

  return (
    <section
      aria-label={campaign.title}
      className="engage-playback"
      data-campaign-id={campaign.id}
      data-campaign-kind={campaign.kind}
      data-design-revision={theme?.designRevision ?? "player-fallback"}
      data-motion-state={theme?.motionEnabled === false ? "off" : "on"}
      data-option-count={visibleOptions.length}
      data-status={campaign.status}
      data-theme-mode={theme?.mode ?? "dark"}
      style={theme?.style}
    >
      <div aria-hidden="true" className="engage-playback__flow">
        <span /><span /><span />
      </div>
      <aside aria-hidden="true" className="engage-playback__sideband">
        <span>{campaign.tenantName}</span><b>ENG</b><span>Jouw club · jouw stem</span>
      </aside>
      <header className="engage-playback__masthead">
        <strong>{campaign.tenantName}</strong>
        <span>{active ? "VeyoCast Engage · live" : "VeyoCast Engage · gesloten"}</span>
      </header>
      <section className="engage-playback__title">
        <div>
          <span className="engage-playback__eyebrow">{campaign.title}</span>
          <h1>{campaign.question}</h1>
        </div>
        <div className="engage-playback__title-stat">
          <strong>{campaign.totalVotes}</strong>
          <span>{campaign.totalVotes === 1 ? "stem" : "stemmen"}</span>
        </div>
      </section>
      <div className="engage-playback__body">
        <EngageResults
          campaign={campaign}
          motionEnabled={theme?.motionEnabled !== false}
          options={visibleOptions}
        />
        <aside className="engage-playback__callout" aria-label={active ? "Stemoproep" : "Campagnestatus"}>
          <div className="engage-playback__callout-copy">
            <span className="engage-playback__eyebrow">
              {active ? "Jouw stem telt" : "Stemmen gesloten"}
            </span>
            <h2>{active ? "Laat van je horen." : "Bedankt voor het stemmen."}</h2>
            <p>
              {active
                ? campaign.kind === "motm"
                  ? "Scan de code en kies jouw speler."
                  : "Scan de code en maak jouw keuze."
                : campaign.resultsVisible
                  ? "De einduitslag staat hiernaast."
                  : "De organisator maakt de uitslag afzonderlijk bekend."}
            </p>
            <small>{campaign.tenantName}</small>
          </div>
          {active ? (
            <div className="engage-playback__qr">
              {/* The QR SVG is generated locally by the Player server. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={`QR-code voor ${campaign.title}`} src={`/api/player/engage/${publicId}/qr`} />
            </div>
          ) : (
            <strong className="engage-playback__closed-state" role="status">
              Campagne gesloten
            </strong>
          )}
        </aside>
      </div>
      <footer className="engage-playback__footer">
        <span>{campaign.tenantName}</span>
        <span>{campaign.status === "closed" ? "Eindresultaat" : "Stemmen is geopend"}</span>
      </footer>
    </section>
  );
}

function EngageResults({
  campaign,
  motionEnabled,
  options
}: {
  campaign: EngagePublicCampaign;
  motionEnabled: boolean;
  options: EngagePublicCampaign["options"];
}) {
  const [barsReady, setBarsReady] = useState(!motionEnabled);

  useEffect(() => {
    if (!motionEnabled) {
      setBarsReady(true);
      return;
    }
    setBarsReady(false);
    const frame = window.requestAnimationFrame(() => setBarsReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, [campaign.id, motionEnabled]);

  return (
    <section
      className="engage-playback__results"
      data-bars-ready={barsReady ? "true" : "false"}
      data-results-visible={campaign.resultsVisible ? "true" : "false"}
    >
      <header>
        <span className="engage-playback__eyebrow">
          {campaign.kind === "motm" ? "Speler van de wedstrijd" : "Resultaten"}
        </span>
        <h1>{campaign.resultsVisible
          ? campaign.status === "closed" ? "Eindresultaat." : "Jullie tussenstand."
          : campaign.status === "closed" ? "Uitslag niet openbaar." : "Tussenstand verborgen."}</h1>
      </header>
      {campaign.resultsVisible ? (
        <ol className="engage-playback__rows">
          {options.map((option, index) => {
            const percentage = engageOptionPercentage(
              option.voteCount,
              campaign.totalVotes
            );
            return (
              <li data-option-id={option.id} key={option.id} style={{ "--engage-order": index } as CSSProperties}>
                <div className="engage-playback__identity">
                  <span className="engage-playback__rank">{String(index + 1).padStart(2, "0")}</span>
                  <strong>{option.label}</strong>
                  <b>{percentage === null ? "—" : formatPercentage(percentage)}<small>{percentage === null ? "" : "%"}</small></b>
                </div>
                <div
                  aria-label={option.label}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={percentage ?? undefined}
                  aria-valuetext={percentage === null ? "Nog niet beschikbaar" : undefined}
                  className="engage-playback__track"
                  role="progressbar"
                >
                  <i style={{ "--engage-progress": (percentage ?? 0) / 100 } as CSSProperties} />
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="engage-playback__result-state" role="status">
          <strong>{campaign.status === "closed"
            ? "Er is geen openbare eindstand."
            : "Stemmen kan zonder de actuele verdeling te tonen."}</strong>
          <span>VeyoCast vult geen ontbrekende percentages in.</span>
        </div>
      )}
      <footer>
        <span>
          <strong>{campaign.totalVotes}</strong>{" "}
          {campaign.totalVotes === 1 ? "geldige stem" : "geldige stemmen"}
        </span>
        <span>{campaign.status === "closed" ? "Eindstand" : "Tussenstand"}</span>
      </footer>
    </section>
  );
}

export function engageOptionPercentage(
  voteCount: number | undefined,
  totalVotes: number
) {
  if (voteCount === undefined) return null;
  if (totalVotes <= 0) return 0;
  return Math.max(0, Math.min(100, voteCount / totalVotes * 100));
}

function formatPercentage(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    maximumFractionDigits: value > 0 && value < 1 ? 1 : 0
  }).format(value);
}
