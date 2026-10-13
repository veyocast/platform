import { unstable_rethrow } from "next/navigation";

import { getControlLandingPath, getControlSession } from "../../lib/control-session";
import type { createControlSupabaseClient } from "../../lib/supabase/server";
import type { RequestDeadline } from "../../lib/supabase/request-deadline";

type LoginClient = NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>;
type LoginOutcome = { kind: "success"; path: string } | { kind: "invalid_credentials" | "unavailable" };

export async function runControlLogin(
  client: LoginClient,
  credentials: { email: string; password: string },
  deadline: RequestDeadline
): Promise<LoginOutcome> {
  try {
    return await deadline.run(async () => {
      const { error } = await client.auth.signInWithPassword(credentials);
      deadline.assertActive();
      if (error) {
        return { kind: error.status === 400 && (!error.code || ["invalid_credentials", "email_not_confirmed"].includes(error.code))
          ? "invalid_credentials" : "unavailable" };
      }
      // Keep exactly the SSR client that wrote these session cookie chunks.
      const session = await getControlSession(client, deadline);
      deadline.assertActive();
      if (!session) return { kind: "unavailable" };
      return { kind: "success", path: getControlLandingPath(session) };
    });
  } catch (error) {
    unstable_rethrow(error);
    return { kind: "unavailable" };
  }
}
