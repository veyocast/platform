"use client";

import Link from "next/link";
import {
  useEffect,
  useCallback,
  useRef,
  useState,
  useTransition,
  type CSSProperties
} from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from "lucide-react";

import { Button, JourneyShell } from "@veyocast/ui";

import styles from "../../dynamic-content.module.css";
import {
  createDynamicSlide,
  previewDynamicSlide,
  type DynamicSlidePreviewResult
} from "../actions";
import { DynamicSlideLivePreview } from "./dynamic-slide-live-preview";
import {
  EditorialPriceEditor,
  type EditorialPriceProductOption
} from "./editorial-price-editor";
import {
  PriceListConfigurator,
  type PriceListProductOption
} from "./price-list-configurator";
import type {
  SportlinkAvailabilityRecord,
  SportlinkCompetitionOption,
  SportlinkSeasonOption,
  SportlinkTeamOption
} from "./sportlink-slide-options";

export type SlideSourceOption = {
  id: string;
  itemCount: number;
  kind: string;
  lastErrorCode: string | null;
  lastSuccessfulSyncAt: string | null;
  name: string;
  providerStatus: string;
  products: EditorialPriceProductOption[];
  sportAvailability: SportlinkAvailabilityRecord[];
  sportCompetitions: SportlinkCompetitionOption[];
  sportSeasons: SportlinkSeasonOption[];
  sportTeams: SportlinkTeamOption[];
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
  primaryColor: string;
  products: PriceListProductOption[];
  sources: SlideSourceOption[];
  templates: SlideTemplateOption[];
};

