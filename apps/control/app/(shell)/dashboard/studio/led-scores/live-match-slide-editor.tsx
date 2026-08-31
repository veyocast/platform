"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Activity,
  ArrowRight,
  Clock3,
  History,
  LayoutPanelTop,
  ListTree,
  MonitorPlay,
  ShieldCheck
} from "lucide-react";

import { Badge, Button } from "@veyocast/ui";

import { createLedScoresLiveMatchSlide } from "./actions";
import styles from "./led-scores-studio.module.css";

type Connection = { id: string; name: string };
type LiveSlide = {
  id: string;
  name: string;
  orientation: string;
  status: string;
  updatedLabel: string;
};

export function LiveMatchSlideEditor({
  connections,
  idempotencyKey,
  slides
}: {
  connections: Connection[];
  idempotencyKey: string;
  slides: LiveSlide[];
}) {
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [template, setTemplate] = useState<"match_center" | "scoreboard">("match_center");
  const [showClock, setShowClock] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [timelineLimit, setTimelineLimit] = useState(5);
  const [outsideMatchBehavior, setOutsideMatchBehavior] = useState<"last_known" | "skip">("last_known");
  const [accentMode, setAccentMode] = useState<"club" | "contrast" | "neutral">("club");
  return <div className={styles.liveSlideWorkspace}>
    <div className={styles.liveSlideIntro}>
      <div>
        <span className={styles.moduleIcon}><MonitorPlay aria-hidden="true" /></span>
        <div><p className={styles.eyebrow}>Normale playlistcontent</p><h2>Live tussenstandslide</h2></div>
      </div>
      <p>Deze slide blijft in de playlist staan en pakt bij iedere weergave de laatst gevalideerde score, klok en wedstrijdstatus. Hij is geen tijdelijke overlay.</p>
      <div className={styles.contractStrip}>
        <span><Activity aria-hidden="true" />Laatste scorestatus</span>
        <span><Clock3 aria-hidden="true" />Lokale wedstrijdklok</span>
        <span><ShieldCheck aria-hidden="true" />Veilige stale fallback</span>
      </div>
    </div>

    {slides.length ? <div className={styles.existingLiveSlides}>
      <div className={styles.subsectionHeading}><div><h3>Bestaande live wedstrijdslides</h3><p>Open een slide om hem aan een playlist toe te voegen of opnieuw te publiceren.</p></div><Badge status="success">{slides.length} beschikbaar</Badge></div>
      <div>{slides.map((slide) => <article key={slide.id}>
        <span className={styles.moduleIcon}><LayoutPanelTop aria-hidden="true" /></span>
        <div><strong>{slide.name}</strong><small>{slide.orientation === "portrait" ? "Staand · 9:16" : "Liggend · 16:9"} · {slideStatusLabel(slide.status)} · {slide.updatedLabel}</small></div>
        <Button asChild size="sm" variant="secondary"><Link href={`/dashboard/slides/${slide.id}`}>Open slide<ArrowRight aria-hidden="true" /></Link></Button>
      </article>)}</div>
    </div> : null}

    <form action={createLedScoresLiveMatchSlide} className={styles.liveSlideEditor}>
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <div className={styles.liveSlideForm}>
        <div className={styles.subsectionHeading}><div><h3>{slides.length ? "Nieuwe variant maken" : "Eerste live wedstrijdslide maken"}</h3><p>Kies één schermstand. Maak voor gemengde schermen daarna een tweede, eigen gecomponeerde variant.</p></div><Badge status="info">Immutable bronbinding</Badge></div>
        <div className={styles.fieldGrid}>
          <label><span>Naam</span><input defaultValue="Live tussenstand" maxLength={120} name="name" required /></label>
          <label><span>LED Scores-verbinding</span><select name="connectionId" required>{connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name}</option>)}</select></label>
        </div>

        <fieldset className={styles.choiceFieldset}>
          <legend>Schermstand</legend>
          <div className={styles.orientationChoices}>
            <label data-selected={orientation === "landscape" || undefined}><input checked={orientation === "landscape"} name="orientation" onChange={() => setOrientation("landscape")} type="radio" value="landscape" /><span><i className={styles.landscapeIcon} /><strong>Liggend</strong><small>16:9 · 1920 × 1080</small></span></label>
            <label data-selected={orientation === "portrait" || undefined}><input checked={orientation === "portrait"} name="orientation" onChange={() => setOrientation("portrait")} type="radio" value="portrait" /><span><i className={styles.portraitIcon} /><strong>Staand</strong><small>9:16 · 1080 × 1920</small></span></label>
          </div>
        </fieldset>

        <fieldset className={styles.choiceFieldset}>
          <legend>Informatie-indeling</legend>
          <div className={styles.templateChoices}>
            <label data-selected={template === "match_center" || undefined}><input checked={template === "match_center"} name="template" onChange={() => setTemplate("match_center")} type="radio" value="match_center" /><ListTree aria-hidden="true" /><span><strong>Wedstrijdcentrum</strong><small>Score, klok en recent wedstrijdverloop.</small></span></label>
            <label data-selected={template === "scoreboard" || undefined}><input checked={template === "scoreboard"} name="template" onChange={() => setTemplate("scoreboard")} type="radio" value="scoreboard" /><LayoutPanelTop aria-hidden="true" /><span><strong>Scorebord</strong><small>Maximale nadruk op score en klok.</small></span></label>
          </div>
        </fieldset>

        <fieldset className={styles.optionPanel}>
          <legend>Live informatie</legend>
          <label><input checked={showClock} name="showClock" onChange={(event) => setShowClock(event.target.checked)} type="checkbox" />Wedstrijdklok tonen</label>
          <label><input checked={showTimeline} name="showTimeline" onChange={(event) => setShowTimeline(event.target.checked)} type="checkbox" />Wedstrijdverloop tonen</label>
          <label><span>Maximaal aantal gebeurtenissen</span><select disabled={!showTimeline} name="timelineLimit" onChange={(event) => setTimelineLimit(Number(event.target.value))} value={showTimeline ? timelineLimit : 0}>{[0, 3, 5, 7, 10].map((count) => <option key={count} value={count}>{count === 0 ? "Geen" : count}</option>)}</select></label>
          {!showTimeline ? <input name="timelineLimit" type="hidden" value="0" /> : null}
        </fieldset>

        <div className={styles.fieldGrid}>
          <label><span>Buiten een actieve wedstrijd</span><select name="outsideMatchBehavior" onChange={(event) => setOutsideMatchBehavior(event.target.value as "last_known" | "skip")} value={outsideMatchBehavior}><option value="last_known">Laatste bekende stand tonen</option><option value="skip">Slide veilig overslaan</option></select></label>
          <label><span>Accent</span><select name="accentMode" onChange={(event) => setAccentMode(event.target.value as "club" | "contrast" | "neutral")} value={accentMode}><option value="club">Clubaccent</option><option value="contrast">Hoog contrast</option><option value="neutral">Neutraal</option></select></label>
        </div>
        <p className="notice"><strong>Bij vertraagde brondata.</strong> De score blijft op de laatst bevestigde stand en de klok bevriest. De Player verzint nooit extra speeltijd en behoudt zijn last-known-good playlist.</p>
        <div className={styles.liveSlideActions}><p>Na aanmaken vind je deze slide bij Slides en voeg je hem als normale content aan iedere geschikte playlist toe.</p><LiveSlideSubmit /></div>
      </div>

      <aside className={styles.liveSlidePreview} aria-label="Voorbeeld van de live wedstrijdslide">
        <div><EyeLabel orientation={orientation} /></div>
        <div className={styles.scoreboardPreview} data-accent={accentMode} data-orientation={orientation} data-template={template}>
          <header><span>LIVE</span>{showClock ? <strong>63:32</strong> : <strong>TWEEDE HELFT</strong>}</header>
          <div className={styles.scoreboardTeams}><span><i>D</i><b>Duindorp SV</b></span><strong>4 <small>–</small> 2</strong><span><i>B</i><b>Bezoekers</b></span></div>
          {template === "match_center" && showTimeline ? <ol>{[
            ["63'", "Goal · D. Jansen", "4–2"],
            ["51'", "Goal · Bezoekers", "3–2"],
            ["38'", "Goal · M. de Wit", "3–1"]
          ].slice(0, Math.min(3, timelineLimit)).map(([time, event, score]) => <li key={time}><time>{time}</time><span>{event}</span><b>{score}</b></li>)}</ol> : null}
          <footer><span>Laatste bevestiging zojuist</span><span>Hoofdveld</span></footer>
        </div>
        <p><History aria-hidden="true" /><span><strong>Latest-bound.</strong> De slide pakt steeds de nieuwste geldige wedstrijdstate zonder het ontwerp of de playlistrelease mutable te maken.</span></p>
      </aside>
    </form>
  </div>;
}

function LiveSlideSubmit() {
  const { pending } = useFormStatus();
  return <Button aria-busy={pending} disabled={pending} type="submit">
    {pending ? "Live tussenstandslide maken…" : "Live tussenstandslide maken"}
  </Button>;
}

function EyeLabel({ orientation }: { orientation: "landscape" | "portrait" }) {
  return <><MonitorPlay aria-hidden="true" /><strong>Playerpreview</strong><Badge status="neutral">{orientation === "portrait" ? "9:16" : "16:9"}</Badge></>;
}

function slideStatusLabel(status: string) {
  if (status === "published") return "Gepubliceerd";
  if (status === "ready") return "Klaar";
  return "Concept";
}
