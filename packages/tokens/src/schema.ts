export type VeyoCastThemeTokens = {
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  border: string;
  borderStrong: string;
  focus: string;
  action: string;
  onAction: string;
};

export type VeyoCastDesignTokens = {
  $schema?: string;
  meta: {
    name: string;
    version: string;
    status: string;
  };
  color: {
    brand: Record<string, string>;
    neutral: Record<string, string>;
    semantic: Record<string, Record<string, string>>;
    theme: {
      light: VeyoCastThemeTokens;
      dark: VeyoCastThemeTokens;
    };
  };
  font: {
    display: string;
    ui: string;
    mono: string;
  };
  spacingPx: number[];
  radiiPx: Record<string, number>;
  motionMs: Record<string, number>;
  breakpointsPx: Record<string, number>;
  zIndex: Record<string, number>;
  componentHeightPx: Record<string, Record<string, number> | number>;
};

export type VeyoCastVectorThemeTokens = {
  canvas: string;
  surface: string;
  surfaceRaised: string;
  surfaceMuted: string;
  surfaceStrong: string;
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  line: string;
  lineStrong: string;
  focus: string;
};

export type VeyoCastVectorTokens = {
  $schema?: string;
  meta: { name: string; version: string; rule: string };
  brand: Record<string, string>;
  themes: { light: VeyoCastVectorThemeTokens; dark: VeyoCastVectorThemeTokens };
  semantic: Record<string, Record<string, string>>;
  tenantAccent: { rule: string; fallback: string };
  typography: {
    uiFamily: string;
    displayFamily: string;
    monoFamily: string;
    weights: Record<string, number>;
    sizesPx: Record<string, number>;
    lineHeights: Record<string, number>;
    rules: string[];
  };
  spacingPx: number[];
  radiiPx: Record<string, number>;
  bordersPx: Record<string, number>;
  elevation: Record<string, string>;
  motion: {
    durationsMs: Record<string, number>;
    easing: Record<string, number[]>;
    reducedMotion: string;
  };
  touch: Record<string, number>;
  layout: Record<string, number>;
  zIndex: Record<string, number>;
};
