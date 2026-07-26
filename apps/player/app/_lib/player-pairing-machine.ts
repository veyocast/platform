export const pairingStates = [
  "BOOTING",
  "INSTALLATION_REGISTERING",
  "UNPAIRED",
  "PAIRING_REQUESTING",
  "PAIRING_CODE_ACTIVE",
  "PAIRING_CLAIMING",
  "PAIRED",
  "ACTIVE",
  "RECOVERING",
  "OFFLINE",
  "ERROR"
] as const;

export type PairingStateName = (typeof pairingStates)[number];

export type PairingMachineSnapshot = {
  changedAt: string;
  firstRequestStartedAt?: string;
  lastErrorCode?: string;
  recoveryHintVisible: boolean;
  requestStartedAt?: string;
  state: PairingStateName;
};

export type PairingMachineEvent =
  | { type: "BOOT" }
  | { type: "INSTALLATION_REGISTERING" }
  | { type: "INSTALLATION_READY"; hasDeviceCredential: boolean }
  | { type: "PAIRING_REQUESTED" }
  | { type: "PAIRING_CODE_RECEIVED" }
  | { type: "PAIRING_CLAIM_POLLING" }
  | { type: "PAIRING_CLAIMED" }
  | { type: "ACTIVATED" }
  | { type: "RECOVERY_STARTED" }
  | { type: "RECOVERY_COMPLETED" }
  | { type: "TEMPORARY_FAILURE"; code: string; hasValidBinding: boolean }
  | { type: "DEFINITIVE_CREDENTIAL_ERROR"; code: string }
  | { type: "UNEXPECTED_ERROR"; code: string };

export type PairingRequestWatchdogAction =
  | "NONE"
  | "RESTART_REQUEST"
  | "SHOW_RECOVERY_HINT";

const definitiveCredentialErrorCodes = new Set([
  "INVALID_DEVICE_TOKEN",
  "DEVICE_REVOKED",
  "INSTALLATION_NOT_FOUND",
  "BINDING_EXPIRED"
]);

export function createPairingMachineSnapshot(
  now = Date.now()
): PairingMachineSnapshot {
  return {
    changedAt: new Date(now).toISOString(),
    recoveryHintVisible: false,
    state: "BOOTING"
  };
}

export function transitionPairingMachine(
  current: PairingMachineSnapshot,
  event: PairingMachineEvent,
  now = Date.now()
): PairingMachineSnapshot {
  const changedAt = new Date(now).toISOString();

  switch (event.type) {
    case "BOOT":
      return {
        changedAt,
        recoveryHintVisible: false,
        state: "BOOTING"
      };
    case "INSTALLATION_REGISTERING":
      return {
        changedAt,
        recoveryHintVisible: false,
        state: "INSTALLATION_REGISTERING"
      };
    case "INSTALLATION_READY":
      return {
        changedAt,
        recoveryHintVisible: false,
        state: event.hasDeviceCredential ? "PAIRED" : "UNPAIRED"
      };
    case "PAIRING_REQUESTED":
      return {
        changedAt,
        firstRequestStartedAt:
          current.firstRequestStartedAt ?? changedAt,
        lastErrorCode: current.lastErrorCode,
        recoveryHintVisible: false,
        requestStartedAt: changedAt,
        state: "PAIRING_REQUESTING"
      };
    case "PAIRING_CODE_RECEIVED":
      return {
        changedAt,
        firstRequestStartedAt: current.firstRequestStartedAt,
        recoveryHintVisible: false,
        state: "PAIRING_CODE_ACTIVE"
      };
    case "PAIRING_CLAIM_POLLING":
      return {
        ...current,
        changedAt,
        state: "PAIRING_CLAIMING"
      };
    case "PAIRING_CLAIMED":
      return {
        changedAt,
        recoveryHintVisible: false,
        state: "PAIRED"
      };
    case "ACTIVATED":
      return {
        changedAt,
        recoveryHintVisible: false,
        state: "ACTIVE"
      };
    case "RECOVERY_STARTED":
      return {
        changedAt,
        recoveryHintVisible: false,
        state: "RECOVERING"
      };
    case "RECOVERY_COMPLETED":
      return {
        changedAt,
        recoveryHintVisible: false,
        state: "UNPAIRED"
      };
    case "TEMPORARY_FAILURE":
      return {
        ...current,
        changedAt,
        lastErrorCode: event.code,
        state: event.hasValidBinding ? "OFFLINE" : current.state
      };
    case "DEFINITIVE_CREDENTIAL_ERROR":
      return {
        changedAt,
        lastErrorCode: event.code,
        recoveryHintVisible: false,
        state: "UNPAIRED"
      };
    case "UNEXPECTED_ERROR":
      return {
        changedAt,
        lastErrorCode: event.code,
        recoveryHintVisible: current.recoveryHintVisible,
        state: "ERROR"
      };
  }
}

export function pairingRequestWatchdog(
  snapshot: PairingMachineSnapshot,
  now = Date.now()
): PairingRequestWatchdogAction {
  if (snapshot.state !== "PAIRING_REQUESTING") {
    return "NONE";
  }
  const requestStartedAt = Date.parse(
    snapshot.requestStartedAt ?? snapshot.changedAt
  );
  const firstRequestStartedAt = Date.parse(
    snapshot.firstRequestStartedAt ?? snapshot.changedAt
  );
  if (
    Number.isFinite(firstRequestStartedAt) &&
    now - firstRequestStartedAt >= 120_000
  ) {
    return "SHOW_RECOVERY_HINT";
  }
  if (
    Number.isFinite(requestStartedAt) &&
    now - requestStartedAt >= 60_000
  ) {
    return "RESTART_REQUEST";
  }
  return "NONE";
}

export function withVisibleRecoveryHint(
  snapshot: PairingMachineSnapshot,
  now = Date.now()
): PairingMachineSnapshot {
  return {
    ...snapshot,
    changedAt: new Date(now).toISOString(),
    recoveryHintVisible: true
  };
}

export function isDefinitiveCredentialError(code: string | undefined) {
  return Boolean(code && definitiveCredentialErrorCodes.has(code));
}

export function readPairingMachineSnapshot(
  storage: Pick<Storage, "getItem">,
  key: string
) {
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? "null") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const candidate = parsed as Partial<PairingMachineSnapshot>;
    if (
      !pairingStates.includes(candidate.state as PairingStateName) ||
      typeof candidate.changedAt !== "string" ||
      !Number.isFinite(Date.parse(candidate.changedAt))
    ) {
      return null;
    }
    return {
      changedAt: candidate.changedAt,
      ...(typeof candidate.firstRequestStartedAt === "string"
        ? { firstRequestStartedAt: candidate.firstRequestStartedAt }
        : {}),
      ...(typeof candidate.lastErrorCode === "string"
        ? { lastErrorCode: candidate.lastErrorCode }
        : {}),
      recoveryHintVisible: candidate.recoveryHintVisible === true,
      ...(typeof candidate.requestStartedAt === "string"
        ? { requestStartedAt: candidate.requestStartedAt }
        : {}),
      state: candidate.state as PairingStateName
    } satisfies PairingMachineSnapshot;
  } catch {
    return null;
  }
}

export function writePairingMachineSnapshot(
  storage: Pick<Storage, "setItem">,
  key: string,
  snapshot: PairingMachineSnapshot
) {
  try {
    storage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // The in-memory snapshot remains authoritative for this page lifecycle.
  }
}
