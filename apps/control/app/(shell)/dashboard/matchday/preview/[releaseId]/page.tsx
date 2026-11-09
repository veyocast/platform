/* eslint-disable @next/next/no-img-element -- Existing private immutable release preview. */
import Link from "next/link";
import {notFound} from "next/navigation";
import {requireTenantControlSession} from "../../../../../../lib/control-session";
import {loadFrozenReleasePreviews} from "../../../../../../lib/release-preview.server";
import {createControlSupabaseClient} from "../../../../../../lib/supabase/server";
import styles from "../../matchday.module.css";

export default async function MatchdayPreviewPage({params}:{params:Promise<{releaseId:string}>}){
 const session=await requireTenantControlSession("tenant.release.read"),{releaseId}=await params;
 if(!session.isLive||!session.tenantId||!/^[a-f0-9-]{36}$/i.test(releaseId))notFound();
 const client=await createControlSupabaseClient();if(!client)notFound();
 const result=await client.from("playlist_releases").select("id,version,published_at,manifest_hash").eq("tenant_id",session.tenantId).eq("id",releaseId).maybeSingle();
 if(result.error)return <div className={styles.page}><h1>Publicatievoorbeeld niet beschikbaar</h1><p role="alert">De opgeslagen versie kon niet veilig worden gecontroleerd. Keer terug naar het draaiboek en probeer de controle opnieuw.</p><Link href="/dashboard/matchday">Terug naar Wedstrijddag</Link></div>;
 if(!result.data)notFound();
 const preview=(await loadFrozenReleasePreviews(session.tenantId,[releaseId])).get(releaseId);
 return <div className={styles.page}><Link href="/dashboard/matchday">Terug naar Wedstrijddag</Link><h1>Opgeslagen publicatievoorbeeld · versie {result.data.version}</h1><p>Dit is de eerste opgeslagen beeldplaatsing. Dit voorbeeld is geen live screenshot of volledige controle van de afspeellus; Playerbevestiging staat afzonderlijk per doelscherm in het draaiboek.</p>{preview?<img alt={`Opgeslagen publicatieplaatsing: ${preview.title}`} src={preview.url} style={{maxWidth:"100%",height:"auto"}}/>:<p className={styles.notice}>Deze opgeslagen versie heeft geen afzonderlijk afbeeldingsvoorbeeld. De publicatiegegevens zijn beschikbaar; controleer de volledige uitvoer op het geselecteerde canaryscherm.</p>}<Link href={`/dashboard/releases/${releaseId}`}>Vaste versie en publicatiegegevens controleren</Link></div>;
}
