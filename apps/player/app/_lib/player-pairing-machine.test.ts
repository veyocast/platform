import { describe, expect, it } from "vitest";

import {
  createPairingMachineSnapshot,
  isDefinitiveCredentialError,
  pairingRequestWatchdog,
  transitionPairingMachine,
  withVisibleRecoveryHint
} from "./player-pairing-machine";

describe("player pairing state machine", () => {
  it("vernieuwt een vastgelopen pairingaanvraag begrensd", () => {
    const started = transitionPairingMachine(
      createPairingMachineSnapshot(0),
      { type: "PAIRING_REQUESTED" },
      1_000
    );

    expect(pairingRequestWatchdog(started, 60_999)).toBe("NONE");
    expect(pairingRequestWatchdog(started, 61_000)).toBe("RESTART_REQUEST");
    expect(pairingRequestWatchdog(started, 121_000)).toBe(
      "SHOW_RECOVERY_HINT"
    );
    expect(withVisibleRecoveryHint(started, 121_000).recoveryHintVisible).toBe(
      true
    );
  });

  it("verwijdert bij een tijdelijke storing geen geldige binding", () => {
    const paired = transitionPairingMachine(
      createPairingMachineSnapshot(0),
      { type: "INSTALLATION_READY", hasDeviceCredential: true },
      1_000
    );
    const offline = transitionPairingMachine(
      paired,
      {
        code: "PAIRING_API_UNAVAILABLE",
        hasValidBinding: true,
        type: "TEMPORARY_FAILURE"
      },
      2_000
    );

    expect(offline.state).toBe("OFFLINE");
    expect(offline.lastErrorCode).toBe("PAIRING_API_UNAVAILABLE");
  });

  it("stuurt definitief ongeldige credentials terug naar unpaired", () => {
    expect(isDefinitiveCredentialError("BINDING_EXPIRED")).toBe(true);
    expect(isDefinitiveCredentialError("PAIRING_API_UNAVAILABLE")).toBe(false);

    const unpaired = transitionPairingMachine(
      createPairingMachineSnapshot(0),
      {
        code: "BINDING_EXPIRED",
        type: "DEFINITIVE_CREDENTIAL_ERROR"
      },
      1_000
    );
    expect(unpaired.state).toBe("UNPAIRED");
    expect(unpaired.lastErrorCode).toBe("BINDING_EXPIRED");
  });
});
