import { describe, expect, it } from "vitest";
import { fitSitesUnifiedViewport } from "../src/sites-unified-v17";

const viewports = [[320,568],[390,844],[768,1024],[1080,1920],[1280,720],[1920,1080],[2160,3840],[3840,2160]] as const;

describe("Sites v17 viewport fitting", () => {
  for (const orientation of ["landscape", "portrait"] as const) {
    it(`contains every ${orientation} canvas without cropping`, () => {
      const nativeWidth = orientation === "portrait" ? 1080 : 1920;
      const nativeHeight = orientation === "portrait" ? 1920 : 1080;
      for (const [containerWidth, containerHeight] of viewports) {
        const width = fitSitesUnifiedViewport(containerWidth, containerHeight, orientation);
        const height = width * nativeHeight / nativeWidth;
        expect(width).toBeLessThanOrEqual(containerWidth + 0.0001);
        expect(height).toBeLessThanOrEqual(containerHeight + 0.0001);
        expect(width / height).toBeCloseTo(nativeWidth / nativeHeight, 8);
      }
    });
  }

  it("uses available width when a host has not measured height yet", () => {
    expect(fitSitesUnifiedViewport(390, 0, "portrait")).toBe(390);
  });
});
