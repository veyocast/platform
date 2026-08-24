import {
  CalendarDays,
  Check,
  FileCheck2,
  Library,
  MonitorCheck,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import Link from "next/link";

import type { MarketingPageDefinition } from "../_content/pages";
import type { SetupIntentPayload } from "../_lib/setup-intent";
import { canonicalUrl } from "../_lib/site-config";
import { FaqAccordion } from "./faq";
import { JsonLd } from "./json-ld";
import { LeadForm } from "./lead-form";
import {
  CtaLink,
  FinalCtaBand,
  RelatedLinks,
  SectionHeading
} from "./marketing-primitives";
import { Reveal } from "./motion";
import { ProductScreenshotFrame } from "./product-showcase";
import { MarketingPriceCalculator } from "./marketing-price-calculator";

const demoCta = { href: "/demo", label: "Plan een demo" } as const;

const cardIcons = [
  Library,
  MonitorCheck,
  FileCheck2,
  ShieldCheck,
  CalendarDays,
  Sparkles
] as const;

function breadcrumbsFor(page: MarketingPageDefinition) {
  const items = [{ href: "/", label: "Home" }];
  const parts = page.pathname.split("/").filter(Boolean);

  if (parts.length > 1) {
    const parentPath = `/${parts[0]}`;
    const parentLabels: Record<string, string> = {
      "/functies": "Functies",
      "/kennisbank": "Kennisbank",
      "/oplossingen": "Oplossingen"
    };
    items.push({
      href: parentPath,
      label: parentLabels[parentPath] ?? parts[0]!
    });
  }

  items.push({ href: page.pathname, label: page.title });
  return items;
}

function formatGrossCents(cents: number) {
  return `€ ${Math.floor(cents / 100).toLocaleString("nl-NL")},${String(cents % 100).padStart(2, "0")}`;
}

const setupBranchLabels = {
  hospitality: "Horeca & sportlocatie",
  organization: "Organisatie",
  sportclub: "Sportvereniging"
} as const;

function SetupIntentSummary({ intent }: { intent: SetupIntentPayload }) {
  return (
    <aside className="setup-intent-summary" aria-labelledby="setup-intent-summary-title">
      <div>
        <p className="eyebrow">Meegenomen uit de setup builder</p>
        <h3 id="setup-intent-summary-title">Je opstelling staat klaar.</h3>
        <p>{setupBranchLabels[intent.branch]} · {intent.screenCount} {intent.screenCount === 1 ? "scherm" : "schermen"} · {intent.modules.length} bronnen</p>
      </div>
      <div>
        <span>14 dagen gratis</span>
        <strong>{formatGrossCents(intent.grossMonthlyCents)} per maand daarna</strong>
        <small>incl. btw</small>
      </div>
    </aside>
  );
}

type SeoPageShellProps = {
  page: MarketingPageDefinition;
  setupIntent?: SetupIntentPayload | null;
  setupIntentToken?: string | null;
  setupStatus?: "unavailable" | null;
};

export function SeoPageShell({ page, setupIntent, setupIntentToken, setupStatus }: SeoPageShellProps) {
  const breadcrumbs = breadcrumbsFor(page);
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faqs.map((faq) => ({
      "@type": "Question",
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.body
      },
      name: faq.title
    }))
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      item: canonicalUrl(item.href),
      name: item.label,
      position: index + 1
    }))
  };
  const articleSchema =
    page.kind === "article"
      ? {
          "@context": "https://schema.org",
          "@type": "Article",
          author: {
            "@type": "Organization",
            name: "VeyoCast",
            url: canonicalUrl("/")
          },
          dateModified: "2026-07-24",
          datePublished: "2026-07-24",
          description: page.description,
          headline: page.title,
          inLanguage: "nl-NL",
          mainEntityOfPage: canonicalUrl(page.pathname),
          publisher: {
            "@type": "Organization",
            name: "VeyoCast",
            url: canonicalUrl("/")
          }
        }
      : null;

  return (
    <>
      <JsonLd
        data={
          articleSchema
            ? [breadcrumbSchema, faqSchema, articleSchema]
            : [breadcrumbSchema, faqSchema]
        }
      />
      <main id="main-content">
        <section className={`page-hero page-hero--${page.kind}`}>
          <div className="marketing-container page-hero__grid">
            <Reveal className="page-hero__copy">
              <nav aria-label="Kruimelpad" className="breadcrumbs">
                <ol>
                  {breadcrumbs.map((item, index) => (
                    <li key={item.href}>
                      {index < breadcrumbs.length - 1 ? (
                        <Link href={item.href}>{item.label}</Link>
                      ) : (
                        <span aria-current="page">{item.label}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
              <p className="eyebrow">{page.eyebrow}</p>
              {page.kind === "article" ? (
                <p className="article-meta">
                  <time dateTime="2026-07-24">24 juli 2026</time>
                  <span>6 minuten leestijd</span>
                </p>
              ) : null}
              <h1>{page.title}</h1>
              <p className="page-hero__lead">{page.lead}</p>
              <div className="hero-actions">
                {page.primaryCta ? <CtaLink {...page.primaryCta} /> : null}
                {page.secondaryCta ? <CtaLink secondary {...page.secondaryCta} /> : null}
              </div>
            </Reveal>

            {page.imageId ? (
              <Reveal className="page-hero__visual" delay={0.08}>
                <ProductScreenshotFrame imageId={page.imageId} />
              </Reveal>
            ) : (
              <div aria-hidden className="page-hero__brandmark">
                <span>V</span>
              </div>
            )}
          </div>
        </section>

        <section className="page-intro marketing-section">
          <div className="marketing-container page-intro__grid">
            <Reveal>
              <p className="eyebrow">Waarom dit werkt</p>
              <h2>{page.summary}</h2>
            </Reveal>
            <Reveal className="page-intro__examples" delay={0.05}>
              <p>Veelgebruikte toepassingen</p>
              <ul>
                {page.examples.map((example) => (
                  <li key={example}>
                    <Check aria-hidden size={16} />
                    {example}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        <section className="benefits-section marketing-section">
          <div className="marketing-container">
            <SectionHeading
              description="Eén samenhangend systeem, uitgelegd vanuit het resultaat voor de beheerder."
              eyebrow="Praktisch voordeel"
              title="Rust in beheer. Zekerheid op het scherm."
            />
            <div className="benefit-card-grid">
              {page.benefits.map((benefit, index) => {
                const Icon = cardIcons[index % cardIcons.length]!;
                return (
                  <Reveal className="benefit-card" delay={index * 0.035} key={benefit.title}>
                    <span><Icon aria-hidden size={20} /></span>
                    <h3>{benefit.title}</h3>
                    <p>{benefit.body}</p>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {page.kind === "pricing" ? (
          <section className="pricing-section marketing-section">
            <div className="marketing-container">
              <SectionHeading
                align="center"
                description="Je betaalt voor het aantal actieve schermen. De calculator gebruikt uitsluitend hele centen en toont het bruto maandbedrag."
                eyebrow="14 dagen gratis"
                title="Eén prijs per actief scherm."
              />
              <MarketingPriceCalculator />
            </div>
          </section>
        ) : null}

        <section className="workflow-section marketing-section">
          <div className="marketing-container">
            <SectionHeading
              eyebrow="Zo pak je het aan"
              title="Van eerste keuze naar een actieve release."
            />
            <ol className="workflow-list">
              {page.steps.map((step, index) => (
                <li key={step.title}>
                  <Reveal delay={index * 0.04}>
                    <span>0{index + 1}</span>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.body}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {page.kind === "demo" || page.kind === "contact" ? (
          <section className="form-section marketing-section">
            <div className="marketing-container form-section__grid">
              <SectionHeading
                description={
                  page.kind === "demo"
                    ? "Vul alleen in wat nodig is om de demonstratie voor te bereiden."
                    : "Beschrijf je vraag zonder gevoelige account- of devicegegevens."
                }
                eyebrow={page.kind === "demo" ? "Demoaanvraag" : "Stuur een bericht"}
                title={
                  page.kind === "demo"
                    ? "Waar mogen we de demo op richten?"
                    : "Waar kunnen we bij helpen?"
                }
              />
              <div>
                {setupIntent ? <SetupIntentSummary intent={setupIntent} /> : null}
                {setupStatus === "unavailable" ? (
                  <div className="form-message form-message--unavailable" role="status">
                    De opstelling kon niet veilig worden meegenomen. Je kunt het formulier wel handmatig invullen of de setup builder opnieuw openen.
                  </div>
                ) : null}
                <LeadForm
                  kind={page.kind}
                  setupIntent={setupIntent}
                  setupIntentToken={setupIntentToken}
                />
              </div>
            </div>
          </section>
        ) : null}

        <section className="faq-section marketing-section">
          <div className="marketing-container faq-section__grid">
            <SectionHeading
              description="Kort, feitelijk en zonder een productstatus mooier te maken dan die is."
              eyebrow="Veelgestelde vragen"
              title="Wat je vooraf wilt weten."
            />
            <FaqAccordion items={page.faqs} />
          </div>
        </section>

        <section className="related-section">
          <div className="marketing-container">
            <SectionHeading
              eyebrow="Verder kijken"
              title="Verdiep de volgende stap."
            />
            <RelatedLinks links={page.related} />
          </div>
        </section>

        <FinalCtaBand
          primary={page.primaryCta ?? demoCta}
          title={
            page.kind === "article"
              ? "Klaar om dit naar jouw schermen te vertalen?"
              : undefined
          }
        />
      </main>
    </>
  );
}
