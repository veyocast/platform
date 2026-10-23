# S288 — RSS-bron naar vindbare nieuwsslide en playlist

De gebruiker vindt drie eerder verbonden RSS-feeds niet terug als slides in de
playlistmaker. Read-only productiecontrole bevestigt drie gezonde RSS-bronnen
met ieder 30 artikelen, maar nul gekoppelde nieuwsslides. Maak de vervolgstap
van bron naar ontwerp duidelijk en bruikbaar; behoud alle bestaande feeds.

Baseline: `87b30fa654d1361a80356e2f961b93f728af3560`.
Root is enige writer op `veyocast/s288-rss-playlist-flow` in
`/home/codex/repos/castivo-s288`. S287 wordt afzonderlijk gereviewd; deze taak
wijzigt geen Sportlink-selectieguard. Commit, push en normale staging-/
productiepromotie blijven door de gebruiker geautoriseerd.

## Ownership

- RSS-bronacties en bronpagina onder `dashboard/data-sources/`, bestaande
  bronpresentatie waar nodig voor een duidelijke ontwerpactie.
- Sync-create-wizard, route, serverloader, herstelstaat en types; beperkte
  RSS-selectie-invoer en de directe gekoppelde editor indien nodig om diezelfde
  opgeslagen selectie te blijven beheren. Bijbehorende unit-/browserfixtures.
- Publisher-bibliotheekfiltercontract en tests, serverloader en de bestaande
  playlist-mediakiezer: expliciet Nieuws & RSS-filter, correcte bronafbakening.
- Eén nieuwe forward-only migratie en eigen SQL/RLS-tests voor een expliciet
  opgeslagen keuze van de nieuwste artikelen. Oude configuraties behouden hun
  betekenis; geen bestaande publicatie, bron of snapshot wordt herschreven.
- Na de echte 50-seconden-RSS-export die de bestaande vijfminutengrens bereikte:
  uitsluitend `apps/media-worker/src/sync-dom-capture.tsx` en de eigen
  capturetest voor het hergebruiken van stilstaande v9-RSS-rasters na de
  voltooide entree. Eerst native pixeltegenproeven vastleggen. Alleen als
  ranglijsten niet bewegen en alle daadwerkelijke CSS-animaties zijn voltooid;
  geen timeoutverruiming, minder MP4-frames of wijziging van rendereridentiteit,
  vormgeving, tijdlijn, assets, Player of andere families.
- Na visuele controle: uitsluitend de stilstaande v9-RSS-miniatuur in
  `sync-studio-preview.tsx` op de voltooide bestaande contententree zetten.
  Bewijs de daadwerkelijke artikelopaciteit in de browser; geen gedeelde
  renderer, actieve previewtijdlijn of overige slidefamilie aanpassen.
- Gerichte werkelijke bron→ontwerp→bibliotheek→playlist-regressies en
  bewijs onder `docs/s288-rss-playlist-flow.md`, dit prompt en eigen plan- en
  ledgeraanvulling.

## Acceptatie

Een bevoegde gebruiker kan vanuit een bestaande RSS-feed een nieuwsslide
maken met die feed voorgeselecteerd. De wizard noemt expliciet hoeveel nieuwste
artikelen de slide toont, bewaart die keuze en voorkomt een te lange ronde.
Gereedstaande RSS-slides zijn onder Slides / Nieuws & RSS vindbaar en kunnen
met hun echte immutable snapshot aan een playlist worden toegevoegd. Nog niet
gereedstaande ontwerpen blijven zichtbaar met hun werkelijke status.

Bronselectie wordt server-side tenantgebonden gevalideerd. Herstelde invoer en
een oorspronkelijke pending opdracht worden nooit stilzwijgend overschreven.
Geen automatische publicatie of nieuwe productiecontent namens de gebruiker.
Lint/typecheck/unit, toepasselijke a11y/e2e en geïsoleerde DB/RLS, gevolgd door
normale CI en exacte staging-/productie-uitrol. Geen lockfile-/dependency-,
visuele renderer-, Player/offline- of historische migratiewijziging.
