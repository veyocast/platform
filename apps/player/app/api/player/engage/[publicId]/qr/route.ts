import QRCode from "qrcode";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(publicId)) {
    return new Response("Niet gevonden.", { status: 404 });
  }
  const baseUrl = (
    process.env.NEXT_PUBLIC_CONTROL_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://control.veyocast.nl"
  ).replace(/\/$/, "");
  try {
    const svg = await QRCode.toString(`${baseUrl}/engage/${publicId}`, {
      color: { dark: "#111111", light: "#ffffff" },
      errorCorrectionLevel: "M",
      margin: 2,
      type: "svg",
      width: 640
    });
    return new Response(svg, {
      headers: {
        "cache-control": "public, max-age=3600, immutable",
        "content-type": "image/svg+xml; charset=utf-8",
        "x-content-type-options": "nosniff"
      }
    });
  } catch {
    return new Response("QR-code tijdelijk niet beschikbaar.", { status: 503 });
  }
}
