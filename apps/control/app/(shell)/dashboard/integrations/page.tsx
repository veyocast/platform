import Link from "next/link";
import { ArrowRight, FileSpreadsheet, RefreshCw } from "lucide-react";

import { StatusPill } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { PageHeader } from "../../_components/shell-primitives";
import styles from "./integrations.module.css";

export default async function IntegrationsPage() {
  const session = await requireTenantControlSession("tenant.product.read");

  return (
    <>
      <PageHeader
        description="Beheer externe gegevensbronnen zonder dat schermen afhankelijk worden van een live providerverbinding."
        eyebrow={session.tenant}
        title="Integraties"
      />

      <section aria-labelledby="integration-catalog-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="integration-catalog-title">
              Beschikbare integraties
            </h2>
            <p className="work-panel__meta">
              Gegevens worden eerst gecontroleerd en vastgelegd in VeyoCast.
              Publicaties en offline playback blijven daardoor voorspelbaar.
            </p>
          </div>
        </div>

        <div className={styles.grid}>
          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.icon} aria-hidden="true">
                <FileSpreadsheet />
              </span>
              <StatusPill label="Beschikbaar" tone="success" />
            </div>
            <div className={styles.cardBody}>
              <div>
                <p className={styles.provider}>Twelve</p>
                <h3>Twelve Producten</h3>
              </div>
              <p>
                Importeer een Twelve Excel-export, koppel kolommen en beheer
                productnamen, prijzen en shortcodes voor Studio.
              </p>
            </div>
            <dl className={styles.meta}>
              <div>
                <dt>Werkwijze</dt>
                <dd>Gecontroleerde Excel-snapshot</dd>
              </div>
              <div>
                <dt>Automatische synchronisatie</dt>
                <dd><RefreshCw aria-hidden="true" /> Niet actief</dd>
              </div>
            </dl>
            <Link className={styles.link} href="/dashboard/integrations/twelve-products">
              Twelve Producten openen
              <ArrowRight aria-hidden="true" />
            </Link>
          </article>
        </div>
      </section>
    </>
  );
}
