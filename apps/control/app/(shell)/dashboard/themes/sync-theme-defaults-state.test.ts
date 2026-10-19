import { describe, expect, it } from "vitest";
import type { SyncThemeDefaultsProfile } from "@veyocast/contracts";
import {
  acceptThemeDefaultsAck, newThemeDefaultsRecovery, parseThemeDefaultsRecovery, prepareThemeDefaultsSave,
  reconcileThemeDefaults, rejectThemeDefaultsSave, themeDefaultsDirty, themeDefaultsJournalKey,
  type ThemeDefaultsScope,
} from "./sync-theme-defaults-state";

const tenantId = "23500000-0000-4000-8000-000000000001";
const scope: ThemeDefaultsScope = { tenantId, actorScope: `${tenantId}:23500000-0000-4000-8000-000000000002`, themeId: "fieldflow" };
const nonce = "23500000-0000-4000-8000-000000000003";
const empty: SyncThemeDefaultsProfile = { themeId: "fieldflow", themeVersion: "1.0.0", revision: 0, configured: false, defaults: null };
const state = () => newThemeDefaultsRecovery(scope, empty);
const edited = () => { const value = state(); return { ...value, draft: { ...value.draft, accent: "#Ab12Cd", font: "Georgia" as const, mode: "dark" as const, scale: 118, background: "stadium" as const, motion: "dynamisch" as const, showLogo: false } }; };

