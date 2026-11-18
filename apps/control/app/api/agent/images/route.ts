import { NextResponse } from "next/server";
import { isImageUploadRequestTooLarge, isTrustedImageUploadOrigin } from "../../../../lib/media/image-upload-api";
import { uploadAgentImage } from "../../../../lib/agent/attachments";
import { requireAgentActor } from "../../../../lib/agent/access";
import { AgentUploadTooLarge, readAgentImageFormData } from "../../../../lib/agent/upload-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isTrustedImageUploadOrigin({ forwardedHost: request.headers.get("x-forwarded-host"), host: request.headers.get("host"), origin: request.headers.get("origin") })) return NextResponse.json({ ok: false, error: "Open dit gesprek opnieuw vanuit je eigen Control-sessie. Er is niets opgeslagen." }, { status: 403 });
  if (isImageUploadRequestTooLarge(request.headers.get("content-length"))) return NextResponse.json({ ok: false, error: "De afbeelding is groter dan de bestaande uploadlimiet. Verklein het bestand en probeer opnieuw." }, { status: 413 });
  try {
    await requireAgentActor("tenant.media.write");
    const form = await readAgentImageFormData(request);
    const conversationId = String(form.get("conversationId") ?? "");
    const attachmentId = String(form.get("attachmentId") ?? "");
    if (![conversationId, attachmentId].every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) throw Error("invalid_context");
    const id = await uploadAgentImage(conversationId, form.get("media"), String(form.get("title") ?? "").trim(), attachmentId);
    return NextResponse.json({ ok: true, id }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof AgentUploadTooLarge) return NextResponse.json({ ok: false, error: "De afbeelding is groter dan de bestaande uploadlimiet. Er is niets opgeslagen; verklein het bestand en probeer opnieuw." }, { status: 413, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ ok: false, error: "De privébijlage kon niet bevestigd worden opgeslagen. Controleer je sessie, agentvrijgave en het bestandsformaat; je oorspronkelijke bestand blijft behouden." }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}
