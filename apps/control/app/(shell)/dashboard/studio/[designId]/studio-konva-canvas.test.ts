import { describe, expect, it } from "vitest";

import { studioCanvasFontStyle } from "./studio-konva-canvas";

describe("Studio Konva-fontpariteit", () => {
  it("geeft alle gecureerde Roboto-gewichten afzonderlijk door aan Canvas", () => {
    const styles = ([400, 500, 700, 900] as const).map(
      studioCanvasFontStyle
    );

    expect(styles).toEqual(["400", "500", "700", "900"]);
    expect(new Set(styles).size).toBe(4);
  });
});
