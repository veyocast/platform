import { describe, expect, it } from "vitest";

import {
  advanceRecoveryInputSequence,
  createRecoveryInputSequenceState
} from "./player-recovery-input";

describe("physical player recovery input", () => {
  it("opent niet door één normale OK-actie", () => {
    const result = advanceRecoveryInputSequence(
      createRecoveryInputSequenceState(),
      "enter",
      1_000
    );
    expect(result.opened).toBe(false);
  });

  it("opent door OK OK OK BACK OK binnen het tijdvenster", () => {
    let state = createRecoveryInputSequenceState();
    let opened = false;
    ["enter", "enter", "enter", "back", "enter"].forEach((command, index) => {
      const result = advanceRecoveryInputSequence(
        state,
        command as "back" | "enter",
        1_000 + index * 500
      );
      state = result.state;
      opened = result.opened;
    });
    expect(opened).toBe(true);
  });

  it("reset een te trage toetsreeks", () => {
    let state = advanceRecoveryInputSequence(
      createRecoveryInputSequenceState(),
      "enter",
      1_000
    ).state;
    state = advanceRecoveryInputSequence(state, "enter", 7_000).state;
    expect(state.commands).toEqual(["enter"]);
  });
});
