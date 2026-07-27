# S49 premium Control-dashboard

## Resultaat

Control gebruikt nu een rustigere taakhiërarchie zonder de bestaande
beheerfunctionaliteit te verwijderen:

- de primaire werkplek staat vóór inklapbaar beheer en Support;
- het accountoppervlak bevat expliciete profiel-, weergave- en uitlogacties;
- Overzicht toont één globale Nieuw-actie en maakt de actieve publicaties eerder
  zichtbaar;
- Media en Schermen openen direct als compacte resourcewerkplek;
- Team gebruikt afzonderlijke tabs en dialogs voor uitnodigen en risicovolle
  acties;
- Instellingen toont één categorie tegelijk;
- Support maakt de ticketlijst primair en opent een nieuw ticket in een dialog;
- Studio toont handmatig opslaan alleen wanneer de inhoud niet al opgeslagen
  is.

De mobiele bottom navigation blijft beperkt tot Home, Schermen, Playlists,
Media en Meer. De Meer-sheet herhaalt deze primaire bestemmingen niet.

## Responsieve visuele controle

De live lokale Control-runtime is iteratief vastgelegd, bekeken en bijgesteld.
Daarbij zijn onder andere afgekapt tellen, verticale uitlijning, compacte
toolbarhoogte en animatiesettling gecorrigeerd.

| Oppervlak | Desktop | Mobiel |
|---|---|---|
| Overzicht | [1440 × 900](./screenshots/s49-dashboard-desktop.png) | [390 × 844](./screenshots/s49-dashboard-mobile.png) |
| Media | [1440 × 900](./screenshots/s49-media-desktop.png) | [390 × 844](./screenshots/s49-media-mobile.png) |
| Schermen | [1440 × 900](./screenshots/s49-screens-desktop.png) | [390 × 844](./screenshots/s49-screens-mobile.png) |
| Support | [1440 × 900](./screenshots/s49-support-desktop.png) | [390 × 844](./screenshots/s49-support-mobile.png) |

Aanvullend zijn [Instellingen op desktop](./screenshots/s49-settings-desktop.png),
[Team op mobiel](./screenshots/s49-team-mobile.png) en
[dark/compact Overzicht](./screenshots/s49-dashboard-dark-compact.png)
vastgelegd.

De automatische viewportmatrix controleert Overzicht, Media, Schermen,
Instellingen, Team en Support op 320, 390, 768, 1024, 1280, 1440 en 1920 px.
Geen van deze canonieke combinaties heeft horizontale documentoverflow.

## Verificatie

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- 29 seriële Chromium-a11ychecks
- gerichte Control-, Pilot- en marketing-E2E-regressies
- live visuele screenshotset en canonieke overflowmatrix
- statische GitHub Actions-, shell- en productiondispatchvalidatie

Er zijn geen dependencies, lockfiles, databaseobjecten, RLS-policies,
playerstorage of immutable releases gewijzigd.

## Releasegrens

Een push naar `main` deployt uitsluitend staging. Production kan alleen starten
via een handmatige workflowdispatch met de expliciete keuze
`deploy_target=production`; de geverifieerde stagingrelease blijft daarbij de
enige promotiebron.
