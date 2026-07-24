import { NextResponse } from "next/server";

import { siteConfig } from "../_lib/site-config";

export function GET() {
  return NextResponse.redirect(new URL("/", siteConfig.controlOrigin), 307);
}
