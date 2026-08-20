import {
  dynamicSlideTypes,
  editorialArenaActiveSlideTypes,
  selectableThemeIds,
  themeModes
} from "@veyocast/contracts";

export const themeFixtureOnlyFamilies = ["poll_cta_fixture"] as const;
export const themeVisualFamilies = [
  ...dynamicSlideTypes,
  ...themeFixtureOnlyFamilies
] as const;

export const themeVisualMatrix = selectableThemeIds.flatMap((themeId) =>
  themeModes.flatMap((mode) =>
    (["landscape", "portrait"] as const).flatMap((orientation) =>
      themeVisualFamilies.map((family) => ({
        family,
        fixtureOnly: family === "poll_cta_fixture" ||
          !editorialArenaActiveSlideTypes.includes(
            family as (typeof editorialArenaActiveSlideTypes)[number]
          ),
        mode,
        orientation,
        themeId
      }))
    )
  )
);
