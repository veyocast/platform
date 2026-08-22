import { describe, expect, it } from "vitest";

import {
  menuStudioTemplateVersionIds,
  type MenuStudioTemplateOption
} from "./data";

const templates: MenuStudioTemplateOption[] = [
  {
    name: "Editorial donker liggend",
    orientation: "landscape",
    slug: "editorial-arena-prijslijst-dark-landscape",
    versionId: "10000000-0000-4000-8000-000000000001"
  },
  {
    name: "Editorial donker staand",
    orientation: "portrait",
    slug: "editorial-arena-prijslijst-dark-portrait",
    versionId: "10000000-0000-4000-8000-000000000002"
  },
  {
    name: "Editorial licht liggend",
    orientation: "landscape",
    slug: "editorial-arena-prijslijst-light-landscape",
    versionId: "10000000-0000-4000-8000-000000000003"
  },
  {
    name: "Editorial licht staand",
    orientation: "portrait",
    slug: "editorial-arena-prijslijst-light-portrait",
    versionId: "10000000-0000-4000-8000-000000000004"
  }
];

describe("Menu Studio templatekeuze", () => {
  it("kiest voor een nieuw concept een gepubliceerd template per oriëntatie", () => {
    expect(menuStudioTemplateVersionIds(templates)).toEqual({
      landscape: "10000000-0000-4000-8000-000000000001",
      portrait: "10000000-0000-4000-8000-000000000002"
    });
  });

  it("behoudt bij omschakelen dezelfde templatefamilie", () => {
    expect(menuStudioTemplateVersionIds(
      templates,
      "10000000-0000-4000-8000-000000000003"
    )).toEqual({
      landscape: "10000000-0000-4000-8000-000000000003",
      portrait: "10000000-0000-4000-8000-000000000004"
    });
  });
});
