import type { Metadata } from "next";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CirclePlay,
  Cloud,
  LayoutDashboard,
  Monitor,
  Play,
  Radio,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Zap
} from "lucide-react";
import Link from "next/link";

import {
  VEYOCAST_SCREEN_PRICE_GROSS_CENTS,
  VEYOCAST_TRIAL_DURATION_HOURS
} from "@veyocast/domain";

import { JsonLd } from "./_components/json-ld";
import { CtaLink } from "./_components/marketing-primitives";
import { Reveal } from "./_components/motion";
import { ResilientMarketingImage } from "./_components/resilient-marketing-image";
import { VenueSetupBuilder } from "./_components/venue-setup-builder";
import { canonicalUrl } from "./_lib/site-config";

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

const routes = [
  { icon: Sparkles, subtitle: "Maak content", title: "Studio" },
  { icon: CalendarDays, subtitle: "Kies het moment", title: "Planning" },
  { icon: Play, subtitle: "Zet het live", title: "Publiceren" },
  { icon: Monitor, subtitle: "Bereik de club", title: "Schermen" }
] as const;

const trustItems = [
  { body: "Van idee naar ieder scherm", icon: Zap, title: "Binnen minuten live" },
  { body: "Van kantine tot kleedkamer", icon: UsersRound, title: "Voor iedere vereniging" },
  { body: "Veilig, stabiel en inzichtelijk", icon: ShieldCheck, title: "Betrouwbaar geregeld" },
  { body: "Automatisch waar het kan", icon: Cloud, title: "Altijd actueel" }
] as const;

