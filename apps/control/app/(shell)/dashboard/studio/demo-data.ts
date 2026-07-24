import {
  createEmptyStudioDocument,
  getStudioSystemTemplate,
  studioSystemTemplates
} from "@veyocast/studio";

import type {
  StudioEditorData,
  StudioOverviewData,
  StudioProjectDetail,
  StudioProjectSummary
} from "./types";

const demoNow = "2026-07-24T08:00:00.000Z";

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
  const document = template?.document ?? createEmptyStudioDocument(format);
  const project: StudioProjectDetail = {
    createdAt: demoNow,
    document,
    draftRevision: 0,
    id: template?.id ?? `blank-${format}`,
    kind: template ? "tenant_template" : "design",
    motionEnabled: document.motion.enabled,
    name: template?.name ?? "Nieuw ontwerp",
    orientation: document.artboard.orientation,
    ownerUserId: "demo-control-user",
    projectRevision: 0,
    status: "active",
    updatedAt: demoNow
  };

  return {
    assets: [],
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
