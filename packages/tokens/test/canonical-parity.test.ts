import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { VeyoCastDesignTokens } from "../src/schema";

type CanonicalValue<T = string | number> = {
  value: T;
};

type CanonicalTheme = {
  action: CanonicalValue<string>;
  bg: CanonicalValue<string>;
  border: CanonicalValue<string>;
  borderStrong: CanonicalValue<string>;
  focus: CanonicalValue<string>;
  onAction: CanonicalValue<string>;
  surface: CanonicalValue<string>;
  surfaceMuted: CanonicalValue<string>;
  surfaceStrong: CanonicalValue<string>;
  text: CanonicalValue<string>;
  textMuted: CanonicalValue<string>;
  textSubtle: CanonicalValue<string>;
};

type CanonicalTokens = {
  breakpoint: Record<string, CanonicalValue<number>>;
  color: {
    brand: {
      blue: CanonicalValue<string>;
      ink: CanonicalValue<string>;
      orange: CanonicalValue<string>;
      paper: CanonicalValue<string>;
      softGrey: CanonicalValue<string>;
    };
    neutral: Record<string, CanonicalValue<string>>;
    semantic: Record<string, Record<string, CanonicalValue<string>>>;
  };
  container: {
    dashboardSidebar: CanonicalValue<number>;
    dashboardSidebarCollapsed: CanonicalValue<number>;
    dashboardTopbar: CanonicalValue<number>;
  };
  motion: {
    duration: Record<string, CanonicalValue<number>>;
  };
  space: Record<string, CanonicalValue<number>>;
  theme: {
    dark: CanonicalTheme;
    light: CanonicalTheme;
  };
  zIndex: Record<string, CanonicalValue<number>>;
};

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "../../..");

async function readJson<T>(path: string) {
  return JSON.parse(await readFile(resolve(repoRoot, path), "utf8")) as T;
}

describe("VeyoCast canonical design token projection", () => {
  it("keeps runtime semantic values aligned with canon v2.0.0", async () => {
    const [runtime, canonical] = await Promise.all([
      readJson<VeyoCastDesignTokens>("tokens/veyocast-design-tokens.json"),
      readJson<CanonicalTokens>("docs/design-canon/v1/veyocast-design-tokens.json")
    ]);

    expect(runtime.meta.status).toBe("canonical-runtime-projection");
    expect(runtime.color.brand).toMatchObject({
      electricOrange: canonical.color.brand.orange.value,
      inkBlack: canonical.color.brand.ink.value,
      paperWhite: canonical.color.brand.paper.value,
      signalBlue: canonical.color.brand.blue.value,
      softGrey: canonical.color.brand.softGrey.value
    });

    expect(runtime.color.neutral).toEqual(
      Object.fromEntries(
        Object.entries(canonical.color.neutral).map(([key, token]) => [key, token.value])
      )
    );

    for (const [tone, tokens] of Object.entries(canonical.color.semantic)) {
      expect(runtime.color.semantic[tone]).toEqual(
        Object.fromEntries(
          Object.entries(tokens).map(([key, token]) => [key, token.value])
        )
      );
    }

    expect(runtime.color.theme.light).toMatchObject({
      action: canonical.theme.light.action.value,
      background: canonical.theme.light.bg.value,
      border: canonical.theme.light.border.value,
      borderStrong: canonical.theme.light.borderStrong.value,
      focus: canonical.theme.light.focus.value,
      onAction: canonical.theme.light.onAction.value,
      surface: canonical.theme.light.surface.value,
      surfaceMuted: canonical.theme.light.surfaceMuted.value,
      surfaceStrong: canonical.theme.light.surfaceStrong.value,
      text: canonical.theme.light.text.value,
      textMuted: canonical.theme.light.textMuted.value,
      textSubtle: canonical.theme.light.textSubtle.value
    });
    expect(runtime.color.theme.dark).toMatchObject({
      action: canonical.theme.dark.action.value,
      background: canonical.theme.dark.bg.value,
      border: canonical.theme.dark.border.value,
      borderStrong: canonical.theme.dark.borderStrong.value,
      focus: canonical.theme.dark.focus.value,
      onAction: canonical.theme.dark.onAction.value,
      surface: canonical.theme.dark.surface.value,
      surfaceMuted: canonical.theme.dark.surfaceMuted.value,
      surfaceStrong: canonical.theme.dark.surfaceStrong.value,
      text: canonical.theme.dark.text.value,
      textMuted: canonical.theme.dark.textMuted.value,
      textSubtle: canonical.theme.dark.textSubtle.value
    });

    expect(runtime.spacingPx).toEqual(
      Object.entries(canonical.space)
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([, token]) => token.value)
    );
    expect(runtime.motionMs).toEqual(
      Object.fromEntries(
        Object.entries(canonical.motion.duration).map(([key, token]) => [key, token.value])
      )
    );
    expect(runtime.breakpointsPx).toEqual(
      Object.fromEntries(
        Object.entries(canonical.breakpoint).map(([key, token]) => [key, token.value])
      )
    );
    expect(runtime.zIndex).toEqual(
      Object.fromEntries(
        Object.entries(canonical.zIndex).map(([key, token]) => [key, token.value])
      )
    );
    expect(runtime.componentHeightPx).toMatchObject({
      sidebarCollapsed: canonical.container.dashboardSidebarCollapsed.value,
      sidebarExpanded: canonical.container.dashboardSidebar.value,
      topbar: canonical.container.dashboardTopbar.value
    });
  });
});
