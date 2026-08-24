# Fase 7 — Publisher, planning, preflight en releases

Datum: 24 augustus 2026  
Status: `DONE`

## Audit en root cause

De bestaande Publisher-backend was geen prototype. Hij bevatte al revision-
guarded conceptmutaties, duurzame idempotencyreceipts, immutable releases,
lossless authoringsnapshots, append-only assignments, tenant-RLS,
planningconflictanalyse en afzonderlijke Playerfasen voor desired, download,
verify, switch en active. Die architectuur is behouden.

Twee concrete gaten zijn bij de bron gesloten:

1. De zogenaamde begeleide publicatie was één lange pagina met vijf tegelijk
   zichtbare secties en een ankerbalk. Daardoor bleef target-/risico-impact niet
   in beeld en functioneerde de flow niet als de repositorybrede Journey Shell.
2. Releasevergelijking gebruikte wel immutable release-items, maar vergeleek
   alleen asset, checksum, duur, fit, mute, bestandsgrootte en positie. Een
   wijziging in overgang, crop, achtergrond, label, enabled-state, trim,
   volume of zichtvenster verscheen ten onrechte niet in de diff.

## Opgeleverd

- Guided publish gebruikt nu de gedeelde `JourneyShell` als echte vijfstapsflow:
  readiness → playerpreview → targets → per-screen preflight → bevestigen.
- Een vaste impactkolom toont voortdurend releaseversie, item-/duur-/byteimpact,
  geselecteerde targets en de last-known-good-garantie.
- Targetselectie is client-side hervatbaar tijdens de flow; de definitieve
  serveraction valideert tenant, capability, revision, readiness, targets,
  preflight en risicobevestiging opnieuw.
- Een geblokkeerd target kan niet naar bevestiging; warning/unknown vereist een
  expliciete, server-side gecontroleerde keuze.
- Release Center vergelijkt nu het volledige immutable presentatiecontract:
  asset/hash/size, duur, fit, mute, overgang, crop, achtergrond, displaylabel,
  enabled-state, trim, volume en zichtbaarheidsvenster.
- De bestaande planning-, rollback-as-draft-, reassignment-, audit- en
  syncimplementaties bleken contractconform en zijn niet vervangen.

## Behouden contracten

- Publicatie blijft één transactionele `publish_playlist_to_targets_v3`-actie
  met revisionguard en duurzame idempotency; retries maken geen dubbele versie.
- Een release, release-item en authoringsnapshot blijven immutable. Herstel
  bouwt een nieuw concept en muteert geen historie.
- Reassignment/rollback muteert geen release en schrijft append-only
  deploymenthistorie.
- De Player houdt current/LKG actief totdat alle pending assets zijn
  gedownload en geverifieerd en wisselt alleen op een veilige loopgrens.
- Stale of ontbrekende heartbeat geldt nooit als bewijs voor compatibiliteit,
  cache of opslag. `unknown` blijft zichtbaar en vraagt bewuste bevestiging.
- Alle reads en commands blijven tenant-scoped; permissions worden server-side
  én in RLS/RPC-ACL's afgedwongen.

## Bewijs

| Gate | Resultaat |
|---|---|
| `pnpm lint` | 30/30 taken groen |
| `pnpm typecheck` | 30/30 taken groen |
| `pnpm test` | 30/30 taken groen; Domain 42, Control 182 en Player 153 tests |
| `pnpm build` | 18/18 taken groen; Control auth-/secretbundleguards groen |
| `pnpm test:rls` | 57 bestanden, 1.160 assertions groen |
| Release compare unit | 7/7 groen, inclusief volledig presentatiecontract |
| Guided publish live E2E | 1/1 groen tegen lokale Supabase: upload, concept, vijf stappen, unknown-bevestiging, immutable release en `Huidig gewenst` |
| Planning timezone/DST | 12/12 gerichte Control-tests groen |
| Player LKG/loop boundary | Player unit 153/153; bestaande browsercontracten blijven onderdeel van fase 13 |

De bredere bestaande `playlist-studio-live.spec.ts` bereikte in deze lokale
developmentrun zijn historische concurrencyklik niet binnen de eigen totale
90-secondenlimiet. Die run stopte vóór de gewijzigde publicatieflow en is niet
als productfailure geclassificeerd. De nieuwe afgebakende live regressiontest
test exact de gewijzigde flow en is groen; de brede suite wordt in fase 13 op
de production-buildharness opnieuw uitgevoerd.

## Vervolgpoort

De volledige routebrede screenshotmatrix, alle Player-browser/offline suites en
de fysieke loop-boundary/LG-soak blijven bewust onderdeel van de cross-cutting
fase 13. Er is geen implementatieplaceholder of tweede publicatiepad toegevoegd.
