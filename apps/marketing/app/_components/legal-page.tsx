import type { ReactNode } from "react";

import { LegalHeader, MarketingFooter } from "./site-chrome";

type LegalPageProps = {
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
  updated?: string;
};

export function LegalPage({
  children,
  description,
  eyebrow,
  title,
  updated
}: LegalPageProps) {
  return (
    <>
      <a className="skip-link" href="#legal-content">
        Naar de inhoud
      </a>
      <LegalHeader />
      <main className="legal-page" id="legal-content" tabIndex={-1}>
        <header className="legal-hero">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="legal-hero__description">{description}</p>
          {updated ? (
            <p className="legal-hero__updated">
              Laatst bijgewerkt: <time dateTime="2026-07-23">{updated}</time>
            </p>
          ) : null}
        </header>
        <div className="legal-content">{children}</div>
      </main>
      <MarketingFooter />
    </>
  );
}
