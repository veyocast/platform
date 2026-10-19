import {
  syncSlidePresentationSchema, syncThemeCreationDefaultsSchema,
  type SyncSlidePresentation, type SyncThemeCreationDefaults, type SyncThemeDefaultsCommand,
} from "@veyocast/contracts";

/** Actual Source store defaults. Unconfigured examples are never claimed saved. */
export function syncThemeCreationStarterDefaults(themeId: SyncThemeDefaultsCommand["themeId"]): SyncThemeCreationDefaults {
  return { accent: themeId === "fieldflow" ? "#006D83" : "#1268e8", font: "Manrope", mode: "light", scale: 100,
    background: "clubkleur", motion: "rustig", showLogo: true };
}

/** Apply once to a fresh draft or an explicit theme choice, never to recovery. */
export function applySyncThemeCreationDefaults(presentation: SyncSlidePresentation, themeId: SyncThemeDefaultsCommand["themeId"], input: SyncThemeCreationDefaults): SyncSlidePresentation {
  const defaults = syncThemeCreationDefaultsSchema.parse(input);
  // Source withTheme clears a previous uploaded background when choosing a package.
  const style = { ...presentation.style };
  delete style.backgroundAsset;
  return syncSlidePresentationSchema.parse({ ...presentation, theme: themeId, style: { ...style,
    accent: defaults.accent, font: defaults.font === "Georgia" ? "Serif" : defaults.font, fontChanged: true,
    background: defaults.mode === "light" ? "light" : defaults.background === "clubkleur" ? "gradient" : defaults.background,
    scale: defaults.scale, motion: defaults.motion, showLogo: defaults.showLogo,
  } });
}
