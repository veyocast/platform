export const localStorageDeviceTokenKey = "veyocast.player.deviceToken";
export const localStorageInstallationCredentialKey =
  "veyocast.player.installationCredential";
export const localStoragePairingCodeKey = "veyocast.player.pairingCode";
export const localStoragePairingExpiryKey = "veyocast.player.pairingExpiresAt";
export const localStoragePairingRequestNonceKey =
  "veyocast.player.pairingRequestNonce";
export const localStoragePairingProvisionAfterKey =
  "veyocast.player.pairingProvisionAfter";
export const localStoragePlayerInstanceKey = "veyocast.player.instanceId";
export const localStoragePairingMachineKey =
  "veyocast.player.pairingMachine.v1";
export const localStorageExecutedCommandsKey =
  "veyocast.player.executedCommands.v1";
export const localStorageRecoveryMarkerKey = "veyocast.player.recovery.v1";
export const localStorageReloadTimestampsKey =
  "veyocast.player.reloadTimestamps";
export const localStorageTransportDiagnosticsKey =
  "veyocast.player.transportDiagnostics.v1";

export const playerRecoveryMarkerTtlMs = 2 * 60_000;

export const temporaryPairingCookieNames = [
  "veyocast_pairing_session",
  "veyocast_player_pairing"
] as const;
