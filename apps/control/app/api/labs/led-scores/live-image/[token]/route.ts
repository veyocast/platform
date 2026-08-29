import { createStructuredLogger } from "@veyocast/observability";

import { createLedScoresLiveImageHandler } from "../../../../../../lib/led-scores-live-image";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const expectedTokenDigest = "d891677c75fd6447908eb6a7a05340c6c2ca4f6f72926333db9bc1a777fb3475";

const handleLiveImage = createLedScoresLiveImageHandler({
  expectedTokenDigest,
  log(fields) {
    const logger = createStructuredLogger({
      correlationId: fields.requestCode
        ? `led_${fields.requestCode}`
        : undefined,
      environment: process.env.VEYOCAST_ENVIRONMENT ?? "unknown",
      revision: process.env.DEPLOYMENT_SHA ?? "unknown",
      service: "control"
    });
    logger.info("led_scores.live_image.requested", {
      outcome: fields.outcome,
      request_code: fields.requestCode,
      served_at: fields.servedAt,
      status: fields.status
    });
  }
});

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  return handleLiveImage(request, token);
}
