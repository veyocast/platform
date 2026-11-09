import Link from "next/link";
import { Button } from "@veyocast/ui";
import styles from "./season-switch.module.css";

export type SeasonFilterValues = { connectionId?: string; targetSeasonId?: string; q?: string; status?: string; resourceKind?: string; resourceId?: string };

export function SeasonSwitchFilters({ connections, seasons, values }: {
  connections: { id: string; name: string }[];
  seasons: { id: string; label: string }[];
  values: SeasonFilterValues;
}) {
  return <form className={styles.filters} method="get">
    <label><span>Sportlink-verbinding</span><select defaultValue={values.connectionId ?? ""} name="connectionId" required><option value="">Kies een verbinding</option>{connections.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label><span>Doelseizoen uit de bron</span><select defaultValue={values.targetSeasonId ?? ""} name="targetSeasonId"><option value="">Eerst de beschikbare seizoenen lezen</option>{seasons.map(season => <option key={season.id} value={season.id}>{season.label}</option>)}</select></label>
    <label><span>Zoek ontwerp, context of status</span><input defaultValue={values.q ?? ""} maxLength={120} name="q" type="search" /></label>
    <label><span>Status</span><select defaultValue={values.status ?? "all"} name="status"><option value="all">Alle statussen</option><option value="attention">Aandacht nodig</option><option value="available">Voorstel beschikbaar</option><option value="locked">Historisch of actief vastgezet</option></select></label>
    <label><span>Objecttype</span><select defaultValue={values.resourceKind ?? "all"} name="resourceKind"><option value="all">Ontwerpen en draaiboeken</option><option value="dynamic_slide">Sportlink-ontwerpen</option><option value="matchday_runbook">Wedstrijddag-draaiboeken</option></select></label>
    {values.resourceId ? <input name="resourceId" type="hidden" value={values.resourceId} /> : null}
    <div className={styles.filterActions}><Button type="submit" variant="secondary">Inventaris controleren</Button>{values.resourceId ? <Link href="/dashboard/sources/sportlink/season-switch">Alle objecten bekijken</Link> : null}</div>
  </form>;
}
