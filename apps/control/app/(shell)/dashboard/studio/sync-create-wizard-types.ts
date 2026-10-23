import type { SyncContentFamily, SyncDynamicCommand, SyncDynamicConfiguration, SyncSlidePresentation, SyncThemeDefaultsReadModel } from "@veyocast/contracts";
import type { StudioDocument } from "@veyocast/studio";

export type SyncCreateWizardMode = "manual" | "connected";
export type SyncCreateWizardSource = {
  id: string;
  name: string;
  kind: string;
  providerStatus: string;
  lastSuccessfulSyncAt: string | null;
  lastErrorCode: string | null;
};
export type SyncCreateWizardData = {
  tenantId: string;
  actorScope: string;
  tenantName: string;
  family: SyncContentFamily;
  initialPresentation: SyncSlidePresentation;
  canCreateManual: boolean;
  canCreateConnected: boolean;
  initialMode: SyncCreateWizardMode;
  initialSourceId?: string;
  slideType: SyncDynamicConfiguration["slideType"] | null;
  sources: SyncCreateWizardSource[];
  templates: Array<{ versionId: string; orientation: "landscape" | "portrait"; slug: string }>;
  images?: Array<{ id: string; title: string; checksumSha256: string; url: string }>;
  themeDefaults?: SyncThemeDefaultsReadModel;
  themeDefaultsError?: string | null;
  loadError: string | null;
};
/** Entire original writer command, without transient previews or signed URLs. */
export type SyncCreateWizardCommand =
  | { kind: "manual"; document: StudioDocument; idempotencyKey: string }
  | { kind: "connected"; command: SyncDynamicCommand };
export type SyncCreateWizardResult =
  | { ok: true; href: string }
  | { ok: false; error: string; rejected?: boolean };
