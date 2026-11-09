import "server-only";
import { hasCapability } from "@veyocast/auth";
import { requireControlSession, requireTenantControlSession } from "../../../../lib/control-session";
import { contentCreateCapabilities, contentEntryCapabilities } from "./content-library";

/** Preserve each existing task permission; Content is not a new permission. */
export async function requireContentSession(creating = false) {
  const session = await requireControlSession();
  const allowed = creating ? contentCreateCapabilities : contentEntryCapabilities;
  const capability = allowed.find(value => hasCapability(session.capabilities, value));
  // The existing guard owns authentication, tenant selection and denied routing.
  return requireTenantControlSession(capability ?? allowed[0]);
}
