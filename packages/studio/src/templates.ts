import { createEmptyStudioDocument } from "./document";
import { parseStudioDocument, type StudioDocument, type StudioElement } from "./schema";
import {
  studioRoyalCurrentPalette as palette,
  type StudioFormatId
} from "./constants";

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

type TemplateDefinition = Readonly<{
  category: StudioTemplateCategory;
  description: string;
  eyebrow: string;
  subtitle: string;
  title: string;
}>;

type TemplateGeometry = Readonly<{
  bodyHeight: number;
  bodyTop: number;
  canvasHeight: number;
  canvasWidth: number;
  contentWidth: number;
  footerTop: number;
  landscape: boolean;
  left: number;
  right: number;
}>;

const templateDefinitions: readonly TemplateDefinition[] = [
  {
    category: "matchday",
    description: "MatchHero met clubidentiteit, teams, aftrap en locatie.",
    eyebrow: "Matchday",
    subtitle: "Vandaag · 20:00 uur · Hoofdveld",
    title: "Wedstrijd van de dag"
  },
  {
    category: "schedule",
    description: "FixtureList met vaste tijd-, wedstrijd- en locatierails.",
    eyebrow: "Programma",
    subtitle: "De eerstvolgende wedstrijden op ons sportpark",
    title: "Vandaag op het programma"
  },
  {
    category: "result",
    description: "ResultList met grote, tabulaire uitslagen en clubnamen.",
    eyebrow: "Uitslagen",
    subtitle: "De laatste gespeelde wedstrijden",
    title: "Dit zijn de eindstanden"
  },
  {
    category: "sponsor",
    description: "SponsorSpotlight met een rustige contain-zone en identiteit.",
    eyebrow: "Sponsor",
    subtitle: "Samen maken we sport bij de club mogelijk",
    title: "In de spotlight"
  },
  {
    category: "menu",
    description: "MenuBlocks met categorieën, vaste prijsrails en royale copy.",
    eyebrow: "Clubhuis",
    subtitle: "Vandaag verkrijgbaar aan de bar",
    title: "Kantinemenu"
  },
  {
    category: "activity",
    description: "Agenda met drie duidelijke activiteiten en datumblokken.",
    eyebrow: "Clubagenda",
    subtitle: "Ontmoet elkaar ook buiten de lijnen",
    title: "Binnenkort bij de club"
  },
  {
    category: "volunteer",
    description: "CallToAction voor concrete vrijwilligerstaken en contact.",
    eyebrow: "Help de club",
    subtitle: "Een kleine bijdrage maakt samen een groot verschil",
    title: "Vrijwilligers gezocht"
  },
  {
    category: "welcome",
    description: "ArrivalCard-raster voor bezoekende teams en aankomstinfo.",
    eyebrow: "Welkom",
    subtitle: "Fijn dat jullie er zijn · meld je bij het wedstrijdsecretariaat",
    title: "Welkom bezoekende teams"
  },
  {
    category: "cancelled",
    description: "Rustige statuslijst met herkenbare afgelastingslabels.",
    eyebrow: "Clubupdate",
    subtitle: "Controleer altijd de meest actuele informatie",
    title: "Wedstrijden afgelast"
  },
  {
    category: "social",
    description: "Beeld, socialcopy en een expliciet te vervangen QR-bestemming.",
    eyebrow: "Social",
    subtitle: "Deel jouw clubmoment en volg het laatste nieuws",
    title: "Volg onze club"
  },
  {
    category: "emergency",
    description: "Hoogcontrast-status met prioriteit, boodschap en instructie.",
    eyebrow: "Belangrijk",
    subtitle: "Volg de aanwijzingen van de aanwezige organisatie",
    title: "Noodmelding"
  }
];

/**
 * Stable system IDs remain addressable because demo routes and existing draft
 * metadata use them. `version` and the frozen font/renderer registry identify
 * this new curated revision without mutating a stored user document.
 */
export const studioSystemTemplates: readonly StudioSystemTemplate[] =
  templateDefinitions.flatMap((definition) =>
    (["landscape-hd", "portrait-hd"] as const).map((formatId) => ({
      category: definition.category,
      description: definition.description,
      document: createTemplateDocument(formatId, definition),
      formatId,
      id: `system-${definition.category}-${formatId}-v1`,
      name: definition.title,
      version: 2
    }))
  );

export function getStudioSystemTemplate(templateId: string) {
  return studioSystemTemplates.find((template) => template.id === templateId);
}

function createTemplateDocument(
  formatId: StudioFormatId,
  definition: TemplateDefinition
): StudioDocument {
  const templateId = `system-${definition.category}-${formatId}-v1`;
  const document = createEmptyStudioDocument(formatId, {
    background: palette.background,
    templateId
  });
  const geometry = templateGeometry(formatId);
  const scene = createScene();

  addRoyalCurrentShell(scene, geometry, definition);
  addCategoryScene(scene, geometry, definition.category);

  return parseStudioDocument({
    ...document,
    artboard: {
      ...document.artboard,
      background: {
        angle: 135,
        from: palette.canvasStart,
        kind: "linear-gradient",
        to: palette.canvasEnd
      },
      safeArea: geometry.landscape
        ? { bottom: 76, left: 150, right: 64, top: 32 }
        : { bottom: 84, left: 101, right: 38, top: 36 }
    },
    elements: scene.elements
  });
}

function templateGeometry(formatId: StudioFormatId): TemplateGeometry {
  if (formatId === "landscape-hd") {
    return {
      bodyHeight: 704,
      bodyTop: 300,
      canvasHeight: 1080,
      canvasWidth: 1920,
      contentWidth: 1706,
      footerTop: 1024,
      landscape: true,
      left: 150,
      right: 64
    };
  }
  return {
    bodyHeight: 1440,
    bodyTop: 372,
    canvasHeight: 1920,
    canvasWidth: 1080,
    contentWidth: 941,
    footerTop: 1856,
    landscape: false,
    left: 101,
    right: 38
  };
}