describe("Source theme creation recovery", () => {
  it("constructs only recovery fields when a component supplies additional display props", () => {
    const props = { ...scope, tenantName: "Eigen club", themeName: "FieldFlow", canWrite: true, profile: empty };
    const recovery = newThemeDefaultsRecovery(props, empty);
    expect(() => parseThemeDefaultsRecovery(JSON.stringify(recovery), scope)).not.toThrow();
    expect(recovery).not.toHaveProperty("profile"); expect(recovery).not.toHaveProperty("tenantName");
  });
  it("keeps unconfigured actual Source values separate from a saved profile", () => {
    const value = state();
    expect(value).toMatchObject({ revision: 0, configured: false, pending: null, conflict: false });
    expect(value.draft).toEqual({ accent: "#006D83", font: "Manrope", mode: "light", scale: 100, background: "clubkleur", motion: "rustig", showLogo: true });
    expect(themeDefaultsDirty(value)).toBe(false);
    expect(newThemeDefaultsRecovery({ ...scope, themeId: "onzetrots-tv" }, { ...empty, themeId: "onzetrots-tv", themeVersion: "11.0.0" }).draft.accent).toBe("#1268e8");
  });
  it("durably round-trips all seven fields and replays the precise first JSON command", () => {
    const prepared = prepareThemeDefaultsSave(edited(), nonce), wire = JSON.stringify(prepared.pending);
    expect(Object.keys(prepared.pending!)).toEqual(["tenantId", "themeId", "expectedRevision", "defaults", "idempotencyKey"]);
    const recovered = parseThemeDefaultsRecovery(JSON.stringify(prepared), scope);
    expect(prepareThemeDefaultsSave(recovered, "23500000-0000-4000-8000-000000000004")).toBe(recovered);
    expect(JSON.stringify(recovered.pending)).toBe(wire);
    expect(recovered.draft.accent).toBe("#Ab12Cd");
    expect(wire).not.toMatch(/appearance|rollout|themeVersion|https?:/);
  });
  it("keeps an unknown command through temporary known rejections without rotating its nonce", () => {
    const pending = prepareThemeDefaultsSave(edited(), nonce);
    expect(rejectThemeDefaultsSave(pending, "unavailable", true, false)).toBe(pending);
    for (const code of ["denied", "invalid", "conflict", "unavailable"]) expect(rejectThemeDefaultsSave(pending, code, false, true)).toBe(pending);
    const final = acceptThemeDefaultsAck(pending, { schemaVersion: 1, outcome: "applied", tenantId, themeId: scope.themeId, revision: 1, defaults: pending.draft });
    expect(final.state.pending).toBeNull(); expect(final.state.configured).toBe(true); expect(themeDefaultsDirty(final.state)).toBe(false);
  });
  it("preserves input on a definite first-attempt CAS conflict and requires an explicit current-profile choice", () => {
    const pending = prepareThemeDefaultsSave(edited(), nonce), conflict = rejectThemeDefaultsSave(pending, "conflict", false, false);
    expect(conflict.pending).toBeNull(); expect(conflict.conflict).toBe(true); expect(conflict.draft).toEqual(pending.draft);
    expect(() => prepareThemeDefaultsSave(conflict, nonce)).toThrow(/Vergelijk/);
    const profile = { ...empty, configured: true, revision: 8, defaults: { ...state().draft, scale: 91 } };
    const keep = reconcileThemeDefaults(conflict, profile, true), useCurrent = reconcileThemeDefaults(conflict, profile, false);
    expect(keep.revision).toBe(8); expect(keep.draft).toEqual(conflict.draft); expect(themeDefaultsDirty(keep)).toBe(true);
    expect(useCurrent.draft.scale).toBe(91); expect(themeDefaultsDirty(useCurrent)).toBe(false);
    expect(prepareThemeDefaultsSave(keep, nonce).pending?.expectedRevision).toBe(8);
    expect(() => reconcileThemeDefaults(pending, profile, true)).toThrow(/oorspronkelijke/);
  });
  it("accepts a bound noop without inventing a revision increment", () => {
    const profile = { ...empty, configured: true, revision: 7, defaults: edited().draft };
    const pending = prepareThemeDefaultsSave(newThemeDefaultsRecovery(scope, profile), nonce);
    expect(acceptThemeDefaultsAck(pending, { schemaVersion: 1, outcome: "noop", tenantId, themeId: scope.themeId, revision: 7, defaults: pending.draft }).state.revision).toBe(7);
  });
  it.each([
    { actorScope: `${tenantId}:other-actor` }, { tenantId: "23500000-0000-4000-8000-000000000009" }, { themeId: "onzetrots-tv" as const },
  ])("rejects a journal outside the live scope %j", change => {
    const other = { ...scope, ...change };
    expect(themeDefaultsJournalKey(other)).not.toBe(themeDefaultsJournalKey(scope));
    expect(() => parseThemeDefaultsRecovery(JSON.stringify(prepareThemeDefaultsSave(edited(), nonce)), other)).toThrow();
  });
  it.each(["tenant", "theme", "revision", "payload", "unknown"])("refuses mismatched %s ACK and retains the original pending state", mismatch => {
    const pending = prepareThemeDefaultsSave(edited(), nonce), before = JSON.stringify(pending);
    const ack = { schemaVersion: 1, outcome: "applied", tenantId, themeId: scope.themeId, revision: 1, defaults: pending.draft };
    const wrong = mismatch === "tenant" ? { ...ack, tenantId: "23500000-0000-4000-8000-000000000009" }
      : mismatch === "theme" ? { ...ack, themeId: "onzetrots-tv" } : mismatch === "revision" ? { ...ack, revision: 9 }
      : mismatch === "payload" ? { ...ack, defaults: { ...ack.defaults, scale: 90 } } : { ...ack, extra: true };
    expect(() => acceptThemeDefaultsAck(pending, wrong)).toThrow(); expect(JSON.stringify(pending)).toBe(before);
  });
  it("refuses malformed/oversized journals and a changed pending body instead of overwriting them", () => {
    const pending = prepareThemeDefaultsSave(edited(), nonce);
    expect(() => parseThemeDefaultsRecovery("not JSON", scope)).toThrow();
    expect(() => parseThemeDefaultsRecovery(" ".repeat(16_385), scope)).toThrow();
    expect(() => parseThemeDefaultsRecovery(JSON.stringify({ ...pending, unexpected: true }), scope)).toThrow();
    expect(() => parseThemeDefaultsRecovery(JSON.stringify({ ...state(), revision: 2 }), scope)).toThrow();
    expect(() => parseThemeDefaultsRecovery(JSON.stringify({ ...pending, pending: { ...pending.pending, defaults: state().draft } }), scope)).toThrow();
  });
});
