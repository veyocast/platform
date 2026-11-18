import Link from "next/link";
import { Button } from "@veyocast/ui";
import { requireControlCapability } from "../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { aiEnvironment } from "../../../../../lib/agent/access";
import { PageHeader } from "../../../_components/shell-primitives";
import { saveOpenAiConfiguration, testOpenAiConfiguration } from "./actions";

export default async function OpenAiIntegrationPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  await requireControlCapability("platform.tenant.lifecycle", { aal2: true, returnTo: "/platform/integrations/openai" });
  const client = await createControlSupabaseClient();
  const result = await client?.rpc("get_platform_ai_config_v1", { p_environment: aiEnvironment() });
  const configuration = result?.data as { configured: boolean; chatModel: string; imageModel: string; revision: number; lastTestedAt: string | null; status: string } | null;
  const query = await searchParams;
  const notices: Record<string, string> = {
    saved: "De configuratie is bevestigd opgeslagen. Test de verbinding en activeer alleen de gewenste verenigingen.",
    save_failed: "De configuratie is niet bevestigd opgeslagen. De vorige configuratie blijft behouden; controleer je rechten, de geheimenopslag en de actuele revisie voordat je opnieuw indient.",
    connected: "De projectsleutel werkt en beide ingestelde modellen zijn voor dit project beschikbaar. Er is geen betaalde generatie gestart.",
    test_failed: "De verbinding of modeltoegang kon niet worden bevestigd. Gewone bediening en uitzendingen blijven werken; controleer de projectsleutel en modellen en test opnieuw."
  };
  return <>
    <PageHeader eyebrow="Platform · Integraties" title="OpenAI" description="Eén projectsleutel voor deze VeyoCast-omgeving. AI blijft per vereniging standaard uit en verleent geen extra beheerrechten." />
    {query.result && notices[query.result] && <p role={query.result.endsWith("failed") ? "alert" : "status"} className="notice">{notices[query.result]}</p>}
    {result?.error ? <p role="alert">De configuratie kon niet worden gelezen. Er is niets gewijzigd; vernieuw de pagina.</p> : <section className="workspace-section">
      <h2>Projectverbinding · {aiEnvironment()}</h2>
      <dl><div><dt>Projectsleutel</dt><dd>{configuration?.configured ? "Ingesteld · versleuteld opgeslagen" : "Niet ingesteld"}</dd></div><div><dt>Verbindingsstatus</dt><dd>{({ connected: "Verbonden", failed: "Controle mislukt", revoked: "Ingetrokken", untested: "Nog niet getest" })[configuration?.status ?? "untested"]}</dd></div><div><dt>Laatste test</dt><dd>{configuration?.lastTestedAt ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" }).format(new Date(configuration.lastTestedAt)) : "Nog niet getest"}</dd></div></dl>
      <form action={saveOpenAiConfiguration} className="settings-form">
        <input type="hidden" name="revision" value={configuration?.revision ?? 0} />
        <label className="demo-field"><span>OpenAI-projectsleutel {configuration?.configured ? "vervangen (optioneel)" : "invoeren"}</span><input name="projectKey" type="password" autoComplete="new-password" maxLength={1024} /><small>De opgeslagen sleutel wordt nooit teruggestuurd. Leeg laten behoudt de bestaande sleutel.</small></label>
        <label className="demo-field"><span>Gespreksmodel</span><input name="chatModel" defaultValue={configuration?.chatModel ?? "gpt-5.4-mini"} required maxLength={120} /></label>
        <label className="demo-field"><span>Afbeeldingsmodel</span><input name="imageModel" defaultValue={configuration?.imageModel ?? "gpt-image-1.5"} required maxLength={120} /></label>
        <p>Gebruik modellen die voor dit project beschikbaar zijn. Deze versie ondersteunt afbeeldingen maken/bewerken en video-upload; geen videosynthese.</p>
        <Button variant="primary" type="submit" name="intent" value="save">Configuratie opslaan</Button>
        {configuration?.configured && <Button variant="secondary" type="submit" name="intent" value="revoke">Projectsleutel intrekken</Button>}
      </form>
      <form action={testOpenAiConfiguration}><Button variant="secondary" type="submit" disabled={!configuration?.configured}>Verbinding en modellen testen</Button></form>
      <p>Inschakelen gebeurt op <Link href="/platform/tenants">de verenigingspagina</Link> bij Productuitrol → AI-agent inschakelen. Intrekken stopt nieuwe providerverzoeken; reeds toegelaten verzoeken kunnen nog kosten veroorzaken.</p>
    </section>}
  </>;
}
