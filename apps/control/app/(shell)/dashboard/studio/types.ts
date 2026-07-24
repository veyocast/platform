import type {
  StudioDocument,
  StudioRenderOutputType,
  StudioRenderStatus
} from "@veyocast/studio";

export type StudioProjectStatus = "active" | "archived" | "deleted";
export type StudioProjectKind = "design" | "tenant_template";

export type StudioProjectSummary = {
  createdAt: string;
  document: StudioDocument | null;
  draftRevision: number;
  durationMs: number;
  id: string;
  kind: StudioProjectKind;
  lastExportMediaId: string | null;
  lastRenderStatus: StudioRenderStatus | null;
  motionEnabled: boolean;
  name: string;
  orientation: "landscape" | "portrait";
  ownerUserId: string | null;
  projectRevision: number;
  status: StudioProjectStatus;
  updatedAt: string;
};

export type StudioMediaAsset = {
  height: number | null;
  id: string;
  kind: "image";
  previewUrl: string | null;
  title: string;
  width: number | null;
};

export type StudioRenderJob = {
  attemptCount: number;
  createdAt: string;
  errorCode: string | null;
  errorDetail: string | null;
  finishedAt: string | null;
  id: string;
  mediaAssetId: string | null;
  outputKind: StudioRenderOutputType;
  progress: number;
  projectId: string;
  revisionId: string;
  startedAt: string | null;
  status: StudioRenderStatus;
  updatedAt: string;
};

export type StudioRevision = {
  createdAt: string;
  createdBy: string | null;
  createdByName: string;
  document: StudioDocument;
  draftRevision: number;
  id: string;
  number: number;
  reason: "checkpoint" | "render" | "restore";
};

export type StudioBrandKit = {
  logoMediaAssetId: string;
  logoPreviewUrl: string | null;
  primaryColor: string;
  revision: number;
  secondaryColor: string;
};

export type StudioProjectDetail = {
  createdAt: string;
  document: StudioDocument;
  draftRevision: number;
  id: string;
  kind: StudioProjectKind;
  motionEnabled: boolean;
  name: string;
  orientation: "landscape" | "portrait";
  ownerUserId: string | null;
  projectRevision: number;
  status: StudioProjectStatus;
  updatedAt: string;
};

export type StudioOverviewData = {
  error: string | null;
  projects: StudioProjectSummary[];
  renderJobs: StudioRenderJob[];
};

export type StudioEditorData = {
  assets: StudioMediaAsset[];
  brandKit: StudioBrandKit | null;
  error: string | null;
  project: StudioProjectDetail | null;
  renderJobs: StudioRenderJob[];
  revisions: StudioRevision[];
};

export type StudioEditorPermissions = {
  canArchive: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canManageBrand: boolean;
  canManageJobs: boolean;
  canManageTemplate: boolean;
  canRender: boolean;
};

export type StudioBrandResources = {
  assets: StudioMediaAsset[];
  brandKit: StudioBrandKit | null;
  error: string | null;
};
