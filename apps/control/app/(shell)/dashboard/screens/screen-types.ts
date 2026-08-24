export type FleetScreen = {
  activeAssignmentSource: "default" | "override" | "schedule";
  activeScheduleId: string | null;
  activeTargetSnapshotId: string | null;
  assignedPlaylistId: string | null;
  assignedReleaseId: string | null;
  createdAt: string;
  defaultPlaylistId: string | null;
  defaultReleaseId: string | null;
  id: string;
  location: string | null;
  name: string;
  orientation: string;
  resolutionHeight: number | null;
  resolutionWidth: number | null;
  status: string;
};

export type ScreenSchedule = {
  enabled: boolean;
  endsAt: string | null;
  id: string;
  isActive: boolean;
  name: string;
  priority: number;
  releaseId: string;
  releaseLabel: string;
  source: string;
  startsAt: string;
  targetKind: string;
  targetName: string;
  timezoneName: string;
};

export type FleetDevice = {
  activeReleaseId: string | null;
  appVersion: string | null;
  capabilities: Record<string, unknown>;
  desiredReleaseId: string | null;
  deviceName: string | null;
  id: string;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
  lastSeenAt: string | null;
  pairedAt: string;
  platform: string | null;
  revokedAt: string | null;
  screenId: string;
  status: string;
  storageQuotaBytes: number | null;
  storageUsedBytes: number | null;
  syncRetryRequestedAt: string | null;
};

export type FleetRelease = {
  automatic: boolean;
  id: string;
  label: string;
  playlistId: string;
  playlistName: string;
  publishedAt: string;
  version: number;
};

export type ScreenHeartbeat = {
  activeReleaseId: string | null;
  appVersion: string | null;
  createdAt: string;
  id: string;
  runtimeState: string;
  storageQuotaBytes: number | null;
  storageUsedBytes: number | null;
};

export type ScreenSyncEvent = {
  createdAt: string;
  detail: Record<string, unknown>;
  id: string;
  phase: string;
  releaseId: string | null;
};

export type ScreenAuditEvent = {
  action: string;
  createdAt: string;
  id: string;
  metadata: Record<string, unknown>;
  result: string;
  targetId: string | null;
  targetType: string;
};

export type ScreenPlayerCommand = {
  acknowledgedAt: string | null;
  commandType: string;
  completedAt: string | null;
  createdAt: string;
  deliveredAt: string | null;
  expiresAt: string;
  failedAt: string | null;
  failureCode: string | null;
  id: string;
};

export type ScreenFleetData = {
  automation: Record<string, ScreenAutomationSummary>;
  devices: FleetDevice[];
  error: string | null;
  features: { healthView: boolean; venueTwin: boolean };
  floorplans: VenueFloorplan[];
  floorplanAssets: Array<{ height: number | null; id: string; title: string; width: number | null }>;
  groups: Array<{ id: string; memberIds: string[]; name: string; revision: number }>;
  limit: number;
  releases: FleetRelease[];
  screens: FleetScreen[];
  settings: { height: number; orientation: string; width: number };
  venuePlacements: VenueScreenPlacement[];
  venues: Venue[];
  zones: VenueZone[];
};

export type Venue = {
  addressLabel: string | null;
  id: string;
  name: string;
  status: string;
};

export type VenueFloorplan = {
  height: number;
  id: string;
  mediaAssetId: string | null;
  name: string;
  previewUrl: string | null;
  revision: number;
  venueId: string;
  width: number;
};

export type VenueZone = {
  description: string | null;
  floorplanId: string | null;
  id: string;
  name: string;
  venueId: string;
};

export type VenueScreenPlacement = {
  floorplanId: string | null;
  id: string;
  orientation: string;
  revision: number;
  screenId: string;
  venueId: string;
  wallAngleDegrees: number | null;
  xNormalized: number;
  yNormalized: number;
  zoneId: string | null;
};

export type ScreenAutomationSummary = {
  enabled: boolean;
  label: string;
};

export type ScreenDetailData = {
  automation: ScreenAutomationSummary;
  auditEvents: ScreenAuditEvent[];
  devices: FleetDevice[];
  error: string | null;
  heartbeats: ScreenHeartbeat[];
  playerCommands: ScreenPlayerCommand[];
  releases: FleetRelease[];
  schedules: ScreenSchedule[];
  screen: FleetScreen | null;
  syncEvents: ScreenSyncEvent[];
  venueContext: {
    floorplan: VenueFloorplan | null;
    placement: VenueScreenPlacement;
    venue: Venue;
    zone: VenueZone | null;
  } | null;
};
