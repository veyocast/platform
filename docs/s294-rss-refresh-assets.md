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

Een herstelresponse kan dezelfde canonieke datahash en revisie hebben als de
oude response met ontbrekende beelden. Daarom bevat de lokale Source-/Menu-
voorbereidingsidentiteit ook de stabiel gesorteerde asset-ID/checksum/type/
bytes, inclusief eventuele postergegevens. Signed URLs tellen niet mee.
Nieuwe of veranderde resources doorlopen zo de volledige cachevoorbereiding
en natuurlijke wissel, zonder de wirehash, datarevisie of immutable release
te herschrijven. Een ontbrekende optionele foto zonder asset-ID blijft geldig.

De echte browserregressie vond bovendien een gestopte één-item Source-klok:
na de eerste natuurlijke grens reset een nieuwe afspeeliteratie de tijd,
maar de interval-/animatie-effecten startten niet opnieuw. Beide effecten
hangen nu ook van die bestaande iteratie af. De renderer blijft gemount en
behoudt zijn geverifieerde fonts; elke volgende ronde biedt weer een grens.
Renderer/layout, database, bronacquisitie, leases, dependency en binaire
generatie blijven behouden.

Vier regressies doorlopen de echte descriptor→actuele manifestprojectie→
cachevoorbereiding met gecontroleerde database-/Storage-transportfixtures:
beschikbare foto/QR/bronlogo behouden, echte nieuwe foto, signed-URL-hergebruik,
afwijzing van een mislukte lookup en de geldige 50-artikelen/101-assetsgrens.
Alle vier falen vóór herstel. Daarna zijn zij en de veertien bestaande
Source-/legacyfallbackgevallen groen. Een extra browsergeval gebruikt de
werkelijke collector en projector, echte originele afbeeldingsbytes, nieuwe
data, URL-vernieuwing en offline reload. Een rechtstreeks met beelden verrijkte
browserfixture alleen had de oorspronkelijke fout niet gevonden.

De gedeelde cross-app transportfixture staat volgens het bestaande patroon
onder `tests/helpers`; de packageboundarygate en strikte contracts zijn
behouden. De vijf aanvullende regressies voor resource-identiteit falen vóór
herstel; daarna zijn alle tien boundarygevallen en vier manifest-/cachegevallen
groen. De same-hash browsertest faalt vóór herstel zonder mediaverzoek en
vindt na die correctie de gestopte afspeelklok. Met beide fixes slaagt hij
in 43,6 s: de eerste foto heeft de juiste lengte maar een verkeerde checksum,
blijft onzichtbaar, en wordt na de bestaande 30 s backoff correct opgehaald,
op een natuurlijke grens zichtbaar en met de complete set opgeslagen.
URL-vernieuwing downloadt geen foto opnieuw; offline reload behoudt foto,
bronlogo en revisie 2 zonder pairing.
Het meetbewijs staat in `implementation/s294-rss-refresh-assets/same-hash-repair.json`:
precies twee fotoverzoeken (één corrupt, één correct), twee geverifieerde
bronassets en nul extra fotoverzoeken bij URL-vernieuwing. Het offlinebeeld
is daadwerkelijk visueel gecontroleerd.

De laatste workspace lint/typecheck/unit zijn elk 30/30 groen. De Player-
productiebuild en eigen runnerlint zijn groen. Het eerste nieuwe browsergeval
slaagt in 12,1 s zonder retry: één descriptordownload, één nieuw mediaverzoek,
geen extra media-/fontloads bij URL-vernieuwing en werkende offline reload.
Een echte nieuwe afbeelding doorloopt de volledige voorbereiding: de lokale
FontFace.load-teller gaat daarbij van 6 naar 12; dit wordt niet als nul fontwerk
of netwerkdownloadwinst bij nieuwe media gepresenteerd. De bestaande test voor
gelijke resources blijft ongewijzigd. De laatste gerichte Player-/offline-run
is groen: 33/33 in 3,4 minuten zonder retry of skip, inclusief same-hash herstel.
CI op de laatste head en uitrol worden vóór afronding toegevoegd. De suites bevatten echte Menu-
widgets, legacy-binary, corrupte assets, rendererfouten en beide birthdayformaten.

S293 blijft een afzonderlijke PR voor observatie-identiteit en legacy-upload.
Productie wordt pas gepromoveerd nadat ook deze assetcorrectie via de normale
gates op de actuele main-SHA op staging is gecontroleerd. Historische v1-
releases en bestaande klantplaylists worden niet herschreven.
