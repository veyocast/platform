import Image from "next/image";

const useCases = [
  {
    body: "Laat clubnieuws, wedstrijdaankondigingen en sponsorcontent op vaste schermen draaien zonder handmatige bestandwissels.",
    eyebrow: "Sportvereniging",
    title: "ClubTV voor kantine en entree"
  },
  {
    body: "Geef beheerders een gecontroleerde route van upload naar publish review, met status op media, release en scherm.",
    eyebrow: "Tenantbeheer",
    title: "Een rustige workflow voor operators"
  },
  {
    body: "Spelers halen een vaste release op, bewaren geldige media lokaal en blijven doorspelen bij tijdelijk netwerkverlies.",
    eyebrow: "Beheerd scherm",
    title: "Offline-first playback"
  }
] as const;

const productPlanes = [
  ["Control", "Tenantbeheer, media, playlists, schermen en publish review."],
  ["Player", "Fullscreen playback met last-known-good cache en atomische updates."],
  ["Media worker", "Validatie, metadata, checksum en veilige player-varianten."],
  ["Security", "Multi-tenant RLS, rollen en revocable device sessions."]
] as const;

const pilotSteps = [
  ["1", "Tenant aanmaken", "Platformadmin maakt een organisatie en nodigt tenantadmin uit."],
  ["2", "Media voorbereiden", "Operator uploadt beelden en video binnen MVP-limieten."],
  ["3", "Release publiceren", "Publish review maakt een immutable release voor schermen."],
  ["4", "Player koppelen", "Device krijgt een revocable sessie en speelt online/offline."]
] as const;

const statusRows = [
  ["Media", "3 ready assets", "ok"],
  ["Publish", "1 review blokkade", "watch"],
  ["Player", "offline cache warm", "ok"]
] as const;

export default function MarketingPage() {
  return (
    <main>
      <header className="site-header" aria-label="VeyoCast marketing navigatie">
        <a className="brand-link" href="#top" aria-label="VeyoCast homepage">
          <Image
            alt=""
            aria-hidden="true"
            className="brand-link__logo"
            height="32"
            src="/brand/veyocast-logo-inverse.svg"
            width="126"
          />
        </a>
        <nav className="site-nav" aria-label="Pagina">
          <a href="#use-cases">Gebruik</a>
          <a href="#platform">Platform</a>
          <a href="#pilot">Pilotpad</a>
        </nav>
        <a className="header-cta" href="#pilot">
          Start pilotcheck
        </a>
      </header>

      <section className="hero" id="top" aria-labelledby="hero-title">
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-screen hero-screen--control">
            <div className="hero-screen__bar">
              <span />
              <span />
              <span />
            </div>
            <div className="hero-screen__grid">
              <span className="hero-screen__metric">Media gereed</span>
              <span className="hero-screen__metric">Release v3</span>
              <span className="hero-screen__metric">14 schermen</span>
              <span className="hero-screen__metric">RLS actief</span>
            </div>
          </div>
          <div className="hero-screen hero-screen--player">
            <p>Clubhuis entree</p>
            <strong>Welkom bij de club</strong>
            <span>OFFLINE_PLAYING</span>
          </div>
          <div className="hero-status">
            {statusRows.map(([label, value, tone]) => (
              <span className={`hero-status__row hero-status__row--${tone}`} key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className="hero-copy">
          <p className="eyebrow">Narrowcasting voor sportverenigingen en beheerde schermen</p>
          <h1 id="hero-title">VeyoCast</h1>
          <p className="hero-lede">
            Een local-first platform voor ClubTV: beheer media, publiceer vaste
            releases en laat players fullscreen doorspelen, ook wanneer het
            netwerk even wegvalt.
          </p>
          <div className="hero-actions" aria-label="Hoofdacties">
            <a className="button button--primary" href="#pilot">
              Bekijk pilotpad
            </a>
            <a className="button button--ghost" href="#platform">
              Zie platformopbouw
            </a>
          </div>
        </div>
      </section>

      <section className="proof-band" aria-label="MVP uitgangspunten">
        <p>Geen advertentienetwerk.</p>
        <p>Geen mutable releases.</p>
        <p>Geen Supabase Auth-user voor players.</p>
      </section>

      <section className="content-section" id="use-cases" aria-labelledby="use-cases-title">
        <div className="section-heading">
          <p className="eyebrow">Gebruik</p>
          <h2 id="use-cases-title">Gebouwd rond echte schermoperatie.</h2>
          <p>
            De homepage beschrijft alleen wat in de MVP-flow bestaat: tenantbeheer,
            media, playlists, publish review, schermen, pairing en offline playback.
          </p>
        </div>
        <div className="use-case-grid">
          {useCases.map((useCase) => (
            <article className="use-case" key={useCase.title}>
              <p>{useCase.eyebrow}</p>
              <h3>{useCase.title}</h3>
              <span>{useCase.body}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="platform-band" id="platform" aria-labelledby="platform-title">
        <div className="section-heading section-heading--dark">
          <p className="eyebrow">Platform</p>
          <h2 id="platform-title">Een vaste route van upload naar scherm.</h2>
          <p>
            VeyoCast splitst het publieke verhaal, de beheeromgeving, de player en
            de media worker. Daardoor blijft elke release controleerbaar.
          </p>
        </div>
        <div className="plane-grid">
          {productPlanes.map(([title, body]) => (
            <article className="plane" key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-section" id="pilot" aria-labelledby="pilot-title">
        <div className="section-heading">
          <p className="eyebrow">Pilotpad</p>
          <h2 id="pilot-title">Van organisatie naar spelend scherm.</h2>
          <p>
            Dit is de lokale MVP-route waar S12 op eindigt. De stappen zijn
            toetsbaar in Control, database policies, player playback en browsergates.
          </p>
        </div>
        <ol className="pilot-steps">
          {pilotSteps.map(([number, title, body]) => (
            <li className="pilot-step" key={title}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="cta-band" aria-labelledby="cta-title">
        <div>
          <p className="eyebrow">Pilot-ready richting</p>
          <h2 id="cta-title">Eerst lokaal betrouwbaar, daarna pas opschalen.</h2>
        </div>
        <p>
          S10 maakt het publieke verhaal consistent met de technische canon. De
          volgende sprint kan security, toegankelijkheid en reliability gates
          aanscherpen over alle planes.
        </p>
      </section>
    </main>
  );
}
