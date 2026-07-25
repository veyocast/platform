const playerUrl = "https://player.veyocast.nl/lg";

const response = await fetch(playerUrl, {
  redirect: "manual",
  signal: AbortSignal.timeout(20000)
});
if (response.status !== 200) {
  throw new Error(`/lg geeft HTTP ${response.status}, verwacht 200`);
}
if (response.url !== playerUrl) {
  throw new Error(`/lg redirect naar ${response.url}`);
}
const contentType = response.headers.get("content-type") || "";
if (!contentType.startsWith("text/html")) {
  throw new Error(`/lg geeft onverwacht Content-Type ${contentType}`);
}
const xFrameOptions = response.headers.get("x-frame-options");
if (xFrameOptions) {
  throw new Error(`/lg mag geen X-Frame-Options sturen, kreeg ${xFrameOptions}`);
}
const contentSecurityPolicy =
  response.headers.get("content-security-policy") || "";
if (!/\bframe-ancestors\s+file:/u.test(contentSecurityPolicy)) {
  throw new Error("/lg CSP staat de lokale file:-wrapper niet expliciet toe");
}
if (!/\bobject-src\s+'none'/u.test(contentSecurityPolicy)) {
  throw new Error("/lg CSP mist object-src 'none'");
}

const html = await response.text();
const scriptSources = [
  ...html.matchAll(/<script[^>]+src="([^"]+)"/gu)
].map((match) => new URL(match[1], playerUrl).toString());
if (scriptSources.length === 0) {
  throw new Error("/lg bevat geen laadbare Player-scripts");
}

let bridgeFound = false;
for (const scriptUrl of scriptSources) {
  const scriptResponse = await fetch(scriptUrl, {
    redirect: "error",
    signal: AbortSignal.timeout(20000)
  });
  if (!scriptResponse.ok) {
    throw new Error(`Player-script geeft HTTP ${scriptResponse.status}: ${scriptUrl}`);
  }
  const script = await scriptResponse.text();
  if (
    script.includes("VEYOCAST_LG_PLAYER_READY") &&
    script.includes("VEYOCAST_LG_CAPABILITIES")
  ) {
    bridgeFound = true;
  }
}
if (!bridgeFound) {
  throw new Error("/lg productie-output bevat de verwachte READY-bridge niet");
}

process.stdout.write(
  [
    `URL=${playerUrl}`,
    `status=${response.status}`,
    `contentType=${contentType}`,
    `xFrameOptions=${xFrameOptions || "afwezig"}`,
    `contentSecurityPolicy=${contentSecurityPolicy}`,
    "tls=door Node trust store gevalideerd",
    "redirects=0",
    "readyBridge=aanwezig"
  ].join("\n") + "\n"
);
