"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { MarketingHeader } from "../_components/marketing-header";
import { MarketingFooter } from "../_components/site-chrome";
import { marketingPages, normalizeMarketingPath } from "./pages";

export function MarketingChrome({ children, controlOrigin }: { children: ReactNode; controlOrigin: string }) {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === "/" && window.location.hash === "#opstelling") window.location.replace("/opstelling#opstelling");
  }, [pathname]);
  if (marketingPages[normalizeMarketingPath(pathname)]) return children;
  return <><a className="skip-link" href="#main-content">Naar de inhoud</a><MarketingHeader controlOrigin={controlOrigin} />{children}<MarketingFooter /></>;
}
