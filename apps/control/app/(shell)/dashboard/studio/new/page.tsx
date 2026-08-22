import Link from "next/link";
import { Database, LayoutDashboard, Palette } from "lucide-react";
import type { ReactNode } from "react";

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

export default async function NewStudioPage({
  searchParams
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
          actions={<Button asChild variant="secondary"><Link href="/dashboard/studio">Annuleren</Link></Button>}
          breadcrumbs={[{ href: "/dashboard/studio", label: "Studio" }, { label: "Nieuwe slide" }]}
          description="Kies wat je wilt maken. Alle slidetypefamilies blijven vanuit één Studio bereikbaar."
          title="Nieuwe slide"
        />
        <div className="studio-family-grid">
          <StudioFamilyCard description="Ontwerp een volledig vrije visuele slide." href="/dashboard/studio/new?family=free" icon={<Palette aria-hidden="true" />} title="Vrij ontwerp" />
          <StudioFamilyCard description="Bouw menu's en prijslijsten vanuit gekoppelde producten." href="/dashboard/slides/menu-studio/new" icon={<LayoutDashboard aria-hidden="true" />} title="Menu & prijzen" />
          <StudioFamilyCard description="Maak in één wizard club-, poule- en aankomstslides vanuit Sportlink." href="/dashboard/studio/sportlink/new" icon={<Database aria-hidden="true" />} title="Sportlink" />
        </div>
        <style>{`.studio-family-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem}.studio-family-card{display:flex;min-height:210px;flex-direction:column;justify-content:space-between;padding:1.5rem;border:1px solid var(--border);border-radius:18px;background:var(--surface)}.studio-family-card svg{width:32px;height:32px;color:var(--accent)}.studio-family-card h2{margin:.9rem 0 .4rem}.studio-family-card p{color:var(--muted-foreground);max-width:34ch}`}</style>
      </>
    );
  }

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

function StudioFamilyCard({
  description, href, icon, title
}: {
  description: string;
  href: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <article className="studio-family-card">
      <div>{icon}<h2>{title}</h2><p>{description}</p></div>
      <Button asChild><Link href={href}>Openen</Link></Button>
    </article>
  );
}
