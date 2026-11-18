import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SitesSourceDesignControls } from "./sportlink/new/sites-source-design-controls";
import { createSitesSourceDesign } from "./sportlink/new/sites-source-design";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

describe("registered themes stay separate from tenant Media", () => {
  for (const provider of ["sportlink", "menu", "led-scores"] as const) {
    for (const orientation of ["landscape", "portrait"] as const) it(`${provider}/${orientation}: uploads cannot become theme options or implicit backgrounds`, () => {
      const design = createSitesSourceDesign(provider, "Eigen ontwerp", orientation);
      const before = JSON.stringify(design);
      const existing = { id: "31600000-0000-4000-8000-000000000001", name: "Bestaande foto", checksumSha256: "a".repeat(64), url: "https://media.invalid/existing.webp" };
      const uploaded = { id: "31600000-0000-4000-8000-000000000002", name: "Nieuw sponsorlogo", checksumSha256: "b".repeat(64), url: "https://media.invalid/logo.webp" };
      const changes: unknown[] = [];
      const render = (media: typeof existing[]) => renderToStaticMarkup(<SitesSourceDesignControls design={design} media={media} onChange={patch => changes.push(patch)} />);
      const original = render([existing]);
      const after = render([uploaded, existing]);
      expect(after).toBe(original);
      expect(after).toContain("Schermthema"); expect(after).toContain("FieldFlow"); expect(after).toContain("OnzeTrots TV");
      expect(after).toContain("Kies uit Media");
      expect(after).not.toContain(existing.url); expect(after).not.toContain(uploaded.url); expect(after).not.toContain(uploaded.name);
      expect(JSON.stringify(design)).toBe(before); expect(changes).toEqual([]);
      const selected = { ...design, background: { kind: "tenant" as const, mediaAssetId: existing.id, checksumSha256: existing.checksumSha256 } };
      const selectedBefore = JSON.stringify(selected);
      const html = renderToStaticMarkup(<SitesSourceDesignControls design={selected} media={[uploaded, existing]} onChange={patch => changes.push(patch)} />);
      expect(html).toContain("Gekozen achtergrond:"); expect(html).toContain(existing.name);
      expect(JSON.stringify(selected)).toBe(selectedBefore); expect(changes).toEqual([]);
    });
  }
});
