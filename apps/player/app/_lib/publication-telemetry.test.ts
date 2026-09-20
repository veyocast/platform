import { expect, it } from "vitest";
import { getPlayerManifestForToken } from "./player-manifest";
import { publicationTrace } from "./publication-telemetry";

it("distinguishes the database write from the observed WAL commit and rejects an obsolete commit association", () => {
  const lookup = getPlayerManifestForToken("demo-online");
  if (!lookup.ok) throw new Error("fixture missing");
  const envelope = { ...lookup.body, target: { revision: "100", configRevision: "2", publicationId: "other-playlist",
    assignmentSource: "default", committedAt: "2026-09-20T12:00:00.000Z" } };
  const signal = "2026-09-20T12:00:00.300Z";
  expect(publicationTrace(envelope, 3, signal)).toMatchObject({ committedAt: null, targetWrittenAt: envelope.target.committedAt });
  expect(publicationTrace(envelope, 3, signal, { revision: "99", at: signal })?.committedAt).toBeNull();
  expect(publicationTrace(envelope, 3, signal, { revision: "100", at: "2026-09-20T12:00:00.100Z" })).toMatchObject({
    committedAt: "2026-09-20T12:00:00.100Z", signalReceivedAt: signal, targetRevision: "100", configRevision: "2"
  });
});
