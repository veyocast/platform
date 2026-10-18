import { beforeEach, describe, expect, it, vi } from "vitest";
const userId = "10000000-0000-4000-8000-000000000227";
const factorId = "20000000-0000-4000-8000-000000000227";
const state = vi.hoisted(() => ({
  actor: "", level: "aal1", factors: [] as Array<{ id: string; factor_type: string; status: string; friendly_name: string }>,
  getSession: vi.fn(), listFactors: vi.fn(), assurance: vi.fn(), enroll: vi.fn(), challenge: vi.fn(), verify: vi.fn(), unenroll: vi.fn(),
}));
vi.mock("./supabase", () => ({ mobileSupabase: { auth: { getSession: state.getSession, mfa: { listFactors: state.listFactors, getAuthenticatorAssuranceLevel: state.assurance, enroll: state.enroll, challenge: state.challenge, verify: state.verify, unenroll: state.unenroll } } } }));
import { beginNativeTotpSetup, nativeTotpQrSvg, readNativeMfa, removeUnverifiedNativeTotp, verifyNativeTotp } from "./mfa";
import { nativeMfaReturnPath } from "./mfa-navigation";
import { runNativeSessionOperation } from "./session-operations";
const factor = (status = "verified") => ({ id: factorId, factor_type: "totp", status, friendly_name: "Mijn authenticator" });
beforeEach(() => {
  state.actor = userId; state.level = "aal1"; state.factors = [];
  for (const method of [state.getSession, state.listFactors, state.assurance, state.enroll, state.challenge, state.verify, state.unenroll]) method.mockReset();
  state.getSession.mockImplementation(async () => ({ data: { session: { user: { id: state.actor }, access_token: "test-only-current-token" } }, error: null }));
  state.listFactors.mockImplementation(async () => ({ data: { all: state.factors, totp: state.factors.filter(item => item.factor_type === "totp" && item.status === "verified") }, error: null }));
  state.assurance.mockImplementation(async () => ({ data: { currentLevel: state.level, nextLevel: state.factors.length ? "aal2" : "aal1" }, error: null }));
  state.enroll.mockResolvedValue({ data: { id: factorId, type: "totp", totp: { secret: "TESTONLYBASEKEYAB", qr_code: "data:image/svg+xml;utf-8,<svg><path d='M0 0'/></svg>" } }, error: null });
  state.challenge.mockResolvedValue({ data: { id: "current-challenge" }, error: null });
  state.verify.mockImplementation(async () => { state.level = "aal2"; state.factors = [factor()]; return { data: {}, error: null }; });
  state.unenroll.mockImplementation(async () => { state.factors = []; return { data: { id: factorId }, error: null }; });
});
describe("native real-SDK MFA boundary", () => {
  it("reads assurance using the actual current token and never auto-enrolls", async () => {
    state.factors = [factor(), { ...factor("unverified"), id: "unfinished" }];
    expect(await readNativeMfa(userId)).toMatchObject({ currentLevel: "aal1", verified: [{ id: factorId }], unverified: [{ id: "unfinished" }] });
    expect(state.assurance).toHaveBeenCalledWith("test-only-current-token");
    expect(state.enroll).not.toHaveBeenCalled();
  });
  it("enrolls only on the explicit command and leaves assurance at AAL1 until verification", async () => {
    const result = await beginNativeTotpSetup(userId);
    expect(result.factorId).toBe(factorId);
    expect(result.qrSvg).toBe("<svg><path d='M0 0'/></svg>");
    expect(state.enroll).toHaveBeenCalledWith({ factorType: "totp", friendlyName: "VeyoCast Control", issuer: "VeyoCast" });
    expect(state.verify).not.toHaveBeenCalled();
    expect(state.level).toBe("aal1");
  });
  it.each(["verified", "unverified"])("does not create another factor over an existing %s TOTP factor", async status => {
    state.factors = [factor(status)];
    await expect(beginNativeTotpSetup(userId)).rejects.toThrow();
    expect(state.enroll).not.toHaveBeenCalled();
  });
  it("refuses an account switch during status lookup before creating a factor", async () => {
    state.listFactors.mockImplementationOnce(async () => { state.actor = "another-account"; return { data: { all: [], totp: [] }, error: null }; });
    await expect(beginNativeTotpSetup(userId)).rejects.toThrow("account of sessie");
    expect(state.enroll).not.toHaveBeenCalled();
  });
  it("uses the current challenge, verifies the supplied code and requires the resulting server-backed AAL2", async () => {
    state.factors = [factor()];
    expect(await verifyNativeTotp(userId, factorId, "123456")).toMatchObject({ currentLevel: "aal2" });
    expect(state.challenge).toHaveBeenCalledWith({ factorId });
    expect(state.verify).toHaveBeenCalledWith({ factorId, challengeId: "current-challenge", code: "123456" });
    expect(state.assurance).toHaveBeenCalledTimes(2);
  });
  it("does not send malformed codes or challenges for a foreign factor", async () => {
    state.factors = [factor()];
    await expect(verifyNativeTotp(userId, factorId, "12x456")).rejects.toThrow("zes cijfers");
    await expect(verifyNativeTotp(userId, "foreign-factor", "123456")).rejects.toThrow("accountstatus");
    expect(state.challenge).not.toHaveBeenCalled();
  });
  it("does not claim success for an invalid code or an SDK result that leaves the session at AAL1", async () => {
    state.factors = [factor()];
    state.verify.mockResolvedValueOnce({ data: null, error: { status: 400, message: "PRIVATE_AUTH_VALUE" } });
    await expect(verifyNativeTotp(userId, factorId, "123456")).rejects.toThrow("ongeldig of verlopen");
    state.verify.mockResolvedValueOnce({ data: {}, error: null });
    await expect(verifyNativeTotp(userId, factorId, "123456")).rejects.toThrow("nog niet vastgesteld");
  });
  it("never deletes a verified authenticator and rechecks an unfinished factor before deletion", async () => {
    state.factors = [factor()];
    await expect(removeUnverifiedNativeTotp(userId, factorId)).rejects.toThrow("onafgeronde");
    expect(state.unenroll).not.toHaveBeenCalled();
    state.factors = [factor("unverified")];
    expect(await removeUnverifiedNativeTotp(userId, factorId)).toMatchObject({ unverified: [] });
    expect(state.unenroll).toHaveBeenCalledWith({ factorId });
  });
  it("keeps an account-changing UI operation behind the in-flight MFA operation", async () => {
    let release!: () => void; let began!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { began = resolve; });
    state.enroll.mockImplementationOnce(async () => { began(); await gate; return { data: { id: factorId, type: "totp", totp: { secret: "TESTONLYBASEKEYAB", qr_code: "<svg></svg>" } }, error: null }; });
    const setup = beginNativeTotpSetup(userId);
    await started;
    const changed = vi.fn(async () => { state.actor = "another-account"; });
    const account = runNativeSessionOperation(changed);
    expect(changed).not.toHaveBeenCalled();
    release();
    await expect(setup).resolves.toMatchObject({ factorId });
    await account;
    expect(changed).toHaveBeenCalledOnce();
  });
  it("rejects external QR references and unsafe return destinations", () => {
    expect(nativeTotpQrSvg('<svg><image href="https://example.test"/></svg>')).toBeNull();
    expect(nativeTotpQrSvg('<svg onload="bad()"></svg>')).toBeNull();
    expect(nativeMfaReturnPath("https://example.test")).toBe("/(tabs)/vandaag");
    expect(nativeMfaReturnPath("//example.test")).toBe("/(tabs)/vandaag");
    expect(nativeMfaReturnPath(`/studio/designs/${factorId}`)).toBe(`/studio/designs/${factorId}`);
  });
});
