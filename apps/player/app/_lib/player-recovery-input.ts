import type { LgSignageRemoteCommand } from "./lg-signage-bridge";

export const playerRecoveryHoldDurationMs = 8_000;
export const playerRecoverySequenceWindowMs = 5_000;

const recoverySequence: LgSignageRemoteCommand[] = [
  "enter",
  "enter",
  "enter",
  "back",
  "enter"
];

export type RecoveryInputSequenceState = {
  commands: LgSignageRemoteCommand[];
  lastInputAt: number;
};

export function createRecoveryInputSequenceState(): RecoveryInputSequenceState {
  return { commands: [], lastInputAt: 0 };
}

export function advanceRecoveryInputSequence(
  current: RecoveryInputSequenceState,
  command: LgSignageRemoteCommand,
  now = Date.now()
) {
  const recent =
    current.lastInputAt > 0 &&
    now - current.lastInputAt <= playerRecoverySequenceWindowMs
      ? current.commands
      : [];
  const commands = [...recent, command].slice(-recoverySequence.length);
  const opened =
    commands.length === recoverySequence.length &&
    commands.every((value, index) => value === recoverySequence[index]);
  return {
    opened,
    state: opened
      ? createRecoveryInputSequenceState()
      : { commands, lastInputAt: now }
  };
}
