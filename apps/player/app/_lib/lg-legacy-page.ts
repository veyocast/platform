import { currentPlayerApplicationVersion } from "./player-app-update";
import themeManifestSource from "../../../../packages/content-templates/src/THEME-MANIFEST.v1.json";

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
  heartbeatIntervalMs: 30_000,
  installationCredentialKey: "veyocast.player.installationCredential",
  installationIdKey: "veyocast.player.instanceId",
  legacyDiagnosticsKey: "veyocast.player.lgLegacyDiagnostics.v1",
  manifestIntervalMs: 30_000,
  pairingCodeKey: "veyocast.player.pairingCode",
  pairingExpiryKey: "veyocast.player.pairingExpiresAt",
  pairingNonceKey: "veyocast.player.pairingRequestNonce",
  previousReleaseStore: "previousReleases",
  previousDeviceTokenKey: "castivo.player.deviceToken",
  requestTimeoutMs: 12_000,
  storageReserveBytes: 16 * 1024 * 1024,
  storageReserveMaximumBytes: 64 * 1024 * 1024,
  themeCatalog: legacyThemeCatalog,
  themeManifestVersion: themeManifestSource.manifestVersion,
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
  <style>
    *{box-sizing:border-box}
    html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#050505;color:#f7f5f0;font-family:Arial,Helvetica,sans-serif}
    body{position:relative}
    #media-root{position:absolute;top:0;right:0;bottom:0;left:0;background:#050505;overflow:hidden}
    #media-root>img,#media-root>video{display:block;width:100%;height:100%;border:0;background:#050505}
    .legacy-media-layer{position:absolute;top:0;right:0;bottom:0;left:0;z-index:1;opacity:0;visibility:hidden;transition:opacity 180ms ease}
    .legacy-media-layer.visible{opacity:1;visibility:visible}
    .legacy-media-layer.retiring{opacity:0;visibility:visible}
    #status{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;padding:5vh 5vw;background:#080908}
    #status[hidden]{display:none}
    .panel{width:min(860px,90vw);padding:clamp(28px,4vw,58px);border:1px solid rgba(255,255,255,.22);border-radius:24px;background:#101110}
    .logo{display:block;width:min(290px,48vw);height:auto;margin:0 0 42px}
    .kicker{margin:0 0 14px;color:#ff5a1f;font-size:clamp(15px,1.5vw,22px);font-weight:700;letter-spacing:.1em;text-transform:uppercase}
    h1{margin:0;font-size:clamp(42px,6vw,82px);line-height:.98;letter-spacing:-.045em}
    #detail{max-width:720px;margin:24px 0 0;color:#d6d3cc;font-size:clamp(18px,2vw,28px);line-height:1.45}
    #pairing{display:none;margin:32px 0 0}
    #pairing.visible{display:block}
    #pairing-code{display:inline-block;padding:18px 26px;border:2px solid #ff5a1f;border-radius:14px;color:#fff;font-size:clamp(42px,7vw,84px);font-weight:800;letter-spacing:.12em}
    #error-code{margin:18px 0 0;color:#ffb28f;font:700 clamp(14px,1.4vw,20px)/1.4 monospace}
    #diagnostics{margin:18px 0 0;color:#aaa69d;font:400 clamp(12px,1.2vw,17px)/1.45 monospace;white-space:pre-wrap}
    #watermark{position:absolute;left:2.2vw;bottom:2.2vh;display:none;width:clamp(100px,9vw,180px);height:auto;opacity:.4;pointer-events:none}
    #watermark.visible{display:block}
    #offline{position:absolute;right:2vw;bottom:2vh;display:none;padding:8px 12px;border-radius:999px;background:rgba(7,7,7,.76);color:#f4c15d;font-size:16px;font-weight:700}
    #offline.visible{display:block}
    .dynamic-template{--accent:#ff5c20;position:absolute;top:0;right:0;bottom:0;left:0;display:grid;grid-template-rows:auto 1fr auto;overflow:hidden;padding:5vh 5vw 4vh;background:#f4efe6;color:#11110f;font-family:Arial,Helvetica,sans-serif}
    .dynamic-template.dark{background:#080908;color:#fffdf7}
    .dynamic-template header{border-bottom:2px solid rgba(98,95,87,.3);padding:1.8vh 0 2.8vh}
    .dynamic-template header p,.dynamic-news-meta{margin:0 0 1vh;color:var(--accent);font-size:clamp(17px,1.45vw,30px);font-weight:800;letter-spacing:.14em;text-transform:uppercase}
    .dynamic-template h1{margin:0;max-width:90%;font-size:clamp(44px,5vw,96px);line-height:.94;letter-spacing:-.045em}
    .dynamic-body{align-self:stretch;display:grid;align-content:center;min-height:0;padding:2.5vh 0}
    .dynamic-menu-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.2vh 2.2vw}
    .dynamic-menu-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2vw;min-height:10vh;padding:1.5vh 1.5vw;border-left:8px solid var(--accent);background:#fffdf7}
    .dark .dynamic-menu-item{background:#141512}
    .dynamic-menu-item small{display:block;margin:0 0 .4vh;color:var(--accent);font-size:clamp(13px,1vw,21px);font-weight:800;letter-spacing:.08em;text-transform:uppercase}
    .dynamic-menu-item h2{margin:0;font-size:clamp(24px,2.2vw,44px);line-height:1.05}
    .dynamic-menu-item p{margin:.7vh 0 0;color:#625f57;font-size:clamp(14px,1.05vw,23px);line-height:1.3}
    .dark .dynamic-menu-item p{color:#c9c4b9}
    .dynamic-menu-item strong{color:var(--accent);font-size:clamp(27px,2.5vw,50px);white-space:nowrap}
    .dynamic-news{max-width:84%;padding:4vh 0}
    .dynamic-news h2{margin:1.8vh 0 2.6vh;font-size:clamp(62px,7.2vw,138px);line-height:.92;letter-spacing:-.055em}
    .dynamic-news p:last-child{margin:0;max-width:80%;color:#625f57;font-size:clamp(24px,2.35vw,47px);line-height:1.35}
    .dark .dynamic-news p:last-child{color:#c9c4b9}
    .dynamic-match{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:3vw;padding:4vh 1vw;text-align:center}
    .dynamic-team{display:grid;justify-items:center;gap:2vh;min-width:0}
    .dynamic-team-mark{display:flex;align-items:center;justify-content:center;width:min(25vw,32vh);height:min(25vw,32vh);border:9px solid var(--accent);background:#fffdf7;color:#11110f;font-size:clamp(52px,7vw,126px);font-weight:900}
    .dark .dynamic-team-mark{background:#141512;color:#fffdf7}
    .dynamic-team h2{margin:0;font-size:clamp(34px,3.5vw,70px);line-height:1}
    .dynamic-match-meta{display:grid;justify-items:center;gap:1.3vh;min-width:18vw}
    .dynamic-match-meta small{color:var(--accent);font-size:clamp(15px,1.2vw,25px);font-weight:900;letter-spacing:.1em;text-transform:uppercase}
    .dynamic-match-meta strong{font-size:clamp(36px,4vw,76px)}
    .dynamic-match-meta p{margin:0;color:#625f57;font-size:clamp(18px,1.5vw,29px)}
    .dark .dynamic-match-meta p{color:#c9c4b9}
    .dynamic-list{display:grid}
    .dynamic-row{display:grid;grid-template-columns:50px minmax(0,1fr) minmax(130px,1.15fr);align-items:center;gap:1.4vw;min-height:8.5vh;padding:1vh 1vw;border-top:1px solid rgba(98,95,87,.3)}
    .dynamic-row>span{color:var(--accent);font-size:clamp(19px,1.6vw,31px);font-weight:900}
    .dynamic-row h2{margin:0;font-size:clamp(23px,2vw,39px);line-height:1.05}
    .dynamic-row p{margin:.4vh 0 0;color:#625f57;font-size:clamp(14px,1.1vw,22px)}
    .dark .dynamic-row p{color:#c9c4b9}
    .dynamic-row strong{justify-self:end;font-size:clamp(19px,1.4vw,29px);text-align:right}
    .dynamic-empty{padding:3vh 3vw;border-left:8px solid var(--accent);background:#fffdf7;font-size:clamp(25px,2.4vw,47px);font-weight:800}
    .dark .dynamic-empty{background:#141512}
    .dynamic-template footer{display:flex;justify-content:space-between;padding-top:1.7vh;border-top:1px solid rgba(98,95,87,.3);color:#625f57;font-size:clamp(12px,.95vw,19px);font-weight:700;letter-spacing:.06em;text-transform:uppercase}
    .dark footer{color:#c9c4b9}
    .dynamic-template.portrait{padding:5vh 6vw 4vh}
    .portrait .dynamic-menu-grid{grid-template-columns:1fr;gap:1vh}
    .portrait .dynamic-menu-item{min-height:7.2vh;padding:1.1vh 2.6vw}
    .portrait .dynamic-news{max-width:100%}
    .portrait .dynamic-news h2{font-size:clamp(60px,11.5vw,130px)}
    .portrait .dynamic-news p:last-child{max-width:100%;font-size:clamp(26px,4vw,47px)}
    .portrait .dynamic-match{grid-template-columns:1fr;gap:2.5vh}
    .portrait .dynamic-team{grid-template-columns:auto minmax(0,1fr);align-items:center;justify-items:start;width:100%;text-align:left}
    .portrait .dynamic-team-mark{width:min(24vw,17vh);height:min(24vw,17vh);font-size:clamp(42px,9vw,90px)}
    .portrait .dynamic-match-meta{width:100%;padding:2vh 0;border-top:1px solid rgba(98,95,87,.3);border-bottom:1px solid rgba(98,95,87,.3)}
    .portrait .dynamic-row{grid-template-columns:44px minmax(0,1fr);min-height:10.5vh}
    .portrait .dynamic-row strong{grid-column:2;justify-self:start;text-align:left}
    .dynamic-template.editorial-arena{display:block;padding:0;background:#f3f1ec;color:#17202a}
    .dynamic-template.editorial-arena.dark{background:#070a0e;color:#f3f0e9}
    .dynamic-template.editorial-arena{background:var(--editorial-canvas);color:var(--editorial-text)}
    .dynamic-template.editorial-arena[data-theme-id]{font-family:var(--vc-theme-body-font),Arial,Helvetica,sans-serif}
    .dynamic-template.editorial-arena[data-theme-id] h1,.dynamic-template.editorial-arena[data-theme-id] h2{font-family:var(--vc-theme-display-font),Arial,Helvetica,sans-serif;font-weight:var(--vc-theme-display-weight);letter-spacing:var(--vc-theme-display-spacing)}
    .dynamic-template.editorial-arena[data-theme-id="editorial"]{background-image:linear-gradient(112deg,transparent 0,transparent 68%,rgba(255,90,31,.10) 100%)}
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
    .dynamic-template.editorial-arena>header{position:absolute;top:0;right:4.27%;left:4.27%;height:17.41%;display:grid;grid-template-columns:5.73% 1fr 22.4%;align-items:center;gap:1.46%;padding:0;border-bottom:1px solid rgba(23,32,42,.13)}
    .dynamic-template.editorial-arena.dark>header{border-color:rgba(255,255,255,.12)}
    .editorial-crest{display:flex;align-items:center;justify-content:center;width:83.6%;height:59.6%;overflow:hidden;background:var(--accent);color:#fff;font-size:clamp(18px,2.1vw,42px);font-weight:900;clip-path:polygon(7% 0,93% 0,85% 72%,50% 100%,15% 72%)}
    .editorial-crest img{width:100%;height:100%;object-fit:contain}
    .editorial-heading p{margin:0 0 .6em;color:var(--accent);font-size:clamp(11px,1.04vw,20px);font-weight:900;letter-spacing:.18em;text-transform:uppercase}
    .dynamic-template.editorial-arena .editorial-heading h1{max-width:100%;margin:0;font-size:clamp(31px,3.34vw,64px);font-weight:900;line-height:.92;text-transform:uppercase}
    .editorial-heading>span{display:block;margin-top:.55em;color:#6f7882;font-size:clamp(12px,1.25vw,24px);font-weight:800;letter-spacing:.1em;text-transform:uppercase}
    .dark .editorial-heading>span{color:#9aa2ac}
    .editorial-context{display:flex;flex-direction:column;align-items:flex-end;gap:1.2em;text-align:right}
    .editorial-context strong{font-size:clamp(12px,1.25vw,24px);letter-spacing:.08em;text-transform:uppercase}
    .editorial-context strong:before{display:inline-block;width:36px;height:3px;margin:0 16px 7px 0;background:var(--accent);content:""}
    .editorial-context span{font-size:clamp(12px,1.25vw,24px);font-weight:900}
    .editorial-arena .dynamic-body{position:absolute;top:19.82%;right:4.27%;bottom:8.52%;left:4.27%;display:grid;align-content:stretch;padding:0}
    .dynamic-template.editorial-arena>footer{position:absolute;right:4.27%;bottom:2.87%;left:12.27%;height:2.78%;display:flex;align-items:center;justify-content:space-between;padding:0;border:0;color:#6f7882;font-size:clamp(9px,.73vw,14px);font-weight:800;letter-spacing:.13em}
    .dynamic-template.editorial-arena.dark>footer{color:#9aa2ac}
    .editorial-arena .dynamic-menu-grid,.editorial-arena .dynamic-list,.editorial-arena .dynamic-match{height:100%;padding:2.8%;overflow:hidden;border:1px solid rgba(23,32,42,.13);border-radius:24px;background:#fffefa;box-shadow:0 24px 80px rgba(0,0,0,.24)}
    .editorial-arena.dark .dynamic-menu-grid,.editorial-arena.dark .dynamic-list,.editorial-arena.dark .dynamic-match{border-color:rgba(255,255,255,.12);background:#0d1218}
    .editorial-arena .dynamic-menu-item{grid-template-columns:92px minmax(0,1fr) auto;min-height:auto;border:1px solid rgba(23,32,42,.13);border-left:6px solid var(--accent);border-radius:14px;background:#f7f5f0}
    .editorial-arena.dark .dynamic-menu-item{border-color:rgba(255,255,255,.12);background:#121820}
    .editorial-arena.portrait .dynamic-menu-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:1vh 1.4vw}
    .editorial-product-pic{display:flex;align-items:center;justify-content:center;width:92px;height:92px;overflow:hidden;border:1px solid rgba(23,32,42,.13);border-radius:18px;background:var(--accent);color:#fff;font-size:32px;font-weight:900}
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
    .legacy-price-category{display:flex;align-items:center;gap:24px;overflow:hidden;font-size:28px;font-weight:900;text-transform:uppercase;white-space:nowrap}
    .legacy-price-category:before{flex:0 0 8px;height:64px;background:var(--accent);content:""}
    .legacy-price-category span{overflow:hidden;text-overflow:ellipsis}
    .legacy-price-category small{margin-left:auto;color:#9aa2ac;font-size:10px;letter-spacing:.12em;text-transform:uppercase}
    .legacy-price-product{display:grid;grid-template-columns:64px minmax(0,1fr) 120px;align-items:center;gap:16px;padding:12px 0}
    .legacy-price-media{display:block;width:64px;height:64px;overflow:hidden}
    .legacy-price-media img{display:block;width:100%;height:100%;object-fit:cover}
    .legacy-price-copy{display:grid;grid-template-rows:1fr 1fr;align-items:center;min-width:0;height:64px}
    .legacy-price-copy strong,.legacy-price-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .legacy-price-copy strong{align-self:end;font-size:26px;line-height:1}
    .legacy-price-copy small{align-self:start;padding-top:5px;color:#9aa2ac;font-size:17px;line-height:22px}
    .legacy-price-product>b{justify-self:end;overflow:hidden;max-width:120px;color:var(--accent);font-size:32px;font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
    .editorial-arena:not(.dark) .legacy-price-category,.editorial-arena:not(.dark) .legacy-price-product{border-color:rgba(23,32,42,.12)}
    .editorial-arena:not(.dark) .legacy-price-category small,.editorial-arena:not(.dark) .legacy-price-copy small{color:#6f7882}
    .dynamic-template.menu-studio-v2>header{top:72px;right:96px;left:96px;height:152px;grid-template-columns:1fr auto;gap:48px;border-bottom:4px solid var(--accent)}
    .menu-studio-v2 .editorial-crest,.menu-studio-v2 .editorial-context{display:none}
    .menu-studio-v2 .editorial-heading p{margin-bottom:10px;font-size:24px}
    .dynamic-template.menu-studio-v2 .editorial-heading h1{font-family:var(--vc-theme-display-font),Arial,sans-serif;font-size:82px;font-weight:var(--vc-theme-display-weight);letter-spacing:var(--vc-theme-display-spacing);line-height:.95}
    .editorial-arena.menu-studio-v2 .dynamic-body{top:248px;right:96px;bottom:auto;left:96px;height:704px}
    .dynamic-template.editorial-arena.menu-studio-v2>footer{right:96px;bottom:48px;left:96px;height:48px;border-top:2px solid var(--editorial-border)}
    .menu-studio-v2 .legacy-price-grid{gap:36px}
    .menu-studio-v2 .legacy-price-column{box-sizing:border-box;height:100%;padding:22px;border:2px solid var(--editorial-border);border-radius:20px;background:var(--editorial-surface);box-shadow:0 24px 80px var(--editorial-shadow)}
    .menu-studio-v2 .legacy-price-category{height:70px;border-bottom:3px solid var(--accent);font-family:var(--vc-theme-display-font),Arial,sans-serif;font-size:36px}
    .menu-studio-v2 .legacy-price-category:before{display:none}
    .menu-studio-v2 .legacy-price-product{height:78px;grid-template-columns:64px minmax(0,1fr) 120px;padding:8px 4px}
    .menu-studio-v2 .legacy-price-copy strong{font-size:26px}
    .menu-studio-v2 .legacy-price-copy small{font-size:18px}
    .menu-studio-v2 .legacy-price-product>b{font-size:26px}
    .legacy-menu-group{background:var(--editorial-row)}
    .legacy-menu-free{color:var(--accent)}
    .dynamic-template.menu-studio-v2.portrait>header{top:96px;right:72px;left:72px;height:228px;grid-template-columns:1fr auto}
    .dynamic-template.menu-studio-v2.portrait .editorial-heading h1{font-size:76px}
    .editorial-arena.menu-studio-v2.portrait .dynamic-body{top:348px;right:72px;bottom:auto;left:72px;height:1388px}
    .dynamic-template.editorial-arena.menu-studio-v2.portrait>footer{right:72px;bottom:96px;left:72px;height:64px}
    .menu-studio-v2.portrait .legacy-price-grid{gap:36px}
    .menu-studio-v2.portrait .legacy-price-column{padding:18px}
    .menu-studio-v2.portrait .legacy-price-category{height:70px;font-size:30px}
    .menu-studio-v2.portrait .legacy-price-product{height:78px;grid-template-columns:56px minmax(0,1fr) 92px;gap:10px;padding:7px 2px}
    .menu-studio-v2.portrait .legacy-price-media{width:56px;height:56px}
    .menu-studio-v2.portrait .legacy-price-copy{height:56px}
    .menu-studio-v2.portrait .legacy-price-copy strong{font-size:20px}
    .menu-studio-v2.portrait .legacy-price-copy small{font-size:14px}
    .menu-studio-v2.portrait .legacy-price-product>b{font-size:21px}
    .editorial-arena.dark .dynamic-team-mark{background:var(--accent);color:#fff}
    .editorial-news{display:grid;grid-template-columns:1.02fr .98fr;gap:1.6%;height:100%}
    .editorial-news-art,.editorial-news-copy{position:relative;overflow:hidden;border:1px solid rgba(23,32,42,.13);border-radius:24px;background:#fffefa;box-shadow:0 24px 80px rgba(0,0,0,.24)}
    .dark .editorial-news-art,.dark .editorial-news-copy{border-color:rgba(255,255,255,.12);background:#0d1218}
    .editorial-news-art{align-self:center;width:100%;height:auto;display:block;background:#152d43;animation:editorial-photo-in 360ms ease-out both}
    .editorial-news-art:before{display:block;padding-top:56.25%;content:""}
    .editorial-news-art>img{position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;object-fit:contain}
    .editorial-news-art>span{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.08);font-size:clamp(70px,14vw,270px);font-weight:900}
    .editorial-news-source{position:absolute;top:4%;left:4%;z-index:2;max-width:42%;max-height:12%;color:#fff;font-weight:900;text-transform:uppercase}
    .editorial-news-source img{width:auto;max-width:190px;height:auto;max-height:64px;object-fit:contain}
    .editorial-news-copy{position:relative;display:flex;flex-direction:column;justify-content:flex-start;padding:5%}
    .editorial-news-copy>span{margin:0 0 .6em;color:var(--accent);font-size:clamp(11px,1.04vw,20px);font-weight:900;letter-spacing:.18em;text-transform:uppercase;animation:editorial-copy-in 280ms 760ms ease-out both}
    .editorial-news-copy h2{margin:0;font-size:clamp(46px,4.17vw,80px);font-weight:900;letter-spacing:-.025em;line-height:.92;text-transform:uppercase;animation:editorial-copy-in 300ms 260ms ease-out both}
    .editorial-news-copy h2.dense{font-size:clamp(36px,3.12vw,60px);line-height:1}
    .editorial-news-copy p{max-width:92%;margin:4% 0 0;color:#6f7882;font-size:clamp(24px,1.67vw,32px);line-height:1.45;animation:editorial-copy-in 300ms 520ms ease-out both}
    .dark .editorial-news-copy p{color:#9aa2ac}
    .editorial-news-meta{display:flex;gap:6%;margin-top:auto;margin-right:135px;padding-top:2.6%;padding-right:0;border-top:1px solid rgba(23,32,42,.13);animation:editorial-copy-in 280ms 760ms ease-out both}
    .dark .editorial-news-meta{border-color:rgba(255,255,255,.12)}
    .editorial-news-meta small{min-width:0;font-size:clamp(13px,1vw,19px)}
    .editorial-news-meta b{display:block;margin-bottom:.4em;color:var(--accent);letter-spacing:.12em;text-transform:uppercase}
    .editorial-news-qr{position:absolute;right:5%;bottom:4.5%;display:flex;flex-direction:column;align-items:center;gap:10px;width:110px;color:#6f7882;font-size:12px;font-weight:800;letter-spacing:.05em;text-align:center;text-transform:uppercase}
    .editorial-news-qr img{display:block;width:110px;height:110px;border-radius:8px;background:#fff}
    @keyframes editorial-photo-in{from{opacity:0;transform:scale(1.025)}}
    @keyframes editorial-copy-in{from{opacity:0;transform:translateY(18px)}}
    @media (prefers-reduced-motion:reduce){.editorial-news-art,.editorial-news-copy>span,.editorial-news-copy h2,.editorial-news-copy p,.editorial-news-meta{animation:none}}
    .editorial-arena.portrait>header{right:calc(5.37% + var(--viewport-inset-x,0px));left:calc(5.37% + var(--viewport-inset-x,0px));height:14.06%;grid-template-columns:10% 1fr}
    .editorial-arena.portrait .editorial-context{display:none}
    .editorial-arena.portrait .editorial-crest{width:92%;height:42%}
    .editorial-arena.portrait .dynamic-body{top:15.83%;right:calc(5.37% + var(--viewport-inset-x,0px));bottom:5.52%;left:calc(5.37% + var(--viewport-inset-x,0px))}
    .dynamic-template.editorial-arena.portrait>footer{right:calc(5.37% + var(--viewport-inset-x,0px));bottom:1.88%;left:calc(17.37% + var(--viewport-inset-x,0px))}
    .editorial-arena.portrait .editorial-news{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}
    .editorial-arena.portrait .editorial-news-copy h2{font-size:clamp(52px,6.67vw,72px);line-height:.96}
    .editorial-arena.portrait .editorial-news-copy h2.dense{font-size:clamp(42px,5.37vw,58px)}
    .editorial-arena.portrait .editorial-news-copy p{max-width:100%;font-size:34px;line-height:1.45}
    .editorial-arena.portrait .editorial-news-meta{margin-right:145px;padding-right:0}
    .editorial-arena.portrait .editorial-news-meta small{font-size:24px}
    .editorial-arena.portrait .editorial-news-qr{width:115px}
    .editorial-arena.portrait .editorial-news-qr img{width:115px;height:115px}
    .editorial-arena[data-slide-type="news"]>header{height:13%}
    .editorial-arena[data-slide-type="news"] .dynamic-body{top:15.4%}
    .editorial-arena.portrait[data-slide-type="news"]>header{height:9.5%}
    .editorial-arena.portrait[data-slide-type="news"] .dynamic-body{top:11.2%}
    .dynamic-template.editorial-arena.portrait[data-slide-type="price_list"]>header{right:48px;left:48px;height:9.27%;grid-template-columns:104px 1fr;gap:24px}
    .editorial-arena.portrait[data-slide-type="price_list"] .editorial-crest{width:104px;height:104px}
    .editorial-arena.portrait[data-slide-type="price_list"] .dynamic-body{top:10.42%;right:4.44%;bottom:4.58%;left:4.44%}
    .portrait .legacy-price-grid{gap:32px}
    .portrait .legacy-price-category,.portrait .legacy-price-product{height:96px}
    .portrait .legacy-price-category{gap:16px;font-size:22px}
    .portrait .legacy-price-category:before{flex-basis:7px}
    .portrait .legacy-price-product{grid-template-columns:64px minmax(0,1fr) 92px;gap:12px;padding:16px 0}
    .portrait .legacy-price-copy strong{font-size:20px}
    .portrait .legacy-price-copy small{padding-top:4px;font-size:14px;line-height:19px}
    .portrait .legacy-price-product>b{max-width:92px;font-size:24px}
    .legacy-standing-card{box-sizing:border-box;height:100%;overflow:hidden;padding:1.35%;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:#0d1218;box-shadow:0 24px 80px rgba(0,0,0,.24)}
    .legacy-standing-columns,.legacy-standing-row{box-sizing:border-box;display:grid;grid-template-columns:4% 1fr repeat(6,5.7%) 15%;align-items:center;gap:.7%}
    .legacy-standing-columns{height:7%;padding:0 .7%;border-bottom:2px solid var(--accent);color:var(--accent);font-size:22px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
    .legacy-standing-rows{height:87%;overflow:hidden}
    .legacy-standing-row{height:10%;padding:0 .7%;border-bottom:1px solid rgba(255,255,255,.12);font-size:28px;font-weight:800}
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
    .legacy-standing-context{height:6%;margin:.6% 0 0;color:#9aa2ac;font-size:13px;text-align:right}
    .portrait .legacy-standing-card{padding:2%}
    .portrait .legacy-standing-columns,.portrait .legacy-standing-row{grid-template-columns:5% 1fr repeat(6,6.3%) 16%}
    .portrait .legacy-standing-columns{height:5%;font-size:18px}
    .portrait .legacy-standing-rows{height:90%}
    .portrait .legacy-standing-row{height:5.5556%;font-size:26px}
    .portrait .legacy-standing-context{height:5%;margin-top:.3%;font-size:13px}
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
    @media(max-height:650px){.panel{padding:24px}.logo{width:210px;margin-bottom:24px}#detail{margin-top:14px}#pairing{margin-top:18px}}
  </style>
</head>
<body>
  <main id="media-root" aria-label="VeyoCast afspeeloppervlak"></main>
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
  <script>
  (function () {
    "use strict";
    var CONFIG = ${config};
    var runtime = {
      activeIndex: 0,
      activationInFlight: false,
      applicationReloadPending: false,
      bootGeneration: 0,
      cachedRelease: null,
      currentElement: null,
      currentItem: null,
      currentObjectUrls: [],
      deviceToken: null,
      envelope: null,
      forceManifestRefresh: false,
      installationCredential: null,
      installationId: null,
      itemFailures: {},
      lastClockSkewLoggedAt: 0,
      lastProgressAt: 0,
      offline: false,
      pendingElement: null,
      pendingObjectUrls: [],
      pendingRelease: null,
      playbackGeneration: 0,
      playbackTimer: null,
      progressTimer: null,
      releaseSource: "online",
      retryTimer: null,
      state: "BOOTING",
      syncInFlight: false,
      syncFailures: 0,
      syncPhase: null,
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
      byId("status").hidden = false;
      byId("watermark").className = "";
      setText("kicker", kicker);
      setText("title", title);
      setText("detail", detail);
      setText("error-code", code ? "Foutcode: " + code : "");
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
          xhr.getResponseHeader("X-VeyoCast-Player-Version")
        );
      }
      xhr.onload = function () { finish(null); };
      xhr.onerror = function () { finish("NETWORK_ERROR"); };
      xhr.ontimeout = function () { finish("TIMEOUT"); };
      try { xhr.send(body || null); } catch (error) { finish("XHR_EXCEPTION"); }
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
      var xhr = new XMLHttpRequest();
      var completed = false;
      function finish(error, bytes, mimeType) {
        if (completed) return;
        completed = true;
        callback(error, bytes, mimeType);
      }
      try {
        xhr.open("GET", asset.url, true);
        xhr.responseType = "arraybuffer";
        xhr.timeout = CONFIG.assetRequestTimeoutMs;
      } catch (error) {
        finish("LEGACY_ASSET_REQUEST_FAILED", null, null);
        return;
      }
      xhr.onload = function () {
        if (xhr.status < 200 || xhr.status >= 300 || !xhr.response) {
          finish("LEGACY_ASSET_HTTP_ERROR", null, null);
          return;
        }
        finish(
          null,
          xhr.response,
          xhr.getResponseHeader("Content-Type") || asset.mimeType
        );
      };
      xhr.onerror = function () {
        finish("LEGACY_ASSET_NETWORK_ERROR", null, null);
      };
      xhr.ontimeout = function () {
        finish("LEGACY_ASSET_TIMEOUT", null, null);
      };
      try { xhr.send(null); } catch (error) {
        finish("LEGACY_ASSET_REQUEST_FAILED", null, null);
      }
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
    function downloadMissingAssets(cache, assets, callback) {
      var storedKeys = [];
      var index = 0;
      function fail(code) {
        deleteCacheKeys(cache, storedKeys, function () {
          callback(code);
        });
      }
      function downloadNext() {
        var asset;
        if (index >= assets.length) {
          callback(null);
          return;
        }
        asset = assets[index];
        index += 1;
        setState("DOWNLOADING");
        runtime.syncPhase = "downloading";
        downloadAsset(asset, function (downloadError, bytes, mimeType) {
          if (downloadError) {
            fail(downloadError);
            return;
          }
          setState("VERIFYING");
          runtime.syncPhase = "verifying";
          verifyAssetBytes(asset, bytes, function (verifyError) {
            var response;
            if (verifyError) {
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
              storedKeys.push(asset.cacheKey);
              downloadNext();
            }, function () {
              fail("LEGACY_CACHE_WRITE_FAILED");
            });
          });
        });
      }
      downloadNext();
    }
    function preparePendingRelease(envelope, callback) {
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
        if (cacheError) {
          callback({ ok: false, error: cacheError });
          return;
        }
        setState("VERIFYING");
        runtime.syncPhase = "verifying";
        inspectCachedAssets(cache, uniqueAssets, function (inspectError, missing) {
          if (inspectError) {
            callback({ ok: false, error: inspectError });
            return;
          }
          checkStorage(missing, function (storageError) {
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
            });
          });
        });
      });
    }
    function syncManifest() {
      var forceRefresh = runtime.forceManifestRefresh;
      var headers;
      var knownReleaseId;
      if (runtime.syncInFlight) return;
      if (!runtime.deviceToken) {
        ensurePairing();
        return;
      }
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
      if (knownReleaseId) {
        headers["If-None-Match"] = releaseEtag(knownReleaseId);
      }
      runtime.syncInFlight = true;
      request(
        "GET",
        "/api/player/manifest?legacy=" + String(now()),
        headers,
        null,
        function (transport, status, body, retryAfter, advertisedVersion) {
          var code = errorCode(body, transport || "PLAYER_API_UNAVAILABLE");
          runtime.syncInFlight = false;
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
            showStatus(
              "Player gekoppeld",
              "Wachten op content",
              "Publiceer een playlist naar dit scherm. De Player controleert automatisch opnieuw.",
              ""
            );
            scheduleManifestSync(CONFIG.manifestIntervalMs);
            sendHeartbeat();
            return;
          }
          if (!transport && status >= 200 && status < 300 && isManifestEnvelope(body)) {
            clearTemporaryPairing();
            runtime.syncFailures = 0;
            runtime.offline = false;
            byId("offline").className = "";
            if (
              !forceRefresh &&
              releaseIdOf(runtime.envelope) === releaseIdOf(body)
            ) {
              runtime.pendingRelease = null;
              runtime.envelope.device = body.device;
              runtime.envelope.diagnostics = body.diagnostics;
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
            runtime.syncInFlight = true;
            preparePendingRelease(body, function (prepared) {
              if (!prepared.ok) {
                runtime.syncInFlight = false;
                runtime.syncFailures = Math.min(runtime.syncFailures + 1, 8);
                runtime.syncPhase = "failed";
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
              runtime.forceManifestRefresh = false;
              if (releaseIdOf(runtime.envelope) === releaseIdOf(body)) {
                runtime.syncInFlight = false;
                runtime.pendingRelease = null;
                runtime.envelope.device = body.device;
                runtime.envelope.diagnostics = body.diagnostics;
                runtime.itemFailures = {};
                setState(runtime.offline ? "OFFLINE_PLAYING" : "PLAYING");
                runtime.syncPhase = "active";
                playCurrent();
                scheduleManifestSync(CONFIG.manifestIntervalMs);
                sendHeartbeat();
                return;
              }
              queuePreparedRelease(
                body,
                prepared.assets,
                function (queueError) {
                  runtime.syncInFlight = false;
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
    function scheduleManifestSync(delay) {
      window.clearTimeout(runtime.retryTimer);
      runtime.retryTimer = window.setTimeout(syncManifest, delay);
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
          try { database.close(); } catch (error) {}
          finish("LEGACY_RELEASE_PERSIST_FAILED", null);
        };
        transaction.oncomplete = function () {
          try { database.close(); } catch (error) {}
          runtime.cachedRelease = cached;
          finish(null, cached);
          garbageCollectCachedMedia();
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
          envelope: envelope
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
          typeof item.source.url === "string";
      });
    }
    function startRelease(envelope, source) {
      var items = playableItems(envelope);
      if (!items.length) {
        showStatus(
          "Release geweigerd",
          "Geen afspeelbare content",
          "De immutable release bevat geen afbeelding of video die deze eenvoudige Player kan tonen.",
          "LEGACY_RELEASE_EMPTY"
        );
        setState("ERROR_RECOVERABLE");
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
      window.clearInterval(runtime.templateTimer);
      runtime.playbackTimer = null;
      runtime.watchdogTimer = null;
      runtime.progressTimer = null;
      runtime.templateTimer = null;
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
      if (previousElement && previousElement !== element) {
        previousElement.className += " retiring";
        window.setTimeout(function () {
          disposeMediaElement(previousElement, previousObjectUrls);
        }, 220);
      }
      mediaReady();
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
      if (
        item &&
        item.kind === "video" &&
        !runtime.offline &&
        item.source &&
        typeof item.source.url === "string" &&
        item.source.url.toLowerCase().indexOf("https://") === 0
      ) {
        callback(item.source.url, null, true);
        return;
      }
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
      "sport_cancellations",
      "sport_dressing_rooms",
      "sport_match_of_the_day",
      "sport_next_match",
      "sport_officials",
      "sport_program",
      "sport_results",
      "sport_standing"
    ];
    function templateRecord(value) {
      return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
    }
    function templateArray(value) {
      return Array.isArray(value) ? value.slice(0, 100) : [];
    }
    function templateText(value, fallback) {
      var normalized;
      if (typeof value !== "string") return fallback || "";
      normalized = value.replace(/\\s+/g, " ").replace(/^\\s+|\\s+$/g, "");
      return normalized ? normalized.slice(0, 500) : fallback || "";
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
        sport_results: "Uitslagen",
        sport_sponsor: "Partner van de week",
        sport_standing: "Stand",
        sport_team: "Team",
        sport_trainings: "Trainingen",
        sport_volunteers: "Vrijwilligers"
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
      var capacity = orientation === "portrait" ? 14 : 8;
      var pages = [];
      function groupCost(group) {
        var display = templateRecord(group.display) || {};
        return Number(display.maxLines) === 2 ? 2 : 1;
      }
      function paginate(blocks, column) {
        var result = [];
        var current = [];
        var used = 0;
        var blockIndex;
        function flush() {
          if (current.length) result.push(current);
          current = [];
          used = 0;
        }
        blocks.sort(function (left, right) {
          return Number(left.order || 0) - Number(right.order || 0) ||
            templateText(left.id, "").localeCompare(templateText(right.id, ""));
        });
        for (blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
          var block = templateRecord(blocks[blockIndex]) || {};
          var layout = templateRecord((templateRecord(block.layout) || {})[orientation]) || {};
          var midpoint = Number(layout.x || 0) + Number(layout.w || 0) / 2;
          var isLeft = midpoint <= (orientation === "portrait" ? 540 : 960);
          if ((column === "left") !== isLeft) continue;
          if (block.type === "product-group") {
            var standalone = templateRecord(block.group) || {};
            var standaloneCost = groupCost(standalone);
            if (used + standaloneCost > capacity) flush();
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
          var offset = 0;
          var continuation = false;
          while (offset < nodes.length) {
            var minimumCount = Math.min(2, nodes.length - offset);
            var minimumCost = 1;
            var minimumIndex;
            for (minimumIndex = 0; minimumIndex < minimumCount; minimumIndex += 1) {
              minimumCost += nodes[offset + minimumIndex].kind === "product-group"
                ? groupCost(nodes[offset + minimumIndex])
                : 1;
            }
            if (used > 0 && capacity - used < minimumCost) {
              flush();
              continue;
            }
            current.push({
              continuation: continuation,
              kind: "category",
              name: templateText(block.labelOverride, templateText((templateRecord(block.source) || {}).sourceName, "Categorie"))
            });
            used += 1;
            while (offset < nodes.length) {
              var node = templateRecord(nodes[offset]) || {};
              var cost = node.kind === "product-group" ? groupCost(node) : 1;
              if (used + cost > capacity) break;
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
        var left = paginate(flowBlocks.slice(0), "left");
        var right = paginate(flowBlocks.slice(0), "right");
        var count = Math.max(left.length, right.length, 1);
        for (var pageIndex = 0; pageIndex < count; pageIndex += 1) {
          pages.push({ left: left[pageIndex] || [], right: right[pageIndex] || [] });
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
        appendMedia(article, product.mediaOverrideAssetId || snapshotFallback.imageAssetId, snapshotFallback.name);
        var copy = templateNode("span", "legacy-price-copy");
        copy.appendChild(templateNode("strong", "", templateText(product.nameOverride, templateText(snapshotFallback.name, "Product"))));
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
        appendMedia(article, group.imageAssetId, group.title);
        var copy = templateNode("span", "legacy-price-copy");
        copy.appendChild(templateNode("strong", "", templateText(group.title, "Productgroep")));
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
      return {
        pages: pages.length ? pages : [{ left: [], right: [] }],
        render: function (page) {
          var grid = templateNode("div", "legacy-price-grid");
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
          appendColumn("right");
          body.appendChild(grid);
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
                copy.appendChild(templateNode("strong", "", templateText(product.name, "Product")));
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
    function renderNewsTemplate(body, snapshot, payload, root) {
      var news = templateRecord(snapshot.data) || templateRecord(snapshot.news) || {};
      var articles = templateUniqueNewsArticles(templateArray(news.articles));
      var usesArena =
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
      return {
        pages: articles.length ? articles : [null],
        pageDuration: seconds * 1000,
        render: function (articleValue) {
          var article = templateRecord(articleValue);
          var wrapper;
          body.innerHTML = "";
          if (!article) {
            body.appendChild(templateNode("div", "dynamic-empty", "Er zijn nu geen nieuwsberichten."));
            return;
          }
          if (usesArena) {
            var arenaPage = templateNode("div", "editorial-news");
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
            arenaCopy.appendChild(templateNode("span", "", "Laatste nieuws"));
            var arenaTitleText = templateText(article.title, "Clubnieuws");
            var arenaTitle = templateNode("h2", "", arenaTitleText);
            if (arenaTitleText.length > 64) arenaTitle.className = "dense";
            arenaCopy.appendChild(arenaTitle);
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
              arenaQr.appendChild(templateNode("span", "", "Scan voor het artikel"));
              arenaCopy.appendChild(arenaQr);
            }
            arenaPage.appendChild(arenaHero);
            arenaPage.appendChild(arenaCopy);
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
    function renderMatchTeam(name) {
      var team = templateNode("article", "dynamic-team");
      team.appendChild(templateNode("div", "dynamic-team-mark", templateInitials(name)));
      team.appendChild(templateNode("h2", "", name));
      return team;
    }
    function standingValue(value) {
      return value === null || typeof value === "undefined" || value === ""
        ? "–"
        : String(value);
    }
    function renderEditorialStandingTemplate(body, snapshot, payload) {
      var sport = templateRecord(snapshot.sport) || {};
      var competition = templateRecord(sport.competition) || {};
      var pool = templateRecord(sport.pool) || {};
      var items = templateArray(sport.items);
      var pages = templatePages(items, 20);
      return {
        pages: pages,
        render: function (page) {
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
    function renderSportTemplate(body, snapshot, slideType, orientation) {
      var sport = templateRecord(snapshot.sport) || {};
      var items = templateArray(sport.items);
      var match = slideType === "sport_match_of_the_day" || slideType === "sport_next_match";
      var pages = match ? [items.length ? items[0] : null] : templatePages(items, orientation === "portrait" ? 6 : 8);
      return {
        pages: pages,
        render: function (page) {
          var item;
          var teams;
          var centre;
          var meta;
          var list;
          var index;
          var row;
          var copy;
          body.innerHTML = "";
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
            centre.appendChild(renderMatchTeam(teams[0]));
            meta = templateNode("div", "dynamic-match-meta");
            meta.appendChild(templateNode("small", "", templateText(item.status, "Programma")));
            meta.appendChild(templateNode(
              "strong",
              "",
              templateText(item.time, templateText(item.secondary, "Tijd volgt"))
            ));
            meta.appendChild(templateNode(
              "p",
              "",
              templateText(item.venue, templateText(item.meta, "Locatie volgt"))
            ));
            centre.appendChild(meta);
            centre.appendChild(renderMatchTeam(teams[1]));
            body.appendChild(centre);
            return;
          }
          if (!page.length) {
            body.appendChild(templateNode("div", "dynamic-empty", "Deze clubinformatie is nu niet beschikbaar."));
            return;
          }
          list = templateNode("div", "dynamic-list");
          for (index = 0; index < page.length; index += 1) {
            item = templateRecord(page[index]) || {};
            if (!templateText(item.primary, "")) continue;
            row = templateNode("article", "dynamic-row");
            row.appendChild(templateNode("span", "", String(index + 1)));
            copy = templateNode("div", "");
            copy.appendChild(templateNode("h2", "", templateText(item.primary, "Clubinformatie")));
            if (item.secondary) copy.appendChild(templateNode("p", "", templateText(item.secondary, "")));
            row.appendChild(copy);
            var rowMeta = templateText(
              item.venue,
              templateText(item.meta, templateText(item.status, ""))
            );
            if (
              slideType === "sport_results" &&
              isFinite(Number(item.homeScore)) &&
              isFinite(Number(item.awayScore))
            ) {
              rowMeta = String(Number(item.homeScore)) + " – " +
                String(Number(item.awayScore));
            } else if (item.time) {
              rowMeta = templateText(item.time, rowMeta);
            } else if (slideType === "sport_dressing_rooms") {
              rowMeta = [
                item.homeRoom ? "Thuis " + templateText(item.homeRoom, "") : "",
                item.awayRoom ? "Uit " + templateText(item.awayRoom, "") : ""
              ].filter(function (value) { return Boolean(value); }).join(" · ") ||
                rowMeta;
            }
            row.appendChild(templateNode("strong", "", rowMeta));
            list.appendChild(row);
          }
          body.appendChild(list);
        }
      };
    }
    function fitDynamicTemplateCanvas(root, orientation) {
      var mediaRoot = byId("media-root");
      var logicalWidth = orientation === "portrait" ? 1080 : 1920;
      var logicalHeight = orientation === "portrait" ? 1920 : 1080;
      var viewportWidth = mediaRoot.clientWidth || window.innerWidth || logicalWidth;
      var viewportHeight = mediaRoot.clientHeight || window.innerHeight || logicalHeight;
      var scale = orientation === "portrait" && viewportHeight >= viewportWidth
        ? Math.max(viewportWidth / logicalWidth, viewportHeight / logicalHeight)
        : Math.min(viewportWidth / logicalWidth, viewportHeight / logicalHeight);
      if (!isFinite(scale) || scale <= 0) scale = 1;
      var insetX = orientation === "portrait" && viewportHeight >= viewportWidth
        ? Math.max(0, (logicalWidth - viewportWidth / scale) / 2)
        : 0;
      root.setAttribute("data-canvas-height", String(logicalHeight));
      root.setAttribute("data-canvas-width", String(logicalWidth));
      root.setAttribute("data-template-orientation", orientation);
      root.style.top = "50%";
      root.style.right = "auto";
      root.style.bottom = "auto";
      root.style.left = "50%";
      root.style.width = String(logicalWidth) + "px";
      root.style.height = String(logicalHeight) + "px";
      root.style.setProperty("--viewport-inset-x", String(insetX) + "px");
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
    function playDynamicTemplate(item, fallbackUrl, objectUrls, generation) {
      var payload = item.dynamicTemplate;
      var snapshot = templateRecord(payload.data) || {};
      var root = templateNode("section", "dynamic-template");
      var header = templateNode("header", "");
      var body = templateNode("div", "dynamic-body");
      var footer = templateNode("footer", "");
      var sourceLabel = "VeyoCast ClubTV";
      var title = "Clubinformatie";
      var renderer;
      var pageIndex = 0;
      var accent = "#ff5c20";
      var templateDuration;
      var brand = templateRecord(snapshot.brand);
      var editorialConfiguration = templateRecord(snapshot.editorial) || {};
      var editorialTheme = templateRecord(editorialConfiguration.theme) || {};
      var themePresentation = templateRecord(snapshot.themePresentation) || {};
      var themeSelection = templateRecord(themePresentation.selection) || {};
      var themeReference = templateRecord(themeSelection.ref) || {};
      var resolvedThemeMode = templateRecord(themePresentation.resolvedMode) || {};
      var manifestTheme = templateRecord(CONFIG.themeCatalog[templateText(themeReference.id, "editorial")]) || templateRecord(CONFIG.themeCatalog.editorial) || {};
      var editorialMode = templateText(
        resolvedThemeMode.mode,
        templateText(editorialTheme.mode,
        payload.templateSlug.indexOf("dark") !== -1 ? "dark" : "light"
        )
      );
      var manifestPalette = templateRecord(manifestTheme[editorialMode]) || {};
      var editorialTokens = Object.keys(manifestPalette).length
        ? manifestPalette
        : templateRecord(editorialTheme[editorialMode]) || {};
      var editorialArena =
        templateText(payload.templateSlug, "").indexOf("editorial-arena-") === 0;
      if (brand && typeof brand.primaryColor === "string" && /^#[0-9a-f]{6}$/i.test(brand.primaryColor)) {
        accent = brand.primaryColor;
      }
      if (typeof manifestTheme.accent === "string") accent = manifestTheme.accent;
      if (typeof themeSelection.accent === "string" && /^#[0-9a-f]{6}$/i.test(themeSelection.accent)) {
        accent = themeSelection.accent;
      }
      root.className += editorialMode === "dark" ? " dark" : "";
      root.className += payload.orientation === "portrait" ? " portrait" : "";
      root.setAttribute("data-slide-type", payload.slideType);
      root.setAttribute("data-theme-id", templateText(themeReference.id, "editorial"));
      if (editorialArena) root.className += " editorial-arena";
      root.style.setProperty("--accent", accent);
      root.style.setProperty("--vc-theme-body-font", templateText(manifestTheme.bodyFont, "Arial"));
      root.style.setProperty("--vc-theme-display-font", templateText(manifestTheme.displayFont, "Arial"));
      root.style.setProperty("--vc-theme-display-weight", String(Number(manifestTheme.displayWeight) || 700));
      root.style.setProperty("--vc-theme-display-spacing", String(Number(manifestTheme.displayLetterSpacingEm) || 0) + "em");
      root.style.setProperty("--editorial-canvas", templateText(editorialTokens.canvas, editorialMode === "dark" ? "#090B0E" : "#D7D2C8"));
      root.style.setProperty("--editorial-surface", templateText(editorialTokens.surface, editorialMode === "dark" ? "#0D1116" : "#F3F0E9"));
      root.style.setProperty("--editorial-row", templateText(editorialTokens.row, editorialMode === "dark" ? "#11161C" : "#FBF9F4"));
      root.style.setProperty("--editorial-text", templateText(editorialTokens.text, editorialMode === "dark" ? "#F7F3EB" : "#111315"));
      root.style.setProperty("--editorial-border", templateText(editorialTokens.border, editorialMode === "dark" ? "rgba(250,250,247,.15)" : "rgba(17,19,21,.12)"));
      root.style.setProperty("--editorial-border-soft", templateText(editorialTokens.borderSoft, editorialMode === "dark" ? "rgba(250,250,247,.09)" : "rgba(17,19,21,.075)"));
      root.style.setProperty("--editorial-shadow", templateText(editorialTokens.shadow, editorialMode === "dark" ? "rgba(0,0,0,.34)" : "rgba(66,55,41,.14)"));
      if (templateText(editorialTokens.accent, "")) {
        root.style.setProperty("--accent", templateText(editorialTokens.accent, accent));
      }
      if (payload.slideType === "menu") {
        sourceLabel = "Clubkantine";
        title = templateText((templateRecord(snapshot.data) || {}).title, "Menu vandaag");
        renderer = renderMenuTemplate(body, snapshot, payload.orientation, payload);
      } else if (payload.slideType === "price_list") {
        sourceLabel = "Prijzen uit de clubkantine";
        var menuStudioDocument = templateRecord(snapshot.menuDocument) || {};
        if (menuStudioDocument.schemaVersion === "menu-document.v2") {
          root.className += " menu-studio-v2";
          sourceLabel = "Menu Studio";
        }
        title = templateText(menuStudioDocument.title, templateText((templateRecord(snapshot.priceList) || {}).title, "Prijslijst"));
        renderer = renderPriceListTemplate(body, snapshot, payload.orientation, payload);
      } else if (payload.slideType === "news") {
        sourceLabel = "Clubnieuws";
        title = "Het laatste nieuws";
        renderer = renderNewsTemplate(body, snapshot, payload, root);
      } else {
        sourceLabel = payload.slideType.indexOf("standing") !== -1 ? "Competitie" : "Match centre";
        title = templateText((templateRecord(snapshot.sport) || {}).title, sportTemplateTitle(payload.slideType));
        renderer = payload.slideType === "sport_standing"
          ? renderEditorialStandingTemplate(body, snapshot, payload)
          : renderSportTemplate(body, snapshot, payload.slideType, payload.orientation);
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
        heading.appendChild(templateNode("h1", "", title));
        context.appendChild(templateNode("strong", "", sourceLabel));
        context.appendChild(templateNode("span", "", "VeyoCast"));
        header.appendChild(crest);
        header.appendChild(heading);
        header.appendChild(context);
      } else {
        header.appendChild(templateNode("p", "", sourceLabel));
        header.appendChild(templateNode("h1", "", title));
      }
      footer.appendChild(templateNode("span", "", "VeyoCast ClubTV"));
      footer.appendChild(templateNode("span", "dynamic-page-number", renderer.pages.length > 1 ? "1 / " + String(renderer.pages.length) : "Live clubinformatie"));
      root.appendChild(header);
      root.appendChild(body);
      root.appendChild(footer);
      renderer.render(renderer.pages[0]);
      fitDynamicTemplateCanvas(root, payload.orientation);
      beginPendingMedia(root, objectUrls);
      if (!commitPendingMedia(root, objectUrls, generation)) return;
      templateDuration = Math.max(
        itemDurationMs(item),
        renderer.pages.length * (renderer.pageDuration || 5000)
      );
      if (renderer.pages.length > 1) {
        runtime.templateTimer = window.setInterval(function () {
          var number;
          if (runtime.currentElement !== root) return;
          pageIndex = (pageIndex + 1) % renderer.pages.length;
          renderer.render(renderer.pages[pageIndex]);
          number = root.querySelector(".dynamic-page-number");
          if (number) number.textContent = String(pageIndex + 1) + " / " + String(renderer.pages.length);
        }, renderer.pageDuration || Math.floor(templateDuration / renderer.pages.length));
      }
      runtime.playbackTimer = window.setTimeout(nextItem, templateDuration);
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
          runtime.playbackTimer = window.setTimeout(
            nextItem,
            itemDurationMs(item)
          );
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
        runtime.lastProgressAt = now();
        if (!committed) {
          window.clearTimeout(runtime.watchdogTimer);
          runtime.watchdogTimer = null;
          committed = commitPendingMedia(
            video,
            objectUrls,
            generation
          );
        }
      };
      video.ontimeupdate = function () {
        if (!committed || runtime.currentElement !== video) return;
        runtime.lastProgressAt = now();
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
          now() - runtime.lastProgressAt > CONFIG.videoProgressTimeoutMs
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
      if (attempts === 0) {
        playCurrent();
        return;
      }
      nextItem();
    }
    function activatePendingRelease(callback) {
      var pending = runtime.pendingRelease;
      if (!pending || runtime.activationInFlight) {
        callback(false);
        return;
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
          if (runtime.pendingRelease !== pending) {
            callback(false);
            return;
          }
          runtime.envelope = pending.envelope;
          runtime.pendingRelease = null;
          runtime.activeIndex = 0;
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
      if (runtime.applicationReloadPending) {
        runtime.applicationReloadPending = false;
        window.location.reload();
        return;
      }
      var items = playableItems(runtime.envelope);
      var nextIndex;
      var wrapped;
      clearPlaybackTimers();
      cancelPendingMedia();
      silenceCurrentMediaEvents();
      if (!items.length) return;
      nextIndex = (runtime.activeIndex + 1) % items.length;
      wrapped = nextIndex === 0;
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
      if (wrapped && runtime.pendingRelease) {
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
        activeReleaseId: manifest ? manifest.releaseId : null,
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
        syncPhase: runtime.syncPhase
      };
    }
    function sendHeartbeat() {
      if (!runtime.deviceToken) return;
      request(
        "POST",
        "/api/player/heartbeat",
        {
          Authorization: "Bearer " + runtime.deviceToken,
          "Content-Type": "application/json"
        },
        JSON.stringify(heartbeatBody()),
        function (transport, status, body) {
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
      syncManifest();
    });
    window.addEventListener("offline", function () {
      restoreLastKnownGood(function () {});
    });
    window.addEventListener("resize", refitDynamicTemplates);
    notifyLgWrapperReady();
    boot();
  }());
  </script>
</body>
</html>`;
}
