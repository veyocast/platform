import type { DynamicTemplateManifest } from "@veyocast/contracts";

export const defaultDynamicMarkup = [
  '<rect width="1920" height="1080" class="paper"/>',
  '<rect x="80" y="80" width="1760" height="920" rx="28" class="panel"/>',
  '<rect x="128" y="128" width="200" height="14" rx="7" fill="{{brand.primaryColor}}"/>',
  '<text x="128" y="260" class="eyebrow">DYNAMISCHE SLIDE</text>',
  '<text x="128" y="390" class="title">{{menu.title}}</text>',
  '<text x="128" y="500" class="items">{{#each menu.products}}',
  '<tspan x="128" dy="72">{{truncate name "34"}} — {{currency priceMinor "EUR"}}</tspan>',
  "{{/each}}</text>"
].join("");

export const defaultDynamicCss = [
  ".paper{fill:#f4efe6}",
  ".panel{fill:#fffdf8}",
  ".eyebrow{font:700 24px Inter;letter-spacing:4px;fill:#676056}",
  ".title{font:700 72px Inter;fill:#111}",
  ".items{font:500 36px Inter;fill:#111}"
].join("");

export const defaultDynamicManifest = {
  allowedFields: [
    { path: "brand.primaryColor", required: true, type: "string" },
    { path: "menu.title", required: true, type: "string" },
    { path: "menu.products", required: true, type: "string" },
    { path: "menu.products.name", required: true, type: "string" },
    { path: "menu.products.priceMinor", required: true, type: "number" }
  ],
  canvas: { height: 1080, width: 1920 },
  engine: "veyocast-safe-template-v1",
  maxCollectionItems: 8,
  schemaVersion: 1,
  slideType: "menu"
} satisfies DynamicTemplateManifest;

export const defaultDynamicSample = {
  brand: { primaryColor: "#ff5a1f", secondaryColor: "#111111" },
  menu: {
    products: [
      { name: "Broodje van de week", priceMinor: 650 },
      { name: "Verse soep", priceMinor: 425 },
      { name: "Clubburger", priceMinor: 875 }
    ],
    title: "Kantinemenu"
  }
};
