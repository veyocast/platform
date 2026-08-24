import Link from "next/link";
import { ArrowRight, Database, FileSpreadsheet, Handshake, RefreshCw, Rss, Sparkles, Video } from "lucide-react";

import { StatusPill } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { PageHeader } from "../../_components/shell-primitives";
import styles from "./integrations.module.css";

export default async function IntegrationsPage() {
  const session = await requireTenantControlSession("tenant.product.read");
  const supabase = await createControlSupabaseClient();
  const flags = session.tenantId && supabase ? await supabase.from("tenant_feature_flags").select("flag_key,enabled").eq("tenant_id",session.tenantId).in("flag_key",["engage","youtube_integration"]) : { data: [] };
  const enabled = new Set((flags.data ?? []).filter((flag) => flag.enabled).map((flag) => flag.flag_key));

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
              <span className={styles.icon} aria-hidden="true"><Database /></span>
              <StatusPill label="Beschikbaar" tone="success" />
            </div>
            <div className={styles.cardBody}>
              <div><p className={styles.provider}>Sportlink</p><h3>Club.Dataservice</h3></div>
              <p>Programma, uitslagen, standen, afgelastingen en clubagenda via veilige offline snapshots.</p>
            </div>
            <dl className={styles.meta}>
              <div><dt>Werkwijze</dt><dd>Server-side synchronisatie</dd></div>
              <div><dt>Player</dt><dd>Geen directe providerverbinding</dd></div>
            </dl>
            <Link className={styles.link} href="/dashboard/data-sources/sportlink">
              Sportlink beheren <ArrowRight aria-hidden="true" />
            </Link>
          </article>
          <article className={styles.card}>
            <div className={styles.cardHeader}><span className={styles.icon} aria-hidden="true"><Rss /></span><StatusPill label="Beschikbaar" tone="success" /></div>
            <div className={styles.cardBody}><div><p className={styles.provider}>RSS / nieuws</p><h3>Nieuwsbronnen</h3></div><p>Veilige server-side verwerking met stale-status, lokale afbeeldingen, QR-links en last-known-good snapshots.</p></div>
            <dl className={styles.meta}><div><dt>Werkwijze</dt><dd>Gecontroleerde feed-snapshot</dd></div><div><dt>Player</dt><dd>Offline last-known-good</dd></div></dl>
            <Link className={styles.link} href="/dashboard/data-sources">Nieuwsbronnen beheren <ArrowRight aria-hidden="true" /></Link>
          </article>
          <article className={styles.card}>
            <div className={styles.cardHeader}><span className={styles.icon} aria-hidden="true"><Video /></span><StatusPill label={enabled.has("youtube_integration") ? "Pilot actief" : "Gecontroleerde pilot"} tone={enabled.has("youtube_integration") ? "success" : "warning"} /></div>
            <div className={styles.cardBody}><div><p className={styles.provider}>YouTube</p><h3>Officiële online playback</h3></div><p>Insluitbare video's via de officiële Player API, altijd met lokale fallback en zonder download of offline videovoorraad.</p></div>
            <dl className={styles.meta}><div><dt>Werkwijze</dt><dd>Online-only</dd></div><div><dt>Fallback</dt><dd>Lokale VeyoCast-media</dd></div></dl>
            <Link className={styles.link} href="/dashboard/integrations/youtube">YouTube configureren <ArrowRight aria-hidden="true" /></Link>
          </article>
          <article className={styles.card}>
            <div className={styles.cardHeader}><span className={styles.icon} aria-hidden="true"><Handshake /></span><StatusPill label="Beschikbaar" tone="success" /></div>
            <div className={styles.cardBody}><div><p className={styles.provider}>Sponsor Hub</p><h3>Campagnes & Proof of Play</h3></div><p>Vier-ogen-goedkeuring, semantische plaatsingen, immutable leveringsplannen en technisch bewijs van vertoning.</p></div>
            <dl className={styles.meta}><div><dt>Publicatie</dt><dd>Immutable plan</dd></div><div><dt>Player</dt><dd>Offline cache</dd></div></dl>
            <Link className={styles.link} href="/dashboard/sponsors">Sponsor Hub openen <ArrowRight aria-hidden="true" /></Link>
          </article>
          <article className={styles.card}>
            <div className={styles.cardHeader}><span className={styles.icon} aria-hidden="true"><Sparkles /></span><StatusPill label={enabled.has("engage") ? "Pilot actief" : "Gecontroleerde pilot"} tone={enabled.has("engage") ? "success" : "warning"} /></div>
            <div className={styles.cardBody}><div><p className={styles.provider}>Engage</p><h3>Polls & publieksstemmen</h3></div><p>Mobile-first stemmen, QR-deeplink, resultaatprivacy, misbruikbeperking en live resultaatupdates.</p></div>
            <dl className={styles.meta}><div><dt>Privacy</dt><dd>Pseudoniem</dd></div><div><dt>Rollout</dt><dd>Per tenant</dd></div></dl>
            <Link className={styles.link} href="/dashboard/engage">Engage openen <ArrowRight aria-hidden="true" /></Link>
          </article>
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
