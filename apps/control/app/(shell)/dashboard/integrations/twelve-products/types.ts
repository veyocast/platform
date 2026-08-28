export type ProductView = Readonly<{
  active: boolean;
  barcode: string | null;
  category: string | null;
  customFields: Readonly<Record<string, unknown>>;
  description: string | null;
  externalId: string | null;
  id: string;
  logoAssetId: string | null;
  logoUrl: string | null;
  name: string;
  priceCents: number | null;
  revision: number;
  slug: string;
  unit: string | null;
  updatedAt: string;
  vatRate: number | null;
}>;

export type ProductImportView = Readonly<{
  appliedAt: string | null;
  createdAt: string;
  fileName: string;
  id: string;
  includedCount: number;
  rowCount: number;
  sheetName: string;
  status: "applied" | "cancelled" | "draft";
  validCount: number;
}>;
