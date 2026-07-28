import { describe, expect, it } from "vitest";

import type { DynamicTemplateManifest } from "@veyocast/contracts";

import {
  renderDynamicTemplate,
  validateDynamicTemplate
} from "../src/dynamic-template";
import type { DynamicTemplateError } from "../src/dynamic-template";

const manifest = {
  allowedFields: [
    { path: "menu.title", required: true, type: "string" },
    { path: "menu.categories", required: true, type: "string" },
    { path: "menu.categories.name", required: true, type: "string" },
    { path: "menu.categories.products", required: true, type: "string" },
    { path: "menu.categories.products.name", required: true, type: "string" },
    { path: "menu.categories.products.priceMinor", required: true, type: "number" }
  ],
  canvas: { height: 1080, width: 1920 },
  engine: "veyocast-safe-template-v1",
  maxCollectionItems: 4,
  schemaVersion: 1,
  slideType: "menu"
} satisfies DynamicTemplateManifest;

describe("safe dynamic template", () => {
  it("renders allowed values, collections and helpers as escaped SVG", () => {
    const svg = renderDynamicTemplate(
      {
        css: ".title { fill: #111; }",
        manifest,
        markup:
          '<text class="title">{{menu.title}}</text>{{#each menu.categories}}<text>{{name}}</text>{{#each products}}<text>{{name}} — {{currency priceMinor "EUR"}}</text>{{/each}}{{/each}}'
      },
      {
        menu: {
          categories: [{
            name: "Drank & eten",
            products: [{ name: "<Cola>", priceMinor: 250 }]
          }],
          title: "Kantine"
        }
      }
    );

    expect(svg).toContain("Drank &amp; eten");
    expect(svg).toContain("&lt;Cola&gt;");
    expect(svg).toContain("€ 2,50");
    expect(svg).not.toContain("<Cola>");
  });

  it.each<[
    string,
    string,
    DynamicTemplateError["code"]
  ]>([
    ['<script>alert(1)</script>', "", "template_invalid_markup"],
    ['<image href="https://evil.test/a.png"/>', "", "template_invalid_markup"],
    ["<text>{{{menu.title}}}</text>", "", "template_invalid_syntax"],
    ["<text>veilig</text>", "@import 'https://evil.test/x.css';", "template_invalid_css"]
  ])("rejects unsafe source", (markup, css, code) => {
    expect(() =>
      validateDynamicTemplate({ css, manifest, markup })
    ).toThrowError(expect.objectContaining<Partial<DynamicTemplateError>>({ code }));
  });

  it("rejects fields outside the manifest", () => {
    expect(() =>
      validateDynamicTemplate({
        css: "",
        manifest,
        markup: "<text>{{tenant.secret}}</text>"
      })
    ).toThrowError(
      expect.objectContaining<Partial<DynamicTemplateError>>({
        code: "template_missing_field"
      })
    );
  });
});
