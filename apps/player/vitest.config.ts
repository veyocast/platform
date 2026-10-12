import { createRequire } from "node:module";

import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "server-only": require.resolve(
        "next/dist/compiled/server-only/empty.js"
      )
    }
  }
});
