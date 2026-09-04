import {
  createEmptyStudioDocument,
  getStudioSystemTemplate,
  studioPalette,
  type StudioDocument,
  type StudioElement,
  studioSystemTemplates
} from "@veyocast/studio";

import type {
  StudioEditorData,
  StudioOverviewData,
  StudioProjectDetail,
  StudioProjectSummary
} from "./types";

const demoNow = "2026-07-24T08:00:00.000Z";
const fieldFlowDemoPhoto = {
  height: 2560,
  id: "4b1cc18e-2ee0-4aba-b59d-9a7c1a3a81fe",
  kind: "image" as const,
  previewUrl:
    "/fieldflow/photos/FF-PHOTO-06-community-3840x2560-web.webp",
  sourceUrl: "/fieldflow/photos/FF-PHOTO-06-community-3840x2560-web.webp",
  title: "Clubmoment",
  width: 3840
};

export function loadDemoStudioOverview(): StudioOverviewData {
  const projects = studioSystemTemplates.slice(0, 8).map((template, index) =>
    templateSummary(template.id, index)
  );

  return {
    error: null,
    projects,
    renderJobs: []
  };
}

export function loadDemoStudioProject(projectId: string): StudioEditorData {
  const template = getStudioSystemTemplate(projectId);
  const format =
    projectId === "blank-portrait-hd" ? "portrait-hd" : "landscape-hd";
  const baseDocument = template?.document ?? createEmptyStudioDocument(format);
  const document =
    projectId === "system-matchday-landscape-hd-v1"
      ? createFieldFlowMatchdayDemo(baseDocument)
      : baseDocument;
  const project: StudioProjectDetail = {
    createdAt: demoNow,
    document,
    draftRevision: 0,
    id: template?.id ?? `blank-${format}`,
    kind: template ? "tenant_template" : "design",
    motionEnabled: document.motion.enabled,
    name:
      projectId === "system-matchday-landscape-hd-v1"
        ? "Clubhuis — Vandaag"
        : template?.name ?? "Nieuw ontwerp",
    orientation: document.artboard.orientation,
    ownerUserId: "demo-control-user",
    projectRevision: 0,
    status: "active",
    updatedAt: demoNow
  };

  return {
    assets:
      projectId === "system-matchday-landscape-hd-v1"
        ? [fieldFlowDemoPhoto]
        : [],
    brandKit: null,
    error: null,
    project,
    renderJobs: [],
    revisions: [
      {
        createdAt: demoNow,
        createdBy: "demo-control-user",
        createdByName: "Demo-gebruiker",
        document,
        draftRevision: 0,
        id: `demo-revision-${project.id}`,
        number: 1,
        reason: "checkpoint"
      }
    ]
  };
}

