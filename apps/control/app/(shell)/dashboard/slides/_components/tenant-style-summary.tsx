import React, { type CSSProperties } from "react";
import Link from "next/link";
import { Gauge, Palette, Sparkles } from "lucide-react";

import type { EditorialThemeConfig } from "@veyocast/contracts";

import type { TenantStyleData } from "../../../../../lib/tenant-style-data";
import styles from "./tenant-style-summary.module.css";

type StyleProperties = CSSProperties & {
  "--tenant-style-accent": string;
  "--tenant-style-canvas": string;
  "--tenant-style-line": string;
  "--tenant-style-muted": string;
  "--tenant-style-shadow": string;
  "--tenant-style-text": string;
};

export function TenantStyleSummary({
  context = "Nieuwe output neemt deze tenantstijl over zodra een immutable versie wordt opgebouwd.",
  showSettingsLink = true,
  style
}: {
  context?: string;
  showSettingsLink?: boolean;
  style: TenantStyleData;
}) {
  const typography = style.appearance.typography;
  const motionEnabled = style.appearance.schemaVersion === 2
    ? style.appearance.motionEnabled
    : true;

  return (
    <section aria-label="Gebruikte clubstijl" className={styles.root}>
      <div className={styles.heading}>
        <div>
          <strong>Gebruikt clubstijl</strong>
          <p>Royal Current en Navy Glass volgen één tenantbreed palet.</p>
        </div>
        {showSettingsLink ? (
          <Link href="/dashboard/themes/fieldflow">Clubstijl beheren</Link>
        ) : null}
      </div>
      <div className={styles.previews}>
        <StylePreview label="Royal Current" tokens={style.light} />
        <StylePreview label="Navy Glass" tokens={style.dark} />
      </div>
      <p className={styles.meta}>
        <span><Palette aria-hidden="true" />{modePolicyLabel(style)}</span>
        <span><Gauge aria-hidden="true" />Tekstschaal {Math.round(typography.baseScale * 100)}%</span>
        <span><Sparkles aria-hidden="true" />Motion {motionEnabled ? "aan" : "uit"}</span>
      </p>
      <p className={styles.note}>{context}</p>
      {style.error ? <p className={styles.error} role="status">{style.error}</p> : null}
    </section>
  );
}

function StylePreview({
  label,
  tokens
}: {
  label: string;
  tokens: EditorialThemeConfig["light"];
}) {
  return (
    <span
      aria-label={`${label} tenantstijl-preview`}
      className={styles.preview}
      style={{
        "--tenant-style-accent": tokens.accent,
        "--tenant-style-canvas": tokens.canvas,
        "--tenant-style-line": tokens.border,
        "--tenant-style-muted": tokens.textMuted,
        "--tenant-style-shadow": tokens.shadow,
        "--tenant-style-text": tokens.text
      } as StyleProperties}
    >
      <span>{label}</span>
      <strong>Clubcontent</strong>
      <i aria-hidden="true" />
    </span>
  );
}

function modePolicyLabel(style: TenantStyleData) {
  const policy = style.selection.modePolicy;
  if (policy.kind === "fixed") {
    return policy.mode === "dark"
      ? "Vaste modus · Navy Glass"
      : "Vaste modus · Royal Current";
  }
  if (policy.kind === "schedule") return "Automatisch volgens tijdschema";
  return "Automatisch volgens scherm";
}
