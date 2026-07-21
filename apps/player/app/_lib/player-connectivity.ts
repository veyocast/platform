export const playerConnectivityEventName = "veyocast:connectivity";

export type PlayerConnectivityEvent = CustomEvent<{ online: boolean }>;

let lastKnownOriginConnectivity: boolean | null = null;

export function reportPlayerConnectivity(online: boolean) {
  if (typeof window === "undefined") return;
  lastKnownOriginConnectivity = online;
  window.dispatchEvent(
    new CustomEvent(playerConnectivityEventName, { detail: { online } })
  );
}

export function readPlayerConnectivity() {
  if (lastKnownOriginConnectivity !== null) {
    return lastKnownOriginConnectivity;
  }
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export async function fetchPlayerOrigin(
  input: RequestInfo | URL,
  init?: RequestInit
) {
  try {
    const response = await fetch(input, init);
    reportPlayerConnectivity(true);
    return response;
  } catch (error) {
    reportPlayerConnectivity(false);
    throw error;
  }
}
