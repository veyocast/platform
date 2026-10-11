import { hasCapability } from "@veyocast/auth";
import { StatusPill } from "@veyocast/ui";
import { requireTenantControlSession } from "../../../../../lib/control-session";
import { loadYouTubeWorkspace } from "./data";
import { SitesYouTubeWorkspace } from "./sites-youtube-workspace";
import styles from "./sites-youtube.module.css";

export default async function YouTubeIntegrationPage({ searchParams }: { searchParams: Promise<{ fout?: string; succes?: string }> }) {
  const session = await requireTenantControlSession("tenant.data_source.read");
  const [data, params] = await Promise.all([loadYouTubeWorkspace(session.tenantId ?? ""), searchParams]);
  const canManage = session.isLive && hasCapability(session.capabilities, "tenant.data_source.manage");
  if (data.failed) return <section className={styles.panel}><h1>YouTube</h1><p role="alert">Je videobronnen konden niet worden opgehaald. Je huidige scherminhoud blijft behouden. Vernieuw de pagina en probeer opnieuw.</p></section>;
  if (!data.enabled) return <section className={styles.panel}><StatusPill label="Niet geactiveerd" tone="warning" /><h1>YouTube</h1><p>YouTube is voor deze vereniging nog niet actief. Vraag je beheerder de koppeling te activeren om video’s en playlists toe te voegen.</p></section>;
  return <SitesYouTubeWorkspace assets={data.assets} sources={data.sources} canManage={canManage} configured={Boolean(process.env.YOUTUBE_DATA_API_KEY?.trim())} error={params.fout} success={params.succes} />;
}
