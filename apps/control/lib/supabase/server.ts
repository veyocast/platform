import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublicConfig } from "./config";
import type { RequestDeadline } from "./request-deadline";

export async function createControlSupabaseClient(options: { deadline?: RequestDeadline } = {}) {
  const config = getSupabasePublicConfig();

  if (!config) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(config.url, config.anonKey, {
    global: {
      fetch(input, init) {
        if (options.deadline) {
          return options.deadline.fetch(input, { ...init, cache: "no-store" }, `${config.url.replace(/\/$/, "")}/auth/v1`);
        }
        return fetch(input, { ...init, cache: "no-store" });
      }
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // A cancelled refresh may ask auth-js to clear an otherwise valid
        // cookie. A scoped availability failure must preserve existing cookies.
        if (options.deadline?.signal.aborted) return;
        try {
          cookiesToSet.forEach(({ name, options, value }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies. Middleware refreshes them.
        }
      }
    }
  });
}
