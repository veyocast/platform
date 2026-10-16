# S224 — Lokale videoroutes en herstel op LG

S223 staat op staging en productie als 156bbdc. Alle dertien CI-controles,
uitrolstappen en vijf healthroutes zijn groen. De echte LG bevestigde het
force-syncverzoek 2026-10-16T00:09:01.673116+00:00 exact en het verzoek werd
gewist. De gekoppelde LG meldde daarna LEGACY_VIDEO_ERROR voor Narrow;
firstFrameAt bleef leeg. Een gedownloade video is daarmee geen bewezen
werkende videodecoder of zichtbaar nieuwe inhoud.

De bestaande legacylaag zette ook video op opacity:0 en visibility:hidden
terwijl de decoder moest starten. De nieuwe videolaag krijgt een echt
paint-oppervlak onder de laatst zichtbare laag. De bestaande zichtbare laag
blijft erboven tot de nieuwe video zijn frame bevestigt. Video krijgt geen
opacitytransitie. De mediagroep heeft een eigen stacking context, zodat een
opstart- of herstelmelding zichtbaar boven de paintbare decoder blijft. Een
eerst falende hit-test bewijst dat de melding werkelijk zichtbaar moet zijn;
alleen een positieve DOM-rechthoek was hiervoor onvoldoende. LG noemt volledige transparantie als beperking bij het bepalen
van het video-oppervlak in de [officiële TV-FAQ](https://webostv.developer.lge.com/faq?category=faq&filter=viewall&page=4).
Dit is een gerichte compatibiliteitsmaatregel; de FAQ bewijst niet het exacte
Signage-model of de oorspronkelijke fysieke foutoorzaak.

Wanneer een Blob-video wordt geweigerd, kan dezelfde volledig geverifieerde
asset via de bestaande lokale service-worker-Rangecache worden afgespeeld.
De controller moet van dezelfde origin en /sw.js zijn; alleen de vaste cachekey
met het gevalideerde SHA-256 wordt gebruikt. Er is geen rechtstreekse signed-URL
stream als normale playbackfallback. De optionele workerregistratie blokkeert
startup niet. Shell v4 neemt ook /lg/legacy op, zodat juist die zelfstandige
runtime na een eerste volledige online voorbereiding offline kan herstarten.
De mediacache wordt bij de shellupdate behouden. De shellcache behandelt alleen
vaste app-, merk- en fontbestanden. Bronmedia en native Range-aanvragen gaan niet
door die generieke cache; gedeeltelijke 206-antwoorden worden nooit als appbestand
opgeslagen. Twee nieuwe browserregressies waren eerst rood: een echte MP4-Range
mislukte bij cache.put en afgewezen bronbytes bleven bij een tweede fetch uit de
shellcache terugkomen. Deze scheiding voorkomt beide oorzaken en laat de bestaande
checksumcontrole, mediacache en publicatiegrenzen hun werk doen.

Als beide lokale transportroutes falen, worden de vorige opgeslagen release en
alle vereiste bytes opnieuw gecontroleerd. Een andere afspeelbare video of
ander lokaal item blijft als last-known-good beschikbaar; dezelfde afgewezen
videochecksum wordt bij die terugval overgeslagen. De lokale stores worden
hiervoor niet geroteerd of gewist. Bij nieuwe publicaties roteert alleen een
bevestigd weergegeven release naar de vorige store; meerdere geweigerde
kandidaten kunnen de werkende vorige release daardoor niet overschrijven.
Bij een compositie moet ook de volledige compositie-identiteit overeenkomen.
Een falende childzone meldt zich bij de compositie en leest nooit zelfstandig
de vorige volledige schermrelease. De gewenste publicatie blijft afzonderlijk
bewaard. Herpogingen lopen terug van 30 seconden tot maximaal vijf minuten;
een expliciet sync-verzoek omzeilt die wachttijd. Zonder geschikte vorige inhoud
blijft een herstelbare status zichtbaar. Native media-, ready- en netwerkcodes
worden begrensd gerapporteerd, zonder URLs of stacktraces.

Een geautoriseerde, vervallende RELOAD_PLAYER-opdracht kan uitsluitend met de
vaste payloadview video-diagnostics de bestaande /lg/probe openen. Die keert
na de diagnose of uiterlijk twee minuten terug naar /lg/legacy en behoudt de
koppeling. De heartbeat bewaart alleen een code, datum en maximaal acht vaste
checkstatussen. User-agent, URLs, namen en vrije fouttekst worden niet in dat
rapport opgeslagen. De oorspronkelijke handmatig geopende probe blijft werken.

De beschermde main-only workflow probe-player-video controleert daarnaast één
video in de actuele gewenste release van één gekoppeld scherm. Zij draait in
de exact gedeployde gezonde worker, verifieert tenant, scherm, asset, release,
Storagepad, bytebudget en checksum en rapporteert alleen genormaliseerde
FFprobe-/MP4-metadata. Credentials, bestanden, paden en signed URLs verlaten die
worker niet. Een gewijzigde toewijzing tijdens de proef wordt apart geweigerd.
De workflow wijzigt geen playlist, asset, verwerkingstaak of providerdata.

Validatie: workspace lint/typecheck/unit elk30/30 taken, Player-productiebuild
inclusief bundle-/webOS-controles, workflowvalidatie met Actionlint/ShellCheck en
88 groene browser-/offline-/LG-/a11yproeven op die build. Hieronder vallen echte
browservideoproeven voor paintbaarheid en Blob-weigering, lokale Rangeweergave,
offline cold start, blijvende vorige inhoud, geforceerde retry en begrensde
operator-/probegegevens. De actieve-media- en zone-selectors sluiten uitfaderende vorige
lagen uit, zodat hun 220 ms afbouw geen dubbele actieve zone suggereert. Een
parallelle lokale herhaling raakte geheugen-/swapdruk; de betrokken cases,
inclusief beide 100-ronden-downloadproeven, slagen daarna met één worker.
De volledige exacte CI en de beschermde uitrol moeten
nog slagen voordat fysieke videoweergave als hersteld wordt gemeld. Er zijn geen
schema-, dependency-, credential- of merkassetwijzigingen. Applicatierollback
blijft mogelijk; de toegevoegde shellcache mag regulier vervangen worden terwijl
de geverifieerde mediacache intact blijft.
