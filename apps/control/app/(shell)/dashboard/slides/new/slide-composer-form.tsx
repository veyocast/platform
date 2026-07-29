"use client";

import Link from "next/link";
import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@veyocast/ui";

import styles from "../../dynamic-content.module.css";
import { createDynamicSlide } from "../actions";

export type SlideSourceOption = {
  id: string;
  itemCount: number;
  kind: string;
  lastErrorCode: string | null;
  lastSuccessfulSyncAt: string | null;
  name: string;
  providerStatus: string;
};

export type SlideTemplateOption = {
  name: string;
  orientation: string;
  slideType: string;
  versionId: string;
};

type Props = {
  sources: SlideSourceOption[];
  templates: SlideTemplateOption[];
};

export function SlideComposerForm({ sources, templates }: Props) {
  const initialTemplate = templates.find((template) =>
    sources.some((source) =>
      sourceMatchesSlideType(source.kind, template.slideType) &&
      sourceHasContent(source)
    )
  ) ?? templates[0]!;
  const [slideType, setSlideType] = useState(initialTemplate.slideType);
  const matchingTemplates = templates.filter(
    (template) => template.slideType === slideType
  );
  const matchingSources = sources.filter(
    (source) => sourceMatchesSlideType(source.kind, slideType)
  );
  const readySources = matchingSources.filter(sourceHasContent);
  const selectedSource = readySources[0] ?? null;

  return (
    <form action={createDynamicSlide} className={styles.form}>
      <section className={styles.formSection}>
        <h2>1–3. Basis</h2>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>Naam van de slide</span>
            <input
              maxLength={120}
              name="name"
              placeholder="Kantinemenu vandaag"
              required
            />
          </label>
          <label className={styles.field}>
            <span>Slidetype</span>
            <select
              name="slideType"
              onChange={(event) => setSlideType(event.currentTarget.value)}
              value={slideType}
            >
              {slideTypeGroups(templates).map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((value) => (
                    <option key={value} value={value}>
                      {slideTypeLabel(value)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span>Titel op het scherm</span>
            <input maxLength={160} name="title" placeholder="Menu vandaag" />
          </label>
        </div>
      </section>

      <section className={styles.formSection}>
        <h2>4. Kies template</h2>
        <div className={styles.grid}>
          {matchingTemplates.map((template, index) => (
            <label className={styles.choiceCard} key={template.versionId}>
              <input
                defaultChecked={index === 0}
                key={`${slideType}-${template.versionId}`}
                name="templateVersionId"
                type="radio"
                value={template.versionId}
              />
              <span>
                <strong>{template.name}</strong>
                <small>
                  {slideTypeLabel(template.slideType)} ·{" "}
                  {template.orientation === "portrait" ? "Staand" : "Liggend"}
                </small>
              </span>
              <span className={styles.choiceBadge}>Platformtemplate</span>
            </label>
          ))}
        </div>
      </section>

      <section className={styles.formSection}>
        <h2>5–6. Databron en inhoud</h2>
        {!matchingSources.length ? (
          <div className={styles.inlineGuidance} role="status">
            <strong>Voor dit slidetype ontbreekt een passende databron.</strong>
            <span>{missingSourceCopy(slideType)}</span>
            <Button asChild size="sm" variant="secondary">
              <Link href={sourceSetupHref(slideType)}>Databron koppelen</Link>
            </Button>
          </div>
        ) : !readySources.length ? (
          <div className={styles.inlineGuidance} role="status">
            <strong>De passende databron bevat nog geen bruikbare inhoud.</strong>
            <span>
              Synchroniseer de bron eerst. Daarna kun je de slide zonder nieuwe
              configuratie aanmaken.
            </span>
            <Button asChild size="sm" variant="secondary">
              <Link href={sourceSetupHref(slideType)}>Databron herstellen</Link>
            </Button>
          </div>
        ) : null}
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>Databron</span>
            <select
              defaultValue={selectedSource?.id}
              disabled={!selectedSource}
              key={slideType}
              name="dataSourceId"
              required
            >
              {readySources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name} · {sourceAvailability(source)}
                </option>
              ))}
            </select>
            {matchingSources.some(
              (source) => sourceHasContent(source) && source.providerStatus === "error"
            ) ? (
              <small className={styles.fieldHint}>
                De laatste goede inhoud blijft beschikbaar bij een tijdelijke
                synchronisatiefout.
              </small>
            ) : null}
          </label>
          <label className={styles.field}>
            <span>Selectiemodus</span>
            <select defaultValue="latest" name="selectionMode">
              <option value="latest">Automatisch nieuwste snapshot</option>
              <option value="pinned">Deze versie vastzetten</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Categorie (optioneel)</span>
            <input maxLength={160} name="category" placeholder="Dranken" />
          </label>
          <label className={styles.field}>
            <span>Maximaal aantal items</span>
            <input defaultValue="8" max="40" min="1" name="maxItems" type="number" />
          </label>
        </div>
      </section>

      <section className={styles.formSection}>
        <h2>7–8. Voorbeeld en opslaan</h2>
        <p className={styles.muted}>
          Na opslaan verschijnt de immutable workerpreview hier en in de
          slidebibliotheek. Pas wanneer die gereed is kan de snapshot naar een
          playlist.
        </p>
        <div className={styles.formActions}>
          <span className={styles.muted}>
            Bestaande releases en schermcache blijven ongewijzigd.
          </span>
          <Button disabled={!selectedSource} type="submit">
            <Sparkles aria-hidden="true" />
            Opslaan als slide
          </Button>
        </div>
      </section>
    </form>
  );
}

export function sourceHasContent(source: SlideSourceOption) {
  if (source.kind === "sportlink") {
    return Boolean(source.lastSuccessfulSyncAt);
  }
  return source.itemCount > 0;
}

export function sourceMatchesSlideType(kind: string, slideType: string) {
  if (slideType === "menu") {
    return kind === "manual_products" || kind === "twelve_excel";
  }
  if (slideType === "news") return kind === "rss";
  return kind === "sportlink";
}

function sourceAvailability(source: SlideSourceOption) {
  if (source.providerStatus === "error") {
    return "laatste goede inhoud";
  }
  if (source.kind === "sportlink") return "gesynchroniseerd";
  return `${source.itemCount} ${source.itemCount === 1 ? "item" : "items"}`;
}

function sourceSetupHref(slideType: string) {
  return slideType.startsWith("sport_")
    ? "/dashboard/data-sources/sportlink"
    : "/dashboard/data-sources";
}

function missingSourceCopy(slideType: string) {
  if (slideType === "menu") {
    return "Maak een handmatige of Twelve-productbron en voeg minimaal één product toe.";
  }
  if (slideType === "news") {
    return "Koppel een publieke RSS- of Atom-feed en voer de eerste synchronisatie uit.";
  }
  return "Koppel Sportlink Club.Dataservice en wacht tot de eerste synchronisatie gereed is.";
}

function slideTypeGroups(templates: SlideTemplateOption[]) {
  const values = [...new Set(templates.map((template) => template.slideType))];
  const general = values.filter((value) => !value.startsWith("sport_"));
  const sports = values.filter((value) => value.startsWith("sport_"));
  return [
    ...(general.length ? [{ label: "Algemeen", options: general }] : []),
    ...(sports.length
      ? [{ label: "Wedstrijden & competitie", options: sports }]
      : [])
  ];
}

function slideTypeLabel(value: string) {
  const labels: Record<string, string> = {
    menu: "Menubord",
    news: "Nieuws",
    sport_activities: "Clubagenda",
    sport_birthdays: "Jarigen",
    sport_cancellations: "Afgelastingen",
    sport_dressing_rooms: "Veld- en kleedkamerindeling",
    sport_match_of_the_day: "Match of the Day",
    sport_next_match: "Volgende wedstrijd",
    sport_officials: "Scheidsrechtersaanstellingen",
    sport_period_standing: "Periodestand",
    sport_program: "Programma",
    sport_results: "Uitslagen",
    sport_sponsor: "Teamsponsor",
    sport_standing: "Competitiestand",
    sport_team: "Teamvoorstelling",
    sport_trainings: "Trainingsoverzicht",
    sport_volunteers: "Vrijwilligers"
  };
  return labels[value] ?? value.replace(/^sport_/, "").replaceAll("_", " ");
}
