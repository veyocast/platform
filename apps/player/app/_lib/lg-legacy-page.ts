import { createMediaTraffic } from "./media-traffic";
import { createMediaDownloader } from "./media-download";
import { resolveSportListLayout } from "../../../../packages/content-templates/src/sport-list-layout";
import { startBirthdayConfetti } from "../../../../packages/content-templates/src/birthday-confetti";
import { birthdayCalendarDay } from "../../../../packages/content-templates/src/birthday-calendar";
import { sportMatchBelongsOnSlide } from "../../../../packages/content-templates/src/sport-match-phase";
import { legacyGoalOverlayCss, legacyGoalOverlayScript } from "./lg-goal-overlay-runtime";
import { themeBaseFontSizes } from "../../../../packages/content-templates/src/theme-catalog";

import { currentPlayerApplicationVersion } from "./player-app-update";
import themeManifestSource from "../../../../packages/content-templates/src/THEME-MANIFEST.v1.json";
import fontLockSource from "../../../../packages/content-templates/src/fonts/fonts.lock.json";

const legacyFontAssets = themeManifestSource.fontAssets as Record<
  string,
  { family: string }
>;

const legacyThemeCatalog = Object.fromEntries(
  themeManifestSource.themes.map((theme) => [
    theme.id,
    {
      accent: theme.accentDefault,
      bodyFont: legacyFontAssets[theme.bodyFontRef]?.family ?? "Arial",
      decoration: theme.decoration.id,
      density: theme.densityScale,
      displayFont: legacyFontAssets[theme.displayFontRef]?.family ?? "Arial",
      displayLetterSpacingEm: theme.displayLetterSpacingEm,
      displayWeight: theme.displayWeight,
      light: theme.light,
      dark: theme.dark,
      radiusPx: Math.round(theme.radiusCqw * 16),
      support: theme.supportDefault,
      version: theme.version
    }
  ])
);
const legacyFontFamilies = Object.fromEntries(
  Object.entries(legacyFontAssets).map(([ref, asset]) => [ref, asset.family])
);
const lockedFontAssets = fontLockSource.assets as Record<
  string,
  Array<{ file: string; weights: string }>
>;
const legacyAdditionalFontFiles = Array.from(new Set(
  Object.entries(lockedFontAssets)
    .filter(([fontRef]) => fontRef !== "vc-roboto-v1")
    .flatMap(([, assets]) => assets.map((asset) => asset.file))
));
const legacyAdditionalFontPreloads = legacyAdditionalFontFiles
  .map((file) => `<link rel="preload" href="/fonts/theme/${file}" as="font" type="font/woff2" crossorigin>`)
  .join("");
const legacyAdditionalFontFaces = Object.entries(lockedFontAssets)
  .filter(([fontRef]) => fontRef !== "vc-roboto-v1")
  .flatMap(([fontRef, assets]) => assets.map((asset) => {
    const family = legacyFontAssets[fontRef]?.family;
    if (!family) return "";
    return `@font-face{font-family:"${family}";font-style:normal;font-weight:${asset.weights};font-display:block;src:url("/fonts/theme/${asset.file}") format("woff2")}`;
  }))
  .join("");


const legacyConfig = {
  activeReleaseStore: "activeReleases",
  appVersion: currentPlayerApplicationVersion(),
  assetRequestTimeoutMs: 120_000,
  cacheName: "veyocast-player-assets-v1",
  cachePathPrefix: "/__veyocast-player-cache/",
  commandIntervalMs: 10_000,
  databaseName: "veyocast-player-cache-v1",
  databaseVersion: 2,
  deviceTokenKey: "veyocast.player.deviceToken",
  executedCommandsKey: "veyocast.player.executedCommands.v1",
  goalDedupeKey: "veyocast-player-ledscores-dedupe-v1",
  goalDisabledRetryMs: 30_000,
  goalMaximumDedupeEntries: 200,
  goalReconnectMaximumMs: 30_000,
  goalStreamRecycleCharacters: 4_194_304,
  goalStreamSilenceMs: 45_000,
  goalTerminalAckMaximumEntries: 200,
  goalTerminalAckMaximumRetries: 6,
  goalTerminalAckOutboxKey: "veyocast-player-ledscores-terminal-acks-v1",
  goalTerminalAckRetentionMs: 7 * 24 * 60 * 60 * 1000,
  heartbeatIntervalMs: 30_000,
  installationCredentialKey: "veyocast.player.installationCredential",
  installationIdKey: "veyocast.player.instanceId",
  legacyDiagnosticsKey: "veyocast.player.lgLegacyDiagnostics.v1",
  manifestIntervalMs: 8_000,
  pairingCodeKey: "veyocast.player.pairingCode",
  pairingExpiryKey: "veyocast.player.pairingExpiresAt",
  pairingNonceKey: "veyocast.player.pairingRequestNonce",
  previousReleaseStore: "previousReleases",
  previousDeviceTokenKey: "castivo.player.deviceToken",
  requestTimeoutMs: 12_000,
  storageReserveBytes: 16 * 1024 * 1024,
  storageReserveMaximumBytes: 64 * 1024 * 1024,
  themeCatalog: legacyThemeCatalog,
  themeFontSizes: themeBaseFontSizes,
  themeManifestVersion: themeManifestSource.manifestVersion,
  themeFontFamilies: legacyFontFamilies,
  videoProgressTimeoutMs: 10_000,
  videoStartTimeoutMs: 15_000
} as const;

export function renderLgLegacyHtml() {
  const config = JSON.stringify(legacyConfig).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <meta name="color-scheme" content="dark">
  <title>VeyoCast LG Legacy Player</title>
  <link rel="preload" href="/fonts/royal-current/roboto-400.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/royal-current/roboto-500.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/royal-current/roboto-700.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/royal-current/roboto-900.woff2" as="font" type="font/woff2" crossorigin>
  ${legacyAdditionalFontPreloads}
  <style>
    @font-face{font-family:"VeyoCast Royal Current Roboto";font-style:normal;font-weight:400;font-display:block;src:url("/fonts/royal-current/roboto-400.woff2") format("woff2")}
    @font-face{font-family:"VeyoCast Royal Current Roboto";font-style:normal;font-weight:500;font-display:block;src:url("/fonts/royal-current/roboto-500.woff2") format("woff2")}
    @font-face{font-family:"VeyoCast Royal Current Roboto";font-style:normal;font-weight:700;font-display:block;src:url("/fonts/royal-current/roboto-700.woff2") format("woff2")}
    @font-face{font-family:"VeyoCast Royal Current Roboto";font-style:normal;font-weight:900;font-display:block;src:url("/fonts/royal-current/roboto-900.woff2") format("woff2")}
    ${legacyAdditionalFontFaces}
    *{box-sizing:border-box}
    html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#050505;color:#f7f5f0;font-family:Arial,Helvetica,sans-serif}
    body{position:relative}
    #media-root{position:absolute;top:0;right:0;bottom:0;left:0;background:#050505;overflow:hidden}
    #media-root>img,#media-root>video{display:block;width:100%;height:100%;border:0;background:#050505}
    .legacy-media-layer{position:absolute;top:0;right:0;bottom:0;left:0;z-index:1;opacity:0;visibility:hidden;transition:opacity 180ms ease}
    .legacy-media-layer.visible{opacity:1;visibility:visible}
    .legacy-media-layer.retiring{opacity:0;visibility:visible}
    #status{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;padding:5vh 5vw;background:#071c1b}
    #status[hidden]{display:none}
    #default-waiting{position:absolute;top:0;right:0;bottom:0;left:0;display:grid;align-items:center;padding:1vw;background:#e8edf7;color:#14244d;overflow:hidden}
    #default-waiting[hidden]{display:none}
    #default-waiting[data-theme="dark"]{background:#071126;color:#f4f7ff}
    .default-waiting-card{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:0;overflow:hidden;border:1px solid rgba(20,36,77,.12);border-radius:28px;background:rgba(255,255,255,.94);box-shadow:0 18px 60px rgba(20,36,77,.13)}
    #default-waiting[data-theme="dark"] .default-waiting-card{border-color:rgba(255,255,255,.14);background:rgba(18,31,59,.96);box-shadow:0 18px 60px rgba(0,0,0,.25)}
    .default-waiting-card:before,.default-waiting-card:after{position:absolute;top:-24%;left:50%;width:120%;height:145%;border:1px solid rgba(106,142,243,.25);border-radius:50%;content:"";transform:translateX(-50%) rotate(-17deg);pointer-events:none}
    .default-waiting-card:after{inset:0;width:100%;height:100%;border:0;background:radial-gradient(circle at 50% 12%,rgba(143,174,255,.32),transparent 38%);transform:none}
    .default-waiting-clock{position:absolute;z-index:1;top:2vw;right:2.1vw;font-size:clamp(16px,1.55vw,28px);font-weight:800}
    .default-waiting-content{position:relative;z-index:1;display:flex;align-items:center;flex-direction:column;max-width:1200px;min-width:0;text-align:center}
    .default-waiting-tenant{margin:0 0 2vh;color:#65718c;font-size:clamp(12px,1vw,18px);font-weight:800;letter-spacing:.2em;text-transform:uppercase}
    #default-waiting[data-theme="dark"] .default-waiting-tenant,.default-waiting-payoff{color:#aeb9d3}
    .default-waiting-content h1{max-width:18ch;margin:0;font-size:clamp(34px,min(5.2vw,9vh),76px);font-weight:800;letter-spacing:-.055em;line-height:.98}
    .default-waiting-welcome{margin:2vh 0 0;font-size:clamp(18px,1.8vw,30px)}
    .default-waiting-tenant-logo{display:block;width:auto;height:clamp(120px,23vh,260px);max-width:min(46vw,360px);margin:4vh auto 3.5vh;object-fit:contain}
    .default-waiting-veyocast-logo{display:block;width:min(30vw,210px);height:auto;margin:3.5vh auto 0}
    .default-waiting-payoff{margin:1.8vh 0 0;font-size:clamp(15px,1.45vw,25px);font-style:italic}
    .default-waiting-footer{position:absolute;z-index:1;right:2vw;bottom:2vw;left:2vw;display:flex;justify-content:space-between;color:#65718c;font-size:clamp(9px,.62vw,13px);font-weight:800;letter-spacing:.12em;text-transform:uppercase}
    #default-waiting[data-theme="dark"] .default-waiting-footer{color:#aeb9d3}
    .panel{width:min(860px,90vw);padding:clamp(28px,4vw,58px);border:1px solid #47706a;border-radius:24px;background:#0d2927}
    .logo{display:block;width:min(290px,48vw);height:auto;margin:0 0 42px}
    .kicker{margin:0 0 14px;color:#ff5a1f;font-size:clamp(15px,1.5vw,22px);font-weight:700;letter-spacing:.1em;text-transform:uppercase}
    h1{margin:0;font-size:clamp(42px,6vw,82px);line-height:.98;letter-spacing:-.045em}
    #detail{max-width:720px;margin:24px 0 0;color:#d6d3cc;font-size:clamp(18px,2vw,28px);line-height:1.45}
    #pairing{display:none;margin:32px 0 0}
    #pairing.visible{display:block}
    #pairing-code{display:inline-block;padding:18px 26px;border:2px solid #ff5a1f;border-radius:14px;color:#fff;font-size:clamp(42px,7vw,84px);font-weight:800;letter-spacing:.12em}
    #error-code{margin:18px 0 0;color:#ffb28f;font:700 clamp(14px,1.4vw,20px)/1.4 monospace}
    #diagnostics{margin:18px 0 0;color:#aaa69d;font:400 clamp(12px,1.2vw,17px)/1.45 monospace;white-space:pre-wrap}
    #watermark{position:absolute;z-index:90;left:2.2vw;bottom:2.2vh;display:none;width:clamp(100px,9vw,180px);height:auto;opacity:.4;pointer-events:none}
    #watermark.visible{display:block}
    #offline{position:absolute;right:2vw;bottom:2vh;display:none;padding:8px 12px;border-radius:999px;background:rgba(7,7,7,.76);color:#f4c15d;font-size:16px;font-weight:700}
    #offline.visible{display:block}
    #goal-overlay{position:absolute;z-index:70;top:0;right:0;bottom:0;left:0;display:grid;align-items:center;justify-items:center;overflow:hidden;background:#0a0a0a;color:#fafaf7}
    #goal-overlay[hidden]{display:none}
    #goal-overlay[data-palette="electric-orange"]{background:#ff5c20;color:#0a0a0a}
    #goal-overlay[data-palette="signal-red"]{background:#c7322b;color:#fafaf7}
    #goal-overlay[data-palette="white"]{background:#fafaf7;color:#0a0a0a}
    .goal-media,.goal-scrim,.goal-fallback{position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%}
    .goal-media img,.goal-media video{display:block;width:100%;height:100%;object-fit:cover}
    .goal-scrim{--goal-scrim-start:rgba(10,10,10,.88);--goal-scrim-end:rgba(10,10,10,.28);background:linear-gradient(100deg,var(--goal-scrim-start),var(--goal-scrim-end))}
    #goal-overlay[data-palette="electric-orange"] .goal-scrim,#goal-overlay[data-palette="white"] .goal-scrim{--goal-scrim-start:rgba(250,250,247,.88);--goal-scrim-end:rgba(250,250,247,.38)}
    .goal-fallback{overflow:hidden;opacity:.36}
    .goal-fallback span{position:absolute;top:-25%;width:14%;height:150%;background:#ff5c20;transform:rotate(18deg)}
    .goal-fallback span:nth-child(1){left:6%}.goal-fallback span:nth-child(2){left:44%}.goal-fallback span:nth-child(3){right:5%}
    .goal-content{position:relative;z-index:2;display:grid;align-content:center;justify-items:start;width:100%;max-width:82vw;gap:clamp(8px,1.2vw,20px)}
    .goal-content.center{justify-items:center;text-align:center}
    .goal-identity{display:flex;align-items:center;gap:16px;font-size:clamp(14px,1.2vw,24px);font-weight:800;letter-spacing:.12em;text-transform:uppercase}
    .goal-logo{width:clamp(48px,8vw,128px);height:clamp(48px,8vw,128px);object-fit:contain}
    .goal-content.logo-small .goal-logo{width:clamp(36px,5vw,80px);height:clamp(36px,5vw,80px)}
    .goal-content.logo-large .goal-logo{width:clamp(72px,12vw,192px);height:clamp(72px,12vw,192px)}
    .goal-headline{font-size:clamp(48px,10vw,160px);font-weight:900;letter-spacing:-.055em;line-height:.78;text-transform:uppercase}
    .goal-score{display:flex;align-items:center;gap:clamp(16px,3vw,48px);font-size:clamp(80px,14vw,240px);font-weight:900;line-height:.75}
    .goal-score small{font-size:.32em;opacity:.7}
    .goal-previous,.goal-secondary{margin:0;font-size:clamp(16px,2vw,35px)}
    .goal-previous{opacity:.72}
    .goal-metadata{display:flex;flex-wrap:wrap;gap:24px;font-size:clamp(14px,1.4vw,24px);font-weight:700;text-transform:uppercase}
    .goal-sponsor{position:absolute;z-index:3;right:4vw;bottom:4vh;display:flex;align-items:center;gap:16px;padding:12px 16px;border-radius:8px;background:rgba(250,250,247,.92);color:#0a0a0a}
    .goal-sponsor span{font-size:12px;font-weight:700;text-transform:uppercase}.goal-sponsor img{max-width:160px;max-height:56px;object-fit:contain}
    .goal-player{position:absolute;z-index:3;right:5vw;bottom:7vh;display:grid;grid-template-columns:clamp(112px,17vw,288px) minmax(160px,320px);align-items:end;gap:clamp(14px,1.8vw,30px)}
    .goal-player-photo{display:flex;width:clamp(112px,17vw,288px);height:clamp(140px,21.25vw,360px);align-items:center;justify-content:center;overflow:hidden;border:clamp(3px,.35vw,7px) solid currentColor;border-radius:clamp(18px,2vw,34px);background:#1b1b19;font-size:clamp(38px,6vw,96px);font-weight:900}
    .goal-player-photo img{display:block;width:100%;height:100%;object-fit:cover}.goal-player-copy{display:grid;gap:4px;padding-bottom:16px;text-transform:uppercase}.goal-player-copy span{color:#ff5c20;font-size:clamp(38px,5vw,88px);font-weight:900;line-height:.8}.goal-player-copy strong{font-size:clamp(28px,3.6vw,64px);line-height:.92}.goal-player-copy small{font-weight:800;letter-spacing:.12em;opacity:.72}
    .match-overlay-backdrop{position:absolute;top:0;right:0;bottom:0;left:0;background:radial-gradient(circle at 84% 18%,rgba(255,92,32,.32),transparent 34%),linear-gradient(135deg,#080908 0%,#171613 100%)}
    .match-overlay-content{position:relative;z-index:2;width:88vw;display:grid;align-content:center;gap:2vh}.match-overlay-kicker{margin:0;color:#ff5c20;font-size:clamp(18px,1.5vw,30px);font-weight:900;letter-spacing:.14em;text-transform:uppercase}.match-overlay-title{font-size:clamp(68px,9vw,168px);font-weight:900;line-height:.82;text-transform:uppercase}.match-scoreboard{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:3vw}.match-team{display:grid;justify-items:start;gap:1vh}.match-team.away{justify-items:end;text-align:right}.match-team-mark{display:flex;width:clamp(76px,9vw,144px);height:clamp(76px,9vw,144px);align-items:center;justify-content:center;border:2px solid rgba(255,255,255,.28);border-radius:50%;background:#20211e;font-size:clamp(28px,3vw,52px);font-weight:900}.match-team-mark img{width:78%;height:78%;object-fit:contain}.match-team strong{font-size:clamp(24px,2.4vw,46px)}.match-score{font-size:clamp(92px,14vw,240px);font-weight:900;line-height:.75}.match-lineup{position:relative;z-index:2;width:90vw}.match-lineup-header{display:flex;align-items:center;gap:2vw;margin-bottom:4vh}.match-lineup-header h2{margin:0;font-size:clamp(56px,6vw,112px);line-height:.86;text-transform:uppercase}.match-lineup-page{margin-left:auto;padding:10px 14px;border:1px solid rgba(255,255,255,.25);font-weight:900}.match-lineup-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1.2vw}.match-player{display:grid;grid-template-columns:clamp(58px,5.5vw,94px) minmax(0,1fr);align-items:center;gap:1vw;padding:1.1vw;border:1px solid rgba(255,255,255,.18);border-radius:18px;background:rgba(255,255,255,.08)}.match-player-photo{display:flex;width:clamp(58px,5.5vw,94px);height:clamp(58px,5.5vw,94px);align-items:center;justify-content:center;overflow:hidden;border-radius:14px;background:#242520;font-weight:900}.match-player-photo img{width:100%;height:100%;object-fit:cover}.match-player b{display:block;color:#ff5c20;font-size:clamp(21px,2vw,36px)}.match-player strong{display:block;font-size:clamp(17px,1.4vw,27px)}
    .goal-canvas-scene{position:absolute;z-index:1;top:0;left:0;overflow:hidden;background:#0a0a0a;color:#fafaf7;font-family:Arial,Helvetica,sans-serif;transform-origin:0 0}
    .goal-canvas-background,.goal-canvas-background-media,.goal-canvas-background-overlay{position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%}
    .goal-canvas-background-media{display:block;object-fit:cover}.goal-canvas-background-overlay{pointer-events:none}
    .goal-canvas-layer{position:absolute;box-sizing:border-box}.goal-canvas-layer-content{position:absolute;top:0;right:0;bottom:0;left:0;box-sizing:border-box}
    .goal-canvas-text{display:flex;flex-direction:column;overflow:hidden;white-space:pre-wrap;word-break:break-word}
    .goal-canvas-image{display:flex;align-items:center;justify-content:center;overflow:hidden;background:rgba(255,255,255,.08);font-weight:900}
    .goal-canvas-image img{position:absolute;top:0;right:0;bottom:0;left:0;display:block;width:100%;height:100%}.goal-canvas-image span{position:relative;z-index:0}
    .goal-canvas-lineup{display:grid;overflow:hidden}.goal-canvas-lineup-card{display:grid;min-width:0;min-height:0;align-items:center;overflow:hidden}.goal-canvas-lineup-photo{position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;background:rgba(255,255,255,.1);font-weight:900}.goal-canvas-lineup-photo img{position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;object-fit:cover}.goal-canvas-lineup-copy{min-width:0;overflow:hidden}.goal-canvas-lineup-copy b,.goal-canvas-lineup-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.goal-canvas-lineup-page{position:absolute;z-index:3;right:12px;bottom:12px;padding:7px 10px;border-radius:999px;background:rgba(10,10,10,.82);color:#fafaf7;font-size:20px;font-weight:900}
    .goal-canvas-animation-fade{animation:legacy-canvas-fade 420ms ease-out both}.goal-canvas-animation-rise{animation:legacy-canvas-rise 520ms cubic-bezier(.2,.8,.2,1) both}.goal-canvas-animation-zoom{animation:legacy-canvas-zoom 480ms cubic-bezier(.2,.8,.2,1) both}.goal-canvas-animation-wipe{animation:legacy-canvas-wipe 560ms ease-out both}
    @keyframes legacy-canvas-fade{from{opacity:0}to{opacity:1}}@keyframes legacy-canvas-rise{from{opacity:0;transform:translateY(42px)}to{opacity:1;transform:translateY(0)}}@keyframes legacy-canvas-zoom{from{opacity:0;transform:scale(.86)}to{opacity:1;transform:scale(1)}}@keyframes legacy-canvas-wipe{from{opacity:0;clip-path:inset(0 100% 0 0)}to{opacity:1;clip-path:inset(0 0 0 0)}}
    .match-scoreboard[data-show-score="false"]{grid-template-columns:repeat(2,minmax(0,1fr))}.match-lineup-lead{margin:1vh 0 0;font-size:clamp(16px,1.4vw,28px);opacity:.72}.match-lineup-score,.match-lineup-clock{padding:10px 14px;border:1px solid rgba(255,255,255,.25);font-size:clamp(20px,2vw,38px);font-weight:900}.match-lineup-page{margin-left:0}.match-lineup-team-only{display:grid;align-content:center;justify-items:center;gap:2vh;height:60vh;text-align:center}.match-lineup-team-only .match-team-mark{width:clamp(160px,22vw,340px);height:clamp(160px,22vw,340px)}.match-lineup-team-only>strong{font-size:clamp(42px,6vw,110px)}#goal-overlay[data-logo-position="center"] .match-overlay-content{justify-items:center;text-align:center}#goal-overlay[data-logo-position="center"] .match-lineup-header{justify-content:center;text-align:center}#goal-overlay[data-logo-position="center"] .match-lineup-page{position:absolute;right:0}#goal-overlay[data-logo-scale="small"] .match-team-mark{width:clamp(54px,6vw,98px);height:clamp(54px,6vw,98px)}#goal-overlay[data-logo-scale="large"] .match-team-mark{width:clamp(104px,12vw,196px);height:clamp(104px,12vw,196px)}#goal-overlay[data-typography="display"] .match-overlay-title,#goal-overlay[data-typography="display"] .match-lineup-header h2,#goal-overlay[data-typography="display"] .goal-headline{font-family:Arial Black,Arial,Helvetica,sans-serif}#goal-overlay[data-typography="body"] .match-overlay-title,#goal-overlay[data-typography="body"] .match-lineup-header h2,#goal-overlay[data-typography="body"] .goal-headline{font-family:Arial,Helvetica,sans-serif;letter-spacing:-.025em}
    #goal-overlay[data-animation="impact"] .goal-content{animation:legacy-goal-impact 520ms cubic-bezier(.2,.9,.2,1) both}
    #goal-overlay[data-animation="pulse"] .goal-score{animation:legacy-goal-pulse 800ms ease-in-out 2}
    #goal-overlay[data-animation="slide"] .goal-content{animation:legacy-goal-slide 550ms cubic-bezier(.2,.8,.2,1) both}
    @keyframes legacy-goal-impact{from{opacity:0;transform:scale(.72)}70%{opacity:1;transform:scale(1.05)}to{transform:scale(1)}}
    @keyframes legacy-goal-pulse{50%{transform:scale(1.08)}}
    @keyframes legacy-goal-slide{from{opacity:0;transform:translateX(-12vw)}to{opacity:1;transform:translateX(0)}}
    @media(orientation:portrait){.goal-content{align-content:start;max-width:84vw;padding-top:10vh}.goal-headline{font-size:clamp(56px,15vw,144px);line-height:.84}.goal-score{font-size:clamp(96px,24vw,208px)}.goal-scrim{background:linear-gradient(180deg,var(--goal-scrim-start),var(--goal-scrim-end))}.goal-player{right:8vw;bottom:7vh;left:8vw;grid-template-columns:minmax(128px,40vw) 1fr}.match-overlay-content{width:84vw}.match-scoreboard{grid-template-columns:1fr 1fr}.match-score{grid-column:1/-1;grid-row:1;text-align:center}.match-team{grid-row:2}.match-lineup-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:1.4vh}.match-lineup-header{margin-bottom:3vh}}
    @media(prefers-reduced-motion:reduce){#goal-overlay *{animation:none!important}}
    .dynamic-template{--accent:#ff5c20;position:absolute;top:0;right:0;bottom:0;left:0;display:grid;grid-template-rows:auto 1fr auto;overflow:hidden;padding:5vh 5vw 4vh;background:#f4efe6;color:#11110f;font-family:Arial,Helvetica,sans-serif}
    .dynamic-template.dark{background:#080908;color:#fffdf7}
    .ledscores-live-match{--live-accent:#ff5c20;background:#080908;color:#fffdf7}.ledscores-live-match .live-match-shell{position:absolute;top:0;right:0;bottom:0;left:0;display:grid;grid-template-rows:auto 1fr auto;padding:6vh 5vw 4vh;background:radial-gradient(circle at 12% 12%,rgba(255,92,32,.28),transparent 32%),linear-gradient(145deg,#080908,#151511)}.ledscores-live-match[data-accent="club"] .live-match-shell{box-shadow:inset 0 10px var(--live-accent)}.ledscores-live-match[data-accent="contrast"] .live-match-shell{box-shadow:inset 0 0 0 10px var(--live-accent)}.ledscores-live-match[data-accent="neutral"]{--live-accent:#c8c6bf}.ledscores-live-match[data-accent="neutral"] .live-match-shell{background:#242522}.live-match-top,.live-match-footer{display:flex;align-items:center;justify-content:space-between}.live-match-top p{margin:0;color:var(--live-accent);font-size:clamp(16px,1.4vw,28px);font-weight:900;letter-spacing:.13em;text-transform:uppercase}.live-match-top h1{margin:.6vh 0 0;font-size:clamp(44px,5vw,90px)}.live-match-status{padding:10px 16px;border:1px solid rgba(255,255,255,.2);border-radius:999px;font-weight:800}.live-match-body{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);align-items:center;gap:4vw}.live-match-body.no-timeline{grid-template-columns:1fr}.live-match-body .match-scoreboard{padding:4vh 3vw;border:1px solid rgba(255,255,255,.14);border-radius:28px;background:rgba(255,255,255,.055)}.live-match-clock{text-align:center;color:var(--live-accent);font-size:clamp(48px,6vw,110px);font-weight:900}.live-match-period{text-align:center;font-size:clamp(18px,1.5vw,28px);font-weight:800}.live-match-timeline{margin:0;padding:2vh 1vw;list-style:none;border-left:1px solid rgba(255,255,255,.18)}.live-match-timeline li{display:grid;grid-template-columns:4.5em minmax(0,1fr) auto;gap:1vw;padding:1.2vh 1vw;border-bottom:1px solid rgba(255,255,255,.1)}.live-match-timeline time{color:var(--live-accent);font-weight:900}.live-match-timeline strong{font-size:clamp(17px,1.25vw,24px)}.live-match-footer{border-top:1px solid rgba(255,255,255,.15);padding-top:2vh;font-weight:800}.ledscores-live-match.portrait .live-match-body{grid-template-columns:1fr;align-content:center}.ledscores-live-match.portrait .live-match-timeline{border-left:0;border-top:1px solid rgba(255,255,255,.18)}
    .dynamic-template header{border-bottom:2px solid rgba(98,95,87,.3);padding:1.8vh 0 2.8vh}
    .dynamic-template header p,.dynamic-news-meta{margin:0 0 1vh;color:var(--accent);font-size:var(--vc-theme-font-27-84,27.84px);font-weight:800;letter-spacing:.14em;text-transform:uppercase}
    .dynamic-template h1{margin:0;max-width:90%;font-size:var(--vc-theme-font-96,96px);line-height:.94;letter-spacing:-.045em}
    .dynamic-body{align-self:stretch;display:grid;align-content:center;min-height:0;padding:2.5vh 0}
    .dynamic-menu-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.2vh 2.2vw}
    .dynamic-menu-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2vw;min-height:10vh;padding:1.5vh 1.5vw;border-left:8px solid var(--accent);background:#fffdf7}
    .dark .dynamic-menu-item{background:#141512}
    .dynamic-menu-item small{display:block;margin:0 0 .4vh;color:var(--accent);font-size:var(--vc-theme-font-19-2,19.2px);font-weight:800;letter-spacing:.08em;text-transform:uppercase}
    .dynamic-menu-item h2{margin:0;font-size:var(--vc-theme-font-42-24,42.24px);line-height:1.05}
    .dynamic-menu-item p{margin:.7vh 0 0;color:#625f57;font-size:var(--vc-theme-font-20-16,20.16px);line-height:1.3}
    .dark .dynamic-menu-item p{color:#c9c4b9}
    .dynamic-menu-item strong{color:var(--accent);font-size:var(--vc-theme-font-48,48px);white-space:nowrap}
    .dynamic-news{max-width:84%;padding:4vh 0}
    .dynamic-news h2{margin:1.8vh 0 2.6vh;font-size:var(--vc-theme-font-138,138px);line-height:.92;letter-spacing:-.055em}
    .dynamic-news p:last-child{margin:0;max-width:80%;color:#625f57;font-size:var(--vc-theme-font-45-12,45.12px);line-height:1.35}
    .dark .dynamic-news p:last-child{color:#c9c4b9}
    .dynamic-match{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:3vw;padding:4vh 1vw;text-align:center}
    .dynamic-team{display:grid;justify-items:center;gap:2vh;min-width:0}
    .dynamic-team-mark{display:flex;align-items:center;justify-content:center;width:min(25vw,32vh);height:min(25vw,32vh);border:9px solid var(--accent);background:#fffdf7;color:#11110f;font-size:var(--vc-theme-font-126,126px);font-weight:900}
    .dark .dynamic-team-mark{background:#141512;color:#fffdf7}
    .dynamic-team-mark img{display:block;width:82%;height:82%;object-fit:contain}
    .dynamic-team h2{margin:0;font-size:var(--vc-theme-font-67-2,67.2px);line-height:1}
    .dynamic-match-meta{display:grid;justify-items:center;gap:1.3vh;min-width:18vw}
    .dynamic-match-meta small{color:var(--accent);font-size:var(--vc-theme-font-23-04,23.04px);font-weight:900;letter-spacing:.1em;text-transform:uppercase}
    .dynamic-match-meta strong{font-size:var(--vc-theme-font-76,76px)}
    .dynamic-match-meta p{margin:0;color:#625f57;font-size:var(--vc-theme-font-28-8,28.8px)}
    .dark .dynamic-match-meta p{color:#c9c4b9}
    .dynamic-list{display:grid}
    .dynamic-list[data-columns="two"]{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:2vw}
    .dynamic-row{display:grid;grid-template-columns:50px minmax(0,1fr) minmax(130px,1.15fr);align-items:center;gap:1.4vw;min-height:8.5vh;padding:1vh 1vw;border-top:1px solid rgba(98,95,87,.3)}
    .dynamic-row>span{color:var(--accent);font-size:var(--vc-theme-font-30-72,30.72px);font-weight:900}
    .dynamic-row h2{margin:0;font-size:var(--vc-theme-font-38-4,38.4px);line-height:1.05}
    .dynamic-row p{margin:.4vh 0 0;color:#625f57;font-size:var(--vc-theme-font-21-12,21.12px)}
    .dark .dynamic-row p{color:#c9c4b9}
    .dynamic-row strong{justify-self:end;font-size:var(--vc-theme-font-26-88,26.88px);text-align:right}
    .legacy-typed-list{display:grid;box-sizing:border-box;height:100%;padding:2.8%;overflow:hidden;border:1px solid var(--editorial-border);border-radius:24px;background:var(--editorial-surface);box-shadow:0 24px 80px var(--editorial-shadow)}
    .legacy-fixture-list,.legacy-result-list{display:grid;grid-auto-rows:var(--sport-list-row-height,115px);align-content:start;box-sizing:border-box;height:100%;gap:12px;overflow:hidden}
    .legacy-fixture-list[data-columns="two"],.legacy-result-list[data-columns="two"]{grid-auto-flow:column;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:18px}
    .legacy-fixture-row,.legacy-result-row{display:grid;align-content:center;box-sizing:border-box;height:var(--sport-list-row-height,115px);min-width:0;min-height:var(--sport-list-row-height,115px);padding:12px 22px;overflow:hidden;border:1px solid var(--vc-border);border-radius:18px;background:var(--vc-row);box-shadow:0 12px 36px var(--vc-shadow);color:var(--vc-text);font-size:var(--vc-sport-row-size,22.4px);animation:legacy-match-row-in 420ms cubic-bezier(.2,.8,.2,1) var(--match-row-delay,360ms) both}
    .legacy-fixture-row{grid-template-rows:minmax(0,1fr) auto;gap:8px}
    .legacy-result-row{grid-template-rows:minmax(0,1fr);font-size:var(--vc-sport-result-size,33.6px)}
    .legacy-fixture-list[data-columns="two"] .legacy-fixture-row,.legacy-result-list[data-columns="two"] .legacy-result-row{padding:10px 14px}
    .legacy-result-list[data-columns="two"] .legacy-result-row{font-size:var(--vc-theme-sport-result-size-compact,24px)}
    .legacy-program-primary,.legacy-result-primary{display:grid;align-items:center;width:100%;min-width:0;column-gap:12px;line-height:1}
    .legacy-program-primary{grid-template-columns:var(--legacy-program-columns)}
    .legacy-result-primary{grid-template-columns:var(--legacy-result-columns)}
    .legacy-fixture-list[data-columns="two"] .legacy-program-primary,.legacy-result-list[data-columns="two"] .legacy-result-primary{column-gap:8px}
    .legacy-match-date,.legacy-match-time,.legacy-match-team,.legacy-match-room{display:block;min-width:0;overflow:hidden;text-align:left;text-overflow:ellipsis;white-space:nowrap}
    .legacy-match-date{color:var(--vc-text);font-variant-numeric:tabular-nums}.legacy-match-time{color:var(--vc-accent);font-variant-numeric:tabular-nums}
    .legacy-match-team{color:var(--vc-text);font-weight:780}.legacy-match-room{color:var(--vc-text-muted);font-size:.72em;font-weight:700}
    .legacy-match-logo{display:grid;min-width:0;place-items:center}.legacy-match-logo .legacy-team-mini{border-color:var(--vc-border);border-radius:12px;color:var(--vc-accent)}
    .legacy-fixture-row .legacy-match-logo .legacy-team-mini{width:48px;height:48px}.legacy-result-row .legacy-match-logo .legacy-team-mini{width:57px;height:57px}
    .legacy-match-home-logo .legacy-team-mini{background:var(--vc-home-logo-background)}.legacy-match-away-logo .legacy-team-mini{background:var(--vc-panel)}
    .legacy-fixture-list[data-columns="two"] .legacy-fixture-row .legacy-match-logo .legacy-team-mini{width:42px;height:42px}
    .legacy-result-list[data-columns="two"] .legacy-result-row .legacy-match-logo .legacy-team-mini{width:48px;height:48px}
    .legacy-match-separator{color:var(--vc-text-muted);font-size:.72em;font-style:normal;font-weight:800;text-align:center;white-space:nowrap}
    .legacy-program-secondary{display:flex;align-items:center;justify-content:flex-end;min-width:0;overflow:hidden;color:var(--vc-text-muted);font-size:.52em;line-height:1;text-align:right;white-space:nowrap}
    .legacy-program-secondary span{min-width:0;overflow:hidden;text-overflow:ellipsis}.legacy-program-secondary span+span{margin-left:12px}.legacy-program-secondary span+span::before{margin-right:12px;color:var(--vc-text-faint);content:"|"}.legacy-program-secondary b{color:var(--vc-text)}
    .legacy-fixture-list[data-columns="two"] .legacy-program-secondary span+span{margin-left:8px}.legacy-fixture-list[data-columns="two"] .legacy-program-secondary span+span::before{margin-right:8px}
    .legacy-result-score{display:flex;min-width:112px;min-height:1em;align-items:center;justify-content:center;justify-self:stretch;color:var(--vc-accent);font-size:var(--vc-sport-score-size,52.08px);font-style:normal;font-weight:900;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap}.legacy-result-score>*+*{margin-left:10px}.legacy-result-score span{color:var(--vc-text-muted);font-size:.64em}
    .legacy-result-list[data-columns="two"] .legacy-result-score{min-width:88px;font-size:var(--vc-theme-sport-score-size-compact,42px)}
    .legacy-team-mini{display:inline-grid;flex:0 0 auto;width:38px;height:38px;place-items:center;overflow:hidden;border:1px solid var(--editorial-border);border-radius:50%;background:var(--editorial-surface-alt);color:var(--accent);font-size:var(--vc-theme-font-11,11px);font-style:normal;font-weight:900}
    .legacy-team-mini img{width:80%;height:80%;object-fit:contain}
    .legacy-typed-row{display:grid;align-items:center;gap:14px;box-sizing:border-box;min-height:12.5%;border-bottom:1px solid var(--editorial-border-soft)}
    @keyframes legacy-match-row-in{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
    @media(prefers-reduced-motion:reduce){.legacy-fixture-row,.legacy-result-row{animation:none;opacity:1;transform:none}}
    .legacy-typed-row{grid-template-columns:130px minmax(0,1fr) auto;padding:0 8px}
    .legacy-typed-row>time{font-size:var(--vc-theme-font-20,20px);font-weight:800}
    .legacy-typed-row h2{margin:0 0 4px;font-size:var(--vc-theme-font-23,23px)}
    .legacy-typed-row p{margin:0;color:var(--editorial-muted);font-size:var(--vc-theme-font-17,17px)}
    .legacy-typed-row>strong{max-width:320px;font-size:var(--vc-theme-font-18,18px);text-align:right}
    .legacy-typed-row[data-kind="cancellation"]>strong{padding:8px 12px;border-radius:999px;background:var(--editorial-danger);color:#fff}
    .legacy-typed-row[data-kind="dressing"]>strong{color:var(--accent)}
    .legacy-typed-row[data-kind="official"]{grid-template-columns:130px minmax(0,1fr) minmax(260px,.7fr)}
    .legacy-team-roster{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:minmax(0,1fr);gap:18px;height:100%;min-height:0;overflow:hidden}
    .legacy-team-card{display:grid;grid-template-rows:minmax(0,1fr) auto;box-sizing:border-box;min-height:0;padding:18px;overflow:hidden;border:1px solid var(--editorial-border);border-radius:24px;background:var(--editorial-surface);box-shadow:0 18px 58px var(--editorial-shadow)}
    .legacy-team-photo{display:grid;min-height:0;overflow:hidden;place-items:center;border-radius:18px;background:var(--editorial-surface-alt)}
    .legacy-team-photo img{width:100%;height:100%;object-fit:cover}
    .legacy-team-photo span{color:var(--accent);font-size:var(--vc-theme-font-72,72px);font-weight:900}
    .legacy-team-copy{padding:18px 4px 4px}
    .legacy-team-copy i,.legacy-sponsor-copy i,.legacy-training-row i,.legacy-volunteer-card i,.legacy-volunteer-callout i{color:var(--accent);font-size:var(--vc-theme-font-14,14px);font-style:normal;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
    .legacy-team-copy h2,.legacy-sponsor-copy h2,.legacy-training-row h2,.legacy-volunteer-card h2{margin:8px 0 4px;font-size:var(--vc-theme-font-30,30px);line-height:1.04}
    .legacy-team-copy p,.legacy-sponsor-copy p,.legacy-training-row p,.legacy-volunteer-card p{margin:0;color:var(--editorial-muted);font-size:var(--vc-theme-font-19,19px);line-height:1.25}
    .legacy-team-copy strong,.legacy-sponsor-copy strong,.legacy-volunteer-card strong{display:block;margin-top:10px;font-size:var(--vc-theme-font-16,16px)}
    .legacy-sponsor-layout{display:grid;gap:18px;height:100%}
    .legacy-sponsor-layout:not([data-items="1"]){grid-template-columns:repeat(2,minmax(0,1fr))}
    .legacy-sponsor-card{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);align-items:center;gap:48px;box-sizing:border-box;padding:54px;overflow:hidden;border:1px solid var(--editorial-border);border-radius:24px;background:var(--editorial-surface);box-shadow:0 18px 58px var(--editorial-shadow)}
    .legacy-sponsor-layout:not([data-items="1"]) .legacy-sponsor-card{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto;gap:26px;padding:32px}
    .legacy-sponsor-plate{display:grid;box-sizing:border-box;width:100%;height:100%;min-height:260px;padding:42px;place-items:center;border:1px solid var(--editorial-border-soft);border-radius:18px;background:#f8f6f0}
    .legacy-sponsor-plate img{width:100%;height:100%;object-fit:contain}
    .legacy-sponsor-plate span{color:#111315;font-size:var(--vc-theme-font-96,96px);font-weight:900}
    .legacy-sponsor-copy h2{font-size:var(--vc-theme-font-58,58px)}
    .legacy-training-schedule{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-content:stretch;gap:14px;height:100%}
    .legacy-training-row{display:grid;grid-template-columns:58px minmax(0,1fr) auto;align-items:center;gap:22px;box-sizing:border-box;padding:24px;border:1px solid var(--editorial-border);border-radius:24px;background:var(--editorial-surface);box-shadow:0 18px 58px var(--editorial-shadow)}
    .legacy-training-row>b{color:var(--accent);font-size:var(--vc-theme-font-30,30px)}
    .legacy-training-row>strong{max-width:190px;font-size:var(--vc-theme-font-22,22px);text-align:right}
    .legacy-volunteer-layout{display:grid;grid-template-columns:.7fr 1.3fr;gap:18px;height:100%}
    .legacy-volunteer-callout{display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;padding:38px;border:1px solid var(--editorial-border);border-radius:24px;background:var(--editorial-surface);box-shadow:0 18px 58px var(--editorial-shadow);text-align:center}
    .legacy-volunteer-callout strong{margin:24px 0;color:var(--accent);font-size:var(--vc-theme-font-150,150px);line-height:.8}
    .legacy-volunteer-callout p{max-width:80%;margin:0;color:var(--editorial-muted);font-size:var(--vc-theme-font-24,24px)}
    .legacy-volunteer-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .legacy-volunteer-card{box-sizing:border-box;padding:28px;border:1px solid var(--editorial-border);border-radius:24px;background:var(--editorial-surface);box-shadow:0 18px 58px var(--editorial-shadow)}
    .legacy-arrival-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:18px;height:100%}
    .legacy-arrival-grid[data-cards="1"]{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr)}
    .legacy-arrival-grid[data-cards="2"]{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:minmax(0,1fr)}
    .legacy-arrival-grid[data-cards="3"]{grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:minmax(0,1fr)}
    .legacy-arrival-card{position:relative;display:flex;flex-direction:column;justify-content:flex-start;box-sizing:border-box;min-height:0;padding:38px;overflow:hidden;border:1px solid var(--editorial-border);border-radius:24px;background:var(--editorial-surface);box-shadow:0 18px 58px var(--editorial-shadow);animation-delay:var(--arrival-delay,0ms);animation-duration:1400ms;animation-fill-mode:both;animation-timing-function:cubic-bezier(.16,1,.3,1);will-change:filter,opacity,transform}
    .legacy-arrival-logo-backdrop{position:absolute;z-index:0;top:50%;right:-34%;width:150%;height:150%;object-fit:contain;object-position:center;opacity:.3;transform:translateY(-50%);pointer-events:none}
    .legacy-arrival-logo-mark{position:absolute;z-index:2;top:22px;right:24px;display:grid;width:92px;height:92px;place-items:center;border:1px solid var(--editorial-border);border-radius:20px;background:var(--editorial-surface);box-shadow:0 12px 34px var(--editorial-shadow)}
    .legacy-arrival-logo-mark img{width:78%;height:78%;object-fit:contain}
    .legacy-arrival-card>i,.legacy-arrival-card>b,.legacy-arrival-card>h2,.legacy-arrival-card>p,.legacy-arrival-card>strong{position:relative;z-index:1}
    .legacy-arrival-card>i{color:var(--accent);font-size:var(--vc-theme-font-18,18px);font-style:normal;font-weight:800;letter-spacing:.13em;text-transform:uppercase}
    .legacy-arrival-card>b{position:absolute;top:26px;right:30px;color:#8c929a;font-size:var(--vc-theme-font-28,28px)}
    .legacy-arrival-card h2{max-width:86%;margin:38px 0 14px;color:var(--editorial-text);font-size:var(--vc-theme-font-52,52px);line-height:.98}
    .legacy-arrival-card p{margin:0 0 18px;color:#9aa2ac;font-size:var(--vc-theme-font-25,25px)}
    .legacy-arrival-card strong{margin-top:auto;padding-top:20px;border-top:1px solid var(--editorial-border-soft);color:var(--editorial-text);font-size:var(--vc-theme-font-23,23px)}
    .legacy-arrival-sponsor{position:absolute;z-index:2;right:28px;bottom:24px;box-sizing:border-box;width:156px;height:64px;padding:8px;border:1px solid var(--editorial-border);border-radius:12px;background:#fff;object-fit:contain}
    .legacy-arrival-card[data-sponsor="visible"]>strong{margin-right:178px}
    .legacy-arrival-grid[data-cards="1"] .legacy-arrival-card{padding:64px}
    .legacy-arrival-grid[data-cards="1"] .legacy-arrival-card h2{max-width:74%;margin-top:64px;font-size:var(--vc-theme-font-84,84px)}
    .legacy-arrival-grid[data-cards="1"] .legacy-arrival-logo-mark{top:42px;right:46px;width:154px;height:154px;border-radius:30px}
    .legacy-arrival-grid[data-cards="2"] .legacy-arrival-card{padding:48px}
    .legacy-arrival-grid[data-cards="2"] .legacy-arrival-card h2{max-width:72%;margin-top:54px;font-size:var(--vc-theme-font-64,64px)}
    .legacy-arrival-grid[data-cards="3"] .legacy-arrival-card{padding:32px}
    .legacy-arrival-grid[data-cards="3"] .legacy-arrival-card h2{max-width:70%;margin-top:44px;font-size:var(--vc-theme-font-46,46px)}
    .legacy-arrival-grid[data-cards="3"] .legacy-arrival-logo-mark{width:78px;height:78px;border-radius:18px}
    .legacy-arrival-card[data-motion="aurora-rise"]{animation-name:legacy-arrival-aurora}
    .legacy-arrival-card[data-motion="spotlight-bloom"]{animation-name:legacy-arrival-spotlight}
    .legacy-arrival-card[data-motion="kinetic-split"]{animation-name:legacy-arrival-kinetic;transform-origin:left center}
    .legacy-arrival-card[data-motion="prism-swipe"]{animation-name:legacy-arrival-prism}
    .legacy-arrival-card[data-motion="grand-flip"]{animation-name:legacy-arrival-flip;backface-visibility:hidden;transform-origin:left center}
    .editorial-arena.portrait .legacy-arrival-grid{grid-template-columns:1fr;grid-template-rows:repeat(4,minmax(0,1fr));gap:14px}
    .editorial-arena.portrait .legacy-arrival-grid[data-cards="1"]{grid-template-rows:minmax(0,1fr)}
    .editorial-arena.portrait .legacy-arrival-grid[data-cards="2"]{grid-template-columns:minmax(0,1fr);grid-template-rows:repeat(2,minmax(0,1fr))}
    .editorial-arena.portrait .legacy-arrival-grid[data-cards="3"]{grid-template-columns:minmax(0,1fr);grid-template-rows:repeat(3,minmax(0,1fr))}
    .editorial-arena.portrait .legacy-arrival-grid[data-cards="4"]{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr))}
    .editorial-arena.portrait .legacy-arrival-card{padding:30px 34px}
    .editorial-arena.portrait .legacy-arrival-card h2{margin-top:24px;font-size:var(--vc-theme-font-46,46px)}
    .legacy-arrival-grid[data-arrival-kind="visitor"],.legacy-arrival-grid[data-arrival-kind="visitor"][data-cards="1"]{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:minmax(0,1fr)}
    .legacy-arrival-card[data-arrival-kind="visitor"]{justify-content:center;padding:48px;animation-duration:900ms;will-change:opacity,transform}
    .legacy-arrival-card[data-arrival-kind="visitor"]:before{position:absolute;z-index:1;top:0;right:0;bottom:0;left:0;background:linear-gradient(90deg,var(--editorial-surface) 0,var(--editorial-surface) 48%,transparent 78%);opacity:.9;pointer-events:none;content:""}
    .legacy-arrival-card[data-arrival-kind="visitor"] .legacy-arrival-logo-backdrop{top:0;right:0;bottom:0;left:0;width:100%;height:100%;object-fit:cover;object-position:center;opacity:.3;transform:none}
    .legacy-arrival-card[data-arrival-kind="visitor"] .legacy-arrival-logo-mark{top:0;right:0;width:32%;height:100%;border:0;border-left:1px solid var(--editorial-border);border-radius:0;background:white;box-shadow:-18px 0 48px var(--editorial-shadow)}
    .legacy-arrival-card[data-arrival-kind="visitor"] .legacy-arrival-logo-mark img{width:84%;height:84%;object-fit:contain}
    .legacy-visitor-arrival-copy{position:relative;z-index:2;display:flex;width:64%;height:100%;flex-direction:column}
    .legacy-arrival-card[data-arrival-kind="visitor"][data-logo="missing"] .legacy-visitor-arrival-copy{width:100%}
    .legacy-visitor-schedule{display:flex;flex-direction:column}.legacy-visitor-schedule>*+*{margin-top:7px}.legacy-arrival-card[data-arrival-kind="visitor"] .legacy-visitor-schedule time,.legacy-arrival-card[data-arrival-kind="visitor"] .legacy-visitor-schedule span{color:var(--editorial-muted);font-size:var(--vc-theme-font-46,46px);font-weight:650;line-height:1.15}
    .legacy-visitor-teams{display:flex;min-width:0;flex-direction:column;margin:24px 0}.legacy-arrival-card[data-arrival-kind="visitor"] .legacy-visitor-teams h2{display:flex;max-width:none;margin:0;flex-direction:column}.legacy-arrival-card[data-arrival-kind="visitor"] .legacy-visitor-teams h2 span{overflow-wrap:break-word;word-break:break-word;color:var(--editorial-text);font-size:var(--vc-theme-font-46,46px);font-weight:800;letter-spacing:-.035em;line-height:.98}.legacy-arrival-card[data-arrival-kind="visitor"] .legacy-visitor-teams h2 span+span{margin-top:12px}
    .legacy-visitor-details{display:grid;margin-top:auto;margin-bottom:0;padding-top:20px;border-top:1px solid var(--editorial-divider)}.legacy-visitor-details>div{display:grid;grid-template-columns:220px minmax(0,1fr);align-items:start;gap:12px;min-width:0}.legacy-visitor-details>div+div{margin-top:9px}.legacy-arrival-card[data-arrival-kind="visitor"] .legacy-visitor-details dt,.legacy-arrival-card[data-arrival-kind="visitor"] .legacy-visitor-details dd{margin:0;padding:0;border:0;color:var(--editorial-text);font-size:var(--vc-theme-font-23,23px);line-height:1.15}.legacy-arrival-card[data-arrival-kind="visitor"] .legacy-visitor-details dt{font-weight:800}.legacy-visitor-room-line{display:flex;flex-wrap:wrap}.legacy-visitor-room-line>*+*{margin-left:7px}.legacy-visitor-room-line i{color:var(--editorial-muted);font-style:normal}
    .legacy-arrival-card[data-arrival-kind="visitor"][data-motion="aurora-rise"]{animation-name:legacy-visitor-arrival-rise}
    .legacy-arrival-card[data-arrival-kind="visitor"][data-motion="spotlight-bloom"]{animation-name:legacy-visitor-arrival-bloom}
    .legacy-arrival-card[data-arrival-kind="visitor"][data-motion="kinetic-split"]{animation-name:legacy-visitor-arrival-split}
    .legacy-arrival-card[data-arrival-kind="visitor"][data-motion="prism-swipe"]{animation-name:legacy-visitor-arrival-swipe}
    .legacy-arrival-card[data-arrival-kind="visitor"][data-motion="grand-flip"]{animation-name:legacy-visitor-arrival-flip}
    .editorial-arena.portrait .legacy-arrival-grid[data-arrival-kind="visitor"],.editorial-arena.portrait .legacy-arrival-grid[data-arrival-kind="visitor"][data-cards="1"],.editorial-arena.portrait .legacy-arrival-grid[data-arrival-kind="visitor"][data-cards="2"]{grid-template-columns:minmax(0,1fr);grid-template-rows:repeat(2,minmax(0,1fr));gap:18px}
    .editorial-arena.portrait .legacy-arrival-card[data-arrival-kind="visitor"]{padding:54px}
    .editorial-arena.portrait .legacy-arrival-card[data-arrival-kind="visitor"] .legacy-visitor-teams h2{max-width:none;margin:0}.editorial-arena.portrait .legacy-arrival-card[data-arrival-kind="visitor"] .legacy-visitor-teams h2 span{font-size:var(--vc-theme-font-50,50px)}
    .editorial-arena.portrait .legacy-arrival-card[data-arrival-kind="visitor"] .legacy-visitor-schedule time,.editorial-arena.portrait .legacy-arrival-card[data-arrival-kind="visitor"] .legacy-visitor-schedule span{font-size:var(--vc-theme-font-52,52px)}.editorial-arena.portrait .legacy-arrival-card[data-arrival-kind="visitor"] .legacy-visitor-details dt,.editorial-arena.portrait .legacy-arrival-card[data-arrival-kind="visitor"] .legacy-visitor-details dd{font-size:var(--vc-theme-font-26,26px)}.editorial-arena.portrait .legacy-visitor-details>div{grid-template-columns:245px minmax(0,1fr)}
    @keyframes legacy-visitor-arrival-rise{0%{opacity:0;transform:translateY(52px) scale(.97)}100%{opacity:1;transform:none}}
    @keyframes legacy-visitor-arrival-bloom{0%{opacity:0;transform:scale(.93)}100%{opacity:1;transform:none}}
    @keyframes legacy-visitor-arrival-split{0%{opacity:0;transform:translateX(-72px) skewX(-4deg)}100%{opacity:1;transform:none}}
    @keyframes legacy-visitor-arrival-swipe{0%{opacity:0;transform:translateX(72px) rotate(1deg)}100%{opacity:1;transform:none}}
    @keyframes legacy-visitor-arrival-flip{0%{opacity:0;transform:perspective(1400px) rotateY(-38deg) translateX(-32px)}100%{opacity:1;transform:none}}
    @keyframes legacy-arrival-aurora{0%{opacity:0;filter:blur(18px) saturate(1.8);transform:translateY(88px) scale(.9)}58%{opacity:1;filter:blur(0) saturate(1.28);transform:translateY(-8px) scale(1.015)}100%{opacity:1;filter:none;transform:none}}
    @keyframes legacy-arrival-spotlight{0%{opacity:0;filter:brightness(2.2) blur(10px);transform:scale(.72)}62%{opacity:1;filter:brightness(1.18);transform:scale(1.025)}100%{opacity:1;filter:none;transform:none}}
    @keyframes legacy-arrival-kinetic{0%{opacity:0;filter:blur(7px);transform:translateX(-125px) skewX(-8deg) scaleX(.82)}68%{opacity:1;filter:none;transform:translateX(10px) skewX(1deg) scaleX(1.015)}100%{opacity:1;filter:none;transform:none}}
    @keyframes legacy-arrival-prism{0%{opacity:0;filter:hue-rotate(-24deg) saturate(1.9);transform:translateX(110px) rotate(2.5deg) scale(.94)}64%{opacity:1;filter:hue-rotate(5deg) saturate(1.2);transform:translateX(-7px) rotate(-.25deg) scale(1.01)}100%{opacity:1;filter:none;transform:none}}
    @keyframes legacy-arrival-flip{0%{opacity:0;filter:blur(9px);transform:perspective(1400px) rotateY(-72deg) translateX(-55px) scale(.9)}70%{opacity:1;filter:none;transform:perspective(1400px) rotateY(5deg) translateX(5px) scale(1.01)}100%{opacity:1;filter:none;transform:perspective(1400px) rotateY(0) translateX(0) scale(1)}}
    @media(prefers-reduced-motion:reduce){.legacy-arrival-card[data-arrival-kind="visitor"][data-motion],.legacy-arrival-card[data-motion]{animation:none;filter:none;opacity:1;transform:none}}
    .dynamic-empty{padding:3vh 3vw;border-left:8px solid var(--accent);background:#fffdf7;font-size:var(--vc-theme-font-46-08,46.08px);font-weight:800}
    .dark .dynamic-empty{background:#141512}
    .dynamic-template footer{display:flex;justify-content:space-between;padding-top:1.7vh;border-top:1px solid rgba(98,95,87,.3);color:#625f57;font-size:var(--vc-theme-font-18-24,18.24px);font-weight:700;letter-spacing:.06em;text-transform:uppercase}
    .dark footer{color:#c9c4b9}
    .dynamic-template.portrait{padding:5vh 6vw 4vh}
    .portrait .dynamic-menu-grid{grid-template-columns:1fr;gap:1vh}
    .portrait .dynamic-menu-item{min-height:7.2vh;padding:1.1vh 2.6vw}
    .portrait .dynamic-news{max-width:100%}
    .portrait .dynamic-news h2{font-size:var(--vc-theme-font-124-2,124.2px)}
    .portrait .dynamic-news p:last-child{max-width:100%;font-size:var(--vc-theme-font-43-2,43.2px)}
    .portrait .dynamic-match{grid-template-columns:1fr;gap:2.5vh}
    .portrait .dynamic-team{grid-template-columns:auto minmax(0,1fr);align-items:center;justify-items:start;width:100%;text-align:left}
    .portrait .dynamic-team-mark{width:min(24vw,17vh);height:min(24vw,17vh);font-size:var(--vc-theme-font-90,90px)}
    .portrait .dynamic-match-meta{width:100%;padding:2vh 0;border-top:1px solid rgba(98,95,87,.3);border-bottom:1px solid rgba(98,95,87,.3)}
    .portrait .dynamic-row{grid-template-columns:44px minmax(0,1fr);min-height:10.5vh}
    .portrait .dynamic-row strong{grid-column:2;justify-self:start;text-align:left}
    .dynamic-template.portrait>header p{font-size:var(--vc-theme-font-17,17px)}
    .dynamic-template.portrait h1{font-size:var(--vc-theme-font-54,54px)}
    .portrait .dynamic-menu-item small{font-size:var(--vc-theme-font-13,13px)}
    .portrait .dynamic-menu-item h2{font-size:var(--vc-theme-font-24,24px)}
    .portrait .dynamic-menu-item p{font-size:var(--vc-theme-font-14,14px)}
    .portrait .dynamic-menu-item strong{font-size:var(--vc-theme-font-27,27px)}
    .portrait .dynamic-team h2{font-size:var(--vc-theme-font-37-8,37.8px)}
    .portrait .dynamic-match-meta small{font-size:var(--vc-theme-font-15,15px)}
    .portrait .dynamic-match-meta strong{font-size:var(--vc-theme-font-43-2,43.2px)}
    .portrait .dynamic-match-meta p{font-size:var(--vc-theme-font-18,18px)}
    .portrait .dynamic-row>span{font-size:var(--vc-theme-font-19,19px)}
    .portrait .dynamic-row h2{font-size:var(--vc-theme-font-23,23px)}
    .portrait .dynamic-row p{font-size:var(--vc-theme-font-14,14px)}
    .portrait .dynamic-row strong{font-size:var(--vc-theme-font-19,19px)}
    .portrait .dynamic-empty{font-size:var(--vc-theme-font-25-92,25.92px)}
    .dynamic-template.portrait>footer{font-size:var(--vc-theme-font-12,12px)}
    .editorial-arena.portrait .editorial-heading>span{font-size:var(--vc-theme-font-13-5,13.5px)}
    .editorial-arena.portrait .editorial-news-art>span{font-size:var(--vc-theme-font-151-2,151.2px)}
    .editorial-arena.portrait .editorial-news-copy>span{font-size:var(--vc-theme-font-11-232,11.232px)}
    .editorial-arena.portrait[data-slide-type="sport_results"] .dynamic-row>span{font-size:var(--vc-theme-font-28-5,28.5px)}
    .editorial-arena.portrait[data-slide-type="sport_results"] .dynamic-row h2{font-size:var(--vc-theme-font-34-5,34.5px)}
    .editorial-arena.portrait[data-slide-type="sport_results"] .dynamic-row p{font-size:var(--vc-theme-font-21,21px)}
    .editorial-arena.portrait[data-slide-type="sport_results"] .dynamic-row strong{font-size:var(--vc-theme-font-28-5,28.5px)}
    .portrait .legacy-fixture-list{grid-auto-rows:var(--sport-list-row-height,221px)}.portrait .legacy-result-list{grid-auto-rows:var(--sport-list-row-height,314px)}
    .portrait .legacy-fixture-row{height:var(--sport-list-row-height,221px);font-size:var(--vc-sport-row-size-portrait,20.16px)}
    .portrait .legacy-result-row{height:var(--sport-list-row-height,314px);font-size:var(--vc-sport-result-size-portrait,30.24px)}
    .portrait .legacy-typed-row,.portrait .legacy-typed-row[data-kind="official"]{grid-template-columns:110px minmax(0,1fr)}
    .portrait .legacy-typed-row>strong{grid-column:2;justify-self:start;text-align:left}
    .dynamic-template.editorial-arena{display:block;padding:0;background:#f3f1ec;color:#17202a}
    .dynamic-template.editorial-arena.dark{background:#070a0e;color:#f3f0e9}
    .dynamic-template.editorial-arena{background:var(--editorial-canvas);color:var(--editorial-text)}
    .dynamic-template.editorial-arena[data-theme-id]{font-family:var(--vc-theme-body-font),Arial,Helvetica,sans-serif}
    .dynamic-template.editorial-arena[data-theme-id] h1,.dynamic-template.editorial-arena[data-theme-id] h2{font-family:var(--vc-theme-display-font),Arial,Helvetica,sans-serif;font-weight:var(--vc-theme-display-weight);letter-spacing:var(--vc-theme-display-spacing)}
    .dynamic-template.editorial-arena[data-theme-id="editorial"]{background-image:linear-gradient(112deg,transparent 0,transparent 68%,rgba(255,90,31,.10) 100%)}
    .dynamic-template.editorial-arena[data-theme-id="fieldflow"]{background-image:radial-gradient(circle at 86% 14%,var(--editorial-accent-soft),transparent 30%),linear-gradient(var(--editorial-border-soft) 1px,transparent 1px),linear-gradient(90deg,var(--editorial-border-soft) 1px,transparent 1px),linear-gradient(118deg,transparent 0,transparent 74%,var(--editorial-accent-soft) 100%);background-size:auto,96px 96px,96px 96px,auto;box-shadow:inset 8px 0 0 var(--accent)}
    .dynamic-template.editorial-arena[data-theme-id="obsidian"]{background-image:radial-gradient(circle at 82% 15%,rgba(48,188,237,.18),transparent 32%),linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:auto,80px 80px,80px 80px}
    .dynamic-template.editorial-arena[data-theme-id="atelier"]{background-image:radial-gradient(circle at 90% 100%,rgba(215,91,42,.12),transparent 38%),repeating-linear-gradient(90deg,transparent 0,transparent 28px,rgba(255,255,255,.035) 29px)}
    .dynamic-template.editorial-arena[data-theme-id="velocity"]{background-image:linear-gradient(118deg,transparent 0,transparent 64%,rgba(255,61,0,.15) 64%,rgba(255,61,0,.05) 72%,transparent 72%)}
    .dynamic-template.editorial-arena[data-theme-id="heritage"]{background-image:repeating-linear-gradient(90deg,transparent 0,transparent 78px,rgba(184,135,47,.055) 80px)}
    .dynamic-template.editorial-arena[data-theme-id="halo"]{background-image:radial-gradient(circle at 75% 42%,rgba(255,79,119,.20),transparent 28%),radial-gradient(circle at 15% 90%,rgba(111,102,255,.14),transparent 34%)}
    .dynamic-template.editorial-arena[data-theme-id="swiss"]{background-image:linear-gradient(90deg,var(--accent) 0,var(--accent) 18px,transparent 18px),linear-gradient(90deg,transparent 25%,var(--editorial-border) 25%,var(--editorial-border) 25.1%,transparent 25.1%,transparent 50%,var(--editorial-border) 50%,var(--editorial-border) 50.1%,transparent 50.1%,transparent 75%,var(--editorial-border) 75%,var(--editorial-border) 75.1%,transparent 75.1%)}
    .dynamic-template.editorial-arena[data-theme-id="pavilion"]{background-image:radial-gradient(circle at 80% 10%,rgba(207,155,85,.18),transparent 35%)}
    .dynamic-template.editorial-arena[data-theme-id="tactical"]{background-image:radial-gradient(circle at 82% 50%,rgba(56,230,139,.13),transparent 36%),linear-gradient(rgba(56,230,139,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(56,230,139,.055) 1px,transparent 1px);background-size:auto,64px 64px,64px 64px}
    .dynamic-template.editorial-arena[data-theme-id="terrace"]{background-image:linear-gradient(125deg,transparent 0,transparent 68%,rgba(255,92,53,.16) 78%,transparent 78%),radial-gradient(rgba(255,255,255,.08) 1px,transparent 1px);background-size:auto,5px 5px}
    .editorial-arena .dynamic-menu-grid,.editorial-arena .dynamic-list,.editorial-arena .dynamic-match,.editorial-arena .editorial-news-art,.editorial-arena .editorial-news-copy,.editorial-arena .legacy-standing-card{border-color:var(--editorial-border);background:var(--editorial-surface);box-shadow:0 24px 80px var(--editorial-shadow)}
    .editorial-arena .dynamic-menu-item,.editorial-arena .legacy-standing-row{border-color:var(--editorial-border-soft);background:var(--editorial-row)}
    .editorial-arena:before{position:absolute;top:0;right:0;left:0;height:8px;background:var(--accent);content:""}
    .dynamic-template.editorial-arena>header{position:absolute;top:calc(52px + var(--viewport-inset-y,0px));right:calc(52px + var(--viewport-inset-x,0px));left:calc(52px + var(--viewport-inset-x,0px));height:146px;display:grid;grid-template-columns:112px minmax(0,1fr) 330px;align-items:center;gap:24px;padding:16px 24px;overflow:hidden;border:1px solid var(--editorial-border);border-radius:24px;background:var(--editorial-surface);box-shadow:0 18px 60px var(--editorial-shadow);animation:editorial-copy-in 280ms 80ms ease-out both}
    .dynamic-template.editorial-arena.dark>header{border-color:var(--editorial-border)}
    .editorial-crest{display:flex;align-items:center;justify-content:center;width:112px;height:112px;overflow:hidden;border:1px solid var(--editorial-border);border-radius:20px;background:var(--vc-club-logo-background,var(--editorial-surface-alt));color:var(--accent);font-size:var(--vc-theme-font-34,34px);font-weight:900}
    .editorial-crest img{width:100%;height:100%;object-fit:contain}
    .editorial-heading p{margin:0 0 .6em;color:var(--accent);font-size:var(--vc-theme-font-19-968,19.968px);font-weight:900;letter-spacing:.18em;text-transform:uppercase}
    .dynamic-template.editorial-arena .editorial-heading h1{max-width:100%;margin:0;overflow:hidden;font-size:var(--vc-title-size,64px);font-weight:900;line-height:.96;text-overflow:ellipsis;text-transform:none;white-space:nowrap}
    .editorial-heading>span{display:block;margin-top:.55em;color:#6f7882;font-size:var(--vc-theme-font-24,24px);font-weight:800;letter-spacing:.1em;text-transform:uppercase}
    .dark .editorial-heading>span{color:#9aa2ac}
    .editorial-context{display:flex;min-width:0;flex-direction:column;align-items:flex-end;gap:10px;text-align:right}
    .editorial-context strong{max-width:100%;overflow-wrap:break-word;word-break:break-word;color:var(--editorial-muted);font-size:var(--vc-theme-font-14,14px);font-weight:700;letter-spacing:.14em;line-height:1.2;text-transform:uppercase}
    .editorial-context strong:before{display:inline-block;width:8px;height:8px;margin:0 10px 1px 0;border-radius:50%;background:var(--accent);content:""}
    .editorial-context span{color:var(--accent);font-size:var(--vc-theme-font-18,18px);font-weight:900}
    .editorial-context[data-match-centre] strong:before{display:none}.editorial-context-label{display:flex;align-items:baseline;justify-content:flex-end;gap:14px}.editorial-context-label b{color:var(--accent);font-size:var(--vc-theme-font-16,16px);letter-spacing:.08em}.editorial-context time{color:var(--accent);font-size:var(--vc-theme-font-18,18px);font-weight:750;letter-spacing:.03em;white-space:nowrap}
    .editorial-arena .dynamic-body{position:absolute;top:calc(216px + var(--viewport-inset-y,0px));right:calc(52px + var(--viewport-inset-x,0px));bottom:calc(114px + var(--viewport-inset-y,0px));left:calc(52px + var(--viewport-inset-x,0px));display:grid;align-content:stretch;padding:0}
    .dynamic-template.editorial-arena>footer{position:absolute;right:calc(52px + var(--viewport-inset-x,0px));bottom:calc(52px + var(--viewport-inset-y,0px));left:calc(52px + var(--viewport-inset-x,0px));height:44px;display:flex;align-items:center;justify-content:space-between;padding:0;border:0;color:#6f7882;font-size:var(--vc-theme-font-14,14px);font-weight:800;letter-spacing:.08em;animation:editorial-copy-in 280ms 280ms ease-out both}
    .dynamic-template.editorial-arena.dark>footer{color:#9aa2ac}
    .editorial-arena .dynamic-menu-grid,.editorial-arena .dynamic-list,.editorial-arena .dynamic-match{height:100%;padding:2.8%;overflow:hidden;border:1px solid rgba(23,32,42,.13);border-radius:24px;background:#fffefa;box-shadow:0 24px 80px rgba(0,0,0,.24)}
    .editorial-arena.dark .dynamic-menu-grid,.editorial-arena.dark .dynamic-list,.editorial-arena.dark .dynamic-match{border-color:rgba(255,255,255,.12);background:#0d1218}
    .editorial-arena .dynamic-menu-item{grid-template-columns:92px minmax(0,1fr) auto;min-height:auto;border:1px solid rgba(23,32,42,.13);border-left:6px solid var(--accent);border-radius:14px;background:#f7f5f0}
    .editorial-arena.dark .dynamic-menu-item{border-color:rgba(255,255,255,.12);background:#121820}
    .editorial-arena.portrait .dynamic-menu-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:1vh 1.4vw}
    .editorial-product-pic{display:flex;align-items:center;justify-content:center;width:92px;height:92px;overflow:hidden;border:1px solid rgba(23,32,42,.13);border-radius:18px;background:var(--accent);color:#fff;font-size:var(--vc-theme-font-32,32px);font-weight:900}
    .dark .editorial-product-pic{border-color:rgba(255,255,255,.12)}
    .editorial-product-pic img{width:100%;height:100%;object-fit:cover}
    .editorial-arena .dynamic-row{min-height:12.5%;border-top:0;border-bottom:1px solid rgba(23,32,42,.13)}
    .editorial-arena.dark .dynamic-row{border-color:rgba(255,255,255,.12)}
    .editorial-arena .dynamic-match{padding:2.8%}
    .editorial-arena .dynamic-team-mark{border:0;background:var(--accent);color:#fff;clip-path:polygon(7% 0,93% 0,85% 72%,50% 100%,15% 72%)}
    .dynamic-template.editorial-arena[data-slide-type="price_list"]>header{right:64px;left:64px;height:16.3%;grid-template-columns:112px 1fr;gap:32px}
    .editorial-arena[data-slide-type="price_list"] .editorial-crest{width:112px;height:112px}
    .editorial-arena[data-slide-type="price_list"] .editorial-context{display:none}
    .editorial-arena[data-slide-type="price_list"] .dynamic-body{top:18.52%;right:3.33%;bottom:8.15%;left:3.33%}
    .legacy-price-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:64px;height:100%}
    .legacy-price-column{min-width:0;align-self:start}
    .legacy-price-category,.legacy-price-product{box-sizing:border-box;height:88px;margin:0;border-bottom:1px solid rgba(255,255,255,.12)}
    .legacy-price-category{display:flex;align-items:center;gap:24px;overflow:hidden;font-size:var(--vc-theme-font-28,28px);font-weight:900;text-transform:uppercase;white-space:nowrap}
    .legacy-price-category:before{flex:0 0 8px;height:64px;background:var(--accent);content:""}
    .legacy-price-category span{overflow:hidden;text-overflow:ellipsis}
    .legacy-price-category small{margin-left:auto;color:#9aa2ac;font-size:var(--vc-theme-font-10,10px);letter-spacing:.12em;text-transform:uppercase}
    .legacy-price-product{display:grid;grid-template-columns:64px minmax(0,1fr) 120px;align-items:center;gap:16px;padding:12px 0}
    .legacy-price-media{display:block;width:64px;height:64px;overflow:hidden}
    .legacy-price-media img{display:block;width:100%;height:100%;object-fit:cover}
    .legacy-price-copy{display:grid;grid-template-rows:1fr 1fr;align-items:center;min-width:0;height:64px}
    .legacy-price-copy strong,.legacy-price-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .legacy-price-copy strong{align-self:end;font-size:var(--vc-theme-font-36,36px);line-height:1}
    .legacy-price-copy strong.legacy-price-title-compact{font-size:var(--vc-theme-font-32,32px)}
    .legacy-price-copy strong.legacy-price-title-dense{font-size:var(--vc-theme-font-28,28px)}
    .legacy-price-copy small{align-self:start;padding-top:5px;color:#9aa2ac;font-size:var(--vc-theme-font-17,17px);line-height:22px}
    .legacy-price-product>b{justify-self:end;overflow:hidden;max-width:120px;color:var(--accent);font-size:var(--vc-theme-font-32,32px);font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
    .editorial-arena:not(.dark) .legacy-price-category,.editorial-arena:not(.dark) .legacy-price-product{border-color:rgba(23,32,42,.12)}
    .editorial-arena:not(.dark) .legacy-price-category small,.editorial-arena:not(.dark) .legacy-price-copy small{color:#6f7882}
    .dynamic-template.menu-studio-v2>header{top:72px;right:96px;left:96px;height:152px;grid-template-columns:1fr auto;gap:48px;border-bottom:4px solid var(--accent)}
    .menu-studio-v2 .editorial-crest,.menu-studio-v2 .editorial-context{display:none}
    .menu-studio-v2 .editorial-heading p{margin-bottom:10px;font-size:var(--vc-theme-font-24,24px)}
    .dynamic-template.menu-studio-v2 .editorial-heading h1{font-family:var(--vc-theme-display-font),Arial,sans-serif;font-size:var(--vc-theme-font-82,82px);font-weight:var(--vc-theme-display-weight);letter-spacing:var(--vc-theme-display-spacing);line-height:.95}
    .editorial-arena.menu-studio-v2 .dynamic-body{top:248px;right:96px;bottom:auto;left:96px;height:704px}
    .dynamic-template.editorial-arena.menu-studio-v2>footer{right:96px;bottom:48px;left:96px;height:48px;border-top:2px solid var(--editorial-border)}
    .menu-studio-v2 .legacy-price-grid{gap:36px}
    .menu-studio-v2 .legacy-price-column{box-sizing:border-box;height:100%;padding:22px;border:2px solid var(--editorial-border);border-radius:20px;background:var(--editorial-surface);box-shadow:0 24px 80px var(--editorial-shadow)}
    .menu-studio-v2 .legacy-price-category{height:70px;border-bottom:3px solid var(--accent);font-family:var(--vc-theme-display-font),Arial,sans-serif;font-size:var(--vc-theme-font-36,36px)}
    .menu-studio-v2 .legacy-price-category:before{display:none}
    .menu-studio-v2 .legacy-price-product{height:78px;grid-template-columns:64px minmax(0,1fr) 120px;padding:8px 4px}
    .menu-studio-v2 .legacy-price-copy strong{font-size:var(--vc-theme-font-34,34px)}
    .menu-studio-v2 .legacy-price-copy strong.legacy-price-title-compact{font-size:var(--vc-theme-font-30,30px)}
    .menu-studio-v2 .legacy-price-copy strong.legacy-price-title-dense{font-size:var(--vc-theme-font-26,26px)}
    .menu-studio-v2 .legacy-price-copy small{font-size:var(--vc-theme-font-18,18px)}
    .menu-studio-v2 .legacy-price-product>b{color:currentColor;font-size:var(--vc-theme-font-26,26px)}
    .menu-studio-v2 .legacy-menu-floating{position:absolute;z-index:2;box-sizing:border-box;margin:0;overflow:hidden;border-radius:20px}
    .menu-studio-v2 .legacy-menu-floating>img,.menu-studio-v2 video.legacy-menu-floating{display:block;width:100%;height:100%}
    .menu-studio-v2 .legacy-menu-floating figcaption{position:absolute;right:0;bottom:0;left:0;padding:12px 18px;background:rgba(4,47,45,.84);color:#f4f7f4;font-size:var(--vc-theme-font-18,18px)}
    .menu-studio-v2 .legacy-menu-logo{object-fit:contain}
    .menu-studio-v2 .legacy-menu-text,.menu-studio-v2 .legacy-menu-promo{padding:24px;border:2px solid var(--editorial-border);background:var(--editorial-surface);color:var(--editorial-text)}
    .menu-studio-v2 .legacy-menu-text[data-role="heading"],.menu-studio-v2 .legacy-menu-promo strong{font-family:var(--vc-theme-display-font),Arial,sans-serif;font-size:var(--vc-theme-font-34,34px);font-weight:var(--vc-theme-display-weight)}
    .menu-studio-v2 .legacy-menu-promo p{margin:12px 0 0;color:#6f7882;font-size:var(--vc-theme-font-22,22px)}
    .editorial-arena.dark .dynamic-team-mark{background:var(--accent);color:#fff}
    .editorial-news{display:grid;grid-template-columns:1.02fr .98fr;gap:1.6%;height:100%}
    .editorial-news-art,.editorial-news-copy{position:relative;overflow:hidden;border:1px solid var(--editorial-border);border-radius:24px;background:var(--editorial-surface);box-shadow:0 24px 80px var(--editorial-shadow)}
    .editorial-news-art{align-self:center;width:100%;height:auto;display:block;background:var(--editorial-panel);animation:editorial-photo-in 360ms ease-out both}
    .editorial-news-art:before{display:block;padding-top:56.25%;content:""}
    .editorial-news-art>img{position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;object-fit:contain}
    .editorial-news-art>span{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;color:var(--editorial-text-faint);font-size:var(--vc-theme-font-268-8,268.8px);font-weight:900}
    .editorial-news-source{position:absolute;top:4%;left:4%;z-index:2;max-width:42%;max-height:12%;color:var(--editorial-qr-surface);font-weight:900;text-transform:uppercase}
    .editorial-news-source img{width:auto;max-width:190px;height:auto;max-height:64px;object-fit:contain}
    .editorial-news-copy{position:relative;display:flex;flex-direction:column;justify-content:flex-start;padding:5%}
    .editorial-news-copy>span{margin:0 0 .6em;color:var(--accent);font-size:var(--vc-theme-font-19-968,19.968px);font-weight:900;letter-spacing:.18em;text-transform:uppercase;animation:editorial-copy-in 280ms 760ms ease-out both}
    .editorial-news-copy h2{margin:0;font-size:var(--vc-theme-font-80,80px);font-weight:900;letter-spacing:-.025em;line-height:.92;text-transform:uppercase;animation:editorial-copy-in 300ms 260ms ease-out both}
    .editorial-news-copy h2.dense{font-size:var(--vc-theme-font-59-904,59.904px);line-height:1}
    .editorial-news-copy p{max-width:92%;margin:4% 0 0;color:var(--editorial-muted);font-size:var(--vc-theme-font-32,32px);line-height:1.45;animation:editorial-copy-in 300ms 520ms ease-out both}
    .editorial-news-meta{display:flex;gap:6%;margin-top:auto;margin-right:286px;padding-top:2.6%;padding-right:0;border-top:1px solid var(--editorial-divider);animation:editorial-copy-in 280ms 760ms ease-out both}
    .editorial-news-meta small{min-width:0;font-size:var(--vc-theme-font-19,19px)}
    .editorial-news-meta b{display:block;margin-bottom:.4em;color:var(--accent);letter-spacing:.12em;text-transform:uppercase}
    .editorial-news-qr{position:absolute;z-index:4;right:5%;bottom:4.5%;display:flex;flex-direction:column;align-items:center;gap:8px;width:252px;color:var(--editorial-muted);font-size:var(--vc-theme-font-14,14px);font-weight:800;letter-spacing:.05em;text-align:center;text-transform:uppercase}
    .editorial-news-qr img{display:block;width:220px;height:220px;border-radius:8px;background:var(--editorial-qr-surface)}
    .editorial-news[data-news-variant="fullscreen_gradient"]{position:relative;display:block}
    .editorial-news[data-news-variant="fullscreen_gradient"] .editorial-news-art{position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;border:0;border-radius:24px}
    .editorial-news[data-news-variant="fullscreen_gradient"] .editorial-news-art:before{display:none}
    .editorial-news[data-news-variant="fullscreen_gradient"] .editorial-news-art>img{object-fit:cover}
    .editorial-news[data-news-variant="fullscreen_gradient"] .editorial-news-art:after{position:absolute;top:0;right:0;bottom:0;left:0;background:linear-gradient(90deg,var(--editorial-image-overlay-start) 0%,var(--editorial-image-overlay-start) 62%,var(--editorial-image-overlay-mid) 82%,var(--editorial-image-overlay-end) 100%);content:""}
    .editorial-news[data-news-variant="fullscreen_gradient"] .editorial-news-source{right:92px;left:auto}
    .editorial-news[data-news-variant="fullscreen_gradient"] .editorial-news-copy{position:absolute;z-index:3;top:0;right:38%;bottom:0;left:0;border-color:var(--editorial-border-soft);background:transparent;color:var(--editorial-qr-surface);box-shadow:none}
    .editorial-news[data-news-variant="fullscreen_gradient"] .editorial-news-copy p,.editorial-news[data-news-variant="fullscreen_gradient"] .editorial-news-meta,.editorial-news[data-news-variant="fullscreen_gradient"] .editorial-news-qr{color:var(--editorial-qr-surface)}
    .editorial-news[data-news-variant="fullscreen_gradient"] .editorial-news-copy p{max-width:90%;font-size:var(--vc-theme-font-30,30px);line-height:1.3}
    .editorial-news[data-news-variant="fullscreen_gradient"] .editorial-news-meta{margin-right:0}
    .editorial-news[data-news-variant="text_only"]{display:block}
    .editorial-news[data-news-variant="text_only"] .editorial-news-art{display:none}
    .editorial-news[data-news-variant="text_only"] .editorial-news-copy{box-sizing:border-box;width:100%;height:100%}
    .editorial-news[data-news-variant="text_only"] .editorial-news-copy h2{max-width:82%}
    .editorial-news[data-news-variant="text_only"] .editorial-news-copy p{max-width:76%}
    .editorial-news[data-news-variant="news_grid"]{grid-template-columns:1.15fr .85fr;grid-template-rows:1fr}
    .editorial-news[data-news-variant="news_grid"] .editorial-news-art{display:none}
    .editorial-news-grid{display:grid;grid-template-rows:repeat(2,minmax(0,1fr));gap:18px}
    .editorial-news-grid article{box-sizing:border-box;overflow:hidden;padding:30px;border:1px solid var(--editorial-border);border-radius:24px;background:var(--editorial-surface);box-shadow:0 24px 80px var(--editorial-shadow)}
    .editorial-news-grid article>span{color:var(--accent);font-size:var(--vc-theme-font-18,18px);font-weight:900;letter-spacing:.1em;text-transform:uppercase}
    .editorial-news-grid h3{margin:18px 0;font-size:var(--vc-theme-font-34,34px);line-height:1.04}
    .editorial-news-grid small{color:var(--editorial-muted);font-size:var(--vc-theme-font-16,16px)}
    @keyframes editorial-photo-in{from{opacity:0;transform:scale(1.025)}}
    @keyframes editorial-copy-in{from{opacity:0;transform:translateY(18px)}}
    @media (prefers-reduced-motion:reduce){.editorial-news-art,.editorial-news-copy>span,.editorial-news-copy h2,.editorial-news-copy p,.editorial-news-meta,.editorial-arena>header,.editorial-arena>footer{animation:none;opacity:1;transform:none}}
    .editorial-arena.portrait>header{top:calc(38px + var(--viewport-inset-y,0px));right:calc(38px + var(--viewport-inset-x,0px));left:calc(38px + var(--viewport-inset-x,0px));height:144px;grid-template-columns:104px minmax(0,1fr) 230px;gap:18px;border-radius:22px}
    .editorial-arena.portrait .editorial-context{display:flex}
    .editorial-arena.portrait .editorial-crest{width:104px;height:104px}
    .dynamic-template.editorial-arena.portrait .editorial-heading h1{font-size:var(--vc-title-size-portrait,49px)}
    .dynamic-template.editorial-arena.portrait[data-slide-type="sport_visitor_arrivals"] .editorial-heading h1{font-size:var(--vc-visitor-title-size-portrait,42.14px)}
    .editorial-arena.portrait .dynamic-body{top:calc(200px + var(--viewport-inset-y,0px));right:calc(38px + var(--viewport-inset-x,0px));bottom:calc(98px + var(--viewport-inset-y,0px));left:calc(38px + var(--viewport-inset-x,0px))}
    .dynamic-template.editorial-arena.portrait>footer{right:calc(38px + var(--viewport-inset-x,0px));bottom:calc(38px + var(--viewport-inset-y,0px));left:calc(38px + var(--viewport-inset-x,0px));height:42px;font-size:var(--vc-theme-font-12,12px)}
    .editorial-arena.portrait .editorial-news{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}
    .editorial-arena.portrait .editorial-news[data-news-variant="hero_split"]{box-sizing:border-box;gap:32px;padding-right:20px;padding-left:20px}
    .editorial-arena.portrait .editorial-news-copy h2{font-size:var(--vc-theme-font-72,72px);line-height:.96}
    .editorial-arena.portrait .editorial-news-copy h2.dense{font-size:var(--vc-theme-font-57-996,57.996px)}
    .editorial-arena.portrait .editorial-news-copy p{max-width:100%;font-size:var(--vc-theme-font-34,34px);line-height:1.45}
    .editorial-arena.portrait .editorial-news-meta{margin-right:286px;padding-right:0}
    .editorial-arena.portrait .editorial-news-meta small{font-size:var(--vc-theme-font-24,24px)}
    .editorial-arena.portrait .editorial-news-qr{width:252px}
    .editorial-arena.portrait .editorial-news-qr img{width:220px;height:220px}
    .editorial-arena.portrait .editorial-news[data-news-variant="news_grid"]{grid-template-columns:1fr;grid-template-rows:minmax(0,1.25fr) minmax(0,.75fr)}
    .editorial-arena.portrait .editorial-news[data-news-variant="fullscreen_gradient"] .editorial-news-art:after{background:linear-gradient(180deg,var(--editorial-image-overlay-end) 0%,var(--editorial-image-overlay-end) 28%,var(--editorial-image-overlay-mid) 40%,var(--editorial-image-overlay-start) 50%,var(--editorial-image-overlay-start) 100%)}
    .editorial-arena.portrait .editorial-news[data-news-variant="fullscreen_gradient"] .editorial-news-copy{right:0;top:38%}
    .editorial-news[data-news-variant="fullscreen_gradient"]>.editorial-news-qr{right:92px;bottom:30px;width:220px}
    .editorial-arena.portrait .editorial-news[data-news-variant="fullscreen_gradient"]>.editorial-news-qr{right:106px;bottom:46px;width:252px}
    .editorial-arena.portrait .editorial-news[data-news-variant="fullscreen_gradient"] .editorial-news-source{right:4%;left:auto}
    .editorial-arena.portrait .legacy-team-roster,.editorial-arena.portrait .legacy-training-schedule{grid-template-columns:repeat(2,minmax(0,1fr))}
    .editorial-arena.portrait .legacy-sponsor-layout,.editorial-arena.portrait .legacy-sponsor-layout:not([data-items="1"]){grid-template-columns:1fr}
    .editorial-arena.portrait .legacy-sponsor-card{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto;gap:28px;padding:40px}
    .editorial-arena.portrait .legacy-volunteer-layout{grid-template-columns:1fr;grid-template-rows:.55fr 1.45fr}
    .editorial-arena[data-slide-type="news"]>header{height:13%}
    .editorial-arena[data-slide-type="news"] .dynamic-body{top:15.4%}
    .editorial-arena.portrait[data-slide-type="news"]>header{height:9.5%}
    .editorial-arena.portrait[data-slide-type="news"] .dynamic-body{top:11.2%}
    .dynamic-template.editorial-arena.portrait[data-slide-type="price_list"]>header{right:48px;left:48px;height:9.27%;grid-template-columns:104px 1fr;gap:24px}
    .editorial-arena.portrait[data-slide-type="price_list"] .editorial-crest{width:104px;height:104px}
    .editorial-arena.portrait[data-slide-type="price_list"] .dynamic-body{top:10.42%;right:4.44%;bottom:4.58%;left:4.44%}
    .portrait .legacy-price-grid{gap:32px}
    .portrait .legacy-price-category,.portrait .legacy-price-product{height:96px}
    .portrait .legacy-price-category{gap:16px;font-size:var(--vc-theme-font-22,22px)}
    .portrait .legacy-price-category:before{flex-basis:7px}
    .portrait .legacy-price-product{grid-template-columns:64px minmax(0,1fr) 92px;gap:12px;padding:16px 0}
    .portrait .legacy-price-copy strong{font-size:var(--vc-theme-font-28,28px)}
    .portrait .legacy-price-copy strong.legacy-price-title-compact{font-size:var(--vc-theme-font-25,25px)}
    .portrait .legacy-price-copy strong.legacy-price-title-dense{font-size:var(--vc-theme-font-22,22px)}
    .portrait .legacy-price-copy small{padding-top:4px;font-size:var(--vc-theme-font-14,14px);line-height:19px}
    .portrait .legacy-price-product>b{max-width:92px;font-size:var(--vc-theme-font-24,24px)}
    .dynamic-template.editorial-arena.menu-studio-v2.portrait[data-slide-type="price_list"]>header{top:96px;right:72px;left:72px;height:228px;grid-template-columns:1fr auto;align-items:flex-end;padding:0 0 40px;border-bottom:4px solid var(--accent);gap:48px}
    .dynamic-template.editorial-arena.menu-studio-v2.portrait .editorial-heading h1{max-width:760px;font-size:var(--vc-theme-font-72,72px);line-height:70px;overflow-wrap:anywhere}
    .dynamic-template.editorial-arena.menu-studio-v2.portrait[data-slide-type="price_list"] .dynamic-body{top:348px;right:72px;bottom:auto;left:72px;height:1388px}
    .dynamic-template.editorial-arena.menu-studio-v2.portrait[data-slide-type="price_list"]>footer{right:72px;bottom:96px;left:72px;height:64px;font-size:var(--vc-theme-font-20,20px);font-weight:700;letter-spacing:.08em}
    .menu-studio-v2.portrait .legacy-price-grid{grid-template-columns:minmax(0,1fr);gap:20px}
    .menu-studio-v2.portrait .legacy-price-grid.legacy-price-grid-two{grid-template-columns:repeat(2,minmax(0,1fr))}
    .menu-studio-v2.portrait .legacy-price-column{display:flex;padding:22px 28px;flex-direction:column;justify-content:flex-start}
    .menu-studio-v2.portrait .legacy-price-category{height:auto;min-height:76px;align-items:flex-end;margin:0 0 10px;padding:0 0 13px;font-size:var(--vc-theme-font-34,34px);line-height:38px;white-space:normal}
    .menu-studio-v2.portrait .legacy-price-product{height:96px;min-height:96px;overflow:hidden;grid-template-columns:48px minmax(0,1fr) auto;gap:12px;padding:5px 4px}
    .menu-studio-v2.portrait .legacy-price-media{width:48px;height:48px}
    .menu-studio-v2.portrait .legacy-price-copy{height:auto}
    .menu-studio-v2.portrait .legacy-price-copy strong{font-size:var(--vc-theme-font-32,32px);line-height:34px;white-space:normal}
    .menu-studio-v2.portrait .legacy-price-copy strong.legacy-price-title-compact{font-size:var(--vc-theme-font-28,28px);line-height:31px}
    .menu-studio-v2.portrait .legacy-price-copy strong.legacy-price-title-dense{font-size:var(--vc-theme-font-24,24px);line-height:28px}
    .menu-studio-v2.portrait .legacy-price-copy small{padding-top:0;font-size:var(--vc-theme-font-17,17px);line-height:20px;white-space:normal}
    .menu-studio-v2.portrait .legacy-price-product>b{max-width:none;font-size:var(--vc-theme-font-26,26px);line-height:30px}
    .legacy-standing-card{box-sizing:border-box;height:100%;overflow:hidden;padding:1.35%;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:#0d1218;box-shadow:0 24px 80px rgba(0,0,0,.24)}
    .legacy-standing-columns,.legacy-standing-row{box-sizing:border-box;display:grid;grid-template-columns:4% 1fr repeat(6,5.7%) 15%;align-items:center;gap:.7%}
    .legacy-standing-columns{height:7%;padding:0 .7%;border-bottom:2px solid var(--accent);color:var(--accent);font-size:var(--vc-theme-font-33,33px);font-weight:900;letter-spacing:.08em;text-transform:uppercase}
    .legacy-standing-rows{height:87%;overflow:hidden}
    .legacy-standing-row{height:10%;padding:0 .7%;border-bottom:1px solid rgba(255,255,255,.12);font-size:var(--vc-theme-font-42,42px);font-weight:800}
    .legacy-standing-row.selected{border-radius:12px;background:rgba(241,90,36,.18);box-shadow:inset 7px 0 0 var(--accent),inset 0 0 0 1px var(--accent)}
    .legacy-standing-columns>span,.legacy-standing-row>span,.legacy-standing-row>strong{text-align:center}
    .legacy-standing-columns>span:nth-child(2){text-align:left}
    .legacy-standing-rank{color:var(--accent)}
    .legacy-standing-team{display:flex;align-items:center;min-width:0;gap:2%;text-align:left!important}
    .legacy-standing-team i,.legacy-standing-team img{display:flex;flex:0 0 auto;align-items:center;justify-content:center;box-sizing:border-box;width:1.7em;height:2em;background:var(--accent);color:#fff;font-size:.62em;font-style:normal;font-weight:900}
    .legacy-standing-team img{background:transparent;object-fit:contain}
    .legacy-standing-team b{overflow:hidden;text-overflow:ellipsis;text-transform:uppercase;white-space:nowrap}
    .legacy-standing-points{font-size:1.18em}
    .legacy-standing-form{display:flex;align-items:center;justify-content:center;gap:4%}
    .legacy-standing-form i{display:inline-flex;align-items:center;justify-content:center;width:2em;height:2em;border-radius:7px;background:#78828f;color:#fff;font-size:.65em;font-style:normal;font-weight:900}
    .legacy-standing-form i.win{background:#1f9d63}
    .legacy-standing-form i.loss{background:#cb3f49}
    .legacy-standing-form b{color:rgba(246,244,238,.55)}
    .legacy-standing-context{height:6%;margin:.6% 0 0;color:#9aa2ac;font-size:var(--vc-theme-font-19-5,19.5px);text-align:right}
    .portrait .legacy-standing-card{padding:2%}
    .portrait .legacy-standing-columns,.portrait .legacy-standing-row{grid-template-columns:5% 1fr repeat(6,6.3%) 16%}
    .portrait .legacy-standing-columns{height:7%;font-size:var(--vc-theme-font-27,27px)}
    .portrait .legacy-standing-rows{height:90%}
    .portrait .legacy-standing-row{height:10%;font-size:var(--vc-theme-font-39,39px)}
    .portrait .legacy-standing-context{height:3%;margin-top:.3%;font-size:var(--vc-theme-font-19-5,19.5px)}
    .editorial-arena[data-slide-type="sport_results"] .dynamic-row>span{font-size:var(--vc-theme-font-46-08,46.08px)}
    .editorial-arena[data-slide-type="sport_results"] .dynamic-row h2{font-size:var(--vc-theme-font-57-6,57.6px)}
    .editorial-arena[data-slide-type="sport_results"] .dynamic-row p{font-size:var(--vc-theme-font-31-68,31.68px)}
    .editorial-arena[data-slide-type="sport_results"] .dynamic-row strong{font-size:var(--vc-theme-font-40-32,40.32px)}
    .editorial-arena:not(.dark) .legacy-standing-card{border-color:rgba(23,32,42,.13);background:#fffefa}
    .editorial-arena:not(.dark) .legacy-standing-row{border-color:rgba(23,32,42,.09)}
    .editorial-arena:not(.dark) .legacy-standing-context{color:#6f7882}
    .dynamic-template.rss-news-portrait,.dynamic-template.rss-news-landscape{display:block;padding:0;background:#0a0a0a;color:#fafaf7}
    .rss-news-portrait>header,.rss-news-portrait>footer,.rss-news-landscape>header,.rss-news-landscape>footer{display:none}
    .rss-news-portrait .dynamic-body,.rss-news-landscape .dynamic-body{position:absolute;top:0;right:0;bottom:0;left:0;display:block;padding:0}
    .legacy-rss-page{position:absolute;top:0;right:0;bottom:0;left:0;overflow:hidden;background:#0a0a0a}
    .legacy-rss-hero,.legacy-rss-grade{position:absolute;top:0;right:0;bottom:0;left:0}
    .legacy-rss-hero{overflow:hidden;background:#0a0a0a;animation:legacy-rss-photo-in 760ms cubic-bezier(.16,1,.3,1) both}
    .legacy-rss-hero>span{position:absolute;top:34%;left:50%;color:rgba(255,255,255,.045);font-size:min(82vw,900px);font-weight:900;line-height:1;transform:translate(-50%,-50%)}
    .legacy-rss-hero img{position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;object-fit:cover;object-position:50% 38%;filter:saturate(.88) contrast(1.04) brightness(.9)}
    .legacy-rss-grade{background:linear-gradient(180deg,rgba(10,10,10,.94),rgba(10,10,10,.38) 13%,transparent 29%,transparent 48%,rgba(10,10,10,.72) 64%,#0a0a0a 80%,#0a0a0a)}
    .legacy-rss-provider{position:absolute;top:3%;right:7%;left:7%;display:flex;flex-direction:column;align-items:center;animation:legacy-rss-detail-in 520ms 1120ms cubic-bezier(.2,0,0,1) both}
    .legacy-rss-provider img{width:auto;max-width:min(24vw,130px);height:min(3.9vh,75px);object-fit:contain;filter:drop-shadow(0 .6vh 1.2vh rgba(0,0,0,.44))}
    .legacy-rss-provider strong{overflow:hidden;max-width:36vw;padding:.45vh 1.2vw;border:1px solid rgba(255,255,255,.14);border-radius:.65vh;background:rgba(10,10,10,.52);font-size:clamp(13px,1.3vw,28px);text-overflow:ellipsis;text-transform:uppercase;white-space:nowrap}
    .legacy-rss-provider p{margin:2.7vh 0 0;color:#fafaf7;font-size:clamp(15px,2.3vw,25px);font-weight:720;letter-spacing:.34em;line-height:1;text-shadow:.2em .2em 0 rgba(0,0,0,.72),.35em .35em 1.1em rgba(0,0,0,.82);text-transform:uppercase}
    .legacy-rss-story{position:absolute;top:59.2%;right:7%;left:7%}
    .legacy-rss-story h2{display:-webkit-box;max-width:84%;margin:0;overflow:hidden;color:#fafaf7;font-size:clamp(43px,7.25vw,78px);font-weight:760;letter-spacing:-.04em;line-height:1.06;text-shadow:0 .35em 1.35em rgba(0,0,0,.72);animation:legacy-rss-title-in 620ms 380ms cubic-bezier(.16,1,.3,1) both;-webkit-box-orient:vertical;-webkit-line-clamp:3}
    .legacy-rss-story h2.compact{font-size:clamp(38px,5.95vw,64px);line-height:1.08}
    .legacy-rss-story i{display:block;width:16%;height:3px;margin-top:1.7vh;background:var(--accent);box-shadow:0 0 .7em var(--accent);animation:legacy-rss-accent-in 520ms 650ms cubic-bezier(.16,1,.3,1) both}
    .legacy-rss-story p{display:-webkit-box;max-width:67%;margin:1.7vh 0 0;overflow:hidden;color:rgba(250,250,247,.86);font-size:clamp(20px,3.15vw,34px);font-style:normal;line-height:1.42;animation:legacy-rss-copy-in 560ms 820ms cubic-bezier(.2,0,0,1) both;-webkit-box-orient:vertical;-webkit-line-clamp:3}
    .legacy-rss-meta{position:absolute;bottom:8.2%;left:7%;display:flex;max-width:70%;gap:3vw;color:rgba(250,250,247,.84);font-size:clamp(13px,1.85vw,20px);font-weight:540;text-transform:uppercase;animation:legacy-rss-detail-in 520ms 1190ms cubic-bezier(.2,0,0,1) both}
    .legacy-rss-meta span{overflow:hidden;max-width:28vw;text-overflow:ellipsis;white-space:nowrap}
    .legacy-rss-meta b{margin-right:.45em;color:var(--accent);font-size:.72em;letter-spacing:.1em}
    .legacy-rss-footer{position:absolute;right:3.5%;bottom:0;left:3.5%;height:6.4%;border-top:1px solid rgba(255,255,255,.065);animation:legacy-rss-detail-in 520ms 1280ms cubic-bezier(.2,0,0,1) both}
    .legacy-rss-progress{position:absolute;top:50%;left:29%;width:47%;height:8px;overflow:hidden;border:1px solid rgba(255,255,255,.19);border-radius:999px;background:rgba(255,255,255,.08);transform:translateY(-50%)}
    .legacy-rss-progress i{display:block;width:100%;height:100%;border-radius:inherit;background:var(--accent);animation:legacy-rss-progress var(--rss-duration) linear forwards;transform:scaleX(0);transform-origin:left center}
    .legacy-rss-counter{position:absolute;top:50%;right:3.8%;color:rgba(255,255,255,.46);font-size:clamp(17px,2.4vw,26px);transform:translateY(-50%)}
    .legacy-rss-counter b{color:#fff;font-size:1.25em}
    .rss-news-landscape .legacy-rss-hero>span{top:48%;left:72%;font-size:min(52vw,760px)}
    .rss-news-landscape .legacy-rss-hero img{object-position:68% 42%}
    .rss-news-landscape .legacy-rss-grade{background:linear-gradient(90deg,#0a0a0a 0,rgba(10,10,10,.94) 20%,rgba(10,10,10,.78) 43%,rgba(10,10,10,.28) 68%,transparent 88%),linear-gradient(180deg,rgba(10,10,10,.86),rgba(10,10,10,.12) 24%,transparent 52%,rgba(10,10,10,.6) 82%,#0a0a0a)}
    .rss-news-landscape .legacy-rss-provider{top:4.2%;right:5%;left:5%}
    .rss-news-landscape .legacy-rss-provider img{max-width:min(13vw,150px);height:min(7vh,75px)}
    .rss-news-landscape .legacy-rss-provider strong{max-width:22vw;font-size:clamp(14px,1.05vw,22px)}
    .rss-news-landscape .legacy-rss-provider p{max-width:58%;margin-top:1.8vh;font-size:clamp(18px,1.45vw,30px);text-shadow:.18em .18em 0 rgba(0,0,0,.8),.34em .34em .9em rgba(0,0,0,.9)}
    .rss-news-landscape .legacy-rss-story{top:31%;right:auto;left:6%;width:56%}
    .rss-news-landscape .legacy-rss-story h2{max-width:100%;font-size:clamp(58px,4.7vw,90px)}
    .rss-news-landscape .legacy-rss-story h2.compact{font-size:clamp(52px,4vw,76px);line-height:1.06}
    .rss-news-landscape .legacy-rss-story i{width:13%;margin-top:2.2vh}
    .rss-news-landscape .legacy-rss-story p{max-width:88%;margin-top:2vh;font-size:clamp(28px,2vw,40px);line-height:1.35}
    .rss-news-landscape .legacy-rss-meta{bottom:10.2%;left:6%;max-width:58%;gap:2.4vw;font-size:clamp(15px,1.35vw,26px)}
    .rss-news-landscape .legacy-rss-meta span{max-width:22vw}
    .rss-news-landscape .legacy-rss-footer{right:3%;left:3%;height:7%}
    .rss-news-landscape .legacy-rss-progress{left:31%;width:49%;height:8px}
    .rss-news-landscape .legacy-rss-counter{right:2.8%;font-size:clamp(18px,1.45vw,28px)}
    @keyframes legacy-rss-photo-in{from{opacity:0;transform:scale(1.035)}to{opacity:1;transform:scale(1)}}
    @keyframes legacy-rss-title-in{from{opacity:0;transform:translateY(.42em)}to{opacity:1;transform:translateY(0)}}
    @keyframes legacy-rss-accent-in{from{opacity:0;transform:scaleX(0);transform-origin:left center}to{opacity:1;transform:scaleX(1);transform-origin:left center}}
    @keyframes legacy-rss-copy-in{from{opacity:0;transform:translateY(.65em)}to{opacity:1;transform:translateY(0)}}
    @keyframes legacy-rss-detail-in{from{opacity:0;transform:translateY(.45em)}to{opacity:1;transform:translateY(0)}}
    @keyframes legacy-rss-progress{to{transform:scaleX(1)}}
    @media(prefers-reduced-motion:reduce){.legacy-rss-page *,.legacy-rss-page *:before,.legacy-rss-page *:after{animation:none!important;transition:none!important}.legacy-rss-progress i{transform:scaleX(1)}}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"]{position:absolute;display:grid!important;grid-template-rows:80px minmax(148px,auto) minmax(0,1fr);grid-row-gap:20px;padding:32px 64px 76px 150px!important;overflow:hidden;background-color:var(--bg);background-image:linear-gradient(135deg,var(--canvas-start),var(--canvas-end))!important;box-shadow:none;color:var(--ink);font-family:var(--vc-theme-body-font,"VeyoCast Royal Current Roboto"),Roboto,Arial,sans-serif}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"]:before{display:none}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"]>*{z-index:2}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-royal-flow{position:absolute;z-index:0;top:0;right:0;bottom:0;left:0;overflow:hidden;pointer-events:none}
    .legacy-royal-flow i{position:absolute;display:block;border:2px solid var(--flow-accent);border-radius:50%;opacity:.12}
    .legacy-royal-flow-one{top:-230px;right:-210px;width:780px;height:560px;transform:rotate(24deg)}
    .legacy-royal-flow-two{bottom:-440px;left:-430px;width:1050px;height:700px;transform:rotate(-16deg)}
    .legacy-royal-flow-three{right:190px;bottom:-250px;width:460px;height:330px;transform:rotate(-22deg);opacity:.06!important}
    .legacy-royal-sideband{position:absolute;z-index:3!important;top:0;bottom:0;left:0;display:flex;width:112px;flex-direction:column;align-items:center;justify-content:space-between;padding:52px 16px 46px;background:var(--deep);color:var(--own-muted);font-size:14px;font-weight:700;letter-spacing:.16em;writing-mode:vertical-rl;transform:rotate(180deg)}
    .legacy-royal-sideband b{color:var(--accent);font-size:42px;letter-spacing:0;writing-mode:horizontal-tb;transform:rotate(90deg)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"]>.legacy-royal-masthead{position:relative;top:auto;right:auto;bottom:auto;left:auto;display:flex;height:auto;min-width:0;min-height:0;align-items:center;justify-content:space-between;padding:0 32px;border:1px solid var(--line);border-radius:20px;background:var(--surface);box-shadow:0 14px 34px var(--vc-shadow)}
    .legacy-royal-masthead-club strong{display:block;font-size:24px;font-weight:900;letter-spacing:-.02em}
    .legacy-royal-masthead-club span{display:block;margin-top:5px;color:var(--muted);font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase}
    .legacy-royal-masthead-right{display:flex;align-items:center;color:var(--muted);font-size:13px;font-weight:700;letter-spacing:.11em;text-transform:uppercase}
    .legacy-royal-masthead-right>*+*{margin-left:28px}
    .legacy-royal-masthead-right time{color:var(--ink);font-size:22px;letter-spacing:0;font-variant-numeric:tabular-nums}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"]>header{position:relative!important;top:auto!important;right:auto!important;bottom:auto!important;left:auto!important;display:grid;height:auto!important;min-width:0;min-height:148px;grid-template-columns:104px minmax(0,1fr) 150px;align-items:center;grid-column-gap:26px;padding:8px 32px!important;overflow:hidden;border:1px solid var(--line);border-radius:24px;background:var(--surface);box-shadow:0 12px 30px var(--vc-shadow);animation:none}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-crest{display:grid;width:104px;height:104px;place-items:center;border:1px solid var(--line);border-radius:20px;background:var(--vc-club-logo-background);box-shadow:none}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-crest img{width:82%;height:82%;object-fit:contain}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-heading{min-width:0}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-royal-eyebrow{display:block;color:var(--accent);font-size:17px;font-weight:700;letter-spacing:.18em;line-height:1.1;text-transform:uppercase}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-heading h1{display:-webkit-box;max-width:100%;margin:7px 0 5px;overflow:hidden;color:var(--ink);font-family:var(--vc-theme-display-font,"VeyoCast Royal Current Roboto"),Roboto,Arial,sans-serif;font-size:var(--rc-title-size,62px);font-weight:900;letter-spacing:-.04em;line-height:1.04;text-overflow:clip;text-transform:none;white-space:normal;-webkit-box-orient:vertical;-webkit-line-clamp:2}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-royal-subtitle{margin:0;color:var(--muted);font-size:var(--rc-subtitle-size,23px);font-weight:500;line-height:1.2}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-royal-title-stat{display:flex;min-width:0;flex-direction:column;align-items:flex-end;color:var(--muted);text-align:right}
    .legacy-royal-title-stat strong{color:var(--accent);font-size:58px;font-weight:900;letter-spacing:-.04em;line-height:.9}
    .legacy-royal-title-stat span{margin-top:5px;font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
    .legacy-royal-title-stat small{margin-top:5px;color:var(--muted);font-size:12px;font-weight:700}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"]>.dynamic-body{position:relative!important;top:auto!important;right:auto!important;bottom:auto!important;left:auto!important;display:grid;height:auto!important;min-width:0;min-height:0;padding:0!important;overflow:hidden}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"]>footer{position:absolute!important;z-index:4;right:64px!important;bottom:22px!important;left:150px!important;display:flex;height:34px!important;align-items:center;justify-content:space-between;padding:0!important;border:0;color:var(--muted);font-size:var(--rc-footer-size,14px);font-weight:700;letter-spacing:.06em;line-height:1.2;text-transform:uppercase;animation:none}
    .legacy-royal-footer i{margin:0 7px;color:var(--accent);font-style:normal}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-fixture-list,.dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-result-list{grid-row-gap:12px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-fixture-list,.dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-result-list{grid-auto-rows:var(--sport-list-row-height,96px)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-fixture-row,.dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-result-row{height:var(--sport-list-row-height,96px);min-height:var(--sport-list-row-height,96px);border-color:var(--line);background:var(--surface);box-shadow:0 8px 20px var(--vc-shadow);color:var(--ink)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-fixture-row{font-size:var(--rc-program-row-size,25px)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-result-row{font-size:var(--rc-result-row-size,31px)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-fixture-list[data-columns="two"] .legacy-fixture-row{font-size:var(--rc-program-row-size-compact,20px)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-result-list[data-columns="two"] .legacy-result-row{font-size:var(--rc-result-row-size-compact,25px)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-program-secondary{color:var(--muted)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-cancelled-kickoff{display:inline-flex!important;width:max-content;max-width:100%;align-items:center;justify-content:center;padding:5px 8px;border:1px solid var(--line);border-radius:7px;background:var(--accent-soft);color:var(--accent);font-size:var(--rc-cancelled-size,18px)!important;font-weight:500!important;letter-spacing:0;line-height:1.1;text-transform:none;white-space:nowrap}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-match-time-empty{visibility:hidden}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-typed-row[data-kind="cancellation"]{grid-template-columns:130px minmax(0,1fr)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-typed-row[data-kind="cancellation"]>strong{display:none}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-royal-arrival-grid{display:grid;height:100%;min-height:0;grid-template-rows:minmax(0,1fr);grid-column-gap:24px;grid-row-gap:24px}
    .legacy-royal-arrival-grid[data-slots="1"]{grid-template-columns:minmax(0,1fr)}
    .legacy-royal-arrival-grid[data-slots="2"]{grid-template-columns:repeat(2,minmax(0,1fr))}
    .legacy-royal-arrival-grid[data-slots="3"]{grid-template-columns:repeat(3,minmax(0,1fr))}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-royal-arrival-card{position:relative;isolation:isolate;display:grid;min-width:0;min-height:0;grid-template-rows:minmax(0,1fr) auto;padding:0;border:1px solid var(--line);border-radius:24px;background:var(--surface);box-shadow:none;animation-duration:650ms}
    .legacy-royal-arrival-watermark{position:absolute;z-index:0;right:0;bottom:0;width:100%;height:100%;object-fit:contain;opacity:.3;pointer-events:none}
    .legacy-royal-arrival-gradient{position:absolute;z-index:1;top:0;right:0;bottom:0;left:0;background:linear-gradient(180deg,rgba(var(--matte-rgb),.80) 0%,rgba(var(--matte-rgb),.80) 33.333%,rgba(var(--matte-rgb),.46) 66.667%,rgba(var(--matte-rgb),.08) 100%);pointer-events:none}
    .legacy-royal-arrival-crest{position:relative;z-index:2;display:grid;min-width:0;min-height:0;grid-template-rows:auto minmax(0,1fr);grid-row-gap:12px;justify-items:center;align-items:stretch;padding:18px var(--arrival-pad,28px) 0}
    .legacy-royal-arrival-top{display:flex;width:100%;align-items:center;justify-content:space-between;color:var(--muted);font-size:var(--arrival-label,17px);font-weight:700;letter-spacing:.06em;line-height:1.15}
    .legacy-royal-arrival-top span{max-width:45%}
    .legacy-royal-arrival-card:first-child .legacy-royal-arrival-top span,.legacy-royal-arrival-top b{color:var(--accent)}
    .legacy-royal-arrival-top b{font-size:var(--arrival-index,29px)}
    .legacy-royal-arrival-logo{position:relative;display:block;width:56%;height:auto;min-width:0;min-height:0;color:var(--accent);font-size:var(--arrival-title,62px);font-weight:900;text-align:center}
    .legacy-royal-arrival-logo img{position:absolute;top:0;right:0;bottom:0;left:0;display:block;width:100%;height:100%;object-fit:contain;object-position:center}
    .legacy-royal-arrival-logo span{position:absolute;top:50%;right:0;left:0;transform:translateY(-50%)}
    .legacy-royal-arrival-body{position:relative;z-index:2;display:flex;min-width:0;min-height:0;flex-direction:column;justify-content:flex-end;padding:24px var(--arrival-pad,28px) var(--arrival-pad,28px)}
    .legacy-royal-arrival-identity{display:block;min-width:0;text-align:left}
    .legacy-royal-arrival-identity>span{display:block;margin:0 0 12px;color:var(--muted);font-size:var(--arrival-label,17px);font-weight:700;letter-spacing:.07em;line-height:1.2;text-transform:uppercase}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-royal-arrival-identity h2{max-width:100%;margin:0 0 8px;color:var(--ink);font-family:var(--vc-theme-display-font,"VeyoCast Royal Current Roboto"),Roboto,Arial,sans-serif;font-size:var(--arrival-title,62px);font-weight:700;letter-spacing:-.035em;line-height:1.06;overflow-wrap:break-word}
    .legacy-royal-arrival-identity p{margin:0;color:var(--muted);font-size:var(--arrival-text,28px);line-height:1.25}
    .legacy-royal-arrival-info{display:grid;min-width:0;grid-template-columns:.8fr .8fr 1.4fr;grid-column-gap:12px;margin-top:26px;padding-top:20px;border-top:1px solid var(--line)}
    .legacy-royal-arrival-info>div{display:flex;min-width:0;flex-direction:column}
    .legacy-royal-arrival-info span{color:var(--muted);font-size:var(--arrival-label,17px);font-weight:700;letter-spacing:.045em}
    .legacy-royal-arrival-info strong{margin-top:9px;color:var(--ink);font-size:var(--arrival-meta,28px);font-weight:700;line-height:1.15;overflow-wrap:break-word}
    .legacy-royal-arrival-empty{min-width:0;min-height:0;pointer-events:none}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .legacy-royal-standing-card{display:grid;height:100%;min-height:0;grid-template-rows:auto auto minmax(0,1fr) auto;grid-row-gap:10px;padding:14px 18px;border-color:var(--line);border-radius:24px;background:var(--surface);box-shadow:none}
    .legacy-royal-standing-pinned{display:grid;grid-template-columns:180px minmax(0,1fr);align-items:center;grid-column-gap:14px;color:var(--muted);font-size:16px;font-weight:700;letter-spacing:.06em}
    .legacy-royal-standing-pinned>span{color:var(--accent)}
    .legacy-royal-standing-columns,.legacy-royal-standing-row{display:grid;grid-template-columns:52px minmax(0,1fr) repeat(8,60px) 148px;align-items:center;grid-column-gap:7px}
    .legacy-royal-standing-columns{min-height:34px;padding:0 10px;border-bottom:2px solid var(--accent);color:var(--muted);font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
    .legacy-royal-standing-columns>span,.legacy-royal-standing-row>span,.legacy-royal-standing-row>strong{text-align:center}
    .legacy-royal-standing-columns>span:nth-child(2){text-align:left}
    .legacy-royal-standing-rows{display:grid;grid-auto-rows:minmax(70px,1fr);grid-row-gap:6px;min-height:0;overflow:hidden}
    .legacy-royal-standing-row{height:70px;padding:0 10px;border:1px solid var(--line);border-radius:14px;background:var(--surface);color:var(--ink);font-size:20px;font-weight:700}
    .legacy-royal-standing-rows>.legacy-royal-standing-row{height:auto;min-height:70px}
    .legacy-royal-standing-row.pinned{border-color:var(--own-line);background:var(--own-bg);color:var(--own-ink);box-shadow:inset 7px 0 0 var(--accent)}
    .legacy-royal-standing-row.pinned .legacy-standing-rank,.legacy-royal-standing-row.pinned .legacy-standing-points{color:var(--own-ink)}
    .legacy-royal-standing-row .legacy-standing-team{grid-column:auto}
    .legacy-royal-standing-row .legacy-standing-team i,.legacy-royal-standing-row .legacy-standing-team img{width:36px;height:40px;border-radius:6px;background:var(--accent-soft);color:var(--accent)}
    .legacy-royal-standing-row .legacy-standing-team b{margin-left:12px}
    .legacy-royal-standing-row.pinned .legacy-standing-team i,.legacy-royal-standing-row.pinned .legacy-standing-team img{background:#fff;color:var(--accent)}
    .legacy-royal-standing-row .legacy-standing-team b{font-size:23px;text-transform:none}
    .legacy-royal-standing-row .legacy-standing-form{justify-content:flex-end}
    .legacy-royal-standing-row .legacy-standing-form i+i{margin-left:4px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news{display:grid;height:100%;min-height:0;grid-template-columns:1.15fr 1fr;grid-column-gap:24px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news-art,.dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news-copy{min-width:0;min-height:0;border-color:var(--line);border-radius:24px;background:var(--surface);box-shadow:none}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news-art{align-self:stretch;height:100%;background:var(--deep)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news-art:before{display:none}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news-art>img{object-fit:cover}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news-copy{display:flex;align-items:stretch;justify-content:flex-start;padding:38px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news-copy h2.legacy-royal-news-title{display:-webkit-box;max-width:100%;margin:0;overflow:hidden;color:var(--ink);font-size:var(--rc-news-title-size,40px);font-weight:700;letter-spacing:-.02em;line-height:1.1;text-overflow:clip;text-transform:none;-webkit-box-orient:vertical;-webkit-line-clamp:2}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news-copy h2.legacy-royal-news-title.dense{font-size:var(--rc-news-title-size-dense,36px)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news-copy>p{max-width:100%;margin:0;color:var(--ink);font-size:var(--rc-news-copy-size,34px);line-height:1.4}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news-copy>p{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:7}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news-meta{margin-top:auto;margin-right:218px;padding-top:20px;color:var(--muted)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news-qr{right:38px;bottom:38px;display:block;width:auto;color:transparent;font-size:0}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news-qr img{display:block;width:184px;height:184px;padding:10px;border:1px solid var(--line);border-radius:18px;background:#fff}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news[data-news-variant="fullscreen_gradient"] .editorial-news-art:after{background:linear-gradient(90deg,rgba(var(--matte-rgb),.80) 0%,rgba(var(--matte-rgb),.80) 33.333%,rgba(var(--matte-rgb),.46) 66.667%,rgba(var(--matte-rgb),.08) 100%)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news[data-news-variant="fullscreen_gradient"] .editorial-news-copy{top:0;right:49%;bottom:0;left:0;padding:38px;background:transparent}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news[data-news-variant="fullscreen_gradient"] .editorial-news-copy>p{color:var(--ink)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news[data-news-variant="fullscreen_gradient"] .editorial-news-copy>p{-webkit-line-clamp:8}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news[data-news-variant="fullscreen_gradient"]>.editorial-news-qr{right:92px;bottom:30px;width:auto}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news[data-news-variant="text_only"] .editorial-news-copy{width:100%;padding:48px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news[data-news-variant="text_only"] .editorial-news-copy>p{max-width:1450px;font-size:var(--rc-news-text-size,48px);line-height:1.35}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news[data-news-variant="text_only"] .editorial-news-copy h2.legacy-royal-news-title{font-size:var(--rc-news-title-size-text,54px)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news[data-news-variant="text_only"] .editorial-news-copy h2.legacy-royal-news-title.dense{font-size:var(--rc-news-title-size-text-dense,48px)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news[data-news-variant="text_only"] .editorial-news-copy>p{-webkit-line-clamp:8}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news[data-news-variant="news_grid"]{grid-template-columns:1.05fr 1fr;grid-template-rows:minmax(0,1fr) minmax(0,.5fr);grid-column-gap:20px;grid-row-gap:20px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news[data-news-variant="news_grid"] .editorial-news-art{display:block;grid-row:1/3}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news[data-news-variant="news_grid"] .editorial-news-copy{padding:26px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news[data-news-variant="news_grid"] .editorial-news-copy h2.legacy-royal-news-title{font-size:var(--rc-news-title-size-grid,32px)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news[data-news-variant="news_grid"] .editorial-news-copy h2.legacy-royal-news-title.dense{font-size:var(--rc-news-title-size-grid-dense,29px)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news[data-news-variant="news_grid"] .editorial-news-copy>p{font-size:var(--rc-news-grid-copy-size,27px);line-height:1.3}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news[data-news-variant="news_grid"] .editorial-news-copy>p{-webkit-line-clamp:9}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news[data-news-variant="news_grid"] .editorial-news-qr img{width:124px;height:124px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news-grid{grid-row:2;grid-column:2;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:minmax(0,1fr);grid-column-gap:18px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"] .editorial-news-grid article{padding:18px;border-color:var(--line);border-radius:18px;background:var(--surface);box-shadow:none}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"][data-motion-state="off"] .legacy-fixture-row,.dynamic-template.editorial-arena[data-design-revision="royal-current-v8"][data-motion-state="off"] .legacy-result-row,.dynamic-template.editorial-arena[data-design-revision="royal-current-v8"][data-motion-state="off"] .legacy-arrival-card,.dynamic-template.editorial-arena[data-design-revision="royal-current-v8"][data-motion-state="off"] .editorial-news-art,.dynamic-template.editorial-arena[data-design-revision="royal-current-v8"][data-motion-state="off"] .editorial-news-copy{animation:none!important;opacity:1;transform:none}
    .dynamic-template.ledscores-live-match[data-design-revision="royal-current-v8"]{background:var(--bg);color:var(--ink);font-family:var(--vc-theme-body-font,"VeyoCast Royal Current Roboto"),Roboto,Arial,sans-serif}
    .ledscores-live-match[data-design-revision="royal-current-v8"] .live-match-shell{position:absolute;display:grid;grid-template-rows:80px minmax(148px,auto) minmax(0,1fr);grid-row-gap:20px;padding:32px 64px 76px 150px;background:linear-gradient(135deg,var(--canvas-start),var(--canvas-end));box-shadow:none}
    .ledscores-live-match[data-design-revision="royal-current-v8"] .legacy-royal-flow{position:absolute;z-index:0;top:0;right:0;bottom:0;left:0;overflow:hidden;pointer-events:none}
    .ledscores-live-match[data-design-revision="royal-current-v8"] .legacy-royal-sideband{z-index:3}
    .ledscores-live-match[data-design-revision="royal-current-v8"] .legacy-royal-masthead{position:relative;z-index:2;display:flex;min-width:0;min-height:0;align-items:center;justify-content:space-between;padding:0 32px;border:1px solid var(--line);border-radius:20px;background:var(--surface);box-shadow:0 14px 34px var(--vc-shadow)}
    .ledscores-live-match[data-design-revision="royal-current-v8"] .live-match-top{position:relative;z-index:2;min-width:0;min-height:148px;padding:20px 32px;border:1px solid var(--line);border-radius:24px;background:var(--surface);box-shadow:0 12px 30px var(--vc-shadow)}
    .ledscores-live-match[data-design-revision="royal-current-v8"] .live-match-top p{color:var(--accent);font-size:17px}
    .ledscores-live-match[data-design-revision="royal-current-v8"] .live-match-top h1{margin-top:7px;color:var(--ink);font-family:var(--vc-theme-display-font,"VeyoCast Royal Current Roboto"),Roboto,Arial,sans-serif;font-size:var(--rc-title-size,62px);line-height:1.04}
    .ledscores-live-match[data-design-revision="royal-current-v8"] .live-match-status{border-color:var(--line);background:var(--accent-soft);color:var(--accent)}
    .ledscores-live-match[data-design-revision="royal-current-v8"] .live-match-body{position:relative;z-index:2;min-width:0;min-height:0;color:var(--ink)}
    .ledscores-live-match[data-design-revision="royal-current-v8"] .live-match-body .match-scoreboard{border-color:var(--line);background:var(--surface);box-shadow:0 8px 20px var(--vc-shadow)}
    .ledscores-live-match[data-design-revision="royal-current-v8"] .live-match-timeline{border-color:var(--line)}
    .ledscores-live-match[data-design-revision="royal-current-v8"] .live-match-timeline li{border-color:var(--line)}
    .ledscores-live-match[data-design-revision="royal-current-v8"] .live-match-footer{position:absolute;z-index:4;right:64px;bottom:22px;left:150px;height:34px;padding:0;border:0;color:var(--muted);font-size:14px;letter-spacing:.06em;text-transform:uppercase}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait{grid-template-rows:96px minmax(192px,auto) minmax(0,1fr);grid-row-gap:24px;padding:36px 38px 84px 101px!important}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-royal-sideband{width:72px;padding:30px 10px 28px;font-size:11px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-royal-sideband b{font-size:29px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait>.legacy-royal-masthead{padding:0 23px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-royal-masthead-club strong{font-size:20px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-royal-masthead-right{font-size:10px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-royal-masthead-right>*+*{margin-left:12px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-royal-masthead-right time{font-size:16px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait>header{min-height:192px;grid-template-columns:104px minmax(0,1fr) 110px;grid-column-gap:18px;padding:26px!important}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .editorial-heading h1{font-size:var(--rc-title-size-portrait,54px)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-royal-subtitle{font-size:var(--rc-subtitle-size-portrait,24px)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-royal-title-stat strong{font-size:45px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-royal-title-stat span{font-size:10px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait>footer{right:38px!important;bottom:24px!important;left:101px!important;height:40px!important;font-size:var(--rc-footer-size,14px)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-cancelled-kickoff{font-size:var(--rc-cancelled-size-portrait,20px)!important}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-fixture-list,.dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-result-list{grid-auto-rows:var(--sport-list-row-height,148px)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-fixture-row,.dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-result-row{height:var(--sport-list-row-height,148px);min-height:var(--sport-list-row-height,148px)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-fixture-row{font-size:var(--rc-program-row-size-portrait,24px)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-result-row{font-size:var(--rc-result-row-size-portrait,29px)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-royal-arrival-grid[data-slots]{grid-template-columns:minmax(0,1fr);grid-column-gap:24px;grid-row-gap:24px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-royal-arrival-grid[data-slots="1"]{grid-template-rows:minmax(0,1fr)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-royal-arrival-grid[data-slots="2"]{grid-template-rows:repeat(2,minmax(0,1fr))}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-royal-arrival-grid[data-slots="3"]{grid-template-rows:repeat(3,minmax(0,1fr))}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-royal-arrival-info{margin-top:18px;padding-top:14px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-royal-standing-pinned{grid-template-columns:150px minmax(0,1fr);font-size:14px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-royal-standing-columns,.dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-royal-standing-row{grid-template-columns:42px minmax(0,1fr) repeat(8,41px) 118px;grid-column-gap:4px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-royal-standing-row{height:102px;font-size:18px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-royal-standing-row .legacy-standing-team b{font-size:20px;white-space:normal;line-height:1.05}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .legacy-royal-standing-row .legacy-standing-form i{width:24px;height:24px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .editorial-news{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,.8fr) minmax(0,1.2fr);grid-row-gap:32px;padding:0 20px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .editorial-news-copy{padding:34px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .editorial-news-copy h2.legacy-royal-news-title{font-size:var(--rc-news-title-size-portrait,40px)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .editorial-news-copy h2.legacy-royal-news-title.dense{font-size:var(--rc-news-title-size-dense,36px)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .editorial-news-copy>p{font-size:var(--rc-news-copy-size-portrait,34px)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .editorial-news-meta{margin-right:210px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .editorial-news-qr{right:34px;bottom:34px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .editorial-news-qr img{width:180px;height:180px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .editorial-news[data-news-variant="fullscreen_gradient"]{display:block;padding:0}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .editorial-news[data-news-variant="fullscreen_gradient"] .editorial-news-copy{top:38%;right:0;bottom:0;left:0}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .editorial-news[data-news-variant="fullscreen_gradient"]>.editorial-news-qr{right:61px;bottom:61px}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .editorial-news[data-news-variant="fullscreen_gradient"] .editorial-news-art:after{background:linear-gradient(180deg,rgba(var(--matte-rgb),.08) 0%,rgba(var(--matte-rgb),.08) 28%,rgba(var(--matte-rgb),.46) 40%,rgba(var(--matte-rgb),.80) 50%,rgba(var(--matte-rgb),.80) 100%)}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .editorial-news[data-news-variant="news_grid"]{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1.25fr) minmax(0,.75fr);padding:0}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .editorial-news[data-news-variant="news_grid"] .editorial-news-art{display:none}
    .dynamic-template.editorial-arena[data-design-revision="royal-current-v8"].portrait .editorial-news-grid{grid-row:2;grid-column:1}
    .dynamic-template.editorial-arena .legacy-birthday-layout{display:grid;width:100%;height:100%;min-height:0;gap:24px;grid-template-columns:repeat(2,minmax(0,1fr));align-content:stretch}
    .dynamic-template.editorial-arena .legacy-birthday-layout[data-page-size="1"]{grid-template-columns:minmax(0,.68fr);justify-content:center}
    .dynamic-template.editorial-arena .legacy-birthday-layout[data-page-size="2"]{grid-template-columns:repeat(2,minmax(0,1fr))}
    .dynamic-template.editorial-arena .legacy-birthday-layout[data-page-size="4"]{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr))}
    .dynamic-template.editorial-arena .legacy-birthday-layout[data-page-size="6"]{grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr))}
    .legacy-birthday-card{position:relative;isolation:isolate;display:flex;min-width:0;min-height:0;align-items:center;justify-content:center;overflow:hidden;border:1px solid var(--editorial-border);border-radius:24px;background:var(--editorial-surface);box-shadow:0 24px 80px var(--editorial-shadow);text-align:center}
    .legacy-birthday-photo{position:absolute;z-index:-2;top:0;right:0;bottom:0;left:0;background-image:linear-gradient(135deg,var(--editorial-accent-soft),transparent 65%),linear-gradient(180deg,var(--editorial-surface-alt),var(--editorial-surface));background-position:center;background-size:cover;opacity:.34;transform:scale(1.04)}
    .legacy-birthday-photo:after{position:absolute;top:0;right:0;bottom:0;left:0;background:rgba(255,255,255,.78);content:""}
    .dynamic-template.editorial-arena.dark .legacy-birthday-photo:after{background:rgba(7,10,14,.78)}
    .legacy-birthday-copy{position:relative;z-index:1;display:flex;min-width:0;max-width:94%;align-items:center;flex-direction:column;justify-content:center;padding:4%;color:var(--editorial-text)}
    .legacy-birthday-copy b{color:var(--accent);font-size:clamp(16px,1.2vw,26px);font-weight:900;letter-spacing:.16em;line-height:1.1;text-transform:uppercase}
    .legacy-birthday-copy h2{max-width:100%;margin:14px 0 6px;overflow-wrap:anywhere;color:var(--ink);font-family:var(--vc-theme-display-font,"VeyoCast Royal Current Roboto"),Roboto,Arial,sans-serif;font-size:clamp(30px,3.1vw,74px);font-weight:900;letter-spacing:-.055em;line-height:.94}
    .legacy-birthday-copy p{max-width:100%;margin:0;color:var(--editorial-muted);font-size:clamp(16px,1.25vw,28px);font-weight:700;line-height:1.2;overflow-wrap:anywhere}
    .legacy-birthday-copy strong{max-width:100%;margin-top:13px;color:var(--accent);font-size:clamp(16px,1.3vw,29px);font-weight:900;line-height:1.15;overflow-wrap:anywhere}
    .legacy-birthday-card[data-emphasize-today]{border:3px solid var(--accent);box-shadow:inset 0 0 0 2px var(--editorial-surface),0 16px 42px var(--editorial-shadow)}
    .dynamic-template.editorial-arena .legacy-birthday-layout[data-page-size="6"] .legacy-birthday-copy b{font-size:clamp(13px,1vw,20px)}
    .dynamic-template.editorial-arena .legacy-birthday-layout[data-page-size="6"] .legacy-birthday-copy h2{font-size:clamp(24px,2.4vw,52px);margin-top:10px}
    .dynamic-template.editorial-arena .legacy-birthday-layout[data-page-size="6"] .legacy-birthday-copy p,.dynamic-template.editorial-arena .legacy-birthday-layout[data-page-size="6"] .legacy-birthday-copy strong{font-size:clamp(13px,1vw,21px)}
    .dynamic-template.editorial-arena.portrait .legacy-birthday-layout{grid-template-columns:1fr;grid-template-rows:repeat(2,minmax(0,1fr));gap:20px}
    .dynamic-template.editorial-arena.portrait .legacy-birthday-layout[data-page-size="1"]{grid-template-rows:minmax(0,.7fr);grid-template-columns:minmax(0,1fr)}
    .dynamic-template.editorial-arena.portrait .legacy-birthday-layout[data-page-size="4"]{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr))}
    .dynamic-template.editorial-arena.portrait .legacy-birthday-layout[data-page-size="6"]{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr))}
    .dynamic-template.editorial-arena.portrait .legacy-birthday-copy h2{font-size:clamp(28px,5vw,54px);overflow-wrap:break-word;text-wrap:pretty}
    .dynamic-template.editorial-arena.portrait .legacy-birthday-layout[data-page-size="1"] .legacy-birthday-copy h2{font-size:clamp(42px,8vw,90px)}
    .dynamic-template.editorial-arena.portrait .legacy-birthday-layout[data-page-size="2"] .legacy-birthday-copy h2{font-size:clamp(30px,6vw,68px)}
    .dynamic-template.editorial-arena.portrait .legacy-birthday-layout[data-page-size="4"] .legacy-birthday-copy h2{font-size:clamp(26px,5vw,50px)}
    .dynamic-template.editorial-arena.portrait .legacy-birthday-layout[data-page-size="6"] .legacy-birthday-copy h2{font-size:clamp(22px,3.4vw,42px)}
    @media(prefers-reduced-motion:reduce){.legacy-birthday-card{animation:none!important}}
    .dynamic-template.ledscores-live-match[data-design-revision="royal-current-v8"].portrait .live-match-shell{grid-template-rows:96px minmax(192px,auto) minmax(0,1fr);grid-row-gap:24px;padding:36px 38px 84px 101px}
    .ledscores-live-match[data-design-revision="royal-current-v8"].portrait .legacy-royal-sideband{width:72px;padding:30px 10px 28px;font-size:11px}
    .ledscores-live-match[data-design-revision="royal-current-v8"].portrait .legacy-royal-sideband b{font-size:29px}
    .ledscores-live-match[data-design-revision="royal-current-v8"].portrait .legacy-royal-masthead{padding:0 23px}
    .ledscores-live-match[data-design-revision="royal-current-v8"].portrait .live-match-top{min-height:192px;padding:26px}
    .ledscores-live-match[data-design-revision="royal-current-v8"].portrait .live-match-top h1{font-size:var(--rc-title-size-portrait,54px)}
    .ledscores-live-match[data-design-revision="royal-current-v8"].portrait .live-match-footer{right:38px;bottom:24px;left:101px;height:40px;font-size:14px}
    @media(max-height:650px){.panel{padding:24px}.logo{width:210px;margin-bottom:24px}#detail{margin-top:14px}#pairing{margin-top:18px}}
  ${legacyGoalOverlayCss}
  </style>
</head>
<body>
  <main id="media-root" aria-label="VeyoCast afspeeloppervlak"></main>
  <section id="goal-overlay" aria-live="assertive" hidden></section>
  <img id="watermark" src="/brand/veyocast-logo-inverse.svg" alt="">
  <div id="offline" role="status">Offline · lokale release</div>
  <section id="status" aria-live="polite">
    <div class="panel">
      <img class="logo" src="/brand/veyocast-logo-inverse.svg" alt="VeyoCast">
      <p class="kicker" id="kicker">LG Legacy Player</p>
      <h1 id="title">Player starten</h1>
      <p id="detail">De eenvoudige LG-runtime controleert de installatie en de laatste geldige release.</p>
      <div id="pairing">
        <p class="kicker">Koppelcode</p>
        <div id="pairing-code"></div>
      </div>
      <p id="error-code"></p>
      <pre id="diagnostics"></pre>
    </div>
  </section>
  <section id="default-waiting" aria-label="VeyoCast player gereed" hidden>
    <div class="default-waiting-card">
      <time class="default-waiting-clock" id="default-waiting-clock"></time>
      <div class="default-waiting-content">
        <p class="default-waiting-tenant" id="default-waiting-tenant"></p>
        <h1 id="default-waiting-title">Wachten op content</h1>
        <p class="default-waiting-welcome" id="default-waiting-welcome"></p>
        <img class="default-waiting-tenant-logo" id="default-waiting-tenant-logo" alt="">
        <img class="default-waiting-veyocast-logo" id="default-waiting-veyocast-logo" src="/brand/veyocast-logo-primary.svg" alt="VeyoCast">
        <p class="default-waiting-payoff">Narrowcasting voor sportverenigingen!</p>
      </div>
      <footer class="default-waiting-footer">
        <span>VEYOCAST · VOORBEELD</span>
        <span id="default-waiting-sportpark"></span>
      </footer>
    </div>
  </section>
  <script>
  (function () {
    "use strict";
    var CONFIG = ${config};
    var playerMediaTraffic = (${createMediaTraffic.toString()})();
    var downloadMedia = (${createMediaDownloader.toString()})(legacyMediaRequest, playerMediaTraffic);
    function legacyMediaRequest(url, options, maximumBytes) {
      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        function abort() { xhr.abort(); }
        function cleanup() { if (options.signal) options.signal.removeEventListener("abort", abort); }
        xhr.open("GET", url, true);
        xhr.responseType = "arraybuffer";
        xhr.timeout = CONFIG.assetRequestTimeoutMs;
        xhr.onprogress = function (event) {
          if (event.loaded > maximumBytes || event.total > maximumBytes) {
            cleanup(); reject(new Error("ASSET_TOO_LARGE")); xhr.abort();
          }
        };
        xhr.onload = function () {
          cleanup();
          if (xhr.status < 200 || xhr.status > 599) { reject(new Error("LEGACY_ASSET_HTTP_ERROR")); return; }
          try {
          resolve(new Response(xhr.response, { status: xhr.status, headers: {
            "Content-Type": xhr.getResponseHeader("Content-Type") || "application/octet-stream",
            "Content-Length": String(xhr.response ? xhr.response.byteLength : 0),
            "Retry-After": xhr.getResponseHeader("Retry-After") || ""
          } }));
          } catch (error) { reject(new Error("LEGACY_ASSET_HTTP_ERROR")); }
        };
        xhr.onerror = xhr.ontimeout = xhr.onabort = function () { cleanup(); reject(new Error("LEGACY_ASSET_NETWORK_ERROR")); };
        if (options.signal) options.signal.addEventListener("abort", abort, { once: true });
        xhr.send();
      });
    }
    ${legacyGoalOverlayScript()}
    var sportMatchBelongsOnSlide = ${sportMatchBelongsOnSlide.toString()};
    var startBirthdayConfetti = ${startBirthdayConfetti.toString()};
    var birthdayCalendarDay = ${birthdayCalendarDay.toString()};
    var resolveSportListLayout = ${resolveSportListLayout.toString()};
    var runtime = {
      activeIndex: 0,
      activationInFlight: false,
      applicationReloadPending: false,
      bootGeneration: 0,
      cachedRelease: null,
      currentElement: null,
      currentItem: null,
      currentObjectUrls: [],
      defaultWaitingTimer: null,
      deviceToken: null,
      envelope: null,
      forceManifestRefresh: false,
      goalAckFlushTimer: null,
      goalAckInFlight: false,
      goalAckRetryAttempts: {},
      goalActivationTimer: null,
      goalQueue: [],
      goalQueueDraining: false,
      goalV2Cleanup: null,
      goalV2Redraw: null,
      goalActiveEventId: null,
      goalActiveKind: null,
      goalActiveModel: null,
      goalExpiryTimer: null,
      goalEnrichmentSequences: {},
      goalLineupPageIndex: 0,
      goalLineupPageTimer: null,
      goalPauseApplied: false,
      goalPausedVideo: null,
      goalPendingDeliveryId: null,
      goalPendingEventId: null,
      goalPendingExpiresAt: null,
      goalPendingEnrichment: null,
      goalPendingKind: null,
      goalPendingToken: null,
      goalReconnectAttempt: 0,
      goalReconnectTimer: null,
      goalStreamBuffer: "",
      goalStreamGeneration: 0,
      goalStreamOffset: 0,
      goalStreamWatchdogTimer: null,
      goalStreamWatchdogXhr: null,
      goalStreamXhr: null,
      installationCredential: null,
      installationId: null,
      itemFailures: {},
      lastClockSkewLoggedAt: 0,
      lastGoalDisabledLoggedAt: 0,
      lastProgressAt: 0,
      ledScoresLiveMatchRender: null,
      matchCentreClockTimer: null,
      ledScoresLiveMatchTimer: null,
      ledScoresMatchStates: {},
      offline: false,
      pendingElement: null,
      pendingObjectUrls: [],
      pendingRelease: null,
      targetKey: null,
      manifestEtag: null,
      manifestRequest: null,
      invalidatedDuringFetch: false,
      heartbeatInFlight: false,
      heartbeatPending: false,
      publicationTrace: null,
      preparationError: null,
      signalReceivedAt: null,
      boundaryMonotonic: null,
      targetRevision: null,
      targetScreenId: null,
      targetGeneration: 0,
      preparingGeneration: null,
      preparationXhr: null,
      activationTransaction: null,
      presentedReleaseId: null,
      publicationPass: null,
      playbackDeadlineAt: 0,
      playbackGeneration: 0,
      playbackRemainingMs: null,
      playbackTimer: null,
      progressTimer: null,
      releaseSource: "online",
      retryTimer: null,
      state: "BOOTING",
      syncInFlight: false,
      syncFailures: 0,
      syncPhase: null,
      templateDeadlineAt: 0,
      templateRemainingMs: null,
      templateResumeCallback: null,
      templateTimer: null,
      watchdogTimer: null
    };
    var definitiveCredentialCodes = {
      BINDING_EXPIRED: true,
      DEVICE_REVOKED: true,
      INSTALLATION_NOT_FOUND: true,
      INVALID_DEVICE_TOKEN: true
    };

    function byId(id) { return document.getElementById(id); }
    function now() { return new Date().getTime(); }
    function monotonicNow() { return window.performance && window.performance.now ? window.performance.now() : now(); }
    function safeRead(key) {
      try { return window.localStorage.getItem(key); } catch (error) { return null; }
    }
    function safeWrite(key, value) {
      try { window.localStorage.setItem(key, value); return true; } catch (error) { return false; }
    }
    function safeRemove(key) {
      try { window.localStorage.removeItem(key); } catch (error) {}
    }
    function validCredential(value) {
      return typeof value === "string" && /^[A-Za-z0-9_-]{20,200}$/.test(value);
    }
    function validIdentifier(value) {
      return typeof value === "string" && /^[a-f0-9-]{20,80}$/.test(value);
    }
    function parseJson(value) {
      try { return JSON.parse(value || "null"); } catch (error) { return null; }
    }
    function parsePlayerTimestamp(value) {
      var normalized = String(value || "")
        .replace(/(\\.\\d{3})\\d+(?=(?:z|[+-]\\d{2}:?\\d{2})$)/i, "$1")
        .replace(/\\+00:00$/, "Z");
      var timestamp = new Date(normalized).getTime();
      return isFinite(timestamp) ? timestamp : null;
    }
    function errorCode(body, fallback) {
      return body && body.error && typeof body.error.code === "string"
        ? body.error.code
        : fallback;
    }
    function errorCause(body, fallback) {
      return body && body.error && typeof body.error.cause === "string"
        ? body.error.cause
        : fallback;
    }
    function setText(id, value) { byId(id).textContent = value || ""; }
    function log(code, detail) {
      var entries = parseJson(safeRead(CONFIG.legacyDiagnosticsKey));
      if (!Array.isArray(entries)) entries = [];
      entries.push({
        at: new Date().toISOString(),
        code: String(code || "LEGACY_EVENT").slice(0, 80),
        detail: String(detail || "").slice(0, 240)
      });
      if (entries.length > 12) entries = entries.slice(entries.length - 12);
      safeWrite(CONFIG.legacyDiagnosticsKey, JSON.stringify(entries));
      setText("diagnostics", entries.slice(-3).map(function (entry) {
        return entry.at.slice(11, 19) + " · " + entry.code + " · " + entry.detail;
      }).join("\\n"));
    }
    function showStatus(kicker, title, detail, code) {
      hideDefaultWaiting();
      byId("status").hidden = false;
      byId("watermark").className = "";
      setText("kicker", kicker);
      setText("title", title);
      setText("detail", detail);
      setText("error-code", code ? "Foutcode: " + code : "");
    }
    function hideDefaultWaiting() {
      byId("default-waiting").hidden = true;
      window.clearTimeout(runtime.defaultWaitingTimer);
      runtime.defaultWaitingTimer = null;
    }
    function formatDefaultWaitingClock(value, timezone) {
      try {
        return new Intl.DateTimeFormat("nl-NL", {
          day: "2-digit", hour: "2-digit", hour12: false, minute: "2-digit",
          month: "2-digit", timeZone: timezone, year: "numeric"
        }).format(value).replace(", ", " | ");
      } catch (error) {
        return new Intl.DateTimeFormat("nl-NL", {
          day: "2-digit", hour: "2-digit", hour12: false, minute: "2-digit",
          month: "2-digit", year: "numeric"
        }).format(value).replace(", ", " | ");
      }
    }
    function showDefaultWaiting(envelope) {
      var branding = envelope && envelope.branding || {};
      var tenantName = String(branding.tenantName || "VeyoCast").trim() || "VeyoCast";
      var sportparkName = String(branding.sportparkName || "ons sportpark").trim() || "ons sportpark";
      var timezone = String(branding.timezone || "Europe/Amsterdam");
      var theme = branding.themeMode === "light" ? "light" : "dark";
      var logo = typeof branding.tenantLogoUrl === "string" &&
        /^(https?:|[/])/i.test(branding.tenantLogoUrl)
        ? branding.tenantLogoUrl : "";
      byId("status").hidden = true;
      byId("default-waiting").hidden = false;
      byId("default-waiting").setAttribute("data-theme", theme);
      setText("default-waiting-tenant", tenantName);
      setText("default-waiting-title", "Wachten op content");
      setText("default-waiting-welcome", "Welkom op " + sportparkName + "!");
      setText("default-waiting-sportpark", sportparkName);
      var tenantLogo = byId("default-waiting-tenant-logo");
      if (logo) {
        tenantLogo.src = logo;
        tenantLogo.alt = "Logo " + tenantName;
        tenantLogo.hidden = false;
      } else {
        tenantLogo.removeAttribute("src");
        tenantLogo.alt = "";
        tenantLogo.hidden = true;
      }
      byId("default-waiting-veyocast-logo").src = theme === "light"
        ? "/brand/veyocast-logo-primary.svg" : "/brand/veyocast-logo-inverse.svg";
      var updateClock = function () {
        setText("default-waiting-clock", formatDefaultWaitingClock(new Date(), timezone));
        runtime.defaultWaitingTimer = window.setTimeout(updateClock, 60000 - (now() % 60000) + 100);
      };
      updateClock();
    }
    function showPairing(code, detail) {
      showStatus(
        "Klaar om te koppelen",
        "Koppel dit scherm aan VeyoCast",
        detail || "Open Schermen in VeyoCast Control en voer deze tijdelijke code in.",
        ""
      );
      byId("pairing").className = "visible";
      setText("pairing-code", code);
    }
    function hidePairing() {
      byId("pairing").className = "";
      setText("pairing-code", "");
    }
    function setState(state) {
      runtime.state = state;
    }
    function notifyLgWrapperReady() {
      if (window.parent === window || !window.parent.postMessage) return;
      try {
        window.parent.postMessage({
          path: "/lg",
          protocolVersion: 1,
          type: "VEYOCAST_LG_PLAYER_READY"
        }, "*");
      } catch (error) {
        log("LEGACY_WRAPPER_READY_FAILED", String(error && error.message || error));
      }
    }
    function request(method, path, headers, body, callback) {
      var xhr = new XMLHttpRequest();
      var key;
      var completed = false;
      xhr.open(method, path, true);
      xhr.timeout = CONFIG.requestTimeoutMs;
      xhr.setRequestHeader("Accept", "application/json");
      for (key in headers) {
        if (Object.prototype.hasOwnProperty.call(headers, key) && headers[key]) {
          xhr.setRequestHeader(key, headers[key]);
        }
      }
      function finish(transportCode) {
        var responseBody;
        if (completed) return;
        completed = true;
        responseBody = parseJson(xhr.responseText);
        log(
          transportCode || "HTTP_" + String(xhr.status),
          method + " " + path
        );
        callback(
          transportCode,
          xhr.status || 0,
          responseBody,
          xhr.getResponseHeader("Retry-After"),
          xhr.getResponseHeader("X-VeyoCast-Player-Version"),
          xhr.getResponseHeader("ETag")
        );
      }
      xhr.onload = function () { finish(null); };
      xhr.onerror = function () { finish("NETWORK_ERROR"); };
      xhr.ontimeout = function () { finish("TIMEOUT"); };
      xhr.onabort = function () { finish("ABORTED"); };
      try { xhr.send(body || null); } catch (error) { finish("XHR_EXCEPTION"); }
      // abort() need not dispatch an abort event after readyState DONE, while
      // the load callback can still be pending. Always settle our own lock.
      return { abort: function () { try { xhr.abort(); } finally { finish("ABORTED"); } } };
    }
    function goalUuid(value) {
      return typeof value === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
        ? value
        : null;
    }
    function goalOptionalUuid(value) {
      return value === null || typeof value === "undefined" || value === ""
        ? null
        : goalUuid(value);
    }
    function goalRecord(value) {
      return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
    }
    function goalInteger(value, minimum, maximum) {
      var number = Number(value);
      return isFinite(number) && Math.floor(number) === number &&
        number >= minimum && number <= maximum
        ? number
        : null;
    }
    function goalText(value, maximum) {
      var normalized;
      if (typeof value !== "string" || value.length > maximum) return null;
      normalized = value.replace(/\\s+/g, " ").replace(/^\\s+|\\s+$/g, "");
      return normalized || null;
    }
    function goalSafeUrl(value) {
      return typeof value === "string" && value.length <= 2000 &&
        /^https?:\\/\\//.test(value)
        ? value
        : null;
    }
    function goalCanvasHasOnlyKeys(record, allowed) {
      var key;
      if (!record) return false;
      for (key in record) {
        if (Object.prototype.hasOwnProperty.call(record, key) &&
          allowed.indexOf(key) === -1) return false;
      }
      return true;
    }
    function goalCanvasNumber(value, minimum, maximum, integer) {
      return typeof value === "number" && isFinite(value) &&
        (!integer || Math.floor(value) === value) &&
        value >= minimum && value <= maximum
        ? value
        : null;
    }
    function goalCanvasBoolean(value, fallback) {
      if (typeof value === "undefined") return fallback;
      return typeof value === "boolean" ? value : null;
    }
    function goalCanvasColor(value) {
      return typeof value === "string" &&
        /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)
        ? value
        : null;
    }
    function goalCanvasTrimmedText(value, minimum, maximum) {
      var normalized;
      if (typeof value !== "string") return null;
      normalized = value.replace(/^\\s+|\\s+$/g, "");
      return normalized.length >= minimum && normalized.length <= maximum
        ? normalized
        : null;
    }
    function parseGoalCanvasLayerBase(record) {
      var animation = typeof record.animation === "undefined"
        ? "none"
        : ["none", "fade", "rise", "zoom", "wipe"]
          .indexOf(record.animation) !== -1 ? record.animation : null;
      var height = goalCanvasNumber(record.height, 8, 3840, false);
      var id = typeof record.id === "string" &&
        /^[a-z][a-z0-9-]{0,63}$/.test(record.id) ? record.id : null;
      var locked = goalCanvasBoolean(record.locked, false);
      var name = goalCanvasTrimmedText(record.name, 1, 80);
      var opacity = typeof record.opacity === "undefined"
        ? 1
        : goalCanvasNumber(record.opacity, 0, 1, false);
      var rotation = typeof record.rotation === "undefined"
        ? 0
        : goalCanvasNumber(record.rotation, -180, 180, false);
      var visible = goalCanvasBoolean(record.visible, true);
      var width = goalCanvasNumber(record.width, 8, 3840, false);
      var x = goalCanvasNumber(record.x, -1920, 3840, false);
      var y = goalCanvasNumber(record.y, -1920, 3840, false);
      var zIndex = goalCanvasNumber(record.zIndex, 0, 15, true);
      if (!animation || height === null || !id || locked === null || !name ||
        opacity === null || rotation === null || visible === null ||
        width === null || x === null || y === null || zIndex === null) return null;
      return {
        animation: animation,
        height: height,
        id: id,
        locked: locked,
        name: name,
        opacity: opacity,
        rotation: rotation,
        visible: visible,
        width: width,
        x: x,
        y: y,
        zIndex: zIndex
      };
    }
    function parseGoalCanvasTextLayer(record) {
      var base;
      var align;
      var backgroundColor;
      var binding;
      var cornerRadius;
      var letterSpacing;
      var lineHeight;
      var padding;
      var verticalAlign;
      if (!goalCanvasHasOnlyKeys(record, [
        "align", "animation", "backgroundColor", "binding", "cornerRadius",
        "fill", "fontFamily", "fontSize", "fontWeight", "height", "id",
        "letterSpacing", "lineHeight", "locked", "name", "opacity", "padding",
        "rotation", "text", "type", "verticalAlign", "visible", "width", "x",
        "y", "zIndex"
      ])) return null;
      base = parseGoalCanvasLayerBase(record);
      align = typeof record.align === "undefined" ? "left" :
        ["left", "center", "right"].indexOf(record.align) !== -1
          ? record.align : null;
      backgroundColor = typeof record.backgroundColor === "undefined"
        ? null : record.backgroundColor;
      binding = typeof record.binding === "undefined" ? null : record.binding;
      cornerRadius = typeof record.cornerRadius === "undefined" ? 0 :
        goalCanvasNumber(record.cornerRadius, 0, 240, false);
      letterSpacing = typeof record.letterSpacing === "undefined" ? 0 :
        goalCanvasNumber(record.letterSpacing, -10, 40, false);
      lineHeight = typeof record.lineHeight === "undefined" ? 1 :
        goalCanvasNumber(record.lineHeight, 0.8, 2, false);
      padding = typeof record.padding === "undefined" ? 0 :
        goalCanvasNumber(record.padding, 0, 160, false);
      verticalAlign = typeof record.verticalAlign === "undefined" ? "middle" :
        ["top", "middle", "bottom"].indexOf(record.verticalAlign) !== -1
          ? record.verticalAlign : null;
      if (!base || !align ||
        !(backgroundColor === null || goalCanvasColor(backgroundColor)) ||
        !(binding === null || [
          "headline", "secondaryText", "homeTeam", "awayTeam", "homeScore",
          "awayScore", "score", "previousScore", "clock", "period",
          "scoringTeam", "scorerName", "scorerNumber", "eventLabel"
        ].indexOf(binding) !== -1) || cornerRadius === null ||
        !goalCanvasColor(record.fill) ||
        ["Inter", "Inter Tight"].indexOf(record.fontFamily) === -1 ||
        goalCanvasNumber(record.fontSize, 16, 360, false) === null ||
        [400, 500, 600, 700, 800, 900].indexOf(record.fontWeight) === -1 ||
        letterSpacing === null || lineHeight === null || padding === null ||
        typeof record.text !== "string" || record.text.length > 240 ||
        !verticalAlign || (binding === null &&
          record.text.replace(/^\\s+|\\s+$/g, "") === "")) return null;
      base.align = align;
      base.backgroundColor = backgroundColor;
      base.binding = binding;
      base.cornerRadius = cornerRadius;
      base.fill = record.fill;
      base.fontFamily = record.fontFamily;
      base.fontSize = record.fontSize;
      base.fontWeight = record.fontWeight;
      base.letterSpacing = letterSpacing;
      base.lineHeight = lineHeight;
      base.padding = padding;
      base.text = record.text;
      base.type = "text";
      base.verticalAlign = verticalAlign;
      return base;
    }
    function parseGoalCanvasImageLayer(record) {
      var base;
      var binding = typeof record.binding === "undefined" ? null : record.binding;
      var mediaAssetId = typeof record.mediaAssetId === "undefined"
        ? null : record.mediaAssetId;
      var cornerRadius = typeof record.cornerRadius === "undefined" ? 0 :
        goalCanvasNumber(record.cornerRadius, 0, 960, false);
      var focusX = typeof record.focusX === "undefined" ? 0.5 :
        goalCanvasNumber(record.focusX, 0, 1, false);
      var focusY = typeof record.focusY === "undefined" ? 0.5 :
        goalCanvasNumber(record.focusY, 0, 1, false);
      var objectFit = typeof record.objectFit === "undefined" ? "cover" :
        ["cover", "contain"].indexOf(record.objectFit) !== -1
          ? record.objectFit : null;
      if (!goalCanvasHasOnlyKeys(record, [
        "animation", "binding", "cornerRadius", "focusX", "focusY", "height",
        "id", "locked", "mediaAssetId", "name", "objectFit", "opacity",
        "rotation", "type", "visible", "width", "x", "y", "zIndex"
      ])) return null;
      base = parseGoalCanvasLayerBase(record);
      if (!base || !(binding === null || [
        "scorerPhoto", "homeLogo", "awayLogo", "scoringTeamLogo"
      ].indexOf(binding) !== -1) ||
        !(mediaAssetId === null || goalUuid(mediaAssetId)) ||
        cornerRadius === null || focusX === null || focusY === null || !objectFit ||
        (!binding && !mediaAssetId) || (binding && mediaAssetId)) return null;
      base.binding = binding;
      base.cornerRadius = cornerRadius;
      base.focusX = focusX;
      base.focusY = focusY;
      base.mediaAssetId = mediaAssetId;
      base.objectFit = objectFit;
      base.type = "image";
      return base;
    }
    function parseGoalCanvasShapeLayer(record) {
      var base;
      var cornerRadius = typeof record.cornerRadius === "undefined" ? 0 :
        goalCanvasNumber(record.cornerRadius, 0, 960, false);
      var stroke = typeof record.stroke === "undefined" ? null : record.stroke;
      var strokeWidth = typeof record.strokeWidth === "undefined" ? 0 :
        goalCanvasNumber(record.strokeWidth, 0, 32, false);
      if (!goalCanvasHasOnlyKeys(record, [
        "animation", "cornerRadius", "fill", "height", "id", "locked", "name",
        "opacity", "rotation", "shape", "stroke", "strokeWidth", "type",
        "visible", "width", "x", "y", "zIndex"
      ])) return null;
      base = parseGoalCanvasLayerBase(record);
      if (!base || cornerRadius === null || !goalCanvasColor(record.fill) ||
        ["rectangle", "ellipse", "line"].indexOf(record.shape) === -1 ||
        !(stroke === null || goalCanvasColor(stroke)) || strokeWidth === null) {
        return null;
      }
      base.cornerRadius = cornerRadius;
      base.fill = record.fill;
      base.shape = record.shape;
      base.stroke = stroke;
      base.strokeWidth = strokeWidth;
      base.type = "shape";
      return base;
    }
    function parseGoalCanvasLineupLayer(record) {
      var base;
      var gap = typeof record.gap === "undefined" ? 24 :
        goalCanvasNumber(record.gap, 0, 96, false);
      var showName = goalCanvasBoolean(record.showName, true);
      var showNumber = goalCanvasBoolean(record.showNumber, true);
      var showPhoto = goalCanvasBoolean(record.showPhoto, true);
      if (!goalCanvasHasOnlyKeys(record, [
        "accentColor", "animation", "cardColor", "columns", "gap", "height",
        "id", "locked", "name", "opacity", "rotation", "showName",
        "showNumber", "showPhoto", "textColor", "type", "visible", "width",
        "x", "y", "zIndex"
      ])) return null;
      base = parseGoalCanvasLayerBase(record);
      if (!base || !goalCanvasColor(record.accentColor) ||
        !goalCanvasColor(record.cardColor) ||
        goalCanvasNumber(record.columns, 1, 6, true) === null || gap === null ||
        showName === null || showNumber === null || showPhoto === null ||
        !goalCanvasColor(record.textColor)) return null;
      base.accentColor = record.accentColor;
      base.cardColor = record.cardColor;
      base.columns = record.columns;
      base.gap = gap;
      base.showName = showName;
      base.showNumber = showNumber;
      base.showPhoto = showPhoto;
      base.textColor = record.textColor;
      base.type = "lineup";
      return base;
    }
    function parseGoalCanvasLayer(value) {
      var record = goalRecord(value);
      if (!record) return null;
      if (record.type === "text") return parseGoalCanvasTextLayer(record);
      if (record.type === "image") return parseGoalCanvasImageLayer(record);
      if (record.type === "shape") return parseGoalCanvasShapeLayer(record);
      if (record.type === "lineup") return parseGoalCanvasLineupLayer(record);
      return null;
    }
    function parseGoalCanvasBackground(value) {
      var record = goalRecord(value);
      var angle;
      var focusX;
      var focusY;
      var objectFit;
      var overlayOpacity;
      if (!record) return null;
      if (record.kind === "solid") {
        return goalCanvasHasOnlyKeys(record, ["color", "kind"]) &&
          goalCanvasColor(record.color)
          ? { color: record.color, kind: "solid" }
          : null;
      }
      if (record.kind === "gradient") {
        angle = goalCanvasNumber(record.angle, 0, 360, false);
        return goalCanvasHasOnlyKeys(record, ["angle", "from", "kind", "to"]) &&
          angle !== null && goalCanvasColor(record.from) && goalCanvasColor(record.to)
          ? { angle: angle, from: record.from, kind: "gradient", to: record.to }
          : null;
      }
      if (record.kind === "media") {
        focusX = typeof record.focusX === "undefined" ? 0.5 :
          goalCanvasNumber(record.focusX, 0, 1, false);
        focusY = typeof record.focusY === "undefined" ? 0.5 :
          goalCanvasNumber(record.focusY, 0, 1, false);
        objectFit = typeof record.objectFit === "undefined" ? "cover" :
          ["cover", "contain"].indexOf(record.objectFit) !== -1
            ? record.objectFit : null;
        overlayOpacity = typeof record.overlayOpacity === "undefined" ? 0 :
          goalCanvasNumber(record.overlayOpacity, 0, 1, false);
        if (!goalCanvasHasOnlyKeys(record, [
          "focusX", "focusY", "kind", "mediaAssetId", "objectFit",
          "overlayColor", "overlayOpacity"
        ]) || focusX === null || focusY === null || !goalUuid(record.mediaAssetId) ||
          !objectFit ||
          !(typeof record.overlayColor === "undefined" ||
            goalCanvasColor(record.overlayColor)) || overlayOpacity === null) return null;
        return {
          focusX: focusX,
          focusY: focusY,
          kind: "media",
          mediaAssetId: record.mediaAssetId,
          objectFit: objectFit,
          overlayColor: typeof record.overlayColor === "undefined"
            ? "#0a0a0a" : record.overlayColor,
          overlayOpacity: overlayOpacity
        };
      }
      return null;
    }
    function parseGoalCanvasScene(value) {
      var record = goalRecord(value);
      var background;
      var layers = [];
      var ids = [];
      var zIndexes = [];
      var orientation;
      var canvasWidth;
      var canvasHeight;
      var index;
      var layer;
      if (!record || !goalCanvasHasOnlyKeys(record, [
        "background", "layers", "orientation"
      ]) || !Array.isArray(record.layers) || record.layers.length > 16) return null;
      orientation = ["landscape", "portrait"].indexOf(record.orientation) !== -1
        ? record.orientation : null;
      background = parseGoalCanvasBackground(record.background);
      if (!orientation || !background) return null;
      canvasWidth = orientation === "landscape" ? 1920 : 1080;
      canvasHeight = orientation === "landscape" ? 1080 : 1920;
      for (index = 0; index < record.layers.length; index += 1) {
        layer = parseGoalCanvasLayer(record.layers[index]);
        if (!layer || ids.indexOf(layer.id) !== -1 ||
          zIndexes.indexOf(layer.zIndex) !== -1 ||
          layer.x < -canvasWidth || layer.x > canvasWidth * 2 ||
          layer.y < -canvasHeight || layer.y > canvasHeight * 2) return null;
        ids.push(layer.id);
        zIndexes.push(layer.zIndex);
        layers.push(layer);
      }
      return { background: background, layers: layers, orientation: orientation };
    }
    function parseGoalCanvasScenePair(value) {
      var record = goalRecord(value);
      var landscape;
      var portrait;
      if (!record || !goalCanvasHasOnlyKeys(record, ["landscape", "portrait"])) {
        return null;
      }
      landscape = parseGoalCanvasScene(record.landscape);
      portrait = parseGoalCanvasScene(record.portrait);
      return landscape && landscape.orientation === "landscape" &&
        portrait && portrait.orientation === "portrait"
        ? { landscape: landscape, portrait: portrait }
        : null;
    }
    function parseGoalPlayer(value) {
      var record = goalRecord(value);
      var name;
      var number;
      if (!record) return null;
      name = goalText(record.name, 160);
      if (!name) return null;
      number = typeof record.number === "number"
        ? String(record.number)
        : goalText(record.number, 16);
      return {
        id: goalText(record.id || record.providerPlayerId, 200),
        name: name,
        number: number,
        photoUrl: goalSafeUrl(record.photoUrl)
      };
    }
    function parseMatchTeam(payload, side) {
      var record = goalRecord(payload && payload[side]);
      var name = goalText(record && record.name, 160);
      var score = goalInteger(record && record.score, 0, 999);
      return name && score !== null
        ? { name: name, score: score, logoUrl: goalSafeUrl(record.logoUrl) }
        : null;
    }
    function parseMatchOverlayDesign(value, kind) {
      var record = goalRecord(value) || {};
      var defaults = {
        half_time: ["Rust", "score-focus"],
        lineup: ["Opstelling", "team-grid"],
        lineup_clear: ["Opstelling sluiten", "team-grid"],
        match_end: ["Eindstand", "final-score"],
        match_start: ["De wedstrijd begint", "matchday-impact"]
      };
      var fallback = defaults[kind];
      var animation = ["impact", "pulse", "slide", "none"]
        .indexOf(String(record.animation)) !== -1 ? String(record.animation) : "impact";
      var palette = ["electric-orange", "ink-black", "signal-red", "white"]
        .indexOf(String(record.palette)) !== -1 ? String(record.palette) : "ink-black";
      var logoScale = ["small", "medium", "large"]
        .indexOf(String(record.logoScale)) !== -1 ? String(record.logoScale) : "medium";
      return {
        animation: animation,
        headline: goalText(record.headline, 80) || fallback[0],
        logoPosition: record.logoPosition === "center" ? "center" : "left",
        logoScale: logoScale,
        palette: palette,
        secondaryText: goalText(record.secondaryText, 160) || "",
        showClock: kind === "lineup" ? false : record.showClock !== false,
        showPreviousScore: kind === "lineup" ? false : record.showPreviousScore === true,
        showScorer: kind === "lineup",
        templateId: goalText(record.templateId || record.template, 80) || fallback[1],
        typography: record.typography === "body" ? "body" : "display"
      };
    }
    function parseMatchOverlayMessage(value) {
      var record = goalRecord(value);
      var payload = record && goalRecord(record.payload);
      var kind;
      var deliveryId;
      var eventId;
      var executeAt;
      var expiresAt;
      var serverTime;
      var durationMs;
      var home;
      var away;
      var side;
      var lineup = [];
      var assets = {};
      var ownTeamKeys = {};
      var logoMediaAssetId;
      var logoUrl = null;
      var scenePair;
      var assetValues;
      var parsedAsset;
      var homeTeamKey;
      var awayTeamKey;
      var index;
      var player;
      if (!record || !payload) return null;
      kind = ["lineup", "lineup_clear", "match_start", "half_time", "match_end"]
        .indexOf(String(payload.overlayKind)) !== -1
        ? String(payload.overlayKind)
        : null;
      deliveryId = goalUuid(record.id);
      eventId = goalUuid(payload.eventId);
      executeAt = parsePlayerTimestamp(record.executeAt);
      expiresAt = parsePlayerTimestamp(record.expiresAt);
      serverTime = parsePlayerTimestamp(record.serverTime);
      durationMs = goalInteger(payload.durationMs, 2000, 30000);
      home = parseMatchTeam(payload, "home");
      away = parseMatchTeam(payload, "away");
      if (Array.isArray(payload.ownTeamKeys)) {
        for (index = 0; index < Math.min(50, payload.ownTeamKeys.length); index += 1) {
          var ownTeamKey = goalText(payload.ownTeamKeys[index], 200);
          if (ownTeamKey) ownTeamKeys[ownTeamKey.toLowerCase()] = true;
        }
      }
      logoMediaAssetId = goalUuid(payload.logoMediaAssetId);
      assetValues = Array.isArray(record.assets) ? record.assets.slice(0, 24) : [];
      for (index = 0; index < assetValues.length; index += 1) {
        parsedAsset = parseGoalAsset(assetValues[index]);
        if (parsedAsset) assets[parsedAsset.mediaAssetId] = parsedAsset;
        if (parsedAsset && parsedAsset.mediaAssetId === logoMediaAssetId &&
          parsedAsset.mimeType.indexOf("image/") === 0) {
          logoUrl = parsedAsset.url;
        }
      }
      homeTeamKey = goalText(payload.homeTeamKey ||
        (goalRecord(payload.home) && goalRecord(payload.home).teamKey), 200);
      awayTeamKey = goalText(payload.awayTeamKey ||
        (goalRecord(payload.away) && goalRecord(payload.away).teamKey), 200);
      if (home && logoUrl && homeTeamKey &&
        ownTeamKeys[homeTeamKey.toLowerCase()] === true) home.logoUrl = logoUrl;
      if (away && logoUrl && awayTeamKey &&
        ownTeamKeys[awayTeamKey.toLowerCase()] === true) away.logoUrl = logoUrl;
      side = payload.side === "home" || payload.side === "away"
        ? payload.side
        : null;
      if (Array.isArray(payload.lineup)) {
        for (index = 0; index < Math.min(24, payload.lineup.length); index += 1) {
          player = parseGoalPlayer(payload.lineup[index]);
          if (player) lineup.push(player);
        }
      }
      scenePair = kind === "lineup_clear"
        ? null
        : parseGoalCanvasScenePair(payload.scene);
      if (!deliveryId || !eventId || executeAt === null || expiresAt === null ||
        serverTime === null || durationMs === null || !kind || !home || !away ||
        (kind === "lineup" && (!side || !lineup.length))) return null;
      return {
        executeAt: executeAt,
        expiresAt: expiresAt,
        serverTime: serverTime,
        goal: {
          assets: assets,
          away: away,
          deliveryId: deliveryId,
          design: parseMatchOverlayDesign(payload.design, kind),
          durationMs: durationMs,
          eventId: eventId,
          eventKind: payload.eventKind === "synthetic_test" ? "synthetic_test" : "live",
          home: home,
          kind: kind,
          lineup: lineup,
          lineupPageDurationMs: goalInteger(
            payload.lineupPageDurationMs,
            4000,
            10000
          ) === null ? 6000 : goalInteger(
            payload.lineupPageDurationMs,
            4000,
            10000
          ),
          matchClock: goalText(payload.matchClock, 40),
          periodLabel: goalText(payload.periodLabel, 80),
          scenePair: scenePair,
          side: side,
          underlayPolicy: payload.underlayPolicy === "continue" ? "continue" : "pause"
        }
      };
    }
    function parseGoalEnrichmentMessage(value) {
      var record = goalRecord(value);
      var payload = record && goalRecord(record.payload);
      var player = payload && parseGoalPlayer(payload.player);
      var deliveryId = record && goalUuid(record.id);
      var eventId = payload && goalUuid(payload.eventId);
      var expiresAt = record && parsePlayerTimestamp(record.expiresAt);
      var sequence = payload && goalInteger(payload.sequence || record.sequence,
        1, 9007199254740991);
      var serverTime = record && parsePlayerTimestamp(record.serverTime);
      return deliveryId && eventId && expiresAt !== null && player &&
        sequence !== null && serverTime !== null
        ? {
            deliveryId: deliveryId,
            eventId: eventId,
            expiresAt: expiresAt,
            player: player,
            sequence: sequence,
            serverTime: serverTime
          }
        : null;
    }
    function parseLedScoresTimestamp(value) {
      return typeof value === "number" && isFinite(value) && value > 0
        ? value
        : parsePlayerTimestamp(value);
    }
    function parseLedScoresMatchState(value, inheritedServerTime) {
      var envelope = goalRecord(value);
      var candidate;
      var connectionId;
      var matchKey;
      var revision;
      var status;
      var home;
      var away;
      var sourceUpdatedAt;
      var sourceObservedAt;
      var staleAfter;
      var staleSeconds;
      var serverTime;
      var storedServerTimeOffset;
      var serverTimeOffsetMs;
      var clock = null;
      var clockRecord;
      var timeline = [];
      var timelineValues;
      var item;
      var index;
      if (!envelope) return null;
      candidate = goalRecord(envelope.state_json) || goalRecord(envelope.state) ||
        goalRecord(envelope.payload) || envelope;
      if (candidate.schemaVersion !== 1) return null;
      connectionId = goalUuid(candidate.connectionId || envelope.connectionId ||
        envelope.connection_id);
      matchKey = goalText(candidate.matchKey, 300);
      revision = goalText(candidate.stateRevision || candidate.revision ||
        String(envelope.stateSequence || envelope.state_sequence || ""), 160);
      status = ["pre_match", "live", "paused", "half_time", "finished", "unknown"]
        .indexOf(String(candidate.status)) !== -1 ? String(candidate.status) : null;
      home = parseMatchTeam(candidate, "home");
      away = parseMatchTeam(candidate, "away");
      sourceUpdatedAt = parseLedScoresTimestamp(candidate.sourceUpdatedAt ||
        envelope.sourceObservedAt || envelope.source_observed_at);
      sourceObservedAt = parseLedScoresTimestamp(envelope.sourceObservedAt ||
        envelope.source_observed_at || candidate.sourceUpdatedAt);
      staleAfter = typeof candidate.staleAfter === "string"
        ? parseLedScoresTimestamp(candidate.staleAfter)
        : typeof candidate.staleAfter === "number" && candidate.staleAfter > 120
          ? candidate.staleAfter
          : null;
      staleSeconds = goalInteger(envelope.staleAfterSeconds ||
        envelope.stale_after_seconds || candidate.staleAfter, 3, 120);
      if (staleAfter === null && staleSeconds !== null && sourceObservedAt !== null) {
        staleAfter = sourceObservedAt + staleSeconds * 1000;
      }
      if (!connectionId || !matchKey || !revision || !status || !home || !away ||
        sourceUpdatedAt === null || staleAfter === null) return null;
      serverTime = parseLedScoresTimestamp(envelope.serverTime ||
        candidate.serverTime || inheritedServerTime);
      storedServerTimeOffset = typeof candidate.serverTimeOffsetMs === "number"
        ? candidate.serverTimeOffsetMs
        : envelope.serverTimeOffsetMs;
      serverTimeOffsetMs = serverTime !== null
        ? serverTime - now()
        : typeof storedServerTimeOffset === "number" &&
          isFinite(storedServerTimeOffset) &&
          Math.floor(storedServerTimeOffset) === storedServerTimeOffset &&
          Math.abs(storedServerTimeOffset) <= 3162240000000
          ? storedServerTimeOffset
          : null;
      if (serverTimeOffsetMs !== null &&
        Math.abs(serverTimeOffsetMs) > 3162240000000) {
        serverTimeOffsetMs = null;
      }
      clockRecord = goalRecord(candidate.clock);
      if (clockRecord) {
        var anchorAt = parseLedScoresTimestamp(clockRecord.anchorAt);
        var anchorSeconds = goalInteger(clockRecord.anchorSeconds, 0, 359999);
        var maxSeconds = clockRecord.maxSeconds === null ||
          typeof clockRecord.maxSeconds === "undefined"
          ? null
          : goalInteger(clockRecord.maxSeconds, 1, 359999);
        if (anchorAt === null || anchorSeconds === null ||
          ["up", "down"].indexOf(String(clockRecord.direction)) === -1 ||
          (clockRecord.maxSeconds !== null &&
            typeof clockRecord.maxSeconds !== "undefined" && maxSeconds === null)) {
          return null;
        }
        clock = {
          anchorAt: anchorAt,
          anchorSeconds: anchorSeconds,
          direction: String(clockRecord.direction),
          maxSeconds: maxSeconds,
          running: clockRecord.running === true
        };
      }
      timelineValues = Array.isArray(candidate.timeline)
        ? candidate.timeline.slice(0, 30)
        : [];
      for (index = 0; index < timelineValues.length; index += 1) {
        var timelineRecord = goalRecord(timelineValues[index]);
        if (!timelineRecord) continue;
        item = {
          awayScore: timelineRecord.awayScore === null ||
            typeof timelineRecord.awayScore === "undefined"
            ? null
            : goalInteger(timelineRecord.awayScore, 0, 999),
          clockLabel: goalText(timelineRecord.clockLabel, 40),
          homeScore: timelineRecord.homeScore === null ||
            typeof timelineRecord.homeScore === "undefined"
            ? null
            : goalInteger(timelineRecord.homeScore, 0, 999),
          id: goalText(timelineRecord.id, 200),
          kind: ["goal", "period", "score_correction", "status"]
            .indexOf(String(timelineRecord.kind)) !== -1
            ? String(timelineRecord.kind)
            : null,
          label: goalText(timelineRecord.label, 200),
          occurredAt: parseLedScoresTimestamp(timelineRecord.occurredAt),
          playerName: goalText(timelineRecord.playerName, 160),
          side: timelineRecord.side === "home" || timelineRecord.side === "away"
            ? timelineRecord.side
            : null
        };
        if (item.id && item.kind && item.label && item.occurredAt !== null) {
          timeline.push(item);
        }
      }
      return {
        away: away,
        clock: clock,
        connectionId: connectionId,
        home: home,
        matchKey: matchKey,
        periodLabel: goalText(candidate.periodLabel, 80),
        revision: revision,
        schemaVersion: 1,
        serverTimeOffsetMs: serverTimeOffsetMs,
        sourceUpdatedAt: sourceUpdatedAt,
        staleAfter: staleAfter,
        status: status,
        timeline: timeline
      };
    }
    function readStoredLedScoresMatchStates() {
      var parsed = parseJson(safeRead("veyocast-player-ledscores-match-states-v1") || "[]");
      var states = {};
      var index;
      var state;
      if (!Array.isArray(parsed)) return states;
      for (index = Math.max(0, parsed.length - 16); index < parsed.length; index += 1) {
        state = parseLedScoresMatchState(parsed[index]);
        if (!state || state.sourceUpdatedAt < ledScoresMatchServerNow(state) -
          7 * 24 * 60 * 60 * 1000) continue;
        states[state.connectionId] = state;
      }
      return states;
    }
    function persistLedScoresMatchStates() {
      var values = [];
      var connectionId;
      for (connectionId in runtime.ledScoresMatchStates) {
        if (runtime.ledScoresMatchStates.hasOwnProperty(connectionId)) {
          values.push(runtime.ledScoresMatchStates[connectionId]);
        }
      }
      safeWrite("veyocast-player-ledscores-match-states-v1",
        JSON.stringify(values.slice(-8)));
    }
    function storeLedScoresMatchState(value, inheritedServerTime) {
      var state = parseLedScoresMatchState(value, inheritedServerTime);
      var previous;
      if (!state) return false;
      previous = runtime.ledScoresMatchStates[state.connectionId];
      if (previous && previous.sourceUpdatedAt > state.sourceUpdatedAt) return false;
      if (previous && previous.sourceUpdatedAt === state.sourceUpdatedAt &&
        previous.revision === state.revision &&
        (state.serverTimeOffsetMs === null ||
          state.serverTimeOffsetMs === previous.serverTimeOffsetMs)) return false;
      runtime.ledScoresMatchStates[state.connectionId] = state;
      persistLedScoresMatchStates();
      if (typeof runtime.ledScoresLiveMatchRender === "function") {
        runtime.ledScoresLiveMatchRender(state.connectionId);
      }
      return true;
    }
    function parseGoalAsset(value) {
      var record = goalRecord(value);
      var mediaAssetId;
      var checksum;
      var mimeType;
      var url;
      if (!record) return null;
      mediaAssetId = goalUuid(record.mediaAssetId);
      checksum = typeof record.checksum === "string" &&
        /^[a-f0-9]{64}$/.test(record.checksum)
        ? record.checksum
        : null;
      mimeType = typeof record.mimeType === "string" &&
        /^(image\\/(jpeg|png|webp)|video\\/mp4)$/.test(record.mimeType)
        ? record.mimeType
        : null;
      url = typeof record.url === "string" &&
        /^https?:\\/\\//.test(record.url) && record.url.length <= 2000
        ? record.url
        : null;
      return mediaAssetId && checksum && mimeType && url
        ? {
            checksum: checksum,
            mediaAssetId: mediaAssetId,
            mimeType: mimeType,
            url: url
          }
        : null;
    }
    function parseGoalDesign(value) {
      var record = goalRecord(value);
      var headline;
      var secondaryText;
      var scorerFallback;
      var palette;
      var animation;
      var logoScale;
      if (!record) return null;
      headline = goalText(record.headline, 80);
      secondaryText = goalText(record.secondaryText, 160) || "";
      scorerFallback = goalText(record.scorerFallback, 120) || "Doelpunt!";
      palette = ["electric-orange", "ink-black", "signal-red", "white"]
        .indexOf(String(record.palette)) !== -1
        ? String(record.palette)
        : null;
      animation = ["impact", "pulse", "slide", "none"]
        .indexOf(String(record.animation)) !== -1
        ? String(record.animation)
        : null;
      logoScale = ["small", "medium", "large"]
        .indexOf(String(record.logoScale)) !== -1
        ? String(record.logoScale)
        : "medium";
      if (!headline || !palette || !animation) return null;
      return {
        animation: animation,
        headline: headline,
        logoPosition: record.logoPosition === "center" ? "center" : "left",
        logoScale: logoScale,
        palette: palette,
        scorerFallback: scorerFallback,
        secondaryText: secondaryText,
        showClock: record.showClock === true,
        showPreviousScore: record.showPreviousScore === true,
        showScorer: record.showScorer !== false,
        typography: record.typography === "body" ? "body" : "display"
      };
    }
    function parseGoalMessage(value) {
      var record = goalRecord(value);
      var payload;
      var deliveryId;
      var executeAt;
      var expiresAt;
      var serverTime;
      var eventId;
      var scoringSide;
      var design;
      var durationMs;
      var homeScore;
      var awayScore;
      var previousHomeScore;
      var previousAwayScore;
      var player;
      var assets = {};
      var assetValues;
      var parsedAsset;
      var scenePair;
      var index;
      if (!record || !Array.isArray(record.assets)) return null;
      payload = goalRecord(record.payload);
      if (!payload) return null;
      deliveryId = goalUuid(record.id);
      executeAt = parsePlayerTimestamp(record.executeAt);
      expiresAt = parsePlayerTimestamp(record.expiresAt);
      serverTime = parsePlayerTimestamp(record.serverTime);
      eventId = goalUuid(payload.eventId);
      scoringSide = ["own", "opponent", "unknown"]
        .indexOf(String(payload.scoringSide)) !== -1
        ? String(payload.scoringSide)
        : null;
      design = parseGoalDesign(payload.design);
      durationMs = goalInteger(payload.durationMs, 2000, 30000);
      homeScore = goalInteger(payload.homeScore, 0, 999);
      awayScore = goalInteger(payload.awayScore, 0, 999);
      previousHomeScore = goalInteger(payload.previousHomeScore, 0, 999);
      previousAwayScore = goalInteger(payload.previousAwayScore, 0, 999);
      player = parseGoalPlayer(payload.player || payload.scorer);
      if (
        !deliveryId || executeAt === null || expiresAt === null ||
        serverTime === null || !eventId || !scoringSide || !design ||
        durationMs === null || homeScore === null || awayScore === null ||
        previousHomeScore === null || previousAwayScore === null
      ) return null;
      assetValues = record.assets.slice(0, 24);
      for (index = 0; index < assetValues.length; index += 1) {
        parsedAsset = parseGoalAsset(assetValues[index]);
        if (parsedAsset) assets[parsedAsset.mediaAssetId] = parsedAsset;
      }
      scenePair = parseGoalCanvasScenePair(payload.scene);
      return {
        executeAt: executeAt,
        expiresAt: expiresAt,
        serverTime: serverTime,
        goal: {
          alertVersionId: goalOptionalUuid(record.alertVersionId),
          screenOrientation: runtime.goalScreenOrientation || null,
          competition: goalText(payload.competition, 160),
          matchName: goalText(payload.matchName, 240),
          round: goalText(payload.round, 80),
          venue: goalText(payload.venue, 160),
          configuration: goalRecord(payload.goalOverlay) && payload.goalOverlay.schemaVersion === 2 ? payload.goalOverlay : null,
          homeLogo: goalOptionalUuid(payload.homeLogo),
          awayLogo: goalOptionalUuid(payload.awayLogo),
          assets: assets,
          awayScore: awayScore,
          awayTeam: goalText(payload.awayTeam, 160) || "Uitteam",
          deliveryId: deliveryId,
          design: design,
          durationMs: durationMs,
          eventId: eventId,
          eventKind: payload.eventKind === "synthetic_test"
            ? "synthetic_test"
            : "live",
          homeScore: homeScore,
          homeTeam: goalText(payload.homeTeam, 160) || "Thuisteam",
          homeLogoUrl: goalSafeUrl(payload.homeLogoUrl) ||
            goalSafeUrl(goalRecord(payload.home) &&
              goalRecord(payload.home).logoUrl),
          kind: "goal",
          logoMediaAssetId: goalOptionalUuid(payload.logoMediaAssetId),
          matchClock: goalText(payload.matchClock, 40),
          mediaAssetId: goalOptionalUuid(payload.mediaAssetId),
          previousAwayScore: previousAwayScore,
          previousHomeScore: previousHomeScore,
          player: player,
          awayLogoUrl: goalSafeUrl(payload.awayLogoUrl) ||
            goalSafeUrl(goalRecord(payload.away) &&
              goalRecord(payload.away).logoUrl),
          scenePair: scenePair,
          scorerName: player ? player.name : goalText(payload.scorerName, 160),
          scoringSide: scoringSide,
          soundMediaAssetId: goalOptionalUuid(payload.soundMediaAssetId),
          soundVolume: goalInteger(payload.soundVolume, 0, 100) === null
            ? 70
            : goalInteger(payload.soundVolume, 0, 100),
          sponsorMediaAssetId: goalOptionalUuid(payload.sponsorMediaAssetId),
          underlayPolicy: payload.underlayPolicy === "pause"
            ? "pause"
            : "continue"
        }
      };
    }
    function goalAssetFor(goal, assetId) {
      return assetId && goal && goal.assets
        ? goal.assets[assetId] || null
        : null;
    }
    function goalScoringTeam(goal) {
      if (goal.homeScore === goal.previousHomeScore + 1) return goal.homeTeam;
      if (goal.awayScore === goal.previousAwayScore + 1) return goal.awayTeam;
      if (goal.scoringSide === "own") return "Eigen team";
      if (goal.scoringSide === "opponent") return "Tegenstander";
      return "Doelpunt";
    }
    function readGoalDedupe(serverNow) {
      var values = parseJson(safeRead(CONFIG.goalDedupeKey));
      if (!Array.isArray(values)) return [];
      return values.filter(function (entry) {
        return entry && goalUuid(entry.eventId) &&
          typeof entry.expiresAt === "number" &&
          isFinite(entry.expiresAt) && entry.expiresAt > serverNow;
      }).slice(-CONFIG.goalMaximumDedupeEntries);
    }
    function hasSeenGoal(eventId, serverNow) {
      return readGoalDedupe(serverNow).some(function (entry) {
        return entry.eventId === eventId;
      });
    }
    function rememberGoal(eventId, expiresAt, serverNow) {
      var values = readGoalDedupe(serverNow).filter(function (entry) {
        return entry.eventId !== eventId;
      });
      values.push({ eventId: eventId, expiresAt: expiresAt });
      safeWrite(
        CONFIG.goalDedupeKey,
        JSON.stringify(values.slice(-CONFIG.goalMaximumDedupeEntries))
      );
    }
    function goalTerminalStatus(value) {
      return ["rendered", "skipped", "failed"].indexOf(value) !== -1
        ? value
        : null;
    }
    function readGoalTerminalOutbox(referenceNow) {
      var values = parseJson(safeRead(CONFIG.goalTerminalAckOutboxKey));
      var cutoff = referenceNow - CONFIG.goalTerminalAckRetentionMs;
      var normalized = [];
      var seen = {};
      var entry;
      var deliveryId;
      var eventId;
      var status;
      var createdAt;
      var expiresAt;
      var detail;
      var index;
      if (!Array.isArray(values)) return [];
      for (index = 0; index < values.length; index += 1) {
        entry = goalRecord(values[index]);
        deliveryId = entry && goalUuid(entry.deliveryId);
        eventId = entry && goalUuid(entry.eventId);
        status = entry && goalTerminalStatus(entry.status);
        createdAt = entry && Number(entry.createdAt);
        expiresAt = entry && Number(entry.expiresAt);
        detail = entry && typeof entry.detail === "string"
          ? entry.detail.replace(/[\\r\\n]+/g, " ").slice(0, 300)
          : null;
        if (
          !deliveryId || !eventId || !status || seen[deliveryId] ||
          !isFinite(createdAt) || createdAt < cutoff ||
          createdAt > referenceNow + CONFIG.goalTerminalAckRetentionMs ||
          !isFinite(expiresAt)
        ) continue;
        seen[deliveryId] = true;
        normalized.push({
          createdAt: createdAt,
          deliveryId: deliveryId,
          detail: detail,
          eventId: eventId,
          expiresAt: expiresAt,
          status: status
        });
      }
      return normalized.slice(-CONFIG.goalTerminalAckMaximumEntries);
    }
    function writeGoalTerminalOutbox(entries) {
      return safeWrite(
        CONFIG.goalTerminalAckOutboxKey,
        JSON.stringify(entries.slice(-CONFIG.goalTerminalAckMaximumEntries))
      );
    }
    function findGoalTerminalOutcome(deliveryId, eventId, referenceNow) {
      var entries = readGoalTerminalOutbox(referenceNow);
      var index;
      for (index = 0; index < entries.length; index += 1) {
        if (
          entries[index].deliveryId === deliveryId &&
          entries[index].eventId === eventId
        ) return entries[index];
      }
      return null;
    }
    function removeGoalTerminalOutcome(deliveryId) {
      var entries = readGoalTerminalOutbox(now()).filter(function (entry) {
        return entry.deliveryId !== deliveryId;
      });
      writeGoalTerminalOutbox(entries);
      delete runtime.goalAckRetryAttempts[deliveryId];
    }
    function goalTerminalRetryDelay(attempt) {
      return Math.min(
        CONFIG.goalReconnectMaximumMs,
        1000 * Math.pow(2, Math.min(5, Math.max(0, attempt - 1)))
      ) + Math.floor(Math.random() * 500);
    }
    function scheduleGoalTerminalFlush(token, delay) {
      if (!validCredential(token) || window.navigator.onLine === false) return;
      window.clearTimeout(runtime.goalAckFlushTimer);
      runtime.goalAckFlushTimer = window.setTimeout(function () {
        runtime.goalAckFlushTimer = null;
        flushGoalTerminalOutbox(token);
      }, Math.max(0, Math.min(CONFIG.goalReconnectMaximumMs + 500, delay)));
    }
    function flushGoalTerminalOutbox(token) {
      var entries;
      var entry;
      var xhr;
      var completed = false;
      if (
        runtime.goalAckInFlight || !validCredential(token) ||
        window.navigator.onLine === false
      ) return;
      entries = readGoalTerminalOutbox(now());
      writeGoalTerminalOutbox(entries);
      if (!entries.length) return;
      entry = entries[0];
      runtime.goalAckInFlight = true;
      xhr = new XMLHttpRequest();
      function finish(transportFailed) {
        var responseStatus;
        var attempts;
        var nextToken;
        if (completed) return;
        completed = true;
        runtime.goalAckInFlight = false;
        responseStatus = xhr.status || 0;
        if (
          (!transportFailed && responseStatus >= 200 && responseStatus < 300) ||
          responseStatus === 400 || responseStatus === 404 ||
          responseStatus === 413 || responseStatus === 422
        ) {
          removeGoalTerminalOutcome(entry.deliveryId);
          nextToken = validCredential(runtime.deviceToken)
            ? runtime.deviceToken
            : token;
          scheduleGoalTerminalFlush(nextToken, 0);
          return;
        }
        if (responseStatus === 401 || responseStatus === 403) {
          if (
            validCredential(runtime.deviceToken) &&
            runtime.deviceToken !== token
          ) scheduleGoalTerminalFlush(runtime.deviceToken, 0);
          return;
        }
        attempts = Number(runtime.goalAckRetryAttempts[entry.deliveryId]) || 0;
        attempts += 1;
        runtime.goalAckRetryAttempts[entry.deliveryId] = attempts;
        if (attempts <= CONFIG.goalTerminalAckMaximumRetries) {
          scheduleGoalTerminalFlush(
            validCredential(runtime.deviceToken) ? runtime.deviceToken : token,
            goalTerminalRetryDelay(attempts)
          );
        }
      }
      try {
        xhr.open("POST", "/api/player/realtime/ack", true);
        xhr.timeout = CONFIG.requestTimeoutMs;
        xhr.setRequestHeader("Accept", "application/json");
        xhr.setRequestHeader("Authorization", "Bearer " + token);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onload = function () { finish(false); };
        xhr.onerror = function () { finish(true); };
        xhr.ontimeout = function () { finish(true); };
        xhr.onabort = function () { finish(true); };
        xhr.send(JSON.stringify({
          deliveryId: entry.deliveryId,
          detail: entry.detail,
          status: entry.status
        }));
      } catch (error) {
        finish(true);
      }
    }
    function goalTerminalAcknowledge(
      token,
      deliveryId,
      eventId,
      status,
      detail,
      expiresAt
    ) {
      var entries;
      var existing;
      var safeDetail;
      var currentNow = now();
      if (
        !validCredential(token) || !goalUuid(deliveryId) ||
        !goalUuid(eventId) || !goalTerminalStatus(status) ||
        typeof expiresAt !== "number" || !isFinite(expiresAt)
      ) return;
      entries = readGoalTerminalOutbox(currentNow);
      existing = findGoalTerminalOutcome(deliveryId, eventId, currentNow);
      if (!existing) {
        safeDetail = typeof detail === "string"
          ? detail.replace(/[\\r\\n]+/g, " ").slice(0, 300)
          : null;
        entries.push({
          createdAt: currentNow,
          deliveryId: deliveryId,
          detail: safeDetail,
          eventId: eventId,
          expiresAt: expiresAt,
          status: status
        });
        if (!writeGoalTerminalOutbox(entries)) {
          goalAcknowledge(token, deliveryId, status, safeDetail);
          return;
        }
      }
      scheduleGoalTerminalFlush(
        validCredential(runtime.deviceToken) ? runtime.deviceToken : token,
        0
      );
    }
    function goalAcknowledge(token, deliveryId, status, detail) {
      var xhr;
      var safeDetail;
      if (!validCredential(token) || !goalUuid(deliveryId) ||
        ["received", "rendered", "skipped", "failed"].indexOf(status) === -1) {
        return;
      }
      safeDetail = typeof detail === "string"
        ? detail.replace(/[\\r\\n]+/g, " ").slice(0, 300)
        : null;
      xhr = new XMLHttpRequest();
      try {
        xhr.open("POST", "/api/player/realtime/ack", true);
        xhr.timeout = CONFIG.requestTimeoutMs;
        xhr.setRequestHeader("Accept", "application/json");
        xhr.setRequestHeader("Authorization", "Bearer " + token);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(JSON.stringify({
          deliveryId: deliveryId,
          detail: safeDetail,
          status: status
        }));
      } catch (error) {
        log("LEGACY_GOAL_ACK_FAILED", status + " " + deliveryId);
      }
    }
    function preloadGoalAssets(configs) {
      var configIndex;
      var assetIndex;
      var config;
      var values;
      var asset;
      var image;
      var video;
      var pending = [];
      if (!Array.isArray(configs)) return Promise.resolve(true);
      goalV2RequiredVideos = {};
      configs.forEach(function (value) {
        if (!value || !value.config || !value.config.goalOverlay || !Array.isArray(value.assets)) return;
        value.assets.forEach(function (asset) { if (asset.mimeType === "video/mp4") goalV2RequiredVideos["/__veyocast-goal-cache/" + asset.checksum] = true; });
      });
      for (configIndex = 0; configIndex < Math.min(50, configs.length); configIndex += 1) {
        config = goalRecord(configs[configIndex]);
        if (config && config.config && config.config.goalOverlay) { pending.push(goalV2Preload(config)); continue; }
        values = config && Array.isArray(config.assets) ? config.assets : [];
        for (assetIndex = 0; assetIndex < Math.min(24, values.length); assetIndex += 1) {
          asset = parseGoalAsset(values[assetIndex]);
          if (!asset) continue;
          if (asset.mimeType.indexOf("image/") === 0) {
            image = new Image();
            image.src = asset.url;
          } else {
            video = document.createElement("video");
            video.muted = true;
            video.preload = "auto";
            video.src = asset.url;
            try { video.load(); } catch (error) {}
          }
        }
      }
      return Promise.all(pending).then(function (values) { return values.every(function (ready) { return ready; }); });
    }
    function goalTextNode(tagName, className, value) {
      var node = document.createElement(tagName);
      if (className) node.className = className;
      node.textContent = value || "";
      return node;
    }
    function goalInitials(value) {
      var parts = String(value || "").replace(/^\\s+|\\s+$/g, "").split(/\\s+/);
      var result = "";
      var index;
      for (index = 0; index < Math.min(2, parts.length); index += 1) {
        if (parts[index]) result += parts[index].charAt(0).toUpperCase();
      }
      return result || "VC";
    }
    function goalCanvasSceneForViewport(pair) {
      var portrait;
      if (!pair) return null;
      portrait = (window.innerHeight || document.documentElement.clientHeight || 0) >
        (window.innerWidth || document.documentElement.clientWidth || 0);
      return portrait ? pair.portrait : pair.landscape;
    }
    function fitGoalCanvasScene(root, orientation) {
      var viewportWidth = window.innerWidth ||
        document.documentElement.clientWidth || 1920;
      var viewportHeight = window.innerHeight ||
        document.documentElement.clientHeight || 1080;
      var logicalWidth = orientation === "portrait" ? 1080 : 1920;
      var logicalHeight = orientation === "portrait" ? 1920 : 1080;
      var scale = Math.min(
        viewportWidth / logicalWidth,
        viewportHeight / logicalHeight
      );
      var offsetX = (viewportWidth - logicalWidth * scale) / 2;
      var offsetY = (viewportHeight - logicalHeight * scale) / 2;
      root.style.width = String(logicalWidth) + "px";
      root.style.height = String(logicalHeight) + "px";
      root.style.transform = "translate(" + String(offsetX) + "px," +
        String(offsetY) + "px) scale(" + String(scale) + ")";
      root.setAttribute("data-canvas-width", String(logicalWidth));
      root.setAttribute("data-canvas-height", String(logicalHeight));
      root.setAttribute("data-orientation", orientation);
    }
    function goalCanvasEventLabel(model) {
      if (model.kind === "goal") {
        var label = model.scoringSide === "opponent"
          ? "TEGENDOELPUNT"
          : "DOELPUNT";
        return model.eventKind === "synthetic_test"
          ? "LIVE-TEST · " + label
          : label;
      }
      if (model.kind === "lineup") {
        return model.side === "away" ? "UITTEAM" : "THUISTEAM";
      }
      if (model.kind === "match_start") return "AFTRAP";
      if (model.kind === "half_time") return "RUST";
      if (model.kind === "match_end") return "EINDSTAND";
      return "WEDSTRIJD";
    }
    function goalCanvasValues(model) {
      var isGoal = model.kind === "goal";
      var home = isGoal
        ? { logoUrl: model.homeLogoUrl, name: model.homeTeam, score: model.homeScore }
        : model.home;
      var away = isGoal
        ? { logoUrl: model.awayLogoUrl, name: model.awayTeam, score: model.awayScore }
        : model.away;
      var player = isGoal ? model.player : null;
      var lineup = Array.isArray(model.lineup) ? model.lineup.slice(0, 24) : [];
      var homeLogo = home && home.logoUrl ? home.logoUrl : null;
      var awayLogo = away && away.logoUrl ? away.logoUrl : null;
      var clubLogoAsset = isGoal
        ? goalAssetFor(model, model.logoMediaAssetId)
        : null;
      var scoringHome = isGoal
        ? model.homeScore === model.previousHomeScore + 1
        : model.side === "home";
      var scoringAway = isGoal
        ? model.awayScore === model.previousAwayScore + 1
        : model.side === "away";
      var selectedTeam = !isGoal && model.side === "away"
        ? away
        : !isGoal && model.side === "home" ? home : null;
      var ownTeamLogo = clubLogoAsset &&
        clubLogoAsset.mimeType.indexOf("image/") === 0
        ? clubLogoAsset.url
        : null;
      var ownTeamIsHome = isGoal && (
        model.scoringSide === "own"
          ? scoringHome
          : model.scoringSide === "opponent" ? scoringAway : false
      );
      var ownTeamIsAway = isGoal && (
        model.scoringSide === "own"
          ? scoringAway
          : model.scoringSide === "opponent" ? scoringHome : false
      );
      var scoringTeam;
      var scoringTeamLogo;
      var text = {
        awayScore: away ? String(away.score) : "0",
        awayTeam: away ? away.name : "Uitteam",
        eventLabel: goalCanvasEventLabel(model),
        homeScore: home ? String(home.score) : "0",
        homeTeam: home ? home.name : "Thuisteam",
        score: home && away
          ? String(home.score) + " – " + String(away.score)
          : "0 – 0"
      };
      if (isGoal) {
        homeLogo = ownTeamIsHome ? ownTeamLogo : null;
        awayLogo = ownTeamIsAway ? ownTeamLogo : null;
      }
      scoringTeam = isGoal
        ? goalScoringTeam(model)
        : selectedTeam ? selectedTeam.name : null;
      scoringTeamLogo = isGoal
        ? scoringHome ? homeLogo : scoringAway ? awayLogo : null
        : selectedTeam ? selectedTeam.logoUrl : null;
      if (scoringTeam) text.scoringTeam = scoringTeam;
      if (model.matchClock) text.clock = model.matchClock;
      if (isGoal) {
        text.previousScore = String(model.previousHomeScore) + " – " +
          String(model.previousAwayScore);
        if (player && player.name) text.scorerName = player.name;
        else if (model.scorerName) text.scorerName = model.scorerName;
        if (player && player.number) text.scorerNumber = "#" + player.number;
      } else {
        text.period = model.periodLabel ||
          (model.kind === "half_time" ? "Halverwege" :
            model.kind === "match_end" ? "Afgelopen" :
              model.kind === "match_start" ? "Aftrap" : "Team");
        text.previousScore = String(home.score) + " – " + String(away.score);
      }
      return {
        images: {
          awayLogo: awayLogo,
          homeLogo: homeLogo,
          scorerPhoto: player && player.photoUrl ? player.photoUrl : null,
          scoringTeamLogo: scoringTeamLogo
        },
        lineup: lineup,
        lineupPageDurationMs: model.lineupPageDurationMs || 6000,
        lineupPageSize: (window.innerHeight || 0) > (window.innerWidth || 0)
          ? 8 : 11,
        text: text
      };
    }
    function goalCanvasTextValue(layer, values) {
      var value = layer.binding ? values.text[layer.binding] : null;
      return typeof value === "string" ? value : layer.text;
    }
    function goalCanvasImageFallback(binding, values) {
      if (binding === "scorerPhoto") return goalInitials(values.text.scorerName);
      if (binding === "homeLogo") return goalInitials(values.text.homeTeam);
      if (binding === "awayLogo") return goalInitials(values.text.awayTeam);
      if (binding === "scoringTeamLogo") {
        return goalInitials(values.text.scoringTeam);
      }
      return "";
    }
    function fillGoalCanvasImage(container, url, fallback, layer) {
      var child;
      var image;
      while (container.firstChild) {
        child = container.firstChild;
        container.removeChild(child);
      }
      if (fallback) container.appendChild(goalTextNode("span", "", fallback));
      if (!goalSafeUrl(url)) return;
      image = document.createElement("img");
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      image.style.objectFit = layer.objectFit;
      image.style.objectPosition = String(layer.focusX * 100) + "% " +
        String(layer.focusY * 100) + "%";
      image.onerror = function () {
        if (image.parentNode) image.parentNode.removeChild(image);
      };
      image.src = url;
      container.appendChild(image);
    }
    function goalCanvasAssetsReady(scene, model) {
      var asset;
      var index;
      var layer;
      if (scene.background.kind === "media") {
        asset = goalAssetFor(model, scene.background.mediaAssetId);
        if (!asset || !(asset.mimeType.indexOf("image/") === 0 ||
          asset.mimeType === "video/mp4")) return false;
      }
      for (index = 0; index < scene.layers.length; index += 1) {
        layer = scene.layers[index];
        if (layer.type === "image" && layer.mediaAssetId) {
          asset = goalAssetFor(model, layer.mediaAssetId);
          if (!asset || asset.mimeType.indexOf("image/") !== 0) return false;
        }
      }
      return true;
    }
    function goalCanvasScenePairAssetsReady(pair, model) {
      return pair && goalCanvasAssetsReady(pair.landscape, model) &&
        goalCanvasAssetsReady(pair.portrait, model);
    }
    function createGoalCanvasBackground(scene, model) {
      var background = document.createElement("div");
      var asset;
      var media;
      var overlay;
      background.className = "goal-canvas-background";
      background.setAttribute("aria-hidden", "true");
      if (scene.background.kind === "solid") {
        background.style.backgroundColor = scene.background.color;
        return background;
      }
      if (scene.background.kind === "gradient") {
        background.style.backgroundImage = "linear-gradient(" +
          String(scene.background.angle) + "deg," + scene.background.from +
          "," + scene.background.to + ")";
        return background;
      }
      asset = goalAssetFor(model, scene.background.mediaAssetId);
      if (!asset) return null;
      media = asset.mimeType.indexOf("video/") === 0
        ? document.createElement("video")
        : asset.mimeType.indexOf("image/") === 0
          ? document.createElement("img")
          : null;
      if (!media) return null;
      background.style.backgroundColor = "#0a0a0a";
      media.className = "goal-canvas-background-media";
      media.style.objectFit = scene.background.objectFit;
      media.style.objectPosition = String(scene.background.focusX * 100) + "% " +
        String(scene.background.focusY * 100) + "%";
      media.onerror = function () {
        log("LEGACY_CANVAS_BACKGROUND_FALLBACK", model.deliveryId);
        if (runtime.goalActiveModel === model && model.scenePair) {
          model.scenePair = null;
          if (model.kind === "goal") renderGoalOverlay(model);
          else renderMatchOverlay(model);
          return;
        }
        if (media.parentNode) media.parentNode.removeChild(media);
      };
      if (media.tagName === "VIDEO") {
        media.autoplay = true;
        media.controls = false;
        media.loop = true;
        media.muted = true;
        media.defaultMuted = true;
        media.preload = "auto";
        media.playsInline = true;
        media.setAttribute("playsinline", "");
        media.setAttribute("webkit-playsinline", "");
      } else {
        media.alt = "";
      }
      media.src = asset.url;
      background.appendChild(media);
      if (scene.background.overlayOpacity > 0) {
        overlay = document.createElement("div");
        overlay.className = "goal-canvas-background-overlay";
        overlay.style.backgroundColor = scene.background.overlayColor;
        overlay.style.opacity = String(scene.background.overlayOpacity);
        background.appendChild(overlay);
      }
      return background;
    }
    function createGoalCanvasLineup(layer, values) {
      var grid = document.createElement("div");
      var players = values.lineup.slice(0, 24);
      var pageSize = Math.min(values.lineupPageSize, Math.max(1, players.length));
      var pageCount = Math.max(1, Math.ceil(players.length / pageSize));
      var rows = Math.max(1, Math.ceil(
        Math.min(pageSize, players.length) / layer.columns
      ));
      var photoSize = Math.max(34, Math.min(
        96,
        (layer.height - layer.gap * Math.max(0, rows - 1)) / rows - 24
      ));
      var index;
      var player;
      var card;
      var photo;
      var copy;
      var image;
      var indicator;
      grid.className = "goal-canvas-layer-content goal-canvas-lineup " +
        "goal-canvas-animation-" + layer.animation;
      grid.style.gridTemplateColumns = "repeat(" + String(layer.columns) +
        ",minmax(0,1fr))";
      grid.style.gridTemplateRows = "repeat(" + String(rows) + ",minmax(0,1fr))";
      grid.style.gap = String(layer.gap) + "px";
      grid.setAttribute("data-canvas-lineup-page-count", String(pageCount));
      grid.setAttribute("data-canvas-lineup-page-size", String(pageSize));
      for (index = 0; index < players.length; index += 1) {
        player = players[index];
        card = document.createElement("article");
        card.className = "goal-canvas-lineup-card";
        card.setAttribute("data-canvas-lineup-index", String(index));
        if (index >= pageSize) card.style.display = "none";
        card.style.backgroundColor = layer.cardColor;
        card.style.borderLeft = "8px solid " + layer.accentColor;
        card.style.borderRadius = "14px";
        card.style.color = layer.textColor;
        card.style.gap = "16px";
        card.style.padding = "12px 16px";
        if (layer.showPhoto) {
          card.style.gridTemplateColumns = String(photoSize) + "px minmax(0,1fr)";
          photo = document.createElement("div");
          photo.className = "goal-canvas-lineup-photo";
          photo.style.width = String(photoSize) + "px";
          photo.style.height = String(photoSize) + "px";
          photo.appendChild(goalTextNode("span", "", goalInitials(player.name)));
          if (player.photoUrl) {
            image = document.createElement("img");
            image.alt = "";
            image.setAttribute("aria-hidden", "true");
            image.onerror = function () {
              if (this.parentNode) this.parentNode.removeChild(this);
            };
            image.src = player.photoUrl;
            photo.appendChild(image);
          }
          card.appendChild(photo);
        } else {
          card.style.gridTemplateColumns = "minmax(0,1fr)";
        }
        copy = document.createElement("div");
        copy.className = "goal-canvas-lineup-copy";
        if (layer.showNumber) {
          copy.appendChild(goalTextNode("b", "", player.number || "—"));
          copy.lastChild.style.color = layer.accentColor;
          copy.lastChild.style.fontSize = "26px";
        }
        if (layer.showName) {
          copy.appendChild(goalTextNode("strong", "", player.name));
          copy.lastChild.style.fontSize = "24px";
        }
        card.appendChild(copy);
        grid.appendChild(card);
      }
      if (pageCount > 1) {
        indicator = goalTextNode(
          "span",
          "goal-canvas-lineup-page",
          "1 / " + String(pageCount)
        );
        indicator.setAttribute("data-canvas-lineup-page", "true");
        grid.appendChild(indicator);
      }
      return grid;
    }
    function createGoalCanvasLayer(layer, values, model) {
      var wrapper = document.createElement("div");
      var content;
      var asset;
      var url;
      var fallback;
      wrapper.className = "goal-canvas-layer";
      wrapper.style.left = String(layer.x) + "px";
      wrapper.style.top = String(layer.y) + "px";
      wrapper.style.width = String(layer.width) + "px";
      wrapper.style.height = String(layer.height) + "px";
      wrapper.style.opacity = String(layer.opacity);
      wrapper.style.transform = "rotate(" + String(layer.rotation) + "deg)";
      wrapper.style.zIndex = String(layer.zIndex + 2);
      wrapper.setAttribute("data-canvas-layer-id", layer.id);
      if (layer.type === "text") {
        content = document.createElement("div");
        content.className = "goal-canvas-layer-content goal-canvas-text " +
          "goal-canvas-animation-" + layer.animation;
        content.style.alignItems = layer.align === "center"
          ? "center" : layer.align === "right" ? "flex-end" : "flex-start";
        content.style.justifyContent = layer.verticalAlign === "top"
          ? "flex-start" : layer.verticalAlign === "bottom"
            ? "flex-end" : "center";
        content.style.backgroundColor = layer.backgroundColor || "transparent";
        content.style.borderRadius = String(layer.cornerRadius) + "px";
        content.style.color = layer.fill;
        content.style.fontFamily = layer.fontFamily === "Inter Tight"
          ? "Arial Black,Arial,Helvetica,sans-serif"
          : "Arial,Helvetica,sans-serif";
        content.style.fontSize = String(layer.fontSize) + "px";
        content.style.fontWeight = String(layer.fontWeight);
        content.style.letterSpacing = String(layer.letterSpacing) + "px";
        content.style.lineHeight = String(layer.lineHeight);
        content.style.padding = String(layer.padding) + "px";
        content.style.textAlign = layer.align;
        content.textContent = goalCanvasTextValue(layer, values);
        if (layer.binding) {
          content.setAttribute("data-goal-canvas-text-binding", layer.binding);
        }
      } else if (layer.type === "image") {
        content = document.createElement("div");
        content.className = "goal-canvas-layer-content goal-canvas-image " +
          "goal-canvas-animation-" + layer.animation;
        content.style.borderRadius = String(layer.cornerRadius) + "px";
        content._goalCanvasLayer = layer;
        if (layer.binding) {
          url = values.images[layer.binding];
          fallback = goalCanvasImageFallback(layer.binding, values);
          content.setAttribute("data-goal-canvas-image-binding", layer.binding);
        } else {
          asset = goalAssetFor(model, layer.mediaAssetId);
          url = asset && asset.mimeType.indexOf("image/") === 0 ? asset.url : null;
          fallback = "";
        }
        fillGoalCanvasImage(content, url, fallback, layer);
      } else if (layer.type === "shape") {
        content = document.createElement("div");
        content.className = "goal-canvas-layer-content " +
          "goal-canvas-animation-" + layer.animation;
        content.setAttribute("aria-hidden", "true");
        content.setAttribute("data-canvas-shape", layer.shape);
        if (layer.shape === "line") {
          content.style.top = "50%";
          content.style.bottom = "auto";
          content.style.height = "0";
          content.style.backgroundColor = "transparent";
          content.style.borderTop = String(Math.max(2, layer.strokeWidth)) +
            "px solid " + (layer.stroke || layer.fill);
        } else {
          content.style.backgroundColor = layer.fill;
          content.style.borderRadius = layer.shape === "ellipse"
            ? "50%" : String(layer.cornerRadius) + "px";
        }
        if (layer.shape !== "line" && layer.stroke && layer.strokeWidth > 0) {
          content.style.border = String(layer.strokeWidth) + "px solid " +
            layer.stroke;
        }
      } else {
        content = createGoalCanvasLineup(layer, values);
      }
      wrapper.appendChild(content);
      return wrapper;
    }
    function startGoalCanvasLineupPagination(root, durationMs) {
      var grids = root.querySelectorAll("[data-canvas-lineup-page-count]");
      var maximumPageCount = 1;
      var gridIndex;
      var pageCount;
      if (!grids.length) return;
      for (gridIndex = 0; gridIndex < grids.length; gridIndex += 1) {
        pageCount = goalInteger(
          grids[gridIndex].getAttribute("data-canvas-lineup-page-count"),
          1,
          24
        );
        if (pageCount !== null) {
          maximumPageCount = Math.max(maximumPageCount, pageCount);
        }
      }
      if (maximumPageCount <= 1) return;
      runtime.goalLineupPageIndex = 0;
      runtime.goalLineupPageTimer = window.setInterval(function () {
        var grid;
        var cards;
        var cardIndex;
        var pageSize;
        var localPage;
        var indicator;
        runtime.goalLineupPageIndex =
          (runtime.goalLineupPageIndex + 1) % maximumPageCount;
        for (gridIndex = 0; gridIndex < grids.length; gridIndex += 1) {
          grid = grids[gridIndex];
          pageCount = goalInteger(
            grid.getAttribute("data-canvas-lineup-page-count"),
            1,
            24
          ) || 1;
          pageSize = goalInteger(
            grid.getAttribute("data-canvas-lineup-page-size"),
            1,
            24
          ) || 1;
          localPage = runtime.goalLineupPageIndex % pageCount;
          cards = grid.querySelectorAll("[data-canvas-lineup-index]");
          for (cardIndex = 0; cardIndex < cards.length; cardIndex += 1) {
            cards[cardIndex].style.display =
              Math.floor(cardIndex / pageSize) === localPage ? "" : "none";
          }
          indicator = grid.querySelector("[data-canvas-lineup-page]");
          if (indicator) {
            indicator.textContent = String(localPage + 1) + " / " +
              String(pageCount);
          }
        }
      }, durationMs);
    }
    function goalCanvasAriaLabel(model) {
      if (model.kind === "goal") {
        return model.scoringSide === "own"
          ? "Doelpunt voor eigen team"
          : model.scoringSide === "opponent"
            ? "Doelpunt tegenstander"
            : "Doelpunt van onbekend team";
      }
      if (model.kind === "lineup") {
        return "Opstelling " +
          (model.side === "away" ? model.away.name : model.home.name);
      }
      return model.design.headline;
    }
    function startGoalCanvasMedia(root) {
      var videos = root.querySelectorAll("video");
      var index;
      var playResult;
      for (index = 0; index < videos.length; index += 1) {
        try {
          videos[index].load();
          playResult = videos[index].play();
          if (playResult && typeof playResult.catch === "function") {
            playResult.catch(function () {});
          }
        } catch (error) {}
      }
    }
    function startGoalCanvasSound(model, overlay) {
      var asset = model.kind === "goal"
        ? goalAssetFor(model, model.soundMediaAssetId)
        : null;
      var audio;
      var playResult;
      if (!asset || asset.mimeType !== "video/mp4") return;
      audio = document.createElement("audio");
      audio.preload = "auto";
      audio.volume = model.soundVolume / 100;
      audio.src = asset.url;
      overlay.appendChild(audio);
      try {
        playResult = audio.play();
        if (playResult && typeof playResult.catch === "function") {
          playResult.catch(function () {});
        }
      } catch (error) {}
    }
    function renderGoalCanvasOverlay(model) {
      var overlay = byId("goal-overlay");
      var scene = goalCanvasSceneForViewport(model.scenePair);
      var background;
      var root;
      var values;
      var layers;
      var index;
      if (!scene || !goalCanvasScenePairAssetsReady(model.scenePair, model)) {
        return false;
      }
      background = createGoalCanvasBackground(scene, model);
      if (!background) return false;
      try {
        values = goalCanvasValues(model);
        root = document.createElement("div");
        root.className = "goal-canvas-scene";
        root.appendChild(background);
        layers = scene.layers.slice().sort(function (left, right) {
          return left.zIndex - right.zIndex ||
            (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
        });
        for (index = 0; index < layers.length; index += 1) {
          if (layers[index].visible) {
            root.appendChild(createGoalCanvasLayer(layers[index], values, model));
          }
        }
        clearGoalElement();
        fitGoalCanvasScene(root, scene.orientation);
        overlay.appendChild(root);
        overlay.setAttribute("data-renderer", "canvas");
        overlay.setAttribute("aria-label", goalCanvasAriaLabel(model));
        overlay.hidden = false;
        byId("watermark").className = "visible";
        runtime.goalActiveEventId = model.eventId;
        runtime.goalActiveKind = model.kind;
        runtime.goalActiveModel = model;
        startGoalCanvasMedia(root);
        startGoalCanvasSound(model, overlay);
        if (model.kind === "lineup") {
          startGoalCanvasLineupPagination(
            root,
            model.lineupPageDurationMs || 6000
          );
        }
        return true;
      } catch (error) {
        clearGoalElement();
        log("LEGACY_CANVAS_RENDER_FALLBACK", model.deliveryId);
        return false;
      }
    }
    function createGoalPlayerCard(player) {
      var card = document.createElement("aside");
      var portrait = document.createElement("div");
      var image;
      var copy = document.createElement("div");
      card.className = "goal-player";
      portrait.className = "goal-player-photo";
      if (player.photoUrl) {
        image = document.createElement("img");
        image.alt = "";
        image.setAttribute("aria-hidden", "true");
        image.src = player.photoUrl;
        portrait.appendChild(image);
      } else {
        portrait.appendChild(goalTextNode("span", "", goalInitials(player.name)));
      }
      copy.className = "goal-player-copy";
      if (player.number) copy.appendChild(goalTextNode("span", "", "#" + player.number));
      copy.appendChild(goalTextNode("strong", "", player.name));
      copy.appendChild(goalTextNode("small", "", "Doelpuntenmaker"));
      card.appendChild(portrait);
      card.appendChild(copy);
      return card;
    }
    function updateActiveGoalPlayer(player) {
      var overlay = byId("goal-overlay");
      var scorer = overlay.querySelector("[data-goal-scorer]");
      var existing = overlay.querySelector(".goal-player");
      var canvasTexts;
      var canvasImages;
      var values;
      var binding;
      var layer;
      var index;
      if (runtime.goalActiveKind !== "goal" || !runtime.goalActiveModel) return false;
      runtime.goalActiveModel.player = player;
      runtime.goalActiveModel.scorerName = player.name;
      if (runtime.goalV2Redraw) { runtime.goalV2Redraw(); return true; }
      if (overlay.getAttribute("data-renderer") === "canvas") {
        values = goalCanvasValues(runtime.goalActiveModel);
        canvasTexts = overlay.querySelectorAll("[data-goal-canvas-text-binding]");
        for (index = 0; index < canvasTexts.length; index += 1) {
          binding = canvasTexts[index].getAttribute(
            "data-goal-canvas-text-binding"
          );
          if ((binding === "scorerName" || binding === "scorerNumber") &&
            typeof values.text[binding] === "string") {
            canvasTexts[index].textContent = values.text[binding];
          }
        }
        canvasImages = overlay.querySelectorAll(
          '[data-goal-canvas-image-binding="scorerPhoto"]'
        );
        for (index = 0; index < canvasImages.length; index += 1) {
          layer = canvasImages[index]._goalCanvasLayer;
          if (layer) {
            fillGoalCanvasImage(
              canvasImages[index],
              values.images.scorerPhoto,
              goalCanvasImageFallback("scorerPhoto", values),
              layer
            );
          }
        }
        return true;
      }
      if (scorer) scorer.textContent = player.name;
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      if (runtime.goalActiveModel.design.showScorer) {
        overlay.appendChild(createGoalPlayerCard(player));
      }
      return true;
    }
    function clearGoalElement() {
      if (runtime.goalV2Cleanup) { runtime.goalV2Cleanup(); runtime.goalV2Cleanup = null; }
      var overlay = byId("goal-overlay");
      var media;
      var mediaElements = overlay.querySelectorAll("video,audio");
      var mediaIndex;
      if (runtime.goalActiveKind === "goal" && runtime.goalActiveEventId) {
        delete runtime.goalEnrichmentSequences[runtime.goalActiveEventId];
      }
      window.clearInterval(runtime.goalLineupPageTimer);
      runtime.goalLineupPageTimer = null;
      runtime.goalLineupPageIndex = 0;
      for (mediaIndex = 0; mediaIndex < mediaElements.length; mediaIndex += 1) {
        media = mediaElements[mediaIndex];
        try { media.pause(); } catch (error) {}
        media.removeAttribute("src");
        try { media.load(); } catch (error) {}
      }
      while (overlay.firstChild) {
        media = overlay.firstChild;
        overlay.removeChild(media);
      }
      overlay.hidden = true;
      overlay.removeAttribute("data-animation");
      overlay.removeAttribute("data-logo-position");
      overlay.removeAttribute("data-logo-scale");
      overlay.removeAttribute("data-palette");
      overlay.removeAttribute("data-renderer");
      overlay.removeAttribute("data-typography");
      overlay.removeAttribute("aria-label");
      runtime.goalActiveEventId = null;
      runtime.goalActiveKind = null;
      runtime.goalActiveModel = null;
    }
    function pauseGoalUnderlay() {
      var remaining;
      var element;
      if (runtime.goalPauseApplied) return;
      runtime.goalPauseApplied = true;
      if (runtime.currentElement && runtime.currentElement.birthdayRefresh) runtime.currentElement.birthdayRefresh();
      if (runtime.playbackTimer !== null && runtime.playbackDeadlineAt > 0) {
        remaining = Math.max(1, runtime.playbackDeadlineAt - monotonicNow());
        window.clearTimeout(runtime.playbackTimer);
        runtime.playbackTimer = null;
        runtime.playbackDeadlineAt = 0;
        runtime.playbackRemainingMs = remaining;
      }
      if (runtime.templateTimer !== null && runtime.templateDeadlineAt > 0) {
        remaining = Math.max(1, runtime.templateDeadlineAt - monotonicNow());
        window.clearTimeout(runtime.templateTimer);
        runtime.templateTimer = null;
        runtime.templateDeadlineAt = 0;
        runtime.templateRemainingMs = remaining;
      }
      element = runtime.currentElement;
      if (element && element.tagName === "VIDEO" && !element.paused) {
        runtime.goalPausedVideo = element;
        try { element.pause(); } catch (error) {}
      }
    }
    function resumeGoalUnderlay() {
      var remaining;
      var templateCallback;
      var templateRemaining;
      var video;
      if (!runtime.goalPauseApplied) return;
      runtime.goalPauseApplied = false;
      if (runtime.currentElement && runtime.currentElement.birthdayRefresh) runtime.currentElement.birthdayRefresh();
      video = runtime.goalPausedVideo;
      runtime.goalPausedVideo = null;
      if (video && runtime.currentElement === video) {
        startVideo(video, runtime.playbackGeneration);
      }
      if (
        runtime.pendingElement &&
        runtime.pendingElement.tagName === "VIDEO"
      ) {
        startVideo(runtime.pendingElement, runtime.playbackGeneration);
      }
      remaining = runtime.playbackRemainingMs;
      runtime.playbackRemainingMs = null;
      templateCallback = runtime.templateResumeCallback;
      templateRemaining = runtime.templateRemainingMs;
      runtime.templateRemainingMs = null;
      if (
        typeof templateCallback === "function" &&
        typeof templateRemaining === "number" &&
        isFinite(templateRemaining) && templateRemaining > 0
      ) {
        scheduleTemplateAdvance(templateCallback, templateRemaining);
      }
      if (typeof remaining === "number" && isFinite(remaining) && remaining > 0) {
        schedulePlaybackAdvance(remaining);
      }
    }
    function hideGoalOverlay(resumeUnderlay) {
      window.clearTimeout(runtime.goalExpiryTimer);
      runtime.goalExpiryTimer = null;
      if (resumeUnderlay && runtime.goalQueue.length && !runtime.goalQueueDraining) {
        runtime.goalQueueDraining = true;
        runtime.goalActiveEventId = null;
        runtime.goalActiveKind = null;
        while (runtime.goalQueue.length) {
          var queued = runtime.goalQueue.shift();
          queued.value.serverTime = new Date(queued.serverTime + now() - queued.receivedAt).toISOString();
          queued.value.expiresAt = new Date(queued.serverTime + now() - queued.receivedAt + 120000).toISOString();
          handleGoalDelivery(queued.value, queued.token, "goal");
          if (runtime.goalActivationTimer !== null) { runtime.goalQueueDraining = false; return; }
        }
        runtime.goalQueueDraining = false;
      }
      clearGoalElement();
      if (resumeUnderlay) resumeGoalUnderlay();
    }
    function renderGoalOverlay(goal) {
      if (goal.configuration) return renderGoalV2(goal);
      var overlay = byId("goal-overlay");
      var mediaAsset = goalAssetFor(goal, goal.mediaAssetId);
      var logoAsset = goalAssetFor(goal, goal.logoMediaAssetId);
      var soundAsset = goalAssetFor(goal, goal.soundMediaAssetId);
      var sponsorAsset = goalAssetFor(goal, goal.sponsorMediaAssetId);
      var fallback = document.createElement("div");
      var media;
      var mediaElement;
      var scrim;
      var content;
      var identity;
      var logo;
      var score;
      var metadata;
      var sponsor;
      var audio;
      var playResult;
      var index;
      if (goal.scenePair && renderGoalCanvasOverlay(goal)) return true;
      clearGoalElement();
      byId("watermark").className = "visible";
      fallback.className = "goal-fallback";
      fallback.setAttribute("aria-hidden", "true");
      for (index = 0; index < 3; index += 1) {
        fallback.appendChild(document.createElement("span"));
      }
      overlay.appendChild(fallback);
      if (mediaAsset) {
        media = document.createElement("div");
        media.className = "goal-media";
        media.setAttribute("aria-hidden", "true");
        mediaElement = mediaAsset.mimeType.indexOf("video/") === 0
          ? document.createElement("video")
          : document.createElement("img");
        mediaElement.onerror = function () {
          log("LEGACY_GOAL_MEDIA_FALLBACK", goal.deliveryId);
          if (media.parentNode) media.parentNode.removeChild(media);
        };
        if (mediaElement.tagName === "VIDEO") {
          mediaElement.autoplay = false;
          mediaElement.controls = false;
          mediaElement.loop = true;
          mediaElement.muted = true;
          mediaElement.defaultMuted = true;
          mediaElement.preload = "auto";
          mediaElement.setAttribute("playsinline", "");
          mediaElement.setAttribute("webkit-playsinline", "");
        } else {
          mediaElement.alt = "";
        }
        mediaElement.src = mediaAsset.url;
        media.appendChild(mediaElement);
        overlay.appendChild(media);
        if (mediaElement.tagName === "VIDEO") {
          try {
            mediaElement.load();
            playResult = mediaElement.play();
            if (playResult && typeof playResult.catch === "function") {
              playResult.catch(function () {});
            }
          } catch (error) {}
        }
      }
      scrim = document.createElement("div");
      scrim.className = "goal-scrim";
      scrim.setAttribute("aria-hidden", "true");
      overlay.appendChild(scrim);
      content = document.createElement("div");
      content.className = "goal-content" +
        (goal.design.logoPosition === "center" ? " center" : "") +
        " logo-" + goal.design.logoScale;
      identity = document.createElement("div");
      identity.className = "goal-identity";
      if (logoAsset && logoAsset.mimeType.indexOf("image/") === 0) {
        logo = document.createElement("img");
        logo.className = "goal-logo";
        logo.alt = "";
        logo.setAttribute("aria-hidden", "true");
        logo.src = logoAsset.url;
        identity.appendChild(logo);
      }
      identity.appendChild(goalTextNode("span", "", goalScoringTeam(goal)));
      content.appendChild(identity);
      content.appendChild(goalTextNode("strong", "goal-headline", goal.design.headline));
      score = document.createElement("div");
      score.className = "goal-score";
      score.setAttribute(
        "aria-label",
        "Score " + String(goal.homeScore) + " tegen " + String(goal.awayScore)
      );
      score.appendChild(goalTextNode("span", "", String(goal.homeScore)));
      score.appendChild(goalTextNode("small", "", "–"));
      score.appendChild(goalTextNode("span", "", String(goal.awayScore)));
      content.appendChild(score);
      if (goal.design.showPreviousScore) {
        content.appendChild(goalTextNode(
          "p",
          "goal-previous",
          "Vorige stand " + String(goal.previousHomeScore) + "–" +
            String(goal.previousAwayScore)
        ));
      }
      if (goal.design.secondaryText) {
        content.appendChild(goalTextNode(
          "p",
          "goal-secondary",
          goal.design.secondaryText
        ));
      }
      metadata = document.createElement("div");
      metadata.className = "goal-metadata";
      if (goal.design.showScorer) {
        var scorerNode = goalTextNode(
          "span",
          "",
          goal.scorerName || goal.design.scorerFallback
        );
        scorerNode.setAttribute("data-goal-scorer", "true");
        metadata.appendChild(scorerNode);
      }
      if (goal.design.showClock && goal.matchClock) {
        metadata.appendChild(goalTextNode("span", "", goal.matchClock));
      }
      if (goal.eventKind === "synthetic_test") {
        metadata.appendChild(goalTextNode("span", "", "LIVE-TEST"));
      }
      content.appendChild(metadata);
      overlay.appendChild(content);
      if (goal.design.showScorer && goal.player) {
        overlay.appendChild(createGoalPlayerCard(goal.player));
      }
      if (sponsorAsset && sponsorAsset.mimeType.indexOf("image/") === 0) {
        sponsor = document.createElement("aside");
        sponsor.className = "goal-sponsor";
        sponsor.appendChild(goalTextNode("span", "", "Mede mogelijk gemaakt door"));
        logo = document.createElement("img");
        logo.alt = "Sponsor";
        logo.src = sponsorAsset.url;
        sponsor.appendChild(logo);
        overlay.appendChild(sponsor);
      }
      if (soundAsset && soundAsset.mimeType === "video/mp4") {
        audio = document.createElement("audio");
        audio.preload = "auto";
        audio.volume = goal.soundVolume / 100;
        audio.src = soundAsset.url;
        overlay.appendChild(audio);
        try {
          playResult = audio.play();
          if (playResult && typeof playResult.catch === "function") {
            playResult.catch(function () {});
          }
        } catch (error) {}
      }
      overlay.setAttribute("data-animation", goal.design.animation);
      overlay.setAttribute("data-logo-position", goal.design.logoPosition);
      overlay.setAttribute("data-logo-scale", goal.design.logoScale);
      overlay.setAttribute("data-palette", goal.design.palette);
      overlay.setAttribute("data-typography", goal.design.typography);
      overlay.setAttribute(
        "aria-label",
        goal.scoringSide === "own"
          ? "Doelpunt voor eigen team"
          : goal.scoringSide === "opponent"
            ? "Doelpunt tegenstander"
            : "Doelpunt van onbekend team"
      );
      overlay.hidden = false;
      runtime.goalActiveEventId = goal.eventId;
      runtime.goalActiveKind = "goal";
      runtime.goalActiveModel = goal;
      return true;
    }
    function createMatchTeamMark(team) {
      var mark = document.createElement("div");
      var image;
      mark.className = "match-team-mark";
      if (team.logoUrl) {
        image = document.createElement("img");
        image.alt = "";
        image.setAttribute("aria-hidden", "true");
        image.src = team.logoUrl;
        mark.appendChild(image);
      } else {
        mark.appendChild(goalTextNode("span", "", goalInitials(team.name)));
      }
      return mark;
    }
    function createMatchScoreboard(match, showScore) {
      var board = document.createElement("div");
      var home = document.createElement("div");
      var away = document.createElement("div");
      var score = document.createElement("div");
      board.className = "match-scoreboard";
      board.setAttribute("data-show-score", showScore === false ? "false" : "true");
      home.className = "match-team home";
      away.className = "match-team away";
      score.className = "match-score";
      home.appendChild(createMatchTeamMark(match.home));
      home.appendChild(goalTextNode("strong", "", match.home.name));
      away.appendChild(createMatchTeamMark(match.away));
      away.appendChild(goalTextNode("strong", "", match.away.name));
      score.textContent = String(match.home.score) + "–" + String(match.away.score);
      score.setAttribute("aria-label", "Stand " + match.home.name + " " +
        String(match.home.score) + ", " + match.away.name + " " +
        String(match.away.score));
      board.appendChild(home);
      if (showScore !== false) board.appendChild(score);
      board.appendChild(away);
      return board;
    }
    function renderMatchOverlay(match) {
      var overlay = byId("goal-overlay");
      var backdrop = document.createElement("div");
      var content;
      var header;
      var grid;
      var team;
      var player;
      var card;
      var photo;
      var copy;
      var image;
      var index;
      var pageSize;
      var pageCount;
      var pageLabel;
      if (match.scenePair && renderGoalCanvasOverlay(match)) return true;
      clearGoalElement();
      byId("watermark").className = "visible";
      backdrop.className = "match-overlay-backdrop";
      backdrop.setAttribute("aria-hidden", "true");
      overlay.appendChild(backdrop);
      if (match.kind === "lineup") {
        pageSize = (window.innerHeight || 0) > (window.innerWidth || 0) ? 8 : 11;
        pageCount = Math.max(1, Math.ceil(match.lineup.length / pageSize));
        team = match.side === "away" ? match.away : match.home;
        content = document.createElement("div");
        content.className = "match-lineup";
        header = document.createElement("div");
        header.className = "match-lineup-header";
        header.appendChild(createMatchTeamMark(team));
        copy = document.createElement("div");
        copy.appendChild(goalTextNode("p", "match-overlay-kicker",
          match.side === "home" ? "Thuisteam" : "Uitteam"));
        copy.appendChild(goalTextNode("h2", "", match.design.headline));
        copy.appendChild(goalTextNode("strong", "", team.name));
        if (match.design.secondaryText) {
          copy.appendChild(goalTextNode("p", "match-lineup-lead",
            match.design.secondaryText));
        }
        header.appendChild(copy);
        if (match.design.showPreviousScore) {
          header.appendChild(goalTextNode("span", "match-lineup-score",
            String(match.home.score) + "–" + String(match.away.score)));
        }
        if (match.design.showClock && match.matchClock) {
          header.appendChild(goalTextNode("time", "match-lineup-clock",
            match.matchClock));
        }
        if (match.design.showScorer && pageCount > 1) {
          pageLabel = goalTextNode("span", "match-lineup-page",
            "1 / " + String(pageCount));
          pageLabel.setAttribute("data-lineup-page", "true");
          header.appendChild(pageLabel);
        }
        content.appendChild(header);
        if (match.design.showScorer) {
          grid = document.createElement("div");
          grid.className = "match-lineup-grid";
          for (index = 0; index < match.lineup.length; index += 1) {
            player = match.lineup[index];
            card = document.createElement("article");
            card.className = "match-player";
            card.setAttribute("data-lineup-index", String(index));
            if (index >= pageSize) card.style.display = "none";
            photo = document.createElement("div");
            photo.className = "match-player-photo";
            if (player.photoUrl) {
              image = document.createElement("img");
              image.alt = "";
              image.src = player.photoUrl;
              photo.appendChild(image);
            } else {
              photo.appendChild(goalTextNode("span", "", goalInitials(player.name)));
            }
            copy = document.createElement("div");
            copy.appendChild(goalTextNode("b", "", player.number || "—"));
            copy.appendChild(goalTextNode("strong", "", player.name));
            card.appendChild(photo);
            card.appendChild(copy);
            grid.appendChild(card);
          }
          content.appendChild(grid);
        } else {
          grid = document.createElement("div");
          grid.className = "match-lineup-team-only";
          grid.appendChild(createMatchTeamMark(team));
          grid.appendChild(goalTextNode("strong", "", team.name));
          content.appendChild(grid);
        }
      } else {
        content = document.createElement("div");
        content.className = "match-overlay-content";
        content.appendChild(goalTextNode("p", "match-overlay-kicker",
          match.periodLabel || (match.kind === "match_start" ? "Aftrap" :
            match.kind === "half_time" ? "Halverwege" : "Afgelopen")));
        content.appendChild(goalTextNode("strong", "match-overlay-title",
          match.design.headline));
        if (match.design.secondaryText) {
          content.appendChild(goalTextNode("p", "goal-secondary",
            match.design.secondaryText));
        }
        content.appendChild(createMatchScoreboard(
          match,
          match.design.showPreviousScore
        ));
        if (match.design.showClock && match.matchClock) {
          content.appendChild(goalTextNode("p", "match-overlay-kicker",
            match.matchClock));
        }
      }
      overlay.appendChild(content);
      overlay.setAttribute("data-animation", match.design.animation);
      overlay.setAttribute("data-logo-position", match.design.logoPosition);
      overlay.setAttribute("data-logo-scale", match.design.logoScale);
      overlay.setAttribute("data-palette", match.design.palette);
      overlay.setAttribute("data-typography", match.design.typography);
      overlay.setAttribute("aria-label", match.kind === "lineup"
        ? "Opstelling " + team.name
        : match.design.headline);
      overlay.hidden = false;
      runtime.goalActiveEventId = match.eventId;
      runtime.goalActiveKind = match.kind;
      runtime.goalActiveModel = match;
      if (match.kind === "lineup" && match.design.showScorer && pageCount > 1) {
        runtime.goalLineupPageTimer = window.setInterval(function () {
          var cards = overlay.querySelectorAll(".match-player");
          var cardIndex;
          var indicator = overlay.querySelector("[data-lineup-page]");
          runtime.goalLineupPageIndex = (runtime.goalLineupPageIndex + 1) % pageCount;
          for (cardIndex = 0; cardIndex < cards.length; cardIndex += 1) {
            cards[cardIndex].style.display =
              Math.floor(cardIndex / pageSize) === runtime.goalLineupPageIndex
                ? ""
                : "none";
          }
          if (indicator) indicator.textContent =
            String(runtime.goalLineupPageIndex + 1) + " / " + String(pageCount);
        }, match.lineupPageDurationMs);
      }
      return true;
    }
    function cancelPendingGoal(detail) {
      window.clearTimeout(runtime.goalActivationTimer);
      runtime.goalActivationTimer = null;
      if (runtime.goalPendingEnrichment &&
        validCredential(runtime.goalPendingEnrichment.token)) {
        goalTerminalAcknowledge(
          runtime.goalPendingEnrichment.token,
          runtime.goalPendingEnrichment.deliveryId,
          runtime.goalPendingEnrichment.eventId,
          "skipped",
          detail,
          runtime.goalPendingEnrichment.expiresAt
        );
      }
      if (
        goalUuid(runtime.goalPendingDeliveryId) &&
        goalUuid(runtime.goalPendingEventId) &&
        typeof runtime.goalPendingExpiresAt === "number" &&
        validCredential(runtime.goalPendingToken)
      ) {
        goalTerminalAcknowledge(
          runtime.goalPendingToken,
          runtime.goalPendingDeliveryId,
          runtime.goalPendingEventId,
          "skipped",
          detail,
          runtime.goalPendingExpiresAt
        );
      }
      if (runtime.goalPendingEventId) {
        delete runtime.goalEnrichmentSequences[runtime.goalPendingEventId];
      }
      runtime.goalPendingDeliveryId = null;
      runtime.goalPendingEventId = null;
      runtime.goalPendingExpiresAt = null;
      runtime.goalPendingKind = null;
      runtime.goalPendingEnrichment = null;
      runtime.goalPendingToken = null;
    }
    function handleGoalDelivery(value, token, deliveryKind) {
      var deliveryId = goalUuid(value && value.id);
      var invalidPayload;
      var invalidEventId;
      var invalidExpiresAt;
      var message;
      var terminalOutcome;
      var serverOffset;
      var serverNow;
      var activateIn;
      if (deliveryId) goalAcknowledge(token, deliveryId, "received", null);
      message = deliveryKind === "match_overlay"
        ? parseMatchOverlayMessage(value)
        : parseGoalMessage(value);
      if (!message) {
        if (deliveryId) {
          invalidPayload = goalRecord(value && value.payload);
          invalidEventId = invalidPayload && goalUuid(invalidPayload.eventId);
          invalidExpiresAt = parsePlayerTimestamp(value && value.expiresAt);
          if (invalidEventId && invalidExpiresAt !== null) {
            goalTerminalAcknowledge(
              token,
              deliveryId,
              invalidEventId,
              "failed",
              deliveryKind === "match_overlay"
                ? "invalid_match_overlay_payload"
                : "invalid_goal_payload",
              invalidExpiresAt
            );
          } else {
            goalAcknowledge(token, deliveryId, "failed",
              deliveryKind === "match_overlay"
                ? "invalid_match_overlay_payload"
                : "invalid_goal_payload");
          }
        }
        return;
      }
      terminalOutcome = findGoalTerminalOutcome(
        message.goal.deliveryId,
        message.goal.eventId,
        now()
      );
      if (terminalOutcome) {
        scheduleGoalTerminalFlush(
          validCredential(runtime.deviceToken) ? runtime.deviceToken : token,
          0
        );
        return;
      }
      serverOffset = message.serverTime - now();
      serverNow = now() + serverOffset;
      if (runtime.goalActiveKind === "goal" && message.goal.kind !== "goal") {
        goalTerminalAcknowledge(
          token,
          message.goal.deliveryId,
          message.goal.eventId,
          "skipped",
          "higher_priority_overlay_active",
          message.expiresAt
        );
        return;
      }
      if (
        message.expiresAt <= serverNow ||
        (message.goal.kind === "goal" && hasSeenGoal(message.goal.eventId, serverNow))
      ) {
        goalTerminalAcknowledge(
          token,
          message.goal.deliveryId,
          message.goal.eventId,
          "skipped",
          "expired_or_duplicate",
          message.expiresAt
        );
        return;
      }
      if (message.goal.kind === "goal" && !runtime.goalQueueDraining && (runtime.goalActiveKind === "goal" || runtime.goalPendingKind === "goal")) {
        if (runtime.goalActiveEventId === message.goal.eventId || runtime.goalPendingEventId === message.goal.eventId || runtime.goalQueue.some(function (entry) { return entry.value.payload.eventId === message.goal.eventId; })) {
          goalV2Log("goal_event_duplicate", message.goal); return;
        }
        if (runtime.goalQueue.length >= 20) { goalTerminalAcknowledge(token, message.goal.deliveryId, message.goal.eventId, "skipped", "goal_queue_full", message.expiresAt); return; }
        runtime.goalQueue.push({ value: value, token: token, receivedAt: now(), serverTime: message.serverTime });
        return;
      }
      activateIn = Math.max(0, message.executeAt - serverNow);
      if (activateIn > 30000) {
        goalTerminalAcknowledge(
          token,
          message.goal.deliveryId,
          message.goal.eventId,
          "skipped",
          "execute_time_too_far",
          message.expiresAt
        );
        return;
      }
      if (
        runtime.goalPendingEventId === message.goal.eventId &&
        runtime.goalPendingDeliveryId === message.goal.deliveryId
      ) {
        return;
      }
      if (runtime.goalActivationTimer !== null) {
        if (runtime.goalPendingKind === "goal" && message.goal.kind !== "goal") {
          goalTerminalAcknowledge(
            token,
            message.goal.deliveryId,
            message.goal.eventId,
            "skipped",
            "higher_priority_overlay_scheduled",
            message.expiresAt
          );
          return;
        }
        cancelPendingGoal("replaced_before_activation");
      }
      if (
        runtime.goalActiveEventId &&
        runtime.goalActiveEventId !== message.goal.eventId
      ) {
        hideGoalOverlay(true);
      }
      runtime.goalPendingDeliveryId = message.goal.deliveryId;
      runtime.goalPendingEventId = message.goal.eventId;
      runtime.goalPendingExpiresAt = message.expiresAt;
      runtime.goalPendingKind = message.goal.kind;
      runtime.goalPendingToken = token;
      runtime.goalActivationTimer = window.setTimeout(function () {
        var currentServerNow = now() + serverOffset;
        var pendingEnrichment = runtime.goalPendingEnrichment;
        var renderDetail;
        var visibleFor;
        runtime.goalActivationTimer = null;
        runtime.goalPendingDeliveryId = null;
        runtime.goalPendingEventId = null;
        runtime.goalPendingExpiresAt = null;
        runtime.goalPendingKind = null;
        runtime.goalPendingEnrichment = null;
        runtime.goalPendingToken = null;
        if (message.expiresAt <= currentServerNow) {
          goalTerminalAcknowledge(
            token,
            message.goal.deliveryId,
            message.goal.eventId,
            "skipped",
            "execute_window_expired",
            message.expiresAt
          );
          hideGoalOverlay(true);
          return;
        }
        try {
          if (message.goal.kind === "lineup_clear") {
            hideGoalOverlay(true);
          } else {
            if (pendingEnrichment && message.goal.kind === "goal" &&
              pendingEnrichment.eventId === message.goal.eventId) {
              message.goal.player = pendingEnrichment.player;
              message.goal.scorerName = pendingEnrichment.player.name;
            }
            if (message.goal.underlayPolicy === "pause") pauseGoalUnderlay();
            if (message.goal.kind === "goal") renderGoalOverlay(message.goal);
            else renderMatchOverlay(message.goal);
          }
        } catch (error) {
          hideGoalOverlay(true);
          goalTerminalAcknowledge(
            token,
            message.goal.deliveryId,
            message.goal.eventId,
            "failed",
            "legacy_overlay_render_failed",
            message.expiresAt
          );
          return;
        }
        renderDetail = "render_latency_ms:" +
          String(Math.max(0, now() + serverOffset - message.executeAt));
        goalTerminalAcknowledge(
          token,
          message.goal.deliveryId,
          message.goal.eventId,
          "rendered",
          renderDetail,
          message.expiresAt
        );
        if (pendingEnrichment && message.goal.kind === "goal" &&
          pendingEnrichment.eventId === message.goal.eventId) {
          goalTerminalAcknowledge(
            pendingEnrichment.token,
            pendingEnrichment.deliveryId,
            pendingEnrichment.eventId,
            "rendered",
            "scheduled_goal_enriched",
            pendingEnrichment.expiresAt
          );
        }
        if (message.goal.kind === "goal") {
          rememberGoal(
            message.goal.eventId,
            message.expiresAt,
            currentServerNow
          );
        }
        if (message.goal.kind === "lineup_clear" || message.goal.configuration) return;
        visibleFor = Math.max(
          1,
          Math.min(
            message.goal.durationMs,
            message.expiresAt - currentServerNow
          )
        );
        runtime.goalExpiryTimer = window.setTimeout(function () {
          if (runtime.goalActiveEventId === message.goal.eventId) {
            hideGoalOverlay(true);
          }
        }, visibleFor);
      }, activateIn);
    }
    function handleGoalEnrichmentDelivery(value, token) {
      var deliveryId = goalUuid(value && value.id);
      var enrichment;
      var currentTime;
      var latestSequence;
      if (deliveryId) goalAcknowledge(token, deliveryId, "received", null);
      enrichment = parseGoalEnrichmentMessage(value);
      if (!enrichment) {
        if (deliveryId) goalAcknowledge(
          token,
          deliveryId,
          "failed",
          "invalid_goal_enrichment_payload"
        );
        return;
      }
      currentTime = enrichment.serverTime;
      if (enrichment.expiresAt <= currentTime) {
        goalTerminalAcknowledge(token, enrichment.deliveryId,
          enrichment.eventId, "skipped", "enrichment_expired",
          enrichment.expiresAt);
        return;
      }
      latestSequence = Number(
        runtime.goalEnrichmentSequences[enrichment.eventId] || 0
      );
      if (enrichment.sequence <= latestSequence) {
        goalTerminalAcknowledge(token, enrichment.deliveryId,
          enrichment.eventId, "skipped", "superseded_enrichment",
          enrichment.expiresAt);
        return;
      }
      if (runtime.goalActiveKind === "goal" &&
        runtime.goalActiveEventId === enrichment.eventId &&
        updateActiveGoalPlayer(enrichment.player)) {
        runtime.goalEnrichmentSequences[enrichment.eventId] =
          enrichment.sequence;
        goalTerminalAcknowledge(token, enrichment.deliveryId,
          enrichment.eventId, "rendered", "active_goal_enriched",
          enrichment.expiresAt);
        return;
      }
      if (runtime.goalPendingKind === "goal" &&
        runtime.goalPendingEventId === enrichment.eventId) {
        if (runtime.goalPendingEnrichment &&
          validCredential(runtime.goalPendingEnrichment.token)) {
          goalTerminalAcknowledge(
            runtime.goalPendingEnrichment.token,
            runtime.goalPendingEnrichment.deliveryId,
            runtime.goalPendingEnrichment.eventId,
            "skipped",
            "superseded_enrichment",
            runtime.goalPendingEnrichment.expiresAt
          );
        }
        enrichment.token = token;
        runtime.goalEnrichmentSequences[enrichment.eventId] =
          enrichment.sequence;
        runtime.goalPendingEnrichment = enrichment;
        return;
      }
      var queuedGoal = runtime.goalQueue.find(function (entry) { return entry.value.payload.eventId === enrichment.eventId; });
      if (queuedGoal) {
        queuedGoal.value.payload.player = enrichment.player;
        runtime.goalEnrichmentSequences[enrichment.eventId] = enrichment.sequence;
        goalTerminalAcknowledge(token, enrichment.deliveryId, enrichment.eventId, "rendered", "queued_goal_enriched", enrichment.expiresAt);
        return;
      }
      goalTerminalAcknowledge(token, enrichment.deliveryId,
        enrichment.eventId, "skipped", "goal_not_active",
        enrichment.expiresAt);
    }
    function parseGoalSseBlock(value) {
      var event = "message";
      var data = [];
      var lines;
      var index;
      var parsed;
      if (!value || value.charAt(0) === ":") return null;
      lines = value.split("\\n");
      for (index = 0; index < lines.length; index += 1) {
        if (lines[index].indexOf("event: ") === 0) {
          event = lines[index].slice(7).replace(/^\\s+|\\s+$/g, "");
        }
        if (lines[index].indexOf("data: ") === 0) {
          data.push(lines[index].slice(6));
        }
      }
      if (!data.length || !/^[a-z][a-z_]{0,39}$/.test(event)) return null;
      parsed = parseJson(data.join("\\n"));
      return parsed === null ? null : { event: event, value: parsed };
    }
    function handleGoalStreamEvent(event, value, token) {
      var record = goalRecord(value);
      var deliveryId;
      if (!record) return;
      if (event === "target_invalidated" || event === "data_invalidated") {
        runtime.signalReceivedAt = new Date().toISOString();
        if (typeof record.targetRevision === "string" && typeof record.committedAt === "string") runtime.targetCommit = { revision: record.targetRevision, at: record.committedAt };
        invalidateManifest(); return;
      }
      if (event === "bootstrap" || event === "configuration") {
        if (record.screenOrientation === "portrait" || record.screenOrientation === "landscape") runtime.goalScreenOrientation = record.screenOrientation;
        var prepared = preloadGoalAssets(record.configs);
        if (Array.isArray(record.matchBindings)) {
          for (var bindingIndex = 0;
            bindingIndex < Math.min(50, record.matchBindings.length);
            bindingIndex += 1) {
            storeLedScoresMatchState(record.matchBindings[bindingIndex],
              record.serverTime);
          }
        }
        deliveryId = goalUuid(record.deliveryId);
        if (event === "configuration" && deliveryId) {
          prepared.then(function (ready) {
            goalAcknowledge(token, deliveryId, "received", ready ? "configuration_prefetched" : "configuration_prefetch_incomplete");
          });
        }
      } else if (event === "goal") {
        handleGoalDelivery(record, token, "goal");
      } else if (event === "goal_enrichment") {
        handleGoalEnrichmentDelivery(record, token);
      } else if (event === "match_overlay") {
        handleGoalDelivery(record, token, "match_overlay");
      } else if (event === "match_state") {
        storeLedScoresMatchState(record);
      }
    }
    function consumeGoalSseProgress(xhr, token) {
      var responseText;
      var chunk;
      var boundary;
      var block;
      var parsed;
      try { responseText = xhr.responseText || ""; } catch (error) { return; }
      if (responseText.length < runtime.goalStreamOffset) {
        runtime.goalStreamOffset = 0;
        runtime.goalStreamBuffer = "";
      }
      chunk = responseText.slice(runtime.goalStreamOffset);
      runtime.goalStreamOffset = responseText.length;
      runtime.goalStreamBuffer += chunk;
      boundary = runtime.goalStreamBuffer.indexOf("\\n\\n");
      while (boundary !== -1) {
        block = runtime.goalStreamBuffer.slice(0, boundary);
        runtime.goalStreamBuffer = runtime.goalStreamBuffer.slice(boundary + 2);
        parsed = parseGoalSseBlock(block);
        if (parsed) handleGoalStreamEvent(parsed.event, parsed.value, token);
        boundary = runtime.goalStreamBuffer.indexOf("\\n\\n");
      }
      if (runtime.goalStreamBuffer.length > 4194304) {
        runtime.goalStreamBuffer = "";
      }
    }
    function goalReconnectDelay(attempt) {
      return Math.min(
        CONFIG.goalReconnectMaximumMs,
        1000 * Math.pow(2, Math.min(5, Math.max(0, attempt - 1)))
      ) + Math.floor(Math.random() * 500);
    }
    function scheduleGoalReconnect(delay, generation) {
      if (
        generation !== runtime.goalStreamGeneration ||
        !validCredential(runtime.deviceToken) ||
        window.navigator.onLine === false
      ) return;
      window.clearTimeout(runtime.goalReconnectTimer);
      runtime.goalReconnectTimer = window.setTimeout(function () {
        runtime.goalReconnectTimer = null;
        connectGoalRealtime(generation);
      }, Math.max(
        1000,
        Math.min(CONFIG.goalReconnectMaximumMs + 500, delay)
      ));
    }
    function armGoalStreamWatchdog(xhr, generation) {
      window.clearTimeout(runtime.goalStreamWatchdogTimer);
      runtime.goalStreamWatchdogXhr = xhr;
      runtime.goalStreamWatchdogTimer = window.setTimeout(function () {
        if (runtime.goalStreamWatchdogXhr !== xhr) return;
        runtime.goalStreamWatchdogTimer = null;
        runtime.goalStreamWatchdogXhr = null;
        if (
          generation !== runtime.goalStreamGeneration ||
          runtime.goalStreamXhr !== xhr
        ) return;
        log("LEGACY_GOAL_STREAM_STALLED", "SSE keepalive bleef uit");
        try { xhr.abort(); } catch (error) {}
      }, CONFIG.goalStreamSilenceMs);
    }
    function connectGoalRealtime(generation) {
      var xhr;
      var token;
      var completed = false;
      if (
        generation !== runtime.goalStreamGeneration ||
        !validCredential(runtime.deviceToken) ||
        window.navigator.onLine === false
      ) return;
      token = runtime.deviceToken;
      xhr = new XMLHttpRequest();
      runtime.goalStreamXhr = xhr;
      runtime.goalStreamBuffer = "";
      runtime.goalStreamOffset = 0;
      function finish(transportCode) {
        var status;
        if (completed) return;
        completed = true;
        if (runtime.goalStreamWatchdogXhr === xhr) {
          window.clearTimeout(runtime.goalStreamWatchdogTimer);
          runtime.goalStreamWatchdogTimer = null;
          runtime.goalStreamWatchdogXhr = null;
        }
        status = xhr.status || 0;
        if (runtime.goalStreamXhr === xhr) runtime.goalStreamXhr = null;
        if (generation !== runtime.goalStreamGeneration) return;
        if (status === 204) {
          runtime.goalReconnectAttempt = 0;
          if (now() - runtime.lastGoalDisabledLoggedAt > 600000) {
            runtime.lastGoalDisabledLoggedAt = now();
            log("LEGACY_GOAL_DISABLED", "GET /api/player/realtime");
          }
          scheduleGoalReconnect(CONFIG.goalDisabledRetryMs, generation);
          return;
        }
        if (status === 401 || status === 403) {
          log("LEGACY_GOAL_AUTH_REJECTED", "HTTP_" + String(status));
          return;
        }
        runtime.goalReconnectAttempt = Math.min(
          runtime.goalReconnectAttempt + 1,
          8
        );
        log(
          transportCode || "LEGACY_GOAL_STREAM_CLOSED",
          "HTTP_" + String(status)
        );
        scheduleGoalReconnect(
          goalReconnectDelay(runtime.goalReconnectAttempt),
          generation
        );
      }
      xhr.open("GET", "/api/player/realtime", true);
      xhr.setRequestHeader("Accept", "text/event-stream");
      xhr.setRequestHeader("Authorization", "Bearer " + token);
      xhr.onprogress = function () {
        if (xhr.status < 200 || xhr.status >= 300) return;
        runtime.goalReconnectAttempt = 0;
        armGoalStreamWatchdog(xhr, generation);
        consumeGoalSseProgress(xhr, token);
        if (
          !completed &&
          runtime.goalStreamOffset >= CONFIG.goalStreamRecycleCharacters
        ) {
          completed = true;
          if (runtime.goalStreamWatchdogXhr === xhr) {
            window.clearTimeout(runtime.goalStreamWatchdogTimer);
            runtime.goalStreamWatchdogTimer = null;
            runtime.goalStreamWatchdogXhr = null;
          }
          if (runtime.goalStreamXhr === xhr) runtime.goalStreamXhr = null;
          try { xhr.abort(); } catch (error) {}
          log("LEGACY_GOAL_STREAM_RECYCLED", "bounded XHR response");
          scheduleGoalReconnect(1000, generation);
        }
      };
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          consumeGoalSseProgress(xhr, token);
        }
        finish(null);
      };
      xhr.onerror = function () { finish("LEGACY_GOAL_NETWORK_ERROR"); };
      xhr.ontimeout = function () { finish("LEGACY_GOAL_TIMEOUT"); };
      xhr.onabort = function () { finish("LEGACY_GOAL_ABORTED"); };
      armGoalStreamWatchdog(xhr, generation);
      try { xhr.send(null); } catch (error) {
        finish("LEGACY_GOAL_XHR_EXCEPTION");
      }
    }
    function stopGoalRealtime(clearOverlay) {
      if (clearOverlay) runtime.goalQueue = [];
      runtime.goalStreamGeneration += 1;
      window.clearTimeout(runtime.goalReconnectTimer);
      runtime.goalReconnectTimer = null;
      window.clearTimeout(runtime.goalStreamWatchdogTimer);
      runtime.goalStreamWatchdogTimer = null;
      runtime.goalStreamWatchdogXhr = null;
      runtime.goalReconnectAttempt = 0;
      if (runtime.goalStreamXhr) {
        var xhr = runtime.goalStreamXhr;
        runtime.goalStreamXhr = null;
        try { xhr.abort(); } catch (error) {}
      }
      runtime.goalStreamBuffer = "";
      runtime.goalStreamOffset = 0;
      if (clearOverlay) {
        cancelPendingGoal("device_credential_removed");
        hideGoalOverlay(true);
      }
    }
    function restartGoalRealtime() {
      var generation;
      stopGoalRealtime(false);
      if (!validCredential(runtime.deviceToken)) return;
      generation = runtime.goalStreamGeneration;
      scheduleGoalTerminalFlush(runtime.deviceToken, 0);
      connectGoalRealtime(generation);
    }
    function createIdentifier() {
      var bytes = [];
      var index;
      if (window.crypto && typeof window.crypto.getRandomValues === "function") {
        var random = new Uint8Array(16);
        window.crypto.getRandomValues(random);
        for (index = 0; index < random.length; index += 1) bytes.push(random[index]);
      } else {
        for (index = 0; index < 16; index += 1) {
          bytes.push(Math.floor(Math.random() * 256));
        }
      }
      bytes[6] = (bytes[6] & 15) | 64;
      bytes[8] = (bytes[8] & 63) | 128;
      return bytes.map(function (byte) {
        return ("0" + byte.toString(16)).slice(-2);
      }).join("").replace(
        /^(........)(....)(....)(....)(............)$/,
        "$1-$2-$3-$4-$5"
      );
    }
    function ensureInstallationId() {
      var stored = safeRead(CONFIG.installationIdKey);
      if (validIdentifier(stored)) return stored;
      stored = createIdentifier();
      safeWrite(CONFIG.installationIdKey, stored);
      return stored;
    }
    function clearTemporaryPairing() {
      safeRemove(CONFIG.pairingCodeKey);
      safeRemove(CONFIG.pairingExpiryKey);
      safeRemove(CONFIG.pairingNonceKey);
      hidePairing();
    }
    function clearInvalidDeviceCredential() {
      stopGoalRealtime(true);
      runtime.deviceToken = null;
      safeRemove(CONFIG.deviceTokenKey);
      safeRemove(CONFIG.previousDeviceTokenKey);
      clearTemporaryPairing();
    }
    function readDeviceToken() {
      var current = safeRead(CONFIG.deviceTokenKey);
      if (validCredential(current)) return current;
      current = safeRead(CONFIG.previousDeviceTokenKey);
      return validCredential(current) ? current : null;
    }
    function persistDeviceToken(value) {
      if (!validCredential(value)) return false;
      runtime.deviceToken = value;
      return safeWrite(CONFIG.deviceTokenKey, value);
    }
    function retryDelay(attempt, retryAfter) {
      var serverSeconds = Number(retryAfter);
      if (isFinite(serverSeconds) && serverSeconds > 0) {
        return Math.min(600000, Math.max(1000, Math.ceil(serverSeconds * 1000)));
      }
      return Math.min(60000, 2000 * Math.pow(2, Math.min(attempt, 5)));
    }
    function scheduleBoot(code, detail, retryAfter) {
      var delay = retryDelay(runtime.syncFailures, retryAfter);
      runtime.syncFailures = Math.min(runtime.syncFailures + 1, 8);
      window.clearTimeout(runtime.retryTimer);
      showStatus(
        "Automatisch herstellen",
        "VeyoCast tijdelijk niet bereikbaar",
        detail + " Nieuwe gecontroleerde poging over " + Math.ceil(delay / 1000) + " seconden.",
        code
      );
      runtime.retryTimer = window.setTimeout(boot, delay);
    }
    function registerInstallation(callback) {
      var headers = { "Content-Type": "application/json" };
      if (runtime.installationCredential) {
        headers["X-VeyoCast-Installation-Credential"] =
          runtime.installationCredential;
      }
      if (runtime.deviceToken) {
        headers.Authorization = "Bearer " + runtime.deviceToken;
      }
      request(
        "POST",
        "/api/player/installation",
        headers,
        JSON.stringify({ installationId: runtime.installationId }),
        function (transport, status, body, retryAfter) {
          if (
            !transport &&
            status >= 200 &&
            status < 300 &&
            body &&
            body.ok === true
          ) {
            if (validCredential(body.installationCredential)) {
              runtime.installationCredential = body.installationCredential;
              safeWrite(
                CONFIG.installationCredentialKey,
                runtime.installationCredential
              );
            }
            if (validCredential(body.deviceCredential)) {
              persistDeviceToken(body.deviceCredential);
            }
            callback(true, null, null);
            return;
          }
          if (runtime.deviceToken && (transport || status >= 500)) {
            callback(true, null, null);
            return;
          }
          callback(
            false,
            errorCode(body, transport || "INSTALLATION_API_UNAVAILABLE"),
            retryAfter
          );
        }
      );
    }
    function requestPairing() {
      var nonce = safeRead(CONFIG.pairingNonceKey);
      if (!validIdentifier(nonce)) {
        nonce = createIdentifier();
        safeWrite(CONFIG.pairingNonceKey, nonce);
      }
      setState("PAIRING_REQUESTING");
      showStatus(
        "LG Legacy Player",
        "Nieuwe koppelcode voorbereiden",
        "De Player vraagt één idempotente koppelcode aan.",
        ""
      );
      request(
        "POST",
        "/api/player/pairing",
        {
          "X-VeyoCast-Installation-Credential":
            runtime.installationCredential,
          "X-VeyoCast-Pairing-Request": nonce,
          "X-VeyoCast-Player-Instance": runtime.installationId
        },
        null,
        function (transport, status, body, retryAfter) {
          var code = errorCode(body, transport || "PAIRING_API_UNAVAILABLE");
          if (
            !transport &&
            status >= 200 &&
            status < 300 &&
            body &&
            validCredential(body.deviceToken) &&
            typeof body.pairingCode === "string" &&
            typeof body.expiresAt === "string"
          ) {
            persistDeviceToken(body.deviceToken);
            safeWrite(CONFIG.pairingCodeKey, body.pairingCode);
            safeWrite(CONFIG.pairingExpiryKey, body.expiresAt);
            runtime.syncFailures = 0;
            showPairing(body.pairingCode);
            setState("PAIRING_CODE_ACTIVE");
            window.setTimeout(pollPairingClaim, 1000);
            return;
          }
          scheduleBoot(
            code,
            errorCause(body, "De koppelservice reageert tijdelijk niet."),
            retryAfter
          );
        }
      );
    }
    function ensurePairing() {
      var code = safeRead(CONFIG.pairingCodeKey);
      if (code && runtime.deviceToken) {
        showPairing(code);
        setState("PAIRING_CODE_ACTIVE");
        pollPairingClaim();
        return;
      }
      clearTemporaryPairing();
      requestPairing();
    }
    function pollPairingClaim() {
      var pairingCode = safeRead(CONFIG.pairingCodeKey);
      if (!runtime.deviceToken || !pairingCode) {
        clearInvalidDeviceCredential();
        requestPairing();
        return;
      }
      request(
        "POST",
        "/api/player/heartbeat",
        {
          Authorization: "Bearer " + runtime.deviceToken,
          "Content-Type": "application/json"
        },
        JSON.stringify({
          activeReleaseId: null,
          currentItemId: null,
          desiredReleaseId: null,
          networkState: "online",
          runtimeState: "READY",
          syncPhase: null
        }),
        function (transport, status, body) {
          var code = errorCode(body, transport || "PAIRING_API_UNAVAILABLE");
          if (!transport && status >= 200 && status < 300 && body && body.ok === true) {
            clearTemporaryPairing();
            setState("SYNCING");
            restartGoalRealtime();
            syncManifest();
            return;
          }
          if (status === 409 && code === "PAIRING_PENDING") {
            showPairing(
              pairingCode,
              "Nog niet gekoppeld. Voer de zichtbare code in bij het gewenste scherm in Control."
            );
            runtime.retryTimer = window.setTimeout(pollPairingClaim, 3000);
            return;
          }
          if (transport || status >= 500) {
            showPairing(
              pairingCode,
              "Control kon tijdelijk niet worden gecontroleerd. De code blijft geldig; de Player probeert opnieuw."
            );
            runtime.retryTimer = window.setTimeout(pollPairingClaim, 5000);
            return;
          }
          clearInvalidDeviceCredential();
          requestPairing();
        }
      );
    }
    function isManifestEnvelope(value) {
      return Boolean(
        value &&
        value.manifest &&
        Array.isArray(value.manifest.items) &&
        typeof value.manifest.releaseId === "string" &&
        value.device &&
        typeof value.device.id === "string"
      );
    }
    function isWaitingEnvelope(value) {
      return Boolean(value && value.device && !value.manifest && value.state === "READY");
    }
    function releaseIdOf(envelope) {
      return envelope && envelope.manifest &&
        typeof envelope.manifest.releaseId === "string"
        ? envelope.manifest.releaseId
        : null;
    }
    function releaseEtag(releaseId) {
      return '"release-' + releaseId + '"';
    }
    function cacheAsset(item, kind, source) {
      if (
        !item ||
        !source ||
        typeof source.url !== "string" ||
        !source.url ||
        !isFinite(Number(source.bytes)) ||
        Number(source.bytes) <= 0 ||
        typeof source.checksumSha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(source.checksumSha256)
      ) return null;
      return {
        bytes: Number(source.bytes),
        cacheKey: CONFIG.cachePathPrefix + source.checksumSha256,
        checksumSha256: source.checksumSha256,
        itemId: item.id,
        kind: kind,
        mimeType: typeof source.mimeType === "string"
          ? source.mimeType
          : "application/octet-stream",
        url: source.url
      };
    }
    function releaseAssets(envelope) {
      var items = playableItems(envelope);
      var assets = [];
      var index;
      var item;
      var asset;
      var templateAssets;
      var assetId;
      for (index = 0; index < items.length; index += 1) {
        item = items[index];
        asset = cacheAsset(item, "media", item.source);
        if (!asset) return null;
        assets.push(asset);
        if (item.source.posterUrl) {
          asset = cacheAsset(item, "poster", {
            bytes: item.source.posterBytes,
            checksumSha256: item.source.posterChecksumSha256,
            mimeType: "image/jpeg",
            url: item.source.posterUrl
          });
          if (!asset) return null;
          assets.push(asset);
        }
        templateAssets = item.dynamicTemplate &&
          templateRecord(item.dynamicTemplate.assets);
        if (!templateAssets) continue;
        for (assetId in templateAssets) {
          if (!Object.prototype.hasOwnProperty.call(templateAssets, assetId)) continue;
          asset = cacheAsset(item, "dynamic", templateAssets[assetId]);
          if (!asset) return null;
          assets.push(asset);
        }
      }
      return assets;
    }
    function uniqueReleaseAssets(assets) {
      var unique = [];
      var known = {};
      var index;
      var asset;
      for (index = 0; index < assets.length; index += 1) {
        asset = assets[index];
        if (known[asset.cacheKey]) {
          if (
            known[asset.cacheKey].bytes !== asset.bytes ||
            known[asset.cacheKey].checksumSha256 !== asset.checksumSha256
          ) return null;
          continue;
        }
        known[asset.cacheKey] = asset;
        unique.push(asset);
      }
      return unique;
    }
    function sha256Hex(bytes, callback) {
      var digest;
      if (
        !window.crypto ||
        !window.crypto.subtle ||
        typeof window.crypto.subtle.digest !== "function"
      ) {
        callback("LEGACY_SHA256_UNAVAILABLE", null);
        return;
      }
      try {
        digest = window.crypto.subtle.digest("SHA-256", bytes);
      } catch (error) {
        callback("LEGACY_SHA256_FAILED", null);
        return;
      }
      digest.then(function (result) {
        var values = new Uint8Array(result);
        var output = "";
        var index;
        for (index = 0; index < values.length; index += 1) {
          output += ("0" + values[index].toString(16)).slice(-2);
        }
        callback(null, output);
      }, function () {
        callback("LEGACY_SHA256_FAILED", null);
      });
    }
    function responseBytes(response, callback) {
      var result;
      try {
        if (response && typeof response.arrayBuffer === "function") {
          result = response.arrayBuffer();
          result.then(function (bytes) {
            callback(null, bytes);
          }, function () {
            callback("LEGACY_CACHE_READ_FAILED", null);
          });
          return;
        }
        if (
          response &&
          typeof response.blob === "function" &&
          typeof window.FileReader === "function"
        ) {
          response.blob().then(function (blob) {
            var reader = new FileReader();
            reader.onerror = function () {
              callback("LEGACY_CACHE_READ_FAILED", null);
            };
            reader.onload = function () {
              callback(null, reader.result);
            };
            reader.readAsArrayBuffer(blob);
          }, function () {
            callback("LEGACY_CACHE_READ_FAILED", null);
          });
          return;
        }
      } catch (error) {}
      callback("LEGACY_CACHE_READ_FAILED", null);
    }
    function verifyAssetBytes(asset, bytes, callback) {
      if (!bytes || Number(bytes.byteLength) !== asset.bytes) {
        callback("LEGACY_ASSET_SIZE_MISMATCH");
        return;
      }
      sha256Hex(bytes, function (error, checksum) {
        callback(error || (
          checksum === asset.checksumSha256
            ? null
            : "LEGACY_ASSET_CHECKSUM_MISMATCH"
        ));
      });
    }
    function openAssetCache(callback) {
      var open;
      if (!window.caches || typeof window.caches.open !== "function") {
        callback("LEGACY_CACHE_UNAVAILABLE", null);
        return;
      }
      try {
        open = window.caches.open(CONFIG.cacheName);
      } catch (error) {
        callback("LEGACY_CACHE_UNAVAILABLE", null);
        return;
      }
      open.then(function (cache) {
        callback(null, cache);
      }, function () {
        callback("LEGACY_CACHE_UNAVAILABLE", null);
      });
    }
    function inspectCachedAssets(cache, assets, callback) {
      var missing = [];
      var index = 0;
      function inspectNext() {
        var asset;
        var matched;
        if (index >= assets.length) {
          callback(null, missing);
          return;
        }
        asset = assets[index];
        index += 1;
        try {
          matched = cache.match(asset.cacheKey);
        } catch (error) {
          callback("LEGACY_CACHE_READ_FAILED", null);
          return;
        }
        matched.then(function (response) {
          if (!response) {
            missing.push(asset);
            inspectNext();
            return;
          }
          responseBytes(response, function (readError, bytes) {
            if (readError) {
              cache.delete(asset.cacheKey).then(function () {
                missing.push(asset);
                inspectNext();
              }, function () {
                callback("LEGACY_CACHE_DELETE_FAILED", null);
              });
              return;
            }
            verifyAssetBytes(asset, bytes, function (verifyError) {
              if (!verifyError) {
                inspectNext();
                return;
              }
              cache.delete(asset.cacheKey).then(function () {
                missing.push(asset);
                inspectNext();
              }, function () {
                callback("LEGACY_CACHE_DELETE_FAILED", null);
              });
            });
          });
        }, function () {
          callback("LEGACY_CACHE_READ_FAILED", null);
        });
      }
      inspectNext();
    }
    function checkStorage(missingAssets, callback) {
      var missingBytes = missingAssets.reduce(function (total, asset) {
        return total + asset.bytes;
      }, 0);
      var estimate;
      if (
        missingBytes <= 0 ||
        !window.navigator.storage ||
        typeof window.navigator.storage.estimate !== "function"
      ) {
        callback(null);
        return;
      }
      try {
        estimate = window.navigator.storage.estimate();
      } catch (error) {
        callback(null);
        return;
      }
      estimate.then(function (storage) {
        var quota = Number(storage && storage.quota || 0);
        var usage = Number(storage && storage.usage || 0);
        var reserve = Math.min(
          CONFIG.storageReserveMaximumBytes,
          Math.max(CONFIG.storageReserveBytes, Math.ceil(missingBytes * 0.1))
        );
        if (quota > 0 && quota - usage < missingBytes + reserve) {
          callback("LEGACY_STORAGE_INSUFFICIENT");
          return;
        }
        callback(null);
      }, function () {
        callback(null);
      });
    }
    function downloadAsset(asset, callback) {
      var controller = new AbortController();
      runtime.preparationXhr = controller;
      downloadMedia(asset.url, asset.checksumSha256, asset.bytes, controller.signal).then(function (result) {
        callback(null, result.bytes, result.mimeType);
      }, function (error) {
        callback(error.message || "LEGACY_ASSET_NETWORK_ERROR", null, null);
      });
    }
    function deleteCacheKeys(cache, keys, callback) {
      var index = 0;
      function deleteNext() {
        if (index >= keys.length) {
          callback();
          return;
        }
        cache.delete(keys[index]).then(function () {
          index += 1;
          deleteNext();
        }, function () {
          index += 1;
          deleteNext();
        });
      }
      deleteNext();
    }
    function downloadMissingAssets(cache, assets, callback, generation) {
      var index = 0;
      function fail(code) {
        callback(code);
      }
      function downloadNext() {
        if (generation !== runtime.targetGeneration) { callback("TARGET_SUPERSEDED"); return; }
        var asset;
        if (index >= assets.length) {
          callback(null);
          return;
        }
        asset = assets[index];
        index += 1;
        if (!playerMediaTraffic.allow(asset.cacheKey)) { fail("MEDIA_RETRY_BUDGET_EXCEEDED"); return; }
        playerMediaTraffic.add("cacheMisses", 1);
        setState("DOWNLOADING");
        runtime.syncPhase = "downloading";
        downloadAsset(asset, function (downloadError, bytes, mimeType) {
          if (generation !== runtime.targetGeneration) { callback("TARGET_SUPERSEDED"); return; }
          if (downloadError) {
            playerMediaTraffic.failure(asset.cacheKey);
            fail(downloadError);
            return;
          }
          setState("VERIFYING");
          runtime.syncPhase = "verifying";
          verifyAssetBytes(asset, bytes, function (verifyError) {
            var response;
            if (generation !== runtime.targetGeneration) { callback("TARGET_SUPERSEDED"); return; }
            if (verifyError) {
              playerMediaTraffic.add("corrupt", 1);
              playerMediaTraffic.failure(asset.cacheKey);
              fail(verifyError);
              return;
            }
            if (typeof window.Response !== "function") {
              fail("LEGACY_RESPONSE_UNAVAILABLE");
              return;
            }
            try {
              response = new Response(bytes, {
                headers: {
                  "Accept-Ranges": "bytes",
                  "Content-Length": String(bytes.byteLength),
                  "Content-Type": mimeType || asset.mimeType
                }
              });
            } catch (error) {
              fail("LEGACY_CACHE_RESPONSE_FAILED");
              return;
            }
            cache.put(asset.cacheKey, response).then(function () {
              playerMediaTraffic.success(asset.cacheKey);
              downloadNext();
            }, function () {
              playerMediaTraffic.failure(asset.cacheKey);
              fail("LEGACY_CACHE_WRITE_FAILED");
            });
          });
        });
      }
      downloadNext();
    }
    function preparePendingRelease(envelope, callback) {
      if (!envelope.manifest || envelope.manifest.schemaVersion !== 1) {
        callback({ ok: false, error: "PLAYER_UPDATE_REQUIRED" });
        return;
      }
      var generation = runtime.targetGeneration;
      var assets = releaseAssets(envelope);
      var uniqueAssets;
      if (!assets || !assets.length) {
        callback({ ok: false, error: "LEGACY_RELEASE_ASSETS_INVALID" });
        return;
      }
      uniqueAssets = uniqueReleaseAssets(assets);
      if (!uniqueAssets) {
        callback({ ok: false, error: "LEGACY_RELEASE_ASSETS_CONFLICT" });
        return;
      }
      openAssetCache(function (cacheError, cache) {
        if (generation !== runtime.targetGeneration) { callback({ ok: false, error: "TARGET_SUPERSEDED" }); return; }
        if (cacheError) {
          callback({ ok: false, error: cacheError });
          return;
        }
        setState("VERIFYING");
        runtime.syncPhase = "verifying";
        inspectCachedAssets(cache, uniqueAssets, function (inspectError, missing) {
          if (generation !== runtime.targetGeneration) { callback({ ok: false, error: "TARGET_SUPERSEDED" }); return; }
          if (inspectError) {
            callback({ ok: false, error: inspectError });
            return;
          }
          checkStorage(missing, function (storageError) {
            if (generation !== runtime.targetGeneration) { callback({ ok: false, error: "TARGET_SUPERSEDED" }); return; }
            if (storageError) {
              callback({ ok: false, error: storageError });
              return;
            }
            downloadMissingAssets(cache, missing, function (downloadError) {
              callback(
                downloadError
                  ? { ok: false, error: downloadError }
                  : { ok: true, assets: assets }
              );
            }, generation);
          });
        });
      });
    }
    function refreshDynamicTemplateMediaAccess(currentTemplate, freshTemplate) {
      var currentAssets = currentTemplate && templateRecord(currentTemplate.assets);
      var freshAssets = freshTemplate && templateRecord(freshTemplate.assets);
      var assetId;
      var currentAsset;
      var freshAsset;
      if (!currentAssets || !freshAssets) return;
      for (assetId in freshAssets) {
        if (!Object.prototype.hasOwnProperty.call(freshAssets, assetId)) continue;
        currentAsset = templateRecord(currentAssets[assetId]);
        freshAsset = templateRecord(freshAssets[assetId]);
        if (!currentAsset || !freshAsset ||
          currentAsset.checksumSha256 !== freshAsset.checksumSha256) continue;
        if (typeof freshAsset.url === "string" && freshAsset.url) {
          currentAsset.url = freshAsset.url;
        }
        if (
          currentAsset.posterChecksumSha256 &&
          currentAsset.posterChecksumSha256 === freshAsset.posterChecksumSha256 &&
          typeof freshAsset.posterUrl === "string" &&
          freshAsset.posterUrl
        ) {
          currentAsset.posterUrl = freshAsset.posterUrl;
        }
      }
    }
    function liveDataChanged(freshEnvelope) {
      var currentItems = runtime.envelope && runtime.envelope.manifest.items || [];
      var current = {};
      currentItems.forEach(function (item) { current[item.id] = item.dynamicTemplate && item.dynamicTemplate.snapshotHash; });
      return freshEnvelope.manifest.items.some(function (item) {
        return (item.dynamicTemplate && item.dynamicTemplate.snapshotHash) !== current[item.id];
      });
    }
    function refreshSameReleaseMediaAccess(freshEnvelope) {
      var currentManifest = runtime.envelope && runtime.envelope.manifest;
      var freshManifest = freshEnvelope && freshEnvelope.manifest;
      var currentItems = currentManifest && currentManifest.items;
      var freshItems = freshManifest && freshManifest.items;
      var currentById = {};
      var currentItem;
      var freshItem;
      var index;
      if (!Array.isArray(currentItems) || !Array.isArray(freshItems)) return false;
      for (index = 0; index < currentItems.length; index += 1) {
        currentItem = currentItems[index];
        if (currentItem && typeof currentItem.id === "string") {
          currentById[currentItem.id] = currentItem;
        }
      }
      for (index = 0; index < freshItems.length; index += 1) {
        freshItem = freshItems[index];
        currentItem = freshItem && currentById[freshItem.id];
        if (!currentItem || !currentItem.source || !freshItem.source ||
          currentItem.source.checksumSha256 !== freshItem.source.checksumSha256) {
          continue;
        }
        if (typeof freshItem.source.url === "string" && freshItem.source.url) {
          currentItem.source.url = freshItem.source.url;
        }
        if (
          currentItem.source.posterChecksumSha256 &&
          currentItem.source.posterChecksumSha256 === freshItem.source.posterChecksumSha256 &&
          typeof freshItem.source.posterUrl === "string" &&
          freshItem.source.posterUrl
        ) {
          currentItem.source.posterUrl = freshItem.source.posterUrl;
        }
        if (freshItem.dynamicTemplate && currentItem.dynamicTemplate &&
          freshItem.dynamicTemplate.snapshotHash !== currentItem.dynamicTemplate.snapshotHash) {
          currentItem.dynamicTemplate = freshItem.dynamicTemplate;
          if (runtime.currentItem && runtime.currentItem.id === currentItem.id && runtime.currentElement && runtime.currentElement.refreshPublishedData) {
            (function (item, element, targetGeneration, playbackGeneration) {
              resolveTemplateAssetUrls(item, function (urls, objectUrls) {
                if (!urls || targetGeneration !== runtime.targetGeneration || playbackGeneration !== runtime.playbackGeneration || runtime.currentElement !== element) {
                  revokeObjectUrls(objectUrls || []); return;
                }
                item.dynamicTemplate._legacyLocalAssetUrls = urls;
                var obsoleteDataUrls = element.liveDataObjectUrls || [];
                element.refreshPublishedData(item.dynamicTemplate);
                element.liveDataObjectUrls = objectUrls || [];
                runtime.currentObjectUrls = runtime.currentObjectUrls.filter(function (url) {
                  return obsoleteDataUrls.indexOf(url) === -1;
                }).concat(objectUrls || []);
                revokeObjectUrls(obsoleteDataUrls);
              });
            })(currentItem, runtime.currentElement, runtime.targetGeneration, runtime.playbackGeneration);
          }
        } else {
          refreshDynamicTemplateMediaAccess(currentItem.dynamicTemplate, freshItem.dynamicTemplate);
        }
      }
      runtime.envelope.state = freshEnvelope.state;
      runtime.envelope.fetchedAt = freshEnvelope.fetchedAt;
      runtime.envelope.device = freshEnvelope.device;
      runtime.envelope.diagnostics = freshEnvelope.diagnostics;
      if (freshEnvelope.branding) runtime.envelope.branding = freshEnvelope.branding;
    }
    function observeTarget(envelope) {
      var revision = envelope.target && String(envelope.target.revision);
      if (runtime.targetScreenId !== envelope.device.screenId) {
        runtime.targetRevision = null; runtime.targetKey = null; runtime.targetScreenId = envelope.device.screenId;
      }
      if (runtime.targetRevision && !revision) return false;
      var dataKey = envelope.manifest.items.map(function (item) { return item.dynamicTemplate ? item.dynamicTemplate.snapshotHash : ""; }).join(":");
      var key = String(revision || "legacy") + ":" + releaseIdOf(envelope) + ":" + dataKey;
      if (revision && runtime.targetRevision &&
        (revision.length < runtime.targetRevision.length ||
        (revision.length === runtime.targetRevision.length && revision < runtime.targetRevision))) return false;
      if (key === runtime.targetKey) return true;
      runtime.targetKey = key;
      runtime.targetRevision = revision || null;
      runtime.targetGeneration += 1;
      if (envelope.target && (!runtime.publicationTrace || runtime.publicationTrace.targetRevision !== revision || runtime.publicationTrace.releaseId !== releaseIdOf(envelope))) {
        runtime.publicationTrace = { correlationId: String(now()) + "-" + String(Math.random()).slice(2),
          targetRevision: revision, configRevision: envelope.target.configRevision, publicationId: envelope.target.publicationId,
          releaseId: releaseIdOf(envelope), generation: runtime.targetGeneration, targetWrittenAt: envelope.target.committedAt,
          committedAt: runtime.targetCommit && runtime.targetCommit.revision === envelope.target.revision ? runtime.targetCommit.at : null,
          signalReceivedAt: runtime.signalReceivedAt, resolvedAt: new Date().toISOString() };
        runtime.boundaryMonotonic = null;
      }
      runtime.pendingRelease = null;
      if (runtime.preparationXhr) { runtime.preparationXhr.abort(); runtime.preparationXhr = null; }
      if (runtime.activationTransaction) {
        try { runtime.activationTransaction.abort(); } catch (error) {}
        runtime.activationTransaction = null;
      }
      return true;
    }
    function syncManifest() {
      var forceRefresh = runtime.forceManifestRefresh;
      var headers;
      var knownReleaseId;
      if (runtime.syncInFlight) { runtime.invalidatedDuringFetch = true; return; }
      if (!runtime.deviceToken) {
        ensurePairing();
        return;
      }
      runtime.invalidatedDuringFetch = false;
      headers = {
        Authorization: "Bearer " + runtime.deviceToken,
        "Cache-Control": "no-store"
      };
      knownReleaseId = forceRefresh
        ? null
        : releaseIdOf(
            runtime.pendingRelease
              ? runtime.pendingRelease.envelope
              : runtime.envelope
          );
      // The authorized target ETag includes a separate access-rotation epoch.
      if (!forceRefresh && runtime.manifestEtag) headers["If-None-Match"] = runtime.manifestEtag;
      runtime.syncInFlight = true;
      runtime.manifestRequest = request(
        "GET",
        "/api/player/manifest",
        headers,
        null,
        function (transport, status, body, retryAfter, advertisedVersion, manifestEtag) {
          var code = errorCode(body, transport || "PLAYER_API_UNAVAILABLE");
          runtime.syncInFlight = false;
          runtime.manifestRequest = null;
          if (transport === "ABORTED" && runtime.invalidatedDuringFetch) { scheduleManifestSync(0); return; }
          if (
            advertisedVersion &&
            String(advertisedVersion) !== String(CONFIG.appVersion)
          ) {
            if (runtime.currentElement) {
              runtime.applicationReloadPending = true;
            } else {
              window.location.reload();
              return;
            }
          }
          if (!transport && status === 409) { scheduleManifestSync(100); return; }
          if (!transport && status === 304 && knownReleaseId) {
            clearTemporaryPairing();
            runtime.syncFailures = 0;
            runtime.offline = false;
            byId("offline").className = "";
            if (runtime.pendingRelease) {
              setState("SWITCH_PENDING");
              runtime.syncPhase = "switch_pending";
            } else if (runtime.envelope) {
              setState("PLAYING");
              runtime.syncPhase = "active";
            }
            scheduleManifestSync(CONFIG.manifestIntervalMs);
            sendHeartbeat();
            return;
          }
          if (!transport && status >= 200 && status < 300 && isWaitingEnvelope(body)) {
            clearTemporaryPairing();
            runtime.syncFailures = 0;
            runtime.pendingRelease = null;
            if (runtime.envelope && runtime.currentElement) {
              setState(runtime.offline ? "OFFLINE_PLAYING" : "PLAYING");
              runtime.syncPhase = "active";
              scheduleManifestSync(CONFIG.manifestIntervalMs);
              sendHeartbeat();
              return;
            }
            setState("READY");
            showDefaultWaiting(body);
            scheduleManifestSync(CONFIG.manifestIntervalMs);
            sendHeartbeat();
            return;
          }
          if (!transport && status >= 200 && status < 300 && isManifestEnvelope(body)) {
            if (!observeTarget(body)) { scheduleManifestSync(CONFIG.manifestIntervalMs); return; }
            runtime.manifestEtag = manifestEtag || null;
            clearTemporaryPairing();
            runtime.syncFailures = 0;
            runtime.offline = false;
            byId("offline").className = "";
            if (
              !forceRefresh &&
              releaseIdOf(runtime.envelope) === releaseIdOf(body) && !liveDataChanged(body)
            ) {
              runtime.pendingRelease = null;
              refreshSameReleaseMediaAccess(body);
              setState("PLAYING");
              runtime.syncPhase = "active";
              scheduleManifestSync(CONFIG.manifestIntervalMs);
              sendHeartbeat();
              return;
            }
            if (
              !forceRefresh &&
              runtime.pendingRelease &&
              releaseIdOf(runtime.pendingRelease.envelope) === releaseIdOf(body)
            ) {
              setState("SWITCH_PENDING");
              runtime.syncPhase = "switch_pending";
              scheduleManifestSync(CONFIG.manifestIntervalMs);
              sendHeartbeat();
              return;
            }
            var generation = runtime.targetGeneration;
            scheduleManifestSync(CONFIG.manifestIntervalMs);
            if (runtime.preparingGeneration === generation) return;
            runtime.preparingGeneration = generation;
            runtime.preparationError = null;
            preparePendingRelease(body, function (prepared) {
              if (generation !== runtime.targetGeneration) return;
              runtime.preparingGeneration = null;
              if (!prepared.ok) {
                runtime.manifestEtag = null;
                runtime.syncFailures = Math.min(runtime.syncFailures + 1, 8);
                runtime.syncPhase = "failed";
                runtime.preparationError = prepared.error;
                log(prepared.error, releaseIdOf(body) || "release");
                if (runtime.envelope) {
                  setState(runtime.offline ? "OFFLINE_PLAYING" : "PLAYING");
                } else {
                  showStatus(
                    "Release geweigerd",
                    "Content kon niet lokaal worden voorbereid",
                    "De huidige geldige release blijft behouden. De Player probeert de download automatisch opnieuw.",
                    prepared.error
                  );
                  setState("ERROR_RECOVERABLE");
                }
                scheduleManifestSync(retryDelay(runtime.syncFailures, null));
                sendHeartbeat();
                return;
              }
              if (runtime.publicationTrace && runtime.publicationTrace.releaseId === releaseIdOf(body)) runtime.publicationTrace.assetsReadyAt = new Date().toISOString();
              runtime.forceManifestRefresh = false;
              if (releaseIdOf(runtime.envelope) === releaseIdOf(body)) {
                runtime.pendingRelease = null;
                refreshSameReleaseMediaAccess(body);
                runtime.itemFailures = {};
                setState(runtime.offline ? "OFFLINE_PLAYING" : "PLAYING");
                runtime.syncPhase = "active";
                if (forceRefresh) playCurrent();
                persistRelease(runtime.envelope, prepared.assets, function () {});
                scheduleManifestSync(CONFIG.manifestIntervalMs);
                sendHeartbeat();
                return;
              }
              queuePreparedRelease(
                body,
                prepared.assets,
                function (queueError) {
                    if (queueError) {
                    runtime.syncFailures = Math.min(
                      runtime.syncFailures + 1,
                      8
                    );
                    scheduleManifestSync(
                      retryDelay(runtime.syncFailures, null)
                    );
                  } else {
                    scheduleManifestSync(CONFIG.manifestIntervalMs);
                  }
                  sendHeartbeat();
                }
              );
            });
            return;
          }
          if (code === "PAIRING_PENDING" && runtime.state === "PAIRING_CODE_ACTIVE") {
            showPairing(
              safeRead(CONFIG.pairingCodeKey) || "",
              "Voer de code in Control in. De Player controleert de koppeling automatisch."
            );
            scheduleManifestSync(3000);
            return;
          }
          if (definitiveCredentialCodes[code] || status === 403 || status === 410) {
            clearInvalidDeviceCredential();
            setState("UNPAIRED");
            ensurePairing();
            return;
          }
          if (runtime.state === "PAIRING_CODE_ACTIVE") {
            showPairing(
              safeRead(CONFIG.pairingCodeKey) || "",
              "Voer de code in Control in. De Player controleert de koppeling automatisch."
            );
            scheduleManifestSync(3000);
            return;
          }
          restoreLastKnownGood(function (restored) {
            if (!restored) {
              scheduleBoot(
                code,
                errorCause(body, "Online synchronisatie is tijdelijk mislukt."),
                null
              );
            } else {
              scheduleManifestSync(retryDelay(runtime.syncFailures, null));
            }
          });
        }
      );
    }
    function invalidateManifest() {
      runtime.invalidatedDuringFetch = true;
      if (runtime.syncInFlight && runtime.manifestRequest) {
        runtime.manifestRequest.abort();
      }
      scheduleManifestSync(0);
    }
    function scheduleManifestSync(delay) {
      // Consume invalidation only when the read starts. A finishing preparation
      // must not replace an already requested immediate read with an 8 s timer.
      if (runtime.invalidatedDuringFetch) delay = 0;
      window.clearTimeout(runtime.retryTimer);
      runtime.retryTimer = window.setTimeout(syncManifest, delay + (delay > 0 ? Math.random() * Math.min(750, delay * .1) : 0));
    }
    function openPlayerDatabase(callback) {
      var open;
      if (!window.indexedDB) {
        callback("LEGACY_INDEXEDDB_UNAVAILABLE", null);
        return;
      }
      try {
        open = window.indexedDB.open(
          CONFIG.databaseName,
          CONFIG.databaseVersion
        );
      } catch (error) {
        callback("LEGACY_INDEXEDDB_OPEN_FAILED", null);
        return;
      }
      open.onupgradeneeded = function () {
        var database = open.result;
        if (!database.objectStoreNames.contains(CONFIG.activeReleaseStore)) {
          database.createObjectStore(CONFIG.activeReleaseStore, {
            keyPath: "deviceToken"
          });
        }
        if (!database.objectStoreNames.contains(CONFIG.previousReleaseStore)) {
          database.createObjectStore(CONFIG.previousReleaseStore, {
            keyPath: "deviceToken"
          });
        }
      };
      open.onerror = function () {
        callback("LEGACY_INDEXEDDB_OPEN_FAILED", null);
      };
      open.onsuccess = function () {
        callback(null, open.result);
      };
    }
    function validateCachedRelease(cached, callback) {
      var assets;
      var uniqueAssets;
      if (
        !cached ||
        !cached.envelope ||
        !isManifestEnvelope(cached.envelope) ||
        !Array.isArray(cached.assets)
      ) {
        callback(false);
        return;
      }
      assets = cached.assets;
      uniqueAssets = uniqueReleaseAssets(assets);
      if (!uniqueAssets || !uniqueAssets.length) {
        callback(false);
        return;
      }
      openAssetCache(function (cacheError, cache) {
        if (cacheError) {
          callback(false);
          return;
        }
        inspectCachedAssets(cache, uniqueAssets, function (inspectError, missing) {
          callback(!inspectError && missing && missing.length === 0);
        });
      });
    }
    function readReleaseStore(deviceToken, storeName, callback) {
      openPlayerDatabase(function (openError, database) {
        var transaction;
        var requestResult;
        if (openError || !database) {
          callback(null);
          return;
        }
        try {
          transaction = database.transaction(storeName, "readonly");
          requestResult = transaction.objectStore(storeName).get(deviceToken);
        } catch (error) {
          database.close();
          callback(null);
          return;
        }
        requestResult.onerror = function () {
          database.close();
          callback(null);
        };
        requestResult.onsuccess = function () {
          var cached = requestResult.result;
          database.close();
          validateCachedRelease(cached, function (valid) {
            callback(valid ? cached : null);
          });
        };
      });
    }
    function readCachedRelease(deviceToken, callback) {
      readReleaseStore(
        deviceToken,
        CONFIG.activeReleaseStore,
        function (active) {
          if (active) {
            callback(active);
            return;
          }
          deleteStoredRelease(
            deviceToken,
            CONFIG.activeReleaseStore,
            function () {
              readReleaseStore(
                deviceToken,
                CONFIG.previousReleaseStore,
                callback
              );
            }
          );
        }
      );
    }
    function deleteStoredRelease(deviceToken, storeName, callback) {
      openPlayerDatabase(function (openError, database) {
        var transaction;
        if (openError || !database) {
          callback();
          return;
        }
        try {
          transaction = database.transaction(storeName, "readwrite");
          transaction.objectStore(storeName).delete(deviceToken);
        } catch (error) {
          database.close();
          callback();
          return;
        }
        transaction.onabort = function () {
          try { database.close(); } catch (error) {}
          callback();
        };
        transaction.oncomplete = function () {
          try { database.close(); } catch (error) {}
          callback();
        };
      });
    }
    function persistRelease(envelope, assets, callback) {
      var targetGeneration = runtime.targetGeneration;
      var completed = false;
      function finish(error, cached) {
        if (completed) return;
        completed = true;
        callback(error, cached);
      }
      openPlayerDatabase(function (openError, database) {
        var transaction;
        var activeStore;
        var previousStore;
        var currentRequest;
        var cached;
        if (openError || !database) {
          finish(openError || "LEGACY_INDEXEDDB_OPEN_FAILED", null);
          return;
        }
        if (targetGeneration !== runtime.targetGeneration) { database.close(); finish("TARGET_SUPERSEDED", null); return; }
        cached = {
          activatedAt: new Date().toISOString(),
          assets: assets,
          deviceToken: runtime.deviceToken,
          envelope: envelope
        };
        try {
          transaction = database.transaction(
            [CONFIG.activeReleaseStore, CONFIG.previousReleaseStore],
            "readwrite"
          );
          runtime.activationTransaction = transaction;
          activeStore = transaction.objectStore(CONFIG.activeReleaseStore);
          previousStore = transaction.objectStore(CONFIG.previousReleaseStore);
          currentRequest = activeStore.get(runtime.deviceToken);
        } catch (error) {
          database.close();
          finish("LEGACY_RELEASE_PERSIST_FAILED", null);
          return;
        }
        currentRequest.onerror = function () {
          try { transaction.abort(); } catch (error) {}
        };
        currentRequest.onsuccess = function () {
          if (targetGeneration !== runtime.targetGeneration) { transaction.abort(); return; }
          var current = currentRequest.result;
          if (
            current &&
            releaseIdOf(current.envelope) !== releaseIdOf(envelope)
          ) {
            previousStore.put(current);
          }
          activeStore.put(cached);
        };
        transaction.onerror = function () {};
        transaction.onabort = function () {
          if (runtime.activationTransaction === transaction) runtime.activationTransaction = null;
          try { database.close(); } catch (error) {}
          finish("LEGACY_RELEASE_PERSIST_FAILED", null);
        };
        transaction.oncomplete = function () {
          if (runtime.activationTransaction === transaction) runtime.activationTransaction = null;
          try { database.close(); } catch (error) {}
          runtime.cachedRelease = cached;
          finish(null, cached);
          if (runtime.preparingGeneration === null && !runtime.pendingRelease) garbageCollectCachedMedia();
        };
      });
    }
    function garbageCollectCachedMedia() {
      if (!runtime.deviceToken) return;
      openPlayerDatabase(function (openError, database) {
        var transaction;
        var activeRequest;
        var previousRequest;
        if (openError || !database) return;
        try {
          transaction = database.transaction(
            [CONFIG.activeReleaseStore, CONFIG.previousReleaseStore],
            "readonly"
          );
          activeRequest = transaction
            .objectStore(CONFIG.activeReleaseStore)
            .get(runtime.deviceToken);
          previousRequest = transaction
            .objectStore(CONFIG.previousReleaseStore)
            .get(runtime.deviceToken);
        } catch (error) {
          database.close();
          return;
        }
        transaction.oncomplete = function () {
          var releases = [activeRequest.result, previousRequest.result];
          var retained = {};
          var releaseIndex;
          var assetIndex;
          database.close();
          for (releaseIndex = 0; releaseIndex < releases.length; releaseIndex += 1) {
            if (!releases[releaseIndex] || !Array.isArray(releases[releaseIndex].assets)) {
              continue;
            }
            for (
              assetIndex = 0;
              assetIndex < releases[releaseIndex].assets.length;
              assetIndex += 1
            ) {
              retained[releases[releaseIndex].assets[assetIndex].cacheKey] = true;
            }
          }
          openAssetCache(function (cacheError, cache) {
            if (cacheError) return;
            cache.keys().then(function (requests) {
              var obsolete = requests.filter(function (requestValue) {
                var path = new URL(requestValue.url).pathname;
                return path.indexOf(CONFIG.cachePathPrefix) === 0 &&
                  !retained[path];
              });
              deleteCacheKeys(cache, obsolete, function () {});
            }, function () {});
          });
        };
      });
    }
    function queuePreparedRelease(envelope, assets, callback) {
      if (runtime.envelope && runtime.currentElement) {
        runtime.pendingRelease = {
          assets: assets,
          envelope: envelope,
          generation: runtime.targetGeneration
        };
        setState("SWITCH_PENDING");
        runtime.syncPhase = "switch_pending";
        log(
          "LEGACY_RELEASE_SWITCH_PENDING",
          releaseIdOf(envelope) || "release"
        );
        callback(null);
        return;
      }
      persistRelease(envelope, assets, function (persistError) {
        if (persistError) {
          runtime.syncPhase = "failed";
          showStatus(
            "Release geweigerd",
            "Lokale activatie is mislukt",
            "De geverifieerde bestanden konden niet atomair als actieve release worden opgeslagen.",
            persistError
          );
          setState("ERROR_RECOVERABLE");
          callback(persistError);
          return;
        }
        startRelease(envelope, "cache");
        callback(null);
      });
    }
    function restoreLastKnownGood(callback) {
      if (!runtime.deviceToken) { callback(false); return; }
      if (runtime.envelope && runtime.currentElement) {
        runtime.offline = true;
        runtime.releaseSource = "cache";
        byId("offline").className = "visible";
        setState("OFFLINE_PLAYING");
        runtime.syncPhase = "active";
        callback(true);
        return;
      }
      readCachedRelease(runtime.deviceToken, function (cached) {
        if (!cached) {
          callback(false);
          return;
        }
        runtime.cachedRelease = cached;
        runtime.envelope = cached.envelope;
        runtime.releaseSource = "cache";
        runtime.offline = true;
        byId("offline").className = "visible";
        startRelease(cached.envelope, "cache");
        callback(true);
      });
    }
    function playableItems(envelope) {
      var items = envelope && envelope.manifest && envelope.manifest.items;
      if (!Array.isArray(items)) return [];
      return items.filter(function (item) {
        return item &&
          item.enabled !== false &&
          (item.kind === "image" || item.kind === "video") &&
          item.source &&
          typeof item.source.url === "string" &&
          legacyDynamicTemplateHasRenderableContent(item);
      });
    }
    function legacyDynamicTemplateHasRenderableContent(item) {
      var payload = item && item.dynamicTemplate;
      var data;
      var sport;
      var slideType;
      var items;
      if (!payload) return true;
      data = templateRecord(payload.data) || {};
      sport = templateRecord(data.sport) || {};
      slideType = String(payload.slideType || "");
      if (slideType === "news") {
        var news = templateRecord(data.news) || templateRecord(data.data) || {};
        return templateArray(news.articles, 200).some(function (value) {
          var article = templateRecord(value) || {};
          return Boolean(templateText(article.title, ""));
        });
      }
      if (slideType === "menu") {
        var menu = templateRecord(data.menu) || templateRecord(data.data) || {};
        return templateArray(menu.products, 200).some(function (value) {
          var product = templateRecord(value) || {};
          return Boolean(templateText(product.name, ""));
        });
      }
      if (slideType === "price_list") {
        var menuDocument = templateRecord(data.menuDocument) || {};
        if (menuDocument.schemaVersion === "menu-document.v2") {
          return templateArray(menuDocument.pages, 200).some(function (pageValue) {
            var page = templateRecord(pageValue) || {};
            return templateArray(page.blocks, 200).some(function (blockValue) {
              var block = templateRecord(blockValue) || {};
              if (block.hidden === true) return false;
              if (block.type === "product-group") {
                var group = templateRecord(block.group) || {};
                return Boolean(templateText(group.title, ""));
              }
              if (block.type !== "category") return false;
              return templateArray(block.productNodes, 200).some(function (nodeValue) {
                var node = templateRecord(nodeValue) || {};
                if (node.kind === "product-group") {
                  return Boolean(templateText(node.title, ""));
                }
                var fallback = templateRecord(node.snapshotFallback) || {};
                return Boolean(templateText(node.nameOverride, templateText(fallback.name, "")));
              });
            });
          });
        }
        var priceList = templateRecord(data.priceList) || {};
        return templateArray(priceList.sections, 200).some(function (sectionValue) {
          var section = templateRecord(sectionValue) || {};
          return templateArray(section.products, 200).some(function (productValue) {
            var product = templateRecord(productValue) || {};
            return Boolean(templateText(product.name, ""));
          });
        });
      }
      items = templateArray(slideType === "sport_birthdays"
        ? (sport.birthdays || sport.items)
        : sport.items, 200).filter(function (row) {
          return sportMatchBelongsOnSlide(slideType, templateRecord(row) || {}, new Date().getTime());
        });
      if (slideType === "sport_visitor_arrivals") {
        return items.some(function (value) {
          var entry = templateRecord(value) || {};
          return entry.homeMatch === true && Boolean(
            templateText(entry.awayTeam || entry.primary, "")
          );
        });
      }
      if (slideType === "sport_match_of_the_day" || slideType === "sport_next_match") {
        return Boolean(items.length && templateRecord(items[0]));
      }
      if (slideType === "sport_standing" || slideType === "sport_period_standing") {
        return items.some(function (value) {
          var team = templateRecord(value) || {};
          return Boolean(templateText(team.teamName, ""));
        });
      }
      if (slideType === "sport_birthdays") {
        return items.some(function (value) {
          var birthday = templateRecord(value) || {};
          return Boolean(templateText(birthday.displayName || birthday.primary, ""));
        });
      }
      if (slideType === "sport_visitor_arrivals" || slideType === "sport_referee_arrivals" ||
        slideType.indexOf("sport_") === 0) {
        return items.some(function (value) {
          var entry = templateRecord(value) || {};
          return Boolean(templateText(entry.primary || entry.homeTeam || entry.teamName, ""));
        });
      }
      return true;
    }
    function startRelease(envelope, source) {
      var items = playableItems(envelope);
      if (!items.length) {
        showDefaultWaiting(envelope);
        setState("READY");
        return;
      }
      runtime.envelope = envelope;
      runtime.releaseSource = source;
      runtime.activeIndex = runtime.activeIndex % items.length;
      runtime.itemFailures = {};
      runtime.pendingRelease = null;
      runtime.syncPhase = "active";
      playCurrent();
    }
    function clearPlaybackTimers() {
      window.clearTimeout(runtime.playbackTimer);
      window.clearTimeout(runtime.watchdogTimer);
      window.clearInterval(runtime.progressTimer);
      window.clearTimeout(runtime.templateTimer);
      window.clearInterval(runtime.matchCentreClockTimer);
      window.clearInterval(runtime.ledScoresLiveMatchTimer);
      runtime.playbackTimer = null;
      runtime.playbackDeadlineAt = 0;
      if (!runtime.goalPauseApplied) runtime.playbackRemainingMs = null;
      runtime.watchdogTimer = null;
      runtime.progressTimer = null;
      runtime.templateDeadlineAt = 0;
      runtime.templateRemainingMs = null;
      runtime.templateResumeCallback = null;
      runtime.templateTimer = null;
      runtime.matchCentreClockTimer = null;
      runtime.ledScoresLiveMatchTimer = null;
      runtime.ledScoresLiveMatchRender = null;
    }
    function schedulePlaybackAdvance(delay) {
      var boundedDelay = Math.max(1, Math.min(3600000, Number(delay) || 1));
      window.clearTimeout(runtime.playbackTimer);
      runtime.playbackTimer = null;
      runtime.playbackDeadlineAt = 0;
      if (runtime.goalPauseApplied) {
        runtime.playbackRemainingMs = boundedDelay;
        return;
      }
      runtime.playbackRemainingMs = null;
      runtime.playbackDeadlineAt = monotonicNow() + boundedDelay;
      runtime.playbackTimer = window.setTimeout(function () {
        runtime.playbackTimer = null;
        runtime.playbackDeadlineAt = 0;
        nextItem();
      }, boundedDelay);
    }
    function scheduleTemplateAdvance(callback, delay) {
      var boundedDelay = Math.max(1, Math.min(3600000, Number(delay) || 1));
      window.clearTimeout(runtime.templateTimer);
      runtime.templateTimer = null;
      runtime.templateDeadlineAt = 0;
      runtime.templateResumeCallback = callback;
      if (runtime.goalPauseApplied) {
        runtime.templateRemainingMs = boundedDelay;
        return;
      }
      runtime.templateRemainingMs = null;
      runtime.templateDeadlineAt = monotonicNow() + boundedDelay;
      runtime.templateTimer = window.setTimeout(function () {
        runtime.templateTimer = null;
        runtime.templateDeadlineAt = 0;
        callback();
      }, boundedDelay);
    }
    function revokeObjectUrls(urls) {
      var index;
      if (!window.URL || typeof window.URL.revokeObjectURL !== "function") return;
      for (index = 0; index < urls.length; index += 1) {
        try { window.URL.revokeObjectURL(urls[index]); } catch (error) {}
      }
    }
    function disposeMediaElement(element, objectUrls) {
      if (!element) {
        revokeObjectUrls(objectUrls || []);
        return;
      }
      if (element.birthdayCleanup) { element.birthdayCleanup(); element.birthdayCleanup = null; }
      if (element.tagName === "VIDEO") {
        element.oncanplay = null;
        element.onended = null;
        element.onerror = null;
        element.onloadedmetadata = null;
        element.onplaying = null;
        element.ontimeupdate = null;
        try { element.pause(); } catch (error) {}
        element.removeAttribute("src");
        try { element.load(); } catch (error) {}
      } else if (element.tagName === "IMG") {
        element.onload = null;
        element.onerror = null;
        element.removeAttribute("src");
      }
      if (element.parentNode) element.parentNode.removeChild(element);
      revokeObjectUrls(objectUrls || []);
    }
    function cancelPendingMedia() {
      if (runtime.pendingElement) {
        disposeMediaElement(
          runtime.pendingElement,
          runtime.pendingObjectUrls
        );
      }
      runtime.pendingElement = null;
      runtime.pendingObjectUrls = [];
    }
    function clearMedia() {
      runtime.playbackGeneration += 1;
      clearPlaybackTimers();
      cancelPendingMedia();
      disposeMediaElement(runtime.currentElement, runtime.currentObjectUrls);
      byId("media-root").innerHTML = "";
      runtime.currentElement = null;
      runtime.currentObjectUrls = [];
    }
    function beginPendingMedia(element, objectUrls) {
      cancelPendingMedia();
      element.className += (element.className ? " " : "") + "legacy-media-layer";
      runtime.pendingElement = element;
      runtime.pendingObjectUrls = objectUrls || [];
      byId("media-root").appendChild(element);
    }
    function commitPendingMedia(element, objectUrls, generation) {
      var previousElement;
      var previousObjectUrls;
      if (
        generation !== runtime.playbackGeneration ||
        runtime.pendingElement !== element
      ) {
        disposeMediaElement(element, objectUrls || []);
        return false;
      }
      previousElement = runtime.currentElement;
      previousObjectUrls = runtime.currentObjectUrls;
      runtime.pendingElement = null;
      runtime.pendingObjectUrls = [];
      runtime.currentElement = element;
      runtime.currentObjectUrls = objectUrls || [];
      element.className += " visible";
      if (previousElement && previousElement.birthdayCleanup) { previousElement.birthdayCleanup(); previousElement.birthdayCleanup = null; }
      if (previousElement && previousElement !== element) {
        previousElement.className += " retiring";
        window.setTimeout(function () {
          disposeMediaElement(previousElement, previousObjectUrls);
        }, 220);
      }
      var confirmedReleaseId = releaseIdOf(runtime.envelope);
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
        if (runtime.currentElement !== element || generation !== runtime.playbackGeneration) return;
        runtime.presentedReleaseId = confirmedReleaseId;
        if (runtime.publicationTrace && runtime.publicationTrace.releaseId === confirmedReleaseId && !runtime.publicationTrace.firstFrameAt) {
          runtime.publicationTrace.firstFrameAt = new Date().toISOString();
          if (runtime.boundaryMonotonic !== null) runtime.publicationTrace.frameAfterBoundaryMs = Math.max(0, monotonicNow() - runtime.boundaryMonotonic);
        }
        mediaReady();
        });
      });
      return true;
    }
    function silenceCurrentMediaEvents() {
      var element = runtime.currentElement;
      if (!element) return;
      if (element.tagName === "VIDEO") {
        element.oncanplay = null;
        element.onended = null;
        element.onerror = null;
        element.onloadedmetadata = null;
        element.onplaying = null;
        element.ontimeupdate = null;
      } else if (element.tagName === "IMG") {
        element.onload = null;
        element.onerror = null;
      }
    }
    function mediaStyle(item, element) {
      var defaults = runtime.envelope.manifest.presentationDefaults || {};
      var fit = item.fitMode || defaults.fitMode || "contain";
      element.style.objectFit = fit === "cover" ? "cover" : "contain";
      element.style.objectPosition = item.cropFocus
        ? String(Number(item.cropFocus.x) * 100) + "% " + String(Number(item.cropFocus.y) * 100) + "%"
        : "50% 50%";
      byId("media-root").style.backgroundColor =
        item.backgroundColor || defaults.backgroundColor || "#050505";
    }
    function cachedAssetUrl(source, callback) {
      var cacheKey;
      if (
        !source ||
        typeof source.checksumSha256 !== "string" ||
        !window.caches
      ) {
        callback(null, null);
        return;
      }
      cacheKey = CONFIG.cachePathPrefix + source.checksumSha256;
      window.caches.open(CONFIG.cacheName).then(function (cache) {
        return cache.match(cacheKey);
      }).then(function (response) {
        if (!response) { callback(null, null); return; }
        if (
          window.URL &&
          typeof window.URL.createObjectURL === "function" &&
          typeof response.blob === "function"
        ) {
          response.blob().then(function (blob) {
            var objectUrl = window.URL.createObjectURL(blob);
            playerMediaTraffic.add("cacheHits", 1);
            playerMediaTraffic.add("localReadBytes", blob.size);
            callback(objectUrl, objectUrl);
          }, function () { callback(null, null); });
          return;
        }
        callback(null, null);
      }, function () { callback(null, null); });
    }
    function cachedItemUrl(item, callback) {
      cachedAssetUrl(item && item.source, callback);
    }
    function sourceForItem(item, callback) {
      // Online and offline use the same verified bytes. Signed URLs are delivery
      // credentials, never the preferred source of an already cached video.
      cachedItemUrl(item, callback);
    }
    function preloadLocalImage(url, callback) {
      var image = document.createElement("img");
      var completed = false;
      function finish() {
        if (completed) return;
        completed = true;
        image.onload = null;
        image.onerror = null;
        callback();
      }
      image.onload = function () {
        var decoded;
        if (typeof image.decode !== "function") {
          finish();
          return;
        }
        try { decoded = image.decode(); } catch (error) {
          finish();
          return;
        }
        if (decoded && typeof decoded.then === "function") {
          decoded.then(finish, finish);
        } else {
          finish();
        }
      };
      image.onerror = finish;
      image.src = url;
    }
    function resolveTemplateAssetUrls(item, callback) {
      var templateAssets = item.dynamicTemplate &&
        templateRecord(item.dynamicTemplate.assets);
      var assetIds = [];
      var urls = {};
      var objectUrls = [];
      var assetId;
      var index = 0;
      if (!templateAssets) {
        callback(urls, objectUrls);
        return;
      }
      for (assetId in templateAssets) {
        if (Object.prototype.hasOwnProperty.call(templateAssets, assetId)) {
          assetIds.push(assetId);
        }
      }
      function resolveNext() {
        var currentId;
        if (index >= assetIds.length) {
          index = 0;
          preloadNext();
          return;
        }
        currentId = assetIds[index];
        index += 1;
        cachedAssetUrl(templateAssets[currentId], function (url, objectUrl) {
          if (!url) {
            revokeObjectUrls(objectUrls);
            callback(null, []);
            return;
          }
          urls[currentId] = url;
          if (objectUrl) objectUrls.push(objectUrl);
          resolveNext();
        });
      }
      function preloadNext() {
        var currentId;
        if (index >= assetIds.length) {
          callback(urls, objectUrls);
          return;
        }
        currentId = assetIds[index];
        index += 1;
        preloadLocalImage(urls[currentId], preloadNext);
      }
      resolveNext();
    }
    function playCurrent() {
      var items = playableItems(runtime.envelope);
      var item;
      var generation;
      if (!items.length) return;
      hideDefaultWaiting();
      runtime.activeIndex = runtime.activeIndex % items.length;
      item = items[runtime.activeIndex];
      runtime.currentItem = item;
      setState(runtime.offline ? "OFFLINE_PLAYING" : "PLAYING");
      runtime.syncPhase = runtime.pendingRelease ? "switch_pending" : "active";
      runtime.playbackGeneration += 1;
      generation = runtime.playbackGeneration;
      clearPlaybackTimers();
      cancelPendingMedia();
      silenceCurrentMediaEvents();
      sourceForItem(item, function (sourceUrl, objectUrl, networkVideoSource) {
        var objectUrls = objectUrl ? [objectUrl] : [];
        if (
          generation !== runtime.playbackGeneration ||
          item !== runtime.currentItem
        ) {
          revokeObjectUrls(objectUrls);
          return;
        }
        if (!sourceUrl) {
          failItem("LEGACY_CACHE_MISSING");
          return;
        }
        if (validDynamicTemplate(item.dynamicTemplate)) {
          resolveTemplateAssetUrls(item, function (templateUrls, templateObjectUrls) {
            if (
              generation !== runtime.playbackGeneration ||
              item !== runtime.currentItem
            ) {
              revokeObjectUrls(objectUrls.concat(templateObjectUrls || []));
              return;
            }
            if (!templateUrls) {
              revokeObjectUrls(objectUrls);
              failItem("LEGACY_TEMPLATE_CACHE_MISSING");
              return;
            }
            item.dynamicTemplate._legacyLocalAssetUrls = templateUrls;
            objectUrls = objectUrls.concat(templateObjectUrls);
            try {
              playDynamicTemplate(item, sourceUrl, objectUrls, generation);
            } catch (error) {
              log("LEGACY_TEMPLATE_ERROR", String(error && error.message || error));
              if (item.kind === "video") {
                playVideo(item, sourceUrl, objectUrls, generation, networkVideoSource === true);
              } else {
                playImage(item, sourceUrl, objectUrls, generation);
              }
            }
          });
        } else if (item.kind === "video") {
          playVideo(item, sourceUrl, objectUrls, generation, networkVideoSource === true);
        } else {
          playImage(item, sourceUrl, objectUrls, generation);
        }
      });
    }
    function mediaReady() {
      if (runtime.currentItem && runtime.currentItem.id) {
        delete runtime.itemFailures[runtime.currentItem.id];
      }
      byId("status").hidden = true;
      byId("watermark").className = "visible";
      hidePairing();
      sendHeartbeat();
    }
    function itemDurationMs(item) {
      var defaults = runtime.envelope.manifest.presentationDefaults || {};
      var seconds = Number(item.durationSeconds || defaults.imageDurationSeconds || 10);
      if (!isFinite(seconds) || seconds < 1) seconds = 10;
      return Math.min(3600000, Math.max(1000, Math.round(seconds * 1000)));
    }
    function validDynamicTemplate(value) {
      return value &&
        value.schemaVersion === 1 &&
        typeof value.templateSlug === "string" &&
        /^[a-z0-9][a-z0-9-]{0,119}$/.test(value.templateSlug) &&
        typeof value.slideType === "string" &&
        (
          value.templateSlug.indexOf("editorial-arena-") !== 0 ||
          editorialArenaSlideTypes.indexOf(value.slideType) !== -1
        ) &&
        (value.orientation === "portrait" || value.orientation === "landscape") &&
        value.data &&
        typeof value.data === "object";
    }
    var editorialArenaSlideTypes = [
      "menu",
      "price_list",
      "news",
      "sport_activities",
      "sport_birthdays",
      "sport_cancellations",
      "sport_dressing_rooms",
      "sport_match_of_the_day",
      "sport_next_match",
      "sport_officials",
      "sport_period_standing",
      "sport_program",
      "sport_referee_arrivals",
      "sport_results",
      "sport_standing",
      "sport_sponsor",
      "sport_team",
      "sport_trainings",
      "sport_volunteers",
      "sport_visitor_arrivals"
    ];
    function templateRecord(value) {
      return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
    }
    function templateArray(value, maximum) {
      var limit = Number(maximum) === 100 ? 100 : 40;
      return Array.isArray(value) ? value.slice(0, limit) : [];
    }
    function legacyBirthdayPageSize(value, fallback) {
      var parsed = Number(value);
      var allowed = [1, 2, 4, 6];
      if (allowed.indexOf(parsed) !== -1) return parsed;
      if (parsed <= 1) return 1;
      if (parsed <= 2) return 2;
      if (parsed <= 4) return 4;
      if (parsed === 6) return 6;
      return fallback || 6;
    }
    function templateText(value, fallback) {
      var normalized;
      if (typeof value !== "string") return fallback || "";
      normalized = value.replace(/\\s+/g, " ").replace(/^\\s+|\\s+$/g, "");
      return normalized ? normalized.slice(0, 500) : fallback || "";
    }
    function templateThemeFontFamily(fontFamilies, fontRef, fallbackRef) {
      var family = templateText(
        fontFamilies && fontFamilies[fontRef],
        templateText(fontFamilies && fontFamilies[fallbackRef], "Arial")
      );
      return family === "Roboto"
        ? '"VeyoCast Royal Current Roboto"'
        : '"' + family.replace(/"/g, "") + '"';
    }
    function templateVisitorArrivalValue(value, kind) {
      var prefix = kind === "field"
        ? /^\\s*Veld\\s*:?\\s*/i
        : /^\\s*Kleedkamer\\s*:?\\s*/i;
      var normalized = templateText(value, "").replace(prefix, "").replace(/^\\s+|\\s+$/g, "");
      return /^(?:volgt|onbekend|unknown|n\\.?\\/a\\.?|n\\.v\\.?)$/i.test(normalized)
        ? ""
        : normalized;
    }
    function templateVisitorMetaValue(meta, kind) {
      var pattern = kind === "field"
        ? /\\bVeld\\s*:?\\s*([^·|]+)/i
        : /\\bKleedkamer\\s*:?\\s*([^·|]+)/i;
      var match = templateText(meta, "").match(pattern);
      return match && match[1] ? match[1] : "";
    }
    function templateVisitorClock(item) {
      var values = [item.kickoffTime, item.time];
      var index;
      var match;
      for (index = 0; index < values.length; index += 1) {
        match = templateText(values[index], "").match(/(?:^|\\s)([0-2]?\\d:[0-5]\\d)(?:\\s|$)/);
        if (match && match[1]) return match[1].length === 4 ? "0" + match[1] : match[1];
      }
      match = templateText(item.secondary, "").match(
        /\\bAanvang\\s*:?\\s*([0-2]?\\d:[0-5]\\d)\\b/i
      );
      if (!match || !match[1]) return "";
      return match[1].length === 4 ? "0" + match[1] : match[1];
    }
    function templateVisitorArrivalDate(value, timezone) {
      var instant = new Date(templateText(value, ""));
      var parts;
      var read;
      if (!isFinite(instant.getTime())) return "";
      try {
        parts = new Intl.DateTimeFormat("en-GB", {
          day: "2-digit",
          month: "2-digit",
          timeZone: templateText(timezone, "Europe/Amsterdam"),
          year: "numeric"
        }).formatToParts(instant);
        read = function (type) {
          var index;
          for (index = 0; index < parts.length; index += 1) {
            if (parts[index].type === type) return parts[index].value;
          }
          return "";
        };
        return read("day") + "-" + read("month") + "-" + read("year");
      } catch (error) {
        return templateClockPad(instant.getUTCDate()) + "-" +
          templateClockPad(instant.getUTCMonth() + 1) + "-" +
          String(instant.getUTCFullYear());
      }
    }
    function templateVisitorVenueWelcome(page) {
      var venues = {};
      var names = [];
      var index;
      var item;
      var venue;
      var venueCount = 0;
      for (index = 0; index < (page || []).length; index += 1) {
        item = templateRecord(page[index]) || {};
        venue = templateText(item.venueName, "");
        if (venue) venueCount += 1;
        if (venue && !venues[venue]) {
          venues[venue] = true;
          names.push(venue);
        }
      }
      if (names.length !== 1 || venueCount !== (page || []).length) {
        return "Welkom op ons sportpark!";
      }
      return "Welkom op " + names[0] + "!";
    }
    function templateVisitorArrivalItems(items, timezone) {
      var currentTime = new Date().getTime();
      return items.filter(function (candidate) {
        return (templateRecord(candidate) || {}).homeMatch === true;
      }).map(function (candidate, index) {
        var source = templateRecord(candidate) || {};
        var item = {};
        var key;
        var kickoffTime;
        var field;
        var awayRoom;
        var homeRoom;
        var kickoffMs;
        for (key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) item[key] = source[key];
        }
        kickoffTime = templateVisitorClock(item);
        field = templateVisitorArrivalValue(item.field, "field") ||
          templateVisitorArrivalValue(templateVisitorMetaValue(item.meta, "field"), "field");
        awayRoom = templateVisitorArrivalValue(item.awayRoom, "dressing-room") ||
          templateVisitorArrivalValue(item.dressingRoom, "dressing-room") ||
          templateVisitorArrivalValue(
            templateVisitorMetaValue(item.meta, "dressing-room"),
            "dressing-room"
          );
        homeRoom = templateVisitorArrivalValue(
          templateText(item.homeRoom, ""),
          "dressing-room"
        );
        kickoffMs = Date.parse(templateText(item.kickoffAt, ""));
        item.awayRoom = awayRoom;
        item.date = templateText(
          item.date,
          templateVisitorArrivalDate(item.kickoffAt, timezone)
        );
        item.kickoffTime = kickoffTime;
        item.field = field;
        item.homeRoom = homeRoom;
        item.dressingRoom = awayRoom;
        item.secondary = "Aanvang: " + (kickoffTime || "-") + " | Veld " + (field || "-");
        item.meta = "Kleedkamer: " + (awayRoom || "-");
        return {
          index: index,
          item: item,
          kickoffMs: isFinite(kickoffMs) ? kickoffMs : null
        };
      }).sort(function (left, right) {
        var leftUpcoming = left.kickoffMs !== null && left.kickoffMs >= currentTime;
        var rightUpcoming = right.kickoffMs !== null && right.kickoffMs >= currentTime;
        if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;
        if (left.kickoffMs !== null && right.kickoffMs !== null) {
          return leftUpcoming
            ? left.kickoffMs - right.kickoffMs
            : right.kickoffMs - left.kickoffMs;
        }
        if (left.kickoffMs !== null) return -1;
        if (right.kickoffMs !== null) return 1;
        return left.index - right.index;
      }).map(function (entry) {
        return entry.item;
      });
    }
    function templateProductTitleClass(value) {
      var length = templateText(value, "").length;
      if (length > 36) return "legacy-price-title-dense";
      if (length > 24) return "legacy-price-title-compact";
      return "";
    }
    function templateNode(tagName, className, text) {
      var element = document.createElement(tagName);
      if (className) element.className = className;
      if (typeof text === "string") element.textContent = text;
      return element;
    }
    function templatePrice(value, currency) {
      var amount = Number(value);
      var rendered;
      if (!isFinite(amount)) return "";
      rendered = (amount / 100).toFixed(2).replace(".", ",");
      return (currency === "EUR" || !currency ? "€ " : currency + " ") + rendered;
    }
    function templatePages(items, perPage) {
      var pages = [];
      var index;
      if (!items.length) return [[]];
      for (index = 0; index < items.length; index += perPage) {
        pages.push(items.slice(index, index + perPage));
      }
      return pages;
    }
    function templateRoyalCurrentPageCount(page) {
      if (!page) return 0;
      if (Array.isArray(page)) return page.length;
      if (Array.isArray(page.left) || Array.isArray(page.right)) {
        return templateArray(page.left).length + templateArray(page.right).length;
      }
      if (page.columns) {
        return templateArray(page.columns.left).length +
          templateArray(page.columns.right).length +
          templateArray(page.floatingBlocks).length;
      }
      return 1;
    }
    function templateRoyalCurrentCountLabel(slideType, count) {
      if (slideType === "news") return count === 1 ? "bericht" : "berichten";
      if (slideType === "sport_standing" || slideType === "sport_period_standing") {
        return count === 1 ? "team" : "teams";
      }
      if (slideType === "sport_visitor_arrivals") {
        return count === 1 ? "bezoeker" : "bezoekers";
      }
      return count === 1 ? "item" : "items";
    }
    function templatePageCounter(pageIndex, pageCount) {
      var current = String(Number(pageIndex) + 1);
      var total = String(Math.max(1, Number(pageCount) || 1));
      return (current.length < 2 ? "0" : "") + current + " / " +
        (total.length < 2 ? "0" : "") + total;
    }
    function templateClockPad(value) {
      var rendered = String(value);
      return rendered.length < 2 ? "0" + rendered : rendered;
    }
    function templateMatchCentreClock(timezone) {
      var instant = new Date();
      try {
        var parts = new Intl.DateTimeFormat("en-GB", {
          day: "2-digit",
          hour: "2-digit",
          hour12: false,
          minute: "2-digit",
          month: "2-digit",
          timeZone: templateText(timezone, "Europe/Amsterdam"),
          year: "numeric"
        }).formatToParts(instant);
        var read = function (type) {
          var index;
          for (index = 0; index < parts.length; index += 1) {
            if (parts[index].type === type) return parts[index].value;
          }
          return "";
        };
        return read("day") + "-" + read("month") + "-" + read("year") +
          " | " + read("hour") + ":" + read("minute");
      } catch (error) {
        return templateClockPad(instant.getUTCDate()) + "-" +
          templateClockPad(instant.getUTCMonth() + 1) + "-" +
          String(instant.getUTCFullYear()) + " | " +
          templateClockPad(instant.getUTCHours()) + ":" +
          templateClockPad(instant.getUTCMinutes());
      }
    }

    function templateInitials(value) {
      return templateText(value, "VC").split(/\\s+/).slice(0, 2).map(function (part) {
        return part.charAt(0).toUpperCase();
      }).join("");
    }
    function sportTemplateTitle(slideType) {
      var titles = {
        sport_activities: "Clubagenda",
        sport_birthdays: "Verjaardagen",
        sport_cancellations: "Afgelastingen",
        sport_dressing_rooms: "Veld- en kleedkamerindeling",
        sport_match_of_the_day: "Wedstrijd van de dag",
        sport_next_match: "Volgende wedstrijd",
        sport_officials: "Wedstrijdofficials",
        sport_period_standing: "Periodestand",
        sport_program: "Programma van vandaag",
        sport_referee_arrivals: "Aankomst scheidsrechters",
        sport_results: "Uitslagen",
        sport_sponsor: "Partner van de week",
        sport_standing: "Stand",
        sport_team: "Team",
        sport_trainings: "Trainingen",
        sport_volunteers: "Vrijwilligers",
        sport_visitor_arrivals: "Welkom bezoekende teams"
      };
      return titles[slideType] || "Clubinformatie";
    }
    function renderMenuTemplate(body, snapshot, orientation, payload) {
      var menu = templateRecord(snapshot.data) || templateRecord(snapshot.menu) || {};
      var editorial = templateRecord(snapshot.editorial) || {};
      var photoMode = templateText(editorial.pricePhotoMode, "show");
      var products = templateArray(menu.products);
      var pages = templatePages(products, orientation === "portrait" ? 10 : 8);
      return {
        pages: pages,
        render: function (page) {
          var grid = templateNode("div", "dynamic-menu-grid");
          var index;
          var product;
          var item;
          var copy;
          var price;
          var picture;
          var pictureUrl;
          body.innerHTML = "";
          if (!page.length) {
            body.appendChild(templateNode("div", "dynamic-empty", "Er zijn nu geen beschikbare producten."));
            return;
          }
          for (index = 0; index < page.length; index += 1) {
            product = templateRecord(page[index]) || {};
            if (!templateText(product.name, "")) continue;
            item = templateNode("article", "dynamic-menu-item");
            picture = templateNode(
              "div",
              "editorial-product-pic",
              ""
            );
            pictureUrl = templateAssetUrl(
              payload,
              templateText(product.imageMediaAssetId, "")
            );
            if (photoMode === "show" && pictureUrl) {
              picture.textContent = "";
              var pictureImage = templateNode("img", "");
              pictureImage.alt = "";
              pictureImage.src = pictureUrl;
              picture.appendChild(pictureImage);
            }
            copy = templateNode("div", "");
            if (product.variantLine || product.category) {
              copy.appendChild(templateNode(
                "small",
                "",
                templateText(product.variantLine, templateText(product.category, ""))
              ));
            }
            copy.appendChild(templateNode("h2", "", templateText(product.name, "Product")));
            if (product.description) copy.appendChild(templateNode("p", "", templateText(product.description, "")));
            price = templateNode("strong", "", templatePrice(product.priceMinor, templateText(product.currency, "EUR")));
            item.appendChild(picture);
            item.appendChild(copy);
            item.appendChild(price);
            grid.appendChild(item);
          }
          body.appendChild(grid);
        }
      };
    }
    function templateAssetUrl(payload, assetId) {
      var localAssets = templateRecord(payload._legacyLocalAssetUrls);
      var localUrl = localAssets && templateText(localAssets[assetId], "");
      if (
        localUrl &&
        (
          localUrl.indexOf("blob:") === 0 ||
          localUrl.indexOf("/__veyocast-player-cache/") === 0
        )
      ) return localUrl;
      return "";
    }
    function renderMenuStudioTemplate(body, snapshot, orientation, payload) {
      var document = templateRecord(snapshot.menuDocument) || {};
      var sourcePages = templateArray(document.pages);
      var capacity = orientation === "portrait" ? 20 : 8;
      var pages = [];
      sourcePages.sort(function (left, right) {
        return Number(left.order || 0) - Number(right.order || 0) ||
          templateText(left.id, "").localeCompare(templateText(right.id, ""));
      });
      function groupCost(groupValue) {
        var group = templateRecord(groupValue) || {};
        var display = templateRecord(group.display) || {};
        var titleLines = Math.max(1, Math.ceil(templateText(group.title, "").length / 36));
        var detailLines = Math.max(1, Math.min(2, Number(display.maxLines) || 1));
        return Math.max(detailLines, titleLines + detailLines - 1);
      }
      function nodeCost(nodeValue) {
        var node = templateRecord(nodeValue) || {};
        if (node.kind === "product-group") return groupCost(node);
        var fallback = templateRecord(node.snapshotFallback) || {};
        var name = templateText(node.nameOverride, templateText(fallback.name, ""));
        var nameLines = Math.max(1, Math.ceil(name.length / 36));
        var metaLines = fallback.variantLabel ? 1 : 0;
        return Math.max(1, Math.ceil((nameLines * 36 + metaLines * 20 + 14) / 70));
      }
      function firstPageCapacity(blocks, column) {
        var bodyX = orientation === "portrait" ? 72 : 96;
        var bodyY = orientation === "portrait" ? 348 : 248;
        var bodyWidth = orientation === "portrait" ? 936 : 1728;
        var bodyHeight = orientation === "portrait" ? 1388 : 704;
        var columnWidth = orientation === "portrait" ? bodyWidth : (bodyWidth - 36) / 2;
        var columnLeft = orientation === "portrait" || column === "left"
          ? bodyX : bodyX + columnWidth + 36;
        var columnRight = columnLeft + columnWidth;
        var firstTop = bodyHeight;
        for (var index = 0; index < blocks.length; index += 1) {
          var block = templateRecord(blocks[index]) || {};
          var layout = templateRecord((templateRecord(block.layout) || {})[orientation]) || {};
          var blockRight = Number(layout.x || 0) + Number(layout.w || 0);
          if (block.hidden === true || blockRight <= columnLeft || Number(layout.x || 0) >= columnRight) continue;
          firstTop = Math.min(firstTop, Number(layout.y || bodyY) - bodyY);
        }
        if (firstTop >= bodyHeight) return capacity;
        return Math.max(3, Math.min(capacity, Math.floor(Math.max(0, firstTop - 24) /
          (orientation === "portrait" ? 70 : 78))));
      }
      function paginate(blocks, column, portraitTwoColumns, reservedFirstPageCapacity) {
        var result = [];
        var current = [];
        var used = 0;
        var headingCost = orientation === "portrait" ? 2 : 1;
        var pageCapacity = Math.min(capacity, reservedFirstPageCapacity || capacity);
        var blockIndex;
        function flush() {
          if (current.length) result.push(current);
          current = [];
          used = 0;
          pageCapacity = capacity;
        }
        blocks.sort(function (left, right) {
          return Number(left.order || 0) - Number(right.order || 0) ||
            templateText(left.id, "").localeCompare(templateText(right.id, ""));
        });
        for (blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
          var block = templateRecord(blocks[blockIndex]) || {};
          var layout = templateRecord((templateRecord(block.layout) || {})[orientation]) || {};
          var midpoint = Number(layout.x || 0) + Number(layout.w || 0) / 2;
          var flowAcrossColumns = block.type === "category" && block.flowAcrossColumns === true &&
            (orientation !== "portrait" || portraitTwoColumns);
          var isLeft = orientation === "portrait"
            ? !portraitTwoColumns || midpoint <= 540
            : midpoint <= 960;
          if (!flowAcrossColumns && (column === "left") !== isLeft) continue;
          if (block.type === "product-group") {
            var standalone = templateRecord(block.group) || {};
            var standaloneCost = groupCost(standalone);
            if (used + standaloneCost > pageCapacity) flush();
            current.push({ kind: "group", group: standalone });
            used += standaloneCost;
            continue;
          }
          if (block.type !== "category") continue;
          var nodes = templateArray(block.productNodes);
          nodes.sort(function (left, right) {
            return Number(left.order || 0) - Number(right.order || 0) ||
              templateText(left.id, "").localeCompare(templateText(right.id, ""));
          });
          if (flowAcrossColumns && nodes.length > 1) {
            var totalCost = 0;
            var leftCost = 0;
            var splitIndex = 1;
            var costIndex;
            if (block.headingVisible === false) {
              splitIndex = Math.ceil(nodes.length / 2);
            } else {
              for (costIndex = 0; costIndex < nodes.length; costIndex += 1) {
                totalCost += nodeCost(nodes[costIndex]);
              }
              for (costIndex = 0; costIndex < nodes.length - 1; costIndex += 1) {
                leftCost += nodeCost(nodes[costIndex]);
                splitIndex = costIndex + 1;
                if (leftCost >= totalCost / 2) break;
              }
            }
            nodes = column === "left"
              ? nodes.slice(0, splitIndex)
              : nodes.slice(splitIndex);
          } else if (flowAcrossColumns && column === "right") {
            nodes = [];
          }
          if (!nodes.length) continue;
          var offset = 0;
          var continuation = false;
          var headingVisible = block.headingVisible !== false;
          while (offset < nodes.length) {
            var minimumCount = Math.min(3, nodes.length - offset);
            var minimumCost = headingVisible ? headingCost : 0;
            var minimumIndex;
            for (minimumIndex = 0; minimumIndex < minimumCount; minimumIndex += 1) {
              minimumCost += nodeCost(nodes[offset + minimumIndex]);
            }
            if (used > 0 && pageCapacity - used < minimumCost) {
              flush();
              continue;
            }
            if (headingVisible) {
              current.push({
                continuation: continuation,
                kind: "category",
                name: templateText(block.labelOverride, templateText((templateRecord(block.source) || {}).sourceName, "Categorie"))
              });
              used += headingCost;
            }
            while (offset < nodes.length) {
              var node = templateRecord(nodes[offset]) || {};
              var cost = nodeCost(node);
              if (used + cost > pageCapacity) break;
              current.push(node.kind === "product-group"
                ? { kind: "group", group: node }
                : { kind: "product", product: node });
              used += cost;
              offset += 1;
            }
            if (offset < nodes.length) {
              flush();
              continuation = true;
            }
          }
        }
        flush();
        return result;
      }
      for (var sourceIndex = 0; sourceIndex < sourcePages.length; sourceIndex += 1) {
        var sourcePage = templateRecord(sourcePages[sourceIndex]) || {};
        var flowBlocks = templateArray(sourcePage.blocks);
        var floatingBlocks = flowBlocks.filter(function (block) {
          return block.type !== "category" && block.type !== "product-group";
        });
        var portraitColumnSetting = Number(sourcePage.portraitColumns);
        var portraitTwoColumns = orientation === "portrait" && portraitColumnSetting === 2;
        if (orientation === "portrait" && portraitColumnSetting !== 1) {
          for (var flowIndex = 0; flowIndex < flowBlocks.length; flowIndex += 1) {
            var flowLayout = templateRecord((templateRecord(flowBlocks[flowIndex].layout) || {}).portrait) || {};
            if (flowBlocks[flowIndex].flowAcrossColumns === true) portraitTwoColumns = true;
            if (Number(flowLayout.w || 0) > 0 && Number(flowLayout.w) < 700) portraitTwoColumns = true;
          }
        }
        var left = paginate(
          flowBlocks.slice(0), "left", portraitTwoColumns,
          firstPageCapacity(floatingBlocks, "left")
        );
        var right = orientation === "portrait" && !portraitTwoColumns
          ? []
          : paginate(
              flowBlocks.slice(0), "right", portraitTwoColumns,
              firstPageCapacity(floatingBlocks, "right")
            );
        var count = Math.max(left.length, right.length, 1);
        for (var pageIndex = 0; pageIndex < count; pageIndex += 1) {
          pages.push({
            floatingBlocks: pageIndex === 0 ? floatingBlocks : [],
            left: left[pageIndex] || [],
            portraitTwoColumns: portraitTwoColumns,
            right: right[pageIndex] || []
          });
        }
      }
      function appendMedia(article, assetId, label) {
        var media = templateNode("span", "legacy-price-media");
        var url = templateAssetUrl(payload, templateText(assetId, ""));
        if (url) {
          var image = templateNode("img", "");
          image.alt = templateText(label, "");
          image.src = url;
          media.appendChild(image);
        }
        article.appendChild(media);
      }
      function appendProduct(column, product) {
        var snapshotFallback = templateRecord(product.snapshotFallback) || {};
        var money = templateRecord(snapshotFallback.price) || {};
        var article = templateNode("article", "legacy-price-product");
        var title = templateText(product.nameOverride, templateText(snapshotFallback.name, "Product"));
        appendMedia(article, product.mediaOverrideAssetId || snapshotFallback.imageAssetId, snapshotFallback.name);
        var copy = templateNode("span", "legacy-price-copy");
        copy.appendChild(templateNode("strong", templateProductTitleClass(title), title));
        copy.appendChild(templateNode("small", "", templateText(snapshotFallback.variantLabel, "\u00a0")));
        article.appendChild(copy);
        article.appendChild(templateNode("b", "", templatePrice(money.amountMinor, templateText(money.currency, "EUR"))));
        column.appendChild(article);
      }
      function appendGroup(column, group) {
        var lines = templateArray(group.secondaryLineItems);
        var linked = [];
        var labels = [];
        var index;
        for (index = 0; index < lines.length; index += 1) {
          var line = templateRecord(lines[index]) || {};
          if (line.kind === "linked-product") linked.push(line);
          labels.push(line.kind === "free-text"
            ? templateText(line.label, "")
            : templateText(line.labelOverride, templateText((templateRecord(line.snapshotFallback) || {}).variantLabel, templateText((templateRecord(line.snapshotFallback) || {}).name, ""))));
        }
        var article = templateNode("article", "legacy-price-product legacy-menu-group");
        var title = templateText(group.title, "Productgroep");
        appendMedia(article, group.imageAssetId, title);
        var copy = templateNode("span", "legacy-price-copy");
        copy.appendChild(templateNode("strong", templateProductTitleClass(title), title));
        copy.appendChild(templateNode("small", "legacy-menu-free", labels.join(" · ")));
        article.appendChild(copy);
        var price = "";
        if (group.pricePolicy === "shared") {
          var shared = templateRecord(group.sharedPrice) || {};
          price = templatePrice(shared.amountMinor, templateText(shared.currency, "EUR"));
        } else if (group.pricePolicy === "from" && linked.length) {
          var lowest = null;
          for (index = 0; index < linked.length; index += 1) {
            var linkedMoney = templateRecord((templateRecord(linked[index].snapshotFallback) || {}).price) || {};
            if (lowest === null || Number(linkedMoney.amountMinor) < lowest.amount) {
              lowest = { amount: Number(linkedMoney.amountMinor), currency: templateText(linkedMoney.currency, "EUR") };
            }
          }
          if (lowest) price = "Vanaf " + templatePrice(lowest.amount, lowest.currency);
        }
        article.appendChild(templateNode("b", "", price));
        column.appendChild(article);
      }
      function appendFloatingBlock(container, block) {
        if (block.hidden === true) return;
        var layout = templateRecord((templateRecord(block.layout) || {})[orientation]) || {};
        var bodyX = orientation === "portrait" ? 72 : 96;
        var bodyY = orientation === "portrait" ? 348 : 248;
        var node;
        var assetUrl;
        var image;
        var appearance;
        var orientationAppearance;
        var focalPoint;
        var fit;
        if (block.type === "text") {
          node = templateNode("p", "legacy-menu-floating legacy-menu-text", templateText(block.text, ""));
          node.setAttribute("data-role", templateText(block.role, "body"));
        } else if (block.type === "promo") {
          node = templateNode("aside", "legacy-menu-floating legacy-menu-promo");
          node.appendChild(templateNode("strong", "", templateText(block.title, "Aanbieding")));
          if (block.body) node.appendChild(templateNode("p", "", templateText(block.body, "")));
        } else {
          assetUrl = templateAssetUrl(payload, templateText(block.assetId, ""));
          if (!assetUrl) return;
          orientationAppearance = templateRecord(block.orientationAppearance) || {};
          appearance = templateRecord(orientationAppearance[orientation]) ||
            templateRecord(block.appearance) || {};
          fit = ["contain", "cover", "fill"].indexOf(appearance.fit) >= 0
            ? appearance.fit : "contain";
          focalPoint = templateRecord(appearance.focalPoint) || {};
          if (block.type === "video") {
            var playback = templateRecord(block.playback) || {};
            node = templateNode("video", "legacy-menu-floating");
            node.autoplay = playback.autoplay === true;
            node.loop = playback.loop === true;
            node.muted = true;
            node.controls = false;
            node.setAttribute("muted", "");
            node.setAttribute("playsinline", "");
            node.preload = "auto";
            node.poster = templateAssetUrl(payload, templateText(playback.posterAssetId, ""));
            node.src = assetUrl;
            (function (video, startMs, endMs, shouldLoop) {
              video.addEventListener("loadedmetadata", function () {
                if (startMs > 0) video.currentTime = startMs / 1000;
              });
              if (endMs > startMs) video.addEventListener("timeupdate", function () {
                if (video.currentTime * 1000 < endMs) return;
                if (shouldLoop) {
                  video.currentTime = startMs / 1000;
                  video.play();
                } else video.pause();
              });
            })(node, Number(playback.startMs) || 0, Number(playback.endMs) || 0, playback.loop === true);
          } else if (block.type === "logo") {
            node = templateNode("img", "legacy-menu-floating legacy-menu-logo");
            node.alt = "";
            node.src = assetUrl;
          } else {
            node = templateNode("figure", "legacy-menu-floating");
            image = templateNode("img", "");
            image.alt = templateText(block.alt, "");
            image.src = assetUrl;
            image.style.objectFit = fit;
            image.style.objectPosition = String(Math.max(0, Math.min(1, Number(focalPoint.x) || 0.5)) * 100) + "% " +
              String(Math.max(0, Math.min(1, Number(focalPoint.y) || 0.5)) * 100) + "%";
            var opacity = Number(appearance.opacity);
            image.style.opacity = String(isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1);
            node.appendChild(image);
            if (block.caption) node.appendChild(templateNode("figcaption", "", templateText(block.caption, "")));
          }
          if (block.type === "video") {
            node.style.objectFit = fit;
            node.style.objectPosition = String(Math.max(0, Math.min(1, Number(focalPoint.x) || 0.5)) * 100) + "% " +
              String(Math.max(0, Math.min(1, Number(focalPoint.y) || 0.5)) * 100) + "%";
          }
        }
        node.style.left = String(Number(layout.x || 0) - bodyX) + "px";
        node.style.top = String(Number(layout.y || 0) - bodyY) + "px";
        node.style.width = String(Math.max(1, Number(layout.w) || 1)) + "px";
        node.style.height = String(Math.max(1, Number(layout.h) || 1)) + "px";
        node.style.transform = "rotate(" + String(Number(layout.rotation) || 0) + "deg)";
        container.appendChild(node);
      }
      return {
        pages: pages.length ? pages : [{ left: [], right: [] }],
        render: function (page) {
          var grid = templateNode("div", "legacy-price-grid");
          if (page.portraitTwoColumns) grid.className += " legacy-price-grid-two";
          body.innerHTML = "";
          function appendColumn(name) {
            var column = templateNode("section", "legacy-price-column");
            var rows = page[name] || [];
            for (var rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
              var row = rows[rowIndex];
              if (row.kind === "category") {
                var category = templateNode("h2", "legacy-price-category");
                category.appendChild(templateNode("span", "", row.name));
                if (row.continuation) category.appendChild(templateNode("small", "", "vervolg"));
                column.appendChild(category);
              } else if (row.kind === "group") {
                appendGroup(column, templateRecord(row.group) || {});
              } else {
                appendProduct(column, templateRecord(row.product) || {});
              }
            }
            grid.appendChild(column);
          }
          appendColumn("left");
          if (orientation !== "portrait" || page.portraitTwoColumns) appendColumn("right");
          body.appendChild(grid);
          var floatingBlocks = templateArray(page.floatingBlocks);
          for (var floatingIndex = 0; floatingIndex < floatingBlocks.length; floatingIndex += 1) {
            appendFloatingBlock(body, templateRecord(floatingBlocks[floatingIndex]) || {});
          }
        }
      };
    }
    function renderPriceListTemplate(body, snapshot, orientation, payload) {
      if ((templateRecord(snapshot.menuDocument) || {}).schemaVersion === "menu-document.v2") {
        return renderMenuStudioTemplate(body, snapshot, orientation, payload);
      }
      var priceList = templateRecord(snapshot.priceList) || {};
      var sections = templateArray(priceList.sections);
      var capacity = orientation === "portrait" ? 17 : 9;
      var columns = { left: [], right: [] };
      var pagesByColumn = { left: [], right: [] };
      var columnNames = ["left", "right"];
      var index;
      sections.sort(function (left, right) {
        return Number(left.order || 0) - Number(right.order || 0) ||
          templateText(left.id, "").localeCompare(templateText(right.id, ""));
      });
      for (index = 0; index < sections.length; index += 1) {
        var section = templateRecord(sections[index]) || {};
        if (section.column === "left" || section.column === "right") {
          columns[section.column].push(section);
        }
      }
      function paginateColumn(columnName) {
        var pages = [];
        var current = [];
        var sectionIndex;
        function flush() {
          if (current.length) pages.push(current);
          current = [];
        }
        for (sectionIndex = 0; sectionIndex < columns[columnName].length; sectionIndex += 1) {
          var source = columns[columnName][sectionIndex];
          var products = templateArray(source.products);
          var productIndex;
          if (!products.length) continue;
          if (capacity - current.length < 2) flush();
          current.push({ kind: "category", name: source.name, continuation: false });
          for (productIndex = 0; productIndex < products.length; productIndex += 1) {
            if (current.length === capacity) {
              flush();
              current.push({ kind: "category", name: source.name, continuation: true });
            }
            current.push({ kind: "product", product: products[productIndex] });
          }
        }
        flush();
        return pages;
      }
      for (index = 0; index < columnNames.length; index += 1) {
        pagesByColumn[columnNames[index]] = paginateColumn(columnNames[index]);
      }
      var pageCount = Math.max(pagesByColumn.left.length, pagesByColumn.right.length, 1);
      var pages = [];
      for (index = 0; index < pageCount; index += 1) {
        pages.push({
          left: pagesByColumn.left[index] || [],
          right: pagesByColumn.right[index] || []
        });
      }
      return {
        pages: pages,
        render: function (page) {
          var grid = templateNode("div", "legacy-price-grid");
          body.innerHTML = "";
          function appendColumn(name) {
            var column = templateNode("section", "legacy-price-column");
            var rows = page[name] || [];
            var rowIndex;
            for (rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
              var row = rows[rowIndex];
              if (row.kind === "category") {
                var category = templateNode("h2", "legacy-price-category");
                category.appendChild(templateNode("span", "", templateText(row.name, "Categorie")));
                if (row.continuation) category.appendChild(templateNode("small", "", "vervolg"));
                column.appendChild(category);
              } else {
                var product = templateRecord(row.product) || {};
                var article = templateNode("article", "legacy-price-product");
                var title = templateText(product.name, "Product");
                var media = templateNode("span", "legacy-price-media");
                var mediaUrl = product.photoVisible === true
                  ? templateAssetUrl(payload, templateText(product.imageMediaAssetId, ""))
                  : "";
                if (mediaUrl) {
                  var image = templateNode("img", "");
                  image.alt = "";
                  image.onerror = function () { this.parentNode.removeChild(this); };
                  image.src = mediaUrl;
                  media.appendChild(image);
                }
                var copy = templateNode("span", "legacy-price-copy");
                copy.appendChild(templateNode("strong", templateProductTitleClass(title), title));
                copy.appendChild(templateNode("small", "", templateText(product.description, "\u00a0")));
                article.appendChild(media);
                article.appendChild(copy);
                article.appendChild(templateNode("b", "", templateText(product.formattedPrice, "")));
                column.appendChild(article);
              }
            }
            grid.appendChild(column);
          }
          appendColumn("left");
          appendColumn("right");
          body.appendChild(grid);
        }
      };
    }
    function templateDate(value) {
      var date = new Date(templateText(value, ""));
      if (!isFinite(date.getTime())) return "";
      try {
        return date.toLocaleDateString("nl-NL", {
          day: "numeric",
          month: "long",
          year: "numeric"
        });
      } catch (error) {
        return date.toISOString().slice(0, 10);
      }
    }
    function templateCanonicalNewsLink(value) {
      var parsed;
      var keys = [];
      var index;
      try {
        parsed = new URL(templateText(value, ""));
        parsed.hash = "";
        parsed.searchParams.forEach(function (_entry, key) { keys.push(key); });
        for (index = 0; index < keys.length; index += 1) {
          if (
            keys[index].toLowerCase().indexOf("utm_") === 0 ||
            ["fbclid", "gclid", "mc_cid", "mc_eid"].indexOf(keys[index].toLowerCase()) >= 0
          ) parsed.searchParams.delete(keys[index]);
        }
        parsed.searchParams.sort();
        if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\\/+$/, "");
        return parsed.toString();
      } catch (error) {
        return "";
      }
    }
    function templateUniqueNewsArticles(values) {
      var seen = {};
      return values.filter(function (value) {
        var article = templateRecord(value) || {};
        var key = templateCanonicalNewsLink(article.link) || "id:" + templateText(article.externalId, "");
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
    }
    function templateRoyalCurrentAppearance(snapshot) {
      var presentation = templateRecord(snapshot && snapshot.themePresentation);
      var appearance;
      if (!presentation || Number(presentation.snapshotVersion) !== 2) return null;
      appearance = templateRecord(presentation.appearance);
      return appearance && Number(appearance.schemaVersion) === 2 &&
        templateText(appearance.designRevision, "") === "royal-current-v8"
        ? appearance
        : null;
    }
    function templateNewsConfig(snapshot) {
      var root = templateRecord(snapshot) || {};
      var nestedData = templateRecord(root.data);
      return templateRecord(root.news) ||
        templateRecord(nestedData && nestedData.news) ||
        nestedData ||
        {};
    }
    function legacyRoyalNormalizeHex(value) {
      var source = templateText(value, "").trim().replace(/^#/, "");
      if (/^[0-9a-f]{3}$/i.test(source)) {
        source = source.split("").map(function (character) {
          return character + character;
        }).join("");
      }
      return /^[0-9a-f]{6}$/i.test(source) ? "#" + source.toLowerCase() : null;
    }
    function legacyRoyalRgb(color) {
      return [1, 3, 5].map(function (index) {
        return Number.parseInt(color.slice(index, index + 2), 16);
      });
    }
    function legacyRoyalFromRgb(values) {
      return "#" + values.map(function (value) {
        return Math.max(0, Math.min(255, Math.round(value)))
          .toString(16).padStart(2, "0");
      }).join("");
    }
    function legacyRoyalMix(left, right, amount) {
      var rightChannels = legacyRoyalRgb(right);
      return legacyRoyalFromRgb(legacyRoyalRgb(left).map(function (value, index) {
        return value + (rightChannels[index] - value) * amount;
      }));
    }
    function legacyRoyalHsl(color) {
      var channels = legacyRoyalRgb(color).map(function (value) { return value / 255; });
      var red = channels[0];
      var green = channels[1];
      var blue = channels[2];
      var maximum = Math.max(red, green, blue);
      var minimum = Math.min(red, green, blue);
      var delta = maximum - minimum;
      var lightness = (maximum + minimum) / 2;
      var hue = 0;
      if (delta) {
        hue = (maximum === red
          ? (green - blue) / delta + (green < blue ? 6 : 0)
          : maximum === green
            ? (blue - red) / delta + 2
            : (red - green) / delta + 4) / 6;
      }
      return [
        hue,
        delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0,
        lightness
      ];
    }
    function legacyRoyalFromHsl(hue, saturation, lightness) {
      function channel(offset) {
        var position = (offset + hue * 12) % 12;
        return 255 * (
          lightness - saturation * Math.min(lightness, 1 - lightness) *
          Math.max(-1, Math.min(position - 3, 9 - position, 1))
        );
      }
      return legacyRoyalFromRgb([channel(0), channel(8), channel(4)]);
    }
    function legacyRoyalLuminance(color) {
      var channels = legacyRoyalRgb(color).map(function (value) {
        var channel = value / 255;
        return channel <= .04045
          ? channel / 12.92
          : Math.pow((channel + .055) / 1.055, 2.4);
      });
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    }
    function legacyRoyalContrast(left, right) {
      var light = Math.max(legacyRoyalLuminance(left), legacyRoyalLuminance(right));
      var dark = Math.min(legacyRoyalLuminance(left), legacyRoyalLuminance(right));
      return (light + .05) / (dark + .05);
    }
    function legacyRoyalReadable(color, backgrounds, toward, minimum) {
      var threshold = Number(minimum) || 4.5;
      var index;
      var candidate;
      for (index = 0; index <= 100; index += 1) {
        candidate = legacyRoyalMix(color, toward, index / 100);
        if (backgrounds.every(function (background) {
          return legacyRoyalContrast(candidate, background) >= threshold;
        })) return candidate;
      }
      return toward;
    }
    function legacyCreateRoyalCurrentPalette(value, mode) {
      var source = templateRecord(value) || {};
      var primary = legacyRoyalNormalizeHex(source.primary) || "#2459ed";
      var secondary = legacyRoyalNormalizeHex(source.secondary);
      var neutral = source.background === "neutral";
      var dark = mode === "glass";
      var primaryHsl = legacyRoyalHsl(primary);
      var primaryHue = primaryHsl[0];
      var primarySaturation = primaryHsl[1];
      var tonal = legacyRoyalFromHsl(primaryHue, Math.min(primarySaturation, .72), .46);
      var hue = neutral ? 0 : primaryHue;
      var saturation = neutral ? 0 : Math.min(primarySaturation, .56);
      var background = dark
        ? legacyRoyalFromHsl(hue, saturation, .09)
        : legacyRoyalMix("#ffffff", neutral ? "#6b6b6b" : tonal, .052);
      var surface = dark
        ? legacyRoyalFromHsl(hue, saturation * .76, .16)
        : "#ffffff";
      var surface2 = dark
        ? legacyRoyalFromHsl(hue, saturation * .72, .205)
        : legacyRoyalMix("#ffffff", neutral ? "#777777" : tonal, .1);
      var accentSoft = dark
        ? legacyRoyalMix(surface, primary, .15)
        : legacyRoyalMix("#ffffff", primary, .085);
      var textBackgrounds = [background, surface, surface2, accentSoft];
      var ink = dark ? "#f5f7fb" : legacyRoyalFromHsl(hue, saturation, .17);
      var muted = legacyRoyalReadable(
        dark ? legacyRoyalMix(surface, "#ffffff", .67) : legacyRoyalMix(ink, "#ffffff", .3),
        textBackgrounds,
        dark ? "#ffffff" : "#000000"
      );
      var accent = legacyRoyalReadable(
        primary, textBackgrounds, dark ? "#ffffff" : "#000000"
      );
      var safeSecondary = legacyRoyalReadable(
        secondary || primary, textBackgrounds, dark ? "#ffffff" : "#000000"
      );
      var deep = legacyRoyalFromHsl(
        hue,
        Math.min(saturation + .1, neutral ? 0 : .66),
        dark ? .08 : .19
      );
      var ownBackground = dark
        ? legacyRoyalFromHsl(primaryHue, Math.min(primarySaturation, .5), .3)
        : deep;
      var ownInk = legacyRoyalReadable("#ffffff", [ownBackground], "#000000");
      var onAccent = legacyRoyalContrast("#ffffff", accent) >= 4.5
        ? "#ffffff"
        : "#101010";
      var edge = dark ? legacyRoyalMix(surface, ink, .2) : legacyRoyalMix(surface, ink, .16);
      return {
        "--accent": accent,
        "--accent-soft": accentSoft,
        "--bg": background,
        "--brand-primary": primary,
        "--canvas-end": legacyRoyalMix(background, surface2, .1),
        "--canvas-start": legacyRoyalMix(background, surface2, dark ? .42 : .2),
        "--deep": deep,
        "--flow-accent": secondary || primary,
        "--ink": ink,
        "--line": edge,
        "--matte-rgb": legacyRoyalRgb(surface).join(","),
        "--muted": muted,
        "--on-accent": onAccent,
        "--own-bg": ownBackground,
        "--own-ink": ownInk,
        "--own-line": legacyRoyalMix(ownBackground, ownInk, .28),
        "--own-muted": legacyRoyalMix(ownBackground, ownInk, .85),
        "--secondary-accent": safeSecondary,
        "--solid-accent": legacyRoyalReadable(primary, ["#ffffff"], "#000000"),
        "--surface": surface,
        "--surface-2": surface2
      };
    }
    function templateLegacyMatchCancelled(item) {
      var source = [item.status, item.state, item.matchStatus, item.meta]
        .map(function (value) { return templateText(value, ""); }).join(" ");
      return item.cancelled === true || item.canceled === true ||
        /(?:afgelast|annul|cancel(?:led|ed)?)/i.test(source);
    }
    function renderNewsTemplate(body, snapshot, payload, root) {
      var news = templateNewsConfig(snapshot);
      var articles = templateUniqueNewsArticles(templateArray(news.articles));
      var editorial = templateRecord(snapshot.editorial) || {};
      var royalCurrent = Boolean(templateRoyalCurrentAppearance(snapshot));
      var newsVariant = templateText(editorial.newsVariant, "hero_split");
      if (["hero_split", "fullscreen_gradient", "news_grid", "text_only"].indexOf(newsVariant) < 0) {
        newsVariant = "hero_split";
      }
      var usesArena =
        royalCurrent ||
        templateText(payload.templateSlug, "").indexOf("editorial-arena-") === 0;
      var usesEditorialLayout =
        !usesArena && (
        payload.orientation === "portrait" ||
        (
          payload.orientation === "landscape" &&
          templateText(payload.templateSlug, "").indexOf("dark") >= 0
        ));
      var seconds = Number(news.secondsPerSlide);
      if (!isFinite(seconds)) seconds = 5;
      seconds = Math.min(120, Math.max(5, Math.round(seconds)));
      if (usesEditorialLayout) {
        root.className += payload.orientation === "portrait"
          ? " rss-news-portrait"
          : " rss-news-landscape";
      }
      var arenaPages = newsVariant === "news_grid" ? templatePages(articles, 3) : articles;
      return {
        pages: usesArena
          ? (arenaPages.length ? arenaPages : [null])
          : (articles.length ? articles : [null]),
        pageDuration: seconds * 1000,
        render: function (articleValue) {
          var articlePage = usesArena && Array.isArray(articleValue) ? articleValue : [articleValue];
          var article = templateRecord(articlePage[0]);
          var secondaryArticles = articlePage.slice(1);
          var wrapper;
          body.innerHTML = "";
          if (!article) {
            body.appendChild(templateNode("div", "dynamic-empty", "Er zijn nu geen nieuwsberichten."));
            return;
          }
          if (usesArena) {
            var arenaPage = templateNode("div", "editorial-news");
            arenaPage.setAttribute("data-news-variant", newsVariant);
            var arenaHero = templateNode("section", "editorial-news-art");
            var arenaHeroUrl = templateAssetUrl(
              payload,
              templateText(article.heroMediaAssetId, "")
            );
            var arenaSource = templateNode("div", "editorial-news-source");
            var arenaProviderUrl = templateAssetUrl(
              payload,
              templateText(news.providerLogoMediaAssetId, "")
            );
            var arenaCopy = templateNode("article", "editorial-news-copy");
            var arenaMeta = templateNode("div", "editorial-news-meta");
            var arenaQrUrl = templateAssetUrl(
              payload,
              templateText(article.qrMediaAssetId, "")
            );
            var fullscreenQr = null;
            if (arenaHeroUrl) {
              var arenaHeroImage = templateNode("img", "");
              arenaHeroImage.alt = "";
              arenaHeroImage.src = arenaHeroUrl;
              arenaHero.appendChild(arenaHeroImage);
            } else {
              arenaHero.appendChild(templateNode(
                "span",
                "",
                templateText(news.sourceName, "N").charAt(0).toUpperCase()
              ));
            }
            if (arenaProviderUrl) {
              var arenaProviderImage = templateNode("img", "");
              arenaProviderImage.alt = templateText(news.sourceName, "Nieuws");
              arenaProviderImage.src = arenaProviderUrl;
              arenaSource.appendChild(arenaProviderImage);
            } else {
              arenaSource.appendChild(templateNode(
                "strong",
                "",
                templateText(news.sourceName, "Clubnieuws")
              ));
            }
            arenaHero.appendChild(arenaSource);
            var arenaTitleText = templateText(article.title, "Clubnieuws");
            if (royalCurrent) {
              var royalArticleTitle = templateNode(
                "h2",
                "legacy-royal-news-title",
                arenaTitleText
              );
              if (arenaTitleText.length > 64) royalArticleTitle.className += " dense";
              arenaCopy.appendChild(royalArticleTitle);
            } else {
              arenaCopy.appendChild(templateNode("span", "", "Laatste nieuws"));
              var arenaTitle = templateNode("h2", "", arenaTitleText);
              if (arenaTitleText.length > 64) arenaTitle.className = "dense";
              arenaCopy.appendChild(arenaTitle);
            }
            if (article.intro) {
              arenaCopy.appendChild(templateNode(
                "p",
                "",
                templateText(article.intro, "")
              ));
            }
            if (article.publishedAt) {
              var arenaDate = templateNode("small", "");
              arenaDate.appendChild(templateNode("b", "", "Datum"));
              arenaDate.appendChild(document.createTextNode(
                templateDate(article.publishedAt)
              ));
              arenaMeta.appendChild(arenaDate);
            }
            var arenaAuthor = templateNode("small", "");
            arenaAuthor.appendChild(templateNode("b", "", "Door"));
            arenaAuthor.appendChild(document.createTextNode(
              templateText(
                article.author,
                templateText(article.sourceName, templateText(news.sourceName, "Clubnieuws"))
              )
            ));
            arenaMeta.appendChild(arenaAuthor);
            arenaCopy.appendChild(arenaMeta);
            if (arenaQrUrl) {
              var arenaQr = templateNode("div", "editorial-news-qr");
              var arenaQrImage = templateNode("img", "");
              arenaQrImage.alt = "QR-code naar " + arenaTitleText;
              arenaQrImage.src = arenaQrUrl;
              arenaQr.appendChild(arenaQrImage);
              if (!royalCurrent) {
                arenaQr.appendChild(templateNode("span", "", "Scan voor het artikel"));
              }
              if (newsVariant === "fullscreen_gradient") fullscreenQr = arenaQr;
              else arenaCopy.appendChild(arenaQr);
            }
            arenaPage.appendChild(arenaHero);
            arenaPage.appendChild(arenaCopy);
            if (fullscreenQr) arenaPage.appendChild(fullscreenQr);
            if (secondaryArticles.length) {
              var arenaGrid = templateNode("aside", "editorial-news-grid");
              var arenaGridIndex;
              for (arenaGridIndex = 0; arenaGridIndex < secondaryArticles.length; arenaGridIndex += 1) {
                var secondaryArticle = templateRecord(secondaryArticles[arenaGridIndex]) || {};
                var secondaryCard = templateNode("article", "");
                secondaryCard.appendChild(templateNode(
                  "span",
                  "",
                  templateText(
                    secondaryArticle.sourceName,
                    templateText(news.sourceName, "Clubnieuws")
                  )
                ));
                secondaryCard.appendChild(templateNode(
                  "h3",
                  "",
                  templateText(secondaryArticle.title, "Clubnieuws")
                ));
                secondaryCard.appendChild(templateNode(
                  "small",
                  "",
                  templateDate(secondaryArticle.publishedAt)
                ));
                arenaGrid.appendChild(secondaryCard);
              }
              arenaPage.appendChild(arenaGrid);
            }
            body.appendChild(arenaPage);
            return;
          }
          if (usesEditorialLayout) {
            var page = templateNode("div", "legacy-rss-page");
            var hero = templateNode("div", "legacy-rss-hero");
            var heroUrl = templateAssetUrl(payload, templateText(article.heroMediaAssetId, ""));
            var providerLogoUrl = templateAssetUrl(payload, templateText(news.providerLogoMediaAssetId, ""));
            var provider = templateNode("header", "legacy-rss-provider");
            var providerFallback = templateNode("strong", "", templateText(news.sourceName, "Clubnieuws"));
            var story = templateNode("article", "legacy-rss-story");
            var headline = templateNode("h2", "", templateText(article.title, "Clubnieuws"));
            var metadata = templateNode("div", "legacy-rss-meta");
            var footer = templateNode("footer", "legacy-rss-footer");
            var progress = templateNode("span", "legacy-rss-progress");
            var counter = templateNode("span", "legacy-rss-counter");
            var pageIndex = Math.max(0, articles.indexOf(articleValue));
            hero.appendChild(templateNode(
              "span",
              "",
              templateText(news.sourceName, "N").charAt(0).toUpperCase()
            ));
            if (heroUrl) {
              var heroImage = templateNode("img", "");
              heroImage.alt = "";
              heroImage.onerror = function () { heroImage.style.display = "none"; };
              heroImage.src = heroUrl;
              hero.appendChild(heroImage);
            }
            hero.appendChild(templateNode("i", "legacy-rss-grade"));
            if (providerLogoUrl) {
              var providerLogo = templateNode("img", "");
              providerLogo.alt = templateText(news.sourceName, "Nieuws");
              providerLogo.onerror = function () {
                providerLogo.style.display = "none";
                providerFallback.style.display = "";
              };
              providerFallback.style.display = "none";
              providerLogo.src = providerLogoUrl;
              provider.appendChild(providerLogo);
            }
            provider.appendChild(providerFallback);
            provider.appendChild(templateNode("p", "", templateText(news.title, "Nieuws")));
            if (templateText(article.title, "").length > 88) {
              headline.className = "compact";
            }
            story.appendChild(headline);
            story.appendChild(templateNode("i", ""));
            if (article.intro) {
              story.appendChild(templateNode("p", "", templateText(article.intro, "")));
            }
            if (article.publishedAt) {
              var dateMeta = templateNode("span", "");
              dateMeta.appendChild(templateNode("b", "", "Datum"));
              dateMeta.appendChild(document.createTextNode(templateDate(article.publishedAt)));
              metadata.appendChild(dateMeta);
            }
            var sourceMeta = templateNode("span", "");
            sourceMeta.appendChild(templateNode("b", "", "Door"));
            sourceMeta.appendChild(document.createTextNode(
              templateText(article.author, templateText(article.sourceName, templateText(news.sourceName, "Clubnieuws")))
            ));
            metadata.appendChild(sourceMeta);
            progress.style.setProperty("--rss-duration", String(seconds) + "s");
            progress.appendChild(templateNode("i", ""));
            counter.appendChild(templateNode("b", "", String(pageIndex + 1)));
            counter.appendChild(document.createTextNode(
              " / " + String(Math.max(articles.length, 1))
            ));
            footer.appendChild(progress);
            footer.appendChild(counter);
            page.appendChild(hero);
            page.appendChild(provider);
            page.appendChild(story);
            page.appendChild(metadata);
            page.appendChild(footer);
            body.appendChild(page);
            return;
          }
          wrapper = templateNode("article", "dynamic-news");
          wrapper.appendChild(templateNode("p", "dynamic-news-meta", templateText(article.sourceName, templateText(news.sourceName, "Clubnieuws"))));
          wrapper.appendChild(templateNode("h2", "", templateText(article.title, "Clubnieuws")));
          if (article.intro) wrapper.appendChild(templateNode("p", "", templateText(article.intro, "")));
          body.appendChild(wrapper);
        }
      };
    }
    function splitTemplateTeams(value) {
      var parts = templateText(value, "").split(/\\s+[–—-]\\s+/);
      return [parts[0] || "Thuisteam", parts.slice(1).join(" – ") || "Uitteam"];
    }
    function renderMatchTeam(name, logoAssetId, payload) {
      var team = templateNode("article", "dynamic-team");
      var mark = templateNode("div", "dynamic-team-mark", templateInitials(name));
      var logoUrl = templateAssetUrl(payload, templateText(logoAssetId, ""));
      if (logoUrl) {
        mark.textContent = "";
        var logo = templateNode("img", "");
        logo.alt = "";
        logo.src = logoUrl;
        mark.appendChild(logo);
      }
      team.appendChild(mark);
      team.appendChild(templateNode("h2", "", name));
      return team;
    }
    function renderLegacyTeamMini(name, logoAssetId, payload) {
      var mark = templateNode("i", "legacy-team-mini", templateInitials(name));
      var logoUrl = templateAssetUrl(payload, templateText(logoAssetId, ""));
      if (logoUrl) {
        mark.textContent = "";
        var logo = templateNode("img", "");
        logo.alt = "";
        logo.src = logoUrl;
        mark.appendChild(logo);
      }
      return mark;
    }
    function standingValue(value) {
      return value === null || typeof value === "undefined" || value === ""
        ? "–"
        : String(value);
    }
    function renderLegacyRoyalStandingForm(value) {
      var form = templateNode("span", "legacy-standing-form");
      var entries = templateArray(value).slice(-3);
      var index;
      if (!entries.length) form.appendChild(templateNode("b", "", "–"));
      for (index = 0; index < entries.length; index += 1) {
        form.appendChild(templateNode(
          "i",
          entries[index] === "win" ? "win" : entries[index] === "loss" ? "loss" : "",
          entries[index] === "win" ? "W" : entries[index] === "draw" ? "G" : "V"
        ));
      }
      return form;
    }
    function renderLegacyRoyalStandingRow(item, payload, className) {
      var row = templateNode("article", "legacy-royal-standing-row" + (className ? " " + className : ""));
      var team = templateNode("span", "legacy-standing-team");
      var teamLogoUrl = templateAssetUrl(payload, templateText(item.logoMediaAssetId, ""));
      var difference = Number(item.goalDifference);
      row.setAttribute("data-own-team", item.selected === true ? "true" : "false");
      row.appendChild(templateNode("strong", "legacy-standing-rank", standingValue(item.position)));
      if (teamLogoUrl) {
        var teamLogo = templateNode("img", "");
        teamLogo.alt = "";
        teamLogo.src = teamLogoUrl;
        team.appendChild(teamLogo);
      } else {
        team.appendChild(templateNode("i", "", templateInitials(templateText(item.teamName, "VC"))));
      }
      team.appendChild(templateNode("b", "", templateText(item.teamName, "Team")));
      row.appendChild(team);
      row.appendChild(templateNode("span", "", standingValue(item.played)));
      row.appendChild(templateNode("span", "", standingValue(item.won)));
      row.appendChild(templateNode("span", "", standingValue(item.drawn)));
      row.appendChild(templateNode("span", "", standingValue(item.lost)));
      row.appendChild(templateNode("strong", "legacy-standing-points", standingValue(item.points)));
      row.appendChild(templateNode("span", "", standingValue(item.goalsFor)));
      row.appendChild(templateNode("span", "", standingValue(item.goalsAgainst)));
      row.appendChild(templateNode(
        "span",
        "",
        isFinite(difference) ? (difference > 0 ? "+" : "") + String(difference) : "–"
      ));
      row.appendChild(renderLegacyRoyalStandingForm(item.form));
      return row;
    }
    function renderEditorialStandingTemplate(body, snapshot, payload) {
      var sport = templateRecord(snapshot.sport) || {};
      var competition = templateRecord(sport.competition) || {};
      var pool = templateRecord(sport.pool) || {};
      var items = templateArray(sport.items);
      var pages = templatePages(items, 10);
      var royalCurrent = Boolean(templateRoyalCurrentAppearance(snapshot));
      var pinnedTeam = null;
      var pinnedIndex;
      if (royalCurrent) {

        for (pinnedIndex = 0; pinnedIndex < items.length; pinnedIndex += 1) {
          if ((templateRecord(items[pinnedIndex]) || {}).selected === true) {
            pinnedTeam = templateRecord(items[pinnedIndex]);
            break;
          }
        }
      }
      if (royalCurrent) {
        var standingWindow = body.querySelector(".legacy-royal-standing-rows");
        var standingHeight = standingWindow && standingWindow.clientHeight || Math.max(70,
          (body.clientHeight || (payload.orientation === "portrait" ? 1464 : 704)) - (pinnedTeam ? 168 : 70));
        pages = templatePages(items, resolveSportListLayout({ orientation: payload.orientation,
          slideType: payload.slideType, itemCount: items.length, contentHeight: standingHeight, minimumRowHeight: 70 }).capacity);
      }
      return {
        pages: pages,
        render: function (page) {
          if (royalCurrent) {
            var royalCard = templateNode("section", "legacy-standing-card legacy-royal-standing-card");
            var royalColumns = templateNode("div", "legacy-royal-standing-columns");
            var royalRows = templateNode("div", "legacy-royal-standing-rows");
            var royalContext = templateNode("p", "legacy-standing-context");
            var royalLabels = ["#", "Team", "G", "W", "GL", "V", "P", "DV", "DT", "+/−", "Vorm"];
            var royalIndex;
            body.innerHTML = "";
            if (pinnedTeam) {
              var pinned = templateNode("aside", "legacy-royal-standing-pinned");
              pinned.appendChild(templateNode("span", "", "Eigen team · vaste positie"));
              pinned.appendChild(renderLegacyRoyalStandingRow(pinnedTeam, payload, "pinned"));
              royalCard.appendChild(pinned);
            }
            for (royalIndex = 0; royalIndex < royalLabels.length; royalIndex += 1) {
              royalColumns.appendChild(templateNode("span", "", royalLabels[royalIndex]));
            }
            royalCard.appendChild(royalColumns);
            if (!page.length) {
              royalRows.appendChild(templateNode("div", "dynamic-empty", "De stand is nog niet gepubliceerd."));
            }
            for (royalIndex = 0; royalIndex < page.length; royalIndex += 1) {
              royalRows.appendChild(renderLegacyRoyalStandingRow(
                templateRecord(page[royalIndex]) || {}, payload, ""
              ));
            }
            royalCard.appendChild(royalRows);
            royalContext.appendChild(document.createTextNode(
              [
                templateText(competition.name, ""),
                templateText(pool.name, ""),
                templateText(sport.season, "")
              ].filter(function (value) { return Boolean(value); }).join(" · ")
            ));
            royalCard.appendChild(royalContext);
            body.appendChild(royalCard);
            return;
          }
          var card = templateNode("section", "legacy-standing-card");
          var columns = templateNode("div", "legacy-standing-columns");
          var rows = templateNode("div", "legacy-standing-rows");
          var context = templateNode("p", "legacy-standing-context");
          var index;
          var item;
          var row;
          var team;
          var form;
          var formIndex;
          var difference;
          var labels = ["#", "Team", "G", "W", "GL", "V", "PT", "+/−", "Vorm"];
          body.innerHTML = "";
          for (index = 0; index < labels.length; index += 1) {
            columns.appendChild(templateNode("span", "", labels[index]));
          }
          card.appendChild(columns);
          if (!page.length) {
            rows.appendChild(templateNode("div", "dynamic-empty", "De stand is nog niet gepubliceerd."));
          }
          for (index = 0; index < page.length; index += 1) {
            item = templateRecord(page[index]) || {};
            row = templateNode("article", "legacy-standing-row" + (item.selected === true ? " selected" : ""));
            row.appendChild(templateNode("strong", "legacy-standing-rank", standingValue(item.position)));
            team = templateNode("span", "legacy-standing-team");
            var teamLogoUrl = templateAssetUrl(
              payload,
              templateText(item.logoMediaAssetId, "")
            );
            if (teamLogoUrl) {
              var teamLogo = templateNode("img", "");
              teamLogo.alt = "";
              teamLogo.src = teamLogoUrl;
              team.appendChild(teamLogo);
            } else {
              team.appendChild(templateNode("i", "", templateInitials(templateText(item.teamName, "VC"))));
            }
            team.appendChild(templateNode("b", "", templateText(item.teamName, "Team")));
            row.appendChild(team);
            row.appendChild(templateNode("span", "", standingValue(item.played)));
            row.appendChild(templateNode("span", "", standingValue(item.won)));
            row.appendChild(templateNode("span", "", standingValue(item.drawn)));
            row.appendChild(templateNode("span", "", standingValue(item.lost)));
            row.appendChild(templateNode("strong", "legacy-standing-points", standingValue(item.points)));
            difference = Number(item.goalDifference);
            row.appendChild(templateNode(
              "span",
              "",
              isFinite(difference)
                ? (difference > 0 ? "+" : "") + String(difference)
                : "–"
            ));
            form = templateNode("span", "legacy-standing-form");
            item.form = templateArray(item.form).slice(-3);
            if (!item.form.length) {
              form.appendChild(templateNode("b", "", "–"));
            }
            for (formIndex = 0; formIndex < item.form.length; formIndex += 1) {
              form.appendChild(templateNode(
                "i",
                item.form[formIndex] === "win"
                  ? "win"
                  : item.form[formIndex] === "loss" ? "loss" : "",
                item.form[formIndex] === "win"
                  ? "W"
                  : item.form[formIndex] === "draw" ? "G" : "V"
              ));
            }
            row.appendChild(form);
            rows.appendChild(row);
          }
          card.appendChild(rows);
          context.appendChild(document.createTextNode(
            [
              templateText(competition.name, ""),
              templateText(pool.name, ""),
              templateText(sport.season, "")
            ].filter(function (value) { return Boolean(value); }).join(" · ")
          ));
          card.appendChild(context);
          body.appendChild(card);
        }
      };
    }
    function templateSportDisplayConfiguration(value) {
      var source = templateRecord(value) || {};
      var legacyShowLogo = source.showLogo !== false;
      var legacyShowDressingRoom = source.showDressingRoom === true;
      var showAwayDressingRoom = typeof source.showAwayDressingRoom === "boolean"
        ? source.showAwayDressingRoom : legacyShowDressingRoom;
      var showAwayLogo = typeof source.showAwayLogo === "boolean"
        ? source.showAwayLogo : legacyShowLogo;
      var showHomeDressingRoom = typeof source.showHomeDressingRoom === "boolean"
        ? source.showHomeDressingRoom : legacyShowDressingRoom;
      var showHomeLogo = typeof source.showHomeLogo === "boolean"
        ? source.showHomeLogo : legacyShowLogo;
      return {
        columns: templateText(source.columns, "one") === "two" ? "two" : "one",
        showAwayDressingRoom: showAwayDressingRoom,
        showAwayLogo: showAwayLogo,
        showDate: source.showDate !== false,
        showDressingRoom: showHomeDressingRoom || showAwayDressingRoom,
        showField: source.showField !== false,
        showHomeAway: source.showHomeAway !== false,
        showHomeDressingRoom: showHomeDressingRoom,
        showHomeLogo: showHomeLogo,
        showLogo: showHomeLogo || showAwayLogo,
        showReferee: source.showReferee === true,
        showSportpark: source.showSportpark !== false,
        showTime: source.showTime !== false
      };
    }
    function templateSportOfficials(item) {
      return templateArray(item.officials).map(function (officialValue) {
        var official = templateRecord(officialValue);
        return templateText(
          official && (official.displayName || official.name),
          templateText(officialValue, "")
        );
      }).filter(Boolean);
    }
    function templateLegacyProgramColumns(displayConfiguration, compact) {
      var tracks = [];
      if (displayConfiguration.showDate) tracks.push("minmax(140px,.72fr)");
      if (displayConfiguration.showTime) tracks.push("minmax(60px,.48fr)");
      if (displayConfiguration.showHomeLogo) tracks.push(compact ? "42px" : "48px");
      tracks.push("minmax(0,1.55fr)");
      if (displayConfiguration.showHomeDressingRoom) tracks.push("minmax(0,.88fr)");
      tracks.push("36px");
      if (displayConfiguration.showAwayLogo) tracks.push(compact ? "42px" : "48px");
      tracks.push("minmax(0,1.55fr)");
      if (displayConfiguration.showAwayDressingRoom) tracks.push("minmax(0,.88fr)");
      return tracks.join(" ");
    }
    function templateLegacyResultColumns(displayConfiguration, compact) {
      var tracks = [];
      if (displayConfiguration.showDate) tracks.push("minmax(190px,.82fr)");
      if (displayConfiguration.showTime) tracks.push("minmax(70px,.48fr)");
      if (displayConfiguration.showHomeLogo) tracks.push(compact ? "48px" : "57px");
      tracks.push("minmax(0,1.55fr)", "minmax(112px,.68fr)");
      if (displayConfiguration.showAwayLogo) tracks.push(compact ? "48px" : "57px");
      tracks.push("minmax(0,1.55fr)");
      return tracks.join(" ");
    }
    function templateLegacyMatchDetailValue(value) {
      return templateText(value, "")
        .replace(/^(?:kleedkamer|veld|field|sportpark)\\s*:?\\s*/i, "")
        .trim() || "volgt";
    }
    function renderLegacyMatchDetail(label, value, className) {
      var detail = templateNode("span", className);
      detail.appendChild(templateNode("b", "", label + ":"));
      detail.appendChild(document.createTextNode(" " + value));
      return detail;
    }
    function renderLegacyMatchLogo(team, mediaAssetId, payload, side) {
      var logo = templateNode(
        "span",
        "legacy-match-logo legacy-match-" + side + "-logo"
      );
      logo.appendChild(renderLegacyTeamMini(team, mediaAssetId, payload));
      return logo;
    }
    function renderLegacyMatchTeam(team, side) {
      var node = templateNode(
        "strong",
        "legacy-match-team legacy-match-" + side + "-team",
        team
      );
      node.title = team;
      return node;
    }
    function renderLegacyProgramPrimary(item, teams, displayConfiguration, payload, royalCurrent, forceTimeColumn) {
      var primary = templateNode("div", "legacy-program-primary");
      var cancelled = royalCurrent && templateLegacyMatchCancelled(item);
      if (displayConfiguration.showDate) {
        primary.appendChild(templateNode(
          "span", "legacy-match-date",
          templateText(item.date, templateText(item.secondary, "Datum volgt"))
        ));
      }
      if (cancelled) {
        primary.appendChild(templateNode(
          "span", "legacy-match-time legacy-cancelled-kickoff", "Afgelast"
        ));
      } else if (displayConfiguration.showTime) {
        primary.appendChild(templateNode(
          "span", "legacy-match-time",
          templateText(item.time, templateText(item.kickoffTime, "Tijd volgt"))
        ));
      } else if (forceTimeColumn) {
        var emptyProgramTime = templateNode("span", "legacy-match-time legacy-match-time-empty", "");
        emptyProgramTime.setAttribute("aria-hidden", "true");
        primary.appendChild(emptyProgramTime);
      }
      if (displayConfiguration.showHomeLogo) {
        primary.appendChild(renderLegacyMatchLogo(
          teams[0], item.homeLogoMediaAssetId, payload, "home"
        ));
      }
      primary.appendChild(renderLegacyMatchTeam(teams[0], "home"));
      if (displayConfiguration.showHomeDressingRoom) {
        primary.appendChild(templateNode(
          "span", "legacy-match-room legacy-match-home-room",
          "Kleedkamer " + templateLegacyMatchDetailValue(item.homeRoom)
        ));
      }
      primary.appendChild(templateNode("i", "legacy-match-separator", "vs."));
      if (displayConfiguration.showAwayLogo) {
        primary.appendChild(renderLegacyMatchLogo(
          teams[1], item.awayLogoMediaAssetId, payload, "away"
        ));
      }
      primary.appendChild(renderLegacyMatchTeam(teams[1], "away"));
      if (displayConfiguration.showAwayDressingRoom) {
        primary.appendChild(templateNode(
          "span", "legacy-match-room legacy-match-away-room",
          "Kleedkamer " + templateLegacyMatchDetailValue(item.awayRoom)
        ));
      }
      return primary;
    }
    function renderLegacyProgramSecondary(item, displayConfiguration) {
      var secondary = templateNode("div", "legacy-program-secondary");
      var officials;
      if (displayConfiguration.showReferee) {
        officials = templateSportOfficials(item);
        secondary.appendChild(renderLegacyMatchDetail(
          "Scheidsrechter", officials.join(" · ") || "volgt", "legacy-match-referee"
        ));
      }
      if (displayConfiguration.showField) {
        secondary.appendChild(renderLegacyMatchDetail(
          "Veld",
          templateLegacyMatchDetailValue(item.field || item.venue || item.meta),
          "legacy-match-field"
        ));
      }
      if (displayConfiguration.showSportpark) {
        secondary.appendChild(renderLegacyMatchDetail(
          "Sportpark", templateLegacyMatchDetailValue(item.venueName),
          "legacy-match-sportpark"
        ));
      }
      return secondary.children.length ? secondary : null;
    }
    function templateLegacyResultScore(value) {
      var numeric;
      if (value === null || value === undefined || value === "") return "";
      numeric = Number(value);
      return isFinite(numeric) && Math.floor(numeric) === numeric &&
        numeric >= 0 && numeric <= 999
        ? String(numeric) : "";
    }
    function renderLegacyResultPrimary(item, teams, displayConfiguration, payload, royalCurrent, forceTimeColumn) {
      var primary = templateNode("div", "legacy-result-primary");
      var homeScore;
      var awayScore;
      var score;
      var cancelled = royalCurrent && templateLegacyMatchCancelled(item);
      if (displayConfiguration.showDate) {
        primary.appendChild(templateNode(
          "span", "legacy-match-date",
          templateText(item.date, templateText(item.secondary, "Datum volgt"))
        ));
      }
      if (cancelled) {
        primary.appendChild(templateNode(
          "span", "legacy-match-time legacy-cancelled-kickoff", "Afgelast"
        ));
      } else if (displayConfiguration.showTime) {
        primary.appendChild(templateNode(
          "span", "legacy-match-time",
          templateText(item.time, templateText(item.kickoffTime, "Tijd volgt"))
        ));
      } else if (forceTimeColumn) {
        var emptyResultTime = templateNode("span", "legacy-match-time legacy-match-time-empty", "");
        emptyResultTime.setAttribute("aria-hidden", "true");
        primary.appendChild(emptyResultTime);
      }
      if (displayConfiguration.showHomeLogo) {
        primary.appendChild(renderLegacyMatchLogo(
          teams[0], item.homeLogoMediaAssetId, payload, "home"
        ));
      }
      primary.appendChild(renderLegacyMatchTeam(teams[0], "home"));
      homeScore = templateLegacyResultScore(item.homeScore);
      awayScore = templateLegacyResultScore(item.awayScore);
      score = templateNode("i", "legacy-result-score");
      if (homeScore && awayScore) {
        score.appendChild(templateNode("b", "", homeScore));
        score.appendChild(templateNode("span", "", "–"));
        score.appendChild(templateNode("b", "", awayScore));
      }
      score.setAttribute(
        "aria-label",
        homeScore && awayScore
          ? "Uitslag " + homeScore + " tegen " + awayScore
          : "Uitslag nog niet bekend"
      );
      primary.appendChild(score);
      if (displayConfiguration.showAwayLogo) {
        primary.appendChild(renderLegacyMatchLogo(
          teams[1], item.awayLogoMediaAssetId, payload, "away"
        ));
      }
      primary.appendChild(renderLegacyMatchTeam(teams[1], "away"));
      return primary;
    }
    function configureLegacyMatchColumns(list, itemCount, displayColumns, royalCurrent) {
      var columns = displayColumns === "two" && itemCount > 1 ? "two" : "one";
      list.setAttribute("data-columns", columns);
      if (columns === "two") {
        if (royalCurrent) {
          list.style.gridTemplateRows = "repeat(" + Math.ceil(itemCount / 2) + ",var(--sport-list-row-height,96px))";
        } else {
          list.style.gridTemplateRows = "repeat(" + Math.ceil(itemCount / 2) + ",var(--sport-list-row-height,115px))";
        }
      }
    }
    function renderSportTemplate(body, snapshot, slideType, orientation, payload) {
      var sport = templateRecord(snapshot.sport) || {};
      var royalCurrent = Boolean(templateRoyalCurrentAppearance(snapshot));
      var sportTimezone = templateText(sport.timezone, "Europe/Amsterdam");
      var birthday = slideType === "sport_birthdays";
      var itemLimit = slideType === "sport_program" || slideType === "sport_results"
        ? 100
        : 40;
      var items = templateArray(birthday ? (sport.birthdays || sport.items) : sport.items, itemLimit).filter(function (row) {
        return sportMatchBelongsOnSlide(slideType, templateRecord(row) || {}, new Date().getTime());
      });
      var birthdayConfiguration = templateRecord(sport.configuration) || {};
      var birthdayPresentation = templateRecord(birthdayConfiguration.presentation) || {};
      var birthdayPeriod = templateRecord(birthdayConfiguration.period) || {};
      if (birthday) {
        var fetchedAt = new Date(templateText(sport.fetchedAt, "")).getTime();
        var localNow = new Date();
        var timezone = templateText(sport.timezone, "Europe/Amsterdam");
        try {
          var localParts = new Intl.DateTimeFormat("en-CA", {
            day: "2-digit", month: "2-digit", timeZone: timezone, year: "numeric"
          }).formatToParts(localNow);
          var localPart = function (type) {
            var found = localParts.filter(function (entry) { return entry.type === type; })[0];
            return Number(found && found.value);
          };
          localNow = new Date(Date.UTC(localPart("year"), localPart("month") - 1, localPart("day")));
        } catch (error) {
          localNow = new Date(Date.UTC(localNow.getFullYear(), localNow.getMonth(), localNow.getDate()));
        }
        var maximumDays = templateText(birthdayConfiguration.emptyBehavior, "skip") === "today_only"
          ? 0 : Math.max(0, Math.min(20, Number(birthdayPeriod.days || 7) - 1));
        items = !isFinite(fetchedAt) || new Date().getTime() - fetchedAt > 21 * 86400000
          ? []
          : items.filter(function (candidate) {
            var entry = templateRecord(candidate) || {};
            var month = Number(entry.month);
            var day = Number(entry.day);
            var year = localNow.getUTCFullYear();
            var occurrence = new Date(Date.UTC(year, month - 1, day));
            if (occurrence.getTime() < localNow.getTime()) occurrence = new Date(Date.UTC(year + 1, month - 1, day));
            var distance = Math.round((occurrence.getTime() - localNow.getTime()) / 86400000);
            return isFinite(distance) && distance >= 0 && distance <= maximumDays;
          });
      }
      var arrival = slideType === "sport_visitor_arrivals" || slideType === "sport_referee_arrivals";
      var arrivalConfiguration = templateRecord(sport.arrivalConfig) || {};
      var displayConfiguration = templateSportDisplayConfiguration(sport.displayConfig);
      var displayColumns = orientation === "landscape" &&
        displayConfiguration.columns === "two" ? "two" : "one";
      if (slideType === "sport_visitor_arrivals") {
        items = templateVisitorArrivalItems(items, sportTimezone);
      }
      var cardsPerPage = slideType === "sport_visitor_arrivals"
        ? royalCurrent
          ? Math.max(1, Math.min(3, Number(arrivalConfiguration.cardCount) || 3))
          : 2
        : Math.max(1, Math.min(4, Number(arrivalConfiguration.cardCount) || 4));
      var match = slideType === "sport_match_of_the_day" || slideType === "sport_next_match";
      var birthdayPageSize = birthday
        ? legacyBirthdayPageSize(
          orientation === "portrait"
            ? birthdayPresentation.maxPerPortraitPage
            : birthdayPresentation.maxPerLandscapePage,
          6
        )
        : 0;
      var responsiveList = ["sport_program", "sport_results", "sport_cancellations", "sport_dressing_rooms", "sport_officials"].indexOf(slideType) !== -1;
      var listLayout = resolveSportListLayout({ orientation: orientation, slideType: slideType,
        itemCount: items.length, contentHeight: body.clientHeight || undefined, columns: displayColumns === "two" ? 2 : 1 });
      var pages = match ? [items.length ? items[0] : null] :
        birthday && !items.length ? [] :
        arrival && !items.length && templateText(arrivalConfiguration.emptyBehavior, "skip") === "skip" ? [] : templatePages(
          items,
          birthday
            ? birthdayPageSize
            : arrival ? cardsPerPage
            : responsiveList ? listLayout.capacity
            : slideType === "sport_sponsor" ? 1
            : orientation === "portrait" ? 6 : 8
        );
      return {
        pages: pages,
        pageDuration: birthday
          ? Math.max(6000, Math.min(20000, (Number(birthdayPresentation.pageDurationSeconds) || 8) * 1000))
          : arrival
          ? Math.max(5000, Math.min(120000, (Number(sport.pageDurationSeconds) || 5) * 1000))
          : undefined,
        render: function (page, activePageIndex) {
          var item;
          var teams;
          var centre;
          var meta;
          var index;
          body.innerHTML = "";
          if (responsiveList) {
            var pageLayout = resolveSportListLayout({ orientation: orientation, slideType: slideType,
              itemCount: page.length, contentHeight: body.clientHeight || listLayout.contentHeight,
              columns: displayColumns === "two" ? 2 : 1 });
            body.style.setProperty("--sport-list-row-height", pageLayout.rowHeight + "px");
          }
          if (match) {
            item = templateRecord(page);
            if (!item) {
              body.appendChild(templateNode("div", "dynamic-empty", "Deze wedstrijdinformatie is nog niet beschikbaar."));
              return;
            }
            teams = [
              templateText(item.homeTeam, splitTemplateTeams(templateText(item.primary, ""))[0]),
              templateText(item.awayTeam, splitTemplateTeams(templateText(item.primary, ""))[1])
            ];
            centre = templateNode("div", "dynamic-match");
            centre.appendChild(renderMatchTeam(
              teams[0], item.homeLogoMediaAssetId, payload
            ));
            meta = templateNode("div", "dynamic-match-meta");
            meta.appendChild(templateNode("small", "", templateText(item.status, "Programma")));
            meta.appendChild(templateNode(
              "strong",
              royalCurrent && templateLegacyMatchCancelled(item) ? "legacy-cancelled-kickoff" : "",
              royalCurrent && templateLegacyMatchCancelled(item)
                ? "Afgelast"
                : templateText(item.time, templateText(item.secondary, "Tijd volgt"))
            ));
            meta.appendChild(templateNode(
              "p",
              "",
              templateText(item.venue, templateText(item.meta, "Locatie volgt"))
            ));
            centre.appendChild(meta);
            centre.appendChild(renderMatchTeam(
              teams[1], item.awayLogoMediaAssetId, payload
            ));
            body.appendChild(centre);
            return;
          }
          if (!page.length) {
            body.appendChild(templateNode("div", "dynamic-empty", "Deze clubinformatie is nu niet beschikbaar."));
            return;
          }
          if (birthday) {
            var birthdaySelection = templateRecord(birthdayConfiguration.selection) || {};
            var birthdayLayoutMode = templateText(birthdayPresentation.layout, "auto");
            if (birthdayLayoutMode === "auto") {
              birthdayLayoutMode = birthdayPageSize === 1
                ? "spotlight"
                : birthdayPageSize === 6 ? "birthday_roll" : "celebration_grid";
            }
            var birthdayLayout = templateNode("div", "legacy-birthday-layout");
            birthdayLayout.setAttribute("data-page-size", String(birthdayPageSize));
            birthdayLayout.setAttribute("data-layout", birthdayLayoutMode);
            var birthdayBackgroundUrl = templateAssetUrl(
              payload,
              templateText(birthdayPresentation.backgroundMediaAssetId, "")
            );
            var birthdayShowTeamRole = birthdaySelection.showTeamRole !== false;
            var birthdayShowRole = birthdaySelection.showRole !== false;
            var birthdayShowTeam = birthdaySelection.showTeam !== false;
            for (index = 0; index < page.length; index += 1) {
              item = templateRecord(page[index]) || {};
              var birthdayDisplayName = templateText(
                item.displayName,
                templateText(item.primary, "")
              );
              if (!birthdayDisplayName) continue;
              var birthdayCard = templateNode("article", "legacy-birthday-card");
              birthdayCard.setAttribute("data-birthday-card", "true");
              var birthdayPhoto = templateNode("div", "legacy-birthday-photo");
              if (birthdayBackgroundUrl) {
                birthdayPhoto.style.backgroundImage = "url(" + birthdayBackgroundUrl + ")";
              }
              birthdayPhoto.setAttribute("aria-hidden", "true");
              birthdayCard.appendChild(birthdayPhoto);
              var birthdayMonth = Number(item.month);
              var birthdayDay = Number(item.day);
              var birthdayIsToday = (
                isFinite(birthdayMonth) && isFinite(birthdayDay) &&
                birthdayMonth === localNow.getUTCMonth() + 1 &&
                birthdayDay === localNow.getUTCDate()
              );
              if (birthdayIsToday) birthdayCard.setAttribute("data-today", "true");
              if (birthdayIsToday && birthdaySelection.emphasizeToday !== false) birthdayCard.setAttribute("data-emphasize-today", "true");
              var birthdayCopy = templateNode("div", "legacy-birthday-copy");
              birthdayCopy.appendChild(templateNode("b", "", "Gefeliciteerd"));
              birthdayCopy.appendChild(templateNode("h2", "", birthdayDisplayName));
              if (birthdayShowTeamRole) {
                var birthdayRole = birthdayShowRole
                  ? templateText(item.role, templateText(item.function, "")) : "";
                var birthdayTeams = birthdayShowTeam
                  ? templateArray(item.teams, 8).map(function (teamValue) {
                    var team = templateRecord(teamValue);
                    return templateText(team && (team.name || team.teamName), templateText(teamValue, ""));
                  }).filter(Boolean) : [];
                if (!birthdayTeams.length && birthdayShowTeam) {
                  var fallbackTeam = templateText(item.teamName, templateText(item.team, ""));
                  if (fallbackTeam) birthdayTeams.push(fallbackTeam);
                }
                var birthdayMeta = [birthdayRole].concat(birthdayTeams).filter(Boolean).join(" · ");
                if (birthdayMeta) birthdayCopy.appendChild(templateNode("p", "", birthdayMeta));
              }
              var birthdayAge = birthdaySelection.showAge !== false && item.age !== null && item.age !== undefined ? Number(item.age) : NaN;
              var birthdayDateLabel = templateText(
                item.displayDate,
                templateText(item.dateLabel, templateText(item.date, ""))
              );
              var birthdayStatus = birthdayIsToday ? "Vandaag jarig" : birthdaySelection.showDate !== false && birthdayDateLabel || "Binnenkort jarig";
              if (isFinite(birthdayAge) && Math.floor(birthdayAge) === birthdayAge && birthdayAge >= 0) birthdayStatus += " · " + String(birthdayAge) + " jaar";
              birthdayCopy.appendChild(templateNode("strong", "", birthdayStatus));
              birthdayCard.appendChild(birthdayCopy);
              birthdayLayout.appendChild(birthdayCard);
            }
            body.appendChild(birthdayLayout);
            return;
          }
          if (arrival) {
            var royalVisitorArrivals = royalCurrent && slideType === "sport_visitor_arrivals";
            var arrivalGrid = templateNode("div", "legacy-arrival-grid");
            if (royalVisitorArrivals) arrivalGrid.className += " legacy-royal-arrival-grid";
            arrivalGrid.setAttribute(
              "data-arrival-kind",
              slideType === "sport_visitor_arrivals" ? "visitor" : "referee"
            );
            arrivalGrid.setAttribute("data-cards", String(royalVisitorArrivals ? cardsPerPage : page.length));
            if (royalVisitorArrivals) {
              var royalArrivalTypography = templateRecord(
                (templateRoyalCurrentAppearance(snapshot) || {}).typography
              ) || {};
              var royalArrivalScale = Math.max(
                .9, Math.min(1.2, Number(royalArrivalTypography.baseScale) || 1)
              );
              var royalArrivalPad = cardsPerPage === 1 ? 42 : 28;
              var royalArrivalTitle = cardsPerPage === 1 ? 92 : 62;
              var royalArrivalText = cardsPerPage === 1 ? 36 : 28;
              var royalArrivalMeta = cardsPerPage === 1 ? 36 : 28;
              var royalArrivalLabel = cardsPerPage === 1 ? 21 : 17;
              if (orientation === "portrait") {
                royalArrivalPad = cardsPerPage === 1 ? 42 : cardsPerPage === 3 ? 24 : 28;
                royalArrivalTitle = cardsPerPage === 1 ? 96 : cardsPerPage === 2 ? 76 : 58;
                royalArrivalText = cardsPerPage === 1 ? 40 : cardsPerPage === 2 ? 32 : 27;
                royalArrivalMeta = cardsPerPage === 1 ? 42 : cardsPerPage === 2 ? 34 : 29;
                royalArrivalLabel = cardsPerPage === 1 ? 24 : cardsPerPage === 2 ? 21 : 18;
              }
              arrivalGrid.setAttribute("data-slots", String(cardsPerPage));
              arrivalGrid.style.setProperty("--arrival-slots", String(cardsPerPage));
              arrivalGrid.style.setProperty("--arrival-pad", String(royalArrivalPad) + "px");
              arrivalGrid.style.setProperty("--arrival-title", String(royalArrivalTitle * royalArrivalScale) + "px");
              arrivalGrid.style.setProperty("--arrival-text", String(royalArrivalText * royalArrivalScale) + "px");
              arrivalGrid.style.setProperty("--arrival-meta", String(royalArrivalMeta * royalArrivalScale) + "px");
              arrivalGrid.style.setProperty("--arrival-label", String(royalArrivalLabel * royalArrivalScale) + "px");
              arrivalGrid.style.setProperty("--arrival-index", String(29 * royalArrivalScale) + "px");
            }
            var configuredMotion = templateText(arrivalConfiguration.motionPreset, "auto");
            var motionPresets = ["aurora-rise", "spotlight-bloom", "kinetic-split", "prism-swipe", "grand-flip"];
            var clubName = templateText((templateRecord(snapshot.brand) || {}).clubName, "onze club");
            for (index = 0; index < page.length; index += 1) {
              item = templateRecord(page[index]) || {};
              if (!templateText(item.primary, "")) continue;
              var motion = motionPresets.indexOf(configuredMotion) !== -1
                ? configuredMotion
                : motionPresets[((Number(activePageIndex) || 0) * cardsPerPage + index) % motionPresets.length];
              var arrivalCard = templateNode("article", "legacy-arrival-card");
              arrivalCard.setAttribute(
                "data-arrival-kind",
                slideType === "sport_visitor_arrivals" ? "visitor" : "referee"
              );
              if (royalVisitorArrivals) {
                var royalArrivalLogoUrl = templateAssetUrl(
                  payload,
                  templateText(item.awayLogoMediaAssetId, templateText(item.logoMediaAssetId, ""))
                );
                var royalArrivalHomeTeam = templateText(item.homeTeam, clubName);
                var royalArrivalAwayTeam = templateText(
                  item.awayTeam,
                  templateText(item.primary, "Bezoekend team")
                );
                var royalArrivalMotion = motionPresets.indexOf(configuredMotion) !== -1
                  ? configuredMotion
                  : motionPresets[((Number(activePageIndex) || 0) * cardsPerPage + index) % motionPresets.length];
                arrivalCard.className += " legacy-royal-arrival-card";
                arrivalCard.setAttribute("data-logo", royalArrivalLogoUrl ? "visible" : "missing");
                if ((templateRoyalCurrentAppearance(snapshot) || {}).motionEnabled !== false) {
                  arrivalCard.setAttribute("data-motion", royalArrivalMotion);
                }
                arrivalCard.style.setProperty("--arrival-delay", String(index * 110) + "ms");
                if (royalArrivalLogoUrl) {
                  var royalArrivalWatermark = templateNode("img", "legacy-royal-arrival-watermark");
                  royalArrivalWatermark.alt = "";
                  royalArrivalWatermark.setAttribute("aria-hidden", "true");
                  royalArrivalWatermark.src = royalArrivalLogoUrl;
                  arrivalCard.appendChild(royalArrivalWatermark);
                }
                arrivalCard.appendChild(templateNode("div", "legacy-royal-arrival-gradient"));
                var royalArrivalCrest = templateNode("div", "legacy-royal-arrival-crest");
                var royalArrivalTop = templateNode("div", "legacy-royal-arrival-top");
                royalArrivalTop.appendChild(templateNode(
                  "span", "", "Welkom bij " + clubName
                ));
                royalArrivalCrest.appendChild(royalArrivalTop);
                var royalArrivalLogo = templateNode("div", "legacy-royal-arrival-logo");
                if (royalArrivalLogoUrl) {
                  var royalArrivalLogoImage = templateNode("img", "");
                  royalArrivalLogoImage.alt = "Logo " + royalArrivalAwayTeam;
                  royalArrivalLogoImage.src = royalArrivalLogoUrl;
                  royalArrivalLogo.appendChild(royalArrivalLogoImage);
                } else {
                  royalArrivalLogo.appendChild(templateNode(
                    "span", "", templateInitials(royalArrivalAwayTeam)
                  ));
                }
                royalArrivalCrest.appendChild(royalArrivalLogo);
                arrivalCard.appendChild(royalArrivalCrest);
                var royalArrivalBody = templateNode("div", "legacy-royal-arrival-body");
                var royalArrivalIdentity = templateNode("div", "legacy-royal-arrival-identity");
                royalArrivalIdentity.appendChild(templateNode("h2", "", royalArrivalAwayTeam));
                royalArrivalIdentity.appendChild(templateNode(
                  "span", "", "Welkom op " + templateText(item.venueName, clubName)
                ));
                royalArrivalIdentity.appendChild(templateNode(
                  "p", "", royalArrivalHomeTeam + " tegen " + royalArrivalAwayTeam
                ));
                royalArrivalBody.appendChild(royalArrivalIdentity);
                var royalArrivalInfo = templateNode("div", "legacy-royal-arrival-info");
                function appendRoyalArrivalInfo(label, value) {
                  var detail = templateNode("div", "");
                  detail.appendChild(templateNode("span", "", label));
                  detail.appendChild(templateNode("strong", "", value || "-"));
                  royalArrivalInfo.appendChild(detail);
                }
                appendRoyalArrivalInfo(
                  "Aftrap", templateText(item.kickoffTime, templateText(item.time, "-"))
                );
                appendRoyalArrivalInfo(
                  "Locatie",
                  templateText(item.field, templateText(item.venueName, templateText(item.venue, "-")))
                );
                appendRoyalArrivalInfo(
                  "Omkleden",
                  [
                    item.homeRoom ? "Thuis " + templateText(item.homeRoom, "") : "",
                    (item.awayRoom || item.dressingRoom)
                      ? "Uit " + templateText(item.awayRoom, templateText(item.dressingRoom, ""))
                      : ""
                  ].filter(Boolean).join(" · ") || "-"
                );
                royalArrivalBody.appendChild(royalArrivalInfo);
                arrivalCard.appendChild(royalArrivalBody);
                arrivalGrid.appendChild(arrivalCard);
                continue;
              }
              var arrivalSponsorUrl = slideType !== "sport_visitor_arrivals" &&
                arrivalConfiguration.showSponsor === true
                ? templateAssetUrl(
                  payload,
                  templateText(arrivalConfiguration.sponsorMediaAssetId, "")
                )
                : "";
              if (slideType === "sport_visitor_arrivals") {
                arrivalCard.setAttribute("data-motion", motion);
                arrivalCard.style.setProperty("--arrival-delay", String(index * 110) + "ms");
              }
              var arrivalLogoUrl = templateAssetUrl(
                payload,
                templateText(item.logoMediaAssetId, "")
              );
              arrivalCard.setAttribute("data-logo", arrivalLogoUrl ? "visible" : "missing");
              if (arrivalLogoUrl) {
                var arrivalLogoBackdrop = templateNode("img", "legacy-arrival-logo-backdrop");
                arrivalLogoBackdrop.alt = "";
                arrivalLogoBackdrop.setAttribute("aria-hidden", "true");
                arrivalLogoBackdrop.src = arrivalLogoUrl;
                arrivalCard.appendChild(arrivalLogoBackdrop);
                var arrivalLogoMark = templateNode("div", "legacy-arrival-logo-mark");
                var arrivalLogo = templateNode("img", "");
                arrivalLogo.alt = "Logo " + templateText(item.primary, "bezoekende ploeg");
                arrivalLogo.src = arrivalLogoUrl;
                arrivalLogoMark.appendChild(arrivalLogo);
                arrivalCard.appendChild(arrivalLogoMark);
              }
              if (slideType === "sport_visitor_arrivals") {
                var visitorCopy = templateNode("div", "legacy-visitor-arrival-copy");
                var visitorSchedule = templateNode("div", "legacy-visitor-schedule");
                var visitorDate = templateNode("time", "", templateText(item.date, "Datum volgt"));
                visitorDate.setAttribute("datetime", templateText(item.kickoffAt, ""));
                visitorSchedule.appendChild(visitorDate);
                visitorSchedule.appendChild(templateNode(
                  "span", "", "Aanvang: " + templateText(item.kickoffTime, "volgt")
                ));
                visitorCopy.appendChild(visitorSchedule);
                var visitorTeams = templateNode("div", "legacy-visitor-teams");
                var visitorMatchup = templateNode("h2", "");
                var visitorHomeTeam = templateText(item.homeTeam, clubName);
                var visitorAwayTeam = templateText(
                  item.awayTeam,
                  templateText(item.primary, "Bezoekend team")
                );
                visitorMatchup.setAttribute(
                  "aria-label",
                  visitorHomeTeam + " tegen " + visitorAwayTeam
                );
                visitorMatchup.appendChild(templateNode("span", "", visitorHomeTeam));
                visitorMatchup.appendChild(templateNode("span", "", visitorAwayTeam));
                visitorTeams.appendChild(visitorMatchup);
                visitorCopy.appendChild(visitorTeams);
                var visitorDetails = templateNode("dl", "legacy-visitor-details");
                var visitorRoomDetail = templateNode("div", "");
                visitorRoomDetail.appendChild(templateNode("dt", "", "Kleedkamers:"));
                var visitorRooms = templateNode("dd", "legacy-visitor-room-line");
                visitorRooms.appendChild(templateNode(
                  "span", "", "Thuis: " + templateText(item.homeRoom, "-")
                ));
                visitorRooms.appendChild(templateNode("i", "", "|"));
                visitorRooms.appendChild(templateNode(
                    "span", "", "Uit: " + templateText(
                      item.awayRoom,
                      templateText(item.dressingRoom, "-")
                    )
                ));
                visitorRoomDetail.appendChild(visitorRooms);
                visitorDetails.appendChild(visitorRoomDetail);
                var visitorFieldDetail = templateNode("div", "");
                visitorFieldDetail.appendChild(templateNode("dt", "", "Veld:"));
                visitorFieldDetail.appendChild(templateNode(
                  "dd", "", templateText(item.field, "-")
                ));
                visitorDetails.appendChild(visitorFieldDetail);
                var visitorOfficialNames = templateArray(item.officials).map(function (officialValue) {
                  var official = templateRecord(officialValue);
                  return templateText(
                    official && (official.displayName || official.name),
                    templateText(officialValue, "")
                  );
                }).filter(Boolean);
                var visitorOfficialDetail = templateNode("div", "");
                visitorOfficialDetail.appendChild(templateNode("dt", "", "Scheidsrechter:"));
                visitorOfficialDetail.appendChild(templateNode(
                  "dd", "", visitorOfficialNames.join(", ") || "-"
                ));
                visitorDetails.appendChild(visitorOfficialDetail);
                visitorCopy.appendChild(visitorDetails);
                arrivalCard.appendChild(visitorCopy);
              } else {
                var welcome = templateText(item.status, "Wedstrijdofficial")
                  .replace(/\\{\\{club\\}\\}/g, clubName)
                  .replace(/\\{\\{team\\}\\}/g, templateText(item.primary, ""));
                arrivalCard.appendChild(templateNode("i", "", welcome));
                if (!arrivalLogoUrl) {
                  arrivalCard.appendChild(templateNode(
                    "b",
                    "",
                    (index + 1 < 10 ? "0" : "") + String(index + 1)
                  ));
                }
                arrivalCard.appendChild(templateNode("h2", "", templateText(item.primary, "Clubinformatie")));
                arrivalCard.appendChild(templateNode("p", "", templateText(item.secondary, "")));
                arrivalCard.appendChild(templateNode("strong", "", templateText(item.meta, "")));
              }
              if (arrivalSponsorUrl) {
                arrivalCard.setAttribute("data-sponsor", "visible");
                var arrivalSponsor = templateNode("img", "legacy-arrival-sponsor");
                arrivalSponsor.alt = "Sponsor";
                arrivalSponsor.src = arrivalSponsorUrl;
                arrivalCard.appendChild(arrivalSponsor);
              }
              arrivalGrid.appendChild(arrivalCard);
            }
            if (royalVisitorArrivals) {
              while (arrivalGrid.children.length < cardsPerPage) {
                var emptyArrivalSlot = templateNode(
                  "article",
                  "legacy-arrival-card legacy-royal-arrival-card legacy-royal-arrival-empty"
                );
                emptyArrivalSlot.setAttribute("aria-hidden", "true");
                emptyArrivalSlot.setAttribute("data-arrival-kind", "visitor");
                emptyArrivalSlot.setAttribute("data-empty-slot", "true");
                emptyArrivalSlot.setAttribute("data-logo", "missing");
                emptyArrivalSlot.setAttribute("data-slot", String(arrivalGrid.children.length + 1));
                arrivalGrid.appendChild(emptyArrivalSlot);
              }
            }
            body.appendChild(arrivalGrid);
            return;
          }
          if (slideType === "sport_team") {
            var teamRoster = templateNode("div", "legacy-team-roster");
            teamRoster.setAttribute("data-render-family", "team-roster");
            for (index = 0; index < page.length; index += 1) {
              item = templateRecord(page[index]) || {};
              if (!templateText(item.primary, "")) continue;
              var teamCard = templateNode("article", "legacy-team-card");
              var teamPhoto = templateNode("div", "legacy-team-photo");
              var teamPhotoUrl = templateAssetUrl(
                payload,
                templateText(item.photoMediaAssetId, templateText(item.logoMediaAssetId, ""))
              );
              if (teamPhotoUrl) {
                var teamImage = templateNode("img", "");
                teamImage.alt = "";
                teamImage.src = teamPhotoUrl;
                teamPhoto.appendChild(teamImage);
              } else {
                teamPhoto.appendChild(templateNode(
                  "span", "", templateInitials(templateText(item.primary, "Team"))
                ));
              }
              var teamCopy = templateNode("div", "legacy-team-copy");
              teamCopy.appendChild(templateNode("i", "", templateText(item.status, "Team")));
              teamCopy.appendChild(templateNode("h2", "", templateText(item.primary, "Team")));
              if (item.secondary) teamCopy.appendChild(templateNode("p", "", templateText(item.secondary, "")));
              if (item.meta) teamCopy.appendChild(templateNode("strong", "", templateText(item.meta, "")));
              teamCard.appendChild(teamPhoto);
              teamCard.appendChild(teamCopy);
              teamRoster.appendChild(teamCard);
            }
            body.appendChild(teamRoster);
            return;
          }
          if (slideType === "sport_sponsor") {
            var sponsorLayout = templateNode("div", "legacy-sponsor-layout");
            sponsorLayout.setAttribute("data-items", String(page.length));
            sponsorLayout.setAttribute("data-render-family", "sponsor-spotlight");
            for (index = 0; index < page.length; index += 1) {
              item = templateRecord(page[index]) || {};
              if (!templateText(item.primary, "")) continue;
              var sponsorCard = templateNode("article", "legacy-sponsor-card");
              var sponsorPlate = templateNode("div", "legacy-sponsor-plate");
              var sponsorLogoUrl = templateAssetUrl(
                payload,
                templateText(item.photoMediaAssetId, templateText(item.logoMediaAssetId, ""))
              );
              if (sponsorLogoUrl) {
                var sponsorImage = templateNode("img", "");
                sponsorImage.alt = "Logo " + templateText(item.primary, "partner");
                sponsorImage.src = sponsorLogoUrl;
                sponsorPlate.appendChild(sponsorImage);
              } else {
                sponsorPlate.appendChild(templateNode(
                  "span", "", templateInitials(templateText(item.primary, "Partner"))
                ));
              }
              var sponsorCopy = templateNode("div", "legacy-sponsor-copy");
              sponsorCopy.appendChild(templateNode("i", "", "Partner van de club"));
              sponsorCopy.appendChild(templateNode("h2", "", templateText(item.primary, "Partner")));
              if (item.meta) sponsorCopy.appendChild(templateNode("p", "", templateText(item.meta, "")));
              if (item.secondary) sponsorCopy.appendChild(templateNode("strong", "", templateText(item.secondary, "")));
              sponsorCard.appendChild(sponsorPlate);
              sponsorCard.appendChild(sponsorCopy);
              sponsorLayout.appendChild(sponsorCard);
            }
            body.appendChild(sponsorLayout);
            return;
          }
          if (slideType === "sport_trainings") {
            var trainingSchedule = templateNode("div", "legacy-training-schedule");
            trainingSchedule.setAttribute("data-render-family", "training-schedule");
            for (index = 0; index < page.length; index += 1) {
              item = templateRecord(page[index]) || {};
              if (!templateText(item.primary, "")) continue;
              var trainingRow = templateNode("article", "legacy-training-row");
              trainingRow.appendChild(templateNode(
                "b", "", (index + 1 < 10 ? "0" : "") + String(index + 1)
              ));
              var trainingCopy = templateNode("div", "");
              trainingCopy.appendChild(templateNode("i", "", templateText(item.status, "Training")));
              trainingCopy.appendChild(templateNode("h2", "", templateText(item.primary, "Team")));
              if (item.secondary) trainingCopy.appendChild(templateNode("p", "", templateText(item.secondary, "")));
              trainingRow.appendChild(trainingCopy);
              trainingRow.appendChild(templateNode(
                "strong", "", templateText(item.time, templateText(item.meta, templateText(item.venue, "")))
              ));
              trainingSchedule.appendChild(trainingRow);
            }
            body.appendChild(trainingSchedule);
            return;
          }
          if (slideType === "sport_volunteers") {
            var volunteerLayout = templateNode("div", "legacy-volunteer-layout");
            volunteerLayout.setAttribute("data-render-family", "volunteer-call");
            var volunteerCallout = templateNode("aside", "legacy-volunteer-callout");
            volunteerCallout.appendChild(templateNode("i", "", "Samen maken we de club"));
            volunteerCallout.appendChild(templateNode("strong", "", String(page.length)));
            volunteerCallout.appendChild(templateNode("p", "", "vrijwilligersrollen in deze selectie"));
            volunteerLayout.appendChild(volunteerCallout);
            var volunteerCards = templateNode("section", "legacy-volunteer-cards");
            for (index = 0; index < page.length; index += 1) {
              item = templateRecord(page[index]) || {};
              if (!templateText(item.primary, "")) continue;
              var volunteerCard = templateNode("article", "legacy-volunteer-card");
              volunteerCard.appendChild(templateNode("i", "", templateText(item.status, "Vrijwilliger")));
              volunteerCard.appendChild(templateNode("h2", "", templateText(item.primary, "Vrijwilliger")));
              if (item.secondary) volunteerCard.appendChild(templateNode("p", "", templateText(item.secondary, "")));
              if (item.meta) volunteerCard.appendChild(templateNode("strong", "", templateText(item.meta, "")));
              volunteerCards.appendChild(volunteerCard);
            }
            volunteerLayout.appendChild(volunteerCards);
            body.appendChild(volunteerLayout);
            return;
          }
          if (slideType === "sport_program") {
            var fixtureList = templateNode("div", "legacy-fixture-list");
            var fixtureHasCancelled = royalCurrent && page.some(function (value) {
              return templateLegacyMatchCancelled(templateRecord(value) || {});
            });
            var fixtureColumnConfiguration = fixtureHasCancelled && !displayConfiguration.showTime
              ? Object.assign({}, displayConfiguration, { showTime: true })
              : displayConfiguration;
            fixtureList.setAttribute("data-render-family", "fixture-list");
            for (index = 0; index < page.length; index += 1) {
              item = templateRecord(page[index]) || {};
              if (!templateText(item.primary, "") && !templateText(item.homeTeam, "") && !templateText(item.awayTeam, "")) continue;
              teams = [
                templateText(item.homeTeam, splitTemplateTeams(templateText(item.primary, ""))[0]),
                templateText(item.awayTeam, splitTemplateTeams(templateText(item.primary, ""))[1])
              ];
              var fixtureRow = templateNode("article", "legacy-fixture-row");
              fixtureRow.style.setProperty("--match-row-delay", String(360 + index * 110) + "ms");
              fixtureRow.appendChild(renderLegacyProgramPrimary(
                item, teams, displayConfiguration, payload, royalCurrent, fixtureHasCancelled
              ));
              var fixtureSecondary = renderLegacyProgramSecondary(
                item, displayConfiguration
              );
              if (fixtureSecondary) fixtureRow.appendChild(fixtureSecondary);
              fixtureList.appendChild(fixtureRow);
            }
            configureLegacyMatchColumns(
              fixtureList,
              fixtureList.children.length,
              displayColumns,
              royalCurrent
            );
            fixtureList.style.setProperty(
              "--legacy-program-columns",
              templateLegacyProgramColumns(
                fixtureColumnConfiguration,
                fixtureList.getAttribute("data-columns") === "two"
              )
            );
            body.appendChild(fixtureList);
            return;
          }
          if (slideType === "sport_results") {
            var resultList = templateNode("div", "legacy-result-list");
            var resultHasCancelled = royalCurrent && page.some(function (value) {
              return templateLegacyMatchCancelled(templateRecord(value) || {});
            });
            var resultColumnConfiguration = resultHasCancelled && !displayConfiguration.showTime
              ? Object.assign({}, displayConfiguration, { showTime: true })
              : displayConfiguration;
            resultList.setAttribute("data-render-family", "result-list");
            for (index = 0; index < page.length; index += 1) {
              item = templateRecord(page[index]) || {};
              if (!templateText(item.primary, "") && !templateText(item.homeTeam, "") && !templateText(item.awayTeam, "")) continue;
              teams = [
                templateText(item.homeTeam, splitTemplateTeams(templateText(item.primary, ""))[0]),
                templateText(item.awayTeam, splitTemplateTeams(templateText(item.primary, ""))[1])
              ];
              var resultRow = templateNode("article", "legacy-result-row");
              resultRow.style.setProperty("--match-row-delay", String(360 + index * 110) + "ms");
              resultRow.appendChild(renderLegacyResultPrimary(
                item, teams, displayConfiguration, payload, royalCurrent, resultHasCancelled
              ));
              resultList.appendChild(resultRow);
            }
            configureLegacyMatchColumns(
              resultList,
              resultList.children.length,
              displayColumns,
              royalCurrent
            );
            resultList.style.setProperty(
              "--legacy-result-columns",
              templateLegacyResultColumns(
                resultColumnConfiguration,
                resultList.getAttribute("data-columns") === "two"
              )
            );
            body.appendChild(resultList);
            return;
          }
          if ([
            "sport_activities",
            "sport_cancellations",
            "sport_dressing_rooms",
            "sport_officials"
          ].indexOf(slideType) !== -1) {
            var typedKind = slideType === "sport_activities" ? "activity"
              : slideType === "sport_cancellations" ? "cancellation"
              : slideType === "sport_dressing_rooms" ? "dressing"
              : "official";
            var typedList = templateNode("div", "legacy-typed-list");
            typedList.setAttribute("data-render-family", typedKind + "-list");
            for (index = 0; index < page.length; index += 1) {
              item = templateRecord(page[index]) || {};
              if (!templateText(item.primary, "")) continue;
              var typedRow = templateNode("article", "legacy-typed-row");
              typedRow.setAttribute("data-kind", typedKind);
              typedRow.appendChild(templateNode(
                "time",
                royalCurrent && typedKind === "cancellation" ? "legacy-cancelled-kickoff" : "",
                royalCurrent && typedKind === "cancellation"
                  ? "Afgelast"
                  : templateText(item.time, templateText(item.date, templateText(item.secondary, "")))
              ));
              var typedCopy = templateNode("div", "");
              typedCopy.appendChild(templateNode("h2", "", templateText(item.primary, "Clubinformatie")));
              typedCopy.appendChild(templateNode("p", "", templateText(item.venue, templateText(item.meta, ""))));
              typedRow.appendChild(typedCopy);
              var typedMeta = "";
              if (typedKind === "cancellation" && !royalCurrent) {
                typedMeta = templateText(item.status, "Afgelast");
              } else if (typedKind === "dressing") {
                typedMeta = [
                  item.homeRoom ? "Thuis " + templateText(item.homeRoom, "") : "",
                  item.awayRoom ? "Uit " + templateText(item.awayRoom, "") : ""
                ].filter(Boolean).join(" · ") || templateText(item.meta, "");
              } else if (typedKind === "official") {
                typedMeta = templateArray(item.officials).map(function (officialValue) {
                  var official = templateRecord(officialValue);
                  return templateText(official && official.displayName, "");
                }).filter(Boolean).join(" · ") || templateText(item.meta, "Nog niet bekend");
              }
              if (typedMeta) typedRow.appendChild(templateNode("strong", "", typedMeta));
              typedList.appendChild(typedRow);
            }
            body.appendChild(typedList);
            return;
          }
          body.appendChild(templateNode(
            "div",
            "dynamic-empty",
            "Dit schermtype kan niet veilig worden weergegeven."
          ));
        }
      };
    }
    function fitDynamicTemplateCanvas(root, orientation) {
      var mediaRoot = byId("media-root");
      var logicalWidth = orientation === "portrait" ? 1080 : 1920;
      var logicalHeight = orientation === "portrait" ? 1920 : 1080;
      var viewportWidth = mediaRoot.clientWidth || window.innerWidth || logicalWidth;
      var viewportHeight = mediaRoot.clientHeight || window.innerHeight || logicalHeight;
      var orientationMatches = orientation === "portrait"
        ? viewportHeight >= viewportWidth
        : viewportWidth >= viewportHeight;
      var scale = orientationMatches
        ? Math.max(viewportWidth / logicalWidth, viewportHeight / logicalHeight)
        : Math.min(viewportWidth / logicalWidth, viewportHeight / logicalHeight);
      if (!isFinite(scale) || scale <= 0) scale = 1;
      var insetX = orientationMatches
        ? Math.max(0, (logicalWidth - viewportWidth / scale) / 2)
        : 0;
      var insetY = orientationMatches
        ? Math.max(0, (logicalHeight - viewportHeight / scale) / 2)
        : 0;
      root.setAttribute("data-canvas-height", String(logicalHeight));
      root.setAttribute("data-canvas-width", String(logicalWidth));
      root.setAttribute("data-template-orientation", orientation);
      root.setAttribute("data-viewport-fit", orientationMatches ? "cover" : "contain");
      root.style.top = "50%";
      root.style.right = "auto";
      root.style.bottom = "auto";
      root.style.left = "50%";
      root.style.width = String(logicalWidth) + "px";
      root.style.height = String(logicalHeight) + "px";
      root.style.setProperty("--viewport-inset-x", String(insetX) + "px");
      root.style.setProperty("--viewport-inset-y", String(insetY) + "px");
      root.style.transform = "translate(-50%, -50%) scale(" + String(scale) + ")";
      root.style.transformOrigin = "center center";
    }
    function refitDynamicTemplates() {
      var current = runtime.currentElement;
      var pending = runtime.pendingElement;
      var orientation;
      if (current && current.getAttribute) {
        orientation = current.getAttribute("data-template-orientation");
        if (orientation === "portrait" || orientation === "landscape") {
          fitDynamicTemplateCanvas(current, orientation);
        }
      }
      if (pending && pending !== current && pending.getAttribute) {
        orientation = pending.getAttribute("data-template-orientation");
        if (orientation === "portrait" || orientation === "landscape") {
          fitDynamicTemplateCanvas(pending, orientation);
        }
      }
    }
    function parseLedScoresLiveMatchConfig(payload) {
      var snapshot = templateRecord(payload && payload.data) || {};
      var live = templateRecord(snapshot.liveMatch);
      var configuration = live && (templateRecord(live.configuration) || live);
      var connectionId = live && goalUuid(live.connectionId ||
        (configuration && configuration.connectionId));
      var fallback;
      if (!live || !configuration || !connectionId) return null;
      fallback = live.state
        ? parseLedScoresMatchState({
            connectionId: connectionId,
            staleAfterSeconds: 10,
            state: live.state
          })
        : null;
      return {
        accentMode: configuration.accentMode === "contrast" ||
          configuration.accentMode === "neutral"
          ? configuration.accentMode
          : "club",
        connectionId: connectionId,
        fallbackState: fallback,
        outsideMatchBehavior: configuration.outsideMatchBehavior === "skip"
          ? "skip"
          : "last_known",
        showClock: configuration.showClock !== false,
        showStatus: configuration.showStatus !== false,
        showTimeline: configuration.showTimeline !== false,
        template: configuration.template === "scoreboard"
          ? "scoreboard"
          : "match_center",
        timelineLimit: goalInteger(configuration.timelineLimit, 0, 10) === null
          ? 5
          : goalInteger(configuration.timelineLimit, 0, 10),
        title: goalText(configuration.title || live.connectionName, 120) ||
          "Live wedstrijd"
      };
    }
    function ledScoresClockSeconds(state) {
      var clock = state && state.clock;
      var effectiveNow;
      var elapsed;
      var result;
      var maximum;
      if (!clock) return null;
      effectiveNow = Math.min(ledScoresMatchServerNow(state), state.staleAfter);
      elapsed = clock.running
        ? Math.max(0, Math.floor((effectiveNow - clock.anchorAt) / 1000))
        : 0;
      result = clock.direction === "down"
        ? clock.anchorSeconds - elapsed
        : clock.anchorSeconds + elapsed;
      maximum = clock.maxSeconds === null ? 359999 : clock.maxSeconds;
      return Math.max(0, Math.min(maximum, result));
    }
    function ledScoresMatchServerNow(state) {
      var offset = state && typeof state.serverTimeOffsetMs === "number" &&
        isFinite(state.serverTimeOffsetMs) &&
        Math.abs(state.serverTimeOffsetMs) <= 3162240000000
        ? state.serverTimeOffsetMs
        : 0;
      return now() + offset;
    }
    function ledScoresClockLabel(seconds) {
      var safeSeconds;
      var minutes;
      var remainder;
      if (seconds === null || !isFinite(seconds)) return "--:--";
      safeSeconds = Math.max(0, Math.floor(seconds));
      minutes = Math.floor(safeSeconds / 60);
      remainder = safeSeconds % 60;
      return (minutes < 10 ? "0" : "") + String(minutes) + ":" +
        (remainder < 10 ? "0" : "") + String(remainder);
    }
    function ledScoresStatusLabel(status) {
      return status === "live" ? "Live wedstrijd" :
        status === "half_time" ? "Ruststand" :
          status === "finished" ? "Eindstand" :
            status === "paused" ? "Wedstrijd onderbroken" :
              status === "pre_match" ? "Wedstrijd staat klaar" :
                "Laatste wedstrijdstand";
    }
    function playLedScoresLiveMatchTemplate(item, objectUrls, generation) {
      var payload = item.dynamicTemplate;
      var snapshot = templateRecord(payload.data) || {};
      var royalAppearance = templateRoyalCurrentAppearance(snapshot);
      var royalPresentation = templateRecord(snapshot.themePresentation) || {};
      var royalResolvedMode = templateRecord(royalPresentation.resolvedMode) || {};
      var royalMode = templateText(royalResolvedMode.mode, "light") === "dark" ? "glass" : "royal";
      var royalPalette = royalAppearance
        ? legacyCreateRoyalCurrentPalette(templateRecord(royalAppearance.palette) || {}, royalMode)
        : null;
      var royalTypography = royalAppearance
        ? templateRecord(royalAppearance.typography) || {}
        : {};
      var royalThemeFontFamilies = CONFIG.themeFontFamilies || {};
      var royalBodyFontRef = templateText(royalTypography.bodyFontRef, "vc-roboto-v1");
      var royalDisplayFontRef = templateText(royalTypography.displayFontRef, "vc-roboto-v1");
      var royalBaseScale = Math.max(.9, Math.min(1.2, Number(royalTypography.baseScale) || 1));
      var royalBrand = templateRecord(snapshot.brand) || {};
      var config = parseLedScoresLiveMatchConfig(payload);
      var state = config && (runtime.ledScoresMatchStates[config.connectionId] ||
        config.fallbackState);
      var root;
      var render;
      if (!config || !state ||
        (config.outsideMatchBehavior === "skip" &&
          ["finished", "pre_match", "unknown"].indexOf(state.status) !== -1)) {
        log("LEGACY_TEMPLATE_SKIPPED", "ledscores_live_match unavailable");
        window.setTimeout(nextItem, 0);
        return;
      }
      root = templateNode("section", "dynamic-template ledscores-live-match" +
        (payload.orientation === "portrait" ? " portrait" : ""));
      root.setAttribute("data-slide-type", "ledscores_live_match");
      root.setAttribute("data-accent", config.accentMode);
      if (royalPalette) {
        root.setAttribute("data-design-revision", "royal-current-v8");
        root.setAttribute("data-royal-mode", royalMode);
        root.style.setProperty(
          "--vc-theme-body-font",
          templateThemeFontFamily(royalThemeFontFamilies, royalBodyFontRef, "vc-roboto-v1")
        );
        root.style.setProperty(
          "--vc-theme-display-font",
          templateThemeFontFamily(royalThemeFontFamilies, royalDisplayFontRef, "vc-roboto-v1")
        );
        root.style.setProperty("--type-scale", String(royalBaseScale));
        root.style.setProperty("--rc-title-size", String(62 * royalBaseScale) + "px");
        root.style.setProperty("--rc-title-size-portrait", String(54 * royalBaseScale) + "px");
        Object.keys(royalPalette).forEach(function (name) {
          root.style.setProperty(name, royalPalette[name]);
        });
        root.style.setProperty("--live-accent", royalPalette["--accent"]);
        root.style.setProperty("--vc-shadow", royalMode === "glass" ? "rgba(0,0,0,.28)" : "rgba(19,32,68,.12)");
      }
      render = function (changedConnectionId) {
        var shell;
        var top;
        var heading;
        var status;
        var body;
        var scorePanel;
        var timeline;
        var values;
        var timelineItem;
        var row;
        var index;
        var footer;
        var stale;
        if (changedConnectionId && changedConnectionId !== config.connectionId) return;
        if (runtime.currentElement !== root && runtime.pendingElement !== root) return;
        state = runtime.ledScoresMatchStates[config.connectionId] || state ||
          config.fallbackState;
        if (!state) return;
        stale = state.staleAfter <= ledScoresMatchServerNow(state);
        while (root.firstChild) root.removeChild(root.firstChild);
        shell = templateNode("div", "live-match-shell");
        if (royalPalette) {
          var liveFlow = templateNode("div", "legacy-royal-flow");
          liveFlow.setAttribute("aria-hidden", "true");
          liveFlow.appendChild(templateNode("i", "legacy-royal-flow-one"));
          liveFlow.appendChild(templateNode("i", "legacy-royal-flow-two"));
          liveFlow.appendChild(templateNode("i", "legacy-royal-flow-three"));
          shell.appendChild(liveFlow);
          var liveSideband = templateNode("aside", "legacy-royal-sideband");
          liveSideband.setAttribute("aria-hidden", "true");
          liveSideband.appendChild(templateNode(
            "span", "", templateText(royalBrand.clubName, "VeyoCast")
          ));
          liveSideband.appendChild(templateNode("b", "", "LIVE"));
          liveSideband.appendChild(templateNode("span", "", "Onze club. Ons verhaal."));
          shell.appendChild(liveSideband);
          var liveMasthead = templateNode("div", "legacy-royal-masthead");
          var liveMastheadClub = templateNode("div", "legacy-royal-masthead-club");
          liveMastheadClub.appendChild(templateNode(
            "strong", "", templateText(royalBrand.clubName, "VeyoCast")
          ));
          liveMastheadClub.appendChild(templateNode("span", "", "Live wedstrijdinformatie"));
          liveMasthead.appendChild(liveMastheadClub);
          var liveMastheadRight = templateNode("div", "legacy-royal-masthead-right");
          liveMastheadRight.appendChild(templateNode(
            "span", "", royalMode === "glass" ? "Navy Glass" : "Royal Current"
          ));
          liveMastheadRight.appendChild(templateNode(
            "time", "", ledScoresClockLabel(ledScoresClockSeconds(state))
          ));
          liveMasthead.appendChild(liveMastheadRight);
          shell.appendChild(liveMasthead);
        }
        top = templateNode("header", "live-match-top");
        heading = templateNode("div", "");
        heading.appendChild(templateNode("p", "", config.title));
        heading.appendChild(templateNode("h1", "", ledScoresStatusLabel(state.status)));
        top.appendChild(heading);
        if (config.showStatus) {
          status = templateNode("div", "live-match-status",
            stale ? "Laatste stand" : state.status === "live" ? "Live" :
              ledScoresStatusLabel(state.status));
          top.appendChild(status);
        }
        shell.appendChild(top);
        body = templateNode("div", "live-match-body");
        if (!(config.template === "match_center" && config.showTimeline &&
          config.timelineLimit > 0 && state.timeline.length)) {
          body.className += " no-timeline";
        }
        scorePanel = templateNode("section", "");
        scorePanel.appendChild(createMatchScoreboard(state));
        if (config.showClock) scorePanel.appendChild(templateNode("div",
          "live-match-clock", ledScoresClockLabel(ledScoresClockSeconds(state))));
        if (state.periodLabel) scorePanel.appendChild(templateNode("div",
          "live-match-period", state.periodLabel));
        body.appendChild(scorePanel);
        if (config.template === "match_center" && config.showTimeline &&
          config.timelineLimit > 0 && state.timeline.length) {
          timeline = templateNode("ol", "live-match-timeline");
          values = state.timeline.slice(-config.timelineLimit).reverse();
          for (index = 0; index < values.length; index += 1) {
            timelineItem = values[index];
            row = templateNode("li", "");
            row.appendChild(templateNode("time", "", timelineItem.clockLabel || "•"));
            row.appendChild(templateNode("strong", "",
              timelineItem.playerName || timelineItem.label));
            if (timelineItem.homeScore !== null && timelineItem.awayScore !== null) {
              row.appendChild(templateNode("b", "",
                String(timelineItem.homeScore) + "–" + String(timelineItem.awayScore)));
            }
            timeline.appendChild(row);
          }
          body.appendChild(timeline);
        }
        shell.appendChild(body);
        footer = templateNode("footer", "live-match-footer");
        footer.appendChild(templateNode("span", "", state.home.name));
        footer.appendChild(templateNode("span", "",
          stale ? "De klok is veilig bevroren" : "Live wedstrijdinformatie"));
        footer.appendChild(templateNode("span", "", state.away.name));
        shell.appendChild(footer);
        root.appendChild(shell);
      };
      beginPendingMedia(root, objectUrls);
      render(null);
      fitDynamicTemplateCanvas(root, payload.orientation);
      if (!commitPendingMedia(root, objectUrls, generation)) return;
      runtime.ledScoresLiveMatchRender = render;
      window.clearInterval(runtime.ledScoresLiveMatchTimer);
      runtime.ledScoresLiveMatchTimer = window.setInterval(function () {
        render(config.connectionId);
      }, 1000);
      schedulePlaybackAdvance(itemDurationMs(item));
      log("LEGACY_TEMPLATE_READY", "ledscores_live_match " + payload.templateSlug);
    }
    function playDynamicTemplate(item, fallbackUrl, objectUrls, generation) {
      var payload = item.dynamicTemplate;
      if (payload.slideType === "ledscores_live_match") {
        playLedScoresLiveMatchTemplate(item, objectUrls, generation);
        return;
      }
      var snapshot = templateRecord(payload.data) || {};
      var root = templateNode("section", "dynamic-template");
      var header = templateNode("header", "");
      var body = templateNode("div", "dynamic-body");
      var footer = templateNode("footer", "");
      var sourceLabel = "Clubinformatie";
      var title = "Clubinformatie";
      var renderer;
      var pageIndex = 0;
      var accent = "#ff5c20";
      var templateDuration;
      var templatePageDuration;
      var brand = templateRecord(snapshot.brand);
      var editorialConfiguration = templateRecord(snapshot.editorial) || {};
      var editorialTheme = templateRecord(editorialConfiguration.theme) || {};
      var themePresentation = templateRecord(snapshot.themePresentation) || {};
      var themeRuntime = templateRecord(snapshot._veyocastThemeRuntime) || {};
      var themeAppearance = Number(themePresentation.snapshotVersion) === 2
        ? templateRecord(themePresentation.appearance) || {}
        : {};
      var royalCurrent = Boolean(templateRoyalCurrentAppearance(snapshot));
      var royalCurrentPalette = null;
      var appearanceTypography = templateRecord(themeAppearance.typography) || {};
      var appearanceSurfaces = templateRecord(themeAppearance.surfaces) || {};
      var themeFontFamilies = CONFIG.themeFontFamilies || {};
      var themeFontSizes = CONFIG.themeFontSizes || [];
      var themeFontIndex;
      var themeFontSize;
      var defaultBodyFontRef = royalCurrent ? "vc-roboto-v1" : "vc-inter-v1";
      var defaultDisplayFontRef = royalCurrent ? "vc-roboto-v1" : "vc-manrope-v1";
      var bodyFontRef = templateText(
        appearanceTypography.bodyFontRef, defaultBodyFontRef
      );
      var displayFontRef = templateText(
        appearanceTypography.displayFontRef, defaultDisplayFontRef
      );
      var baseScale = royalCurrent
        ? Math.max(.9, Math.min(1.2, Number(appearanceTypography.baseScale) || 1))
        : Math.max(.85, Math.min(1.25, Number(appearanceTypography.baseScale) || 1));
      var defaultSportScale = Number(themeAppearance.schemaVersion) === 2 ? 1 : 1.12;
      var sportScale = Math.max(
        .9,
        Math.min(1.4, Number(appearanceTypography.sportScale) || defaultSportScale)
      );
      var themeSelection = templateRecord(themePresentation.selection) || {};
      var themeReference = templateRecord(themeSelection.ref) || {};
      var resolvedThemeMode = templateRecord(themePresentation.resolvedMode) || {};
      var tenantThemeOverrides = templateRecord(snapshot._veyocastThemeColorOverrides) || {};
      var clockTimezone = templateText(
        resolvedThemeMode.timezone,
        templateText((templateRecord(snapshot.sport) || {}).timezone, "Europe/Amsterdam")
      );
      var manifestTheme = templateRecord(CONFIG.themeCatalog[templateText(themeReference.id, "editorial")]) || templateRecord(CONFIG.themeCatalog.editorial) || {};
      var editorialMode = templateText(
        resolvedThemeMode.mode,
        templateText(editorialTheme.mode,
        payload.templateSlug.indexOf("dark") !== -1 ? "dark" : "light"
        )
      );
      if (royalCurrent) {
        royalCurrentPalette = legacyCreateRoyalCurrentPalette(
          templateRecord(themeAppearance.palette) || {},
          editorialMode === "dark" ? "glass" : "royal"
        );
      }
      var manifestPalette = templateRecord(manifestTheme[editorialMode]) || {};
      var configuredEditorialTokens = templateRecord(tenantThemeOverrides[editorialMode]) ||
        templateRecord(editorialTheme[editorialMode]) || {};
      var editorialTokens = Object.keys(configuredEditorialTokens).length
        ? configuredEditorialTokens
        : manifestPalette;
      var projectFrozenThemeAliases = Number(themeRuntime.version) >= 2 ||
        payload.slideType !== "price_list" ||
        (templateRecord(snapshot.menuDocument) || {}).schemaVersion !== "menu-document.v2";
      var themeAliasTokens = projectFrozenThemeAliases
        ? editorialTokens
        : manifestPalette;
      var editorialArena = royalCurrent ||
        templateText(payload.templateSlug, "").indexOf("editorial-arena-") === 0;
      var menuStudioV2 = false;
      var matchCentre = payload.slideType === "sport_program" || payload.slideType === "sport_results";
      var contextPrimary = null;
      function matchPhaseSignature() {
        return templateArray((templateRecord(snapshot.sport) || {}).items, 100)
          .filter(function (row) {
            return sportMatchBelongsOnSlide(payload.slideType, templateRecord(row) || {}, new Date().getTime());
          }).map(function (row) { return row.id || row.primary; }).join("|");
      }
      var previousMatchPhase = matchCentre ? matchPhaseSignature() : "";
      function updateMatchCentreClock() {
        var clocks = root.querySelectorAll(".matchcentre-clock,.legacy-royal-clock");
        var clockIndex;
        for (clockIndex = 0; clockIndex < clocks.length; clockIndex += 1) {
          clocks[clockIndex].textContent = templateMatchCentreClock(clockTimezone);
        }
        if (matchCentre && !runtime.goalPauseApplied && runtime.currentElement === root) {
          var nextMatchPhase = matchPhaseSignature();
          if (nextMatchPhase !== previousMatchPhase) {
            previousMatchPhase = nextMatchPhase;
            if (!nextMatchPhase) { nextItem(); return; }
            while (body.firstChild) body.removeChild(body.firstChild);
            renderer = renderSportTemplate(body, snapshot, payload.slideType, payload.orientation, payload);
            pageIndex = Math.min(pageIndex, renderer.pages.length - 1);
            renderer.render(renderer.pages[pageIndex], pageIndex);
            var counters = root.querySelectorAll(".dynamic-page-number,.matchcentre-page-number");
            for (var counterIndex = 0; counterIndex < counters.length; counterIndex += 1) {
              counters[counterIndex].textContent = templatePageCounter(pageIndex, renderer.pages.length);
            }
          }
        }
      }
      function updateVisitorVenue(page) {
        if (contextPrimary && payload.slideType === "sport_visitor_arrivals") {
          contextPrimary.textContent = templateVisitorVenueWelcome(page);
        }
      }
      function advanceTemplatePage() {
        if (runtime.pendingRelease && !runtime.goalPauseApplied) { nextItem(); return; }
        var number;
        var matchCentreNumber;
        if (runtime.currentElement !== root) return;
        pageIndex = (pageIndex + 1) % renderer.pages.length;
        renderer.render(renderer.pages[pageIndex], pageIndex);
        updateVisitorVenue(renderer.pages[pageIndex]);
        number = root.querySelector(".dynamic-page-number");
        if (number) {
          number.textContent = royalCurrent
            ? templatePageCounter(pageIndex, renderer.pages.length)
            : String(pageIndex + 1) + " / " + String(renderer.pages.length);
        }
        matchCentreNumber = root.querySelector(".matchcentre-page-number");
        if (matchCentreNumber) {
          matchCentreNumber.textContent = templatePageCounter(pageIndex, renderer.pages.length);
        }
        var royalPageNumber = root.querySelector(".legacy-royal-page-number");
        if (royalPageNumber) {
          royalPageNumber.textContent = templatePageCounter(pageIndex, renderer.pages.length);
        }
        var royalSidePage = root.querySelector(".legacy-royal-side-page");
        if (royalSidePage) {
          royalSidePage.textContent = String(pageIndex + 1).padStart(2, "0");
        }
        var royalTitleCount = root.querySelector(".legacy-royal-title-count");
        var royalCountLabel = root.querySelector(".legacy-royal-title-count-label");
        var royalCount = templateRoyalCurrentPageCount(renderer.pages[pageIndex]);
        if (royalTitleCount) royalTitleCount.textContent = String(royalCount).padStart(2, "0");
        if (royalCountLabel) {
          royalCountLabel.textContent = templateRoyalCurrentCountLabel(payload.slideType, royalCount);
        }
        updateMatchCentreClock();
        scheduleTemplateAdvance(advanceTemplatePage, templatePageDuration);
      }
      if (brand && typeof brand.primaryColor === "string" && /^#[0-9a-f]{6}$/i.test(brand.primaryColor)) {
        accent = brand.primaryColor;
      }
      if (typeof manifestTheme.accent === "string") accent = manifestTheme.accent;
      if (typeof themeSelection.accent === "string" && /^#[0-9a-f]{6}$/i.test(themeSelection.accent)) {
        accent = themeSelection.accent;
      }
      var editorialTokenProjection = [
        ["--vc-accent", "accent", accent],
        ["--vc-accent-soft", "accentSoft", editorialMode === "dark" ? "rgba(255,110,55,.18)" : "rgba(236,98,44,.14)"],
        ["--vc-border", "border", editorialMode === "dark" ? "rgba(250,250,247,.15)" : "rgba(17,19,21,.12)"],
        ["--vc-border-soft", "borderSoft", editorialMode === "dark" ? "rgba(250,250,247,.09)" : "rgba(17,19,21,.075)"],
        ["--vc-canvas", "canvas", editorialMode === "dark" ? "#090B0E" : "#D7D2C8"],
        ["--vc-danger", "danger", editorialMode === "dark" ? "#FF716B" : "#D55656"],
        ["--vc-divider", "divider", editorialMode === "dark" ? "rgba(250,250,247,.14)" : "rgba(17,19,21,.12)"],
        ["--vc-image-overlay-end", "imageOverlayEnd", editorialMode === "dark" ? "rgba(6,8,10,.12)" : "rgba(6,8,10,.08)"],
        ["--vc-image-overlay-mid", "imageOverlayMid", editorialMode === "dark" ? "rgba(6,8,10,.76)" : "rgba(6,8,10,.72)"],
        ["--vc-image-overlay-start", "imageOverlayStart", editorialMode === "dark" ? "rgba(6,8,10,.98)" : "rgba(6,8,10,.96)"],
        ["--vc-neutral", "neutral", editorialMode === "dark" ? "#8D9095" : "#A9A399"],
        ["--vc-panel", "panel", editorialMode === "dark" ? "#14181D" : "#E8E4DC"],
        ["--vc-qr-ink", "qrInk", "#111315"],
        ["--vc-qr-surface", "qrSurface", "#F3F0E9"],
        ["--vc-row", "row", editorialMode === "dark" ? "#11161C" : "#FBF9F4"],
        ["--vc-row-selected", "rowSelected", editorialMode === "dark" ? "#F3F0E9" : "#141619"],
        ["--vc-shadow", "shadow", editorialMode === "dark" ? "rgba(0,0,0,.34)" : "rgba(66,55,41,.14)"],
        ["--vc-success", "success", editorialMode === "dark" ? "#46D18C" : "#31A574"],
        ["--vc-surface", "surface", editorialMode === "dark" ? "#0D1116" : "#F3F0E9"],
        ["--vc-surface-raised", "surfaceRaised", editorialMode === "dark" ? "#171C22" : "#FBF9F4"],
        ["--vc-text", "text", editorialMode === "dark" ? "#F7F3EB" : "#111315"],
        ["--vc-text-faint", "textFaint", editorialMode === "dark" ? "rgba(247,243,235,.48)" : "rgba(17,19,21,.47)"],
        ["--vc-text-muted", "textMuted", editorialMode === "dark" ? "#B9B5AD" : "#68665F"],
        ["--vc-text-on-accent", "textOnAccent", editorialMode === "dark" ? "#111315" : "#FFFAF2"],
        ["--vc-text-on-selected", "textOnSelected", editorialMode === "dark" ? "#111315" : "#F7F3EB"],
        ["--vc-warning", "warning", editorialMode === "dark" ? "#FFAD66" : "#C99431"]
      ];
      root.className += editorialMode === "dark" ? " dark" : "";
      root.className += payload.orientation === "portrait" ? " portrait" : "";
      root.setAttribute("data-slide-type", payload.slideType);
      root.setAttribute("data-theme-id", templateText(themeReference.id, "editorial"));
      if (royalCurrent) {
        root.setAttribute("data-design-revision", "royal-current-v8");
        root.setAttribute("data-royal-mode", editorialMode === "dark" ? "glass" : "royal");
        root.setAttribute("data-motion-state", themeAppearance.motionEnabled === false ? "off" : "on");
      }
      if (editorialArena) root.className += " editorial-arena";
      root.style.setProperty("--accent", accent);
      for (var themeTokenIndex = 0; themeTokenIndex < editorialTokenProjection.length; themeTokenIndex += 1) {
        var themeToken = editorialTokenProjection[themeTokenIndex];
        root.style.setProperty(
          themeToken[0],
          templateText(editorialTokens[themeToken[1]], themeToken[2])
        );
      }
      var themeAliasProjection = [
        ["--vc-theme-accent", "accent", accent],
        ["--vc-theme-accent-ink", "textOnAccent", templateText(themeAliasTokens.canvas, "#F4F7F4")],
        ["--vc-theme-canvas", "canvas", templateText(manifestPalette.canvas, "#F4F7F4")],
        ["--vc-theme-line", "border", templateText(manifestPalette.line, "rgba(4,47,45,.18)")],
        ["--vc-theme-muted", "textMuted", templateText(manifestPalette.muted, "#50706B")],
        ["--vc-theme-shadow", "shadow", templateText(manifestPalette.shadow, "rgba(4,47,45,.14)")],
        ["--vc-theme-surface", "surface", templateText(manifestPalette.surface, "#FFFFFF")],
        ["--vc-theme-surface-alt", "surfaceRaised", templateText(manifestPalette.surfaceAlt, "#E5EEE9")],
        ["--vc-theme-text", "text", templateText(manifestPalette.text, "#042F2D")],
        ["--vc-theme-text-muted", "textMuted", templateText(manifestPalette.muted, "#50706B")]
      ];
      for (var themeAliasIndex = 0; themeAliasIndex < themeAliasProjection.length; themeAliasIndex += 1) {
        var themeAlias = themeAliasProjection[themeAliasIndex];
        root.style.setProperty(
          themeAlias[0],
          templateText(themeAliasTokens[themeAlias[1]], themeAlias[2])
        );
      }
      root.style.setProperty(
        "--vc-theme-body-font",
        templateThemeFontFamily(themeFontFamilies, bodyFontRef, defaultBodyFontRef)
      );
      root.style.setProperty(
        "--vc-theme-display-font",
        templateThemeFontFamily(themeFontFamilies, displayFontRef, defaultDisplayFontRef)
      );
      root.style.setProperty(
        "--vc-theme-display-weight",
        royalCurrent ? "900" : String(Number(manifestTheme.displayWeight) || 700)
      );
      root.style.setProperty("--vc-theme-display-spacing", String(Number(manifestTheme.displayLetterSpacingEm) || 0) + "em");
      root.style.setProperty("--editorial-canvas", templateText(editorialTokens.canvas, editorialMode === "dark" ? "#090B0E" : "#D7D2C8"));
      root.style.setProperty("--editorial-surface", templateText(editorialTokens.surface, editorialMode === "dark" ? "#0D1116" : "#F3F0E9"));
      root.style.setProperty("--editorial-surface-alt", templateText(editorialTokens.surfaceRaised, templateText(editorialTokens.surfaceAlt, editorialMode === "dark" ? "#11161C" : "#FBF9F4")));
      root.style.setProperty("--editorial-panel", templateText(editorialTokens.panel, templateText(editorialTokens.surfaceAlt, editorialMode === "dark" ? "#14181D" : "#E8E4DC")));
      root.style.setProperty("--editorial-row", templateText(editorialTokens.row, editorialMode === "dark" ? "#11161C" : "#FBF9F4"));
      root.style.setProperty("--vc-club-logo-background", /^#[0-9a-f]{6}$/i.test(templateText(appearanceSurfaces.clubLogoBackground, "")) ? appearanceSurfaces.clubLogoBackground : "#E7F5EE");
      root.style.setProperty("--vc-home-logo-background", /^#[0-9a-f]{6}$/i.test(templateText(appearanceSurfaces.homeLogoBackground, "")) ? appearanceSurfaces.homeLogoBackground : "#FFFFFF");
      for (themeFontIndex = 0; themeFontIndex < themeFontSizes.length; themeFontIndex += 1) {
        themeFontSize = Number(themeFontSizes[themeFontIndex]);
        if (!isFinite(themeFontSize)) continue;
        root.style.setProperty(
          "--vc-theme-font-" + String(themeFontSize).replace(".", "-"),
          String(Math.round(themeFontSize * baseScale * 1000) / 1000) + "px"
        );
      }

      root.style.setProperty("--vc-title-size", String(64 * baseScale) + "px");
      root.style.setProperty("--vc-title-size-portrait", String(49 * baseScale) + "px");
      root.style.setProperty("--vc-visitor-title-size-portrait", String(42.14 * baseScale) + "px");
      root.style.setProperty("--vc-sport-row-size", String(20 * baseScale * sportScale) + "px");
      root.style.setProperty("--vc-sport-row-size-portrait", String(18 * baseScale * sportScale) + "px");
      root.style.setProperty("--vc-sport-result-size", String(30 * baseScale * sportScale) + "px");
      root.style.setProperty("--vc-sport-result-size-portrait", String(27 * baseScale * sportScale) + "px");
      root.style.setProperty("--vc-sport-score-size", String(46.5 * baseScale * sportScale) + "px");
      var compactSportResultSize = Number(themeAppearance.schemaVersion) === 2
        ? 24 * baseScale * sportScale
        : 24 * baseScale * sportScale / 1.12;
      var compactSportScoreSize = Number(themeAppearance.schemaVersion) === 2
        ? 42 * baseScale * sportScale
        : 42 * baseScale * sportScale / 1.12;
      root.style.setProperty(
        "--vc-theme-sport-result-size-compact",
        String(Math.round(compactSportResultSize * 1000) / 1000) + "px"
      );
      root.style.setProperty(
        "--vc-theme-sport-score-size-compact",
        String(Math.round(compactSportScoreSize * 1000) / 1000) + "px"
      );
      root.style.setProperty("--editorial-text", templateText(editorialTokens.text, editorialMode === "dark" ? "#F7F3EB" : "#111315"));
      root.style.setProperty("--editorial-muted", templateText(editorialTokens.textMuted, templateText(editorialTokens.muted, editorialMode === "dark" ? "#C9C4B9" : "#625F57")));
      root.style.setProperty("--editorial-text-faint", templateText(editorialTokens.textFaint, editorialMode === "dark" ? "rgba(247,243,235,.48)" : "rgba(17,19,21,.47)"));
      root.style.setProperty("--editorial-danger", templateText(editorialTokens.danger, editorialMode === "dark" ? "#FF716B" : "#D55656"));
      root.style.setProperty("--editorial-border", templateText(editorialTokens.border, editorialMode === "dark" ? "rgba(250,250,247,.15)" : "rgba(17,19,21,.12)"));
      root.style.setProperty("--editorial-border-soft", templateText(editorialTokens.borderSoft, editorialMode === "dark" ? "rgba(250,250,247,.09)" : "rgba(17,19,21,.075)"));
      root.style.setProperty("--editorial-divider", templateText(editorialTokens.divider, templateText(editorialTokens.border, editorialMode === "dark" ? "rgba(250,250,247,.14)" : "rgba(17,19,21,.12)")));
      root.style.setProperty("--editorial-shadow", templateText(editorialTokens.shadow, editorialMode === "dark" ? "rgba(0,0,0,.34)" : "rgba(66,55,41,.14)"));
      root.style.setProperty("--editorial-accent-soft", templateText(editorialTokens.accentSoft, "rgba(255,92,32,.14)"));
      root.style.setProperty("--editorial-qr-surface", templateText(editorialTokens.qrSurface, "#F3F0E9"));
      root.style.setProperty("--editorial-qr-ink", templateText(editorialTokens.qrInk, "#111315"));
      root.style.setProperty("--editorial-image-overlay-start", templateText(editorialTokens.imageOverlayStart, "rgba(6,8,10,.84)"));
      root.style.setProperty("--editorial-image-overlay-mid", templateText(editorialTokens.imageOverlayMid, "rgba(6,8,10,.58)"));
      root.style.setProperty("--editorial-image-overlay-end", templateText(editorialTokens.imageOverlayEnd, "rgba(6,8,10,.08)"));
      if (templateText(editorialTokens.accent, "")) {
        root.style.setProperty("--accent", templateText(editorialTokens.accent, accent));
      }
      if (royalCurrentPalette) {
        var royalTokenNames = Object.keys(royalCurrentPalette);
        var royalTokenIndex;
        var royalMatte = royalCurrentPalette["--matte-rgb"];
        for (royalTokenIndex = 0; royalTokenIndex < royalTokenNames.length; royalTokenIndex += 1) {
          root.style.setProperty(
            royalTokenNames[royalTokenIndex],
            royalCurrentPalette[royalTokenNames[royalTokenIndex]]
          );
        }
        var royalTokenProjection = [
          ["--vc-accent", "--accent"],
          ["--vc-accent-soft", "--accent-soft"],
          ["--vc-border", "--line"],
          ["--vc-border-soft", "--line"],
          ["--vc-canvas", "--bg"],
          ["--vc-divider", "--line"],
          ["--vc-neutral", "--muted"],
          ["--vc-panel", "--surface-2"],
          ["--vc-row", "--surface"],
          ["--vc-row-selected", "--own-bg"],
          ["--vc-surface", "--surface"],
          ["--vc-surface-raised", "--surface-2"],
          ["--vc-text", "--ink"],
          ["--vc-text-faint", "--muted"],
          ["--vc-text-muted", "--muted"],
          ["--vc-text-on-accent", "--on-accent"],
          ["--vc-text-on-selected", "--own-ink"],
          ["--vc-theme-accent", "--accent"],
          ["--vc-theme-accent-ink", "--on-accent"],
          ["--vc-theme-canvas", "--bg"],
          ["--vc-theme-line", "--line"],
          ["--vc-theme-muted", "--muted"],
          ["--vc-theme-surface", "--surface"],
          ["--vc-theme-surface-alt", "--surface-2"],
          ["--vc-theme-text", "--ink"],
          ["--vc-theme-text-muted", "--muted"],
          ["--editorial-canvas", "--bg"],
          ["--editorial-surface", "--surface"],
          ["--editorial-surface-alt", "--surface-2"],
          ["--editorial-panel", "--surface-2"],
          ["--editorial-row", "--surface"],
          ["--editorial-text", "--ink"],
          ["--editorial-muted", "--muted"],
          ["--editorial-text-faint", "--muted"],
          ["--editorial-border", "--line"],
          ["--editorial-border-soft", "--line"],
          ["--editorial-divider", "--line"],
          ["--editorial-accent-soft", "--accent-soft"]
        ];
        for (royalTokenIndex = 0; royalTokenIndex < royalTokenProjection.length; royalTokenIndex += 1) {
          root.style.setProperty(
            royalTokenProjection[royalTokenIndex][0],
            royalCurrentPalette[royalTokenProjection[royalTokenIndex][1]]
          );
        }
        var royalSemanticProjection = [
          ["--accent", "accent"],
          ["--accent-soft", "accentSoft"],
          ["--bg", "canvas"],
          ["--deep", "rowSelected"],
          ["--flow-accent", "support"],
          ["--ink", "text"],
          ["--line", "border"],
          ["--muted", "textMuted"],
          ["--on-accent", "textOnAccent"],
          ["--own-bg", "rowSelected"],
          ["--own-ink", "textOnSelected"],
          ["--own-line", "border"],
          ["--own-muted", "textMuted"],
          ["--secondary-accent", "support"],
          ["--solid-accent", "accent"],
          ["--surface", "surface"],
          ["--surface-2", "surfaceRaised"]
        ];
        for (royalTokenIndex = 0; royalTokenIndex < royalSemanticProjection.length; royalTokenIndex += 1) {
          var royalSemanticToken = royalSemanticProjection[royalTokenIndex];
          var royalSemanticValue = royalSemanticToken[1] === "support"
            ? templateText(themeSelection.support, royalCurrentPalette[royalSemanticToken[0]])
            : templateText(
              editorialTokens[royalSemanticToken[1]],
              royalCurrentPalette[royalSemanticToken[0]]
            );
          root.style.setProperty(
            royalSemanticToken[0],
            royalSemanticValue
          );
        }
        root.style.setProperty("--vc-danger", editorialMode === "dark" ? "#ff8f95" : "#a82d3d");
        root.style.setProperty("--vc-warning", editorialMode === "dark" ? "#ffcba4" : "#a53c12");
        root.style.setProperty("--vc-success", editorialMode === "dark" ? "#74d9a5" : "#16623f");
        root.style.setProperty("--vc-qr-ink", "#000000");
        root.style.setProperty("--vc-qr-surface", "#ffffff");
        root.style.setProperty("--editorial-danger", editorialMode === "dark" ? "#ff8f95" : "#a82d3d");
        root.style.setProperty("--editorial-qr-ink", "#000000");
        root.style.setProperty("--editorial-qr-surface", "#ffffff");
        root.style.setProperty("--editorial-image-overlay-start", "rgba(" + royalMatte + ",.80)");
        root.style.setProperty("--editorial-image-overlay-mid", "rgba(" + royalMatte + ",.46)");
        root.style.setProperty("--editorial-image-overlay-end", "rgba(" + royalMatte + ",.08)");
        root.style.setProperty("--vc-image-overlay-start", "rgba(" + royalMatte + ",.80)");
        root.style.setProperty("--vc-image-overlay-mid", "rgba(" + royalMatte + ",.46)");
        root.style.setProperty("--vc-image-overlay-end", "rgba(" + royalMatte + ",.08)");
        root.style.setProperty("--editorial-shadow", editorialMode === "dark" ? "rgba(0,0,0,.28)" : "rgba(19,32,68,.12)");
        root.style.setProperty("--vc-shadow", editorialMode === "dark" ? "rgba(0,0,0,.28)" : "rgba(19,32,68,.12)");
        root.style.setProperty("--type-scale", String(baseScale));
        root.style.setProperty("--rc-title-size", String(62 * baseScale) + "px");
        root.style.setProperty("--rc-title-size-portrait", String(54 * baseScale) + "px");
        root.style.setProperty("--rc-subtitle-size", String(23 * baseScale) + "px");
        root.style.setProperty("--rc-subtitle-size-portrait", String(24 * baseScale) + "px");
        root.style.setProperty("--rc-footer-size", String(14 * baseScale) + "px");
        root.style.setProperty("--rc-cancelled-size", String(18 * baseScale) + "px");
        root.style.setProperty("--rc-cancelled-size-portrait", String(20 * baseScale) + "px");
        root.style.setProperty("--rc-news-copy-size", String(34 * baseScale) + "px");
        root.style.setProperty("--rc-news-copy-size-portrait", String(34 * baseScale) + "px");
        root.style.setProperty("--rc-news-text-size", String(48 * baseScale) + "px");
        root.style.setProperty("--rc-news-grid-copy-size", String(27 * baseScale) + "px");
        root.style.setProperty("--rc-news-title-size", String(40 * baseScale) + "px");
        root.style.setProperty("--rc-news-title-size-dense", String(36 * baseScale) + "px");
        root.style.setProperty("--rc-news-title-size-portrait", String(40 * baseScale) + "px");
        root.style.setProperty("--rc-news-title-size-grid", String(32 * baseScale) + "px");
        root.style.setProperty("--rc-news-title-size-grid-dense", String(29 * baseScale) + "px");
        root.style.setProperty("--rc-news-title-size-text", String(54 * baseScale) + "px");
        root.style.setProperty("--rc-news-title-size-text-dense", String(48 * baseScale) + "px");
        root.style.setProperty("--rc-program-row-size", String(25 * baseScale * sportScale) + "px");
        root.style.setProperty("--rc-program-row-size-compact", String(20 * baseScale * sportScale) + "px");
        root.style.setProperty("--rc-program-row-size-portrait", String(24 * baseScale * sportScale) + "px");
        root.style.setProperty("--rc-result-row-size", String(31 * baseScale * sportScale) + "px");
        root.style.setProperty("--rc-result-row-size-compact", String(25 * baseScale * sportScale) + "px");
        root.style.setProperty("--rc-result-row-size-portrait", String(29 * baseScale * sportScale) + "px");
        root.style.setProperty("--accent", royalCurrentPalette["--accent"]);
      }
      if (payload.slideType === "menu") {
        sourceLabel = "Clubkantine";
        title = templateText((templateRecord(snapshot.data) || {}).title, "Menu vandaag");
        renderer = renderMenuTemplate(body, snapshot, payload.orientation, payload);
      } else if (payload.slideType === "price_list") {
        sourceLabel = "Prijzen uit de clubkantine";
        var menuStudioDocument = templateRecord(snapshot.menuDocument) || {};
        if (menuStudioDocument.schemaVersion === "menu-document.v2") {
          menuStudioV2 = true;
          root.className += " menu-studio-v2";
          sourceLabel = "Menu Studio";
        }
        title = templateText(menuStudioDocument.title, templateText((templateRecord(snapshot.priceList) || {}).title, "Prijslijst"));
        renderer = renderPriceListTemplate(body, snapshot, payload.orientation, payload);
      } else if (payload.slideType === "news") {
        sourceLabel = "Clubnieuws";
        title = templateText(templateNewsConfig(snapshot).title, "Nieuws");
        renderer = renderNewsTemplate(body, snapshot, payload, root);
      } else {
        sourceLabel = payload.slideType === "sport_visitor_arrivals"
          ? "Welkom op ons sportpark"
          : payload.slideType.indexOf("standing") !== -1
            ? "Competitie"
            : "Match centre";
        title = payload.slideType === "sport_visitor_arrivals"
          ? sportTemplateTitle(payload.slideType)
          : templateText((templateRecord(snapshot.sport) || {}).title, sportTemplateTitle(payload.slideType));
        renderer = payload.slideType === "sport_standing" ||
          payload.slideType === "sport_period_standing"
          ? renderEditorialStandingTemplate(body, snapshot, payload)
          : renderSportTemplate(body, snapshot, payload.slideType, payload.orientation, payload);
      }
      if (editorialArena) {
        var crest = templateNode("div", "editorial-crest");
        var crestUrl = brand && templateAssetUrl(
          payload,
          templateText(brand.logoMediaAssetId, "")
        );
        var heading = templateNode("div", "editorial-heading");
        var context = templateNode("div", "editorial-context");
        if (crestUrl) {
          var crestImage = templateNode("img", "");
          crestImage.alt = "";
          crestImage.src = crestUrl;
          crest.appendChild(crestImage);
        } else {
          crest.appendChild(templateNode(
            "span",
            "",
            templateInitials(
              brand ? templateText(brand.clubName, "VeyoCast") : "VeyoCast"
            )
          ));
        }
        if (royalCurrent) {
          var royalSubtitle = sourceLabel;
          var royalSport = templateRecord(snapshot.sport) || {};
          var royalCompetition = templateRecord(royalSport.competition) || {};
          var royalPool = templateRecord(royalSport.pool) || {};
          if (payload.slideType.indexOf("standing") !== -1) {
            royalSubtitle = [
              templateText(royalCompetition.name, ""),
              templateText(royalPool.name, ""),
              templateText(royalSport.season, "")
            ].filter(function (value) { return Boolean(value); }).join(" · ") || sourceLabel;
          }
          heading.appendChild(templateNode("span", "legacy-royal-eyebrow", sourceLabel));
          heading.appendChild(templateNode("h1", "", title));
          heading.appendChild(templateNode("p", "legacy-royal-subtitle", royalSubtitle));
          var initialRoyalCount = templateRoyalCurrentPageCount(renderer.pages[0]);
          context.className += " legacy-royal-title-stat";
          context.appendChild(templateNode(
            "strong", "legacy-royal-title-count", String(initialRoyalCount).padStart(2, "0")
          ));
          context.appendChild(templateNode(
            "span", "legacy-royal-title-count-label",
            templateRoyalCurrentCountLabel(payload.slideType, initialRoyalCount)
          ));
          if (renderer.pages.length > 1) {
            context.appendChild(templateNode(
              "small", "legacy-royal-page-number", templatePageCounter(0, renderer.pages.length)
            ));
          }
        } else if (matchCentre) {
          if (menuStudioV2) heading.appendChild(templateNode("p", "", "Menu"));
          heading.appendChild(templateNode("h1", "", title));
          context.setAttribute("data-match-centre", "true");
          var contextLabel = templateNode("span", "editorial-context-label");
          contextLabel.appendChild(templateNode("strong", "", "MATCHCENTRE"));
          contextLabel.appendChild(templateNode(
            "b", "matchcentre-page-number", templatePageCounter(0, renderer.pages.length)
          ));
          context.appendChild(contextLabel);
          context.appendChild(templateNode(
            "time",
            "matchcentre-clock",
            templateMatchCentreClock(clockTimezone)
          ));
        } else {
          if (menuStudioV2) heading.appendChild(templateNode("p", "", "Menu"));
          heading.appendChild(templateNode("h1", "", title));
          contextPrimary = templateNode(
            "strong",
            "",
            payload.slideType === "sport_visitor_arrivals"
              ? templateVisitorVenueWelcome(renderer.pages[0])
              : sourceLabel
          );
          context.appendChild(contextPrimary);
          context.appendChild(templateNode(
            "time",
            "matchcentre-clock",
            templateMatchCentreClock(clockTimezone)
          ));
        }
        header.appendChild(crest);
        header.appendChild(heading);
        header.appendChild(context);
      } else {
        header.appendChild(templateNode("p", "", sourceLabel));
        header.appendChild(templateNode("h1", "", title));
      }
      if (royalCurrent) {
        footer.className = "legacy-royal-footer";
        var royalFooterIdentity = templateNode("span", "");
        royalFooterIdentity.appendChild(document.createTextNode(sourceLabel));
        royalFooterIdentity.appendChild(templateNode("i", "", "·"));
        royalFooterIdentity.appendChild(document.createTextNode(
          brand ? templateText(brand.clubName, "ClubTV") : "ClubTV"
        ));
        footer.appendChild(royalFooterIdentity);
        footer.appendChild(templateNode(
          "span",
          "dynamic-page-number legacy-royal-page-number",
          renderer.pages.length > 1
            ? templatePageCounter(0, renderer.pages.length)
            : "Live clubinformatie"
        ));
      } else if (!matchCentre) {
        footer.appendChild(templateNode(
          "span", "", menuStudioV2 ? "Prijslijst" : sourceLabel
        ));
        footer.appendChild(templateNode(
          "span",
          "dynamic-page-number",
          menuStudioV2
            ? "1 / " + String(renderer.pages.length)
            : renderer.pages.length > 1
              ? "1 / " + String(renderer.pages.length)
              : "Live clubinformatie"
        ));
      }
      if (royalCurrent) {
        var royalFlow = templateNode("div", "legacy-royal-flow");
        royalFlow.setAttribute("aria-hidden", "true");
        royalFlow.appendChild(templateNode("i", "legacy-royal-flow-one"));
        royalFlow.appendChild(templateNode("i", "legacy-royal-flow-two"));
        royalFlow.appendChild(templateNode("i", "legacy-royal-flow-three"));
        var royalSideband = templateNode("aside", "legacy-royal-sideband");
        royalSideband.setAttribute("aria-hidden", "true");
        royalSideband.appendChild(templateNode(
          "span", "", brand ? templateText(brand.clubName, "VeyoCast") : "VeyoCast"
        ));
        royalSideband.appendChild(templateNode("b", "legacy-royal-side-page", "01"));
        royalSideband.appendChild(templateNode("span", "", "Onze club. Ons verhaal."));
        var royalMasthead = templateNode("div", "legacy-royal-masthead");
        var royalMastheadClub = templateNode("div", "legacy-royal-masthead-club");
        royalMastheadClub.appendChild(templateNode(
          "strong", "", brand ? templateText(brand.clubName, "VeyoCast") : "VeyoCast"
        ));
        royalMastheadClub.appendChild(templateNode("span", "", sourceLabel));
        royalMasthead.appendChild(royalMastheadClub);
        var royalMastheadRight = templateNode("div", "legacy-royal-masthead-right");
        royalMastheadRight.appendChild(templateNode(
          "span", "", editorialMode === "dark" ? "Navy Glass" : "Royal Current"
        ));
        royalMastheadRight.appendChild(templateNode(
          "time", "legacy-royal-clock", templateMatchCentreClock(clockTimezone)
        ));
        royalMasthead.appendChild(royalMastheadRight);
        root.appendChild(royalFlow);
        root.appendChild(royalSideband);
        root.appendChild(royalMasthead);
      }
      root.appendChild(header);
      root.appendChild(body);
      root.appendChild(footer);
      if ((payload.slideType === "sport_birthdays" ||
        payload.slideType === "sport_visitor_arrivals" ||
        payload.slideType === "sport_referee_arrivals") && !renderer.pages.length) {
        log("LEGACY_TEMPLATE_SKIPPED", payload.slideType + " empty_or_expired");
        window.setTimeout(nextItem, 0);
        return;
      }
      renderer.render(renderer.pages[0], 0);
      fitDynamicTemplateCanvas(root, payload.orientation);
      beginPendingMedia(root, objectUrls);
      if (!commitPendingMedia(root, objectUrls, generation)) return;
      if (["sport_program", "sport_results", "sport_cancellations", "sport_dressing_rooms", "sport_officials", "sport_standing", "sport_period_standing"].indexOf(payload.slideType) !== -1) {
        renderer = payload.slideType === "sport_standing" || payload.slideType === "sport_period_standing"
          ? renderEditorialStandingTemplate(body, snapshot, payload)
          : renderSportTemplate(body, snapshot, payload.slideType, payload.orientation, payload);
        renderer.render(renderer.pages[0], 0);
        var listCounters = root.querySelectorAll(".dynamic-page-number,.matchcentre-page-number");
        for (var listCounter = 0; listCounter < listCounters.length; listCounter += 1) listCounters[listCounter].textContent = templatePageCounter(0, renderer.pages.length);
      }
      if (payload.slideType === "sport_birthdays") {
        var birthdayData = templateRecord(snapshot.sport) || {};
        var birthdayConfig = templateRecord(birthdayData.configuration) || {};
        var birthdayOptions = templateRecord(birthdayConfig.presentation) || {};
        var birthdayDay = birthdayCalendarDay(now(), clockTimezone);
        var confettiCleanup = null;
        var confettiHosts = [];
        var motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
        function refreshBirthdayEffect() {
          var nextDay = birthdayCalendarDay(now(), clockTimezone);
          if (nextDay && nextDay !== birthdayDay) {
            birthdayDay = nextDay;
            renderer = renderSportTemplate(body, snapshot, payload.slideType, payload.orientation, payload);
            if (!renderer.pages.length) { nextItem(); return; }
            pageIndex = Math.min(pageIndex, renderer.pages.length - 1);
            renderer.render(renderer.pages[pageIndex], pageIndex);
          }
          var today = renderer.pages.some(function (birthdayPage) { return birthdayPage.some(function (person) {
            return Number(person.month) === Number(birthdayDay.slice(5, 7)) && Number(person.day) === Number(birthdayDay.slice(8, 10));
          }); });
          var enabled = runtime.currentElement === root && !runtime.goalPauseApplied &&
            birthdayOptions.confetti === true && birthdayOptions.motion !== false &&
            themeAppearance.motionEnabled !== false && !(motionQuery && motionQuery.matches) && today && renderer.pages.length > 0;
          var visibleBirthdayCards = Array.prototype.slice.call(root.querySelectorAll('[data-birthday-card][data-today="true"]'), 0, 6);
          if (confettiCleanup && (visibleBirthdayCards.length !== confettiHosts.length || visibleBirthdayCards.some(function (card, index) { return card !== confettiHosts[index]; }))) {
            confettiCleanup(); confettiCleanup = null;
          }
          if (enabled && !confettiCleanup) {
            confettiHosts = visibleBirthdayCards;
            var confettiCleanups = confettiHosts.map(function (card) { return startBirthdayConfetti(card, {
              colors: [accent, templateText(editorialTokens.text, "#FFFFFF"), templateText(editorialTokens.accentSoft, accent)], particleLimit: Math.floor(32 / confettiHosts.length)
            }); });
            confettiCleanup = function () { confettiCleanups.forEach(function (cleanup) { cleanup(); }); };
          }
          if (!enabled && confettiCleanup) { confettiCleanup(); confettiCleanup = null; }
        }
        var birthdayTimer = window.setInterval(refreshBirthdayEffect, 1000);
        root.birthdayRefresh = refreshBirthdayEffect;
        root.birthdayCleanup = function () {
          window.clearInterval(birthdayTimer);
          if (confettiCleanup) confettiCleanup();
          confettiCleanup = null;
          root.birthdayRefresh = null;
        };
        refreshBirthdayEffect();
      }
      if (editorialArena) {
        updateMatchCentreClock();
        window.clearInterval(runtime.matchCentreClockTimer);
        runtime.matchCentreClockTimer = window.setInterval(
          updateMatchCentreClock, matchCentre ? 1000 : 30000
        );
      }
      templateDuration = Math.max(
        itemDurationMs(item),
        renderer.pages.length * (renderer.pageDuration || 5000)
      );
      if (renderer.pages.length > 1) {
        templatePageDuration = renderer.pageDuration ||
          Math.floor(templateDuration / renderer.pages.length);
        scheduleTemplateAdvance(advanceTemplatePage, templatePageDuration);
      }
      schedulePlaybackAdvance(templateDuration);
      root.refreshPublishedData = function (freshPayload) {
        if (runtime.currentElement !== root || generation !== runtime.playbackGeneration) return;
        payload = freshPayload;
        snapshot = templateRecord(payload.data) || {};
        var updatedBrand = templateRecord(snapshot.brand) || {};
        var updatedCrest = root.querySelector(".editorial-crest");
        var updatedCrestUrl = templateAssetUrl(payload, templateText(updatedBrand.logoMediaAssetId, ""));
        if (updatedCrest && updatedCrestUrl) {
          var updatedCrestImage = updatedCrest.querySelector("img");
          if (!updatedCrestImage) { updatedCrest.textContent = ""; updatedCrestImage = templateNode("img", ""); updatedCrestImage.alt = ""; updatedCrest.appendChild(updatedCrestImage); }
          updatedCrestImage.src = updatedCrestUrl;
        }
        if (confettiCleanup) { confettiCleanup(); confettiCleanup = null; }
        if (payload.slideType === "menu") renderer = renderMenuTemplate(body,snapshot,payload.orientation,payload);
        else if (payload.slideType === "price_list") renderer = renderPriceListTemplate(body,snapshot,payload.orientation,payload);
        else if (payload.slideType === "news") renderer = renderNewsTemplate(body,snapshot,payload,root);
        else if (payload.slideType === "sport_standing" || payload.slideType === "sport_period_standing") renderer = renderEditorialStandingTemplate(body,snapshot,payload);
        else renderer = renderSportTemplate(body,snapshot,payload.slideType,payload.orientation,payload);
        if (!renderer || !renderer.pages.length) return;
        pageIndex = Math.min(pageIndex,renderer.pages.length-1);
        renderer.render(renderer.pages[pageIndex],pageIndex);
        fitDynamicTemplateCanvas(root,payload.orientation);
        if (root.birthdayRefresh) root.birthdayRefresh();
      };
      log("LEGACY_TEMPLATE_READY", payload.slideType + " " + payload.templateSlug);
    }
    function playImage(item, sourceUrl, objectUrls, generation) {
      var image;
      var readyStarted = false;
      function reveal() {
        var frame;
        if (
          generation !== runtime.playbackGeneration ||
          runtime.pendingElement !== image
        ) return;
        window.clearTimeout(runtime.watchdogTimer);
        runtime.watchdogTimer = null;
        frame = window.requestAnimationFrame || function (callback) {
          return window.setTimeout(callback, 16);
        };
        frame(function () {
          if (!commitPendingMedia(image, objectUrls, generation)) return;
          schedulePlaybackAdvance(itemDurationMs(item));
        });
      }
      image = document.createElement("img");
      image.alt = item.accessibilityName || item.displayTitle || item.title || "";
      mediaStyle(item, image);
      image.onload = function () {
        var decoded;
        if (readyStarted) return;
        readyStarted = true;
        if (typeof image.decode !== "function") {
          reveal();
          return;
        }
        try { decoded = image.decode(); } catch (error) {
          reveal();
          return;
        }
        if (decoded && typeof decoded.then === "function") {
          decoded.then(reveal, reveal);
        } else {
          reveal();
        }
      };
      image.onerror = function () {
        if (generation === runtime.playbackGeneration) {
          failItem("LEGACY_IMAGE_ERROR");
        }
      };
      beginPendingMedia(image, objectUrls);
      runtime.watchdogTimer = window.setTimeout(function () {
        if (generation === runtime.playbackGeneration) {
          failItem("LEGACY_IMAGE_TIMEOUT");
        }
      }, 12000);
      image.src = sourceUrl;
    }
    function playVideo(item, sourceUrl, objectUrls, generation, allowCacheFallback) {
      var video;
      var committed = false;
      var fallbackStarted = false;
      function fallbackOrFail(code) {
        if (!allowCacheFallback || fallbackStarted) {
          failItem(code);
          return;
        }
        fallbackStarted = true;
        log("LEGACY_VIDEO_NETWORK_FALLBACK", code);
        clearPlaybackTimers();
        if (runtime.pendingElement === video) cancelPendingMedia();
        if (runtime.currentElement === video) {
          video.oncanplay = null;
          video.onended = null;
          video.onerror = null;
          video.onloadedmetadata = null;
          video.onplaying = null;
          video.ontimeupdate = null;
        }
        cachedItemUrl(item, function (cachedUrl, cachedObjectUrl) {
          if (
            generation !== runtime.playbackGeneration ||
            item !== runtime.currentItem
          ) {
            if (cachedObjectUrl) revokeObjectUrls([cachedObjectUrl]);
            return;
          }
          if (!cachedUrl) {
            failItem("LEGACY_VIDEO_CACHE_FALLBACK_MISSING");
            return;
          }
          playVideo(
            item,
            cachedUrl,
            cachedObjectUrl ? [cachedObjectUrl] : [],
            generation,
            false
          );
        });
      }
      video = document.createElement("video");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.preload = "auto";
      video.autoplay = false;
      video.controls = false;
      video.muted = true;
      video.defaultMuted = true;
      mediaStyle(item, video);
      video.onloadedmetadata = function () {
        var start = item.trim && Number(item.trim.startSeconds);
        if (isFinite(start) && start > 0) {
          try { video.currentTime = start; } catch (error) {}
        }
        startVideo(video, generation);
      };
      video.oncanplay = function () { startVideo(video, generation); };
      video.onplaying = function () {
        if (generation !== runtime.playbackGeneration) return;
        runtime.lastProgressAt = monotonicNow();
        if (!committed) {
          window.clearTimeout(runtime.watchdogTimer);
          runtime.watchdogTimer = null;
          committed = commitPendingMedia(
            video,
            objectUrls,
            generation
          );
        }
        if (committed && runtime.goalPauseApplied) {
          runtime.goalPausedVideo = video;
          try { video.pause(); } catch (error) {}
        }
      };
      video.ontimeupdate = function () {
        if (!committed || runtime.currentElement !== video) return;
        runtime.lastProgressAt = monotonicNow();
        if (
          item.trim &&
          isFinite(Number(item.trim.endSeconds)) &&
          video.currentTime >= Number(item.trim.endSeconds)
        ) {
          nextItem();
        }
      };
      video.onended = function () {
        if (committed && runtime.currentElement === video) nextItem();
      };
      video.onerror = function () {
        if (generation === runtime.playbackGeneration) {
          fallbackOrFail("LEGACY_VIDEO_ERROR");
        }
      };
      beginPendingMedia(video, objectUrls);
      runtime.watchdogTimer = window.setTimeout(function () {
        if (
          generation === runtime.playbackGeneration &&
          (!video || video.paused || video.readyState < 2)
        ) {
          fallbackOrFail("LEGACY_VIDEO_START_TIMEOUT");
        }
      }, CONFIG.videoStartTimeoutMs);
      runtime.progressTimer = window.setInterval(function () {
        if (
          committed &&
          runtime.currentElement === video &&
          !video.paused &&
          runtime.lastProgressAt &&
          monotonicNow() - runtime.lastProgressAt > CONFIG.videoProgressTimeoutMs
        ) {
          fallbackOrFail("LEGACY_VIDEO_STALLED");
        }
      }, 2000);
      video.src = sourceUrl;
      try { video.load(); } catch (error) {}
      startVideo(video, generation);
    }
    function startVideo(video, generation) {
      var result;
      if (
        generation !== runtime.playbackGeneration ||
        (
          runtime.pendingElement !== video &&
          runtime.currentElement !== video
        )
      ) return;
      if (runtime.goalPauseApplied) return;
      try {
        video.muted = true;
        result = video.play();
        if (result && typeof result.catch === "function") {
          result.catch(function () {});
        }
      } catch (error) {}
    }
    function failItem(code) {
      var item = runtime.currentItem;
      var key = item ? item.id : "missing";
      var attempts = runtime.itemFailures[key] || 0;
      runtime.itemFailures[key] = attempts + 1;
      log(code, key);
      cancelPendingMedia();
      if (
        code === "LEGACY_CACHE_MISSING" ||
        code === "LEGACY_TEMPLATE_CACHE_MISSING" ||
        (
          attempts > 0 &&
          (
            code === "LEGACY_IMAGE_ERROR" ||
            code === "LEGACY_VIDEO_ERROR"
          )
        )
      ) {
        runtime.forceManifestRefresh = true;
        scheduleManifestSync(0);
      }
      if (
        code === "LEGACY_CACHE_MISSING" ||
        code === "LEGACY_TEMPLATE_CACHE_MISSING"
      ) {
        nextItem();
        return;
      }
      if (runtime.pendingRelease) { nextItem(); return; }
      if (attempts === 0) {
        playCurrent();
        return;
      }
      nextItem();
    }
    function publicationOrder(envelope) {
      var next = playableItems(envelope);
      var active = playableItems(runtime.envelope);
      var previous = {};
      var priority = [];
      var rest = [];
      var index;
      var same = runtime.envelope && runtime.envelope.manifest.playlistId === envelope.manifest.playlistId;
      var protectedOrder = (envelope.target && envelope.target.assignmentSource === "schedule") || Boolean(envelope.manifest.sponsorPlan);
      for (index = 0; index < active.length; index += 1) previous[active[index].sourceItemId || active[index].id] = active[index];
      for (index = 0; index < next.length; index += 1) {
        var item = next[index];
        var before = previous[item.sourceItemId || item.id];
        if (same && !protectedOrder && (!before || (item.contentHash && item.contentHash !== before.contentHash))) priority.push(item.id);
        else rest.push(item.id);
      }
      if (priority.length) return priority.concat(rest);
      if (same && !protectedOrder && runtime.currentItem) {
        var currentId = runtime.currentItem.sourceItemId || runtime.currentItem.id;
        var currentIndex = next.findIndex(function (item) { return (item.sourceItemId || item.id) === currentId; });
        if (currentIndex >= 0) return rest.slice(currentIndex + 1).concat(rest.slice(0,currentIndex + 1));
      }
      return rest;
    }
    function activatePendingRelease(callback) {
      var pending = runtime.pendingRelease;
      if (!pending || pending.generation !== runtime.targetGeneration || runtime.activationInFlight) {
        callback(false);
        return;
      }
      var order = publicationOrder(pending.envelope);
      if (!order.length) { callback(false); return; }
      if (runtime.publicationTrace && runtime.publicationTrace.releaseId === releaseIdOf(pending.envelope)) {
        runtime.publicationTrace.boundaryAt = new Date().toISOString(); runtime.boundaryMonotonic = monotonicNow();
      }
      runtime.activationInFlight = true;
      persistRelease(
        pending.envelope,
        pending.assets,
        function (persistError) {
          runtime.activationInFlight = false;
          if (persistError) {
            runtime.syncPhase = "failed";
            log(persistError, releaseIdOf(pending.envelope) || "release");
            callback(false);
            return;
          }
          if (runtime.pendingRelease !== pending || pending.generation !== runtime.targetGeneration) {
            callback(false);
            return;
          }
          runtime.envelope = pending.envelope;
          runtime.pendingRelease = null;
          runtime.activeIndex = playableItems(runtime.envelope).findIndex(function (item) { return item.id === order[0]; });
          runtime.publicationPass = order.slice(1);
          runtime.itemFailures = {};
          runtime.releaseSource = "cache";
          runtime.syncPhase = "active";
          setState(runtime.offline ? "OFFLINE_PLAYING" : "PLAYING");
          log(
            "LEGACY_RELEASE_ACTIVATED",
            releaseIdOf(runtime.envelope) || "release"
          );
          callback(true);
        }
      );
    }
    function nextItem() {
      if (runtime.goalPauseApplied) return;
      if (runtime.applicationReloadPending) {
        runtime.applicationReloadPending = false;
        window.location.reload();
        return;
      }
      var items = playableItems(runtime.envelope);
      var nextIndex;
      clearPlaybackTimers();
      cancelPendingMedia();
      silenceCurrentMediaEvents();
      if (!items.length) return;
      nextIndex = (runtime.activeIndex + 1) % items.length;
      if (runtime.publicationPass) {
        var nextPriorityId;
        var priorityIndex = -1;
        while (runtime.publicationPass.length && priorityIndex < 0) {
          nextPriorityId = runtime.publicationPass.shift();
          priorityIndex = items.findIndex(function (item) { return item.id === nextPriorityId; });
        }
        nextIndex = priorityIndex >= 0 ? priorityIndex : 0;
        if (priorityIndex < 0) runtime.publicationPass = null;
      }
      if (Object.keys(runtime.itemFailures).length >= items.length) {
        showStatus(
          "Playback herstelt",
          "Content kon niet veilig starten",
          "De Player blijft het manifest controleren en toont geen leeg wit scherm.",
          "LEGACY_RELEASE_UNPLAYABLE"
        );
        setState("ERROR_RECOVERABLE");
        scheduleManifestSync(runtime.forceManifestRefresh ? 0 : 15000);
        return;
      }
      if (runtime.pendingRelease) {
        activatePendingRelease(function (activated) {
          if (!activated) {
            runtime.activeIndex = nextIndex;
          }
          playCurrent();
        });
        return;
      }
      runtime.activeIndex = nextIndex;
      playCurrent();
    }
    function heartbeatBody() {
      var manifest = runtime.envelope && runtime.envelope.manifest;
      var device = runtime.envelope && runtime.envelope.device;
      var pendingManifest = runtime.pendingRelease &&
        runtime.pendingRelease.envelope &&
        runtime.pendingRelease.envelope.manifest;
      return {
        mediaTraffic: playerMediaTraffic.snapshot(),
        goalVideoDiagnostics: goalVideoTelemetry(),
        goalVideoCapabilities: goalVideoCapabilities("static-lg", CONFIG.appVersion),
        activeReleaseId: runtime.presentedReleaseId,
        currentItemId: runtime.currentItem ? runtime.currentItem.id : null,
        desiredReleaseId: pendingManifest
          ? pendingManifest.releaseId
          : device
            ? device.desiredReleaseId
            : null,
        networkState: runtime.offline ? "offline" : "online",
        runtimeState:
          runtime.state === "DOWNLOADING" ||
          runtime.state === "VERIFYING" ||
          runtime.state === "SWITCH_PENDING" ||
          runtime.state === "OFFLINE_PLAYING" ||
          runtime.state === "PLAYING" ||
          runtime.state === "ERROR_RECOVERABLE"
            ? runtime.state
            : "READY",
        runtimeVersion: CONFIG.appVersion,
        publicationTrace: runtime.publicationTrace,
        preparationError: runtime.preparationError,
        syncPhase: runtime.syncPhase
      };
    }
    function sendHeartbeat() {
      if (!runtime.deviceToken) return;
      if (runtime.heartbeatInFlight) { runtime.heartbeatPending = true; return; }
      runtime.heartbeatInFlight = true;
      request(
        "POST",
        "/api/player/heartbeat",
        {
          Authorization: "Bearer " + runtime.deviceToken,
          "Content-Type": "application/json"
        },
        JSON.stringify(heartbeatBody()),
        function (transport, status, body) {
          runtime.heartbeatInFlight = false;
          if (runtime.heartbeatPending) { runtime.heartbeatPending = false; window.setTimeout(sendHeartbeat, 0); }
          var code = errorCode(body, transport || "PLAYER_API_UNAVAILABLE");
          if (
            !transport &&
            (status === 401 || status === 403 || status === 410) &&
            definitiveCredentialCodes[code]
          ) {
            clearInvalidDeviceCredential();
            ensurePairing();
          }
        }
      );
    }
    function readExecutedCommands() {
      var values = parseJson(safeRead(CONFIG.executedCommandsKey));
      return Array.isArray(values) ? values : [];
    }
    function rememberCommand(nonce) {
      var values = readExecutedCommands().filter(function (value) {
        return typeof value === "string" && value !== nonce;
      });
      values.push(nonce);
      safeWrite(CONFIG.executedCommandsKey, JSON.stringify(values.slice(-80)));
    }
    function commandRequest(command, phase, failureCode, callback) {
      request(
        "POST",
        "/api/player/commands",
        {
          Authorization: "Bearer " + runtime.installationCredential,
          "Content-Type": "application/json"
        },
        JSON.stringify({
          commandId: command.id,
          commandType: command.commandType,
          failureCode: failureCode || undefined,
          phase: phase
        }),
        function (transport, status, body) {
          callback(!transport && status >= 200 && status < 300, body);
        }
      );
    }
    function executeCommand(command, serverNow) {
      var executed = readExecutedCommands();
      var alreadyExecuted;
      var expiresAt;
      if (
        !command ||
        typeof command.id !== "string" ||
        typeof command.nonce !== "string"
      ) return;
      expiresAt = parsePlayerTimestamp(command.expiresAt);
      if (
        serverNow === null ||
        expiresAt === null ||
        expiresAt <= serverNow
      ) return;
      alreadyExecuted = executed.indexOf(command.nonce) !== -1;
      commandRequest(command, "acknowledged", null, function (acknowledged) {
        if (!acknowledged) return;
        if (!alreadyExecuted) rememberCommand(command.nonce);
        commandRequest(command, "completed", null, function (completed, body) {
          if (!completed) return;
          if (command.commandType === "RECOVER_PAIRING" && validCredential(body && body.deviceToken)) {
            persistDeviceToken(body.deviceToken);
            clearTemporaryPairing();
            restartGoalRealtime();
            syncManifest();
          } else if (command.commandType === "FORCE_UNPAIR") {
            clearInvalidDeviceCredential();
            ensurePairing();
          } else if (command.commandType === "RELOAD_PLAYER") {
            window.location.reload();
          }
        });
      });
    }
    function pollCommands() {
      if (!runtime.installationCredential) return;
      request(
        "GET",
        "/api/player/commands",
        { Authorization: "Bearer " + runtime.installationCredential },
        null,
        function (transport, status, body) {
          var commands;
          var index;
          var serverNow;
          if (transport || status < 200 || status >= 300 || !body) return;
          serverNow = parsePlayerTimestamp(body.serverTime);
          if (serverNow === null) {
            log(
              "LEGACY_COMMAND_TIME_INVALID",
              "De commandresponse bevat geen geldige servertijd."
            );
            return;
          }
          if (
            Math.abs(now() - serverNow) > 60000 &&
            now() - runtime.lastClockSkewLoggedAt > 600000
          ) {
            runtime.lastClockSkewLoggedAt = now();
            log(
              "LEGACY_CLOCK_SKEW",
              "Tv-klok wijkt " +
                String(Math.round((now() - serverNow) / 1000)) +
                " seconden af; servertijd wordt gebruikt."
            );
          }
          commands = Array.isArray(body.commands) ? body.commands : [];
          for (index = 0; index < commands.length; index += 1) {
            executeCommand(commands[index], serverNow);
          }
        }
      );
    }
    function recoverCachedDeviceToken(callback) {
      var open;
      var stores = [CONFIG.activeReleaseStore, CONFIG.previousReleaseStore];
      var storeIndex = 0;
      var latestToken = null;
      var latestActivatedAt = 0;
      var finished = false;

      function finish(value) {
        if (finished) return;
        finished = true;
        callback(value);
      }
      if (!window.indexedDB) {
        finish(null);
        return;
      }
      try {
        open = window.indexedDB.open(CONFIG.databaseName);
      } catch (error) {
        finish(null);
        return;
      }
      open.onerror = function () { finish(null); };
      open.onsuccess = function () {
        var database = open.result;

        function scanNextStore() {
          var transaction;
          var requestResult;
          var storeName;
          if (storeIndex >= stores.length) {
            database.close();
            finish(latestToken);
            return;
          }
          storeName = stores[storeIndex];
          storeIndex += 1;
          if (!database.objectStoreNames.contains(storeName)) {
            scanNextStore();
            return;
          }
          try {
            transaction = database.transaction(storeName, "readonly");
            requestResult = transaction.objectStore(storeName).openCursor();
          } catch (error) {
            scanNextStore();
            return;
          }
          requestResult.onerror = function () { scanNextStore(); };
          requestResult.onsuccess = function () {
            var cursor = requestResult.result;
            var candidate;
            var activatedAt;
            if (!cursor) {
              scanNextStore();
              return;
            }
            candidate = cursor.value;
            activatedAt = new Date(
              candidate && candidate.activatedAt || ""
            ).getTime();
            if (
              candidate &&
              validCredential(candidate.deviceToken) &&
              candidate.envelope &&
              isManifestEnvelope(candidate.envelope) &&
              (!latestToken ||
                (isFinite(activatedAt) && activatedAt > latestActivatedAt))
            ) {
              latestToken = candidate.deviceToken;
              latestActivatedAt = isFinite(activatedAt) ? activatedAt : 0;
            }
            cursor.continue();
          };
        }
        scanNextStore();
      };
    }
    function boot() {
      var generation;
      runtime.bootGeneration += 1;
      generation = runtime.bootGeneration;
      runtime.installationId = ensureInstallationId();
      runtime.ledScoresMatchStates = readStoredLedScoresMatchStates();
      runtime.installationCredential = safeRead(CONFIG.installationCredentialKey);
      if (!validCredential(runtime.installationCredential)) {
        runtime.installationCredential = null;
      }
      runtime.deviceToken = readDeviceToken();
      setState("INSTALLATION_REGISTERING");
      showStatus(
        "LG Legacy Player",
        "Player starten",
        "Installatie, koppeling en laatste geldige release worden gecontroleerd.",
        ""
      );
      function continueBoot() {
        if (generation !== runtime.bootGeneration) return;
        registerInstallation(function (ok, code, retryAfter) {
          if (generation !== runtime.bootGeneration) return;
          if (!ok) {
            scheduleBoot(
              code || "INSTALLATION_API_UNAVAILABLE",
              "De installatie kon tijdelijk niet worden gecontroleerd.",
              retryAfter
            );
            return;
          }
          runtime.syncFailures = 0;
          if (!runtime.deviceToken) {
            ensurePairing();
            return;
          }
          restartGoalRealtime();
          readCachedRelease(runtime.deviceToken, function (cached) {
            if (generation !== runtime.bootGeneration) return;
            if (cached) {
              runtime.cachedRelease = cached;
              runtime.envelope = cached.envelope;
              runtime.releaseSource = "cache";
              runtime.offline = window.navigator.onLine === false;
              byId("offline").className = runtime.offline ? "visible" : "";
              startRelease(cached.envelope, "cache");
            }
            syncManifest();
          });
        });
      }
      if (runtime.deviceToken) {
        continueBoot();
        return;
      }
      recoverCachedDeviceToken(function (recoveredToken) {
        if (generation !== runtime.bootGeneration) return;
        if (recoveredToken && persistDeviceToken(recoveredToken)) {
          log(
            "LEGACY_DEVICE_CREDENTIAL_RECOVERED",
            "Credential hersteld uit geverifieerde lokale release."
          );
        }
        continueBoot();
      });
    }
    window.onerror = function (message) {
      log("LEGACY_CLIENT_EXCEPTION", String(message || "onbekende fout"));
      showStatus(
        "Playerherstel",
        "De eenvoudige Player herstelt",
        "Een lokale JavaScript-fout is opgevangen. De Player probeert gecontroleerd opnieuw.",
        "LEGACY_CLIENT_EXCEPTION"
      );
      window.setTimeout(boot, 5000);
      return true;
    };
    window.onunhandledrejection = function () {
      log("LEGACY_PROMISE_REJECTION", "onafgehandelde browserbelofte");
    };
    window.setInterval(sendHeartbeat, CONFIG.heartbeatIntervalMs);
    window.setInterval(pollCommands, CONFIG.commandIntervalMs);
    window.addEventListener("online", function () {
      runtime.offline = false;
      restartGoalRealtime();
      invalidateManifest();
    });
    window.addEventListener("pageshow", invalidateManifest);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "hidden") invalidateManifest();
    });
    window.addEventListener("offline", function () {
      stopGoalRealtime(false);
      restoreLastKnownGood(function () {});
    });
    window.addEventListener("resize", function () {
      var activeLineup = runtime.goalActiveKind === "lineup"
        ? runtime.goalActiveModel
        : null;
      refitDynamicTemplates();
      if (activeLineup) renderMatchOverlay(activeLineup);
    });
    notifyLgWrapperReady();
    boot();
  }());
  </script>
</body>
</html>`;
}
