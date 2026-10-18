import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(
  realpathSync(join(root, "apps/control/node_modules/next/package.json")),
);
const postcss = require("postcss");
const source = join(
  root,
  "docs/sync-v1-rebuild/handoff/reference/sites-sync/src",
);
const base = postcss.parse(readFileSync(join(source, "styles.css"), "utf8"));
// Source fonts, reset and type defaults, without the application navigation.
base.nodes
  .filter(
    (node) =>
      !(
        node.type === "atrule" &&
        (node.name === "font-face" ||
          (node.name === "layer" && ["reset", "base"].includes(node.params)))
      ),
  )
  .forEach((node) => node.remove());
const content = postcss.parse(
  readFileSync(join(source, "modules/content.css"), "utf8"),
);
base.append(...content.nodes);
base.walkAtRules("layer", (rule) => {
  if (rule.nodes) rule.replaceWith(...rule.nodes);
  else rule.remove();
});
base.walkRules((rule) => {
  if (rule.parent.type === "atrule" && rule.parent.name.includes("keyframes"))
    return;
  // The original pale menu caption is 2.87:1 on its white card. Accessibility
  // governs this one color: inherit the Source card's existing dark ink.
  if(rule.selectors.includes('.vc-menu-heading>span:last-child')){
    rule.walkDecls('color',declaration=>{declaration.value='inherit';});
  }
  rule.selectors = rule.selectors.map((selector) =>
    selector === "body" ? ".sync-slide-root" : `.sync-slide-root ${selector}`,
  );
  // Safe static markup renders the same QR matrix as inline SVG, with no link
  // or data URI. Keep the Source image's exact layout declarations.
  const qrRules = rule.selectors.filter((selector) =>
    /\.vc-(news|engage)-qr.*\bimg\b/.test(selector),
  );
  rule.selectors.push(
    ...qrRules.map((selector) => selector.replace(/\bimg\b/g, ".sync-qr-svg")),
    ...rule.selectors.filter(selector=>/\.vc-(news|engage)-qr>a\b/.test(selector)).map(selector=>selector.replace(/>a\b/,'>.sync-qr-code')),
  );
});
const css = base.toString();
writeFileSync(
  join(root, "packages/content-templates/src/sync-slide-styles.ts"),
  `// Generated from Sync Source ${"8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a"}; run scripts/build-sync-slide-css.mjs.\nexport const syncSlideCss = ${JSON.stringify(css)};\n`,
);
process.stdout.write(
  JSON.stringify({
    cssBytes: Buffer.byteLength(css),
    sourceRevision: "8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a",
  }) + "\n",
);
