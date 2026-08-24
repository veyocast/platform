"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

import {
  calculateMonthlyScreenPriceGrossCents,
  VEYOCAST_SCREEN_PRICE_GROSS_CENTS,
  VEYOCAST_TRIAL_DURATION_HOURS
} from "@veyocast/domain";

function formatGrossCents(cents: number) {
  const euros = Math.floor(cents / 100).toLocaleString("nl-NL");
  return `€ ${euros},${String(cents % 100).padStart(2, "0")}`;
}

export function MarketingPriceCalculator() {
  const [screenCount, setScreenCount] = useState(1);
  const grossMonthlyCents = calculateMonthlyScreenPriceGrossCents(screenCount);

  return (
    <div className="price-calculator">
      <div className="price-calculator__rate">
        <p className="eyebrow">Eén transparant tarief</p>
        <p><strong>{formatGrossCents(VEYOCAST_SCREEN_PRICE_GROSS_CENTS)}</strong><span>incl. btw per actief scherm per maand</span></p>
        <p>{VEYOCAST_TRIAL_DURATION_HOURS / 24} dagen gratis vanaf de eerste succesvolle schermactivatie.</p>
      </div>
      <div className="price-calculator__estimate" aria-live="polite">
        <label htmlFor="price-screen-count">Aantal actieve schermen</label>
        <div className="price-calculator__counter">
          <button
            aria-label="Eén scherm minder"
            disabled={screenCount === 1}
            onClick={() => setScreenCount((current) => Math.max(1, current - 1))}
            type="button"
          ><Minus aria-hidden size={18} /></button>
          <input
            id="price-screen-count"
            inputMode="numeric"
            max={10_000}
            min={1}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              if (Number.isSafeInteger(next)) setScreenCount(Math.max(1, Math.min(10_000, next)));
            }}
            type="number"
            value={screenCount}
          />
          <button
            aria-label="Eén scherm meer"
            disabled={screenCount === 10_000}
            onClick={() => setScreenCount((current) => Math.min(10_000, current + 1))}
            type="button"
          ><Plus aria-hidden size={18} /></button>
        </div>
        <p><span>Na de proefperiode</span><strong>{formatGrossCents(grossMonthlyCents)} per maand</strong></p>
        <small>Geen verborgen schermtoeslag. De prijs is inclusief 21% Nederlandse btw; afwijkende grensoverschrijdende btw-behandeling wordt vóór contractering bevestigd.</small>
      </div>
    </div>
  );
}
