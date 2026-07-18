"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./device-lab.module.css";
import {
  collectDeviceReportBase,
  type DeviceLabReport,
  type LabStatus,
  type PlaybackResult,
  readStorageSnapshot,
  reportToMarkdown,
  type TransitionResult
} from "./device-lab-core";

const testMedia = [
  { id: "jpeg-1080p", kind: "image", label: "JPEG 1920×1080", src: "/device-lab-media/image-1920x1080.jpg", type: "image/jpeg" },
  { id: "png-1080p", kind: "image", label: "PNG 1920×1080", src: "/device-lab-media/image-1920x1080.png", type: "image/png" },
  { id: "png-alpha", kind: "image", label: "Transparante PNG", src: "/device-lab-media/image-transparent.png", type: "image/png" },
  { id: "webp-1080p", kind: "image", label: "WebP 1920×1080", src: "/device-lab-media/image-1920x1080.webp", type: "image/webp" },
  { id: "h264-baseline-720p25", kind: "video", label: "H.264 Baseline/AAC 720p25", src: "/device-lab-media/h264-baseline-720p25-low.mp4", type: "video/mp4" },
  { id: "h264-main-1080p30", kind: "video", label: "H.264 Main/AAC 1080p30", src: "/device-lab-media/h264-main-1080p30-medium.mp4", type: "video/mp4" },
  { id: "h264-high-1080p50", kind: "video", label: "H.264 High/AAC 1080p50", src: "/device-lab-media/h264-high-1080p50-high.mp4", type: "video/mp4" },
  { id: "h264-high-1080p60", kind: "video", label: "H.264 High zonder audio 1080p60", src: "/device-lab-media/h264-high-1080p60-silent.mp4", type: "video/mp4" }
] as const;

type TestMedia = (typeof testMedia)[number];

