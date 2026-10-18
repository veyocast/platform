import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { join } from "node:path";
import { syncSlidePresentationSchema } from "../packages/contracts/src/sync-slide-presentation";
import { syncSystemAssets } from "../packages/contracts/src/sync-system-assets";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(join(root, "packages/contracts/package.json"));
const { z } =
  require("zod") as typeof import("../packages/contracts/node_modules/zod");
const schema = z.toJSONSchema(syncSlidePresentationSchema, {
  target: "draft-7",
  io: "output",
});
const manifest = Object.fromEntries(
  syncSystemAssets
    .filter((asset) => asset.mimeType.startsWith("image/"))
    .map((asset) => [asset.path, asset.sha256]),
);
const filename = join(
  root,
  "supabase/migrations/20261018002000_sync_studio_authoring.sql",
);
const original = readFileSync(filename, "utf8");
const replace = (text: string, marker: string, value: unknown) => {
  const delimiter = `$${marker}$`,
    start = text.indexOf(delimiter),
    end = text.indexOf(delimiter, start + delimiter.length);
  if (
    start < 0 ||
    end < 0 ||
    text.indexOf(delimiter, end + delimiter.length) >= 0
  )
    throw Error(`Expected one generated ${marker} literal`);
  return (
    text.slice(0, start + delimiter.length) +
    JSON.stringify(value) +
    text.slice(end)
  );
};
writeFileSync(
  filename,
  replace(replace(original, "sync_schema", schema), "sync_manifest", manifest),
);
writeFileSync(
  join(root, "packages/contracts/src/sync-slide-json-schema.json"),
  JSON.stringify(schema, null, 2) + "\n",
);
process.stdout.write(
  JSON.stringify({
    schemaBytes: JSON.stringify(schema).length,
    verifiedImageIdentities: Object.keys(manifest).length,
  }) + "\n",
);
