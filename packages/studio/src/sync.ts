import {
  syncContentFamilies,
  syncSlidePageCount,
  syncSlidePresentationSchema,
  syncSlideRendererVersion,
  syncSlideSourceRevision,
  type SyncContentFamily,
  type SyncSlideAsset,
  type SyncSlidePresentation,
} from "@veyocast/contracts";
import { createEmptyStudioDocument } from "./document";
import { parseStudioDocument, type StudioDocument } from "./schema";

export function createSyncStudioDocument(
  presentation: SyncSlidePresentation,
  secondsPerPage = 12,
  motionEnabled = false,
): StudioDocument {
  const slide = syncSlidePresentationSchema.parse(presentation),
    pages = syncSlidePageCount(slide);
  if (
    !Number.isInteger(secondsPerPage) ||
    secondsPerPage < 3 ||
    secondsPerPage * pages > 120
  )
    throw new Error(
      "Kies minimaal drie seconden per pagina en maximaal 120 seconden totaal. Verdeel meer gegevens over een reeks.",
    );
  return parseStudioDocument({
    ...createEmptyStudioDocument(
      slide.orientation === "portrait" ? "portrait-hd" : "landscape-hd",
    ),
    syncPresentation: slide,
    motion: {
      enabled: motionEnabled || pages > 1 || (slide.style.motion!==undefined&&slide.style.motion!=="geen"),
      durationMs: secondsPerPage * pages * 1000,
      fps: 30,
    },
  });
}

export function updateSyncStudioDocument(
  document: StudioDocument,
  presentation: SyncSlidePresentation,
  secondsPerPage?: number,
): StudioDocument {
  if (!document.syncPresentation)
    throw new Error("Dit ontwerp gebruikt een ander Studio-formaat.");
  const seconds =
    secondsPerPage ??
    Math.round(
      document.motion.durationMs /
        syncSlidePageCount(document.syncPresentation) /
        1000,
    );
  return parseStudioDocument({
    ...createSyncStudioDocument(presentation, seconds, presentation.style.motion===undefined&&document.motion.enabled),
    metadata: document.metadata,
  });
}

/** Empty tenant-owned starts: source example names, matches, prices and claims never become factual tenant data. */
export function createSyncStudioStarter({
  family,
  tenantName,
  orientation = "landscape",
  theme = "fieldflow",
  logo,
}: {
  family: SyncContentFamily;
  tenantName: string;
  orientation?: SyncSlidePresentation["orientation"];
  theme?: SyncSlidePresentation["theme"];
  logo?: SyncSlideAsset;
}): StudioDocument {
  const definition = syncContentFamilies.find((entry) => entry.id === family);
  if (!definition) throw new Error("Deze slidefamilie is niet beschikbaar.");
  const label = definition.label
    .replace("DUINDORP SV", tenantName.toUpperCase())
    .replace("HOUTRUST", tenantName.toUpperCase());
  return createSyncStudioDocument(
    syncSlidePresentationSchema.parse({
      schemaVersion: 1,
      rendererVersion: syncSlideRendererVersion,
      sourceRevision: syncSlideSourceRevision,
      family,
      orientation,
      theme,
      name: definition.name,
      title: label,
      club: { name: tenantName, logo },
      style: { background: theme === "onzetrots-tv" ? "clubmuur" : "stadium",motion:"rustig" },
    }),
  );
}