export function DeviceLabClient({ appVersion, deploymentSha }: { appVersion: string; deploymentSha: string }) {
  const [report, setReport] = useState<DeviceLabReport | null>(null);
  const [busy, setBusy] = useState<string | null>("Apparaat detecteren");
  const [saveMessage, setSaveMessage] = useState("");
  const [lgModel, setLgModel] = useState("");
  const [firmware, setFirmware] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const transitionStageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    collectDeviceReportBase({ appVersion, deploymentSha })
      .then((nextReport) => {
        if (!cancelled) setReport(nextReport);
      })
      .catch((error) => {
        if (!cancelled) setSaveMessage(`Detectie kon niet volledig starten: ${safeMessage(error)}`);
      })
      .finally(() => {
        if (!cancelled) setBusy(null);
      });
    return () => { cancelled = true; };
  }, [appVersion, deploymentSha]);

  async function runPlaybackSuite() {
    const video = videoRef.current;
    if (!video || !report) return;
    setBusy("Werkelijke media afspelen");
    const results: PlaybackResult[] = [];

    for (const media of testMedia) {
      results.push(media.kind === "video" ? await testVideo(video, media) : await testImage(media));
    }

    results.push(await testCorruptAsset());
    setReport({ ...report, playback: results });
    setBusy(null);
  }

  async function runTransitions(strategy: "A_ONE_VIDEO" | "B_TWO_VIDEOS") {
    const stage = transitionStageRef.current;
    if (!stage || !report) return;
    setBusy(strategy === "A_ONE_VIDEO" ? "Transities met één video-element" : "Transities met twee video-elementen");
    const transitions = await measureTransitions(stage, strategy);
    setReport({ ...report, transitions: [...report.transitions.filter((item) => item.strategy !== strategy), ...transitions] });
    setBusy(null);
  }

  async function requestPersistentStorage() {
    if (!report) return;
    let persistence = false;
    try {
      persistence = navigator.storage?.persist ? await navigator.storage.persist() : false;
    } catch (error) {
      setReport({ ...report, errors: [...report.errors, `Storage persist: ${safeMessage(error)}`] });
      return;
    }
    setReport({ ...report, storageAfter: { ...(await readStorageSnapshot()), persistence } });
  }

  function setManualStatus(id: string, status: LabStatus) {
    if (!report) return;
    setReport({
      ...report,
      manualTests: report.manualTests.map((item) => item.id === id ? { ...item, status } : item)
    });
  }

  async function saveRun() {
    if (!report) return;
    setBusy("Testrun opslaan");
    const completedReport = {
      ...report,
      capturedAt: new Date().toISOString(),
      firmware: firmware.trim(),
      lgModel: lgModel.trim(),
      storageAfter: await readStorageSnapshot()
    };
    setReport(completedReport);
    await saveReportLocally(completedReport);

    try {
      const response = await fetch("/api/device-lab/runs", {
        body: JSON.stringify(completedReport),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const body = (await response.json()) as { centrallyStored?: boolean };
      setSaveMessage(body.centrallyStored ? "Testrun lokaal én centraal opgeslagen." : "Testrun lokaal opgeslagen; centrale opslag is niet geconfigureerd.");
    } catch {
      setSaveMessage("Testrun lokaal opgeslagen. Centrale opslag was niet bereikbaar; exporteer het rapport.");
    }
    setBusy(null);
  }

  if (!report) {
    return <main className={styles.shell}><h1>Castivo Device Capability Lab</h1><p>{busy ?? "Diagnose kon niet starten."}</p></main>;
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Afgeschermde supportfunctie · geen LG-certificatie</p>
          <h1>Device Capability Lab</h1>
          <p>Automatische API-detectie, werkelijke mediaplayback en handmatige LG-protocollen blijven afzonderlijk gelabeld.</p>
        </div>
        <StatusBadge status={busy ? "WARNING" : "PASS"}>{busy ?? "Lab gereed"}</StatusBadge>
      </header>

      {saveMessage ? <p className={styles.notice} role="status">{saveMessage}</p> : null}

      <section className={styles.panel} aria-labelledby="run-title">
        <h2 id="run-title">Testrun en apparaat</h2>
        <dl className={styles.facts}>
          <Fact label="Run-ID" value={report.runId} />
          <Fact label="Timestamp" value={report.capturedAt} />
          <Fact label="Appversie" value={report.appVersion} />
          <Fact label="Deployment SHA" value={report.deploymentSha} />
          <Fact label="Origin" value={String(report.device.origin)} />
          <Fact label="Protocol" value={String(report.device.protocol)} />
          <Fact label="User agent" value={String(report.device.userAgent)} />
          <Fact label="Platform" value={String(report.device.platform)} />
          <Fact label="LG/webOS-indicator" value={String(report.device.detectedLgWebOsIndicators)} />
          <Fact label="Scherm" value={`${report.device.screenWidth}×${report.device.screenHeight} @ ${report.device.devicePixelRatio}x`} />
          <Fact label="Taal" value={String(report.device.language)} />
          <Fact label="Online" value={String(report.device.online)} />
          <Fact label="Visibility" value={String(report.device.visibilityState)} />
        </dl>
        <div className={styles.formGrid}>
          <label>LG-model (handmatig)<input value={lgModel} onChange={(event) => setLgModel(event.target.value)} placeholder="Bijvoorbeeld 55UL3J-M" /></label>
          <label>Firmware (handmatig)<input value={firmware} onChange={(event) => setFirmware(event.target.value)} placeholder="Exacte firmwareversie" /></label>
        </div>
        <p className={styles.hint}>Model en firmware kunnen niet betrouwbaar via standaard Web APIs worden gelezen. LG-specifieke waarden vereisen een packaged app/SCAP of handmatige invoer.</p>
      </section>

      <ResultSection title="Browser-API feature detection" description="PASS betekent alleen dat de API op dit apparaat bestaat; niet dat gedrag of persistentie bewezen is." results={report.capabilities} />

      <section className={styles.panel} aria-labelledby="codec-title">
        <h2 id="codec-title">Codecdetectie</h2>
        <p>`maybe` en `probably` blijven indicatief. Alleen de playbacksectie kan PLAYBACK_VERIFIED-bewijs leveren.</p>
        <ResultTable results={report.codecs.map((item) => ({ ...item, detail: `${item.detail} canPlayType=${item.canPlayType || "empty"}; MSE=${String(item.mediaSource)}; MediaCapabilities=${item.mediaCapabilities ?? "niet beschikbaar"}` }))} />
      </section>

      <section className={styles.panel} aria-labelledby="playback-title">
        <h2 id="playback-title">Werkelijke playbacktests</h2>
        <p>Een PASS vereist metadata, resolved muted `play()`, minimaal één seconde tijdvoortgang en een gecontroleerde stop zonder media error.</p>
        <div className={styles.actions}><button disabled={Boolean(busy)} onClick={() => void runPlaybackSuite()}>Start playbacktests</button></div>
        <div className={styles.mediaStage}><video ref={videoRef} muted playsInline preload="auto" /></div>
        {report.playback.length ? <ResultTable results={report.playback} /> : <EmptyState>Playback is nog niet uitgevoerd. Genereer en deploy eerst de testmedia.</EmptyState>}
      </section>

      <section className={styles.panel} aria-labelledby="transition-title">
        <h2 id="transition-title">Playback Transition Lab</h2>
        <p>Strategie A hergebruikt één video-element; strategie B prelaadt afwisselend twee videotags. De labuitkomst wijzigt de productiearchitectuur niet automatisch.</p>
        <div className={styles.actions}>
          <button disabled={Boolean(busy)} onClick={() => void runTransitions("A_ONE_VIDEO")}>Test strategie A</button>
          <button disabled={Boolean(busy)} onClick={() => void runTransitions("B_TWO_VIDEOS")}>Test strategie B</button>
        </div>
        <div className={styles.transitionStage} ref={transitionStageRef} aria-label="Transition teststage" />
        {report.transitions.length ? (
          <div className={styles.tableFrame}><table><thead><tr><th>Strategie</th><th>Overgang</th><th>Status</th><th>Vertraging</th><th>Zonder renderbaar item</th><th>Eerste frame</th><th>Dropped</th></tr></thead><tbody>{report.transitions.map((item, index) => <tr key={`${item.strategy}-${item.from}-${item.to}-${index}`}><td>{item.strategy}</td><td>{item.from} → {item.to}</td><td><StatusBadge status={item.status}>{item.status}</StatusBadge></td><td>{item.delayMs.toFixed(1)} ms</td><td>{item.blankMs.toFixed(1)} ms</td><td>{item.firstFrameMs?.toFixed(1) ?? "n.v.t."} ms</td><td>{item.droppedFrames ?? "n.v.t."}</td></tr>)}</tbody></table></div>
        ) : <EmptyState>Transities zijn nog niet gemeten.</EmptyState>}
      </section>

      <section className={styles.panel} aria-labelledby="storage-title">
        <h2 id="storage-title">Offline en storage lab</h2>
        <dl className={styles.facts}>
          <Fact label="Gebruikt vóór" value={formatBytes(report.storageBefore?.usageBytes)} />
          <Fact label="Quota vóór" value={formatBytes(report.storageBefore?.quotaBytes)} />
          <Fact label="Persistent vóór" value={String(report.storageBefore?.persistence ?? "onbekend")} />
          <Fact label="Persistent na" value={String(report.storageAfter?.persistence ?? "nog niet aangevraagd")} />
        </dl>
        <div className={styles.actions}><button onClick={() => void requestPersistentStorage()}>Vraag persistente opslag aan</button></div>
        <ul className={styles.manualList}>{report.manualTests.map((item) => <li key={item.id}><div><strong>{item.label}</strong><p>{item.detail}</p></div><div className={styles.actions}><StatusBadge status={item.status}>{item.status}</StatusBadge><button onClick={() => setManualStatus(item.id, "PASS")}>PASS</button><button onClick={() => setManualStatus(item.id, "FAIL")}>FAIL</button><button onClick={() => setManualStatus(item.id, "REQUIRES_MANUAL_TEST")}>Handmatig</button></div></li>)}</ul>
      </section>

      <section className={styles.panel} aria-labelledby="export-title">
        <h2 id="export-title">Opslaan en exporteren</h2>
        <p>Het rapport bevat geen device-token, signed media-URL’s of stacktraces. Een lokale IndexedDB-kopie blijft beschikbaar wanneer centrale opslag faalt.</p>
        <div className={styles.actions}>
          <button disabled={Boolean(busy)} onClick={() => void saveRun()}>Testrun opslaan</button>
          <button onClick={() => download(`${report.runId}.json`, JSON.stringify({ ...report, firmware, lgModel }, null, 2), "application/json")}>Exporteer JSON</button>
          <button onClick={() => download(`${report.runId}.md`, reportToMarkdown({ ...report, firmware, lgModel }), "text/markdown")}>Exporteer Markdown</button>
        </div>
      </section>
    </main>
  );
}

function ResultSection({ title, description, results }: { title: string; description: string; results: Array<{ detail: string; id: string; label: string; status: LabStatus }> }) {
  return <section className={styles.panel}><h2>{title}</h2><p>{description}</p><ResultTable results={results} /></section>;
}

function ResultTable({ results }: { results: Array<{ detail: string; id: string; label: string; status: LabStatus }> }) {
  return <div className={styles.tableFrame}><table><thead><tr><th>Capability</th><th>Status</th><th>Bewijs</th></tr></thead><tbody>{results.map((item) => <tr key={item.id}><td>{item.label}</td><td><StatusBadge status={item.status}>{item.status}</StatusBadge></td><td>{item.detail}</td></tr>)}</tbody></table></div>;
}

function StatusBadge({ children, status }: { children: React.ReactNode; status: LabStatus }) {
  return <span className={`${styles.status} ${styles[`status${status.replaceAll("_", "")}`]}`}>{status === "PASS" ? "✓" : status === "FAIL" ? "✕" : "!"} {children}</span>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function EmptyState({ children }: { children: React.ReactNode }) { return <p className={styles.empty} role="status">{children}</p>; }

async function testImage(media: TestMedia): Promise<PlaybackResult> {
  const startedAt = performance.now();
  try {
    const response = await fetch(media.src, { cache: "no-store" });
    if (!response.ok) return ungenerated(media);
    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      const timeout = window.setTimeout(() => reject(new Error("image timeout")), 10_000);
      image.onload = () => { window.clearTimeout(timeout); resolve(); };
      image.onerror = () => { window.clearTimeout(timeout); reject(new Error("image decode error")); };
      image.src = media.src;
    });
    return { detail: `PLAYBACK_VERIFIED op ${navigator.userAgent}; decode in ${(performance.now() - startedAt).toFixed(1)} ms.`, events: ["load"], id: media.id, label: media.label, status: "PASS" };
  } catch (error) {
    return { detail: `Decode mislukt: ${safeMessage(error)}`, events: ["error"], id: media.id, label: media.label, status: "FAIL" };
  }
}