function addRoyalCurrentShell(
  scene: Scene,
  geometry: TemplateGeometry,
  definition: TemplateDefinition
) {
  const { contentWidth, footerTop, landscape, left } = geometry;
  const clubTop = landscape ? 32 : 36;
  const clubHeight = landscape ? 80 : 96;
  const titleTop = landscape ? 132 : 156;
  const titleHeight = landscape ? 148 : 192;
  const logoSize = landscape ? 56 : 64;

  scene.shape({
    border: { color: palette.accent, width: 2 },
    fill: "#2459ED00",
    height: landscape ? 820 : 980,
    id: "flow-orbit-back",
    opacity: 0.12,
    shape: "ellipse",
    width: landscape ? 1180 : 900,
    x: landscape ? 980 : 430,
    y: landscape ? -330 : -310
  });
  scene.shape({
    border: { color: palette.flowAccent, width: 2 },
    fill: "#2459ED00",
    height: landscape ? 680 : 920,
    id: "flow-orbit-front",
    opacity: 0.17,
    shape: "ellipse",
    width: landscape ? 980 : 760,
    x: landscape ? -380 : -420,
    y: landscape ? 640 : 1240
  });
  scene.shape({
    fill: palette.flowAccent,
    height: geometry.canvasHeight,
    id: "flow-sideband",
    opacity: 0.78,
    width: landscape ? 8 : 7,
    x: landscape ? 54 : 36,
    y: 0
  });
  scene.shape({
    border: { color: palette.line, width: 1 },
    fill: palette.surface,
    height: clubHeight,
    id: "club-bar",
    radius: 20,
    width: contentWidth,
    x: left,
    y: clubTop
  });
  scene.placeholder({
    fill: palette.qrSurface,
    height: logoSize,
    id: "brand-mark",
    label: "Clublogo",
    slot: "tenant-logo",
    stroke: palette.accent,
    width: logoSize,
    x: left + (landscape ? 12 : 16),
    y: clubTop + (clubHeight - logoSize) / 2
  });
  scene.text({
    fill: palette.ink,
    fontSize: landscape ? 24 : 26,
    fontWeight: 700,
    height: clubHeight - 20,
    id: "club-label",
    text: "CLUBTV",
    verticalAlign: "middle",
    width: landscape ? 260 : 300,
    x: left + logoSize + (landscape ? 30 : 40),
    y: clubTop + 10
  });
  scene.text({
    align: "right",
    fill: palette.accent,
    fontSize: landscape ? 18 : 20,
    fontWeight: 700,
    height: clubHeight - 20,
    id: "section-label",
    letterSpacing: 2,
    text: definition.eyebrow.toLocaleUpperCase("nl-NL"),
    verticalAlign: "middle",
    width: landscape ? 440 : 390,
    x: left + contentWidth - (landscape ? 472 : 422),
    y: clubTop + 10
  });
  scene.shape({
    border: { color: palette.line, width: 1 },
    fill: palette.surfaceRaised,
    height: titleHeight,
    id: "title-panel",
    radius: 24,
    width: contentWidth,
    x: left,
    y: titleTop
  });
  scene.shape({
    fill: palette.solidAccent,
    height: landscape ? 10 : 12,
    id: "accent-block",
    radius: 6,
    width: landscape ? 112 : 96,
    x: left + 28,
    y: titleTop + 18
  });
  scene.text({
    autoFit: true,
    fill: palette.ink,
    fontSize: landscape ? 62 : 54,
    fontWeight: 900,
    height: landscape ? 74 : 104,
    id: "headline",
    letterSpacing: landscape ? -2.4 : -2,
    lineHeight: 1.04,
    text: definition.title,
    width: contentWidth - 64,
    x: left + 32,
    y: titleTop + (landscape ? 36 : 42)
  });
  scene.text({
    autoFit: true,
    fill: palette.muted,
    fontSize: landscape ? 23 : 24,
    fontWeight: 500,
    height: landscape ? 32 : 44,
    id: "subtitle",
    text: definition.subtitle,
    width: contentWidth - 64,
    x: left + 32,
    y: titleTop + (landscape ? 108 : 138)
  });
  scene.shape({
    fill: palette.line,
    height: 1,
    id: "footer-line",
    width: contentWidth,
    x: left,
    y: footerTop - (landscape ? 12 : 16)
  });
  scene.text({
    fill: palette.muted,
    fontSize: 14,
    fontWeight: 500,
    height: landscape ? 34 : 40,
    id: "footer-copy",
    text: "ACTUEEL BIJ DE CLUB",
    verticalAlign: "middle",
    width: 360,
    x: left,
    y: footerTop
  });
  scene.text({
    align: "right",
    fill: palette.accent,
    fontSize: 14,
    fontWeight: 700,
    height: landscape ? 34 : 40,
    id: "footer-meta",
    text: definition.eyebrow.toLocaleUpperCase("nl-NL"),
    verticalAlign: "middle",
    width: 360,
    x: left + contentWidth - 360,
    y: footerTop
  });
}

function addCategoryScene(
  scene: Scene,
  geometry: TemplateGeometry,
  category: StudioTemplateCategory
) {
  switch (category) {
    case "matchday": addMatchday(scene, geometry); return;
    case "schedule": addSchedule(scene, geometry); return;
    case "result": addResults(scene, geometry); return;
    case "sponsor": addSponsor(scene, geometry); return;
    case "menu": addMenu(scene, geometry); return;
    case "activity": addActivities(scene, geometry); return;
    case "volunteer": addVolunteer(scene, geometry); return;
    case "welcome": addWelcome(scene, geometry); return;
    case "cancelled": addCancelled(scene, geometry); return;
    case "social": addSocial(scene, geometry); return;
    case "emergency": addEmergency(scene, geometry);
  }
}

