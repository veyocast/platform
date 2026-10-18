# S228 — Native video op LG

Op 18 oktober meldt de fysieke LG 20729be3. Afbeelding Droog is bevestigd als
actieve release d18fff37; de gewenste publicatie 4fa5c016 bevat Narrowdp916.
Alle 17.245.484 bytes zijn geverifieerd en de itemgrens is bereikt, maar een
videoframe ontbreekt. De native decoder geeft code 4 na Blob én cache-HTTP.

De beschermde read-only workerprobe (run 39136784480) bevestigt SHA-256, MP4,
H.264 Main level 4.0, yuv420p, 1080×1920, 30 fps, 40 s, fast-start, geen audio.
De vervallende, operationeel geaudite diagnoseopdracht d5985dbc is ontvangen en
voltooid. Het nieuwe fysieke rapport van 14:38:36 UTC bevestigt referentie en
rechtstreekse actuele video, maar weigert zowel Blob als serviceworker-cache.
Het is dus een gemeten verschil in native transport, geen mislukte download of
bewijs dat het bestand opnieuw moet worden gecomprimeerd.

De runtime probeert eerst dezelfde twee lokale routes. Pas na weigering volgt
één native HTTP-poging met exact de bron uit het device-geautoriseerde manifest.
De volledige checksum-/sizecontrole en atomische voorbereiding blijven vóór
iedere activatie staan. Er wordt geen providerdata opgehaald, extra bron gekozen
of credential toegevoegd. HTTPS (of dezelfde lokale testorigin), geen URL-userinfo,
generatiecontrole en de bestaande eerste-framebevestiging blijven verplicht.
Een verlopen/geweigerde bron volgt het bestaande eindige retry-/refreshpad.
Deze transportuitzondering vervangt de uitsluitend lokale fallbackkeuze uit S224
op basis van de nu werkelijk gemeten firmwarebeperking.

Een geslaagde native HTTP-framebevestiging markeert uitsluitend lokale
cachemetadata als netwerkafhankelijk. De immutable release wordt niet gewijzigd.
Zo'n release roteert nooit over de vorige lokaal werkende release heen. Bij
netwerkverlies wordt direct de vorige geverifieerde inhoud geladen; ook bij
herstart blijven beide lokale stores en de cache intact. Op deze firmware is
videoweergave zonder internet hiermee niet bewezen: de lokale vorige afbeelding
of menukaart blijft de offline terugval. Op apparaten die lokale video wel
afspelen blijft die route de voorkeursroute en werkt offline video zoals eerder.

De browserregressie voor twee geweigerde lokale routes is eerst rood op de
productiebron. Tests dekken werkelijk voortschrijdende native HTTP-video,
framebevestiging, netwerkverlies en offline cold start, naast bestaande gezonde
video-, overlay-, nieuwe afbeelding- en lokale Rangegevallen. De definitieve lokale lint/typecheck/unit-gates slagen elk met 30/30 taken.
De Player-productiebuild inclusief secret-/webOS-bundleguards slaagt. Alle 43
gerichte browser-, offline- en a11yproeven op die productiebuild zijn groen,
inclusief de twee nieuwe native transport-/retentieregressies. Volledige CI
en de beschermde uitrol volgen via de PR; fysieke ontvangst en framebevestiging
worden daarna afzonderlijk gecontroleerd. Rollback is een gewone
applicatie-uitrol; geen datamigratie, cachewissen of opnieuw koppelen nodig.
