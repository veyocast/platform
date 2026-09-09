"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Film,
  Image as ImageIcon,
  LayoutTemplate,
  Search,
  Sparkles
} from "lucide-react";

import type {
  StudioDocument,
  StudioFormatId,
  StudioSystemTemplate,
  StudioTemplateCategory
} from "@veyocast/studio";
import {
  Button,
  Field,
  JourneyShell,
  StatusPill,
  StickyActionBar
} from "@veyocast/ui";

import styles from "../studio.module.css";
import type { StudioBrandKit } from "../types";

const categoryLabels: Record<StudioTemplateCategory, string> = {
  activity: "Activiteit",
  cancelled: "Afgelast",
  emergency: "Noodmelding",
  matchday: "Wedstrijddag",
  menu: "Menu",
  result: "Uitslag",
  schedule: "Programma",
  social: "Social",
  sponsor: "Sponsor",
  volunteer: "Vrijwilligers",
  welcome: "Welkom"
};

const steps = [
  { id: "basis", label: "Basis" },
  { id: "startpunt", label: "Startpunt" },
  { id: "uitvoer", label: "Uitvoer" },
  { id: "controleren", label: "Controleren" }
] as const;

export function NewStudioForm({
  action,
  canCreate,
  canManageTemplates,
  categories,
  tenantBrand,
  tenantTemplates,
  templates
}: {
  action: (formData: FormData) => Promise<void>;
  canCreate: boolean;
  canManageTemplates: boolean;
  categories: readonly StudioTemplateCategory[];
  tenantBrand: StudioBrandKit | null;
  tenantTemplates: readonly StudioTemplateChoice[];
  templates: readonly StudioSystemTemplate[];
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState<"landscape-hd" | "portrait-hd">(
    "landscape-hd"
  );
  const [category, setCategory] = useState<StudioTemplateCategory | "all">(
    "all"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [motion, setMotion] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [applyTenantBrand, setApplyTenantBrand] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("nl-NL");
  const visibleTemplates = useMemo(
    () =>
      templates.filter(
        (template) =>
          template.formatId === format &&
          (category === "all" || template.category === category) &&
          templateMatches(template, normalizedQuery)
      ),
    [category, format, normalizedQuery, templates]
  );
  const visibleTenantTemplates = tenantTemplates.filter(
    (template) =>
      template.formatId === format &&
      category === "all" &&
      templateMatches(template, normalizedQuery)
  );
  const nameIsValid = name.trim().length >= 2;
  const ready = canCreate && nameIsValid;
  const currentStep = steps[stepIndex] ?? steps[0];
  const selectedTemplate = [...tenantTemplates, ...templates].find(
    (template) => template.id === templateId
  );

  useEffect(() => {
    const hydratedValue = nameInputRef.current?.value ?? "";
    if (hydratedValue) setName(hydratedValue);
  }, []);

  function chooseFormat(nextFormat: "landscape-hd" | "portrait-hd") {
    setFormat(nextFormat);
    setTemplateId("");
  }

  function goToStep(nextStep: number) {
    setStepIndex(Math.max(0, Math.min(steps.length - 1, nextStep)));
    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  return (
    <form
      action={action}
      className={styles.newFlow}
      onSubmit={(event) => {
        if (stepIndex !== steps.length - 1 || !ready) event.preventDefault();
      }}
    >
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <input name="name" type="hidden" value={name} />
      <input name="format" type="hidden" value={format} />
      <input name="templateId" type="hidden" value={templateId} />
      <input name="motionMode" type="hidden" value={motion ? "motion" : "still"} />
      <input name="motionEnabled" type="hidden" value={motion ? "on" : "off"} />
      <input
        name="applyTenantBrand"
        type="hidden"
        value={applyTenantBrand ? "on" : "off"}
      />
      <input
        name="projectKind"
        type="hidden"
        value={saveAsTemplate ? "tenant_template" : "design"}
      />

      <JourneyShell
        actions={
          <Button asChild variant="secondary">
            <Link href="/dashboard/studio">Annuleren</Link>
          </Button>
        }
        aside={
          <aside aria-label="Samenvatting ontwerp" className={styles.newSummary}>
            <div>
              <span>Status</span>
              <StatusPill
                label={
                  !canCreate
                    ? "Alleen-lezen"
                    : ready
                      ? "Invoer compleet"
                      : "Naam ontbreekt"
                }
                tone={!canCreate || !ready ? "warning" : "success"}
              />
            </div>
            <dl>
              <div>
                <dt>Naam</dt>
                <dd>{name.trim() || "Nog invullen"}</dd>
              </div>
              <div>
                <dt>Formaat</dt>
                <dd>{format === "landscape-hd" ? "Liggend HD" : "Staand HD"}</dd>
              </div>
              <div>
                <dt>Startpunt</dt>
                <dd>{selectedTemplate?.name ?? "Leeg ontwerp"}</dd>
              </div>
              <div>
                <dt>Uitvoer</dt>
                <dd>{motion ? "Motion · MP4" : "Stilstaand · PNG"}</dd>
              </div>
            </dl>
          </aside>
        }
        currentStep={currentStep.id}
        description="Maak een ontwerp in vier overzichtelijke stappen. Je keuzes blijven bewaard terwijl je vooruit en terug navigeert."
        eyebrow="Studio"
        steps={steps}
        title="Nieuw ontwerp"
      >
        {stepIndex === 0 ? (
          <section aria-labelledby="studio-basis" className={styles.setupPanel}>
            <div className={styles.stepHeading}>
              <span aria-hidden="true">1</span>
              <div>
                <h2 id="studio-basis">Basis</h2>
                <p>Geef het ontwerp een herkenbare interne naam en formaat.</p>
              </div>
            </div>
            <Field
              description="Minimaal twee tekens; deze naam is alleen intern zichtbaar."
              error={
                name.length > 0 && !nameIsValid
                  ? "Gebruik minimaal twee tekens."
                  : undefined
              }
              id="studio-project-name"
              label="Ontwerpnaam"
            >
              <input
                autoComplete="off"
                defaultValue=""
                id="studio-project-name"
                maxLength={120}
                minLength={2}
                onInput={(event) => setName(event.currentTarget.value)}
                placeholder="Bijvoorbeeld Wedstrijddag"
                ref={nameInputRef}
                required
              />
            </Field>
            <fieldset className={styles.choiceFieldset}>
              <legend>Formaat</legend>
              <div className={styles.choiceGrid}>
                <label
                  className={styles.choiceCard}
                  data-selected={format === "landscape-hd"}
                >
                  <input
                    checked={format === "landscape-hd"}
                    onChange={() => chooseFormat("landscape-hd")}
                    type="radio"
                  />
                  <span className={styles.landscapeRatio} />
                  <strong>Liggend HD</strong>
                  <small>1920 × 1080 · tv en signage</small>
                </label>
                <label
                  className={styles.choiceCard}
                  data-selected={format === "portrait-hd"}
                >
                  <input
                    checked={format === "portrait-hd"}
                    onChange={() => chooseFormat("portrait-hd")}
                    type="radio"
                  />
                  <span className={styles.portraitRatio} />
                  <strong>Staand HD</strong>
                  <small>1080 × 1920 · portrait signage</small>
                </label>
              </div>
            </fieldset>
          </section>
        ) : null}

        {stepIndex === 1 ? (
          <section
            aria-labelledby="studio-startpunt"
            className={styles.setupPanel}
          >
            <div className={styles.stepHeading}>
              <span aria-hidden="true">2</span>
              <div>
                <h2 id="studio-startpunt">Startpunt</h2>
                <p>Zoek gericht; alles blijft na het kiezen volledig bewerkbaar.</p>
              </div>
            </div>
            <div className={styles.templateSearch}>
              <Field id="studio-template-search" label="Zoek template">
                <span className={styles.searchField}>
                  <Search aria-hidden="true" />
                  <input
                    id="studio-template-search"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Zoek op naam of omschrijving"
                    type="search"
                    value={searchQuery}
                  />
                </span>
              </Field>
              <Field id="studio-template-category" label="Categorie">
                <select
                  id="studio-template-category"
                  onChange={(event) =>
                    setCategory(
                      event.target.value as StudioTemplateCategory | "all"
                    )
                  }
                  value={category}
                >
                  <option value="all">Alle categorieën</option>
                  {categories.map((value) => (
                    <option key={value} value={value}>
                      {categoryLabels[value]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div aria-live="polite" className={styles.templateGrid}>
              <label
                className={styles.templateCard}
                data-selected={!templateId}
              >
                <input
                  checked={!templateId}
                  onChange={() => setTemplateId("")}
                  type="radio"
                />
                <span className={styles.blankTemplate}>
                  <Sparkles aria-hidden="true" />
                </span>
                <strong>Leeg ontwerp</strong>
                <small>Begin met een schoon artboard.</small>
              </label>
              {visibleTenantTemplates.map((template) => (
                <TemplateChoice
                  key={template.id}
                  onSelect={setTemplateId}
                  selected={templateId === template.id}
                  template={template}
                  tenant
                />
              ))}
              {visibleTemplates.map((template) => (
                <TemplateChoice
                  key={template.id}
                  onSelect={setTemplateId}
                  selected={templateId === template.id}
                  template={template}
                />
              ))}
            </div>
            {visibleTenantTemplates.length + visibleTemplates.length === 0 ? (
              <p className={styles.noTemplates}>
                Geen templates gevonden. Pas de zoekterm of categorie aan.
              </p>
            ) : null}
          </section>
        ) : null}

        {stepIndex === 2 ? (
          <section aria-labelledby="studio-uitvoer" className={styles.setupPanel}>
            <div className={styles.stepHeading}>
              <span aria-hidden="true">3</span>
              <div>
                <h2 id="studio-uitvoer">Uitvoer</h2>
                <p>Kies stilstaand of voeg een korte motion-tijdlijn toe. Systeemtemplates starten in Royal Current/Navy Glass; vrije ontwerpen behouden hun eigen pixels.</p>
              </div>
            </div>
            <fieldset className={styles.choiceFieldset}>
              <legend>Uitvoertype</legend>
              <div className={styles.choiceGrid}>
                <label className={styles.choiceCard} data-selected={!motion}>
                  <input
                    checked={!motion}
                    onChange={() => setMotion(false)}
                    type="radio"
                  />
                  <ImageIcon aria-hidden="true" />
                  <strong>Stilstaand</strong>
                  <small>Render als PNG.</small>
                </label>
                <label className={styles.choiceCard} data-selected={motion}>
                  <input
                    checked={motion}
                    onChange={() => setMotion(true)}
                    type="radio"
                  />
                  <Film aria-hidden="true" />
                  <strong>Motion</strong>
                  <small>Render tot 30 seconden als MP4.</small>
                </label>
              </div>
            </fieldset>
            {tenantBrand ? (
              <label
                className={styles.choiceCard}
                data-selected={applyTenantBrand}
              >
                <input
                  checked={applyTenantBrand}
                  onChange={(event) =>
                    setApplyTenantBrand(event.target.checked)
                  }
                  type="checkbox"
                />
                <span
                  aria-hidden="true"
                  className={styles.brandPreview}
                  style={{
                    background: `linear-gradient(135deg, ${tenantBrand.primaryColor} 0 50%, ${tenantBrand.secondaryColor} 50% 100%)`
                  }}
                />
                <strong>Studio-huisstijl toepassen</strong>
                <small>
                  Maak een bewerkbare kopie met het clublogo en de afzonderlijk
                  beheerde Studio-kleuren. Latere tenantstijlwijzigingen kleuren
                  dit vrije ontwerp niet automatisch opnieuw.
                </small>
              </label>
            ) : null}
            {canManageTemplates ? (
              <label
                className={styles.choiceCard}
                data-selected={saveAsTemplate}
              >
                <input
                  checked={saveAsTemplate}
                  onChange={(event) => setSaveAsTemplate(event.target.checked)}
                  type="checkbox"
                />
                <LayoutTemplate aria-hidden="true" />
                <strong>Als tenanttemplate bewaren</strong>
                <small>
                  Maak dit startpunt beschikbaar voor andere teamleden.
                </small>
              </label>
            ) : null}
          </section>
        ) : null}

        {stepIndex === 3 ? (
          <section
            aria-labelledby="studio-controleren"
            className={styles.setupPanel}
          >
            <div className={styles.stepHeading}>
              <span aria-hidden="true"><Check /></span>
              <div>
                <h2 id="studio-controleren">Controleren</h2>
                <p>Controleer de invoer voordat het concept wordt aangemaakt.</p>
              </div>
            </div>
            <dl className={styles.reviewList}>
              <div>
                <dt>Ontwerpnaam</dt>
                <dd>{name.trim() || "Nog invullen"}</dd>
              </div>
              <div>
                <dt>Formaat</dt>
                <dd>
                  {format === "landscape-hd"
                    ? "Liggend HD · 1920 × 1080"
                    : "Staand HD · 1080 × 1920"}
                </dd>
              </div>
              <div>
                <dt>Startpunt</dt>
                <dd>{selectedTemplate?.name ?? "Leeg ontwerp"}</dd>
              </div>
              <div>
                <dt>Uitvoer</dt>
                <dd>{motion ? "Motion · MP4" : "Stilstaand · PNG"}</dd>
              </div>
              {tenantBrand ? (
                <div>
                  <dt>Studio-huisstijl</dt>
                  <dd>{applyTenantBrand ? "Toepassen" : "Niet toepassen"}</dd>
                </div>
              ) : null}
              {canManageTemplates ? (
                <div>
                  <dt>Type</dt>
                  <dd>{saveAsTemplate ? "Tenanttemplate" : "Ontwerp"}</dd>
                </div>
              ) : null}
            </dl>
            {!ready ? (
              <p className={styles.reviewWarning} role="alert">
                {!canCreate
                  ? "Je hebt in deze omgeving alleen leesrechten; er wordt niets aangemaakt."
                  : "Vul bij Basis een ontwerpnaam van minimaal twee tekens in."}
              </p>
            ) : null}
          </section>
        ) : null}

        <StickyActionBar
          aside={`Stap ${stepIndex + 1} van ${steps.length} · ${currentStep.label}`}
          className={styles.newFooter}
        >
          {stepIndex > 0 ? (
            <Button
              onClick={() => goToStep(stepIndex - 1)}
              type="button"
              variant="secondary"
            >
              <ArrowLeft aria-hidden="true" />
              Vorige
            </Button>
          ) : null}
          {stepIndex < steps.length - 1 ? (
            <Button
              disabled={stepIndex === 0 && !nameIsValid}
              key="wizard-next"
              onClick={(event) => {
                event.preventDefault();
                goToStep(stepIndex + 1);
              }}
              type="button"
            >
              Volgende
              <ArrowRight aria-hidden="true" />
            </Button>
          ) : (
            <Button disabled={!ready} key="wizard-submit" size="lg" type="submit">
              Ontwerp maken
            </Button>
          )}
        </StickyActionBar>
      </JourneyShell>
    </form>
  );
}

type StudioTemplateChoice = Readonly<{
  description: string;
  document: StudioDocument;
  formatId: StudioFormatId;
  id: string;
  name: string;
}>;

function TemplateChoice({
  onSelect,
  selected,
  template,
  tenant = false
}: {
  onSelect: (id: string) => void;
  selected: boolean;
  template: StudioTemplateChoice;
  tenant?: boolean;
}) {
  return (
    <label className={styles.templateCard} data-selected={selected}>
      <input
        checked={selected}
        onChange={() => onSelect(template.id)}
        type="radio"
      />
      <span className={styles.templateThumb} data-format={template.formatId}>
        <LayoutTemplate aria-hidden="true" />
        {templateHeadline(template)}
      </span>
      <strong>{template.name}</strong>
      <small>
        {template.description}
        {tenant ? " · Tenanttemplate" : ""}
      </small>
    </label>
  );
}

function templateMatches(template: StudioTemplateChoice, query: string) {
  return (
    !query ||
    `${template.name} ${template.description}`
      .toLocaleLowerCase("nl-NL")
      .includes(query)
  );
}

function templateHeadline(template: StudioTemplateChoice) {
  const headline = template.document.elements.find(
    (element) => element.type === "text" && element.id === "headline"
  );
  return headline?.type === "text" ? headline.text : template.name;
}
