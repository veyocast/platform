import type { Metadata } from "next";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChartNoAxesColumn,
  CloudOff,
  DatabaseZap,
  FolderOpen,
  LayoutList,
  MonitorCheck,
  PlugZap,
  Radio,
  ShieldCheck,
  Smartphone,
  Sparkles
} from "lucide-react";
import Link from "next/link";

import {
  VEYOCAST_SCREEN_PRICE_GROSS_CENTS,
  VEYOCAST_TRIAL_DURATION_HOURS
} from "@veyocast/domain";

import { JsonLd } from "./_components/json-ld";
import {
  BenefitList,
  CtaLink,
  FinalCtaBand,
  SectionHeading
} from "./_components/marketing-primitives";
import { Reveal } from "./_components/motion";
import {
  DeviceShowcase,
  HeroProductStage,
  ProductScreenshotFrame,
  ReliabilityDiagram
} from "./_components/product-showcase";
import { canonicalUrl } from "./_lib/site-config";
import { VenueSetupBuilder } from "./_components/venue-setup-builder";

export const metadata: Metadata = {
  alternates: { canonical: canonicalUrl("/") },
  description:
    "VeyoCast is ClubTV en narrowcasting voor sportverenigingen: beheer media, playlists en schermen centraal en speel betrouwbaar offline door.",
  openGraph: {
    description:
      "Beheer media, playlists en schermen centraal met VeyoCast ClubTV en narrowcasting.",
    locale: "nl_NL",
    title: "VeyoCast | ClubTV en narrowcasting voor sportverenigingen",
    type: "website",
    url: canonicalUrl("/")
  },
  title: "Living Venue OS voor ieder scherm | VeyoCast"
};

const featureCards = [
  {
    body: "Maak, orden en pas content aan met een overzichtelijke Playlist Studio.",
    href: "/functies/playlists",
    icon: LayoutList,
    title: "Playlists beheren"
  },
  {
    body: "Bekijk de status van ieder gekoppeld scherm en open alleen wat aandacht vraagt.",
    href: "/functies/schermen",
    icon: MonitorCheck,
    title: "Schermen monitoren"
  },
  {
    body: "Centraliseer afbeeldingen en video’s in een veilige, doorzoekbare bibliotheek.",
    href: "/functies/media",
    icon: FolderOpen,
    title: "Media organiseren"
  },
  {
    body: "Bereid content voor rond wedstrijden, activiteiten en tijdelijke campagnes.",
    href: "/functies/planning",
    icon: CalendarDays,
    title: "Slim plannen"
  }
] as const;

const trustSegments = [
  "Sportlink",
  "Twelve XLSX",
  "RSS & nieuws",
  "Sponsor Hub",
  "Eigen media"
] as const;

const livingVenueJourney = [
  ["Create", "Studio en dynamische slides"],
  ["Connect", "Schermen, zones en bronnen"],
  ["Publish", "Preflight en veilige release"],
  ["Manage", "System Pulse en Screen 360"],
  ["Engage", "Polls en publieksactie · in voorbereiding"],
  ["Measure", "Status en bewijs van vertoning"]
] as const;

const integrationCards = [
  ["Sportlink", "Teams, programma, uitslagen, standen en bezoekersinformatie.", "Beschikbaar"],
  ["Twelve XLSX", "Normale .xlsx-import met mapping, validatie en bronversie.", "Import"],
  ["RSS & nieuws", "Bronstatus, stale data, fallback en portrait/landscape-output.", "Beschikbaar"],
  ["YouTube", "Officiële online-only playback en preflight worden nog gevalideerd.", "In voorbereiding"]
] as const;

