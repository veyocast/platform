export function normalizePairingCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

export function pairingCodeFromScan(value: string) {
  const trimmed = value.trim();
  if (!trimmed.includes("://")) {
    const direct = normalizePairingCode(trimmed);
    return /^[A-Z0-9]{6,12}$/.test(direct) ? direct : null;
  }
  try {
    const url = new URL(trimmed);
    const trusted =
      (url.protocol === "https:" &&
        url.hostname === "control.veyocast.nl" &&
        url.pathname.startsWith("/mobile/")) ||
      url.protocol === "veyocast-control:";
    if (!trusted) return null;
    const code = normalizePairingCode(url.searchParams.get("code") ?? "");
    return /^[A-Z0-9]{6,12}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}