async function testVideo(video: HTMLVideoElement, media: TestMedia): Promise<PlaybackResult> {
  const events: string[] = [];
  const listenedEvents = ["loadedmetadata", "canplay", "playing", "timeupdate", "waiting", "stalled", "ended", "error"] as const;
  const listeners = listenedEvents.map((name) => {
    const listener = () => events.push(`${name}@${video.currentTime.toFixed(3)}`);
    video.addEventListener(name, listener);
    return [name, listener] as const;
  });

  try {
    const availability = await fetch(media.src, { cache: "no-store" });
    if (!availability.ok) return ungenerated(media);
    video.pause();
    video.muted = true;
    video.src = media.src;
    video.load();
    await waitForEvent(video, "loadedmetadata", 12_000);
    await video.play();
    const started = performance.now();
    let maxCurrentTime = 0;
    while (performance.now() - started < 8_000 && maxCurrentTime < 1) {
      await delay(100);
      maxCurrentTime = Math.max(maxCurrentTime, video.currentTime);
      if (video.error) throw new Error(`media error ${video.error.code}`);
    }
    if (maxCurrentTime < 1) throw new Error("geen seconde tijdvoortgang");
    const durationSeconds = video.duration;
    video.pause();
    video.removeAttribute("src");
    video.load();
    return { detail: "PLAYBACK_VERIFIED: metadata, muted autoplay en tijdvoortgang geslaagd; gecontroleerd gestopt.", durationSeconds, events, id: media.id, label: media.label, maxCurrentTime, status: "PASS" };
  } catch (error) {
    return { detail: `Playback niet geverifieerd: ${safeMessage(error)}`, events, id: media.id, label: media.label, status: "FAIL" };
  } finally {
    listeners.forEach(([name, listener]) => video.removeEventListener(name, listener));
  }
}

