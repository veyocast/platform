import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import {
  accountInvitationCookieName,
  invitationContextCookieName,
  parseInvitationContext,
  serializeInvitationContext
} from "../../../lib/invitations";
import { getSupabasePublicConfig } from "../../../lib/supabase/config";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const invitationContext = parseInvitationContext(
    [
      request.nextUrl.searchParams.get("invitation"),
      request.nextUrl.searchParams.get("tenant"),
      request.nextUrl.searchParams.get("invite_token")
    ].join(".")
  );
  const isPlatformAccountInvitation =
    request.nextUrl.searchParams.get("account") === "platform";
  const isPasswordRecovery =
    request.nextUrl.searchParams.get("recovery") === "password";
  const redirectTo = controlRedirectUrl(request);

  redirectTo.search = "";

  if (tokenHash && type === "recovery" && isPasswordRecovery) {
    const config = getSupabasePublicConfig();
    redirectTo.pathname = "/auth/reset-password";
    const response = NextResponse.redirect(redirectTo);
    const supabase = config
      ? createServerClient(config.url, config.anonKey, {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, options, value }) => {
                response.cookies.set(name, value, options);
              });
            }
          }
        })
      : null;
    const { error } = supabase
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("unavailable") };

    if (!error) return response;
  }

  if (
    tokenHash &&
    type === "invite" &&
    (invitationContext || isPlatformAccountInvitation)
  ) {
    const config = getSupabasePublicConfig();
    redirectTo.pathname = "/accept-invite";
    const response = NextResponse.redirect(redirectTo);
    const supabase = config
      ? createServerClient(config.url, config.anonKey, {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, options, value }) => {
                response.cookies.set(name, value, options);
              });
            }
          }
        })
      : null;
    const { error } = supabase
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("unavailable") };

    if (!error) {
      redirectTo.pathname = "/accept-invite";
      redirectTo.search = "";
      if (isPlatformAccountInvitation) {
        redirectTo.searchParams.set("type", "account");
      }
      const verifiedResponse = NextResponse.redirect(redirectTo);
      response.cookies.getAll().forEach((cookie) => {
        verifiedResponse.cookies.set(cookie);
      });

      if (isPlatformAccountInvitation) {
        verifiedResponse.cookies.set(accountInvitationCookieName, "platform", {
          httpOnly: true,
          maxAge: 60 * 60,
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production"
        });
        return verifiedResponse;
      }

      if (!invitationContext) {
        redirectTo.pathname = "/login";
        redirectTo.searchParams.set("fout", "inloggen");
        return NextResponse.redirect(redirectTo);
      }
      verifiedResponse.cookies.set(
        invitationContextCookieName,
        serializeInvitationContext(invitationContext),
        {
          httpOnly: true,
          maxAge: 60 * 60,
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production"
        }
      );
      return verifiedResponse;
    }
  }

  redirectTo.pathname = "/login";
  redirectTo.searchParams.set("fout", "inloggen");
  return NextResponse.redirect(redirectTo);
}

function controlRedirectUrl(request: NextRequest) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredUrl) {
    const appUrl = new URL(configuredUrl);
    if (
      appUrl.protocol === "https:" ||
      ["127.0.0.1", "localhost"].includes(appUrl.hostname)
    ) {
      return appUrl;
    }
  }

  return new URL(request.url);
}
