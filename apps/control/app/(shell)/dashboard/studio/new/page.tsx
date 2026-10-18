import Link from "next/link";

import { hasCapability } from "@veyocast/auth";
import {
  studioSitesSystemTemplates,
  studioTemplateCategories,
} from "@veyocast/studio";
import { Button, PageHeader } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../../lib/control-session";
import { createStudioProject } from "../actions";
import { loadStudioBrandResources, loadStudioOverview } from "../data";
import { SyncStudioCreateDialog } from "../sync-studio-create-dialog";
import { NewStudioForm } from "./studio-new-form";

export default async function NewStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ family?: string }>;
}) {
  const session = await requireTenantControlSession("tenant.studio.create");
  const { family } = await searchParams;
  const canCreate =
    session.tenantStatus === "active" &&
    hasCapability(session.capabilities, "tenant.studio.create");
  if (!family) {
    return (
      <>
        <PageHeader
          title="Nieuw ontwerp"
          description="Kies een template en maak het van jouw club."
          actions={
            <Button asChild variant="secondary">
              <Link href="/dashboard/content">Naar de bibliotheek</Link>
            </Button>
          }
        />
        <SyncStudioCreateDialog
          tenantId={session.tenantId}
          tenantName={session.tenant}
          canCreate={canCreate && session.isLive}
          initialOpen
        />
      </>
    );
  }

  const [tenantTemplateData, brandResources] = await Promise.all([
    loadStudioOverview(session.tenantId, session.isLive, session.userId, {
      format: "all",
      kind: "template",
      owner: "all",
      sort: "name",
      status: "active",
      updated: "all",
      view: "grid",
    }),
    loadStudioBrandResources(session.tenantId, session.isLive),
  ]);

  return (
    <NewStudioForm
      action={createStudioProject}
      canCreate={canCreate}
      canManageTemplates={hasCapability(
        session.capabilities,
        "tenant.studio.template.manage",
      )}
      categories={studioTemplateCategories}
      tenantBrand={brandResources.brandKit}
      tenantTemplates={tenantTemplateData.projects.flatMap((project) =>
        project.document
          ? [
              {
                description: "Herbruikbaar template van deze vereniging.",
                document: project.document,
                formatId:
                  project.orientation === "portrait"
                    ? ("portrait-hd" as const)
                    : ("landscape-hd" as const),
                id: project.id,
                name: project.name,
              },
            ]
          : [],
      )}
      templates={studioSitesSystemTemplates}
    />
  );
}
