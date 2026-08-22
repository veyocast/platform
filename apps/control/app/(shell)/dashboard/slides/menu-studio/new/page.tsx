import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Database, Flag, LayoutTemplate } from "lucide-react";

import { Button } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../../../lib/control-session";
import { PageHeader } from "../../../../_components/shell-primitives";
import {
  initialMenuDocument,
  loadMenuStudioOptions,
  menuStudioTemplateVersionIds
} from "../data";
import { MenuStudioEditor } from "../menu-studio-editor";
import styles from "../menu-studio.module.css";

type PageProps = {
  searchParams: Promise<{ bron?: string }>;
};

export default async function NewMenuStudioPage({ searchParams }: PageProps) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const query = await searchParams;
  const data = session.isLive && session.tenantId
    ? await loadMenuStudioOptions(session.tenantId, query.bron)
    : null;

  return (
    <>
      <PageHeader
        actions={<Button asChild variant="ghost"><Link href="/dashboard/slides">Annuleren</Link></Button>}
        description="Bouw één strikt menudocument voor liggende en staande schermen. Productdata blijft gekoppeld; de visuele publicatie wordt immutable vastgezet."
        eyebrow={session.tenant}
        title="Menu Studio"
      />
      {!data ? (
        <State icon={<Flag aria-hidden="true" />} title="Menu Studio niet beschikbaar">
          De tenantinstellingen konden niet veilig worden geladen. Bestaande slides en releases zijn niet gewijzigd.
        </State>
      ) : !data.flags.read || !data.flags.authoring ? (
        <State icon={<Flag aria-hidden="true" />} title="Gefaseerde uitrol staat nog uit">
          MenuDocument.v2 en authoring moeten voor deze tenant afzonderlijk worden geactiveerd. De standaard staat bewust op uit.
        </State>
      ) : !data.sources.length || !data.source ? (
        <State icon={<Database aria-hidden="true" />} title="Eerst een productbron nodig">
          Maak of koppel een actieve handmatige of Twelve-productbron voordat je een menu samenstelt.
          <Button asChild><Link href="/dashboard/data-sources">Databron toevoegen</Link></Button>
        </State>
      ) : !data.templates.length ? (
        <State icon={<LayoutTemplate aria-hidden="true" />} title="Geen gepubliceerd prijslijsttemplate">
          Een platformbeheerder moet eerst een geschikt Editorial Arena-prijslijsttemplate publiceren.
        </State>
      ) : (
        <>
          {data.sources.length > 1 ? (
            <nav aria-label="Productbron kiezen" className={styles.sourceNav}>
              <span>Productbron</span>
              {data.sources.map((source) => (
                <Button asChild key={source.id} size="sm" variant={source.id === data.source?.id ? "primary" : "secondary"}>
                  <Link href={`/dashboard/slides/menu-studio/new?bron=${source.id}`}>{source.name}</Link>
                </Button>
              ))}
            </nav>
          ) : null}
          <MenuStudioEditor
            initialOrientation={data.templates.some((template) => template.orientation === "landscape")
              ? "landscape"
              : "portrait"}
            initialDocument={initialMenuDocument({
              documentId: randomUUID(),
              tenantId: session.tenantId!,
              theme: data.theme
            })}
            linkedGroupsEnabled={data.flags.linkedGroups}
            media={data.media}
            mediaEnabled={data.flags.media}
            mode="create"
            products={data.products}
            publishEnabled={data.flags.publish && data.flags.player}
            sourceId={data.source.id}
            sourceName={data.source.name}
            templateVersionIds={menuStudioTemplateVersionIds(data.templates)}
          />
        </>
      )}
    </>
  );
}

function State({
  children,
  icon,
  title
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return <section className={`empty-state ${styles.routeState}`}>{icon}<h2>{title}</h2><div>{children}</div></section>;
}
