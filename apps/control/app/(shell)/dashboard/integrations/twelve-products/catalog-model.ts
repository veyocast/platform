import type { SyncProductCatalogFilters } from "@veyocast/contracts";
export {
  productCatalogFiltersSchema,
  productCatalogResponseSchema,
} from "@veyocast/contracts";
import type { ProductView } from "./types";

export type ProductCatalogFilters = SyncProductCatalogFilters;
export const initialProductCatalogFilters: ProductCatalogFilters = {
  query: "",
  category: "",
  availability: "all",
  offset: 0,
};
export type ProductCatalogPage = Readonly<{
  products: ProductView[];
  count: number;
  total: number;
  active: number;
  categories: string[];
  categoriesComplete: boolean;
  offset: number;
  pageSize: 50;
}>;
export const unavailableProductCatalogMessage =
  "De producten konden niet worden geladen. Er is niets gewijzigd; probeer opnieuw. De vorige resultaten blijven zichtbaar.";