function formatGrossCents(cents: number) {
  return `€ ${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}

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
            "@type": "SoftwareApplication",
            applicationCategory: "BusinessApplication",
            name: "VeyoCast",
            operatingSystem: "Web, Android",
            url: canonicalUrl("/product")
          }
        ]}
      />

      <main className="prototype-home" id="main-content">
        <section className="prototype-hero">
          <div className="marketing-container prototype-hero__grid">
            <Reveal className="prototype-hero__copy">
              <p className="prototype-kicker prototype-kicker--pill">
                <Sparkles aria-hidden size={14} />
                Narrowcasting voor verenigingen
              </p>
              <h1>
                <span className="prototype-hero__line">Van</span>
                <span className="prototype-hero__line">clubverhaal</span>
                <span className="prototype-hero__line">
                  naar <em>ieder</em>
                </span>
                <span className="prototype-hero__line prototype-hero__line--accent">scherm.</span>
              </h1>
              <p className="prototype-hero__lead">
                Maak, plan en publiceer alles wat er binnen jouw vereniging
                speelt. Rustig geregeld vanuit één heldere omgeving.
              </p>
              <div className="prototype-actions">
                <CtaLink href="/demo" label="Open de live demo" />
                <a className="prototype-play-link" href="#opstelling">
                  <span><CirclePlay aria-hidden size={17} /></span>
                  Bekijk hoe het werkt
                </a>
              </div>
              <div className="prototype-hero__made-for">
                <span aria-hidden className="prototype-club-colours">
                  <i /><i /><i /><i />
                </span>
                <p>
                  <strong>Gemaakt met verenigingen</strong>
                  <span>Eenvoudig voor iedere vrijwilliger</span>
                </p>
              </div>
            </Reveal>

            <Reveal className="prototype-hero__stage" delay={0.08}>
              <div className="prototype-hero__media">
                <ResilientMarketingImage
                  alt="Clubleden verzamelen bij het clubhuis terwijl VeyoCast de schermpublicatie beheert"
                  className="prototype-cover-image"
                  fill
                  priority
                  sizes="(max-width: 900px) 100vw, 58vw"
                  src="/fieldflow/photos/FF-PHOTO-01-clubhouse-exterior-3840x2160-web.webp"
                />
              </div>
              <div className="prototype-stage-chip prototype-stage-chip--top">
                <span className="prototype-stage-chip__icon"><Radio aria-hidden size={17} /></span>
                <div>
                  <small>Nu actief</small>
                  <strong>Wedstrijd vandaag</strong>
                  <em>Kantine · 18 schermen</em>
                </div>
                <b>Live</b>
              </div>
              <div className="prototype-stage-chip prototype-stage-chip--side">
                <span className="prototype-stage-chip__check"><Check aria-hidden size={17} /></span>
                <div><strong>Alles werkt</strong><em>20 van 20 schermen online</em></div>
              </div>
              <div className="prototype-player-bar">
                <span><Sparkles aria-hidden size={14} /> Idee</span>
                <i><b /></i>
                <span><CalendarDays aria-hidden size={14} /> Plan</span>
                <i><b /></i>
                <span><Monitor aria-hidden size={14} /> Live</span>
              </div>
            </Reveal>
          </div>

          <div className="marketing-container prototype-trust" aria-label="Belangrijkste voordelen">
            {trustItems.map(({ body, icon: Icon, title }) => (
              <div key={title}>
                <Icon aria-hidden size={22} />
                <p><strong>{title}</strong><span>{body}</span></p>
              </div>
            ))}
          </div>
        </section>

        <section className="prototype-section prototype-route">
          <div className="marketing-container">
            <Reveal className="prototype-heading prototype-heading--route">
              <p className="prototype-kicker">Een rustige beweging</p>
              <h2 className="prototype-line-heading">
                <span>Je boodschap vindt</span>{" "}
                <span>vanzelf</span>{" "}
                <span>de juiste weg.</span>
              </h2>
              <span>
                Geen losse bestanden, ingewikkelde menu&apos;s of dubbele planning.
                FieldFlow maakt de hele route zichtbaar.
              </span>
            </Reveal>
            <ol className="prototype-route__grid">
              {routes.map(({ icon: Icon, subtitle, title }, index) => (
                <li key={title}>
                  <div><Icon aria-hidden size={22} /></div>
                  <p><strong>{title}</strong><span>{subtitle}</span></p>
                  <small>{String(index + 1).padStart(2, "0")}</small>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="prototype-section prototype-pulse">
          <div className="marketing-container prototype-split">
            <Reveal className="prototype-pulse__copy">
              <p className="prototype-kicker">Vandaag in jouw club</p>
              <h2>Direct zien wat er speelt.</h2>
              <p>
                Het dashboard begint niet met grafieken, maar met wat aandacht
                nodig heeft. Alles wat goed gaat blijft rustig op de achtergrond.
              </p>
              <ul>
                <li><Check aria-hidden size={15} /> Live-status van ieder scherm</li>
                <li><Check aria-hidden size={15} /> Planning per groep, ruimte of moment</li>
                <li><Check aria-hidden size={15} /> Sportlink, nieuws, sponsors en eigen media</li>
              </ul>
              <CtaLink href="/publisher" label="Ontdek het dashboard" />
            </Reveal>
            <Reveal delay={0.08}>
              <DashboardPreview />
            </Reveal>
          </div>
        </section>

        <VenueSetupBuilder />

        <section className="prototype-section prototype-tailored">
          <div className="marketing-container">
            <Reveal className="prototype-heading prototype-heading--center">
              <p className="prototype-kicker">Past zich aan jouw clubritme aan</p>
              <h2 className="prototype-line-heading">
                <span>Ieder moment voelt als</span>{" "}
                <span>maatwerk.</span>
              </h2>
              <span>
                Van wedstrijddag tot sponsorweek: één herkenbare stijl,
                automatisch afgestemd op plek en tijd.
              </span>
            </Reveal>
            <Reveal delay={0.08}>
              <ScenarioPreview />
            </Reveal>
          </div>
        </section>

        <section className="prototype-section prototype-platform">
          <div className="marketing-container">
            <Reveal className="prototype-heading prototype-heading--center">
              <p className="prototype-kicker">Van iedereen. Voor iedereen.</p>
              <h2 className="prototype-line-heading">
                <span>Eén platform voor de</span>{" "}
                <span>hele club.</span>
              </h2>
            </Reveal>
            <div className="prototype-platform__grid">
              <Reveal className="prototype-platform-card prototype-platform-card--photo">
                <ResilientMarketingImage
                  alt="Vrijwilligers bereiden de communicatie in het clubhuis voor"
                  className="prototype-cover-image"
                  fill
                  sizes="(max-width: 700px) 100vw, 34vw"
                  src="/fieldflow/photos/FF-PHOTO-05-sponsor-hub-3840x2160-web.webp"
                />
                <div className="prototype-platform-card__content">
                  <small>Vrijwilligers</small>
                  <h3>Duidelijk, ook als je het maar één keer per week gebruikt.</h3>
                </div>
              </Reveal>

              <Reveal className="prototype-platform-card prototype-platform-card--roles" delay={0.04}>
                <div className="prototype-platform-card__content">
                  <span className="prototype-platform-card__icon"><Monitor aria-hidden size={22} /></span>
                  <h3>Ieder scherm heeft zijn eigen rol.</h3>
                  <p>Kantine, hal, kleedkamer of buitenveld. Combineer schermen vrij in meerdere groepen.</p>
                  <div className="prototype-screen-map" aria-hidden>
                    <i /><i /><i /><i />
                    <span /><span /><span />
                  </div>
                </div>
              </Reveal>

              <Reveal className="prototype-platform-card prototype-platform-card--moment" delay={0.08}>
                <div className="prototype-platform-card__content">
                  <span className="prototype-platform-card__icon"><Zap aria-hidden size={22} /></span>
                  <h3>Reageer op het moment.</h3>
                  <p>Publiceer direct of laat live gebeurtenissen automatisch een tijdelijke slide starten.</p>
                  <div className="prototype-goal-status">
                    <strong>GOAL</strong><span>Alle buitenschermen</span><b>Nu actief</b>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="prototype-section prototype-club-feel">
          <div className="marketing-container prototype-club-feel__panel">
            <div className="prototype-club-feel__image">
              <ResilientMarketingImage
                alt="Vrijwilligers in een sfeervol clubhuis met een groot scherm"
                className="prototype-cover-image"
                fill
                sizes="(max-width: 760px) 100vw, 55vw"
                src="/fieldflow/photos/FF-PHOTO-04-matchday-live-3840x2160-web.webp"
              />
            </div>
            <Reveal className="prototype-club-feel__copy">
              <p className="prototype-kicker">Geen software om software</p>
              <h2>Meer clubgevoel. Minder beheer.</h2>
              <p>
                FieldFlow blijft uit de weg wanneer alles goed gaat en helpt
                precies wanneer je iets wilt maken, aanpassen of publiceren.
              </p>
              <Link className="button button--light" href="/publisher">
                Probeer de Studio <ArrowRight aria-hidden size={16} />
              </Link>
            </Reveal>
          </div>
        </section>

        <section className="prototype-price">
          <div className="marketing-container prototype-price__card">
            <div>
              <p className="prototype-kicker">Eenvoudige prijs</p>
              <h2 className="prototype-line-heading">
                <span>Alles wat je nodig hebt.</span>{" "}
                <span>Geen ingewikkelde pakketten.</span>
              </h2>
            </div>
            <p><small>Vanaf</small><strong>{formatGrossCents(VEYOCAST_SCREEN_PRICE_GROSS_CENTS)}</strong><span>per scherm / maand</span></p>
            <div>
              <Link className="button button--primary" href="/demo">
                Start {VEYOCAST_TRIAL_DURATION_HOURS / 24} dagen gratis
                <ArrowRight aria-hidden size={16} />
              </Link>
              <span>Geen creditcard nodig</span>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function DashboardPreview() {
  return (
    <div
      aria-label="Voorbeeld van het VeyoCast-dashboard met schermstatus, planning en actieve clubcontent"
      className="prototype-dashboard"
      role="img"
    >
      <div className="prototype-dashboard__chrome">
        <ResilientMarketingImage
          alt=""
          aria-hidden
          height={27}
          src="/brand/veyocast-logo-primary.svg"
          width={108}
        />
        <div><span><i /> Alles werkt</span><b>DG</b></div>
      </div>
      <div className="prototype-dashboard__frame">
        <aside aria-hidden>
          <span><LayoutDashboard size={19} /></span>
          <Sparkles size={19} />
          <Monitor size={19} />
          <CalendarDays size={19} />
        </aside>
        <div className="prototype-dashboard__body">
          <h3>Goedemorgen, Danny</h3>
          <div className="prototype-dashboard__stats">
            <p><small>Online</small><strong>20/20</strong></p>
            <p><small>Nu actief</small><strong>7</strong></p>
            <p><small>Gepland</small><strong>12</strong></p>
          </div>
          <div className="prototype-dashboard__flow">
            {routes.map(({ icon: Icon, title }) => (
              <p key={title}><span><Icon aria-hidden size={17} /></span><strong>{title}</strong></p>
            ))}
          </div>
          <div className="prototype-dashboard__now">
            <div className="prototype-dashboard__thumb">
              <ResilientMarketingImage
                alt=""
                className="prototype-cover-image"
                fill
                sizes="380px"
                src="/fieldflow/photos/FF-PHOTO-06-community-3840x2560-web.webp"
              />
            </div>
            <div aria-hidden className="prototype-dashboard__skeleton"><i /><i /><i /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScenarioPreview() {
  const moments = [
    ["11:30", "Welkom thuis", "Entree + kantine"],
    ["14:15", "Opstelling Heren 1", "Alle schermen"],
    ["16:20", "Eindstand & socials", "Clubhuis + buiten"]
  ] as const;

  return (
    <div
      aria-label="Voorbeeld van een automatische wedstrijddagplanning"
      className="prototype-scenario"
      role="group"
    >
      <div className="prototype-scenario__tabs" aria-hidden>
        <span><b>01</b> Wedstrijddag</span>
        <span><b>02</b> Clubavond</span>
        <span><b>03</b> Sponsorweek</span>
      </div>
      <div className="prototype-scenario__body">
        <div className="prototype-scenario__visual">
          <ResilientMarketingImage
            alt=""
            className="prototype-cover-image"
            fill
            sizes="(max-width: 900px) 100vw, 68vw"
            src="/fieldflow/photos/FF-PHOTO-06-community-3840x2560-web.webp"
          />
          <div>
            <span><Radio aria-hidden size={14} /> Vandaag vanaf 11:30</span>
            <strong>De hele club leeft mee.</strong>
            <p>Welkom, opstellingen, sponsors en de uitslag wisselen vanzelf mee met het programma.</p>
            <small><i><Monitor aria-hidden size={13} /> 18 schermen</i><i><Zap aria-hidden size={13} /> Automatisch</i></small>
          </div>
        </div>
        <aside className="prototype-scenario__schedule">
          <header><span><CalendarDays aria-hidden size={18} /></span><p><small>Scenario</small><strong>Wedstrijddag</strong></p><b><i /> Actief</b></header>
          <ol>
            {moments.map(([time, title, place]) => (
              <li key={time}><time>{time}</time><i /><p><strong>{title}</strong><span>{place}</span></p><Check aria-hidden size={15} /></li>
            ))}
          </ol>
          <Link href="/functies/planning">Open deze planning <ArrowRight aria-hidden size={15} /></Link>
        </aside>
      </div>
    </div>
  );
}
