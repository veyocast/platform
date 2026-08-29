import {
  editorialThemeConfigSchema,
  themeSelectionSchema
} from "@veyocast/contracts";
import { editorialThemeHasValidContrast } from "@veyocast/content-templates/editorial-arena-theme";

export type EditorialSlideThemeValidation =
  | { ok: true }
  | { code: string; message: string; ok: false };

export function validateEditorialSlideTheme(input: {
  rawTheme: unknown;
  rawThemeSelection: unknown;
  resolvedTheme: unknown;
  slideType: string;
}): EditorialSlideThemeValidation {
  if (input.slideType === "price_list") return { ok: true };

  const rawTheme = editorialThemeConfigSchema.safeParse(input.rawTheme);
  const themeSelection = themeSelectionSchema.safeParse(input.rawThemeSelection);
  if (!rawTheme.success || !themeSelection.success) {
    return {
      code: "EDITORIAL_THEME_INVALID",
      message:
        "Een of meer Editorial Arena-kleuren zijn ongeldig. Gebruik geldige hexkleuren.",
      ok: false
    };
  }

  const resolvedTheme = editorialThemeConfigSchema.safeParse(input.resolvedTheme);
  if (
    !resolvedTheme.success ||
    !editorialThemeHasValidContrast(resolvedTheme.data)
  ) {
    return {
      code: "EDITORIAL_THEME_CONTRAST_LOW",
      message:
        "De gekozen tekst- en paneelkleuren hebben onvoldoende contrast. Kies duidelijker kleuren.",
      ok: false
    };
  }

  return { ok: true };
}

export function slideComposerErrorPath(slideType: string, message: string) {
  const params = new URLSearchParams();
  if (slideType === "news") params.set("family", "news");
  params.set("fout", message);
  return `/dashboard/slides/new?${params.toString()}`;
}
