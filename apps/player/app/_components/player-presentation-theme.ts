import type { CSSProperties } from "react";

import {
  themePresentationSnapshotSchema,
  type ThemePresentationSnapshot
} from "@veyocast/contracts";
import {
  themeCssVariables,
  themeToEditorialTokens
} from "@veyocast/content-templates";

export type FrozenPlayerTheme = Readonly<{
  designRevision: "legacy" | "royal-current-v8";
  mode: "dark" | "light";
  motionEnabled: boolean;
  snapshot: ThemePresentationSnapshot;
  style: CSSProperties;
}>;

/**
 * Projects only a validated, immutable presentation snapshot into live Player
 * surfaces. A missing snapshot deliberately returns null: callers then retain
 * the Player's product-owned Navy fallback instead of inventing tenant style.
 */
export function resolveFrozenPlayerTheme(value: unknown): FrozenPlayerTheme | null {
  const parsed = themePresentationSnapshotSchema.safeParse(value);
  if (!parsed.success) return null;

  const snapshot = parsed.data;
  const royalCurrent = snapshot.snapshotVersion === 2 &&
    snapshot.appearance.schemaVersion === 2 &&
    snapshot.appearance.designRevision === "royal-current-v8";
  const motionEnabled = snapshot.snapshotVersion === 2 &&
    snapshot.appearance.schemaVersion === 2
    ? snapshot.appearance.motionEnabled
    : true;
  let tokens: ReturnType<typeof themeToEditorialTokens>;
  let variables: ReturnType<typeof themeCssVariables>;

  try {
    tokens = themeToEditorialTokens(snapshot);
    variables = themeCssVariables(snapshot, tokens);
  } catch {
    // A structurally valid snapshot can still reference a catalog version that
    // is not bundled in this immutable Player release. Never let that replace
    // the active release or crash playback; callers retain the Navy fallback.
    return null;
  }

  return {
    designRevision: royalCurrent ? "royal-current-v8" : "legacy",
    mode: snapshot.resolvedMode.mode,
    motionEnabled,
    snapshot,
    style: {
      ...variables,
      "--player-accent": tokens.accent,
      "--player-accent-soft": tokens.accentSoft,
      "--player-bg": tokens.canvas,
      "--player-ink": tokens.text,
      "--player-line": tokens.border,
      "--player-muted": tokens.textMuted,
      "--player-on-accent": tokens.textOnAccent,
      "--player-surface": tokens.surface,
      "--player-surface-2": tokens.surfaceRaised
    } as CSSProperties
  };
}

export function themePresentationFromDynamicData(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return resolveFrozenPlayerTheme(
    (value as Record<string, unknown>).themePresentation
  );
}
