import { JsonLd } from "../_components/json-ld";
import { canonicalUrl } from "../_lib/site-config";
import { marketingPages, normalizeMarketingPath } from "./pages";

/** Same graph as the frozen publication, with the configured production origin. */
export function SyncStructuredData({ path }: { path: string }) {
  const page = marketingPages[normalizeMarketingPath(path)];
  if (!page) return null;
  const home = canonicalUrl("/");
  const origin = home.replace(/\/$/, "");
  const url = canonicalUrl(path);
  return <JsonLd data={{ "@context": "https://schema.org", "@graph": [
    { "@type": "Organization", "@id": `${home}#organization`, name: "VeyoCast", url: home,
      logo: { "@type": "ImageObject", url: `${origin}/assets/brand-icon.svg` },
      description: "Narrowcasting voor sportverenigingen, horeca en organisaties." },
    { "@type": "WebSite", "@id": `${home}#website`, url: home, name: "VeyoCast",
      inLanguage: "nl-NL", publisher: { "@id": `${home}#organization` } },
    { "@type": "WebPage", "@id": `${url}#webpage`, url, name: page.title, description: page.description,
      inLanguage: "nl-NL", isPartOf: { "@id": `${home}#website` } },
    ...(path === "/" ? [] : [{ "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: home },
      { "@type": "ListItem", position: 2, name: page.label, item: url }
    ] }])
  ] }} />;
}
