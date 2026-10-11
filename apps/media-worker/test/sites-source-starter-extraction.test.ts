import { writeFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { createSitesSourceReference, resolveSitesSourceReferenceDirectory } from "./support/sites-source-reference";

it.runIf(Boolean(process.env.SITES_SOURCE_STARTER_OUTPUT && process.env.SITES_CAPTURE_TEST_CHROMIUM))("extracts only SHA-verified original starter data for the audited editable catalog", async () => {
  const reference = await createSitesSourceReference(resolveSitesSourceReferenceDirectory()!, process.env.SITES_CAPTURE_TEST_CHROMIUM!);
  try {
    const fixtures = await reference.fixtures() as {studio: unknown[]; tv: unknown[]};
    expect(fixtures.studio).toHaveLength(11); expect(fixtures.tv).toHaveLength(8);
    await writeFile(process.env.SITES_SOURCE_STARTER_OUTPUT!, JSON.stringify({sourceRevision:"b1cae899af19fc39908217253094c5240d7359fc", studio:fixtures.studio, tv:fixtures.tv}, null, 2) + "\n");
  } finally { await reference.close(); }
}, 30_000);
