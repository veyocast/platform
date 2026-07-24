import { ArrowRight, Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { ContentLink } from "../_content/pages";

export function SectionHeading({
  align = "left",
  children,
  description,
  eyebrow,
  title
}: {
  align?: "center" | "left";
  children?: ReactNode;
  description?: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <header className={`section-heading section-heading--${align}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {description ? <p className="section-heading__description">{description}</p> : null}
      {children}
    </header>
  );
}

export function CtaLink({
  className = "",
  href,
  label,
  secondary = false
}: ContentLink & { className?: string; secondary?: boolean }) {
  const classes = `button ${secondary ? "button--secondary" : "button--primary"} ${className}`.trim();
  const content = (
    <>
      {label}
      <ArrowRight aria-hidden size={18} />
    </>
  );

  return href.startsWith("mailto:") || href.startsWith("http") ? (
    <a className={classes} href={href}>{content}</a>
  ) : (
    <Link className={classes} href={href}>{content}</Link>
  );
}

export function BenefitList({ items }: { items: readonly string[] }) {
  return (
    <ul className="benefit-list">
      {items.map((item) => (
        <li key={item}>
          <span><Check aria-hidden size={14} /></span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function RelatedLinks({ links }: { links: readonly ContentLink[] }) {
  return (
    <nav aria-label="Gerelateerde pagina’s" className="related-links">
      {links.map((link) => (
        <Link href={link.href} key={link.href}>
          <span>{link.label}</span>
          <ChevronRight aria-hidden size={18} />
        </Link>
      ))}
    </nav>
  );
}

export function FinalCtaBand({
  description = "Plan een vrijblijvende demo en ontdek welke eerste opzet bij jouw organisatie past.",
  primary = { href: "/demo", label: "Plan een demo" },
  title = "Klaar om ieder scherm voor je te laten werken?"
}: {
  description?: string;
  primary?: ContentLink;
  title?: string;
}) {
  return (
    <section className="final-cta-section">
      <div className="marketing-container">
        <div className="final-cta-band">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <CtaLink className="button--light" {...primary} />
        </div>
      </div>
    </section>
  );
}
