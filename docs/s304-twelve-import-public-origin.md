# S304 — Twelve-import blijft op de publieke Control-origin

Tijdens INT02 B op staging gaf de normale ontvangstcontrole voor een al toegepaste
Twelve-import op 10 november 2026 om 04:05:10 UTC een geldige HTTP303 met
`Location: https://0.0.0.0:3000/dashboard/sources/twelve/products?succes=geimporteerd`.
De browser had `https://staging-control.veyocast.nl` moeten behouden. De import was
al toegepast; de ontvangstcontrole startte haar writer niet opnieuw. Het private,
geschoonde diagnosebewijs heeft SHA256
`5fc6d73bc412b59c11a2900d296ec042f51a528f411b6ae60665c992c02c3fe1`.

De onderzochte main is `a46c56f67195353e90f41320854c0dba30daa72f`. De helper
`go()` in `apps/control/app/api/products/import/[importId]/route.ts` bouwde elk
redirectdoel met `new URL(path, request.url)`. Achter de reverse proxy bevatte
`request.url` de containerhost. Daardoor kon een geslaagde, reeds duurzame import
als een navigatiefout eindigen. Dezelfde helper bediende mapping-, ontvangst- en
foutuitkomsten.

De route retourneert nu HTTP303 met een relatieve `Location` voor precies dezelfde
vaste interne paden en gevalideerde import-UUID. De browser lost die op tegen de
publieke aanvraag-URL. Er wordt geen origin uit proxyheaders afgeleid. De bestaande
Origin/Host/protocolcontrole, inhoudslimiet, live sessie, actieve tenant,
schrijfbevoegdheid, resourcecontrole, formulieridentiteit en RPC-/replaylogica
blijven behouden. Een al toegepaste import geeft alleen haar bestaande ontvangst
terug; een onzekere writeruitkomst wordt nog steeds eerst opnieuw gelezen.

De nieuwe tests zijn eerst op de oude bron uitgevoerd: 18 cases, 9 geslaagd en
9 rood. Alle negen rode gevallen toonden de interne container-origin. Na de fix
slagen alle 18 routecases en de vier bestaande uploadroutecases: 22/22, zonder
skips. Ze controleren mapping en toepassen, een al toegepaste ontvangst zonder
writerherhaling, herstel van een verloren ontvangst, status-/RPC-fouten, gewone
publieke aanvragen en aanvragen met een interne `request.url`. Vreemde Origin,
ontbrekende Origin, verkeerde Host, protocolverlaging en ongeldige route-UUID
blijven afgewezen. Forwarded-host/protocolvelden veranderen geen beslissing of
doel. Revalidatie en aantallen/argumenten van bestaande RPC-calls worden bewaakt.

Lokale rapporten: `/tmp/s304-import-public-origin-red.json` en
`/tmp/s304-import-public-origin-green-final.json`. De gerichte ESLintcontrole is groen;
de volledige Control-typecheck (`tsc --noEmit --incremental false`) is ook groen.
De normale workspacegates zijn groen: lint en typecheck elk30/30 (29cache),
test30/30 (28cache),19,753s. De eerste testuitvoering miste alleen het
getrackte, lokaal sparse ontbrekende immutable Content.tsx-referentiebestand;
die oorspronkelijke Gitblob is hashgelijk met beide bronmanifesten hersteld,
zonder test- of indexwijziging. Het oorspronkelijke rode rapport blijft bewaard.
De volledige normale CI-/buildgates volgen op de PR. Er zijn geen SQL-, dependency-, release-, Player-,
Worker-, workflow- of klantbindingswijzigingen.

De tests roepen de echte route en NextResponse aan met begrensde sessie-/database-
fixtures. Ze bewijzen de response- en beveiligingsgrens; de werkelijke normale
Control-navigatie achter de stagingproxy moet na uitrol op de nieuwe SHA opnieuw
worden geobserveerd. De reeds toegepaste B-import en haar eerdere onzekere
browserontvangst worden eerst met echte read-only ontvangstgegevens verzoend.
Een nieuwe import of herhaalde writer is geen herstelstap. Staging en productie
volgen de bestaande volledige releasegates; deze bronfix is geen deploymentbewijs.
