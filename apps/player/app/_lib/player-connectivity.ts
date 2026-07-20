export const playerConnectivityEventName = "veyocast:connectivity";

export type PlayerConnectivityEvent = CustomEvent<{ online: boolean }>;

export function reportPlayerConnectivity(online: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(playerConnectivityEventName, { detail: { online } })
  );
}
