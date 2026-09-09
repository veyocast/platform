/**
 * Setup, recovery and install surfaces have no tenant release authority yet.
 * They therefore identify the product-owned Royal/Navy fallback explicitly.
 */
export const playerSystemThemeAttributes = {
  "data-design-revision": "royal-current-v8",
  "data-theme-authority": "player-system",
  "data-theme-mode": "dark"
} as const;
