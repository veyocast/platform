export type CastivoThemeTokens = {
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

export type CastivoDesignTokens = {
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
      light: CastivoThemeTokens;
      dark: CastivoThemeTokens;
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
