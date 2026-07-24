import Link from "next/link";

import { hasCapability } from "@veyocast/auth";
import {
  studioSystemTemplates,
  studioTemplateCategories
} from "@veyocast/studio";
import { Button, PageHeader } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../../lib/control-session";
import { createStudioProject } from "../actions";
import { loadStudioBrandResources, loadStudioOverview } from "../data";
import { NewStudioForm } from "./studio-new-form";

export default async function NewStudioPage() {
  const session = await requireTenantControlSession("tenant.studio.create");
  const canCreate =
    session.tenantStatus === "active" &&
    hasCapability(session.capabilities, "tenant.studio.create");
  const [tenantTemplateData, brandResources] = await Promise.all([
    loadStudioOverview(
      session.tenantId,
      session.isLive,
      session.userId,
      {
        format: "all",
        kind: "template",
        owner: "all",
        sort: "name",
        status: "active",
        updated: "all",
        view: "grid"
      }
    ),
    loadStudioBrandResources(session.tenantId, session.isLive)
  ]);

  return (
    <>
      <PageHeader
        actions={
          <Button asChild variant="secondary">
            <Link href="/dashboard/studio">Annuleren</Link>
          </Button>
        }
        breadcrumbs={[
          { href: "/dashboard/studio", label: "Studio" },
          { label: "Nieuw ontwerp" }
        ]}
        description="Kies een passend formaat en start leeg of vanuit een gecontroleerd systeemtemplate."
        status={
          !session.isLive
            ? { label: "Demomodus", tone: "warning" }
            : undefined
        }
        title="Nieuw ontwerp"
      />
      <NewStudioForm
        action={createStudioProject}
        canCreate={canCreate}
        canManageTemplates={hasCapability(
          session.capabilities,
          "tenant.studio.template.manage"
        )}
        categories={studioTemplateCategories}
        tenantBrand={brandResources.brandKit}
        tenantTemplates={tenantTemplateData.projects.flatMap((project) =>
          project.document
            ? [{
                description: "Herbruikbaar template van deze vereniging.",
                document: project.document,
                formatId:
                  project.orientation === "portrait"
                    ? "portrait-hd" as const
                    : "landscape-hd" as const,
                id: project.id,
                name: project.name
              }]
            : []
        )}
        templates={studioSystemTemplates}
      />
    </>
  );
}
