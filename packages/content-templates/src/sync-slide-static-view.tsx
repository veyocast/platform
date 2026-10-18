import React, { type CSSProperties } from "react";
import QR from "qrcode";
import {
  syncContentFamilies,
  syncSlidePresentationSchema,
  syncSlidePageCount,
  type SyncSlideAsset,
  type SyncSlidePresentation,
} from "@veyocast/contracts";
import { syncSlideCss } from "./sync-slide-styles";

export type SyncSlideAssetResolver = (
  asset: SyncSlideAsset,
) => string | undefined;
export const resolveSyncSystemAsset: SyncSlideAssetResolver = (asset) =>
  asset.kind === "system" ? asset.path : undefined;
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

function Crest({
  name,
  away = false,
  logo,
  resolveAsset,
}: {
  name: string;
  away?: boolean;
  logo?: SyncSlideAsset;
  resolveAsset: SyncSlideAssetResolver;
}) {
  const src = logo && resolveAsset(logo);
  // Uploaded club artwork is authoritative. Never draw a fabricated club logo or founding year.
  return (
    <div
      className={`vc-crest${away ? " away" : ""}`}
      style={{ background: "transparent", clipPath: "none", filter: "none" }}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      ) : (
        <strong>{initials(name)}</strong>
      )}
    </div>
  );
}
function Radio() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.9 19.1a10 10 0 0 1 0-14.1M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M19.1 4.9a10 10 0 0 1 0 14.1" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
function ArrowRight({ size }: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}
function Play({ fill }: { fill: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}
function QRCode({ value, size }: { value: string; size: number }) {
  const { modules } = QR.create(value, { errorCorrectionLevel: "M" });
  const quiet = 2,
    dimension = modules.size + quiet * 2;
  let path = "";
  for (let y = 0; y < modules.size; y++)
    for (let x = 0; x < modules.size; x++)
      if (modules.get(y, x)) path += `M${x + quiet},${y + quiet}h1v1h-1z`;
  return (
    <span className="sync-qr-code" role="img" aria-label="QR-code" style={{ display: "block" }}>
      <svg
        className="sync-qr-svg"
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox={`0 0 ${dimension} ${dimension}`}
        style={{ borderRadius: 5 }}
        shapeRendering="crispEdges"
      >
        <rect width={dimension} height={dimension} fill="#ffffff" />
        <path d={path} fill="#0d1725" />
      </svg>
    </span>
  );
}

export const syncSlidePages = syncSlidePageCount;

/** Source DOM/CSS with confirmed data in place of prototype fallbacks. No hooks or demo store. */
function SyncSlideMarkup({
  slide,
  resolveAsset,
  page = 0,
  compact = false,
}: {
  slide: SyncSlidePresentation;
  resolveAsset: SyncSlideAssetResolver;
  page?: number;
  compact?: boolean;
}) {
  const family = slide.family,
    s = { ...slide, ...slide.style },
    ours = slide.theme === "onzetrots-tv",
    portrait = slide.orientation === "portrait",
    title = slide.name;
  const label =
    s.headline ||
    syncContentFamilies
      .find((entry) => entry.id === family)!
      .label.replace("DUINDORP SV", slide.club.name.toUpperCase())
      .replace("HOUTRUST", slide.club.name.toUpperCase());
  const isRss = family === "rss",
    isEngage = family === "engage",
    isScore = family === "scoreboard",
    isWelcome = family === "welcome";
  const isPeople = [
      "officials",
      "referees",
      "team-info",
      "volunteers",
    ].includes(family),
    isMenu = family === "menu",
    isNews = ["rss", "club-story", "free"].includes(family),
    isStand = /stand/.test(family);
  const isProgram =
      /program|result|uitslag|arrival|referee|changing|schema|kleed|fixture|dressing|official|team-info|visitor|cancellation/.test(
        family,
      ),
    isSponsors = family === "sponsors",
    isLineup = family === "lineup",
    isAgenda = /agenda|birthday|verjaardag|activit|training/.test(family),
    isGoal = family === "goal",
    isYouTube = family === "youtube";
  const rows = slide.rows,
    articles = slide.news,
    pages = syncSlidePages(slide),
    safePage =
      ((Math.trunc(Number.isFinite(page) ? page : 0) % pages) + pages) % pages,
    pageStart = safePage * slide.rowsPerPage;
  const pageRows = (list: typeof rows) =>
      list.slice(pageStart, pageStart + slide.rowsPerPage),
    displayRows = pageRows(rows);
  const articleIndex = articles.length ? safePage % articles.length : 0,
    article = articles[articleIndex];
  const poll = slide.poll,
    pollOptions = poll?.options ?? [],
    totalVotes = pollOptions.reduce((sum, option) => sum + option.votes, 0),
    resultsVisible =
      Boolean(
        poll?.visibility === "live" &&
          ["live", "closed", "archived"].includes(poll.status),
      ) ||
      Boolean(
        poll &&
          ["closed", "archived"].includes(poll.status) &&
          poll.visibility === "after_close",
      ),
    pollUrl = poll?.publicUrl;
  const needsRows =
    isPeople || isMenu || isStand || isProgram || isSponsors || isAgenda;
  const state =
    slide.state !== "ready"
      ? slide.state
      : (needsRows && rows.length === 0) ||
          (isLineup && slide.lineup.length === 0) ||
          (isRss && articles.length === 0) ||
          (!isWelcome &&
            !isEngage &&
            !isNews &&
            !isYouTube &&
            !needsRows &&
            !isLineup &&
            (!slide.home?.name || !slide.away?.name))
        ? "empty"
        : "ready";
  const backgroundUrl = s.backgroundAsset && resolveAsset(s.backgroundAsset),
    clubLogo = slide.club.logo && resolveAsset(slide.club.logo);
  const style = {
    fontFamily:
      s.font === "Condensed"
        ? "Impact, Arial Narrow, sans-serif"
        : s.font === "Serif"
          ? "Georgia, serif"
          : s.font || "Inter, sans-serif",
    textAlign: s.alignment,
    "--slide-heading-font":
      s.font === "Brush" || (ours && !s.fontChanged)
        ? "OnzeTrots Brush, Impact, sans-serif"
        : "inherit",
    "--slide-accent": s.accent,
    "--slide-scale": s.scale / 100,
    "--slide-margin": `${s.safeMargin}%`,
    ...(s.background === "light"
      ? { background: "#edf2fa", color: "#112d59" }
      : {}),
    ...(backgroundUrl
      ? {
          backgroundImage: `linear-gradient(90deg,rgba(6,19,45,.92),rgba(6,19,45,.3)),url(${JSON.stringify(backgroundUrl)})`,
          backgroundSize: "cover",
          backgroundPosition: s.backgroundPosition,
        }
      : {}),
  } as CSSProperties;
  return (
    <div
      className={`vc-slide-preview ${ours ? "is-trots" : "is-fieldflow"} ${portrait ? "is-portrait" : ""} ${compact ? "is-compact" : ""} ${isRss ? "is-rss" : ""} ${isEngage ? "is-engage" : ""} bg-${backgroundUrl ? "photo" : s.background || "stadium"}`}
      style={style}
      aria-label={`Voorbeeld: ${title}`}
    >
      {
        <>
          <div className="vc-slide-grain" />
          <div className="vc-slide-orbit" />
          <div className="vc-slide-lines" />
          <div className="vc-slide-safe">
            <header className="vc-slide-top">
              <div
                className="vc-slide-brand"
                style={{
                  visibility: s.showLogo === false ? "hidden" : "visible",
                }}
              >
                <span className="vc-mini-crest">
                  {clubLogo ? (
                    <img
                      src={clubLogo}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                      }}
                    />
                  ) : (
                    initials(slide.club.name)
                  )}
                </span>
                <span>
                  {slide.club.name.toUpperCase()}
                  <small>{slide.club.tagline}</small>
                </span>
              </div>
              <span className="vc-slide-top-meta">
                {s.topLabel || "CLUB TV"}
                <i />
              </span>
            </header>
            <div className="vc-slide-content">
              <div className="vc-slide-eyebrow">{label}</div>
              {state === "empty" || state === "error" ? (
                <div className="vc-source-empty">
                  <Radio />
                  <h2>
                    {state === "error"
                      ? "EVEN GEEN VERBINDING."
                      : family === "cancellations" && slide.state === "empty"
                        ? "ALLES GAAT DOOR."
                        : "NOG GEEN GEGEVENS."}
                  </h2>
                  <p>
                    {state === "error"
                      ? "De bron is tijdelijk niet beschikbaar. Controleer de koppeling voordat je deze slide publiceert."
                      : family === "cancellations" && slide.state === "empty"
                        ? "Er zijn geen afgelastingen voor deze selectie."
                        : "Kies een andere selectie of voeg handmatig gegevens toe."}
                  </p>
                  <span>
                    {state === "error"
                      ? "BRON NIET BESCHIKBAAR"
                      : "LEGE SELECTIE"}
                  </span>
                </div>
              ) : isWelcome ? (
                <>
                  <h2>{s.title || "WELKOM BIJ\nONZE CLUB."}</h2>
                  <div className="vc-welcome-content">
                    <Crest
                      name={slide.home?.name || slide.club.name}
                      logo={slide.home?.logo || slide.club.logo}
                      resolveAsset={resolveAsset}
                    />
                    <p>{s.body || "Fijn dat je er bent."}</p>
                    <span>{s.subtitle}</span>
                  </div>
                </>
              ) : isEngage ? (
                <>
                  <h2>{poll?.title || s.title || "LAAT DE CLUB MEEPRATEN."}</h2>
                  {poll ? (
                    <div className="vc-engage-layout">
                      <div className="vc-engage-results">
                        {pollOptions.map((option, index) => {
                          const percent = totalVotes
                            ? Math.round(
                                (Number(option.votes || 0) / totalVotes) * 100,
                              )
                            : 0;
                          return (
                            <div
                              className="vc-engage-result"
                              key={option.id || index}
                            >
                              <div>
                                <span>{option.label}</span>
                                {resultsVisible && <strong>{percent}%</strong>}
                              </div>
                              <div className="vc-engage-track">
                                <span
                                  style={{
                                    width: resultsVisible
                                      ? `${percent}%`
                                      : "0%",
                                  }}
                                />
                              </div>
                              {resultsVisible && (
                                <small>{option.votes || 0} stemmen</small>
                              )}
                            </div>
                          );
                        })}
                        <p className="vc-engage-total">
                          {resultsVisible
                            ? `${totalVotes} stemmen · ${poll.status === "live" ? "live bijgewerkt" : "eindresultaat"}`
                            : poll.visibility === "after_vote"
                              ? "Resultaten zichtbaar op je telefoon nadat je hebt gestemd."
                              : "De uitslag verschijnt zodra de stemming sluit."}
                        </p>
                      </div>
                      <aside className="vc-engage-qr">
                        {pollUrl && <QRCode value={pollUrl} size={120} />}
                        <strong>
                          {poll.status === "live"
                            ? "SCAN & STEM"
                            : poll.status === "draft" ||
                                poll.status === "scheduled"
                              ? "BINNENKORT LIVE"
                              : "BEDANKT VOOR JE STEM"}
                        </strong>
                        <span>
                          {poll.status === "live"
                            ? "jouw stem telt"
                            : "bekijk de publieksactie"}
                        </span>
                      </aside>
                    </div>
                  ) : (
                    <div className="vc-engage-empty">
                      <Radio />
                      <strong>Nog geen publieksactie gekoppeld</strong>
                      <span>Kies een campagne bij Gegevensbron.</span>
                    </div>
                  )}
                </>
              ) : isPeople ? (
                <>
                  <h2>{s.title || label}</h2>
                  <p className="vc-slide-subtitle">
                    {s.body ||
                      "Bedankt voor jullie inzet. Samen maken we de club."}
                  </p>
                  <div className="vc-person-grid">
                    {pageRows(rows).map((r, i) => (
                      <div key={i}>
                        <span>
                          {String(r[0])
                            .split(" ")
                            .map((p: string) => p[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <strong>{r[0]}</strong>
                        <small>{r[1]}</small>
                      </div>
                    ))}
                  </div>
                </>
              ) : isMenu ? (
                <>
                  <h2>{s.title || "EVEN NAAR\nDE KANTINE."}</h2>
                  <div className="vc-menu-content">
                    <div className="vc-menu-heading">
                      <span>{s.category || "DE FAVORIETEN"}</span>
                      <span>VERS & LEKKER</span>
                    </div>
                    {pageRows(rows).map((r, i) => (
                      <div className="vc-menu-row" key={i}>
                        <span>
                          <strong>{r[0]}</strong>
                          {s.subline && <small>{s.subline}</small>}
                        </span>
                        <b>{r[1]}</b>
                      </div>
                    ))}
                    {slide.special && (
                      <div className="vc-menu-special">
                        <span>{slide.special.label}</span>
                        <strong>{slide.special.title}</strong>
                        <b>
                          {new Intl.NumberFormat("nl-NL", {
                            style: "currency",
                            currency: "EUR",
                          }).format(slide.special.priceCents / 100)}
                        </b>
                      </div>
                    )}
                  </div>
                </>
              ) : isStand ? (
                <>
                  <h2>
                    {s.title ||
                      (family === "period-standings"
                        ? "DE PERIODERACE."
                        : "DE STAND\nVAN ZAKEN.")}
                  </h2>
                  <div className="vc-stand">
                    <div className="vc-stand-head">
                      <span>#</span>
                      <span>TEAM</span>
                      <span>G</span>
                      <span>PTS</span>
                    </div>
                    {pageRows(rows).map((r, i) => (
                      <div
                        className={`vc-stand-row ${slide.ownRowIndexes.includes(pageStart + i) ? "our-team" : ""}`}
                        key={i}
                      >
                        <b>{r[0]}</b>
                        <strong>
                          <span className="vc-team-dot" />
                          {r[1]}
                        </strong>
                        <span>{r[2]}</span>
                        <b>{r[3]}</b>
                      </div>
                    ))}
                  </div>
                </>
              ) : isProgram ? (
                <>
                  <h2>
                    {s.title ||
                      (family === "cancellations"
                        ? "DEZE WEDSTRIJDEN\nZIJN AFGELAST."
                        : family === "visitors"
                          ? "WELKOM BIJ\nONZE CLUB."
                          : /dressing|changing/.test(family)
                            ? "VIND JE\nKLEEDKAMER."
                            : /result|uitslag/.test(family)
                              ? "ZO SPEELDEN\nWE DIT WEEKEND."
                              : "VANDAAG OP\nHET VELD.")}
                  </h2>
                  <div className="vc-fixtures">
                    {displayRows.map((r, i) => (
                      <div className="vc-fixture" key={i}>
                        <div className="vc-fixture-time">
                          {family === "cancellations" ? "AFG." : r[2] || "–"}
                        </div>
                        <div>
                          <strong>{r[0]}</strong>
                          <span>{r[1]}</span>
                        </div>
                        <small>
                          {/arrival|changing|kleed|dressing|visitor/.test(
                            family,
                          )
                            ? "KLEEDKAMER"
                            : "VELD"}
                          <b>{r[3] || "–"}</b>
                        </small>
                      </div>
                    ))}
                  </div>
                </>
              ) : isSponsors ? (
                <>
                  <h2>{s.title || "SAMEN MAKEN\nWE DE CLUB."}</h2>
                  <p className="vc-slide-subtitle">
                    {s.body ||
                      "Onze partners maken het verschil. Bedankt voor jullie support."}
                  </p>
                  <div className="vc-partner-grid">
                    {pageRows(rows).map((r, i) => (
                      <div key={i}>
                        <strong>{r[0]}</strong>
                        <span>{r[1]}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : isLineup ? (
                <>
                  <h2>{s.title || "ONZE ELF."}</h2>
                  <div className="vc-pitch">
                    <div className="vc-pitch-circle" />
                    {slide.lineup.map((line, i) => (
                      <div className="vc-pitch-row" key={i}>
                        {line.map((n) => (
                          <span key={n}>{n}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              ) : isAgenda ? (
                <>
                  <h2>
                    {s.title ||
                      (/birthday|verjaardag/.test(family)
                        ? "GEFELICITEERD!"
                        : family === "training"
                          ? "TIJD OM\nTE TRAINEN."
                          : family === "activities"
                            ? "SAMEN OP\nDE CLUB."
                            : "DIT KOMT\nERAAN.")}
                  </h2>
                  <div className="vc-agenda-rows">
                    {pageRows(rows).map((r, i) => (
                      <div key={i}>
                        <span>
                          <strong>{r[0]}</strong>
                          <small>{r[1]}</small>
                        </span>
                        <p>
                          <strong>{r[2]}</strong>
                          <small>{r[3]}</small>
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : isNews ? (
                <>
                  <div className="vc-news-art">
                    <div className="vc-news-stadium">
                      <div />
                      <div />
                      <div />
                      <div />
                      <div />
                    </div>
                    <span>{s.imageCaption || "EEN CLUB. EEN VERHAAL."}</span>
                  </div>
                  <div className="vc-news-copy">
                    <h2>
                      {article?.title ||
                        s.title ||
                        title ||
                        "MEER DAN\nNEGENTIG MINUTEN."}
                    </h2>
                    <p>
                      {article?.intro ||
                        s.body ||
                        "Op het veld en daarbuiten. Samen maken we de mooiste verhalen van onze club."}
                    </p>
                    <span className="vc-news-label">
                      {article?.source || s.subtitle || slide.club.name}{" "}
                      <ArrowRight size={12} />
                    </span>
                  </div>
                  {isRss && (
                    <div className="vc-news-reading">
                      <span className="vc-news-index">
                        {String(articleIndex + 1).padStart(2, "0")} <i />{" "}
                        {String(Math.max(1, articles.length)).padStart(2, "0")}
                      </span>
                      {article?.url && (
                        <div className="vc-news-qr">
                          <QRCode value={article.url} size={96} />
                          <span>LEES HET HELE VERHAAL</span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : isYouTube ? (
                <>
                  <h2>{s.title || "ONZE CLUB\nIN BEELD."}</h2>
                  <div className="vc-video-stage">
                    <Play fill="currentColor" />
                    <span>
                      {s.body || "De mooiste momenten. Samen opnieuw beleven."}
                    </span>
                    <small>
                      LOKALE FALLBACKKAART · ONLINE VIDEO VEREIST VERBINDING
                    </small>
                    {s.youtubeUrl && (
                      <span className="vc-youtube-url">{s.youtubeUrl}</span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <h2>
                    {s.title ||
                      (isGoal
                        ? "GOOOAAAL!"
                        : family === "next-match"
                          ? "DE VOLGENDE."
                          : isScore
                            ? "LIVE VANAF\nHET VELD."
                            : "ONZE\nWEDSTRIJDDAG.")}
                  </h2>
                  <div className={`vc-match-stage ${isGoal ? "is-goal" : ""}`}>
                    <div className="vc-match-club">
                      <Crest
                        name={slide.home?.name || slide.club.name}
                        logo={slide.home?.logo || slide.club.logo}
                        resolveAsset={resolveAsset}
                      />
                      <strong>{slide.home?.name || ""}</strong>
                      <span>{slide.home?.team || ""}</span>
                    </div>
                    <div className="vc-match-middle">
                      <span>
                        {isScore || isGoal
                          ? slide.match?.clock || ""
                          : slide.match?.date || ""}
                      </span>
                      <strong>
                        {isScore || isGoal
                          ? `${slide.match?.homeScore || "–"} – ${slide.match?.awayScore || "–"}`
                          : "VS"}
                      </strong>
                      <b>
                        {isScore || isGoal ? "LIVE" : slide.match?.time || ""}
                      </b>
                    </div>
                    <div className="vc-match-club">
                      <Crest
                        away
                        name={slide.away?.name || ""}
                        logo={slide.away?.logo}
                        resolveAsset={resolveAsset}
                      />
                      <strong>{slide.away?.name || ""}</strong>
                      <span>{slide.away?.team || ""}</span>
                    </div>
                  </div>
                  <p className="vc-match-location">{s.subtitle}</p>
                </>
              )}
            </div>
            {s.showFooter !== false && (
              <footer className="vc-slide-footer">
                <strong>{s.footer}</strong>
                <span>{s.footerRight}</span>
              </footer>
            )}
          </div>
        </>
      }
    </div>
  );
}

/** Pure markup used by the live preview and capture worker; asset resolution remains caller-owned. */
export function SyncSlideStaticView({
  presentation,
  resolveAsset = resolveSyncSystemAsset,
  page = 0,
  compact = false,
  includeStyles = true,
}: {
  presentation: SyncSlidePresentation;
  resolveAsset?: SyncSlideAssetResolver;
  page?: number;
  compact?: boolean;
  includeStyles?: boolean;
}) {
  const slide = syncSlidePresentationSchema.parse(presentation);
  return (
    <>
      {includeStyles && <style>{syncSlideCss}</style>}
      <div className="sync-slide-root" aria-hidden={compact || undefined}>
        <SyncSlideMarkup
          slide={slide}
          resolveAsset={resolveAsset}
          page={page}
          compact={compact}
        />
      </div>
    </>
  );
}
