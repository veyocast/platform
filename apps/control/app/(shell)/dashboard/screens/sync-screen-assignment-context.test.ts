import { describe, expect, it } from "vitest";
import { parseScreenAssignmentContext, resolveScreenAssignmentContext, screenAssignmentReviewHref, withScreenAssignmentContext } from "./sync-screen-assignment-context";

const id = (n: number) => `24300000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const state = (n: number, status = "active", preflight = "ready") => ({ screen: { id: id(n), status }, preflight: { status: preflight } });
const resolve = (value: unknown) => resolveScreenAssignmentContext(parseScreenAssignmentContext(value), [state(1), state(2, "disabled"), state(3, "active", "blocked"), state(4, "active", "warning"), state(5, "active", "unknown")]);
describe("bounded screen context never supplies an alternate destination", () => {
  it("distinguishes absent guidance from explicit empty, repeated, malformed and file input", () => {
    expect(parseScreenAssignmentContext(undefined)).toEqual({ requested: false, ids: [], invalid: false });
    for (const value of ["", [id(1)], [id(1), id(4)], "not-a-screen", `${id(1)},`, `${id(1)}&screens=${id(4)}`, new Blob([id(1)])]) {
      expect(resolve(value)).toMatchObject({ requested: true, invalid: true, rejected: true, ids: [] });
    }
  });
  it("bounds input before dedupe, including more than 100 copies of one valid destination", () => {
    expect(resolve(Array(101).fill(id(1)).join(","))).toMatchObject({ invalid: true, ids: [] });
    expect(resolve("x".repeat(3_700))).toMatchObject({ invalid: true, ids: [] });
    expect(resolve(Array(100).fill(id(1)).join(","))).toMatchObject({ invalid: false, ids: [id(1)] });
  });
  it("normalizes duplicate UUIDs without changing their explicit order", () => {
    expect(parseScreenAssignmentContext(`${id(4)},${id(1).toUpperCase()},${id(4)}`).ids).toEqual([id(4), id(1)]);
  });
  it.each([id(2), id(3), id(99)])("never replaces unavailable or foreign target %s with a valid default", value => {
    expect(resolve(value)).toMatchObject({ requested: true, rejected: true, ids: [] });
  });
  it("intersects only explicitly requested tenant targets and leaves risk review required", () => {
    expect(resolve(`${id(99)},${id(4)},${id(5)},${id(2)}`)).toMatchObject({ rejected: true, ids: [id(4), id(5)] });
    expect(resolve(undefined).ids).toEqual([]);
  });
  it("builds a bounded existing immutable-review link rather than an arbitrary return URL", () => {
    expect(screenAssignmentReviewHref(id(8), id(1))).toBe(`/dashboard/publications/${id(8)}?screens=${id(1)}#opnieuw-toewijzen`);
    expect(screenAssignmentReviewHref("https://attacker.invalid", id(1))).toBeNull();
    expect(screenAssignmentReviewHref(id(8), `${id(1)}#other`)).toBeNull();
  });
  it("retains an explicit empty retry context while keeping ordinary no-context redirects identical", () => {
    const href = `/dashboard/publications/${id(8)}?fout=Bevestig`;
    expect(withScreenAssignmentContext(href, parseScreenAssignmentContext(undefined))).toBe(href);
    expect(withScreenAssignmentContext(href, parseScreenAssignmentContext("invalid"))).toBe(`${href}&screens=#opnieuw-toewijzen`);
    expect(withScreenAssignmentContext(href, resolve(id(99)))).toBe(`${href}&screens=#opnieuw-toewijzen`);
  });
});
