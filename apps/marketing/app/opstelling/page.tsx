import { SitesMarketingHome } from "../_components/sites-marketing-home";
import { siteConfig } from "../_lib/site-config";

// Compatibility entry for the existing signed setup-intent journey.
export default function SetupPage() {
  return <SitesMarketingHome controlOrigin={siteConfig.controlOrigin} />;
}