function addMatchday(scene: Scene, geometry: TemplateGeometry) {
  const { bodyHeight, bodyTop, contentWidth, landscape, left } = geometry;
  scene.shape({ border: { color: palette.line, width: 1 }, fill: palette.surface, height: bodyHeight, id: "match-stage", radius: 24, width: contentWidth, x: left, y: bodyTop });
  if (landscape) {
    addTeamPanel(scene, { id: "home", label: "THUIS", logo: "tenant", name: "Onze club 1", x: left + 52, y: bodyTop + 52, width: 570, height: 470 });
    addTeamPanel(scene, { id: "away", label: "UIT", logo: "shield", name: "Bezoekers 1", x: left + contentWidth - 622, y: bodyTop + 52, width: 570, height: 470 });
    scene.text({ align: "center", fill: palette.accent, fontSize: 38, fontWeight: 900, height: 70, id: "match-versus", text: "VS", verticalAlign: "middle", width: 190, x: left + (contentWidth - 190) / 2, y: bodyTop + 166 });
    scene.text({ align: "center", fill: palette.ink, fontSize: 88, fontWeight: 900, height: 110, id: "match-time", letterSpacing: -2, text: "20:00", verticalAlign: "middle", width: 300, x: left + (contentWidth - 300) / 2, y: bodyTop + 242 });
  } else {
    addTeamPanel(scene, { id: "home", label: "THUIS", logo: "tenant", name: "Onze club 1", x: left + 42, y: bodyTop + 44, width: contentWidth - 84, height: 410 });
    scene.text({ align: "center", fill: palette.accent, fontSize: 38, fontWeight: 900, height: 66, id: "match-versus", text: "VS", verticalAlign: "middle", width: 170, x: left + (contentWidth - 170) / 2, y: bodyTop + 470 });
    scene.text({ align: "center", fill: palette.ink, fontSize: 92, fontWeight: 900, height: 120, id: "match-time", text: "20:00", verticalAlign: "middle", width: 340, x: left + (contentWidth - 340) / 2, y: bodyTop + 536 });
    addTeamPanel(scene, { id: "away", label: "UIT", logo: "shield", name: "Bezoekers 1", x: left + 42, y: bodyTop + 690, width: contentWidth - 84, height: 410 });
  }
  const infoY = bodyTop + bodyHeight - (landscape ? 124 : 230);
  scene.shape({ fill: palette.ownBackground, height: landscape ? 80 : 116, id: "match-info-panel", radius: 18, width: contentWidth - 104, x: left + 52, y: infoY });
  scene.icon({ fill: palette.ownInk, height: 34, icon: "location", id: "match-location-icon", width: 34, x: left + 78, y: infoY + (landscape ? 23 : 28) });
  scene.text({ fill: palette.ownInk, fontSize: landscape ? 26 : 32, fontWeight: 700, height: landscape ? 64 : 80, id: "match-location", text: "Hoofdveld · Sportpark", verticalAlign: "middle", width: contentWidth - 190, x: left + 128, y: infoY + (landscape ? 8 : 18) });
}

function addTeamPanel(scene: Scene, input: Readonly<{ height: number; id: string; label: string; logo: "shield" | "tenant"; name: string; width: number; x: number; y: number }>) {
  scene.shape({ border: { color: palette.line, width: 1 }, fill: palette.surfaceRaised, height: input.height, id: `${input.id}-team-panel`, radius: 22, width: input.width, x: input.x, y: input.y });
  const logoSize = Math.min(210, input.height * 0.48);
  const logoX = input.x + (input.width - logoSize) / 2;
  const logoY = input.y + 54;
  if (input.logo === "tenant") {
    scene.placeholder({ fill: palette.qrSurface, height: logoSize, id: `${input.id}-team-logo`, label: "Clublogo", slot: "tenant-logo", stroke: palette.accent, width: logoSize, x: logoX, y: logoY });
  } else {
    scene.shape({ fill: palette.deep, height: logoSize, id: `${input.id}-logo-plate`, radius: 28, width: logoSize, x: logoX, y: logoY });
    scene.icon({ fill: palette.accent, height: logoSize * 0.58, icon: "shield", id: `${input.id}-team-logo-fallback`, width: logoSize * 0.58, x: logoX + logoSize * 0.21, y: logoY + logoSize * 0.21 });
  }
  scene.text({ align: "center", fill: palette.accent, fontSize: 18, fontWeight: 700, height: 34, id: `${input.id}-label`, letterSpacing: 2, text: input.label, width: input.width - 40, x: input.x + 20, y: input.y + input.height - 132 });
  scene.text({ align: "center", autoFit: true, fill: palette.ink, fontSize: 42, fontWeight: 900, height: 82, id: `${input.id}-name`, text: input.name, verticalAlign: "middle", width: input.width - 40, x: input.x + 20, y: input.y + input.height - 96 });
}

function addSchedule(scene: Scene, geometry: TemplateGeometry) {
  const fixtures = [
    ["09:30", "JO12-1  vs.  Buurclub JO12-2", "Veld 1 · Sportpark"],
    ["11:15", "MO15-1  vs.  Stad SV MO15-1", "Veld 2 · Sportpark"],
    ["14:30", "Club 1  vs.  Voetbalvereniging 1", "Hoofdveld · Sportpark"],
    ["16:45", "Club 2  vs.  United 2", "Veld 3 · Sportpark"]
  ] as const;
  addListRows(scene, geometry, fixtures, "schedule", false);
}

