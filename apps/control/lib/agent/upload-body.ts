import "server-only";

import { maxImageUploadRequestBytes } from "../media/image-upload-api";

export class AgentUploadTooLarge extends Error {}

export async function readAgentImageFormData(request: Request, maximumBytes = maxImageUploadRequestBytes) {
  if (!request.body) throw Error("upload_body_missing");
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      received += part.value.byteLength;
      if (received > maximumBytes) throw new AgentUploadTooLarge();
      parts.push(part.value);
    }
    return await new Response(Buffer.concat(parts), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
  } finally { await reader.cancel().catch(() => undefined); }
}
