import type { ReactNode } from "react";

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
    <main className="legal-page" id="main-content" tabIndex={-1}>
      <header className="legal-hero">
        <div className="marketing-container">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="legal-hero__description">{description}</p>
          {updated ? (
            <p className="legal-hero__updated">
              Laatst bijgewerkt: <time dateTime="2026-07-23">{updated}</time>
            </p>
          ) : null}
        </div>
      </header>
      <div className="legal-content">{children}</div>
    </main>
  );
}
