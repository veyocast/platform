import { describe, expect, it } from "vitest";
import { deriveScreenContactStatus, screenOnlineWindowMs, screenStaleWindowMs } from "../src/screen-contact-status";
const now = Date.parse("2026-11-09T12:00:00Z");
const derive = (age: number) => deriveScreenContactStatus({ screenStatus: "active", deviceStatus: "paired", lastSeenAt: new Date(now - age).toISOString() }, now);
describe("SCR-01/02 shared screen contact", () => {
  it.each([[0,"online"],[screenOnlineWindowMs-1,"online"],[screenOnlineWindowMs,"stale"],[screenOnlineWindowMs+1,"stale"],[screenStaleWindowMs-1,"stale"],[screenStaleWindowMs,"offline"],[screenStaleWindowMs+1,"offline"]] as const)("age %i is %s", (age, kind) => expect(derive(age).kind).toBe(kind));
  it.each([null,undefined,"invalid","2026-11-09T12:00:00.001Z"])("does not turn missing, malformed or future time %s into contact", lastSeenAt => {
    expect(deriveScreenContactStatus({ screenStatus: "active", deviceStatus: "paired", lastSeenAt }, now)).toMatchObject({ kind: "unknown", reachable: false, lastSeenAt: null });
  });
  it.each([["disabled",null,"disabled"],["maintenance",null,"maintenance"],["active",null,"unpaired"],["active","revoked","unpaired"]] as const)("management %s and pairing %s take priority", (screenStatus, deviceStatus, kind) => {
    expect(deriveScreenContactStatus({ screenStatus, deviceStatus, lastSeenAt: new Date(now).toISOString() }, now)).toMatchObject({kind,reachable:false});
  });
  it("accepts the epoch timestamp rather than treating zero as missing", () => expect(deriveScreenContactStatus({ screenStatus:"active",deviceStatus:"paired",lastSeenAt:"1970-01-01T00:00:00Z" }, now).kind).toBe("offline"));
});
