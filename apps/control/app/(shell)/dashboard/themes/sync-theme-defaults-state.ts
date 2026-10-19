import {
  syncThemeCreationDefaultsSchema,
  syncThemeDefaultsCommandSchema,
  parseSyncThemeDefaultsAck,
  type SyncThemeCreationDefaults,
  type SyncThemeDefaultsAck,
  type SyncThemeDefaultsCommand,
  type SyncThemeDefaultsProfile,
} from "@veyocast/contracts";
import { syncThemeCreationStarterDefaults } from "../../../../lib/sync-theme-creation-defaults";

export type ThemeDefaultsScope = {
  tenantId: string;
  actorScope: string;
  themeId: SyncThemeDefaultsCommand["themeId"];
};
export type ThemeDefaultsRecovery = ThemeDefaultsScope & {
  schemaVersion: 1;
  revision: number;
  configured: boolean;
  baseline: SyncThemeCreationDefaults;
  draft: SyncThemeCreationDefaults;
  pending: SyncThemeDefaultsCommand | null;
  conflict: boolean;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const keys = ["schemaVersion", "tenantId", "actorScope", "themeId", "revision", "configured", "baseline", "draft", "pending", "conflict"];
export const themeDefaultsJournalKey = (scope: ThemeDefaultsScope) =>
  `veyocast:publisher-recovery:v1:sync-theme-defaults:${scope.tenantId}:${scope.actorScope}:${scope.themeId}`;
export const themeDefaultsDirty = (state: ThemeDefaultsRecovery) => !same(state.draft, state.baseline);

export function newThemeDefaultsRecovery(scope: ThemeDefaultsScope, profile: SyncThemeDefaultsProfile): ThemeDefaultsRecovery {
  if (profile.themeId !== scope.themeId) throw new Error("Het themaprofiel past niet bij deze werkplek.");
  const defaults = profile.defaults ?? syncThemeCreationStarterDefaults(scope.themeId);
  return { tenantId: scope.tenantId, actorScope: scope.actorScope, themeId: scope.themeId, schemaVersion: 1, revision: profile.revision, configured: profile.configured, baseline: defaults, draft: defaults, pending: null, conflict: false };
}

/** Keep the original JSON object, including a pending command's complete body. */
export function parseThemeDefaultsRecovery(raw: string, scope: ThemeDefaultsScope): ThemeDefaultsRecovery {
  if (raw.length > 16_384) throw new Error("De lokale herstelgegevens zijn te groot.");
  const value = JSON.parse(raw) as ThemeDefaultsRecovery;
  if (!value || typeof value !== "object" || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key)) ||
      value.schemaVersion !== 1 || value.tenantId !== scope.tenantId || value.actorScope !== scope.actorScope || value.themeId !== scope.themeId ||
      !Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.configured !== "boolean" || typeof value.conflict !== "boolean" ||
      (value.configured ? value.revision === 0 : value.revision !== 0) ||
      !syncThemeCreationDefaultsSchema.safeParse(value.baseline).success || !syncThemeCreationDefaultsSchema.safeParse(value.draft).success) {
    throw new Error("De lokale herstelgegevens passen niet bij dit account, deze club of dit thema.");
  }
  if (value.pending !== null) {
    const pending = syncThemeDefaultsCommandSchema.safeParse(value.pending);
    if (!pending.success || value.pending.tenantId !== scope.tenantId || value.pending.themeId !== scope.themeId ||
        value.pending.expectedRevision !== value.revision || !same(value.pending.defaults, value.draft)) {
      throw new Error("De eerdere opdracht kon niet veilig worden hersteld.");
    }
  }
  return value;
}

export function prepareThemeDefaultsSave(state: ThemeDefaultsRecovery, nonce: string): ThemeDefaultsRecovery {
  if (state.pending) return state;
  if (state.conflict) throw new Error("Vergelijk eerst met de actuele opgeslagen instellingen.");
  const command = { tenantId: state.tenantId, themeId: state.themeId, expectedRevision: state.revision, defaults: state.draft, idempotencyKey: nonce };
  syncThemeDefaultsCommandSchema.parse(command);
  // This is the precise JSON body sent on the first attempt and every replay.
  return { ...state, pending: JSON.parse(JSON.stringify(command)) as SyncThemeDefaultsCommand };
}

export function acceptThemeDefaultsAck(state: ThemeDefaultsRecovery, value: unknown): { state: ThemeDefaultsRecovery; ack: SyncThemeDefaultsAck } {
  if (!state.pending) throw new Error("Er is geen bewaarde opdracht om te bevestigen.");
  const ack = parseSyncThemeDefaultsAck(value, state.pending);
  if (!ack) throw new Error("Het ontvangstbewijs past niet bij de bewaarde opdracht.");
  return { ack, state: { ...state, revision: ack.revision, configured: true, baseline: ack.defaults, draft: ack.defaults, pending: null, conflict: false } };
}

export function rejectThemeDefaultsSave(state: ThemeDefaultsRecovery, code: string, uncertain: boolean, replaying: boolean): ThemeDefaultsRecovery {
  if (uncertain || replaying) return state;
  return { ...state, pending: null, conflict: code === "conflict" };
}

/** An explicit user choice; never rebase an uncertain command or lose local input. */
export function reconcileThemeDefaults(state: ThemeDefaultsRecovery, profile: SyncThemeDefaultsProfile, keepDraft: boolean): ThemeDefaultsRecovery {
  if (state.pending) throw new Error("Bevestig eerst de oorspronkelijke opdracht.");
  if (profile.revision < state.revision) throw new Error("De opgehaalde versie is ouder dan het bevestigde concept.");
  const current = newThemeDefaultsRecovery(state, profile);
  return keepDraft ? { ...current, draft: state.draft } : current;
}
