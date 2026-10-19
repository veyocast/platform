import { SyncSlideStaticView } from "@veyocast/content-templates/sync-slide-static-view";
import { createSyncStudioStarter } from "@veyocast/studio/mobile-v3";
import type { SyncThemeDefaultsCommand, SyncThemeDefaultsProfile } from "@veyocast/contracts";
import { applySyncThemeCreationDefaults, syncThemeCreationStarterDefaults } from "../../../../lib/sync-theme-creation-defaults";
import styles from "./sync-theme-catalog-preview.module.css";

type Props = { themeId: SyncThemeDefaultsCommand["themeId"]; themeName: string; tenantName: string; profile?: SyncThemeDefaultsProfile };

/** An accessible thumbnail of the real new-design renderer, never rollout status. */
export function SyncThemeCatalogPreview({ themeId, themeName, tenantName, profile }: Props) {
  const defaults = profile?.defaults ?? syncThemeCreationStarterDefaults(themeId);
  const starter = createSyncStudioStarter({ family: "free", tenantName, theme: themeId }).syncPresentation!;
  const presentation = applySyncThemeCreationDefaults({ ...starter, title: "Onze club,\njouw verhaal.", subtitle: "Stijlvoorbeeld", body: "" }, themeId, defaults);
  return <div className={styles.preview} role="img" aria-label={`${themeName} stijlvoorbeeld voor ${tenantName}. ${profile?.configured ? "Opgeslagen opmaak voor nieuwe ontwerpen" : "Nog niet opgeslagen Source-beginwaarden"}. Lettertype ${defaults.font}, ${defaults.scale} procent, ${defaults.mode === "light" ? "lichte" : defaults.mode === "dark" ? "donkere" : "pakketgebonden"} achtergrond.`}>
    <div aria-hidden="true"><SyncSlideStaticView presentation={presentation} compact /></div>
  </div>;
}