type PreviewStyle = CSSProperties & {
  "--preview-accent": string;
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

export function SlideComposerForm({
  primaryColor,
  products,
  sources,
  templates
}: Props) {
  const initialTemplate = templates.find((template) =>
    sources.some((source) =>
      sourceMatchesSlideType(source.kind, template.slideType) &&
      sourceHasContent(source, template.slideType)
    )
  ) ?? templates[0]!;
  const formRef = useRef<HTMLFormElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [name, setName] = useState("");
  const [slideType, setSlideType] = useState(initialTemplate.slideType);
  const [templateVersionId, setTemplateVersionId] = useState(
    initialTemplate.versionId
  );
  const [dataSourceId, setDataSourceId] = useState("");
  const [selectionMode, setSelectionMode] = useState("latest");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [sportCompetitionExternalId, setSportCompetitionExternalId] =
    useState("*");
  const [sportTeamExternalId, setSportTeamExternalId] = useState("*");
  const [sportSeason, setSportSeason] = useState("*");
  const [maxItems, setMaxItems] = useState(
    defaultMaxItems(initialTemplate.slideType)
  );
  const [secondsPerSlide, setSecondsPerSlide] = useState("5");
  const [newsVariant, setNewsVariant] = useState("hero_split");
  const [pricePhotoMode, setPricePhotoMode] = useState("show");
  const [priceListJson, setPriceListJson] = useState("");
  const [newsFocalPoint, setNewsFocalPoint] = useState({ x: 0.5, y: 0.5 });
  const handlePriceListChange = useCallback((value: string) => {
    setPriceListJson((current) => current === value ? current : value);
  }, []);
  const [priceListConfiguration, setPriceListConfiguration] = useState("");
  const [showEmptySportOptions, setShowEmptySportOptions] = useState(false);
  const [previewResult, setPreviewResult] =
    useState<DynamicSlidePreviewResult | null>(null);
  const [isPreviewPending, startPreviewTransition] = useTransition();
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
  const sportAvailability = (selectedSource?.sportAvailability ?? []).filter(
    (record) => record.slideType === slideType
  );
  const sportTeams = (selectedSource?.sportTeams ?? []).filter((team) =>
    showEmptySportOptions ||
    availabilityCount(sportAvailability, { teamExternalId: team.externalId }) > 0
  );
  const selectedSportTeamExternalId = sportTeams.some(
    (team) => team.externalId === sportTeamExternalId
  )
    ? sportTeamExternalId
    : "*";
  const sportCompetitions = (selectedSource?.sportCompetitions ?? []).filter(
    (competition) => {
      const belongsToTeam = selectedSportTeamExternalId === "*" ||
        competition.teamExternalIds.includes(selectedSportTeamExternalId);
      return belongsToTeam && (
        showEmptySportOptions ||
        availabilityCount(sportAvailability, {
          competitionExternalId: competition.externalId,
          teamExternalId: selectedSportTeamExternalId
        }) > 0
      );
    }
  );
  const selectedSportCompetitionExternalId = sportCompetitions.some(
    (competition) =>
      competition.externalId === sportCompetitionExternalId
  )
    ? sportCompetitionExternalId
    : "*";
  const sportSeasons = (selectedSource?.sportSeasons ?? []).filter((season) => {
    const belongsToSelection =
      (selectedSportTeamExternalId === "*" ||
        season.teamExternalIds.includes(selectedSportTeamExternalId)) &&
      (selectedSportCompetitionExternalId === "*" ||
        season.competitionExternalIds.includes(
          selectedSportCompetitionExternalId
        ));
    return belongsToSelection && (
      showEmptySportOptions ||
      availabilityCount(sportAvailability, {
        competitionExternalId: selectedSportCompetitionExternalId,
        season: season.value,
        teamExternalId: selectedSportTeamExternalId
      }) > 0
    );
  });
  const selectedSportSeason = sportSeasons.some(
    (season) => season.value === sportSeason
  )
    ? sportSeason
    : "*";
  const selectedSportItemCount = availabilityCount(sportAvailability, {
    competitionExternalId: selectedSportCompetitionExternalId,
    season: selectedSportSeason,
    teamExternalId: selectedSportTeamExternalId
  });
  const selectedSportHasContent = !supportsSportContextSelection(slideType) ||
    selectedSportItemCount > 0;

  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [currentStep]);

  useEffect(() => {
    if (!selectedSource || !selectedTemplate) {
      setPreviewResult(null);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      const previewFormData = new FormData();
      previewFormData.set("name", name || "Voorbeeld");
      previewFormData.set("slideType", slideType);
      previewFormData.set("templateVersionId", selectedTemplate.versionId);
      previewFormData.set("dataSourceId", selectedSource.id);
      previewFormData.set("title", title);
      previewFormData.set("category", category);
      previewFormData.set(
        "sportCompetitionExternalId",
        selectedSportCompetitionExternalId
      );
      previewFormData.set("sportTeamExternalId", selectedSportTeamExternalId);
      previewFormData.set("sportSeason", selectedSportSeason);
      previewFormData.set("maxItems", maxItems);
      previewFormData.set("secondsPerSlide", secondsPerSlide);
      previewFormData.set("newsVariant", newsVariant);
      previewFormData.set("pricePhotoMode", pricePhotoMode);
      previewFormData.set("priceListJson", priceListJson);
      previewFormData.set("newsFocalPointJson", JSON.stringify(newsFocalPoint));
      if (slideType === "price_list") {
        previewFormData.set("priceListConfiguration", priceListConfiguration);
      }
      startPreviewTransition(async () => {
        const result = await previewDynamicSlide(previewFormData);
        if (active) setPreviewResult(result);
      });
    }, 550);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    category,
    maxItems,
    name,
    newsVariant,
    pricePhotoMode,
    priceListJson,
    priceListConfiguration,
    secondsPerSlide,
    selectedSource,
    selectedSportCompetitionExternalId,
    selectedSportSeason,
    selectedSportTeamExternalId,
    selectedTemplate,
    slideType,
    newsFocalPoint,
    title
  ]);

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
  }

  function selectSlideType(value: string) {
    const nextTemplate = templates.find(
      (template) => template.slideType === value
    );
    setSlideType(value);
    setTemplateVersionId(nextTemplate?.versionId ?? "");
    setDataSourceId("");
    setCategory("");
    setSportCompetitionExternalId("*");
    setSportTeamExternalId("*");
    setSportSeason("*");
    setMaxItems(defaultMaxItems(value));
    setSecondsPerSlide("5");
    setNewsVariant("hero_split");
    setPricePhotoMode("show");
    setPriceListJson("");
    setNewsFocalPoint({ x: 0.5, y: 0.5 });
    setPriceListConfiguration("");
  }

  return (
    <JourneyShell
      actions={<Button asChild variant="secondary"><Link href="/dashboard/studio/new">Annuleren</Link></Button>}
      aside={<DynamicSlideLivePreview loading={isPreviewPending} result={previewResult} />}
      currentStep={String(currentStep)}
      description={wizardSteps[currentStep]!.description}
      eyebrow={`Studio · stap ${currentStep + 1} van ${wizardSteps.length}`}
      steps={wizardSteps.map((step, index) => ({ id: String(index), label: step.label }))}
      title="Nieuwsslide maken"
    >
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
              <TemplatePreview
                primaryColor={primaryColor}
                template={template}
              />
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
        {currentStep === 1 ? (
          <DynamicSlideLivePreview
            loading={isPreviewPending}
            result={previewResult}
          />
        ) : null}
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
              onChange={(event) => {
                setDataSourceId(event.currentTarget.value);
                setSportCompetitionExternalId("*");
                setSportTeamExternalId("*");
                setSportSeason("*");
              }}
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
        {selectedSource ? (
          <SourceQualityPanel
            itemCount={supportsSportContextSelection(slideType)
              ? selectedSportItemCount
              : previewResult?.ok
                ? previewResult.itemCount
                : selectedSource.itemCount}
            previewResult={previewResult}
            source={selectedSource}
          />
        ) : null}
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
                slideType === "news"
                  ? "Voetbalnieuws"
                  : slideType.startsWith("sport_")
                    ? slideTypeLabel(slideType)
                    : "Menu vandaag"
              }
              value={title}
            />
          </label>
          {slideType === "menu" ? (
            <>
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
              <label className={styles.field}>
                <span>Productfoto’s</span>
                <select
                  name="pricePhotoMode"
                  onChange={(event) => setPricePhotoMode(event.currentTarget.value)}
                  value={pricePhotoMode}
                >
                  <option value="show">Tonen wanneer beschikbaar</option>
                  <option value="reserve-empty">Ruimte leeg reserveren</option>
                </select>
              </label>
              {selectedSource ? (
                <EditorialPriceEditor
                  defaultPhotoMode={pricePhotoMode === "reserve-empty" ? "reserve-empty" : "show"}
                  maxItems={Number(maxItems) || 1}
                  onChange={handlePriceListChange}
                  orientation={selectedTemplate.orientation === "portrait" ? "portrait" : "landscape"}
                  products={selectedSource.products}
                  sourceId={selectedSource.id}
                />
              ) : null}
            </>
          ) : null}
          {slideType === "news" ? (
            <label className={styles.field}>
              <span>Nieuwsvariant</span>
              <select
                name="newsVariant"
                onChange={(event) => setNewsVariant(event.currentTarget.value)}
                value={newsVariant}
              >
                <option value="hero_split">Hero split</option>
                <option value="fullscreen_gradient">Fullscreen gradient</option>
                <option value="news_grid">Nieuwsgrid</option>
                <option value="text_only">Zonder foto</option>
              </select>
            </label>
          ) : null}
          {slideType === "news" ? (
            <fieldset className={styles.editorialFocalPoint}>
              <legend>Focal point nieuwsbeeld</legend>
              <label>X <input max="100" min="0" name="newsFocalPointX" onChange={(event) => setNewsFocalPoint((point) => ({ ...point, x: Number(event.currentTarget.value) / 100 }))} type="range" value={Math.round(newsFocalPoint.x * 100)} /></label>
              <label>Y <input max="100" min="0" name="newsFocalPointY" onChange={(event) => setNewsFocalPoint((point) => ({ ...point, y: Number(event.currentTarget.value) / 100 }))} type="range" value={Math.round(newsFocalPoint.y * 100)} /></label>
              <input name="newsFocalPointJson" type="hidden" value={JSON.stringify(newsFocalPoint)} />
            </fieldset>
          ) : null}
          {slideType === "price_list" && selectedSource ? (
            <div className={`${styles.field} ${styles.fieldWide}`}>
              <PriceListConfigurator
                dataSourceId={selectedSource.id}
                key={`${selectedSource.id}-${selectedTemplate.orientation}`}
                onConfigurationChange={setPriceListConfiguration}
                orientation={selectedTemplate.orientation}
                products={products}
                title={title}
              />
              <input
                name="priceListConfiguration"
                type="hidden"
                value={priceListConfiguration}
              />
            </div>
          ) : null}
          {supportsSportContextSelection(slideType) ? (
            <>
              <label
                className={`${styles.field} ${styles.fieldWide} ${styles.checkField}`}
              >
                <input
                  checked={showEmptySportOptions}
                  onChange={(event) =>
                    setShowEmptySportOptions(event.currentTarget.checked)
                  }
                  type="checkbox"
                />
                <span>
                  Toon ook opties zonder bruikbare inhoud
                  <small>
                    Lege opties worden gemarkeerd en kunnen pas na een
                    geslaagde synchronisatie worden gebruikt.
                  </small>
                </span>
              </label>
              <label className={styles.field}>
                <span>Team</span>
                <select
                  name="sportTeamExternalId"
                  onChange={(event) => {
                    setSportTeamExternalId(event.currentTarget.value);
                    setSportCompetitionExternalId("*");
                    setSportSeason("*");
                  }}
                  value={selectedSportTeamExternalId}
                >
                  <option value="*">Alle teams</option>
                  {sportTeams.map((team) => (
                    <option
                      disabled={availabilityCount(sportAvailability, {
                        teamExternalId: team.externalId
                      }) === 0}
                      key={team.externalId}
                      value={team.externalId}
                    >
                      {optionLabel(
                        team.label,
                        availabilityCount(sportAvailability, {
                          teamExternalId: team.externalId
                        })
                      )}
                    </option>
                  ))}
                </select>
                <small className={styles.fieldHint}>
                  {supportsSportStandingSelection(slideType)
                    ? "Kies het team dat in de stand wordt uitgelicht."
                    : "Kies één team of toon het volledige clubprogramma."}
                </small>
              </label>
              <label className={styles.field}>
                <span>Competitie, beker of fase</span>
                <select
                  name="sportCompetitionExternalId"
                  onChange={(event) =>
                    {
                      setSportCompetitionExternalId(
                        event.currentTarget.value
                      );
                      setSportSeason("*");
                    }
                  }
                  value={selectedSportCompetitionExternalId}
                >
                  <option value="*">Alle competities en fasen</option>
                  {sportCompetitions.map((competition) => (
                    <option
                      disabled={availabilityCount(sportAvailability, {
                        competitionExternalId: competition.externalId,
                        teamExternalId: selectedSportTeamExternalId
                      }) === 0}
                      key={competition.externalId}
                      value={competition.externalId}
                    >
                      {optionLabel(
                        competition.label,
                        availabilityCount(sportAvailability, {
                          competitionExternalId: competition.externalId,
                          teamExternalId: selectedSportTeamExternalId
                        })
                      )}
                    </option>
                  ))}
                </select>
                <small className={styles.fieldHint}>
                  Sportlink-contexten zoals competitie, beker, fase en poule
                  blijven afzonderlijk kiesbaar.
                </small>
              </label>
              {supportsSportStandingSelection(slideType) ? (
                <label className={styles.field}>
                  <span>Seizoen</span>
                  <select
                    name="sportSeason"
                    onChange={(event) =>
                      setSportSeason(event.currentTarget.value)
                    }
                    value={selectedSportSeason}
                  >
                    <option value="*">
                      Huidig / nieuwste seizoen (automatisch)
                    </option>
                    {sportSeasons.map((season) => (
                      <option
                        disabled={availabilityCount(sportAvailability, {
                          competitionExternalId:
                            selectedSportCompetitionExternalId,
                          season: season.value,
                          teamExternalId: selectedSportTeamExternalId
                        }) === 0}
                        key={season.value}
                        value={season.value}
                      >
                        {optionLabel(
                          season.label,
                          availabilityCount(sportAvailability, {
                            competitionExternalId:
                              selectedSportCompetitionExternalId,
                            season: season.value,
                            teamExternalId: selectedSportTeamExternalId
                          })
                        )}
                      </option>
                    ))}
                  </select>
                  <small className={styles.fieldHint}>
                    Eerder gesynchroniseerde seizoenen blijven beschikbaar.
                    Automatisch volgt bij een seizoenswissel de nieuwste stand.
                  </small>
                </label>
              ) : null}
            </>
          ) : null}
          {slideType !== "price_list" ? <label className={styles.field}>
            <span>{maxItemsLabel(slideType)}</span>
            <input
              max={
                isSingleMatchSlide(slideType)
                  ? "1"
                  : slideType === "news"
                    ? "12"
                    : isEditorialSportList(slideType)
                      ? "20"
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
          </label> : null}
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
        {supportsSportContextSelection(slideType) &&
        !selectedSportHasContent ? (
          <div className={styles.inlineGuidance} role="alert">
            <strong>
              Deze selectie bevat nu geen publiceerbare Sportlink-inhoud.
            </strong>
            <span>
              Kies een optie met een aantal tussen haakjes of synchroniseer de
              vereiste dataset opnieuw.
            </span>
            <Button asChild size="sm" variant="secondary">
              <Link href="/dashboard/data-sources/sportlink">
                Sportlink controleren
              </Link>
            </Button>
          </div>
        ) : null}
        {currentStep === 3 ? (
          <DynamicSlideLivePreview
            loading={isPreviewPending}
            result={previewResult}
          />
        ) : null}
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
          {supportsSportContextSelection(slideType) ? (
            <>
              <div>
                <dt>Team</dt>
                <dd>
                  {selectedSportTeamExternalId === "*"
                    ? "Alle teams"
                    : sportTeams.find(
                        (team) =>
                          team.externalId === selectedSportTeamExternalId
                      )?.label ?? "Onbekend team"}
                </dd>
              </div>
              <div>
                <dt>Competitie / fase</dt>
                <dd>
                  {selectedSportCompetitionExternalId === "*"
                    ? "Alle competities en fasen"
                    : sportCompetitions.find(
                        (competition) =>
                          competition.externalId ===
                          selectedSportCompetitionExternalId
                      )?.label ?? "Onbekende competitie"}
                </dd>
              </div>
              {supportsSportStandingSelection(slideType) ? (
                <div>
                  <dt>Seizoen</dt>
                  <dd>
                    {selectedSportSeason === "*"
                      ? "Huidig / nieuwste (automatisch)"
                      : selectedSportSeason}
                  </dd>
                </div>
              ) : null}
            </>
          ) : null}
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
          <div>
            <dt>Uitstraling</dt>
            <dd>Centrale Royal Current/Navy Glass-tenantstijl</dd>
          </div>
        </dl>
        <p className={styles.muted}>
          Na opslaan maakt VeyoCast een immutable datasnapshot. Players tonen
          die met de gekozen HTML/CSS-template; de worker bewaart daarnaast
          automatisch een PNG-fallback voor offline en oudere apparaten.
        </p>
        {currentStep === 4 ? (
          <DynamicSlideLivePreview
            loading={isPreviewPending}
            result={previewResult}
          />
        ) : null}
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
              disabled={
                (currentStep === 2 && !selectedSource) ||
                (currentStep === 3 && !selectedSportHasContent)
              }
              onClick={goToNextStep}
              type="button"
            >
              Volgende
              <ChevronRight aria-hidden="true" />
            </Button>
          ) : (
            <Button
              disabled={
                !selectedSource ||
                !selectedSportHasContent ||
                !previewResult?.ok
              }
              type="submit"
            >
              <Sparkles aria-hidden="true" />
              Slide maken
            </Button>
          )}
        </div>
        </footer>
      </form>
    </JourneyShell>
  );
}