function addResults(scene: Scene, geometry: TemplateGeometry) {
  const results = [
    ["ZA 05 SEP", "Club JO17-1", "3 – 1", "Sporting JO17-2"],
    ["ZA 05 SEP", "Racing 2", "0 – 2", "Club 2"],
    ["ZO 06 SEP", "Club 1", "2 – 2", "United 1"],
    ["ZO 06 SEP", "Club VR1", "4 – 0", "Stad VR1"]
  ] as const;
  const { bodyHeight, bodyTop, contentWidth, landscape, left } = geometry;
  const gap = landscape ? 14 : 20;
  const rowHeight = landscape ? 154 : 304;
  results.forEach((result, index) => {
    const y = bodyTop + index * (rowHeight + gap);
    scene.shape({ border: { color: palette.line, width: 1 }, fill: index === 2 ? palette.ownBackground : palette.surface, height: rowHeight, id: `result-row-${index}`, radius: 20, width: contentWidth, x: left, y });
    if (landscape) {
      scene.text({ fill: index === 2 ? palette.ownMuted : palette.muted, fontSize: 22, fontWeight: 700, height: rowHeight, id: `result-date-${index}`, text: result[0], verticalAlign: "middle", width: 210, x: left + 28, y });
      scene.text({ align: "right", autoFit: true, fill: index === 2 ? palette.ownInk : palette.ink, fontSize: 34, fontWeight: 700, height: rowHeight, id: `result-home-${index}`, text: result[1], verticalAlign: "middle", width: 470, x: left + 250, y });
      scene.text({ align: "center", fill: index === 2 ? palette.ownInk : palette.accent, fontSize: 54, fontWeight: 900, height: rowHeight, id: `result-score-${index}`, text: result[2], verticalAlign: "middle", width: 240, x: left + 733, y });
      scene.text({ autoFit: true, fill: index === 2 ? palette.ownInk : palette.ink, fontSize: 34, fontWeight: 700, height: rowHeight, id: `result-away-${index}`, text: result[3], verticalAlign: "middle", width: contentWidth - 1025, x: left + 997, y });
    } else {
      scene.text({ fill: index === 2 ? palette.ownMuted : palette.muted, fontSize: 21, fontWeight: 700, height: 44, id: `result-date-${index}`, text: result[0], width: 260, x: left + 26, y: y + 24 });
      scene.text({ align: "center", fill: index === 2 ? palette.ownInk : palette.accent, fontSize: 62, fontWeight: 900, height: 86, id: `result-score-${index}`, text: result[2], verticalAlign: "middle", width: 270, x: left + contentWidth - 296, y: y + 16 });
      scene.text({ autoFit: true, fill: index === 2 ? palette.ownInk : palette.ink, fontSize: 38, fontWeight: 700, height: 74, id: `result-home-${index}`, text: result[1], verticalAlign: "middle", width: contentWidth - 52, x: left + 26, y: y + 112 });
      scene.shape({ fill: index === 2 ? palette.ownLine : palette.line, height: 2, id: `result-divider-${index}`, width: contentWidth - 52, x: left + 26, y: y + 194 });
      scene.text({ autoFit: true, fill: index === 2 ? palette.ownInk : palette.ink, fontSize: 38, fontWeight: 700, height: 74, id: `result-away-${index}`, text: result[3], verticalAlign: "middle", width: contentWidth - 52, x: left + 26, y: y + 210 });
    }
  });
  if (!landscape) scene.text({ align: "center", fill: palette.muted, fontSize: 18, fontWeight: 500, height: 40, id: "result-caption", text: "UITSLAGEN · DEFINITIEF", width: contentWidth, x: left, y: bodyTop + bodyHeight - 42 });
}

function addListRows(scene: Scene, geometry: TemplateGeometry, rows: readonly (readonly [string, string, string])[], prefix: string, danger: boolean) {
  const { bodyHeight, bodyTop, contentWidth, landscape, left } = geometry;
  const gap = landscape ? 14 : 20;
  const rowHeight = landscape ? 154 : 304;
  rows.forEach((row, index) => {
    const y = bodyTop + index * (rowHeight + gap);
    scene.shape({ border: { color: danger ? palette.danger : palette.line, width: danger ? 2 : 1 }, fill: palette.surface, height: rowHeight, id: `${prefix}-row-${index}`, radius: 20, width: contentWidth, x: left, y });
    if (landscape) {
      scene.text({ align: "center", fill: danger ? palette.danger : palette.accent, fontSize: 35, fontWeight: 900, height: rowHeight, id: `${prefix}-time-${index}`, text: row[0], verticalAlign: "middle", width: 210, x: left + 24, y });
      scene.shape({ fill: danger ? palette.danger : palette.line, height: rowHeight - 54, id: `${prefix}-rail-${index}`, opacity: danger ? 0.7 : 1, width: 2, x: left + 248, y: y + 27 });
      scene.text({ autoFit: true, fill: palette.ink, fontSize: 35, fontWeight: 700, height: 76, id: `${prefix}-teams-${index}`, text: row[1], verticalAlign: "bottom", width: contentWidth - 320, x: left + 284, y: y + 14 });
      scene.text({ fill: danger ? palette.danger : palette.muted, fontSize: 19, fontWeight: 500, height: 48, id: `${prefix}-meta-${index}`, text: row[2], verticalAlign: "middle", width: contentWidth - 320, x: left + 284, y: y + 91 });
    } else {
      scene.text({ fill: danger ? palette.danger : palette.accent, fontSize: 38, fontWeight: 900, height: 62, id: `${prefix}-time-${index}`, text: row[0], width: 260, x: left + 28, y: y + 26 });
      scene.text({ autoFit: true, fill: palette.ink, fontSize: 40, fontWeight: 700, height: 118, id: `${prefix}-teams-${index}`, text: row[1], verticalAlign: "middle", width: contentWidth - 56, x: left + 28, y: y + 92 });
      scene.text({ align: "right", fill: danger ? palette.danger : palette.muted, fontSize: 20, fontWeight: 500, height: 44, id: `${prefix}-meta-${index}`, text: row[2], verticalAlign: "middle", width: contentWidth - 56, x: left + 28, y: y + 232 });
    }
  });
  if (!landscape && rows.length < 4) scene.text({ align: "center", fill: palette.muted, fontSize: 18, fontWeight: 500, height: 40, id: `${prefix}-caption`, text: "ACTUELE CLUBINFORMATIE", width: contentWidth, x: left, y: bodyTop + bodyHeight - 42 });
}

