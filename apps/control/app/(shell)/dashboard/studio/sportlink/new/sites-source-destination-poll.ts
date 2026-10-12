import type { prepareSitesSourceDestination, SitesSourceDestinationPrepareResult } from "./sites-source-destination-actions";
type Command = Parameters<typeof prepareSitesSourceDestination>[0];
export function pollSitesSourceDestination(input: {
  command: Command;
  prepare: (command: Command) => Promise<SitesSourceDestinationPrepareResult>;
  onResult: (result: SitesSourceDestinationPrepareResult) => void;
  onPending: (pending: boolean) => void;
}) {
  let cancelled = false; let timer: ReturnType<typeof setTimeout> | undefined; let requestTimer: ReturnType<typeof setTimeout> | undefined;
  const deadline = Date.now() + 90_000;
  input.onPending(true);
  const check = async () => {
    let response: SitesSourceDestinationPrepareResult;
    try {
      // A lost server response is an unknown outcome; retries keep the receipt key.
      response = await Promise.race([
        input.prepare(input.command),
        new Promise<SitesSourceDestinationPrepareResult>(resolve => { requestTimer = setTimeout(() => resolve({ outcome: "failed", message: "De bevestiging duurde te lang. De toevoeging is nog niet bevestigd. Je ontwerpen en bestemming blijven behouden; controleer de playlist of probeer met dezelfde sleutel opnieuw." }), Math.min(30_000, Math.max(1, deadline - Date.now()))); })
      ]);
    }
    catch { response = { outcome: "failed", message: "De bestemming kon niet worden bevestigd. Je ontwerpen blijven behouden. Probeer opnieuw met dezelfde sleutel." }; }
    clearTimeout(requestTimer);
    if (cancelled) return;
    if (response.outcome === "pending" && Date.now() >= deadline) {
      input.onResult({ outcome: "pending", message: "De voorbereiding duurt langer dan verwacht. Er is nog niets aan je playlist toegevoegd. Je ontwerpen en bestemming blijven behouden; controleer de bronstatus of probeer later opnieuw." });
      input.onPending(false); return;
    }
    input.onResult(response);
    if (response.outcome === "pending") timer = setTimeout(() => { void check(); }, 2_000);
    else input.onPending(false);
  };
  void check();
  return () => { cancelled = true; clearTimeout(timer); clearTimeout(requestTimer); };
}
