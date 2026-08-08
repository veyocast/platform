import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const playerRoot = path.resolve(process.argv[2] ?? "apps/player");
const requireFromPlayer = createRequire(path.join(playerRoot, "package.json"));
const { parse } = requireFromPlayer("next/dist/compiled/acorn");
const standaloneBrowserFiles = [path.join(playerRoot, "public", "sw.js")];
const lgPageFile = path.join(playerRoot, "app", "lg", "page.tsx");
const legacyPageFile = path.join(
  playerRoot,
  "app",
  "_lib",
  "lg-legacy-page.ts"
);
const htmlDebugPageFile = path.join(
  playerRoot,
  "app",
  "_lib",
  "lg-html-debug-page.ts"
);
const failures = [];

for (const file of standaloneBrowserFiles) {
  const source = await readFile(file, "utf8");
  for (const label of findUnsupportedSyntax(source)) {
    failures.push(
      `${path.relative(playerRoot, file)} bevat ${label}.`
    );
  }
}

const lgPageSource = await readFile(lgPageFile, "utf8");
if (
  !lgPageSource.includes("/web0s|webos|netcast|lg browser|\\blge\\b/i") ||
  !lgPageSource.includes('redirect("/lg/legacy")')
) {
  failures.push(
    "app/lg/page.tsx leidt oude webOS-browsers niet vóór hydration naar /lg/legacy."
  );
}

const legacyPageSource = await readFile(legacyPageFile, "utf8");
if (
  legacyPageSource.includes('type="module"') ||
  legacyPageSource.includes("/_next/")
) {
  failures.push(
    "app/_lib/lg-legacy-page.ts verwijst naar modulecode of Next.js-clientchunks."
  );
}
if (legacyPageSource.includes("position:absolute;inset:0")) {
  failures.push(
    "app/_lib/lg-legacy-page.ts gebruikt opnieuw inset:0 voor een absolute fullscreenlaag; behoud de vier-randenfallback voor oude LG-browsers."
  );
}

const htmlDebugPageSource = await readFile(htmlDebugPageFile, "utf8");
if (
  htmlDebugPageSource.includes('type="module"') ||
  htmlDebugPageSource.includes("/_next/")
) {
  failures.push(
    "app/_lib/lg-html-debug-page.ts verwijst naar modulecode of Next.js-clientchunks."
  );
}

if (failures.length > 0) {
  console.error(
    [
      "De daadwerkelijke LG legacy-keten is niet veilig voor Chromium 79 (webOS 6).",
      ...failures
    ].join("\n")
  );
  process.exit(1);
}

function findUnsupportedSyntax(source) {
  const labels = new Set();
  let root;
  try {
    root = parse(source, {
      allowHashBang: true,
      ecmaVersion: "latest",
      sourceType: "script"
    });
  } catch (error) {
    return [`onparseerbare JavaScript (${error.message})`];
  }
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (!node || typeof node !== "object") continue;
    if (node.type === "ChainExpression" || node.optional === true) {
      labels.add("optional chaining");
    }
    if (node.type === "LogicalExpression" && node.operator === "??") {
      labels.add("nullish coalescing");
    }
    if (
      node.type === "AssignmentExpression" &&
      ["&&=", "||=", "??="].includes(node.operator)
    ) {
      labels.add("logical assignment");
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        pending.push(...value);
      } else if (value && typeof value === "object") {
        pending.push(value);
      }
    }
  }
  return labels;
}
