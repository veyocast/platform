// Pure authoring input types shared by the editor and canonical widget compiler.
export type MenuStudioProductOption = {
  available: boolean;
  category: string;
  currency: string;
  description: string;
  id: string;
  name: string;
  priceCents: number;
  sourceId: string;
  sourceKind: "manual_products" | "twelve_excel";
  sourceRevision: string;
  taxMode: "inclusive" | "exclusive" | "not-applicable";
  taxRateBps?: number;
  unitKey?: string;
};

export type MenuStudioMediaOption = {
  assetVersion: string;
  id: string;
  kind: "animation" | "image" | "logo" | "video";
  mimeType: string;
  name: string;
  posterAssetVersion?: string;
  posterUrl?: string;
  sha256: string;
  tintable: boolean;
  url: string;
};