function formatGrossCents(cents: number) {
  return `€ ${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}

const heroBenefits = [
  { icon: Sparkles, label: "Alles-in-één" },
  { icon: CloudOff, label: "Offline betrouwbaar" },
  { icon: Smartphone, label: "Overal beheren" },
  { icon: ShieldCheck, label: "Gebouwd voor clubs" }
] as const;

const proofCards = [
  {
    body: "Een gepubliceerde versie verandert niet stilzwijgend. Nieuwe inhoud krijgt een nieuwe release.",
    label: "Publicatie",
    title: "Immutable releases"
  },
  {
    body: "Players bewaren de laatst geldige release en blijven die bij tijdelijk internetverlies afspelen.",
    label: "Betrouwbaarheid",
    title: "Last-known-good"
  },
  {
    body: "Organisatiecontext, rollen en resource-eigendom worden bij serveracties opnieuw gecontroleerd.",
    label: "Toegang",
    title: "Server-side bevoegdheden"
  }
] as const;

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            address: {
              "@type": "PostalAddress",
              addressCountry: "NL",
              addressLocality: "Den Haag",
              postalCode: "2583 KR",
              streetAddress: "Markenseplein 1"
            },
            email: "support@veyocast.nl",
            legalName: "DG Webservices",
            name: "VeyoCast",
            url: canonicalUrl("/")
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            inLanguage: "nl-NL",
            name: "VeyoCast",
            url: canonicalUrl("/")
          },
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            applicationCategory: "BusinessApplication",
            name: "VeyoCast",
            operatingSystem: "Web, Android",
            url: canonicalUrl("/product")
          }
        ]}
      />
      <main id="main-content">
        <section className="home-hero">
          <div className="marketing-container home-hero__grid">
            <Reveal className="home-hero__copy">
              <p className="eyebrow">VeyoCast Living Venue OS</p>
              <h1>Elk scherm. Elk bericht. Elk moment.</h1>
              <p className="home-hero__lead">
                Creëer, verbind, publiceer en beheer iedere schermervaring in
                je locatie vanuit één betrouwbaar platform.
              </p>
              <div className="hero-actions">
                <CtaLink href="#opstelling" label="Bouw je opstelling" />
                <CtaLink href="/demo" label="Plan een demo" secondary />
              </div>
              <ul className="hero-benefits">
                {heroBenefits.map(({ icon: Icon, label }) => (
                  <li key={label}>
                    <Icon aria-hidden size={23} />
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal className="home-hero__visual" delay={0.08}>
              <HeroProductStage />
            </Reveal>
          </div>
        </section>

        <section aria-label="Beschikbare bronnen en integraties" className="trust-strip-wrap">
          <div className="marketing-container trust-strip">
            <p>Werkt met je bestaande content</p>
            <ul>
              {trustSegments.map((segment, index) => (
                <li key={segment}>
                  <span aria-hidden>{String(index + 1).padStart(2, "0")}</span>
                  {segment}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <VenueSetupBuilder />

        <section className="living-journey marketing-section" aria-label="VeyoCast productjourney">
          <div className="marketing-container">
            <SectionHeading
              description="Van eerste ontwerp tot aantoonbare schermstatus: iedere stap gebruikt dezelfde locatie-, tenant- en releasecontext."
              eyebrow="Eén operationele keten"
              title="Create. Connect. Publish. Manage. Engage. Measure."
            />
            <ol className="living-journey__steps">
              {livingVenueJourney.map(([title, body], index) => (
                <li key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{title}</strong>
                  <small>{body}</small>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="home-features marketing-section">
          <div className="marketing-container home-features__grid">
            <Reveal className="home-features__intro">
              <p className="eyebrow">Eenvoudig. Flexibel. Betrouwbaar.</p>
              <h2>Van idee naar ieder scherm, zonder gedoe.</h2>
              <p>
                Of je nu één scherm in de kantine hebt of een netwerk van
                locaties: VeyoCast maakt beheren en publiceren begrijpelijk.
              </p>
              <BenefitList
                items={[
                  "Intuïtieve playlists met drag-and-drop",
                  "Geschikt voor ieder scherm en elke locatie",
                  "Plan op tijd, datum of clubmoment",
                  "Publiceer direct of bereid vooruit",
                  "Blijft lokaal spelen bij tijdelijk internetverlies"
                ]}
              />
            </Reveal>

            <div className="feature-card-grid">
              {featureCards.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Reveal className="feature-card" delay={index * 0.04} key={feature.title}>
                    <span className="feature-card__icon"><Icon aria-hidden size={20} /></span>
                    <h3>{feature.title}</h3>
                    <p>{feature.body}</p>
                    <Link href={feature.href}>
                      Meer over {feature.title.toLowerCase()}
                      <ArrowRight aria-hidden size={16} />
                    </Link>
                  </Reveal>
                );
              })}
            </div>

            <Reveal className="home-features__phone" delay={0.1}>
              <ProductScreenshotFrame imageId="product-publisher-mobile" label="Mobiele Publisher" />
            </Reveal>
          </div>
        </section>

        <section className="platform-section marketing-section">
          <div className="marketing-container platform-section__grid">
            <Reveal className="platform-section__copy">
              <p className="eyebrow">System Pulse</p>
              <h2>Zie eerst waar actie nodig is.</h2>
              <p>
                Online, synchroniseert, wacht op een release, offline en aandacht
                blijven verschillende statussen. Zo begint beheer bij afwijkingen,
                niet bij vanitycijfers.
              </p>
              <div className="platform-feature-list">
                {[
                  ["Schermgezondheid", "Heartbeat, Player-versie en actuele release in context."],
                  ["Releasevoortgang", "Gewenst, downloaden, verifiëren en actief blijven onderscheiden."],
                  ["Veilige publicaties", "De actieve release blijft staan tot de nieuwe compleet is."],
                  ["Bronstatus", "Laatste sync, stale data en fouten vragen gericht aandacht."]
                ].map(([title, body]) => (
                  <div key={title}>
                    <Check aria-hidden size={17} />
                    <p><strong>{title}</strong><span>{body}</span></p>
                  </div>
                ))}
              </div>
              <Link className="text-link" href="/publisher">
                Ontdek schermbeheer <ArrowRight aria-hidden size={16} />
              </Link>
            </Reveal>
            <Reveal className="platform-section__visual" delay={0.08}>
              <DeviceShowcase />
            </Reveal>
          </div>
        </section>

        <section className="integration-world marketing-section" aria-label="Bronnen en integraties">
          <div className="marketing-container">
            <SectionHeading
              description="Beschikbare modules worden als beschikbaar benoemd; nieuwe sporen blijven in voorbereiding tot hun technische en commerciële gates groen zijn."
              eyebrow="Bronnen met een eerlijke status"
              title="Sportlink, prijslijsten, nieuws en eigen media."
            />
            <div className="integration-world__grid">
              {integrationCards.map(([title, body, status], index) => (
                <article key={title}>
                  <span aria-hidden>{index === 0 ? <Radio /> : index === 1 ? <DatabaseZap /> : index === 2 ? <PlugZap /> : <ChartNoAxesColumn />}</span>
                  <div><h3>{title}</h3><p>{body}</p></div>
                  <small>{status}</small>
                </article>
              ))}
            </div>
            <Link className="text-link" href="/integraties">Bekijk alle bronstatussen <ArrowRight aria-hidden size={16} /></Link>
          </div>
        </section>

        <section className="venue-section">
          <div className="marketing-container venue-section__grid">
            <Reveal className="venue-section__copy">
              <p className="eyebrow">Voor elke locatie</p>
              <h2>Meer beleving.<br />Meer zichtbaarheid.<br />Meer club.</h2>
              <p>
                Van wedstrijdinformatie tot sponsoruitingen en kantinemenu:
                informeer, inspireer en betrek leden en bezoekers.
              </p>
              <Link className="text-link text-link--inverse" href="/clubtv">
                Ontdek ClubTV <ArrowRight aria-hidden size={16} />
              </Link>
            </Reveal>
            <div className="venue-screen-wall" aria-label="Voorbeelden van ClubTV-content">
              <article>
                <span>Volgende wedstrijd</span>
                <strong>Thuis<br />vs<br />Uit</strong>
                <small>Zaterdag · 19:30</small>
              </article>
              <article className="venue-screen-wall__sponsor">
                <span>Trots op onze sponsor</span>
                <strong>Jouw partner</strong>
                <small>Zichtbaar op de club</small>
              </article>
              <article>
                <span>Kantinemenu</span>
                <strong>Vandaag</strong>
                <small>Koffie · lunch · snack</small>
              </article>
            </div>
          </div>
          <div className="venue-benefits">
            <div className="marketing-container">
              {[
                ["Dynamische content", "Altijd actueel in één release."],
                ["Sponsor in de spotlight", "Verzorgd en op het juiste moment."],
                ["Eenvoudig up-to-date", "Minder losse bestanden."],
                ["Betrek je publiek", "Informatie waar mensen kijken."]
              ].map(([title, body]) => (
                <div key={title}>
                  <Check aria-hidden size={16} />
                  <p><strong>{title}</strong><span>{body}</span></p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="reliability-section marketing-section">
          <div className="marketing-container reliability-section__grid">
            <Reveal>
              <p className="eyebrow">Betrouwbaarheid als producteigenschap</p>
              <h2>Blijft spelen. Ook als internet even niet meewerkt.</h2>
              <p>
                Een nieuwe release wordt eerst volledig gedownload en
                geverifieerd. Tot die tijd blijft de geldige lokale versie
                gewoon actief.
              </p>
              <Link className="text-link text-link--inverse" href="/functies/offline-afspelen">
                Lees over offline afspelen <ArrowRight aria-hidden size={16} />
              </Link>
            </Reveal>
            <Reveal delay={0.08}>
              <ReliabilityDiagram />
            </Reveal>
          </div>
        </section>

        <section className="proof-section marketing-section">
          <div className="marketing-container">
            <SectionHeading
              align="center"
              description="Zonder fictieve testimonials of klantlogo’s. Deze punten zijn rechtstreeks herleidbaar tot de huidige productarchitectuur."
              eyebrow="Vertrouwen zit in de werking"
              title="Geen mooie belofte zonder productbewijs."
            />
            <div className="proof-card-grid">
              {proofCards.map((proof, index) => (
                <Reveal className="proof-card" delay={index * 0.04} key={proof.title}>
                  <p>{proof.label}</p>
                  <h3>{proof.title}</h3>
                  <span>{proof.body}</span>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="mobile-engage marketing-section">
          <div className="marketing-container mobile-engage__grid">
            <div>
              <p className="eyebrow">Bediening op locatie</p>
              <h2>Pair, publiceer en herstel vanaf mobiel.</h2>
              <p>De beheerapp richt zich op snelle operationele acties: camera-upload, QR-pairing, schermstatus, playlistvolgorde, publicatie en recovery. De vrije desktopcanvas blijft bewust in Studio.</p>
              <Link className="text-link text-link--inverse" href="/product">Bekijk de productfamilie <ArrowRight aria-hidden size={16} /></Link>
            </div>
            <aside>
              <span className="status-chip">In voorbereiding</span>
              <h3>Engage</h3>
              <p>Mobile-first polls, Man of the Match en live schermresultaten worden pas vrijgegeven na tenantisolatie, privacy-, rate-limit- en abusegates.</p>
            </aside>
          </div>
        </section>

        <section className="home-price marketing-section">
          <div className="marketing-container home-price__grid">
            <div>
              <p className="eyebrow">Transparant vanaf het eerste scherm</p>
              <h2>{VEYOCAST_TRIAL_DURATION_HOURS / 24} dagen gratis.</h2>
              <p>Daarna <strong>{formatGrossCents(VEYOCAST_SCREEN_PRICE_GROSS_CENTS)} inclusief btw</strong> per actief scherm per maand. Geen verborgen schermtoeslag.</p>
            </div>
            <div className="hero-actions">
              <CtaLink href="/#opstelling" label="Bereken je opstelling" />
              <CtaLink href="/prijzen" label="Bekijk de prijs" secondary />
            </div>
          </div>
        </section>

        <FinalCtaBand />
      </main>
    </>
  );
}
