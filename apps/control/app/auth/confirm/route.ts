import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createControlSupabaseClient } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const redirectTo = request.nextUrl.clone();

  redirectTo.search = "";

  if (tokenHash && type === "invite") {
    const supabase = await createControlSupabaseClient();
    const { error } = supabase
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("unavailable") };

    if (!error) {
      redirectTo.pathname = "/accept-invite";
      return NextResponse.redirect(redirectTo);
    }
  }

  redirectTo.pathname = "/login";
  redirectTo.searchParams.set("fout", "inloggen");
  return NextResponse.redirect(redirectTo);
}
