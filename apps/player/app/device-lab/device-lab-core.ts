export type LabStatus = "FAIL" | "PASS" | "REQUIRES_MANUAL_TEST" | "UNTESTED" | "WARNING";

export type CapabilityResult = {
  detail: string;
  id: string;
  label: string;
  status: LabStatus;
};

export type CodecResult = CapabilityResult & {
  canPlayType: string;
  mediaCapabilities?: string;
  mediaSource?: boolean;
};

export type PlaybackResult = CapabilityResult & {
  durationSeconds?: number;
  events: string[];
  maxCurrentTime?: number;
};

export type TransitionResult = {
  actualAt: number;
  blankMs: number;
  delayMs: number;
  detail: string;
  droppedFrames?: number;
  firstFrameMs?: number;
  from: string;
  status: LabStatus;
  strategy: "A_ONE_VIDEO" | "B_TWO_VIDEOS";
  to: string;
};

export type ManualResult = {
  detail: string;
  id: string;
  label: string;
  status: LabStatus;
};

export type StorageSnapshot = {
  availableBytes?: number;
  persistence?: boolean;
  quotaBytes?: number;
  usageBytes?: number;
};

export type DeviceLabReport = {
  appVersion: string;
  capabilities: CapabilityResult[];
  capturedAt: string;
  codecs: CodecResult[];
  deploymentSha: string;
  device: Record<string, string | number | boolean | null>;
  errors: string[];
  firmware: string;
  lgModel: string;
  manualTests: ManualResult[];
  playback: PlaybackResult[];
  runId: string;
  storageAfter?: StorageSnapshot;
  storageBefore?: StorageSnapshot;
  transitions: TransitionResult[];
};

