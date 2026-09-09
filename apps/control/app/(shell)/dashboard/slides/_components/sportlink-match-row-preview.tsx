import React, { type CSSProperties } from "react";

import {
  sportlinkSlideBlueprints,
  type SportlinkDisplayConfig,
  type SportlinkSlideBlueprintKey
} from "@veyocast/contracts";

import styles from "./sportlink-match-row-preview.module.css";

type MatchRowKind = "program" | "results";
type MatchRowField = {
  className?: string;
  field: string;
  label: string;
  shortLabel?: string;
  track: string;
};

export function sportlinkMatchRowPreviewKind(
  blueprintKey: SportlinkSlideBlueprintKey | undefined
): MatchRowKind | null {
  if (!blueprintKey) return null;
  const slideType = sportlinkSlideBlueprints[blueprintKey].slideType;
  if (slideType === "sport_program") return "program";
  if (slideType === "sport_results") return "results";
  return null;
}

export function SportlinkMatchRowPreview({
  blueprintKey,
  display,
  orientation
}: {
  blueprintKey: SportlinkSlideBlueprintKey;
  display: SportlinkDisplayConfig;
  orientation: "landscape" | "portrait";
}) {
  const kind = sportlinkMatchRowPreviewKind(blueprintKey);
  if (!kind) return null;

  const columns = orientation === "landscape" && display.columns === "two"
    ? "two"
    : "one";

  return (
    <section
      aria-label={`${kind === "program" ? "Programma" : "Uitslag"}rij-indeling`}
      className={styles.root}
      data-columns={columns}
      data-kind={kind}
      data-orientation={orientation}
      data-preview-source="field-labels"
    >
      <span className={styles.note}>Veldindeling · geen providerdata</span>
      <div className={styles.columns} data-columns={columns}>
        <PreviewRow display={display} kind={kind} />
        {columns === "two" ? (
          <PreviewRow ariaHidden display={display} kind={kind} />
        ) : null}
      </div>
    </section>
  );
}

function PreviewRow({
  ariaHidden = false,
  display,
  kind
}: {
  ariaHidden?: boolean;
  display: SportlinkDisplayConfig;
  kind: MatchRowKind;
}) {
  const fields = primaryFields(display, kind);
  const secondaryFields = kind === "program"
    ? [
        display.showReferee ? "Scheidsrechter" : null,
        display.showField ? "Veld" : null,
        display.showSportpark ? "Sportpark" : null
      ].filter((field): field is string => Boolean(field))
    : [];

  return (
    <article aria-hidden={ariaHidden || undefined} className={styles.row}>
      <div
        className={styles.primary}
        style={{
          "--sportlink-preview-columns": fields.map((field) => field.track).join(" ")
        } as CSSProperties}
      >
        {fields.map((field) => (
          <span
            aria-label={field.label}
            className={field.className}
            data-field={field.field}
            key={field.field}
            title={field.label}
          >
            {field.shortLabel ?? field.label}
          </span>
        ))}
      </div>
      {secondaryFields.length ? (
        <div className={styles.secondary} data-line="secondary">
          {secondaryFields.map((field) => (
            <span data-field={field.toLowerCase()} key={field}>{field}</span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function primaryFields(
  display: SportlinkDisplayConfig,
  kind: MatchRowKind
): MatchRowField[] {
  return [
    display.showDate
      ? { field: "date", label: "Datum", track: "minmax(0, .62fr)" }
      : null,
    display.showTime
      ? { field: "time", label: "Tijd", track: "minmax(0, .46fr)" }
      : null,
    display.showHomeLogo
      ? {
          className: styles.logo,
          field: "home-logo",
          label: "Logo thuisclub",
          shortLabel: "T",
          track: "minmax(12px, .28fr)"
        }
      : null,
    {
      className: styles.team,
      field: "home-team",
      label: "Thuisclub + team",
      track: "minmax(0, 1.35fr)"
    },
    kind === "program" && display.showHomeDressingRoom
      ? {
          field: "home-dressing-room",
          label: "Kleedkamer thuis",
          track: "minmax(0, .78fr)"
        }
      : null,
    kind === "results"
      ? {
          className: styles.score,
          field: "score",
          label: "Uitslag nog niet bekend",
          shortLabel: "–",
          track: "minmax(12px, .36fr)"
        }
      : {
          className: styles.versus,
          field: "versus",
          label: "versus",
          shortLabel: "vs.",
          track: "minmax(12px, .28fr)"
        },
    display.showAwayLogo
      ? {
          className: styles.logo,
          field: "away-logo",
          label: "Logo uitclub",
          shortLabel: "U",
          track: "minmax(12px, .28fr)"
        }
      : null,
    {
      className: styles.team,
      field: "away-team",
      label: "Uitclub + team",
      track: "minmax(0, 1.35fr)"
    },
    kind === "program" && display.showAwayDressingRoom
      ? {
          field: "away-dressing-room",
          label: "Kleedkamer uit",
          track: "minmax(0, .78fr)"
        }
      : null
  ].filter((field): field is MatchRowField => Boolean(field));
}
