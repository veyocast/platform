"use client";

import { useMemo, useState } from "react";
import { Film, Image as ImageIcon, LayoutTemplate, Sparkles } from "lucide-react";

import type {
  StudioDocument,
  StudioFormatId,
  StudioSystemTemplate,
  StudioTemplateCategory
} from "@veyocast/studio";
import { Button, Field, StatusPill } from "@veyocast/ui";

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
  const [format, setFormat] = useState<"landscape-hd" | "portrait-hd">(
    "landscape-hd"
  );
  const [category, setCategory] = useState<StudioTemplateCategory | "all">(
    "all"
  );
  const [motion, setMotion] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const visibleTemplates = useMemo(
    () =>
      templates.filter(
        (template) =>
          template.formatId === format &&
          (category === "all" || template.category === category)
      ),
    [category, format, templates]
  );
  const visibleTenantTemplates = tenantTemplates.filter(
    (template) => template.formatId === format && category === "all"
  );

  return (
    <form action={action} className={styles.newFlow}>
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <section className={styles.setupPanel}>
        <div className={styles.stepHeading}>
          <span>1</span>
          <div>
            <h2>Basis</h2>
            <p>Geef het ontwerp een herkenbare interne naam.</p>
          </div>
        </div>
        <Field label="Ontwerpnaam">
          <input
            autoComplete="off"
            maxLength={120}
            minLength={2}
            name="name"
            placeholder="Bijvoorbeeld Wedstrijddag"
            required
          />
        </Field>
        <div className={styles.choiceGrid}>
          <label className={styles.choiceCard} data-selected={format === "landscape-hd"}>
            <input
              checked={format === "landscape-hd"}
              name="format"
              onChange={() => {
                setFormat("landscape-hd");
                setTemplateId("");
              }}
              type="radio"
              value="landscape-hd"
            />
            <span className={styles.landscapeRatio} />
            <strong>Liggend HD</strong>
            <small>1920 × 1080 · tv en signage</small>
          </label>
          <label className={styles.choiceCard} data-selected={format === "portrait-hd"}>
            <input
              checked={format === "portrait-hd"}
              name="format"
              onChange={() => {
                setFormat("portrait-hd");
                setTemplateId("");
              }}
              type="radio"
              value="portrait-hd"
            />
            <span className={styles.portraitRatio} />
            <strong>Staand HD</strong>
            <small>1080 × 1920 · portrait signage</small>
          </label>
        </div>
      </section>

      <section className={styles.setupPanel}>
        <div className={styles.stepHeading}>
          <span>2</span>
          <div>
            <h2>Startpunt</h2>
            <p>Alles blijft na het kiezen volledig bewerkbaar.</p>
          </div>
        </div>
        <div className={styles.templateFilters} role="group" aria-label="Templatecategorie">
          <button
            aria-pressed={category === "all"}
            onClick={() => setCategory("all")}
            type="button"
          >
            Alles
          </button>
          {categories.map((value) => (
            <button
              aria-pressed={category === value}
              key={value}
              onClick={() => setCategory(value)}
              type="button"
            >
              {categoryLabels[value]}
            </button>
          ))}
        </div>
        <div className={styles.templateGrid}>
          <label className={styles.templateCard} data-selected={!templateId}>
            <input
              checked={!templateId}
              name="templateId"
              onChange={() => setTemplateId("")}
              type="radio"
              value=""
            />
            <span className={styles.blankTemplate}>
              <Sparkles aria-hidden="true" />
            </span>
            <strong>Leeg ontwerp</strong>
            <small>Begin met een schoon artboard.</small>
          </label>
          {visibleTenantTemplates.map((template) => (
            <label
              className={styles.templateCard}
              data-selected={templateId === template.id}
              key={template.id}
            >
              <input
                checked={templateId === template.id}
                name="templateId"
                onChange={() => setTemplateId(template.id)}
                type="radio"
                value={template.id}
              />
              <span className={styles.templateThumb}>
                <LayoutTemplate aria-hidden="true" />
                {templateHeadline(template)}
              </span>
              <strong>{template.name}</strong>
              <small>{template.description} · Tenanttemplate</small>
            </label>
          ))}
          {visibleTemplates.map((template) => (
            <label
              className={styles.templateCard}
              data-selected={templateId === template.id}
              key={template.id}
            >
              <input
                checked={templateId === template.id}
                name="templateId"
                onChange={() => setTemplateId(template.id)}
                type="radio"
                value={template.id}
              />
              <span className={styles.templateThumb}>
                <LayoutTemplate aria-hidden="true" />
                {templateHeadline(template)}
              </span>
              <strong>{template.name}</strong>
              <small>{template.description}</small>
            </label>
          ))}
        </div>
      </section>

      <section className={styles.setupPanel}>
        <div className={styles.stepHeading}>
          <span>3</span>
          <div>
            <h2>Uitvoer</h2>
            <p>Kies stilstaand of voeg een korte motion-tijdlijn toe.</p>
          </div>
        </div>
        <div className={styles.choiceGrid}>
          <label className={styles.choiceCard} data-selected={!motion}>
            <input
              checked={!motion}
              name="motionMode"
              onChange={() => setMotion(false)}
              type="radio"
              value="still"
            />
            <ImageIcon aria-hidden="true" />
            <strong>Stilstaand</strong>
            <small>Render als PNG.</small>
          </label>
          <label className={styles.choiceCard} data-selected={motion}>
            <input
              checked={motion}
              name="motionMode"
              onChange={() => setMotion(true)}
              type="radio"
              value="motion"
            />
            <Film aria-hidden="true" />
            <strong>Motion</strong>
            <small>Render tot 30 seconden als MP4.</small>
          </label>
        </div>
        {motion ? <input name="motionEnabled" type="hidden" value="on" /> : null}
        {tenantBrand ? (
          <label className={styles.choiceCard}>
            <input name="applyTenantBrand" type="checkbox" />
            <span
              aria-hidden="true"
              className={styles.brandPreview}
              style={{
                background: `linear-gradient(135deg, ${tenantBrand.primaryColor} 0 50%, ${tenantBrand.secondaryColor} 50% 100%)`
              }}
            />
            <strong>Huisstijl toepassen</strong>
            <small>
              Gebruik het ingestelde clublogo en de twee gecontroleerde
              merkkleuren als bewerkbaar startpunt.
            </small>
          </label>
        ) : null}
        {canManageTemplates ? (
          <label className={styles.choiceCard}>
            <input name="projectKind" type="checkbox" value="tenant_template" />
            <LayoutTemplate aria-hidden="true" />
            <strong>Als tenanttemplate bewaren</strong>
            <small>
              Beschikbaar voor teamleden die nieuwe Studio-ontwerpen maken.
            </small>
          </label>
        ) : null}
      </section>

      <footer className={styles.newFooter}>
        <div>
          <StatusPill
            label={canCreate ? "Klaar om te maken" : "Alleen-lezen"}
            tone={canCreate ? "success" : "warning"}
          />
          <span>
            {format === "landscape-hd" ? "Liggend HD" : "Staand HD"} ·{" "}
            {motion ? "MP4" : "PNG"}
          </span>
        </div>
        <Button disabled={!canCreate} size="lg" type="submit">
          Ontwerp maken
        </Button>
      </footer>
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

function templateHeadline(template: StudioTemplateChoice) {
  const headline = template.document.elements.find(
    (element) => element.type === "text" && element.id === "headline"
  );
  return headline?.type === "text" ? headline.text : template.name;
}
