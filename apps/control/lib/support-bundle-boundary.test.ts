import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("support bundle server boundary", () => {
  it("uses POST, tenant capability, allowlisted reads and audit-before-response", async () => {
    const source = await readFile(
      new URL("../app/api/support-bundle/route.ts", import.meta.url),
      "utf8"
    );
    expect(source).toContain("export async function POST()");
    expect(source).not.toContain("export async function GET()");
    expect(source).toContain('hasCapability(session.capabilities, "tenant.support.export")');
    expect(source).toContain('.select("action, created_at, result")');
    expect(source).toContain('.select("id")');
    expect(source).not.toMatch(/SUPABASE_SERVICE_ROLE|serviceRole/i);
    expect(source.indexOf('.from("audit_events").insert')).toBeGreaterThan(0);
    expect(source.indexOf('.from("audit_events").insert')).toBeLessThan(
      source.indexOf("return new NextResponse")
    );
  });
});