export const codecCandidates = [
  { id: "h264-baseline-aac", label: "H.264 Baseline + AAC-LC in MP4", mime: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"' },
  { id: "h264-main-aac", label: "H.264 Main + AAC-LC in MP4", mime: 'video/mp4; codecs="avc1.4D401F, mp4a.40.2"' },
  { id: "h264-high-aac", label: "H.264 High + AAC-LC in MP4", mime: 'video/mp4; codecs="avc1.640028, mp4a.40.2"' },
  { id: "h264-no-audio", label: "H.264 High zonder audio in MP4", mime: 'video/mp4; codecs="avc1.640028"' },
  { id: "vp8", label: "VP8 in WebM", mime: 'video/webm; codecs="vp8"' },
  { id: "vp9", label: "VP9 in WebM", mime: 'video/webm; codecs="vp09.00.10.08"' },
  { id: "hevc", label: "HEVC/H.265 in MP4", mime: 'video/mp4; codecs="hvc1.1.6.L120.B0"' },
  { id: "hls", label: "HLS manifest", mime: "application/vnd.apple.mpegurl" },
  { id: "dash", label: "DASH manifest", mime: "application/dash+xml" }
] as const;

export const manualTestDefinitions: ManualResult[] = [
  { detail: "App-shell, manifest en assets downloaden en hashes/groottes verifiëren.", id: "first-sync", label: "A — Eerste synchronisatie", status: "UNTESTED" },
  { detail: "Internet uitschakelen en minimaal twee volledige loops laten spelen.", id: "offline-playback", label: "B — Offline tijdens playback", status: "UNTESTED" },
  { detail: "Offline herladen; last-known-good moet starten.", id: "offline-reload", label: "C — Offline reload", status: "UNTESTED" },
  { detail: "Scherm volledig offline herstarten en opslagbehoud controleren.", id: "offline-reboot", label: "D — Offline reboot", status: "REQUIRES_MANUAL_TEST" },
  { detail: "Release 2 volledig verifiëren en uitsluitend op veilige grens activeren.", id: "atomic-update", label: "E — Atomic update", status: "UNTESTED" },
  { detail: "Corrupt pending asset; release 1 moet blijven spelen.", id: "corrupt-update", label: "F — Corrupte update", status: "UNTESTED" },
  { detail: "Quota-uitputting; actieve en vorige release mogen niet worden verwijderd.", id: "insufficient-storage", label: "G — Onvoldoende opslag", status: "REQUIRES_MANUAL_TEST" },
  { detail: "Power-on, Play via URL/autostart en herstel na stroomuitval.", id: "power-recovery", label: "Autostart en stroomherstel", status: "REQUIRES_MANUAL_TEST" },
  { detail: "24 uur playback; geheugen, stalls, decodefouten en resourcetoename registreren.", id: "soak-24h", label: "24-uurs soaktest", status: "REQUIRES_MANUAL_TEST" }
];

export async function collectDeviceReportBase({ appVersion, deploymentSha }: { appVersion: string; deploymentSha: string }): Promise<DeviceLabReport> {
  const storageBefore = await readStorageSnapshot();
  const userAgent = navigator.userAgent;
  const lgIndicators = /web0s|webos|netcast|lg browser|lge/i.test(userAgent);

  return {
    appVersion,
    capabilities: detectCapabilities(),
    capturedAt: new Date().toISOString(),
    codecs: await detectCodecs(),
    deploymentSha,
    device: {
      colorDepth: window.screen?.colorDepth ?? null,
      detectedLgWebOsIndicators: lgIndicators,
      devicePixelRatio: window.devicePixelRatio,
      language: navigator.language,
      online: navigator.onLine,
      origin: window.location.origin,
      platform: navigator.platform || "onbekend",
      protocol: window.location.protocol,
      screenHeight: window.screen?.height ?? null,
      screenWidth: window.screen?.width ?? null,
      userAgent,
      visibilityState: document.visibilityState
    },
    errors: [],
    firmware: "",
    lgModel: "",
    manualTests: manualTestDefinitions.map((item) => ({ ...item })),
    playback: [],
    runId: createRunId(),
    storageBefore,
    transitions: []
  };
}

export async function readStorageSnapshot(): Promise<StorageSnapshot> {
  const storage = navigator.storage;
  if (!storage) return {};

  const snapshot: StorageSnapshot = {};
  try {
    if (storage.estimate) {
      const estimate = await storage.estimate();
      snapshot.quotaBytes = estimate.quota;
      snapshot.usageBytes = estimate.usage;
      if (estimate.quota !== undefined && estimate.usage !== undefined) snapshot.availableBytes = estimate.quota - estimate.usage;
    }
    if (storage.persisted) snapshot.persistence = await storage.persisted();
  } catch {
    // Storage probing is diagnostic and must safely degrade.
  }
  return snapshot;
}

export function reportToMarkdown(report: DeviceLabReport) {
  const rows = [
    `# VeyoCast Device Capability Lab — ${report.runId}`,
    "",
    `- Vastgelegd: ${report.capturedAt}`,
    `- Appversie: ${report.appVersion}`,
    `- Deployment SHA: ${report.deploymentSha}`,
    `- LG-model: ${report.lgModel || "niet ingevuld"}`,
    `- Firmware: ${report.firmware || "niet ingevuld"}`,
    `- Platform: ${String(report.device.platform)}`,
    `- User agent: ${String(report.device.userAgent)}`,
    "",
    "## Browser-API’s",
    ...report.capabilities.map((item) => `- **${item.status}** — ${item.label}: ${item.detail}`),
    "",
    "## Codecs (detectie is geen playbackbewijs)",
    ...report.codecs.map((item) => `- **${item.status}** — ${item.label}: canPlayType=${item.canPlayType || "empty"}; ${item.detail}`),
    "",
    "## Werkelijke playback",
    ...(report.playback.length ? report.playback.map((item) => `- **${item.status}** — ${item.label}: ${item.detail}`) : ["- UNTESTED"]),
    "",
    "## Transities",
    ...(report.transitions.length ? report.transitions.map((item) => `- **${item.status}** — ${item.strategy} ${item.from} → ${item.to}: delay ${item.delayMs.toFixed(1)} ms; blank ${item.blankMs.toFixed(1)} ms`) : ["- UNTESTED"]),
    "",
    "## Offline en operations",
    ...report.manualTests.map((item) => `- **${item.status}** — ${item.label}: ${item.detail}`),
    "",
    "## Fouten",
    ...(report.errors.length ? report.errors.map((error) => `- ${error}`) : ["- Geen geregistreerde labfouten"])
  ];
  return rows.join("\n");
}

function detectCapabilities(): CapabilityResult[] {
  const mediaSource = "MediaSource" in window;
  const videoPrototype = HTMLVideoElement.prototype as HTMLVideoElement & { requestVideoFrameCallback?: unknown };
  const connection = "connection" in navigator;
  const capabilities = [
    capability("service-worker", "Service Worker API", "serviceWorker" in navigator),
    capability("cache-storage", "Cache Storage API", "caches" in window),
    capability("indexed-db", "IndexedDB", "indexedDB" in window),
    capability("storage-manager", "StorageManager", "storage" in navigator),
    capability("storage-estimate", "Storage estimate", Boolean(navigator.storage?.estimate)),
    capability("storage-persist", "Storage persist request", Boolean(navigator.storage?.persist)),
    capability("storage-persisted", "Storage persisted status", Boolean(navigator.storage?.persisted)),
    capability("media-source", "MediaSource", mediaSource),
    capability("media-source-types", "MediaSource.isTypeSupported", Boolean(mediaSource && window.MediaSource.isTypeSupported)),
    capability("media-capabilities", "MediaCapabilities", "mediaCapabilities" in navigator),
    capability("fullscreen", "Fullscreen API", "requestFullscreen" in document.documentElement),
    capability("visibility", "Page Visibility API", "visibilityState" in document),
    capability("orientation", "Screen Orientation API", Boolean(window.screen?.orientation)),
    capability("network-information", "Network Information API", connection),
    capability("playback-quality", "getVideoPlaybackQuality", "getVideoPlaybackQuality" in videoPrototype),
    capability("video-frame-callback", "requestVideoFrameCallback", "requestVideoFrameCallback" in videoPrototype),
    capability("web-crypto", "Web Crypto", Boolean(globalThis.crypto?.subtle)),
    capability("broadcast-channel", "BroadcastChannel", "BroadcastChannel" in window),
    capability("websocket", "WebSocket", "WebSocket" in window),
    capability("event-source", "EventSource", "EventSource" in window)
  ];
  return capabilities;
}

async function detectCodecs(): Promise<CodecResult[]> {
  const video = document.createElement("video");
  return Promise.all(codecCandidates.map(async (candidate) => {
    const canPlayType = video.canPlayType(candidate.mime);
    const mediaSource = typeof window.MediaSource?.isTypeSupported === "function" ? window.MediaSource.isTypeSupported(candidate.mime) : undefined;
    let mediaCapabilities: string | undefined;
    if (navigator.mediaCapabilities?.decodingInfo && candidate.mime.startsWith("video/")) {
      try {
        const info = await navigator.mediaCapabilities.decodingInfo({
          type: "file",
          video: { bitrate: 5_000_000, contentType: candidate.mime, framerate: 30, height: 1080, width: 1920 }
        });
        mediaCapabilities = `supported=${info.supported}; smooth=${info.smooth}; powerEfficient=${info.powerEfficient}`;
      } catch {
        mediaCapabilities = "probe failed";
      }
    }
    const status: LabStatus = canPlayType === "probably" ? "WARNING" : canPlayType === "maybe" ? "WARNING" : "UNTESTED";
    return {
      canPlayType,
      detail: canPlayType ? "API-indicatie; echte playbacktest blijft verplicht." : "Browser geeft geen ondersteuning aan.",
      id: candidate.id,
      label: candidate.label,
      mediaCapabilities,
      mediaSource,
      status
    };
  }));
}

function capability(id: string, label: string, available: boolean): CapabilityResult {
  return {
    detail: available ? "API automatisch gedetecteerd; apparaatgedrag is nog niet bewezen." : "API ontbreekt; veilige fallback vereist.",
    id,
    label,
    status: available ? "PASS" : "WARNING"
  };
}

function createRunId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `lab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
