import Image from "next/image";
import Link from "next/link";

const footerGroups = [
  {
    links: [
      { href: "/product", label: "Platform" },
      { href: "/publisher", label: "Publisher" },
      { href: "/functies", label: "Functies" },
      { href: "/prijzen", label: "Prijzen" }
    ],
    title: "Product"
  },
  {
    links: [
      { href: "/clubtv", label: "ClubTV" },
      { href: "/oplossingen/sportverenigingen", label: "Sportverenigingen" },
      { href: "/oplossingen/horeca-en-kantines", label: "Horeca en kantines" },
      { href: "/oplossingen/bedrijven", label: "Bedrijven" }
    ],
    title: "Oplossingen"
  },
  {
    links: [
      { href: "/over-ons", label: "Over VeyoCast" },
      { href: "/kennisbank", label: "Kennisbank" },
      { href: "/cases", label: "Cases" },
      { href: "/contact", label: "Contact" }
    ],
    title: "Bedrijf"
  },
  {
    links: [
      { href: "/support", label: "Ondersteuning" },
      { href: "/veelgestelde-vragen", label: "Veelgestelde vragen" },
      { href: "/status", label: "Status" },
      { href: "mailto:support@veyocast.nl", label: "support@veyocast.nl" }
    ],
    title: "Hulp & contact"
  }
] as const;

export function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <div className="marketing-container marketing-footer__grid">
        <div className="marketing-footer__brand">
          <Link aria-label="VeyoCast homepage" className="footer-logo" href="/">
            <Image
              alt="VeyoCast"
              height={32}
              src="/brand/veyocast-logo-inverse.svg"
              width={127}
            />
          </Link>
          <p>
            Narrowcasting en ClubTV voor organisaties die ieder scherm
            overzichtelijk willen beheren.
          </p>
          <span>Een product van DG Webservices.</span>
        </div>

        {footerGroups.map((group) => (
          <nav aria-label={group.title} className="marketing-footer__group" key={group.title}>
            <h2>{group.title}</h2>
            <ul>
              {group.links.map((link) => (
                <li key={link.href}>
                  {link.href.startsWith("mailto:") ? (
                    <a href={link.href}>{link.label}</a>
                  ) : (
                    <Link href={link.href}>{link.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="marketing-container marketing-footer__legal">
        <p>© {new Date().getFullYear()} VeyoCast. Alle rechten voorbehouden.</p>
        <nav aria-label="Juridische links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/cookies">Cookies</Link>
          <Link href="/algemene-voorwaarden">Voorwaarden</Link>
          <Link href="/toegankelijkheid">Toegankelijkheid</Link>
          <Link href="/data-verwijderen">Data verwijderen</Link>
        </nav>
      </div>
    </footer>
  );
}
