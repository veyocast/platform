const productionOrigin = "https://veyocast.nl";
const productionControlOrigin = "https://control.veyocast.nl";
const productionPlayerOrigin = "https://player.veyocast.nl";

function validatedHttpsOrigin(value: string | undefined, fallback: string) {
  if (!value) return fallback;

  try {
    const url = new URL(value);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const isVeyoCast = url.protocol === "https:" && (
      url.hostname === "veyocast.nl" || url.hostname.endsWith(".veyocast.nl")
    );

    return isLocal || isVeyoCast ? url.origin : fallback;
  } catch {
    return fallback;
  }
}

export const siteConfig = {
  contactEmail: "support@veyocast.nl",
  controlOrigin: validatedHttpsOrigin(
    process.env.NEXT_PUBLIC_CONTROL_URL,
    productionControlOrigin
  ),
  environment: process.env.VEYOCAST_ENVIRONMENT?.trim() ?? "development",
  name: "VeyoCast",
  origin: validatedHttpsOrigin(process.env.NEXT_PUBLIC_APP_URL, productionOrigin),
  playerOrigin: validatedHttpsOrigin(process.env.NEXT_PUBLIC_PLAYER_URL, productionPlayerOrigin),
  privacyEmail: "privacy@veyocast.nl",
  productionOrigin
} as const;

export function canonicalUrl(pathname: string) {
  const normalizedPath = pathname === "/" ? "" : `/${pathname.replace(/^\/+|\/+$/g, "")}`;
  return `${productionOrigin}${normalizedPath}`;
}

export function isPublicIndexEnvironment() {
  return siteConfig.environment === "production";
}

export const marketingOpenGraphImages = [{
  alt: "VeyoCast",
  height: 1254,
  url: "/assets/brand-hero-1254.webp",
  width: 1254
}];
