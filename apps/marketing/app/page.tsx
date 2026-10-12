import type { Metadata } from "next";
import { JsonLd } from "./_components/json-ld";
import { SitesMarketingHome } from "./_components/sites-marketing-home";
import { canonicalUrl, siteConfig } from "./_lib/site-config";

export const metadata: Metadata = {
  alternates: { canonical: canonicalUrl("/") },
  description:
    "VeyoCast brengt clubnieuws, wedstrijden, sponsoren en activiteiten naar ieder scherm in de vereniging.",
  openGraph: {
    description:
      "Maak, plan en publiceer het verhaal van je vereniging vanuit één overzichtelijke omgeving.",
    locale: "nl_NL",
    title: "VeyoCast | Van clubverhaal naar ieder scherm",
    type: "website",
    url: canonicalUrl("/")
  },
  title: "Van clubverhaal naar ieder scherm | VeyoCast"
};

export default function HomePage() {
  return <><JsonLd data={[
    {"@context":"https://schema.org","@type":"Organization",address:{"@type":"PostalAddress",addressCountry:"NL",addressLocality:"Den Haag",postalCode:"2583 KR",streetAddress:"Markenseplein 1"},email:"support@veyocast.nl",legalName:"DG Webservices",name:"VeyoCast",url:canonicalUrl("/")},
    {"@context":"https://schema.org","@type":"SoftwareApplication",applicationCategory:"BusinessApplication",name:"VeyoCast",operatingSystem:"Web, Android",url:canonicalUrl("/product")}
  ]}/><SitesMarketingHome controlOrigin={siteConfig.controlOrigin}/></>;
}
