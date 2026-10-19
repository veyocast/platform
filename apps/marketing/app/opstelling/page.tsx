import { SetupWorkspace } from "../_sync/setup-workspace";
import { siteConfig } from "../_lib/site-config";

// Compatibility entry for the existing signed setup-intent journey.
export default function SetupPage() {
  return <SetupWorkspace appHref={siteConfig.controlOrigin} />;
}
