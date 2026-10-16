# S225 — LG blijft na een videofout op oude inhoud staan

## Vastgestelde oorzaak

Productie en de fysieke LG draaiden bij de controle op 16 oktober 2026
49c916cc. De Android-apparaten bevestigden de actuele release. De LG meldde
LEGACY_VIDEO_ERROR, native media code 4, readyState 0, networkState 3 na zowel
de Blob- als de lokale cacheroute. Dit is een afspeelweigering; de precieze
model-/codec-/transportroute is daarmee nog niet vastgesteld.

De actuele gewenste release d18fff37 bevat uitsluitend afbeelding Droog.
De LG bevestigde assetsReadyAt om 16:31:12 UTC, zonder preparationError of
corrupte/mislukte downloads. boundaryAt en firstFrameAt bleven leeg. De laatst
bevestigde release bleef e0c35318 en de fout verwees nog naar de eerdere video.
Dit bewijst geen fout bij het afspelen van Droog: dat afspelen was niet gestart.

Na terminale videoweigering kan restoreVideoFallback geen andere geschikte
vorige release vinden. De laatst geschilderde menuafbeelding blijft dan staan,
maar alle itemtimers en decoder-events zijn al verwijderd. queuePreparedRelease
plaatste een volledig voorbereide nieuwe release achter een itemgrens die niet
meer kon komen. Een echte browserregressie reproduceerde dit vóór herstel: vier
geweigerde videopogingen, de nieuwe afbeelding switch_pending, geen nieuwe ack.

## Herstel en grenzen

Een nieuwe volledig geverifieerde kandidaat krijgt op die mislukte afspeelgrens
een uitgestelde overgang wanneer de huidige itempoging aantoonbaar faalde en
er geen pending element, itemtimer, decoderbewaking of bewaarde itemtijd is.
De bestaande schedulePlaybackAdvance bewaart ook de pauzeregel: bij een actieve
goal-overlay begint de overgang pas na hervatten. Een tweede eerst rode proef
bewijst dat ook na zo'n overlay geen eindeloze wachttoestand overblijft.

Gezonde video behoudt zijn echte ended-/trimgrens. Compositiezones behouden hun
eigen grenscoördinatie. Assetverificatie, generatiecontrole, atomair opslaan,
vorige release, zichtbare framebevestiging en offline herstel blijven in dezelfde
bestaande functies. Er zijn geen schema-, dependency-, credential-, merkasset-,
provider-, playlist- of mediaveranderingen.

De videoweigering wordt afzonderlijk onderzocht. Een oude opgeslagen LG-probe
van 20 september is geen actuele meting. De begrensde geaudite diagnoseopdracht
van 16 oktober om 21:13 UTC werd voor uitsluitend het gekoppelde LG-device
gequeue'd met vijf minuten geldigheid. Het device meldde bij de eerste
nacontrole sinds 21:00 UTC geen nieuw contact; aflevering bleef tot de vervaltijd onbevestigd.
De gebruiker bevestigde dat het scherm aan staat; handmatige diagnose is gevraagd.

## Validatie en uitrol

De oorspronkelijke foutproef is rood op de gedeployde bronboom. De extra
overlayproef is rood op de eerste directe overgang en verifieert het correcte
uitgestelde herstel. De definitieve browsertests toetsen nieuwe afbeelding,
herstelbevestiging, offline cold start, gezonde videogrens en overlayhervatting.
De definitieve lokale foundationgates lint/typecheck/unit slagen elk met 30/30
taken. De Player-productiebuild inclusief secret-/webOS-bundleguards slaagt.
Alle 39 gerichte Player-/offline-/a11yproeven zijn groen, inclusief de drie
nieuwe regressies. De exacte volledige CI en beschermde uitrol volgen. Geen fysieke videoreparatie of geslaagde
publicatiewissel claimen zonder actuele bevestiging van de LG.

Rollback is een gewone applicatie-uitrol naar de vorige bronrevisie. Geen
migratie of cachewissen nodig; lokaal geverifieerde actieve/vorige inhoud blijft
behouden.
