import QRCode from "qrcode";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code")
    ?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return new Response("Ongeldige koppelcode.", { status: 400 });
  }
  const baseUrl = (
    process.env.NEXT_PUBLIC_CONTROL_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://control.veyocast.nl"
  ).replace(/\/$/, "");
  try {
    const svg = await QRCode.toString(
      `${baseUrl}/mobile/pair?code=${encodeURIComponent(code)}`,
      {
        color: { dark: "#111111", light: "#ffffff" },
        errorCorrectionLevel: "M",
        margin: 2,
        type: "svg",
        width: 480
      }
    );
    return new Response(svg, {
      headers: {
        "cache-control": "private, no-store",
        "content-type": "image/svg+xml; charset=utf-8",
        "x-content-type-options": "nosniff"
      }
    });
  } catch {
    return new Response("QR-code tijdelijk niet beschikbaar.", { status: 503 });
  }
}
