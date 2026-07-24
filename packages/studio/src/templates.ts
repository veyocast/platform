import { createEmptyStudioDocument } from "./document";
import { parseStudioDocument, type StudioDocument, type StudioElement } from "./schema";
import type { StudioFormatId } from "./constants";

export const studioTemplateCategories = [
  "matchday",
  "schedule",
  "result",
  "sponsor",
  "menu",
  "activity",
  "volunteer",
  "welcome",
  "cancelled",
  "social",
  "emergency"
] as const;

export type StudioTemplateCategory = (typeof studioTemplateCategories)[number];

export type StudioSystemTemplate = Readonly<{
  category: StudioTemplateCategory;
  description: string;
  document: StudioDocument;
  formatId: StudioFormatId;
  id: string;
  name: string;
  version: number;
}>;

const templateCopy: ReadonlyArray<Readonly<{
  category: StudioTemplateCategory;
  eyebrow: string;
  title: string;
  subtitle: string;
}>> = [
  { category: "matchday", eyebrow: "Vandaag", title: "Wedstrijddag", subtitle: "Aanvang 20:00" },
  { category: "schedule", eyebrow: "Programma", title: "Volgende wedstrijden", subtitle: "Bekijk het volledige programma" },
  { category: "result", eyebrow: "Eindstand", title: "2 — 1", subtitle: "Bedankt voor jullie support" },
  { category: "sponsor", eyebrow: "In de spotlight", title: "Onze sponsor", subtitle: "Samen maken we de club sterker" },
  { category: "menu", eyebrow: "Vandaag", title: "Kantinemenu", subtitle: "Bekijk het aanbod aan de bar" },
  { category: "activity", eyebrow: "Clubagenda", title: "Nieuwe activiteit", subtitle: "Iedereen is welkom" },
  { category: "volunteer", eyebrow: "Help de club", title: "Vrijwilliger gezocht", subtitle: "Meld je aan bij het bestuur" },
  { category: "welcome", eyebrow: "Welkom", title: "Fijn dat je er bent", subtitle: "Samen beleven we de club" },
  { category: "cancelled", eyebrow: "Let op", title: "Training afgelast", subtitle: "Bekijk de actuele clubinformatie" },
  { category: "social", eyebrow: "Deel het moment", title: "Volg onze club", subtitle: "@jouwclub" },
  { category: "emergency", eyebrow: "Belangrijk", title: "Noodmelding", subtitle: "Volg de aanwijzingen ter plaatse" }
];

export const studioSystemTemplates: readonly StudioSystemTemplate[] =
  templateCopy.flatMap((copy) =>
    (["landscape-hd", "portrait-hd"] as const).map((formatId) => ({
      category: copy.category,
      description: `${copy.title} met veilige, bewerkbare tekst- en beeldslots.`,
      document: createTemplateDocument(formatId, copy),
      formatId,
      id: `system-${copy.category}-${formatId}-v1`,
      name: copy.title,
      version: 1
    }))
  );

export function getStudioSystemTemplate(templateId: string) {
  return studioSystemTemplates.find((template) => template.id === templateId);
}

function createTemplateDocument(
  formatId: StudioFormatId,
  copy: Readonly<{ category: StudioTemplateCategory; eyebrow: string; title: string; subtitle: string }>
): StudioDocument {
  const document = createEmptyStudioDocument(formatId, {
    background: "#0A0A0A",
    templateId: `system-${copy.category}-${formatId}-v1`
  });
  const landscape = formatId === "landscape-hd";
  const height = document.artboard.height;
  const contentWidth = landscape ? 1_060 : 880;
  const left = landscape ? 112 : 100;
  const titleY = landscape ? 350 : 730;
  const elements: StudioElement[] = [
    {
      id: "accent-block",
      type: "shape",
      name: "Accentvlak",
      x: left,
      y: titleY - 48,
      width: landscape ? 124 : 96,
      height: 14,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: 0,
      shape: "rectangle",
      fill: { kind: "solid", color: "#FF5C20" },
      cornerRadius: 7
    },
    {
      id: "eyebrow",
      type: "text",
      name: "Label",
      x: left,
      y: titleY,
      width: contentWidth,
      height: 70,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: 1,
      text: copy.eyebrow.toLocaleUpperCase("nl-NL"),
      fontFamily: "Inter Variable",
      fontWeight: 700,
      fontSize: landscape ? 30 : 34,
      lineHeight: 1.1,
      letterSpacing: 4,
      fill: "#FFAE72",
      align: "left",
      verticalAlign: "top",
      autoFit: false,
      cornerRadius: 0,
      padding: 0
    },
    {
      id: "headline",
      type: "text",
      name: "Koptekst",
      x: left,
      y: titleY + 74,
      width: contentWidth,
      height: landscape ? 230 : 330,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: 2,
      text: copy.title,
      fontFamily: "Inter Tight Variable",
      fontWeight: 800,
      fontSize: landscape ? 112 : 128,
      lineHeight: 0.98,
      letterSpacing: -3,
      fill: "#FAFAF7",
      align: "left",
      verticalAlign: "top",
      autoFit: true,
      cornerRadius: 0,
      padding: 0
    },
    {
      id: "subtitle",
      type: "text",
      name: "Subtekst",
      x: left,
      y: titleY + (landscape ? 300 : 440),
      width: contentWidth,
      height: 120,
      rotation: 0,
      opacity: 0.82,
      visible: true,
      locked: false,
      zIndex: 3,
      text: copy.subtitle,
      fontFamily: "Inter Variable",
      fontWeight: 500,
      fontSize: landscape ? 38 : 44,
      lineHeight: 1.25,
      letterSpacing: 0,
      fill: "#FAFAF7",
      align: "left",
      verticalAlign: "top",
      autoFit: false,
      cornerRadius: 0,
      padding: 0
    },
    {
      id: "photo-slot",
      type: "placeholder",
      name: "Fotoplaceholder",
      x: landscape ? 1_300 : 100,
      y: landscape ? 112 : 112,
      width: landscape ? 508 : 880,
      height: landscape ? 856 : 500,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: 4,
      slot: "photo",
      label: "Vervang door een clubfoto",
      fill: "#171717",
      stroke: "#505050"
    },
    {
      id: "brand-mark",
      type: "placeholder",
      name: "Clublogo",
      x: landscape ? 1_604 : 748,
      y: landscape ? 760 : height - 332,
      width: 160,
      height: 160,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: 5,
      slot: "tenant-logo",
      label: "Clublogo",
      fill: "#FAFAF7",
      stroke: "#FF5C20"
    }
  ];

  return parseStudioDocument({
    ...document,
    artboard: {
      ...document.artboard,
      background: {
        kind: "linear-gradient",
        from: "#0A0A0A",
        to: "#24120B",
        angle: landscape ? 0 : 90
      }
    },
    elements
  });
}