function addSponsor(scene: Scene, geometry: TemplateGeometry) {
  const { bodyHeight, bodyTop, contentWidth, landscape, left } = geometry;
  scene.shape({ border: { color: palette.line, width: 1 }, fill: palette.surface, height: bodyHeight, id: "sponsor-stage", radius: 24, width: contentWidth, x: left, y: bodyTop });
  const logo = landscape ? { height: 480, width: 760, x: left + 70, y: bodyTop + 72 } : { height: 650, width: contentWidth - 96, x: left + 48, y: bodyTop + 80 };
  scene.shape({ fill: palette.qrSurface, height: logo.height, id: "sponsor-logo-plate", radius: 24, width: logo.width, x: logo.x, y: logo.y });
  scene.placeholder({ fill: palette.qrSurface, height: logo.height - 96, id: "sponsor-logo", label: "Sponsorlogo · contain", slot: "sponsor-logo", stroke: palette.accent, width: logo.width - 96, x: logo.x + 48, y: logo.y + 48 });
  const copyX = landscape ? left + 900 : left + 48;
  const copyY = landscape ? bodyTop + 120 : bodyTop + 812;
  const copyWidth = landscape ? contentWidth - 970 : contentWidth - 96;
  scene.text({ fill: palette.accent, fontSize: landscape ? 23 : 27, fontWeight: 700, height: 52, id: "sponsor-eyebrow", letterSpacing: 2, text: "SAMEN STERKER", width: copyWidth, x: copyX, y: copyY });
  scene.text({ autoFit: true, fill: palette.ink, fontSize: landscape ? 70 : 72, fontWeight: 900, height: landscape ? 180 : 220, id: "sponsor-name", letterSpacing: -2, lineHeight: 1, text: "Naam van de sponsor", verticalAlign: "middle", width: copyWidth, x: copyX, y: copyY + 48 });
  scene.text({ fill: palette.muted, fontSize: landscape ? 27 : 32, fontWeight: 500, height: landscape ? 150 : 210, id: "sponsor-copy", lineHeight: 1.25, text: "Met steun van onze partners blijft de vereniging bewegen.", width: copyWidth, x: copyX, y: copyY + (landscape ? 250 : 290) });
}

function addMenu(scene: Scene, geometry: TemplateGeometry) {
  const { bodyTop, contentWidth, landscape, left } = geometry;
  const panels: readonly Readonly<{
    height: number;
    id: "drinks" | "snacks";
    title: string;
    width: number;
    x: number;
    y: number;
  }>[] = landscape
    ? [{ id: "snacks", title: "Snacks", x: left, y: bodyTop, width: (contentWidth - 20) / 2, height: 704 }, { id: "drinks", title: "Dranken", x: left + (contentWidth + 20) / 2, y: bodyTop, width: (contentWidth - 20) / 2, height: 704 }]
    : [{ id: "snacks", title: "Snacks", x: left, y: bodyTop, width: contentWidth, height: 700 }, { id: "drinks", title: "Dranken", x: left, y: bodyTop + 720, width: contentWidth, height: 700 }];
  const products = {
    drinks: [["Koffie / thee", "€ 2,50"], ["Frisdrank", "€ 2,80"], ["Sportdrank", "€ 3,20"], ["Water", "€ 2,20"]],
    snacks: [["Broodje bal", "€ 4,50"], ["Tosti", "€ 3,50"], ["Friet", "€ 3,00"], ["Dagsnack", "€ 4,00"]]
  } as const;
  panels.forEach((panel) => {
    scene.shape({ border: { color: palette.line, width: 1 }, fill: palette.surface, height: panel.height, id: `menu-panel-${panel.id}`, radius: 24, width: panel.width, x: panel.x, y: panel.y });
    scene.text({ fill: palette.accent, fontSize: landscape ? 42 : 46, fontWeight: 900, height: 72, id: `menu-title-${panel.id}`, text: panel.title, verticalAlign: "middle", width: panel.width - 64, x: panel.x + 32, y: panel.y + 24 });
    scene.shape({ fill: palette.line, height: 2, id: `menu-line-${panel.id}`, width: panel.width - 64, x: panel.x + 32, y: panel.y + 106 });
    products[panel.id].forEach((product, index) => {
      const rowY = panel.y + 134 + index * (landscape ? 126 : 124);
      scene.text({ autoFit: true, fill: palette.ink, fontSize: landscape ? 32 : 36, fontWeight: 700, height: 72, id: `menu-product-${panel.id}-${index}`, text: product[0], verticalAlign: "middle", width: panel.width - 250, x: panel.x + 32, y: rowY });
      scene.text({ align: "right", fill: palette.accent, fontSize: landscape ? 34 : 38, fontWeight: 900, height: 72, id: `menu-price-${panel.id}-${index}`, text: product[1], verticalAlign: "middle", width: 180, x: panel.x + panel.width - 212, y: rowY });
      if (index < 3) scene.shape({ fill: palette.line, height: 1, id: `menu-divider-${panel.id}-${index}`, width: panel.width - 64, x: panel.x + 32, y: rowY + 84 });
    });
  });
}

