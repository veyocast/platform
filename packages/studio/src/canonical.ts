import { parseStudioDocument, type StudioDocument } from "./schema";

export function canonicalizeStudioDocument(document: StudioDocument): string {
  return stableStringify(parseStudioDocument(document));
}

export function createStudioRenderSignatureSeed(
  document: StudioDocument,
  options: Readonly<{
    assetChecksums: readonly string[];
    outputType: "png" | "mp4";
    rendererVersion: string;
  }>
) {
  return [
    "veyocast-studio-render-v1",
    options.rendererVersion,
    options.outputType,
    canonicalizeStudioDocument(document),
    [...options.assetChecksums].sort().join(",")
  ].join("\n");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) =>
      `${JSON.stringify(key)}:${stableStringify(item)}`
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}
