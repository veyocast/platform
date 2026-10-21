"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { SyncMarketingHeader, SyncMarketingFooter } from "./Marketing";
import { marketingPages, normalizeMarketingPath } from "./pages";

export function MarketingChrome({ children, controlOrigin }: { children: ReactNode; controlOrigin: string }) {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === "/" && window.location.hash === "#opstelling") window.location.replace("/opstelling#opstelling");
  }, [pathname]);
  if (marketingPages[normalizeMarketingPath(pathname)] || normalizeMarketingPath(pathname) === "/opstelling/") return children;
  return <div className="mk-site mk-retained-site"><SyncMarketingHeader path={normalizeMarketingPath(pathname)} appHref={controlOrigin} mainId="main-content" />{children}<nav className="mk-retained-links" aria-label="Meer over VeyoCast"><Link href="/prijzen">Prijzen</Link><Link href="/contact">Contact</Link><Link href="/support">Support</Link><Link href="/privacy">Privacy</Link><Link href="/cookies">Cookies</Link><Link href="/algemene-voorwaarden">Voorwaarden</Link><Link href="/toegankelijkheid">Toegankelijkheid</Link><Link href="/data-verwijderen">Data verwijderen</Link></nav><SyncMarketingFooter appHref={controlOrigin} /></div>;
}
