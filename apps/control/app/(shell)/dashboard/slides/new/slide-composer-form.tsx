"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from "lucide-react";

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
  successfulDatasetGroups: string[];
};

export type SlideTemplateOption = {
  description: string;
  name: string;
  orientation: string;
  slideType: string;
  slug: string;
  versionId: string;
};

type Props = {
  sources: SlideSourceOption[];
  templates: SlideTemplateOption[];
};

const wizardSteps = [
  {
    description: "Geef de slide een herkenbare naam en kies wat je wilt tonen.",
    label: "Basis"
  },
  {
    description: "Kies de vaste vormgeving en schermoriëntatie.",
    label: "Template"
  },
  {
    description: "Koppel de gecontroleerde bron voor deze slide.",
    label: "Databron"
  },
  {
    description: "Bepaal welke titel en selectie op het scherm verschijnen.",
    label: "Inhoud"
  },
  {
    description: "Controleer de keuzes voordat VeyoCast de slide maakt.",
    label: "Controleren"
  }
] as const;

export function SlideComposerForm({ sources, templates }: Props) {
  const initialTemplate = templates.find((template) =>
    sources.some((source) =>
      sourceMatchesSlideType(source.kind, template.slideType) &&
      sourceHasContent(source, template.slideType)
    )
  ) ?? templates[0]!;
  const formRef = useRef<HTMLFormElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const [name, setName] = useState("");
  const [slideType, setSlideType] = useState(initialTemplate.slideType);
  const [templateVersionId, setTemplateVersionId] = useState(
    initialTemplate.versionId
  );
  const [dataSourceId, setDataSourceId] = useState("");
  const [selectionMode, setSelectionMode] = useState("latest");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [maxItems, setMaxItems] = useState(
    defaultMaxItems(initialTemplate.slideType)
  );
  const [secondsPerSlide, setSecondsPerSlide] = useState("5");
  const matchingTemplates = templates.filter(
    (template) => template.slideType === slideType
  );
  const matchingSources = sources.filter(
    (source) => sourceMatchesSlideType(source.kind, slideType)
  );
  const readySources = matchingSources.filter((source) =>
    sourceHasContent(source, slideType)
  );
  const selectedTemplate =
    matchingTemplates.find(
      (template) => template.versionId === templateVersionId
    ) ?? matchingTemplates[0]!;
  const selectedSource =
    readySources.find((source) => source.id === dataSourceId) ??
    readySources[0] ??
    null;

  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [currentStep]);

  function goToNextStep() {
    const section = formRef.current?.querySelector<HTMLElement>(
      `[data-wizard-step="${currentStep}"]`
    );
    const invalidControl = section
      ? [...section.querySelectorAll<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >("input, select, textarea")].find((control) => !control.checkValidity())
      : null;
    if (invalidControl) {
      invalidControl.reportValidity();
      invalidControl.focus();
      return;
    }

    const nextStep = Math.min(currentStep + 1, wizardSteps.length - 1);
    setCurrentStep(nextStep);
    setFurthestStep((value) => Math.max(value, nextStep));
  }

  function selectSlideType(value: string) {
    const nextTemplate = templates.find(
      (template) => template.slideType === value
    );
    setSlideType(value);
    setTemplateVersionId(nextTemplate?.versionId ?? "");
    setDataSourceId("");
    setCategory("");
    setMaxItems(defaultMaxItems(value));
    setSecondsPerSlide("5");
  }

  return (
    <form
      action={createDynamicSlide}
      className={`${styles.form} ${styles.wizard}`}
      onSubmit={(event) => {
        if (currentStep < wizardSteps.length - 1) {
          event.preventDefault();
          goToNextStep();
        }
      }}
      ref={formRef}
    >
      <nav aria-label="Voortgang dynamische slide">
        <ol className={styles.wizardSteps}>
          {wizardSteps.map((step, index) => {
            const complete = index < currentStep;
            const available = index <= furthestStep;
            return (
              <li
                className={styles.wizardStep}
                data-complete={complete}
                data-current={index === currentStep}
                key={step.label}
              >
                <button
                  aria-current={index === currentStep ? "step" : undefined}
                  disabled={!available}
                  onClick={() => setCurrentStep(index)}
                  type="button"
                >
                  <span aria-hidden="true" className={styles.wizardStepNumber}>
                    {complete ? <Check /> : index + 1}
                  </span>
                  <span>{step.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className={styles.wizardStatus}>
        <span>
          Stap {currentStep + 1} van {wizardSteps.length}
        </span>
        <strong>{wizardSteps[currentStep]!.label}</strong>
        <p>{wizardSteps[currentStep]!.description}</p>
      </div>

      <section
        className={styles.formSection}
        data-wizard-step="0"
        hidden={currentStep !== 0}
      >
        <h2 ref={currentStep === 0 ? stepHeadingRef : undefined} tabIndex={-1}>
          Wat voor slide wil je maken?
        </h2>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>Naam van de slide</span>
            <input
              maxLength={120}
              name="name"
              onChange={(event) => setName(event.currentTarget.value)}
              placeholder="Kantinemenu vandaag"
              required
              value={name}
            />
          </label>
          <label className={styles.field}>
            <span>Slidetype</span>
            <select
              name="slideType"
              onChange={(event) => selectSlideType(event.currentTarget.value)}
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
        </div>
      </section>

      <section
        className={styles.formSection}
        data-wizard-step="1"
        hidden={currentStep !== 1}
      >
        <h2 ref={currentStep === 1 ? stepHeadingRef : undefined} tabIndex={-1}>
          Kies een template
        </h2>
        <div className={styles.grid}>
          {matchingTemplates.map((template) => (
            <label className={styles.choiceCard} key={template.versionId}>
              <TemplatePreview template={template} />
              <input
                checked={selectedTemplate.versionId === template.versionId}
                key={`${slideType}-${template.versionId}`}
                name="templateVersionId"
                onChange={() => setTemplateVersionId(template.versionId)}
                type="radio"
                value={template.versionId}
              />
              <span>
                <strong>{template.name}</strong>
                <small>
                  {slideTypeLabel(template.slideType)} ·{" "}
                  {template.orientation === "portrait" ? "Staand" : "Liggend"}
                </small>
                <small>{template.description}</small>
              </span>
              <span className={styles.choiceBadge}>
                {templateThemeLabel(template)}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section
        className={styles.formSection}
        data-wizard-step="2"
        hidden={currentStep !== 2}
      >
        <h2 ref={currentStep === 2 ? stepHeadingRef : undefined} tabIndex={-1}>
          Kies een databron
        </h2>
        {!matchingSources.length ? (
          <div className={styles.inlineGuidance} role="status">
            <strong>Voor dit slidetype ontbreekt een passende databron.</strong>
            <span>{missingSourceCopy(slideType)}</span>
            <Button asChild size="sm" variant="secondary">
              <Link href={sourceSetupHref(slideType)}>
                {sourceActionLabel(slideType, "connect")}
              </Link>
            </Button>
          </div>
        ) : !readySources.length ? (
          <div className={styles.inlineGuidance} role="status">
            <strong>
              De passende databron bevat nog geen bruikbare inhoud.
            </strong>
            <span>{missingContentCopy(slideType)}</span>
            <Button asChild size="sm" variant="secondary">
              <Link href={sourceSetupHref(slideType)}>
                {sourceActionLabel(slideType, "sync")}
              </Link>
            </Button>
          </div>
        ) : null}
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>Databron</span>
            <select
              disabled={!selectedSource}
              key={slideType}
              name="dataSourceId"
              onChange={(event) => setDataSourceId(event.currentTarget.value)}
              required
              value={selectedSource?.id ?? ""}
            >
              {readySources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name} · {sourceAvailability(source)}
                </option>
              ))}
            </select>
            {matchingSources.some(
              (source) =>
                sourceHasContent(source, slideType) &&
                source.providerStatus === "error"
            ) ? (
              <small className={styles.fieldHint}>
                De laatste goede inhoud blijft beschikbaar bij een tijdelijke
                synchronisatiefout.
              </small>
            ) : null}
          </label>
          <label className={styles.field}>
            <span>Selectiemodus</span>
            <select
              name="selectionMode"
              onChange={(event) => setSelectionMode(event.currentTarget.value)}
              value={selectionMode}
            >
              <option value="latest">Automatisch nieuwste snapshot</option>
              <option value="pinned">Deze versie vastzetten</option>
            </select>
          </label>
        </div>
      </section>

      <section
        className={styles.formSection}
        data-wizard-step="3"
        hidden={currentStep !== 3}
      >
        <h2 ref={currentStep === 3 ? stepHeadingRef : undefined} tabIndex={-1}>
          Configureer de inhoud
        </h2>
        <div className={styles.fieldGrid}>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span>Titel op het scherm</span>
            <input
              maxLength={160}
              name="title"
              onChange={(event) => setTitle(event.currentTarget.value)}
              placeholder={
                slideType === "news" ? "Voetbalnieuws" : "Menu vandaag"
              }
              value={title}
            />
          </label>
          {slideType === "menu" ? (
            <label className={styles.field}>
              <span>Categorie (optioneel)</span>
              <input
                maxLength={160}
                name="category"
                onChange={(event) => setCategory(event.currentTarget.value)}
                placeholder="Dranken"
                value={category}
              />
            </label>
          ) : null}
          <label className={styles.field}>
            <span>{maxItemsLabel(slideType)}</span>
            <input
              max={
                isSingleMatchSlide(slideType)
                  ? "1"
                  : slideType === "news"
                    ? "12"
                    : "40"
              }
              min="1"
              name="maxItems"
              onChange={(event) => setMaxItems(event.currentTarget.value)}
              required
              type="number"
              value={maxItems}
            />
            <small className={styles.fieldHint}>
              {maxItemsHelp(slideType, selectedTemplate.orientation)}
            </small>
          </label>
          {slideType === "news" ? (
            <label className={styles.field}>
              <span>Seconden per nieuwsslide</span>
              <input
                max="120"
                min="5"
                name="secondsPerSlide"
                onChange={(event) =>
                  setSecondsPerSlide(event.currentTarget.value)
                }
                required
                type="number"
                value={secondsPerSlide}
              />
              <small className={styles.fieldHint}>
                Minimaal 5 seconden, zodat elke kop rustig leesbaar blijft.
              </small>
            </label>
          ) : null}
        </div>
      </section>

      <section
        className={styles.formSection}
        data-wizard-step="4"
        hidden={currentStep !== 4}
      >
        <h2 ref={currentStep === 4 ? stepHeadingRef : undefined} tabIndex={-1}>
          Controleer en maak de slide
        </h2>
        <dl className={styles.wizardReview}>
          <div>
            <dt>Naam</dt>
            <dd>{name || "Nog niet ingevuld"}</dd>
          </div>
          <div>
            <dt>Slidetype</dt>
            <dd>{slideTypeLabel(slideType)}</dd>
          </div>
          <div>
            <dt>Template</dt>
            <dd>{templateSummary(selectedTemplate)}</dd>
          </div>
          <div>
            <dt>Databron</dt>
            <dd>{selectedSource?.name ?? "Geen bruikbare bron"}</dd>
          </div>
          <div>
            <dt>Inhoud</dt>
            <dd>
              {title || "Template-titel"} ·{" "}
              {maxItemsSummary(slideType, maxItems)}
              {slideType === "news"
                ? ` · ${secondsPerSlide || "—"} seconden per slide`
                : ""}
              {category ? ` · categorie ${category}` : ""}
            </dd>
          </div>
        </dl>
        <p className={styles.muted}>
          Na opslaan maakt VeyoCast een immutable datasnapshot. Players tonen
          die met de gekozen HTML/CSS-template; de worker bewaart daarnaast
          automatisch een PNG-fallback voor offline en oudere apparaten.
        </p>
      </section>

      <footer className={styles.wizardActions}>
        <span className={styles.muted}>
          Bestaande releases en schermcache blijven ongewijzigd.
        </span>
        <div>
          <Button
            disabled={currentStep === 0}
            onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
            type="button"
            variant="secondary"
          >
            <ChevronLeft aria-hidden="true" />
            Vorige
          </Button>
          {currentStep < wizardSteps.length - 1 ? (
            <Button
              disabled={currentStep === 2 && !selectedSource}
              onClick={goToNextStep}
              type="button"
            >
              Volgende
              <ChevronRight aria-hidden="true" />
            </Button>
          ) : (
            <Button disabled={!selectedSource} type="submit">
              <Sparkles aria-hidden="true" />
              Slide maken
            </Button>
          )}
        </div>
      </footer>
    </form>
  );
}

function TemplatePreview({
  template
}: {
  template: SlideTemplateOption;
}) {
  const isDark = template.slug.includes("dark");
  const previewType = template.slideType === "menu"
    ? "menu"
    : template.slideType === "news"
      ? "news"
      : isSingleMatchSlide(template.slideType)
        ? "match"
        : "sport";

  return (
    <span
      aria-hidden="true"
      className={styles.templatePreview}
      data-orientation={template.orientation}
      data-preview-type={previewType}
      data-theme={isDark ? "dark" : "light"}
    >
      <span className={styles.templatePreviewKicker}>
        {previewType === "menu"
          ? "Clubkantine"
          : previewType === "news"
            ? "Clubnieuws"
            : "Match centre"}
      </span>
      <strong>
        {previewType === "menu"
          ? "Menu vandaag"
          : previewType === "news"
            ? "Het laatste clubnieuws"
            : previewType === "match"
              ? "VeyoCast 1 – Bezoekers"
              : slideTypeLabel(template.slideType)}
      </strong>
      {previewType === "menu" ? (
        <span className={styles.templatePreviewRows}>
          <i>Clubburger</i><b>€ 6,95</b>
          <i>Friet groot</i><b>€ 4,25</b>
          <i>Frisdrank</i><b>€ 2,75</b>
        </span>
      ) : previewType === "news" ? (
        <span className={styles.templatePreviewCopy}>
          Alles wat leden en bezoekers vandaag moeten weten.
        </span>
      ) : previewType === "match" ? (
        <span className={styles.templatePreviewScore}>14:30 · Veld 1</span>
      ) : (
        <span className={styles.templatePreviewRows}>
          <i>1. VeyoCast</i><b>24 pt</b>
          <i>2. Clubteam</i><b>21 pt</b>
          <i>3. Bezoekers</i><b>18 pt</b>
        </span>
      )}
    </span>
  );
}

export function sourceHasContent(
  source: SlideSourceOption,
  slideType?: string
) {
  if (source.kind === "sportlink") {
    const requiredDatasetGroup = slideType
      ? requiredSportlinkDatasetGroup(slideType)
      : null;
    if (requiredDatasetGroup) {
      return source.successfulDatasetGroups.includes(requiredDatasetGroup);
    }
    return Boolean(source.lastSuccessfulSyncAt);
  }
  return source.itemCount > 0;
}

export function requiredSportlinkDatasetGroup(slideType: string) {
  const groups: Record<string, string> = {
    sport_activities: "activities",
    sport_birthdays: "public_people",
    sport_cancellations: "matches",
    sport_dressing_rooms: "match_details",
    sport_match_of_the_day: "matches",
    sport_next_match: "matches",
    sport_officials: "match_details",
    sport_period_standing: "competitions",
    sport_program: "matches",
    sport_results: "matches",
    sport_sponsor: "teams",
    sport_standing: "competitions",
    sport_team: "teams",
    sport_trainings: "teams",
    sport_volunteers: "volunteers"
  };
  return groups[slideType] ?? null;
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

function sourceActionLabel(
  slideType: string,
  action: "connect" | "sync"
) {
  if (slideType.startsWith("sport_")) {
    return action === "connect"
      ? "Sportlink koppelen"
      : "Sportlink synchroniseren";
  }
  return action === "connect" ? "Databron koppelen" : "Databron herstellen";
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

function missingContentCopy(slideType: string) {
  const datasetGroup = requiredSportlinkDatasetGroup(slideType);
  if (!datasetGroup) {
    return "Synchroniseer de bron eerst. Daarna kun je de slide zonder nieuwe configuratie aanmaken.";
  }
  return `De Sportlink-dataset ‘${sportlinkDatasetLabel(datasetGroup)}’ is ingeschakeld, maar nog niet succesvol afgerond. Open de databron, start de synchronisatie en wacht op de status Gereed.`;
}

function sportlinkDatasetLabel(value: string) {
  const labels: Record<string, string> = {
    activities: "Clubagenda",
    competitions: "Competities en standen",
    match_details: "Wedstrijddetails",
    matches: "Programma en uitslagen",
    public_people: "Publieke personen",
    teams: "Teams",
    volunteers: "Vrijwilligers"
  };
  return labels[value] ?? value;
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

function defaultMaxItems(slideType: string) {
  if (isSingleMatchSlide(slideType)) return "1";
  if (slideType === "news") return "5";
  if (slideType === "menu") return "12";
  return "8";
}

function isSingleMatchSlide(slideType: string) {
  return [
    "sport_match_of_the_day",
    "sport_next_match"
  ].includes(slideType);
}

function maxItemsLabel(slideType: string) {
  if (slideType === "news") return "Aantal nieuwsslides";
  if (slideType === "menu") return "Aantal producten";
  if (isSingleMatchSlide(slideType)) return "Aantal wedstrijden";
  return "Aantal regels";
}

function maxItemsHelp(slideType: string, orientation: string) {
  if (isSingleMatchSlide(slideType)) {
    return "Deze Match Centre-template toont altijd precies één wedstrijd.";
  }
  const pageSize = slideType === "menu"
    ? orientation === "portrait" ? 10 : 8
    : slideType === "news"
      ? 1
      : orientation === "portrait" ? 6 : 8;
  if (slideType === "news") {
    return "Kies 1 tot 12 berichten. Elk artikel krijgt een eigen HTML/CSS-scherm.";
  }
  return `Bij meer dan ${pageSize} items verdeelt VeyoCast de inhoud automatisch over meerdere pagina’s.`;
}

function maxItemsSummary(slideType: string, maxItems: string) {
  const amount = maxItems || "—";
  if (slideType === "news") return `${amount} nieuwsslides`;
  if (slideType === "menu") return `${amount} producten`;
  if (isSingleMatchSlide(slideType)) return "1 wedstrijd";
  return `${amount} regels`;
}

function templateThemeLabel(template: SlideTemplateOption) {
  if (template.slug.includes("dark")) return "Donker";
  if (template.slug.includes("light")) return "Licht";
  return "Atelier licht";
}

function templateSummary(template: SlideTemplateOption) {
  const orientation =
    template.orientation === "portrait" ? "Staand" : "Liggend";
  return template.name.toLocaleLowerCase("nl-NL").includes(
    orientation.toLocaleLowerCase("nl-NL")
  )
    ? template.name
    : `${template.name} · ${orientation}`;
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
