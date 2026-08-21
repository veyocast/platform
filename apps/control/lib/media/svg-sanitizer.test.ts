import { describe, expect, it } from "vitest";

import {
  isTintableSvgBytes,
  sanitizeSvgBytes,
  SvgSanitizationError
} from "./svg-sanitizer";

describe("SVG upload sanitization", () => {
  it("behoudt lokale vectorvormen en verwijdert niet-renderende metadata", () => {
    const sanitized = new TextDecoder().decode(sanitizeSvgBytes(new TextEncoder().encode(
      '<svg viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg"><!-- note --><metadata>editor</metadata><path d="M0 0h10v10z" fill="currentColor"/></svg>'
    )));
    expect(sanitized).toContain("<path");
    expect(sanitized).not.toContain("metadata");
    expect(sanitized).not.toContain("<!--");
  });

  it("markeert alleen statische éénkleurige vectoren als tintable", () => {
    const oneColor = sanitizeSvgBytes(new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#112233" d="M0 0h10v10z"/><circle fill="#112233" r="2"/></svg>'
    ));
    const multipleColors = sanitizeSvgBytes(new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#112233" d="M0 0h10v10z"/><circle fill="#FFFFFF" r="2"/></svg>'
    ));
    expect(isTintableSvgBytes(oneColor)).toBe(true);
    expect(isTintableSvgBytes(multipleColors)).toBe(false);
  });

  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.test/a.png"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://evil.test)</style></svg>',
    '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg></svg>'
  ])("weigert actieve, externe of entiteitsinhoud", (source) => {
    expect(() => sanitizeSvgBytes(new TextEncoder().encode(source))).toThrowError(
      SvgSanitizationError
    );
  });

  it("weigert ongeldige UTF-8 en onafgesloten SVG", () => {
    expect(() => sanitizeSvgBytes(Uint8Array.from([0xff, 0xfe]))).toThrowError(
      expect.objectContaining({ code: "invalid-encoding" })
    );
    expect(() => sanitizeSvgBytes(new TextEncoder().encode("<svg>"))).toThrowError(
      expect.objectContaining({ code: "invalid-structure" })
    );
  });
});
