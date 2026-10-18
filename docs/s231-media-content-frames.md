# Media-ontwerpen in de Source-editor

Een geüploade afbeelding of video opent vanuit Content dezelfde gekozen
Source-editorstructuur als de andere ontwerpen. Opslaan bewaart een logisch
media-ontwerp met een onveranderlijke versie; dupliceren maakt een eigen ontwerp
dat dezelfde geverifieerde bestandsbytes gebruikt. Een GET maakt niets aan.

Naam, schermstand, duur, fit, focus en zichtbare achtergrond worden opgeslagen.
De oorspronkelijke Source toont bij rawmedia geen tekst-, logo- of footerlaag.
De bestaande tekstvelden zijn daarom expliciet opgeslagen metadata. Trim,
geluid en volume blijven instellingen van een playlistplaatsing. Afbeeldingen
behouden de grens van 3–3600 seconden. Video's worden vóór opslaan begrensd door
de bestaande plaatsingsgrens `max(5, min(3600, ceil(assetduur)))`; ongeldige
invoer blijft behouden en wordt nooit stil afgekapt.

Lettertype, schaal, uitlijning, veilige marge, logo, voettekst en motion blijven
bewerkbaar en worden via dezelfde journal-/undo-/saveflow bewaard. De metadata-
uitleg maakt hun bereik expliciet. Motion stuurt de editorintro; de bestaande
Player-/playlistovergangen worden hierdoor niet vervangen.

## Versies en herstel

De primaire Contentkaart behoudt haar assetidentiteit; een kopie heeft een eigen
frameidentiteit. De interne playlistpicker gebruikt dezelfde logische kaarten,
inclusief gedeelde fysieke bron, zoekfilters en paginering. Bestaande ongebonden
plaatsingen worden niet automatisch omgezet.

Een plaatsing blijft vastgezet op de gekozen frameversie. Een nieuwere versie
wordt pas na expliciet kiezen en opslaan gebruikt. Bewuste plaatsingsoverrides,
ook wanneer hun waarde gelijk is aan de oude ontwerpwaarde, blijven behouden.
Publicatie bevriest de versie, instellingen, overrides en exacte bronrefs in het
release-item. Latere bewerkingen veranderen die publicatie niet.

De publicatiewizard resolveert dezelfde vastgezette versie. Het voorbeeld
gebruikt de echte fit, focus en achtergrond. Preflight telt de geverifieerde
hoofd- en achtergrondbytes met SHA-deduplicatie. Een bewuste achtergrondkleur-
override, ook een gewiste waarde, onderdrukt de achtergrondafbeelding en haar
download. Ontbrekende frozen bronnen blokkeren de nieuwe publicatie.

De editor, Contentacties en playlistopslag bewaren hun complete opdracht vóór de
POST, zonder tijdelijke URLs. Een ontbrekend antwoord herhaalt dezelfde nonce
en body. De server controleert opnieuw actor, tenant en capability. Een oude
bevestiging kan ook na archivering worden opgehaald door een nog bevoegde actor;
dit opent het gearchiveerde ontwerp niet voor nieuwe edits. Een definitief
revisieconflict bewaart de invoer en vereist een bewuste nieuwe opdracht.
Historische bronnen worden nooit vervangen door de huidige voorkeursvariant.

## Database en bestandsintegriteit

De enige nieuwe forwardmigratie is
`20261018200500_sync_media_frames.sql`. Drie tenanttabellen hebben RLS en
tenantbewuste foreign keys. Authenticated clients kunnen alleen lezen; mutations
lopen via begrensde RPC's met actuele capabilities, revisies, actor/tenantgebonden
receipts en gecontroleerde bronfingerprints. Helperfuncties blijven private.

Versies en bronrefs zijn immutable. Verwezen variantbytes en assetfeiten mogen
niet worden vervangen of verwijderd. Storageguards beschermen ook historische
en gearchiveerde refs. De bestaande eigen uploadsessionrechten blijven behouden;
een ander account kan die rechten niet overnemen. Logisch archiveren behoudt
bestanden en publicaties. Er is geen bestaande contentbackfill of datareset.

Applicatierollback gebruikt de vorige images en laat de additieve database staan.
Er is geen destructieve downmigratie. Herstel van bestaande data gebruikt de
normale herstelbare archief-/versieflows.

## Player

De bestaande binaire renderer krijgt een kleine achtergrondadapter die de
gekozen Source-gradients, presets, clubmuur en privéfoto toepast. Er komt geen
nieuw itemtype, transcode of decoder bij. Extra bronbytes lopen door de bestaande
manifestverzameling, SHA-verificatie, volledige releasevoorbereiding en cache.
De volledige bevroren provenance is gebonden aan de item-contenthash; de bestaande
SQL-manifesthash wordt niet stil naar een ander protocol omgezet.

