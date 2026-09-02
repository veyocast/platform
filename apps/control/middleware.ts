import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabasePublicConfig } from "./lib/supabase/config";
import { resolveFieldflowRedirect } from "./lib/fieldflow-redirects";

export async function middleware(request: NextRequest) {
  const fieldflowTarget = resolveFieldflowRedirect(request.nextUrl.pathname);
  if (fieldflowTarget) {
    const target = request.nextUrl.clone();
    target.pathname = fieldflowTarget;
    return NextResponse.redirect(target, 308);
  }

  if (request.nextUrl.pathname === "/api/health") {
    return NextResponse.next({ request });
  }

  const config = getSupabasePublicConfig();

  if (!config) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, options, value }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