function addActivities(scene: Scene, geometry: TemplateGeometry) {
  const activities = [
    ["14", "SEP", "Clubmiddag", "15:00 · Clubhuis", "users"],
    ["20", "SEP", "Jeugdactiviteit", "13:30 · Trainingsveld", "activity"],
    ["26", "SEP", "Vrijwilligersavond", "19:30 · Bestuurskamer", "heart"]
  ] as const;
  const { bodyTop, contentWidth, landscape, left } = geometry;
  const gap = landscape ? 20 : 22;
  const cardWidth = landscape ? (contentWidth - gap * 2) / 3 : contentWidth;
  const cardHeight = landscape ? 704 : 464;
  activities.forEach((activity, index) => {
    const x = landscape ? left + index * (cardWidth + gap) : left;
    const y = landscape ? bodyTop : bodyTop + index * (cardHeight + gap);
    scene.shape({ border: { color: palette.line, width: 1 }, fill: palette.surface, height: cardHeight, id: `activity-card-${index}`, radius: 24, width: cardWidth, x, y });
    scene.shape({ fill: index === 1 ? palette.ownBackground : palette.surfaceRaised, height: landscape ? 160 : 136, id: `activity-date-panel-${index}`, radius: 20, width: landscape ? 150 : 160, x: x + 32, y: y + 32 });
    scene.text({ align: "center", fill: palette.ink, fontSize: landscape ? 68 : 60, fontWeight: 900, height: 88, id: `activity-day-${index}`, text: activity[0], verticalAlign: "middle", width: landscape ? 150 : 160, x: x + 32, y: y + 34 });
    scene.text({ align: "center", fill: palette.accent, fontSize: 23, fontWeight: 700, height: 44, id: `activity-month-${index}`, letterSpacing: 2, text: activity[1], verticalAlign: "middle", width: landscape ? 150 : 160, x: x + 32, y: y + 124 });
    scene.icon({ fill: palette.accent, height: landscape ? 82 : 74, icon: activity[4], id: `activity-icon-${index}`, width: landscape ? 82 : 74, x: x + cardWidth - (landscape ? 122 : 112), y: y + 52 });
    scene.text({ autoFit: true, fill: palette.ink, fontSize: landscape ? 48 : 44, fontWeight: 900, height: landscape ? 180 : 120, id: `activity-title-${index}`, letterSpacing: -1.2, lineHeight: 1.02, text: activity[2], verticalAlign: "middle", width: cardWidth - 64, x: x + 32, y: y + (landscape ? 250 : 196) });
    scene.text({ fill: palette.muted, fontSize: landscape ? 25 : 27, fontWeight: 500, height: 90, id: `activity-meta-${index}`, lineHeight: 1.2, text: activity[3], width: cardWidth - 64, x: x + 32, y: y + (landscape ? 468 : 338) });
  });
}

function addVolunteer(scene: Scene, geometry: TemplateGeometry) {
  const { bodyHeight, bodyTop, contentWidth, landscape, left } = geometry;
  scene.shape({ border: { color: palette.ownLine, width: 1 }, fill: palette.ownBackground, height: landscape ? bodyHeight : 500, id: "volunteer-hero", radius: 24, width: landscape ? 760 : contentWidth, x: left, y: bodyTop });
  scene.icon({ fill: palette.ownInk, height: 112, icon: "heart", id: "volunteer-heart", width: 112, x: left + 54, y: bodyTop + 58 });
  scene.text({ autoFit: true, fill: palette.ownInk, fontSize: landscape ? 66 : 62, fontWeight: 900, height: landscape ? 230 : 170, id: "volunteer-call", letterSpacing: -2, lineHeight: 1.02, text: "Jouw hulp telt", width: landscape ? 640 : contentWidth - 96, x: left + 52, y: bodyTop + (landscape ? 212 : 200) });
  scene.text({ fill: palette.ownMuted, fontSize: landscape ? 29 : 30, fontWeight: 500, height: 150, id: "volunteer-intro", lineHeight: 1.25, text: "Kies een taak die bij jou past. Ook één uurtje helpt de club vooruit.", width: landscape ? 640 : contentWidth - 96, x: left + 52, y: bodyTop + (landscape ? 464 : 362) });
  const roles = ["Bardienst · zaterdag", "Gastheer / gastvrouw", "Hulp bij een activiteit"];
  const rolesX = landscape ? left + 800 : left;
  const rolesY = landscape ? bodyTop : bodyTop + 526;
  const rolesWidth = landscape ? contentWidth - 800 : contentWidth;
  roles.forEach((role, index) => {
    const y = rolesY + index * (landscape ? 174 : 220);
    scene.shape({ border: { color: palette.line, width: 1 }, fill: palette.surface, height: landscape ? 154 : 200, id: `volunteer-role-${index}`, radius: 20, width: rolesWidth, x: rolesX, y });
    scene.icon({ fill: palette.accent, height: 48, icon: "users", id: `volunteer-role-icon-${index}`, width: 48, x: rolesX + 30, y: y + (landscape ? 53 : 38) });
    scene.text({ autoFit: true, fill: palette.ink, fontSize: landscape ? 31 : 37, fontWeight: 700, height: landscape ? 82 : 92, id: `volunteer-role-title-${index}`, text: role, verticalAlign: "middle", width: rolesWidth - 130, x: rolesX + 100, y: y + 22 });
    if (!landscape) scene.text({ fill: palette.muted, fontSize: 21, fontWeight: 500, height: 48, id: `volunteer-role-meta-${index}`, text: "Meld je aan bij het bestuur", width: rolesWidth - 130, x: rolesX + 100, y: y + 122 });
  });
  if (!landscape) {
    scene.shape({ fill: palette.accentSoft, height: 170, id: "volunteer-contact-panel", radius: 20, width: contentWidth, x: left, y: bodyTop + 1200 });
    scene.text({ align: "center", fill: palette.ink, fontSize: 31, fontWeight: 700, height: 170, id: "volunteer-contact", text: "Meld je aan bij het bestuur", verticalAlign: "middle", width: contentWidth - 48, x: left + 24, y: bodyTop + 1200 });
  }
}

