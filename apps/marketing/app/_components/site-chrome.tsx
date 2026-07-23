import Image from "next/image";
import Link from "next/link";

export function LegalHeader() {
  return (
    <header className="legal-header">
      <div className="legal-header__inner">
        <Link className="brand-link" href="/" aria-label="Naar VeyoCast">
          <Image
            alt="VeyoCast"
            className="brand-link__logo"
            height="32"
            priority
            src="/brand/veyocast-logo-inverse.svg"
            width="126"
          />
        </Link>
        <nav aria-label="Juridische pagina’s" className="legal-header__nav">
          <Link href="/privacy">Privacy</Link>
          <Link href="/data-verwijderen">Data verwijderen</Link>
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__brand">
        <Image
          alt="VeyoCast"
          className="site-footer__logo"
          height="28"
          src="/brand/veyocast-logo-inverse.svg"
          width="111"
        />
        <p>Narrowcasting en schermbeheer van DG Webservices.</p>
      </div>
      <nav aria-label="Privacy en contact" className="site-footer__links">
        <Link href="/privacy">Privacyverklaring</Link>
        <Link href="/data-verwijderen">Data verwijderen</Link>
        <a href="mailto:support@veyocast.nl">Ondersteuning</a>
      </nav>
      <p className="site-footer__meta">
        DG Webservices · Markenseplein 1, 2583 KR Den Haag · KvK 88135713
      </p>
    </footer>
  );
}
