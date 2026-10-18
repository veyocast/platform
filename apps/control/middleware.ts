import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabasePublicConfig } from "./lib/supabase/config";
import { fieldflowRedirectUrl, resolveFieldflowRedirect } from "./lib/fieldflow-redirects";
import { createRequestDeadline, controlMiddlewareBudgetMs } from "./lib/supabase/request-deadline";

export async function middleware(request: NextRequest) {
  const fieldflowTarget = resolveFieldflowRedirect(request.nextUrl.pathname);
  if (fieldflowTarget) {
    const target = fieldflowRedirectUrl(request.nextUrl.toString(), request.headers.get("host"), fieldflowTarget);
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
  const deadline = createRequestDeadline(controlMiddlewareBudgetMs, { signal: request.signal });
  try {
    const supabase = createServerClient(config.url, config.anonKey, {
      global: {
        fetch: (input, init) => deadline.fetch(input, { ...init, cache: "no-store" }, `${config.url.replace(/\/$/, "")}/auth/v1`)
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          if (deadline.signal.aborted) return;
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, options, value }) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    });
    await deadline.run(() => supabase.auth.getUser());
  } catch {
    // Middleware refresh is best effort. Protected server routes independently
    // verify Auth and roles and never use this as authorization evidence.
  } finally {
    deadline.dispose();
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