function addWelcome(scene: Scene, geometry: TemplateGeometry) {
  const { bodyTop, contentWidth, landscape, left } = geometry;
  const slots = landscape
    ? [{ x: left, y: bodyTop, width: (contentWidth - 20) / 2, height: 704 }, { x: left + (contentWidth + 20) / 2, y: bodyTop, width: (contentWidth - 20) / 2, height: 704 }]
    : [{ x: left, y: bodyTop, width: contentWidth, height: 700 }, { x: left, y: bodyTop + 720, width: contentWidth, height: 700 }];
  slots.forEach((slot, index) => {
    scene.shape({ border: { color: palette.line, width: 1 }, fill: palette.surface, height: slot.height, id: `welcome-card-${index}`, radius: 24, width: slot.width, x: slot.x, y: slot.y });
    scene.shape({ fill: palette.deep, height: landscape ? 322 : 310, id: `welcome-logo-area-${index}`, radius: 20, width: slot.width - 64, x: slot.x + 32, y: slot.y + 32 });
    scene.icon({ fill: palette.accent, height: landscape ? 190 : 176, icon: "shield", id: `welcome-visitor-logo-${index}`, opacity: 0.9, width: landscape ? 190 : 176, x: slot.x + (slot.width - (landscape ? 190 : 176)) / 2, y: slot.y + 92 });
    scene.text({ align: "center", fill: palette.accent, fontSize: 19, fontWeight: 700, height: 34, id: `welcome-kickoff-${index}`, letterSpacing: 2, text: index === 0 ? "AANVANG 10:30" : "AANVANG 12:15", width: slot.width - 64, x: slot.x + 32, y: slot.y + (landscape ? 382 : 376) });
    scene.text({ align: "center", autoFit: true, fill: palette.ink, fontSize: landscape ? 44 : 46, fontWeight: 900, height: 88, id: `welcome-team-${index}`, text: index === 0 ? "Bezoekers JO13-1" : "Voetbalclub MO17-1", verticalAlign: "middle", width: slot.width - 64, x: slot.x + 32, y: slot.y + (landscape ? 418 : 416) });
    scene.shape({ fill: palette.line, height: 1, id: `welcome-divider-${index}`, width: slot.width - 64, x: slot.x + 32, y: slot.y + (landscape ? 526 : 530) });
    scene.text({ fill: palette.muted, fontSize: landscape ? 23 : 25, fontWeight: 500, height: 100, id: `welcome-meta-${index}`, lineHeight: 1.3, text: index === 0 ? "Kleedkamer 4\nVeld 2" : "Kleedkamer 6\nHoofdveld", width: slot.width - 64, x: slot.x + 32, y: slot.y + (landscape ? 552 : 558) });
  });
}

function addCancelled(scene: Scene, geometry: TemplateGeometry) {
  const rows = [
    ["AFGELAST", "Club JO11-1  vs.  Stad JO11-2", "Veld onbespeelbaar"],
    ["AFGELAST", "Club MO15-1  vs.  United MO15-1", "Nieuwe datum volgt"],
    ["AFGELAST", "Racing 2  vs.  Club 2", "Wedstrijd gaat niet door"]
  ] as const;
  addListRows(scene, geometry, rows, "cancelled", true);
  const { bodyTop, contentWidth, landscape, left } = geometry;
  if (!landscape) {
    scene.shape({ fill: palette.accentSoft, height: 260, id: "cancelled-advice-panel", radius: 20, width: contentWidth, x: left, y: bodyTop + 952 });
    scene.icon({ fill: palette.danger, height: 58, icon: "info", id: "cancelled-advice-icon", width: 58, x: left + 34, y: bodyTop + 1028 });
    scene.text({ fill: palette.ink, fontSize: 30, fontWeight: 700, height: 150, id: "cancelled-advice", lineHeight: 1.25, text: "Controleer het programma voordat je naar het sportpark vertrekt.", verticalAlign: "middle", width: contentWidth - 150, x: left + 118, y: bodyTop + 1006 });
  }
}

function addSocial(scene: Scene, geometry: TemplateGeometry) {
  const { bodyHeight, bodyTop, contentWidth, landscape, left } = geometry;
  const photo = landscape ? { height: bodyHeight, width: 920, x: left, y: bodyTop } : { height: 690, width: contentWidth, x: left, y: bodyTop };
  scene.placeholder({ fill: palette.deep, height: photo.height, id: "social-photo", label: "Clubfoto", slot: "photo", stroke: palette.accent, width: photo.width, x: photo.x, y: photo.y });
  const copyX = landscape ? left + 952 : left;
  const copyY = landscape ? bodyTop : bodyTop + 714;
  const copyWidth = landscape ? contentWidth - 952 : contentWidth;
  const copyHeight = landscape ? bodyHeight : bodyHeight - 714;
  scene.shape({ border: { color: palette.line, width: 1 }, fill: palette.surface, height: copyHeight, id: "social-copy-panel", radius: 24, width: copyWidth, x: copyX, y: copyY });
  scene.text({ fill: palette.accent, fontSize: landscape ? 22 : 25, fontWeight: 700, height: 50, id: "social-platform", letterSpacing: 2, text: "INSTAGRAM · FACEBOOK", width: copyWidth - 64, x: copyX + 32, y: copyY + 40 });
  scene.text({ autoFit: true, fill: palette.ink, fontSize: landscape ? 64 : 72, fontWeight: 900, height: landscape ? 170 : 210, id: "social-call", letterSpacing: -2, lineHeight: 1.02, text: "Mis geen enkel clubmoment", width: copyWidth - 64, x: copyX + 32, y: copyY + 104 });
  scene.text({ fill: palette.muted, fontSize: landscape ? 27 : 31, fontWeight: 500, height: 100, id: "social-handle", text: "@jouwclub", width: copyWidth - 64, x: copyX + 32, y: copyY + (landscape ? 312 : 346) });
  const qrSize = landscape ? 184 : 270;
  scene.shape({ fill: palette.qrSurface, height: qrSize + 32, id: "social-qr-plate", radius: 18, width: qrSize + 32, x: copyX + copyWidth - qrSize - 54, y: copyY + copyHeight - qrSize - 54 });
  scene.qr({ background: palette.qrSurface, foreground: palette.qrInk, height: qrSize, id: "social-qr", name: "QR-code · vervang bestemming", value: "Vervang deze QR-bestemming in Studio", width: qrSize, x: copyX + copyWidth - qrSize - 38, y: copyY + copyHeight - qrSize - 38 });
  scene.text({ fill: palette.muted, fontSize: landscape ? 18 : 21, fontWeight: 500, height: 80, id: "social-qr-instruction", lineHeight: 1.2, text: "Vervang de QR-bestemming vóór publicatie.", width: copyWidth - qrSize - 104, x: copyX + 32, y: copyY + copyHeight - 126 });
}