function SourceQualityPanel({
  itemCount,
  previewResult,
  source
}: {
  itemCount: number;
  previewResult: DynamicSlidePreviewResult | null;
  source: SlideSourceOption;
}) {
  const lastSync = source.lastSuccessfulSyncAt
    ? new Intl.DateTimeFormat("nl-NL", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(source.lastSuccessfulSyncAt))
    : "Nog niet gesynchroniseerd";
  const previewReady = previewResult?.ok === true;
  const missingAssets = previewResult?.ok
    ? previewResult.missingAssetCount
    : null;

  return (
    <section aria-label="Datakwaliteit en publicatiecontrole" className={styles.sourceQuality}>
      <header>
        <div>
          <span>Datakwaliteit</span>
          <strong>{source.name}</strong>
        </div>
        <Button asChild size="sm" variant="secondary">
          <Link href={sourceSetupHref(source.kind === "sportlink" ? "sport_program" : source.kind === "rss" ? "news" : "menu")}>
            Bron openen
          </Link>
        </Button>
      </header>
      <dl>
        <div>
          <dt>Laatste geslaagde sync</dt>
          <dd>{lastSync}</dd>
        </div>
        <div>
          <dt>Bruikbare inhoud</dt>
          <dd>{itemCount} {itemCount === 1 ? "item" : "items"}</dd>
        </div>
        <div>
          <dt>Providerstatus</dt>
          <dd>{source.providerStatus === "error" ? "Fout · laatste goede data blijft behouden" : "Beschikbaar"}</dd>
        </div>
      </dl>
      <ul className={styles.preflightList}>
        <li data-ready={itemCount > 0}>
          <Check aria-hidden="true" /> Inhoud voor de gekozen selectie
        </li>
        <li data-ready={previewReady}>
          <Check aria-hidden="true" /> Veilige snapshot en Player-renderer
        </li>
        <li data-ready={missingAssets === 0}>
          <Check aria-hidden="true" />
          {missingAssets === null
            ? "Afbeeldingen worden nog gecontroleerd"
            : missingAssets === 0
              ? "Alle gekoppelde afbeeldingen beschikbaar"
              : `${missingAssets} afbeelding(en) gebruiken een veilige fallback`}
        </li>
      </ul>
      {source.lastErrorCode ? (
        <p className={styles.sourceQualityWarning}>
          Laatste synchronisatiemelding: {source.lastErrorCode}. Een nieuwe
          slide gebruikt alleen de laatst gevalideerde inhoud.
        </p>
      ) : null}
    </section>
  );
}

