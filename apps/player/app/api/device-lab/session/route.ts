import { NextResponse } from "next/server";

import {
  createDeviceLabSession,
  deviceLabCookieName,
  isValidDeviceLabAccessToken
} from "../../../_lib/device-lab-auth";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const token = requestUrl.searchParams.get("token");

  if (!isValidDeviceLabAccessToken(token)) {
    return NextResponse.json(
      { error: "Diagnosesessie niet beschikbaar." },
      { headers: { "Cache-Control": "no-store" }, status: 404 }
    );
  }

  const session = createDeviceLabSession();
  if (!session) {
    return NextResponse.json(
      { error: "Diagnosesessie niet beschikbaar." },
      { headers: { "Cache-Control": "no-store" }, status: 404 }
    );
  }

  const response = new NextResponse(null, {
    headers: { Location: "/device-lab" },
    status: 303
  });
  response.cookies.set(deviceLabCookieName, session.value, {
    httpOnly: true,
    maxAge: session.maxAge,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production"
  });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
