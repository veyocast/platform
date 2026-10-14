import { z } from "zod";

export const publisherLibraryFilterSchema = z.object({
  tab: z.enum(["media", "slides", "studio", "dynamic"]).default("media"),
  source: z.enum(["all","studio","sportlink","led-scores","menu"]).optional(),
  query: z.string().max(160).optional(),
  folderId: z.string().uuid().optional(),
  collectionId: z.string().uuid().optional(),
  favorites: z.enum(["true", "false"]).optional(),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
  assetId: z.string().uuid().optional()
}).strict();
