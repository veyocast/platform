import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { sportlinkConnectionStatus, type SportlinkPolicyHealthInput } from "./sportlink-status";
import styles from "../../studio/sportlink/new/sites-source-wizard.module.css";
export function SitesSportlinkSourceHealth({ connection, policies, now, unavailable = false }: { connection: { status: string; last_error_code: string | null } | null; policies: SportlinkPolicyHealthInput[]; now: number; unavailable?: boolean }) {
  const health = sportlinkConnectionStatus(connection, policies, now, unavailable);
  if (health.kind === "ready") return null;
  const detail = health.kind === "disconnected" ? "Er is nog geen Sportlink-koppeling opgeslagen. Stel de verbinding in om verenigingsgegevens te gebruiken." : health.kind === "stale" ? "De laatste synchronisatie is te oud. De laatst bevestigde gegevens blijven zichtbaar. Controleer de datasetstatus en probeer opnieuw te synchroniseren." : health.kind === "failed" || health.kind === "partial" ? "De laatste synchronisatie kon niet volledig worden bevestigd. De laatste goede scherminhoud blijft actief. Controleer de datasetstatus en probeer opnieuw." : health.kind === "running" || health.kind === "pending" ? "De gegevens worden nog gecontroleerd. Bestaande schermpublicaties blijven actief. Controleer de datasetstatus voordat je nieuwe inhoud publiceert." : "De bronstatus is niet actueel bevestigd. Bestaande scherminhoud blijft behouden. Controleer de datasetstatus of vraag je beheerder om de koppeling te controleren.";
  return <div className={styles.info} role={health.kind === "failed" ? "alert" : "status"}><CircleAlert size={22} /><p><strong>{health.label}.</strong> {detail} {connection && <Link href="/dashboard/data-sources/sportlink#datasetstatus">Datasetstatus bekijken</Link>}</p></div>;
}
