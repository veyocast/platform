import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { join } from "node:path";
import { syncSlidePresentationSchema } from "../packages/contracts/src/sync-slide-presentation";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(join(root, "packages/contracts/package.json"));
const { z } =
  require("zod") as typeof import("../packages/contracts/node_modules/zod");
const schema = z.toJSONSchema(syncSlidePresentationSchema, {
  target: "draft-7",
  io: "output",
});
writeFileSync(
  join(root, "packages/contracts/src/sync-slide-json-schema.json"),
  JSON.stringify(schema, null, 2) + "\n",
);
process.stdout.write(
  JSON.stringify({
    schemaBytes: JSON.stringify(schema).length,
    migrationWrite: false,
  }) + "\n",
);