LG maakt bij een transportretry nieuwe lokale achtergrond-BlobURLs die bij de
vervangende video horen. Het intrekken van pending of vorige media kan die
nieuwe achtergrond niet ongeldig maken. De transportkeuze, retrybudgetten en
vereiste eerste gedecodeerde frame blijven hetzelfde. De vorige geldige release
blijft beschikbaar tijdens voorbereiding en offline playback.

## Validatiegrenzen

De schone disposable databasecontrole telt 131 bestanden en 3774 asserties,
waarvan 145 S231; database-lint geeft nul fouten. Zeven echte sessieraces bewijzen
onder meer CAS, identieke receipt-replay en Storage-/variantconcurrentie.
De acht LG-URLlevensduurgevallen faalden vóór de productfix en slagen erna; de
volledige Player-unittestset telt 485 geslaagde tests. De editor heeft vijftien
componentbrowsergevallen, waaronder actuele rechten, archiefreplay, historische
achtergrond, mobiele bediening, metadataopslag en aXe; de dataloader heeft acht
gerichte tests en de presenter 28. De publishergrens heeft
twintig nieuwe gerichte checks en een echte componentbrowserproef voor
achtergrond/focus, overrides en mobiele/desktopweergave.

De echte lokale AAL2-keten uploadt twee eigen PNG's, bewaart een ontwerp van
901 seconden en maakt één logische kopie. Zowel save als duplicate verliest
daadwerkelijk het reeds gecommitteerde antwoord; herladen herhaalt dezelfde
opdracht en maakt geen extra versie of bestand. Authenticated Storage-upsert
op de verwezen achtergrond geeft HTTP 403; de oorspronkelijke bytes blijven
gelijk. Alle zes editorstates op 390/1440 px hebben nul aXe-overtredingen en
geen horizontale overflow.

De echte publicatiewizard bevriest beide ontwerpen in één eigen release. De
production-mode browser-Player en de LG-compatibiliteitsroute downloaden en
verifiëren hoofd- en achtergrondmedia, tonen een werkelijk gedecodeerd beeld
en behouden identiteit en release na een koude browserherstart die al vóór
navigatie offline is. Bij LG vergelijkt de proef ook de pixels van de zichtbare
Blob-afbeeldingen met dezelfde SHA-gecontroleerde cachebytes. De eerste LG-
proef stopte omdat de testreader zelf een door CSP verboden Blob-fetch deed;
die poging blijft bewaard. De sterkere vervolgproef wijzigt geen product-CSP.
Dit is browserbewijs voor de LG-route, geen fysieke webOS-acceptatie.

Archiveren toont eerst het werkelijke gebruik in één conceptplaylist, één
publicatie en twee eigen testschermen; openen en annuleren schrijven niets.
De archivering is gecommit vóór het bewust verloren antwoord. De eerste
harness stopte op een herstelknop achter de nog geopende dialoog. Een aparte
vervolgproef draagt uitsluitend de vastgelegde oorspronkelijke opdracht over
naar een nieuwe context en herhaalt haar via het echte archieffilter: dezelfde
nonce, body, receipt en revisie. Dit bewijst geen automatische persistentie na
het sluiten van die eerste context. Vervolgens slagen verse UI-restore en
logische archivering van beide eigen ontwerpen. Versies, bronrefs, bestanden,
playlist, publicatie en schermtoewijzingen blijven gelijk; de oorspronkelijke
mislukte testpoging blijft intact.

De ongewijzigde Source is met dezelfde afbeelding en zes editorstates vergeleken.
De swatchkleur, hextekst en compacte invoerbreedte komen overeen. De 44px-
bedieningshoogte behoudt de toegankelijkheidscanon; de 23px-Sourcehoogte en
andere ruwe verschillen blijven gerapporteerd. Klikbare bibliotheekfilmstrip
en de Source-reeksactie zijn afzonderlijk afgebakend vervolgwerk. Er is geen
algemene pixelgelijkheidsclaim.

De volledige lokale lint-, typecheck- en unittestgates slagen elk voor alle
30 taken. De gecontroleerde QA-forward heeft uitsluitend deze ene exacte
migratie plus één historyrecord atomair toegepast; 19 oudere trackinggaten
bleven onaangeroerd. Alle oorspronkelijke rijen van elf bestaande QA-tabellen
zijn hashgelijk. Concrete bewijsrefs staan in `execution/evidence/s231-*`.
Volledige hosted CI en staging/productie blijven afzonderlijke releasegates.
Fysieke Android/TV/LG- en 24-uursproeven, SendGridcredentials en YouTube/Mollie-
accountinrichting blijven volgens het gebruikersbesluit uitgesteld.