async function testCorruptAsset(): Promise<PlaybackResult> {
  try {
    const response = await fetch("/device-lab-media/corrupt.mp4", { cache: "no-store" });
    if (!response.ok) return { detail: "Corrupt testbestand ontbreekt; voer het generatiescript uit.", events: [], id: "corrupt-recovery", label: "Corrupt bestand en fallback", status: "UNTESTED" };
    const video = document.createElement("video");
    video.muted = true;
    video.src = "/device-lab-media/corrupt.mp4";
    video.load();
    await waitForEvent(video, "loadedmetadata", 3_000);
    return { detail: "Corrupt bestand werd onverwacht als media gelezen.", events: ["loadedmetadata"], id: "corrupt-recovery", label: "Corrupt bestand en fallback", status: "FAIL" };
  } catch {
    const fallback = await testImage(testMedia[0]);
    return { detail: fallback.status === "PASS" ? "Decodefout gedetecteerd; geldige fallback decodeert correct." : "Decodefout gedetecteerd, maar fallback faalde.", events: ["error", "fallback"], id: "corrupt-recovery", label: "Corrupt bestand en fallback", status: fallback.status };
  }
}

async function measureTransitions(stage: HTMLDivElement, strategy: "A_ONE_VIDEO" | "B_TWO_VIDEOS"): Promise<TransitionResult[]> {
  stage.replaceChildren();
  const sequence: TestMedia[] = [testMedia[0], testMedia[1], testMedia[4], testMedia[3], testMedia[5], testMedia[6], testMedia[0]];
  const results: TransitionResult[] = [];
  let active: HTMLElement | null = null;
  const reusableVideos = [document.createElement("video"), document.createElement("video")];
  let videoSlot = 0;

  for (let index = 0; index < sequence.length; index += 1) {
    const media = sequence[index]!;
    const from = index === 0 ? "start" : sequence[index - 1]!.kind;
    const plannedAt = performance.now();
    try {
      const element = media.kind === "image"
        ? await preloadImageElement(media)
        : await preloadVideoElement(strategy === "A_ONE_VIDEO" ? reusableVideos[0]! : reusableVideos[videoSlot++ % 2]!, media);
      const readyAt = performance.now();
      const videoToVideo = from === "video" && media.kind === "video";
      const blankMs = strategy === "A_ONE_VIDEO" && videoToVideo ? readyAt - plannedAt : 0;
      if (active && active !== element) active.remove();
      if (!element.isConnected) stage.append(element);
      active = element;
      const quality = element instanceof HTMLVideoElement && element.getVideoPlaybackQuality ? element.getVideoPlaybackQuality() : null;
      results.push({ actualAt: readyAt, blankMs, delayMs: readyAt - plannedAt, detail: "Element decodeerde en werd zichtbaar.", droppedFrames: quality?.droppedVideoFrames, firstFrameMs: media.kind === "video" ? readyAt - plannedAt : undefined, from, status: "PASS", strategy, to: media.kind });
      await delay(500);
    } catch (error) {
      results.push({ actualAt: performance.now(), blankMs: performance.now() - plannedAt, delayMs: performance.now() - plannedAt, detail: safeMessage(error), from, status: "FAIL", strategy, to: media.kind });
    }
  }
  reusableVideos.forEach((video) => { video.pause(); video.removeAttribute("src"); video.load(); });
  return results;
}

