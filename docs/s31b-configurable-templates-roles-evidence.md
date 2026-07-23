# S31-B Bewerkbare templates, custom rollen en enterprise density

**Branch:** `veyocast/s31b-configurable-templates-roles`
**Basis:** `7e82b2c`
**Datum:** 24 juli 2026

## Geleverde uitkomst

- Tenanttemplates kunnen worden hernoemd, beschreven en opnieuw aan een
  bestaande playlistdraft worden gekoppeld.
- `Inhoud aanpassen` opent dezelfde Playlist Studio als normale authoring.
  Daarna maakt `Template bijwerken` atomair een nieuwe veilige snapshot van
  metadata, items, secties en presentatie-instellingen.
- Een template-update gebruikt een revision guard en neemt nooit releasehistorie
  of schermtoewijzingen over.
- Een tenanteigenaar kan custom rollen maken, wijzigen, archiveren en aan
  bestaande of uitgenodigde teamleden toewijzen.
- Custom rollen configureren werkrechten voor content, publiceren, schermen,
  instellingen, activiteit en supportexport. Effectieve capabilities worden
  server-side geladen en niet uit clientstate afgeleid.
- Eigenaarschap, team-/rollenbeheer, platformrechten en self-lockout blijven
  bewust niet delegeerbaar.
- Control gebruikt compactere enterprise-oppervlakken, een vaste
  typehiërarchie en éénregelige resource-identiteiten waar de beschikbare
  ruimte dat toelaat.
- Formulierrijen hebben nu één meetbaar raster: labels en controls starten
  binnen 1 px gelijk, normale controls zijn 44 px hoog en vullen hun kolom.
- Top-level werkvlakken gebruiken 20 px binnenruimte op desktop en 16 px op
  mobiel. De scherm-onboarding volgt nu dezelfde geometrie.
- Filtercontrols zijn 40 px op desktop en 44 px op mobiel. De
  instellingencategorienavigatie is exact 50 px hoog en deelt dezelfde
  linkerzijde en breedte als de instellingenkolom.

## Autorisatie- en datamodel

`tenant_custom_roles` is tenantgebonden, geïndexeerd en force-RLS. Memberships
en invitations verwijzen via samengestelde tenant-foreign keys naar een custom
rol. Een custom rol gebruikt daarnaast een begrensde standaardrol als
databasebaseline; de werkelijke applicatieautorisatie komt uit de server-side
effectieve capabilityset.

Iedere actieve tenantgebruiker behoudt de bestaande gedeelde leesbaseline.
Een eigenaar kiest daarbovenop welke mutaties een custom rol mag uitvoeren:

| Keuze in Control | Effectieve capabilities |
|---|---|
| Content bewerken | media schrijven, playlistconcepten schrijven en archiveren |
| Publiceren | immutable releases publiceren en actieve toewijzingen wijzigen |
| Schermen beheren | schermen koppelen, configureren en lifecycleacties uitvoeren |
| Instellingen beheren | tenant- en playerstandaarden wijzigen |
| Activiteit bekijken | tenantbrede auditactiviteit lezen |
| Supportbundel exporteren | privacyveilige supportexport maken |

Content en playlistauthoring zijn één keuze omdat upload, bronmedia en
playlistconcepten in het huidige datamodel één autorisatiegrens delen.
Planning volgt vooralsnog playlistauthoring. Een afzonderlijke
planningcapability blijft een latere, expliciete contractmigratie.

## Templates

De geleverde templates zijn bewerkbare playlistblauwdrukken. Ze gebruiken de
bestaande Player-compatibele draftstructuur en introduceren geen tweede
renderpad. Vrij invulbare tekst-, kleur- en beeldzones zijn hiermee niet
stilzwijgend toegevoegd; daarvoor blijft een versieerbaar gedeeld
Control/manifest/Player-templatecontract nodig.

## Offline en voorkeuren

- Player, service worker, last-known-good en offline playback zijn niet
  gewijzigd.
- De bestaande begrensde Studio-herstel- en uploadresume blijven ongewijzigd;
  er is geen algemene offline mutatiequeue toegevoegd.
- Thema, dichtheid, kolommen en opgeslagen views blijven persoonlijke lokale
  voorkeuren. Er is geen nieuwe profieltracking of serversynchronisatie
  geïntroduceerd.

## Visuele evidence

De screenshots zijn gemaakt tegen de lokale Supabase-pilotseed en de echte
tenantrolpagina. De run maakt uitsluitend voor bewijs een
`Contentcoördinator`-rol met content- en publicatierechten.

- `docs/screenshots/s31b-team-roles-desktop.png` — 1440 × 1000;
- `docs/screenshots/s31b-team-roles-mobile.png` — 390 × 844;
- `docs/screenshots/s31b-team-invite-mobile.png` — mobiel uitnodigingsformulier;
- `docs/screenshots/s31b-templates-desktop.png` — 1440 × 1000;
- `docs/screenshots/s31b-templates-mobile.png` — 390 × 844;
- `docs/screenshots/s31b-settings-desktop.png` — 1440 × 1000;
- `docs/screenshots/s31b-settings-mobile.png` — 390 × 844;
- `docs/screenshots/s31b-screen-onboarding-desktop.png` — 1440 × 1000;
- `docs/screenshots/s31b-screen-onboarding-mobile.png` — 390 × 844.

## Verificatie

| Controle | Resultaat |
|---|---|
| `pnpm db:reset` | groen; alle migraties en seed opnieuw opgebouwd |
| `pnpm test:rls` | groen; 31 bestanden en 536 assertions |
| Control lint/typecheck/unit | groen; 16 testbestanden en 74 tests |
| Auth lint/unit | groen; 9 tests |
| `pnpm lint` | groen; 20/20 taken |
| `pnpm typecheck` | groen; 20/20 taken |
| `pnpm test` | groen; 20/20 taken |
| `pnpm build` | groen; 13/13 workspacebuilds |
| Control a11y serial | groen; 21/21 shell-, responsive- en geometrische tests |
| Control E2E serial | groen; 6/6 shelljourneys |
| Control visual evidence | groen; Team, Templates, Instellingen en Scherm toevoegen op desktop en mobiel met echte lokale tenantdata |
| Canonical dashboardgeometrie | groen; veldtop, controlhoogte, controlbreedte, panelpadding en instellingenbalk gemeten |
| Control CSS-tokenaudit | groen; geen ongedefinieerde Control-tokens |

## Bewuste grenzen

- Custom rollen beheren alleen werkrechten. De gedeelde tenantleesbaseline is
  in deze iteratie niet per resource uitzetbaar.
- Alleen een tenanteigenaar beheert custom rollen; custom rollen kunnen zichzelf
  geen rollenbeheer of eigenaarschap geven.
- Een actieve rol met leden of open uitnodigingen kan niet worden gearchiveerd.
- Hosted migratie en deployment vallen buiten deze lokale branch.
