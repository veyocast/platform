import type { MetadataRoute } from "next";

import { isPublicIndexEnvironment, siteConfig } from "./_lib/site-config";

export default function robots(): MetadataRoute.Robots {
  if (!isPublicIndexEnvironment()) {
    return {
      rules: {
        disallow: "/",
        userAgent: "*"
      }
    };
  }

  return {
    host: siteConfig.productionOrigin,
    rules: {
      allow: "/",
      disallow: ["/inloggen", "/bedankt/", "/api/"],
      userAgent: "*"
    },
    sitemap: `${siteConfig.productionOrigin}/sitemap.xml`
  };
}
