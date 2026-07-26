export const localStorageDeviceTokenKey = "veyocast.player.deviceToken";
export const localStoragePairingCodeKey = "veyocast.player.pairingCode";
export const localStoragePairingExpiryKey = "veyocast.player.pairingExpiresAt";
export const localStoragePairingProvisionAfterKey =
  "veyocast.player.pairingProvisionAfter";
export const localStoragePlayerInstanceKey = "veyocast.player.instanceId";
export const localStorageRecoveryMarkerKey = "veyocast.player.recovery.v1";
export const localStorageReloadTimestampsKey =
  "veyocast.player.reloadTimestamps";

export const playerRecoveryMarkerTtlMs = 2 * 60_000;

export const temporaryPairingCookieNames = [
  "veyocast_pairing_session",
  "veyocast_player_pairing"
] as const;
