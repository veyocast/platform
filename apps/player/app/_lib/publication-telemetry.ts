import type { PlayerManifestEnvelope } from "./player-manifest";

/** One bounded trace for the current desired assignment, never an event queue. */
export type PublicationTrace = {
  correlationId: string;
  releaseId: string;
  publicationId: string;
  configRevision: string;
  targetRevision: string;
  generation: number;
  committedAt: string | null;
  targetWrittenAt: string;
  signalReceivedAt: string | null;
  resolvedAt: string;
  assetsReadyAt?: string;
  boundaryAt?: string;
  firstFrameAt?: string;
  frameAfterBoundaryMs?: number;
};

export function publicationTrace(envelope: PlayerManifestEnvelope, generation: number, signalReceivedAt: string | null,
  commit?: { revision: string; at: string } | null): PublicationTrace | null {
  if (!envelope.target) return null;
  return { ...envelope.target, correlationId: crypto.randomUUID(), generation,
    releaseId: envelope.manifest.releaseId, signalReceivedAt, resolvedAt: new Date().toISOString(),
    targetWrittenAt: envelope.target.committedAt,
    committedAt: commit?.revision === envelope.target.revision ? commit.at : null,
    targetRevision: envelope.target.revision };
}