function createFieldFlowMatchdayDemo(
  document: StudioDocument
): StudioDocument {
  const elements: StudioElement[] = [
    {
      alt: "Clubleden en jeugdspelers maken zich samen klaar langs het veld.",
      cornerRadius: 0,
      focusX: 0.55,
      focusY: 0.5,
      height: 1080,
      id: "matchday-photo",
      locked: false,
      mediaAssetId: fieldFlowDemoPhoto.id,
      name: "Afbeelding",
      objectFit: "cover",
      opacity: 1,
      rotation: 0,
      type: "image",
      variant: "original",
      visible: true,
      width: 1020,
      x: 900,
      y: 0,
      zIndex: 0
    },
    {
      cornerRadius: 0,
      fill: {
        angle: 0,
        from: studioPalette.fieldflowPetrol,
        kind: "linear-gradient",
        to: studioPalette.fieldflowDarkPetrol
      },
      height: 1300,
      id: "copy-panel",
      locked: false,
      name: "Donker tekstvlak",
      opacity: 0.98,
      rotation: 7.85,
      shape: "rectangle",
      type: "shape",
      visible: true,
      width: 1070,
      x: -180,
      y: -178,
      zIndex: 1
    },
    {
      cornerRadius: 0,
      fill: {
        angle: 90,
        from: studioPalette.fieldflowPetrol,
        kind: "linear-gradient",
        to: studioPalette.fieldflowGreen
      },
      height: 1300,
      id: "photo-seam",
      locked: true,
      name: "Groene foto-overgang",
      opacity: 0.44,
      rotation: 7.85,
      shape: "rectangle",
      type: "shape",
      visible: true,
      width: 235,
      x: 879,
      y: -20,
      zIndex: 2
    },
    {
      cornerRadius: 0,
      fill: { color: studioPalette.fieldflowGreen, kind: "solid" },
      height: 1300,
      id: "photo-seam-edge",
      locked: true,
      name: "Groene overgangslijn",
      opacity: 0.82,
      rotation: 7.85,
      shape: "rectangle",
      type: "shape",
      visible: true,
      width: 8,
      x: 879,
      y: -20,
      zIndex: 3
    },
    {
      align: "center",
      autoFit: false,
      cornerRadius: 0,
      fill: studioPalette.fieldflowPetrol,
      fontFamily: "Manrope Variable",
      fontSize: 58,
      fontWeight: 800,
      height: 726,
      id: "eyebrow",
      letterSpacing: 1,
      lineHeight: 1.1,
      locked: false,
      name: "Koptekst",
      opacity: 0.001,
      padding: 0,
      rotation: 0,
      text: "WEDSTRIJD VANDAAG",
      type: "text",
      verticalAlign: "middle",
      visible: true,
      width: 805,
      x: 105,
      y: 106,
      zIndex: 4
    },
    {
      align: "left",
      autoFit: false,
      cornerRadius: 0,
      fill: studioPalette.fieldflowGreen,
      fontFamily: "Manrope Variable",
      fontSize: 58,
      fontWeight: 800,
      height: 72,
      id: "eyebrow-copy",
      letterSpacing: 1,
      lineHeight: 1.1,
      locked: true,
      name: "Koptekstweergave",
      opacity: 1,
      padding: 0,
      rotation: 0,
      text: "WEDSTRIJD VANDAAG",
      type: "text",
      verticalAlign: "top",
      visible: true,
      width: 760,
      x: 132,
      y: 312,
      zIndex: 5
    },
    {
      align: "left",
      autoFit: true,
      cornerRadius: 0,
      fill: studioPalette.fieldflowCloud,
      fontFamily: "Manrope Variable",
      fontSize: 240,
      fontWeight: 800,
      height: 230,
      id: "headline",
      letterSpacing: -4,
      lineHeight: 0.96,
      locked: false,
      name: "Tijd",
      opacity: 1,
      padding: 0,
      rotation: 0,
      text: "14:30",
      type: "text",
      verticalAlign: "top",
      visible: true,
      width: 760,
      x: 132,
      y: 384,
      zIndex: 6
    },
    {
      align: "left",
      autoFit: false,
      cornerRadius: 0,
      fill: studioPalette.fieldflowCloud,
      fontFamily: "Inter Variable",
      fontSize: 40,
      fontWeight: 500,
      height: 64,
      id: "subtitle",
      letterSpacing: 0,
      lineHeight: 1.2,
      locked: false,
      name: "Wedstrijd",
      opacity: 1,
      padding: 0,
      rotation: 0,
      text: "Heren 1 — S.V. Vooruit",
      type: "text",
      verticalAlign: "top",
      visible: true,
      width: 720,
      x: 132,
      y: 645,
      zIndex: 7
    },
    {
      align: "left",
      autoFit: false,
      cornerRadius: 0,
      fill: studioPalette.fieldflowCloud,
      fontFamily: "Inter Variable",
      fontSize: 24,
      fontWeight: 500,
      height: 48,
      id: "location",
      letterSpacing: 0,
      lineHeight: 1.2,
      locked: false,
      name: "Locatie",
      opacity: 0.76,
      padding: 0,
      rotation: 0,
      text: "⌾  Sportpark Houtrust",
      type: "text",
      verticalAlign: "top",
      visible: true,
      width: 620,
      x: 132,
      y: 758,
      zIndex: 8
    },
    {
      cornerRadius: 32,
      fill: {
        color: studioPalette.paperWhite,
        kind: "solid"
      },
      height: 128,
      id: "club-badge",
      locked: true,
      name: "Clubbadge",
      opacity: 1,
      rotation: 0,
      shape: "rectangle",
      type: "shape",
      visible: true,
      width: 128,
      x: 1736,
      y: 893,
      zIndex: 9
    },
    {
      align: "center",
      autoFit: false,
      cornerRadius: 0,
      fill: studioPalette.fieldflowPetrol,
      fontFamily: "Manrope Variable",
      fontSize: 32,
      fontWeight: 800,
      height: 128,
      id: "club-badge-initials",
      letterSpacing: 0,
      lineHeight: 1,
      locked: true,
      name: "Clubinitialen",
      opacity: 1,
      padding: 0,
      rotation: 0,
      text: "DS",
      type: "text",
      verticalAlign: "middle",
      visible: true,
      width: 128,
      x: 1736,
      y: 893,
      zIndex: 10
    }
  ];

  return {
    ...document,
    artboard: {
      ...document.artboard,
      background: {
        angle: 0,
        from: studioPalette.fieldflowPetrol,
        kind: "linear-gradient",
        to: studioPalette.fieldflowDarkPetrol
      }
    },
    elements
  };
}

function templateSummary(
  templateId: string,
  index: number
): StudioProjectSummary {
  const template = getStudioSystemTemplate(templateId);
  if (!template) {
    throw new Error(`Onbekende Studio-demotemplate: ${templateId}`);
  }

  return {
    createdAt: demoNow,
    document: template.document,
    draftRevision: 0,
    durationMs: template.document.motion.durationMs,
    id: template.id,
    kind: "tenant_template",
    lastExportMediaId: null,
    lastRenderStatus: null,
    motionEnabled: template.document.motion.enabled,
    name: template.name,
    orientation: template.document.artboard.orientation,
    ownerUserId: "demo-control-user",
    projectRevision: 0,
    status: "active",
    updatedAt: new Date(Date.parse(demoNow) - index * 3_600_000).toISOString()
  };
}
