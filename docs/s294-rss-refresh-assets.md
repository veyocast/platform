# S294 — Originele media behouden bij Source-refresh

De langdurige S292-stagingcanary op `4d3fa168…` bevestigde een ontbrekende
grens in de eerdere tests. De eerste workerdescriptor bevatte de echte media,
maar vanaf datarevisie 2 gebruikte de Player een andere assetcollector. Die
verzamelde merk-/Sportlink-assets en geen RSS-artikelfoto's, QR's of bronlogo.
Op revisie 4 bevat de canonieke selectie drie artikelen, twee beschikbare
hero's, drie QR-assets en een bronlogo; de werkelijke Player-payload bevatte
nul Source-assets en geen verrijkte foto's/bronlogo's. De inhoudshash verbindt
de read-only databasecontrole met het opgeslagen manifest. Het geanonimiseerde
bewijs staat in `implementation/s294-rss-refresh-assets/canary-before.json`.

De bestaande begrensde canonical-assetcollector is bytegelijk verplaatst naar
een pure gedeelde module. De bestaande canonieke Player-payload en de actuele Source-projectie gebruiken
daardoor dezelfde regels voor RSS, menu-/productbeelden, merk en Sportlink. Bestaande
exports en imports van de collector blijven beschikbaar. Tenant-/provider-
autorisatie en checksumgebonden originele delivery blijven op dezelfde
servergrens. Een onvolledige lookup voor een expliciet genoemde actuele
bronasset wijst de kandidaat af: geen stilzwijgend uitgeklede presentatie.
De Player behoudt dan zijn geldige lokale uitzending.

Dit verandert geen renderer, huisstijl, database, publicatie, bronacquisitie,
lease, dependency of binaire generatie. Nieuwe media worden voorbereid vóór
de natuurlijke wissel. Gelijke checksums blijven dezelfde cache-identiteit
houden bij een vernieuwde signed URL. Een ontbrekende optionele foto heeft
geen asset-ID en blijft toegestaan.

Vier regressies doorlopen de echte descriptor→actuele manifestprojectie→
cachevoorbereiding met gecontroleerde database-/Storage-transportfixtures:
beschikbare foto/QR/bronlogo behouden, echte nieuwe foto, signed-URL-hergebruik,
afwijzing van een mislukte lookup en de geldige 50-artikelen/101-assetsgrens.
Alle vier falen vóór herstel. Daarna zijn zij en de veertien bestaande
Source-/legacyfallbackgevallen groen. Een extra browsergeval gebruikt de
werkelijke collector en projector, echte originele afbeeldingsbytes, nieuwe
data, URL-vernieuwing en offline reload. Een rechtstreeks met beelden verrijkte
browserfixture alleen had de oorspronkelijke fout niet gevonden.

De eerste runnerpoging had een fout fixture-importpad; de packageboundarygate
wees vervolgens de rechtstreekse cross-app testimport terecht af. De gedeelde
transportfixture staat nu volgens het bestaande patroon onder `tests/helpers`;
de boundarygate is ongewijzigd. De eerste browserfixture gebruikte een CJS-incompatibel import.meta en daarna
een seed met rijke bronfeiten; beide fixtures zijn hersteld met behoud van de
strikte contracts. Een TypeScript-testnarrowing en relatieve
type-import zijn hersteld. De laatste workspace lint/typecheck/unit zijn elk
30/30 groen. De Player-productiebuild en eigen runnerlint zijn groen. Het nieuwe browsergeval
slaagt in 12,1 s zonder retry: één descriptordownload, één nieuw mediaverzoek,
geen extra media-/fontloads bij URL-vernieuwing en werkende offline reload.
Een echte nieuwe afbeelding doorloopt de volledige voorbereiding: de lokale
FontFace.load-teller gaat daarbij van 6 naar 12; dit wordt niet als nul fontwerk
of netwerkdownloadwinst bij nieuwe media gepresenteerd. De bestaande test voor
gelijke resources blijft ongewijzigd. De volledige gerichte Player-/offline-run is groen: 32/32 in 2,6 minuten,
zonder retry of skip, inclusief echte Menu-widgets, legacy-binary, corrupte
assets, rendererfouten en beide birthdayformaten. Exacte CI en uitrol volgen
bij de PR.

S293 blijft een afzonderlijke PR voor observatie-identiteit en legacy-upload.
Productie wordt pas gepromoveerd nadat ook deze assetcorrectie via de normale
gates op de actuele main-SHA op staging is gecontroleerd. Historische v1-
releases en bestaande klantplaylists worden niet herschreven.
