import { describe, expect, it } from "vitest";
import { parseSyncThemeDefaultsAck, syncThemeCreationDefaultsSchema, syncThemeDefaultsCommandSchema,
  syncThemeDefaultsReadModelSchema, type SyncThemeDefaultsCommand } from "../src/sync-theme-creation-defaults";

const tenant = "23500000-0000-4000-8000-000000000001";
const defaults = { accent: "#aBc123", font: "Manrope", mode: "light", scale: 100, background: "clubkleur", motion: "rustig", showLogo: true } as const;
const command = (): SyncThemeDefaultsCommand => ({ tenantId: tenant, themeId: "fieldflow", expectedRevision: 0, defaults: { ...defaults }, idempotencyKey: "23500000-0000-4000-8000-000000000002" });
const read = () => ({ schemaVersion: 1, tenantId: tenant, defaultThemeId: "fieldflow", profiles: [
  { themeId: "fieldflow", themeVersion: "1.0.0", configured: false, revision: 0, defaults: null },
  { themeId: "onzetrots-tv", themeVersion: "11.0.0", configured: true, revision: 8, defaults: { ...defaults } },
] });
describe("strict independent Source creation defaults", () => {
  it("preserves case, every value and the complete JSON-storable command", () => {
    const value = command(); expect(syncThemeDefaultsCommandSchema.parse(value)).toStrictEqual(value);
    expect(syncThemeDefaultsCommandSchema.parse(value)).toStrictEqual(JSON.parse(JSON.stringify(value)));
  });
  it.each([
    null, { ...defaults, schemaVersion: 1 }, { ...defaults, url: "https://private.invalid" },
    { ...defaults, accent: "red" }, { ...defaults, font: "Brush" }, { ...defaults, font: "Georgia,serif" },
    { ...defaults, mode: "system" }, { ...defaults, scale: 89 }, { ...defaults, scale: 121 },
    { ...defaults, scale: 100.5 }, { ...defaults, scale: Infinity }, { ...defaults, scale: "100" },
    { ...defaults, showLogo: null }, { ...defaults, showLogo: "true" }, { ...defaults, background: "photo" },
    { ...defaults, motion: "animated" }, Object.fromEntries(Object.entries(defaults).filter(([key]) => key !== "font")),
  ])("rejects unknown, missing or invalid fields %j", value => expect(syncThemeCreationDefaultsSchema.safeParse(value).success).toBe(false));
  it.each([{ expectedRevision: -1 }, { expectedRevision: 1.5 }, { expectedRevision: Number.MAX_SAFE_INTEGER + 1 }, { themeId: "onzetrots" }, { tenantId: "bad" }, { idempotencyKey: "bad" }, { extra: true }])("rejects a malformed command %j", change => {
    expect(syncThemeDefaultsCommandSchema.safeParse({ ...command(), ...change }).success).toBe(false);
  });
  it("accepts exactly two correctly identified nullable profiles", () => {
    expect(syncThemeDefaultsReadModelSchema.parse(read())).toEqual(read());
    expect(syncThemeDefaultsReadModelSchema.safeParse({ ...read(), defaultThemeId: null }).success).toBe(true);
  });
  it.each(["duplicate", "missing", "wrong-version", "null-configured", "value-unconfigured", "zero-configured", "extra", "unsafe"])("rejects corrupt read profile: %s", reason => {
    const value = read();
    if (reason === "duplicate") value.profiles[1] = { ...value.profiles[0]! };
    if (reason === "missing") value.profiles.pop();
    if (reason === "wrong-version") value.profiles[1]!.themeVersion = "1.0.0";
    if (reason === "null-configured") value.profiles[0]!.configured = true;
    if (reason === "value-unconfigured") value.profiles[1]!.configured = false;
    if (reason === "zero-configured") value.profiles[1]!.revision = 0;
    if (reason === "extra") Object.assign(value, { palette: {} });
    if (reason === "unsafe") value.profiles[1]!.revision = Number.MAX_SAFE_INTEGER + 1;
    expect(syncThemeDefaultsReadModelSchema.safeParse(value).success).toBe(false);
  });
  it.each(["tenant", "theme", "revision", "payload", "extra", "outcome", "version"])("does not accept a mismatched receipt: %s", reason => {
    const cmd = command(), ack = { schemaVersion: 1, outcome: "applied", tenantId: tenant, themeId: "fieldflow", revision: 1, defaults: { ...defaults } };
    if (reason === "tenant") ack.tenantId = "23500000-0000-4000-8000-000000000003";
    if (reason === "theme") ack.themeId = "onzetrots-tv";
    if (reason === "revision") ack.revision = 2;
    if (reason === "payload") Object.assign(ack.defaults, { accent: "#ABC123" });
    if (reason === "extra") Object.assign(ack, { rolloutId: tenant });
    if (reason === "outcome") ack.outcome = "created";
    if (reason === "version") ack.schemaVersion = 2;
    expect(parseSyncThemeDefaultsAck(ack, cmd)).toBeNull();
  });
  it("binds applied/noop and allows a noop at the maximum safe revision", () => {
    const cmd = command(), ack = { schemaVersion: 1, outcome: "applied", tenantId: tenant, themeId: cmd.themeId, revision: 1, defaults: cmd.defaults };
    expect(parseSyncThemeDefaultsAck(ack, cmd)).toEqual(ack);
    expect(parseSyncThemeDefaultsAck({ ...ack, outcome: "noop", revision: 0 }, cmd)).toBeNull();
    cmd.expectedRevision = Number.MAX_SAFE_INTEGER;
    expect(parseSyncThemeDefaultsAck({ ...ack, outcome: "noop", revision: Number.MAX_SAFE_INTEGER }, cmd)?.outcome).toBe("noop");
    expect(parseSyncThemeDefaultsAck({ ...ack, revision: Number.MAX_SAFE_INTEGER + 1 }, cmd)).toBeNull();
    expect(cmd.defaults.accent).toBe("#aBc123");
  });
});
