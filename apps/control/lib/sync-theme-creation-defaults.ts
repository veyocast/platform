import {
  syncSlidePresentationSchema, syncThemeCreationDefaultsSchema,
  isSyncOnzeTrotsPresentation,syncOnzeTrotsV9RendererVersion,syncOnzeTrotsV9SourceRevision,syncSlideRendererVersion,syncSlideSourceRevision,
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
  if(isSyncOnzeTrotsPresentation(presentation)&&themeId==='fieldflow'&&presentation.rich&&Object.keys(presentation.rich).length)throw Error('Dit ontwerp bevat OnzeTrots-bronvelden. Maak een nieuw FieldFlow-ontwerp om alle brongegevens te behouden.');
  // Source withTheme clears a previous uploaded background when choosing a package.
  const style = { ...presentation.style };
  delete style.backgroundAsset;
  const {rich:unusedRich,visual:unusedVisual,authoring:unusedAuthoring,...base}={...presentation,rich:isSyncOnzeTrotsPresentation(presentation)?presentation.rich:undefined,visual:isSyncOnzeTrotsPresentation(presentation)?presentation.visual:undefined,authoring:presentation.rendererVersion==='sync-onzetrots-v9'?presentation.authoring:undefined};
  void unusedRich;void unusedVisual;void unusedAuthoring;
  return syncSlidePresentationSchema.parse({ ...base, theme: themeId,
    rendererVersion:themeId==='onzetrots-tv'?syncOnzeTrotsV9RendererVersion:syncSlideRendererVersion,
    sourceRevision:themeId==='onzetrots-tv'?syncOnzeTrotsV9SourceRevision:syncSlideSourceRevision,
    ...(themeId==='onzetrots-tv'?{rowsPerPage:6,authoring:{...(presentation.rendererVersion==='sync-onzetrots-v9'?presentation.authoring:{schemaVersion:1,headerSubtitles:{},headerTexts:{},welcomeScalePercent:150}),visualRevision:'onzetrots-20261024'},visual:{schemaVersion:1,mode:defaults.mode==='dark'?'dark':'light',scrollSpeed:'normal',panelOpacity:94},...(isSyncOnzeTrotsPresentation(presentation)&&presentation.rich?{rich:presentation.rich}:{})}:{}),
    style: { ...style,
    accent: defaults.accent, font: defaults.font === "Georgia" ? "Serif" : defaults.font, fontChanged: true,
    background: themeId==='onzetrots-tv'?'clubmuur':defaults.mode === "light" ? "light" : defaults.background === "clubkleur" ? "gradient" : defaults.background,
    scale: defaults.scale, motion: defaults.motion, showLogo: defaults.showLogo,
  } });
}
