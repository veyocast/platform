# Fase 10 — Player, casting en live integratieplayback

Datum: 24 augustus 2026  
Branch: `veyocast/s123-vector-v2-living-venue-os`

## Repositorywaarheid

De hosted Next.js Player, Android/Google TV-hostshell en LG-host/legacyruntime
delen al één immutable manifest-, pairing-, cache-, verify-, switch- en
last-known-good-contract. Die bestaande keten is behouden. Online integraties
krijgen geen tweede download- of playbackengine.

## Toegevoegd

- YouTube-bronnen worden capability- en featureflaggebonden aan een
  playlistconcept. Een immutable release bevriest alleen video-ID en titel;
  het verplichte tenantveilige fallbackasset doorloopt de normale checksum-
  cache en releaseverify.
- De Player gebruikt uitsluitend de officiële IFrame Player API met
  `youtube-nocookie.com`, `enablejsapi`, een expliciete origin en een begrensde
  CSP-allowlist. YouTubebytes worden nooit gedownload, getranscodeerd of in de
  Playercache opgenomen. Offline/API/autoplay-falen toont de lokale fallback.
- Engage-campagneconfiguratie wordt immutable in de release vastgelegd, maar
  opties en stemtotalen worden iedere vijf seconden via een bounded publieke
  projection opgehaald. Daardoor maakt een stem geen nieuwe slide- of
  releaseversie. De laatste projection blijft bij kort netwerkverlies staan;
  zonder projection speelt de lokale fallback.
- Live- en eindresultaten hebben een afstandsleesbare 16:9/9:16-layout en een
  lokaal gegenereerde QR naar de publieke Control-route.
- Pairing toont naast de tijdelijke tekstcode een lokale QR/deeplink. De QR
  bevat uitsluitend de tijdelijke publieke code; nooit device-, installatie-
  of Supabasecredentials. Control behoudt de code door de guided screenflow.
- Dynamic-latest autoreleases dragen de reeds immutable Engage-/YouTube-
  releasebinding vooruit zonder mutable providerrecords opnieuw te lezen.

## Security- en continuïteitscontract

Beide nieuwe playlistcommands zijn idempotent, revision-guarded,
tenantgescopeerd, featureflaggebonden en server-side capability-gated. De
releasekolommen zijn append-only via de bestaande immutable triggers.
Provider/runtimecontent telt niet mee als cacheable asset; alleen de lokale
fallback telt mee in bytes, opslagpreflight en atomische activatie. Bestaande
LG Legacy-clients lezen de onbekende online metadata niet en spelen daardoor
veilig de normale fallback.

`qrcode@1.5.4` en de bestaande types worden nu ook server-only door de Player
gebruikt. De versie en transitive packages stonden al in de workspace-lockfile
voor Control; er is geen nieuwe packageversie geïntroduceerd. De package is MIT
en belandt niet in het Player-clientbundle.

## Bewijs

| Gate | Resultaat |
|---|---|
| verse `pnpm db:reset` | groen; beide Playerbindingmigraties toegepast |
| volledige `pnpm test:rls` | 58 bestanden, 1.198 assertions, PASS |
| S123 Engage/YouTube pgTAP | 38/38 |
| Contracts | 46/46 |
| Player lint/typecheck/unit | groen, 158/158 |
| Control lint/typecheck/unit | groen, 185/185 |
| Player production build | groen; secret- en webOS6-guards groen |
| Control production build | groen; auth- en secretguards groen |
| Engage/YouTube Player E2E | 2/2, inclusief offline projection en CSP |
| Pairing QR + compacte TV-layout | 3/3 |
| Player offline | 7/7 |
| Volledige Player-run | 93/95 onder gelijktijdige builddruk; twee bestaande timingchecks geïsoleerd 2/2 groen |

De brede run faalde eenmaal op een first-frame-zichtbaarheidstiming en een
pairing-refreshcount terwijl zware builds parallel draaiden. Dezelfde twee
tests zijn direct daarna serieel, één worker, zonder retry 2/2 groen. Dit is als
runnerdruk geclassificeerd; de betrokken bronpaden zijn door deze fase niet
gewijzigd.

## Externe gates

- YouTube Data API-productiesleutel, quota-eigenaar en tenantcohort:
  productowner/integration owner. Zonder sleutel blijft de flag uit en wordt
  geen productionclaim gedaan.
- Fysieke LG, Android TV/Google TV, D-pad/touch en mixed-media soak:
  Player release owner volgens de bestaande hardwareprotocollen.
