# S25 Playlist Studio en publicatiegereedheid — evidence

Status: implementation review

## Geleverd contract

- `/dashboard/playlists` is een zelfstandige resourcepagina met server-side
  zoeken, status- en toewijzingsfilters, sortering, paginering en veilige
  conceptcreatie. Conceptstatus, laatste immutable release en schermtoewijzing
  blijven afzonderlijke feiten.
- `/dashboard/playlists/[playlistId]` is de Playlist Studio. Desktop gebruikt
  een mediakolom, ordelijke itemlijst en compacte inspector. Onder 1024 px wordt
  dit een sequentiële flow: items, media, preview/readiness en publiceren.
- Iedere conceptmutatie bevat `expectedRevision`. De database vergrendelt de
  playlistrow, vergelijkt de actuele revisie en voert bij een conflict nul
  domeinwrites en nul auditwrites uit. Een toegepaste mutatie verhoogt de
  playlistrevisie precies eenmaal en registreert de laatste bewerker.
- Publiceren vergelijkt dezelfde revisie voordat de bestaande immutable
  releasefunctie wordt aangeroepen. Een stale publish maakt geen release en
  wijzigt geen gewenste release op een scherm.
- De editor toont een typed conflict met de eigen en actuele revisie, de laatste
  bewerker en herstelkeuzes om de nieuwste versie te laden, te vergelijken en de
  wijziging opnieuw in te voeren. Er is geen automatische of stille merge.
- Niet-opgeslagen formuliervelden activeren een `beforeunload`-waarschuwing en
  blokkeren interne navigatie totdat de gebruiker bevestigt of het formulier
  opslaat.

## Eén readinessberekening

`evaluatePlaylistReadiness` in `@veyocast/domain` is frameworkvrij en levert
`canPublish`, stabiele reason codes, herstelacties en deterministische totalen.
De Studio gebruikt dit resultaat rechtstreeks. De publish-serveractie laadt de
actuele tenantdata opnieuw en voert exact dezelfde functie uit voordat zij de
revision-aware databasecommand aanroept.

De huidige reason codes zijn:

- `PLAYLIST_ARCHIVED` en `PLAYLIST_EMPTY`;
- `ASSET_MISSING`, `ASSET_TENANT_MISMATCH`, `ASSET_NOT_READY` en
  `ASSET_KIND_UNSUPPORTED`;
- `PLAYER_VARIANT_MISSING`, `VARIANT_TENANT_MISMATCH`,
  `VARIANT_MIME_UNSUPPORTED` en `VARIANT_METADATA_INVALID`;
- `ITEM_DURATION_INVALID`, `ITEM_FIT_MODE_INVALID` en
  `TARGET_ORIENTATION_UNSUPPORTED`.

Elke code wordt in Control vertaald naar oorzaak, gevolg en een concrete
herstelactie. De databasecommandgrens blijft daarnaast tenant, capability,
schermtarget en immutable-release-integriteit afdwingen. Afbeeldingsafmetingen
zijn optioneel zolang de bestaande gevalideerde beeldpipeline ze nog niet
registreert; aanwezige ongeldige afmetingen en ontbrekende bestandsgrootte
blokkeren wel.

## Preview- en Playerpariteit

Control en Player importeren hetzelfde gevalideerde `PlayerPlaybackItem`-
contract uit `@veyocast/contracts`. Preview en manifest gebruiken daardoor
dezelfde `kind`, volgorde, duur, fit en muted-semantiek. De preview ondersteunt
16:9 en 9:16, toont de canonieke veilige zone en gebruikt alleen kortlevende
signed preview-URL's. Het blijft een authoringpreview en vervangt geen fysieke
LG-playbacktest.

## Security en dataconsistentie

- `mutate_playlist_draft_v1` en `publish_playlist_to_screens_v2` zijn alleen
  uitvoerbaar door `authenticated`; `anon` en `public` zijn ingetrokken.
- De commandfuncties gebruiken een expliciete lege `search_path` en herhalen
  server-side role- en tenantchecks.
- Cross-tenant media kan niet via de mutatiecommand aan een concept worden
  toegevoegd.
- Een viewer kan niet muteren; een editor uit een andere tenant evenmin.
- Alle releases blijven immutable en de Player offline-/activatiecode is niet
  versoepeld.

## Migratie en rollback

De forwardmigratie is additief: zij voegt `revision`, `updated_by` en één index
aan `playlists` toe, vult bestaande `updated_by`-waarden vanuit `created_by` en
installeert twee nieuwe publieke commandfuncties plus een private permission
helper. Bestaande playlists en releases worden niet herschreven of verwijderd.

Een rollback vereist eerst een applicatierollback, omdat de nieuwe Control-code
de revision-aware functies verwacht. Daarna kunnen de v2-commandfuncties,
helper en index worden verwijderd en, alleen wanneer verlies van
concurrencymetadata is geaccepteerd, de twee kolommen worden gedropt. De
immutable releasegegevens en Player-toewijzingen hoeven voor deze rollback niet
te worden aangepast.

## Responsieve en toegankelijke controle

De Studio gebruikt gelabelde formulieren, tekst plus kleur voor statussen,
toetsenbordacties voor `Naar begin`, `Omhoog`, `Omlaag` en `Naar einde`, en
fouten met oorzaak, gevolg en herstel. De live browsertest valideert bij 390 px
dat de itemflow vóór de mediakiezer staat en dat de documentbreedte niet groter
is dan de viewport. Visuele controle is uitgevoerd op 1440 × 1000 en 390 × 844.

## Verificatie

| Gate | Resultaat |
| --- | --- |
| `pnpm db:reset` | geslaagd; alle migraties vanaf nul toegepast |
| `pnpm test:rls` | geslaagd; 13 bestanden, 208 tests |
| Supabase DB lint | geslaagd; geen schemafouten |
| `pnpm lint`, `pnpm typecheck`, `pnpm test` | geslaagd; 18 Turbo-taken per gate |
| `pnpm build` | geslaagd; 12 workspace-projecten, Studio-route dynamisch |
| `pnpm test:a11y` | geslaagd; 17 tests |
| volledige Chromium E2E | geslaagd; 45 tests, 2 expliciete live skips |
| live S25 E2E | geslaagd; echte upload, twee contexts, conflict, dirty state, preview, mobiele reflow en immutable publish |
| Player en offline | geslaagd; 19 Player- en 7 offline-tests |
| `git diff --check` | geslaagd |

## Expliciete restscope

- S25 doet geen field-level conflictmerge. De veilige herstelroute is nieuwste
  revisie laden en de bedoelde wijziging bewust opnieuw toepassen.
- Releasehistorie, diff, impactanalyse en uitgebreide schermpreflight horen bij
  S26; Playlist Studio toont alleen de noodzakelijke publicatiesamenvatting.
- Resumable upload en uitgebreide media-processingherstel-UX blijven S24-scope
  en kunnen onafhankelijk met deze Studio worden geïntegreerd.
- Oriëntatie genereert geen automatische crops of aparte varianten; de preview
  laat `contain` en `cover` tegen beide canonieke schermvormen beoordelen.
- Fysieke LG webOS-validatie en de 24-uurs mixed-media soak blijven releasegates
  in S30 en zijn niet door browserbewijs vervangen.