async function preloadImageElement(media: TestMedia) {
  const image = document.createElement("img");
  image.alt = media.label;
  image.src = media.src;
  await waitForEvent(image, "load", 10_000);
  return image;
}

async function preloadVideoElement(video: HTMLVideoElement, media: TestMedia) {
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = media.src;
  video.load();
  await waitForEvent(video, "canplay", 12_000);
  await video.play();
  await firstVideoFrame(video);
  return video;
}

function firstVideoFrame(video: HTMLVideoElement) {
  const candidate = video as HTMLVideoElement & { requestVideoFrameCallback?: (callback: () => void) => number };
  if (candidate.requestVideoFrameCallback) return new Promise<void>((resolve) => candidate.requestVideoFrameCallback?.(() => resolve()));
  return new Promise<void>((resolve) => {
    const check = () => video.currentTime > 0 ? resolve() : window.setTimeout(check, 50);
    check();
  });
}

function waitForEvent(target: EventTarget, eventName: string, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => { cleanup(); reject(new Error(`${eventName} timeout`)); }, timeoutMs);
    const onEvent = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error(`${eventName} media error`)); };
    const cleanup = () => { window.clearTimeout(timeout); target.removeEventListener(eventName, onEvent); target.removeEventListener("error", onError); };
    target.addEventListener(eventName, onEvent, { once: true });
    if (eventName !== "error") target.addEventListener("error", onError, { once: true });
  });
}

function ungenerated(media: TestMedia): PlaybackResult {
  return { detail: "Testasset ontbreekt. Voer scripts/generate-lg-test-media.sh uit vóór deployment.", events: [], id: media.id, label: media.label, status: "UNTESTED" };
}

async function saveReportLocally(report: DeviceLabReport) {
  if (!("indexedDB" in window)) return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("castivo-device-lab-v1", 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("runs")) request.result.createObjectStore("runs", { keyPath: "runId" }); };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("runs", "readwrite");
      transaction.objectStore("runs").put(report);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(transaction.error); };
    };
  });
}

function download(fileName: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function delay(ms: number) { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
function safeMessage(error: unknown) { return error instanceof Error ? error.message.slice(0, 240) : "onbekende fout"; }
function formatBytes(value: number | undefined) { if (value === undefined) return "niet beschikbaar"; if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`; if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`; return `${Math.round(value / 1024)} KB`; }
