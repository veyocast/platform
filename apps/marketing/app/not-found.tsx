import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="not-found-page" id="main-content">
      <div className="marketing-container not-found-page__inner">
        <span aria-hidden>404</span>
        <p className="eyebrow">Pagina niet gevonden</p>
        <h1>Dit scherm staat niet in de playlist.</h1>
        <p>
          De pagina bestaat niet of is verplaatst. Ga terug naar het begin of
          open de kennisbank.
        </p>
        <div className="hero-actions">
          <Link className="button button--primary" href="/">
            <ArrowLeft aria-hidden size={18} />
            Naar de homepage
          </Link>
          <Link className="button button--secondary" href="/kennisbank">
            <Search aria-hidden size={18} />
            Zoek in de kennisbank
          </Link>
        </div>
      </div>
    </main>
  );
}