export function availabilityCount(
  records: SportlinkAvailabilityRecord[],
  selection: {
    competitionExternalId?: string;
    season?: string;
    teamExternalId?: string;
  }
) {
  return records.reduce((total, record) => {
    if (
      selection.teamExternalId &&
      selection.teamExternalId !== "*" &&
      !record.teamExternalIds.includes(selection.teamExternalId)
    ) return total;
    if (
      selection.competitionExternalId &&
      selection.competitionExternalId !== "*" &&
      record.competitionExternalId !== selection.competitionExternalId
    ) return total;
    if (
      selection.season &&
      selection.season !== "*" &&
      record.season !== selection.season
    ) return total;
    return total + record.itemCount;
  }, 0);
}

function optionLabel(label: string, count: number) {
  return count > 0 ? `${label} (${count})` : `${label} (geen inhoud)`;
}

function TemplatePreview({
  primaryColor,
  template
}: {
  primaryColor: string;
  template: SlideTemplateOption;
}) {
  const isDark = template.slug.includes("dark");
  const previewType = template.slideType === "menu"
    ? "menu"
    : template.slideType === "price_list"
      ? "price-list"
    : template.slideType === "news"
      ? "news"
      : isSingleMatchSlide(template.slideType)
        ? "match"
        : "sport";
  const isEditorialNews =
    previewType === "news" &&
    (template.orientation === "portrait" || isDark);

  return (
    <span
      aria-hidden="true"
      className={styles.templatePreview}
      data-editorial-news={isEditorialNews || undefined}
      data-orientation={template.orientation}
      data-preview-type={previewType}
      data-theme={isDark ? "dark" : "light"}
      style={{ "--preview-accent": primaryColor } as PreviewStyle}
    >
      <span className={styles.templatePreviewKicker}>
        {previewType === "menu"
          ? "Clubkantine"
          : previewType === "price-list"
            ? "Clubprijzen"
          : previewType === "news"
            ? "Clubnieuws"
            : "Match centre"}
      </span>
      <strong>
        {previewType === "menu"
          ? "Menu vandaag"
          : previewType === "price-list"
            ? "Prijslijst"
          : previewType === "news"
            ? "Het laatste clubnieuws"
            : previewType === "match"
              ? "VeyoCast 1 – Bezoekers"
              : slideTypeLabel(template.slideType)}
      </strong>
      {previewType === "menu" || previewType === "price-list" ? (
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
    const requiredDatasetGroups = slideType
      ? requiredSportlinkDatasetGroups(slideType)
      : [];
    if (requiredDatasetGroups.length) {
      return requiredDatasetGroups.every((datasetGroup) =>
        source.successfulDatasetGroups.includes(datasetGroup)
      );
    }
    return Boolean(source.lastSuccessfulSyncAt);
  }
  return source.itemCount > 0;
}

export function requiredSportlinkDatasetGroups(slideType: string) {
  const groups: Record<string, string[]> = {
    sport_activities: ["activities"],
    sport_birthdays: ["public_people"],
    sport_cancellations: ["matches", "teams"],
    sport_dressing_rooms: ["match_details", "teams"],
    sport_match_of_the_day: ["matches", "teams"],
    sport_next_match: ["matches", "teams"],
    sport_officials: ["match_details", "teams"],
    sport_period_standing: ["competitions"],
    sport_program: ["matches", "teams"],
    sport_results: ["matches", "teams"],
    sport_sponsor: ["teams"],
    sport_standing: ["competitions"],
    sport_team: ["teams"],
    sport_trainings: ["teams"],
    sport_volunteers: ["volunteers"]
  };
  return groups[slideType] ?? [];
}

export function sourceMatchesSlideType(kind: string, slideType: string) {
  if (slideType === "menu" || slideType === "price_list") {
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
  if (slideType === "menu" || slideType === "price_list") {
    return "Maak een handmatige of Twelve-productbron en voeg minimaal één product toe.";
  }
  if (slideType === "news") {
    return "Koppel een publieke RSS- of Atom-feed en voer de eerste synchronisatie uit.";
  }
  return "Koppel Sportlink Club.Dataservice en wacht tot de eerste synchronisatie gereed is.";
}

function missingContentCopy(slideType: string) {
  const datasetGroups = requiredSportlinkDatasetGroups(slideType);
  if (!datasetGroups.length) {
    return "Synchroniseer de bron eerst. Daarna kun je de slide zonder nieuwe configuratie aanmaken.";
  }
  const labels = datasetGroups
    .map((datasetGroup) => `‘${sportlinkDatasetLabel(datasetGroup)}’`)
    .join(" en ");
  return `De vereiste Sportlink-dataset ${labels} is nog niet succesvol afgerond. Open de databron, start de synchronisatie en wacht op de status Gereed.`;
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
  if (slideType === "price_list") return "40";
  if (isEditorialSportList(slideType)) return "20";
  if (supportsSportStandingSelection(slideType)) return "18";
  return "8";
}

function isSingleMatchSlide(slideType: string) {
  return [
    "sport_match_of_the_day",
    "sport_next_match"
  ].includes(slideType);
}

function isEditorialSportList(slideType: string) {
  return ["sport_program", "sport_results", "sport_standing"].includes(
    slideType
  );
}

export function supportsSportMatchSelection(slideType: string) {
  return [
    "sport_cancellations",
    "sport_dressing_rooms",
    "sport_match_of_the_day",
    "sport_next_match",
    "sport_officials",
    "sport_program",
    "sport_results"
  ].includes(slideType);
}

export function supportsSportStandingSelection(slideType: string) {
  return [
    "sport_period_standing",
    "sport_standing"
  ].includes(slideType);
}

export function supportsSportContextSelection(slideType: string) {
  return supportsSportMatchSelection(slideType) ||
    supportsSportStandingSelection(slideType);
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
    ? orientation === "portrait" ? 32 : 16
    : slideType === "news"
      ? 1
      : isEditorialSportList(slideType)
        ? 20
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
  return template.slug.includes("-dark-")
    ? "Editorial Arena · donker"
    : "Editorial Arena · licht";
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
    price_list: "Prijslijst",
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