function addEmergency(scene: Scene, geometry: TemplateGeometry) {
  const { bodyHeight, bodyTop, contentWidth, landscape, left } = geometry;
  scene.shape({ border: { color: palette.warning, width: 3 }, fill: palette.deep, height: bodyHeight, id: "emergency-stage", radius: 24, width: contentWidth, x: left, y: bodyTop });
  scene.shape({ fill: palette.warning, height: landscape ? 42 : 52, id: "emergency-priority-band", width: contentWidth, x: left, y: bodyTop });
  scene.icon({ fill: palette.warning, height: landscape ? 150 : 170, icon: "megaphone", id: "emergency-icon", width: landscape ? 150 : 170, x: left + (landscape ? 70 : 54), y: bodyTop + (landscape ? 94 : 92) });
  scene.text({ fill: palette.warning, fontSize: landscape ? 25 : 28, fontWeight: 900, height: 54, id: "emergency-priority", letterSpacing: 3, text: "DIRECT OPVOLGEN", width: landscape ? 700 : contentWidth - 108, x: left + (landscape ? 264 : 54), y: bodyTop + (landscape ? 100 : 292) });
  scene.text({ autoFit: true, fill: palette.ink, fontSize: 92, fontWeight: 900, height: landscape ? 230 : 380, id: "emergency-message", letterSpacing: -3, lineHeight: 0.98, text: "Verlaat rustig het clubhuis", width: landscape ? contentWidth - 360 : contentWidth - 108, x: left + (landscape ? 264 : 54), y: bodyTop + (landscape ? 170 : 364) });
  scene.shape({ fill: palette.surfaceRaised, height: landscape ? 180 : 360, id: "emergency-instruction-panel", radius: 20, width: landscape ? contentWidth - 140 : contentWidth - 108, x: left + (landscape ? 70 : 54), y: bodyTop + (landscape ? 454 : 900) });
  scene.text({ fill: palette.ink, fontSize: landscape ? 35 : 38, fontWeight: 700, height: landscape ? 180 : 310, id: "emergency-instruction", lineHeight: 1.28, padding: landscape ? 34 : 38, text: "Ga naar de aangegeven verzamelplaats. Volg de aanwijzingen van de organisatie en help elkaar.", verticalAlign: "middle", width: landscape ? contentWidth - 140 : contentWidth - 108, x: left + (landscape ? 70 : 54), y: bodyTop + (landscape ? 454 : 900) });
}

type BoxInput = Readonly<{
  height: number;
  id: string;
  locked?: boolean;
  name?: string;
  opacity?: number;
  width: number;
  x: number;
  y: number;
}>;

type Scene = ReturnType<typeof createScene>;

function createScene() {
  const elements: StudioElement[] = [];
  const base = (input: BoxInput) => ({
    height: input.height,
    id: input.id,
    locked: input.locked ?? false,
    name: input.name ?? input.id,
    opacity: input.opacity ?? 1,
    rotation: 0,
    visible: true,
    width: input.width,
    x: input.x,
    y: input.y,
    zIndex: elements.length
  });
  return {
    elements,
    icon(input: BoxInput & Readonly<{ fill: string; icon: Extract<StudioElement, { type: "icon" }>["icon"] }>) {
      elements.push({ ...base(input), fill: input.fill, icon: input.icon, strokeWidth: 0, type: "icon" });
    },
    placeholder(input: BoxInput & Readonly<{ fill: string; label: string; slot: Extract<StudioElement, { type: "placeholder" }>["slot"]; stroke: string }>) {
      elements.push({ ...base(input), fill: input.fill, label: input.label, slot: input.slot, stroke: input.stroke, type: "placeholder" });
    },
    qr(input: BoxInput & Readonly<{ background: string; foreground: string; value: string }>) {
      elements.push({ ...base(input), background: input.background, errorCorrection: "M", foreground: input.foreground, type: "qr", value: input.value });
    },
    shape(input: BoxInput & Readonly<{ border?: Readonly<{ color: string; width: number }>; fill: string | Readonly<{ angle: number; from: string; to: string }>; radius?: number; shape?: "ellipse" | "line" | "rectangle" }>) {
      elements.push({
        ...base(input),
        border: input.border,
        cornerRadius: input.radius ?? 0,
        fill: typeof input.fill === "string" ? { color: input.fill, kind: "solid" } : { ...input.fill, kind: "linear-gradient" },
        shape: input.shape ?? "rectangle",
        type: "shape"
      });
    },
    text(input: BoxInput & Readonly<{ align?: "center" | "left" | "right"; autoFit?: boolean; fill: string; fontSize: number; fontWeight: 400 | 500 | 700 | 900; letterSpacing?: number; lineHeight?: number; padding?: number; text: string; verticalAlign?: "bottom" | "middle" | "top" }>) {
      elements.push({
        ...base(input),
        align: input.align ?? "left",
        autoFit: input.autoFit ?? false,
        cornerRadius: 0,
        fill: input.fill,
        fontFamily: "Roboto",
        fontSize: input.fontSize,
        fontWeight: input.fontWeight,
        letterSpacing: input.letterSpacing ?? 0,
        lineHeight: input.lineHeight ?? 1.1,
        padding: input.padding ?? 0,
        text: input.text,
        type: "text",
        verticalAlign: input.verticalAlign ?? "top"
      });
    }
  };
}
