import { parsePlayerTimestamp } from "./player-time";

export const syncPlayerStatusCopy = {
  boot: { eyebrow: "VEYOCAST PLAYER", title: "Je verhaal komt tot leven.", body: "De player wordt gestart. We halen je laatste goede publicatie op." },
  pairing: { eyebrow: "READY TO CONNECT", title: "Geef dit scherm een verhaal.", body: "Open Schermen in VeyoCast, kies Scherm koppelen en voer deze code in." },
  download: { eyebrow: "SCREEN SYNC", title: "We zetten alles klaar.", body: "Afbeeldingen, video en je clubstijl worden lokaal voorbereid." },
  verify: { eyebrow: "VEILIG VOORBEREID", title: "Nog één laatste controle.", body: "Alle bestanden worden gecontroleerd. De publicatie start pas wanneer alles veilig is voorbereid." },
  "no-content": { eyebrow: "GEKOPPELD EN GEREED", title: "Dit scherm wacht op jouw verhaal.", body: "Het scherm is verbonden. Wijs een gepubliceerde playlist toe om automatisch te starten." },
  "offline-empty": { eyebrow: "EERSTE VERBINDING NODIG", title: "Nog geen lokaal verhaal.", body: "Dit apparaat heeft nog geen geverifieerde inhoud. Verbind één keer om de eerste publicatie klaar te zetten." },
  error: { eyebrow: "EVEN AANDACHT NODIG", title: "Dit scherm wacht even.", body: "De publicatie kon nog niet veilig worden gestart. Controleer de verbinding of probeer opnieuw." },
  "pairing-expired": { eyebrow: "KOPPELCODE VERLOPEN", title: "Een nieuwe code is zo gemaakt.", body: "Voor je veiligheid is een koppelcode maar tijdelijk geldig. Vraag een nieuwe koppelcode aan om opnieuw te beginnen." },
  recovery: { eyebrow: "PLAYERHERSTEL", title: "We pakken het rustig op.", body: "De Player probeert opnieuw verbinding te maken. Je schermbinding blijft behouden." },
  disabled: { eyebrow: "PLAYER GEPAUZEERD", title: "Even rust op het scherm.", body: "Dit scherm kan nu geen nieuwe publicatie starten. Controleer de schermstatus in VeyoCast." }
} as const;

export type SyncPlayerStatusStage = keyof typeof syncPlayerStatusCopy;
export type InitialPlayerPreparationPhase = "DOWNLOADING" | "VERIFYING" | null;

export function initialPlayerPreparationStage(phase: InitialPlayerPreparationPhase): SyncPlayerStatusStage {
  return phase === "DOWNLOADING" ? "download" : phase === "VERIFYING" ? "verify" : "boot";
}

export function playerProblemStage(code: string | undefined, disabled: boolean): SyncPlayerStatusStage {
  if (disabled) return "disabled";
  if (code === "PLAYER_OFFLINE") return "offline-empty";
  if (code === "PAIRING_CODE_EXPIRED") return "pairing-expired";
  return "error";
}

export function validDisplayedPairingCode(code: string | undefined, expiresAt: string | undefined) {
  // Expiry/rotation belongs to the existing runtime, never a second UI clock.
  // The unconfigured development transport explicitly has no expiry; live
  // responses without one are rejected before the runtime enters UNPAIRED.
  if (expiresAt && !Number.isFinite(parsePlayerTimestamp(expiresAt))) return null;
  return code && /^[A-Z0-9]{3} ?[A-Z0-9]{3}$/.test(code) ? code : null;
}
