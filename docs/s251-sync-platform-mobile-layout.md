# S251 — Mobiele platformindeling

De actuele gebouwde bf458bee/PTC4-captures tonen drie concrete problemen:
tenantacties bedekken formuliervelden, de Sportlink-samenvatting knipt tekst in
vier smalle kolommen en de werkrollen-/afdelingskaarten raken elkaar. S251 is
begrensd tot twee lokale CSSbestanden; alle pagina's, formulieren, guards en
commands blijven ongewijzigd.

De native bronbeelden zijn0192-actual-7e14b967296b.png,
0177-actual-d431ff006d8d.png en0182-actual-27227199149a.png onder
`/dev/shm/veyocast-s244-built-actual-captures/160ab88c-7fe6-4d09-b4e7-8e1f8dbb9ac7/`.
Deze drie beelden zijn gericht bekeken voor deze triage. Dat is geen volledige
visuele reviewronde en promoveert de onvolledige hoofdcapture niet tot PASS.

## Voorbereide oplossing

Alleen op maximaal760px in de echte platformscope komen tenantacties ná alle
velden in de normale flow. Desktop houdt de bestaande stickybediening. De
mobiele platform-SummaryStrip krijgt twee kolommen en twee rijen, volledige
labels/waarden zonder middenwoordbreuk en zichtbaar privacydetail. De lokale
supportlayout krijgt grid met24px afstand, met behoud van de bestaande
verticale kaartvolgorde en desktopbreedtes. Geen Source- of globale CSSwijziging.

## Toetsgrens

De nieuwe twee cases390/1440 renderen de drie echte async pagina's in de echte
PlatformLayout en ControlShellSSR met actuele CSS/fonts. Alleen expliciete
session/readmodel-, Next-host- en commandtransportgrenzen zijn gecontroleerd.
De echte capability-/AAL2-verzoeken blijven aanwezig; de fixture bewijst geen
live authenticatie, RLS, tenantmutatie of werkelijke providerrespons.

Positieve gates omvatten volledige tekst en woordgeometrie,2x2-/desktopindeling,
kaartgap, bereikbaarheid onder native scroll/hit-testing, echte
vx-main/vx-contentbreedtes, keyboardfocus en ongewijzigde FormData. Een echte
SummaryStrip buiten PlatformLayout controleert negatieve stylescope. Vijftien echte
pagina-/writer-/security-/sharedcomponenthashes zijn vastgezet. Geen gekopieerde
positieve paginamarkup of gesimuleerde formulierschrijfacties.

## Rood en gericht groen

De ongewijzigde productCSS geeft **2 FAIL / 0 SKIP** in7,934s. Op390 is de
actiepositie sticky en ligt de actionTop op617,609 terwijl het laatste veld op
1102,203 eindigt. Eigenaar-email en schermlimiet zijn bij native scroll niet
raakbaar in hun midden. Summarylabels hebben74/88/76px tekst in60px ruimte,
Standaard breekt middenin en privacydetail is verborgen. De supportkaartgap is
op beide breedtes0. De desktopcase faalt uitsluitend op die gap. Het volledige
rode log, JSONrapport, native PNGs en traces blijven behouden.

Na uitsluitend de vooraf gereviewde twee-CSS-patch slagen **dezelfde2cases**
390/1440: **2 PASS / 0 FAIL / 0 SKIP**, één worker en nul retries,
Playwright5,386s / volledige opdracht5,985s. De mobiele tenantactie staat nu
16px ná het laatste veld en alle negen relevante targets zijn raakbaar.
Alle labels/woorden/waarden en privacydetail zijn volledig zichtbaar in2x2;
de supportgap is exact24px op beide breedtes. Werkelijke html/vx-main/
vx-contentbreedtes hebben geen horizontale overflow. Keyboard-Tab bereikt de
echte CTA zonder submit en volledige FormData blijft gelijk. Alle buiten-
platformcontroles en nul-POST-/pageerrorgates slagen.

De desktop tenantflow/hitmetingen en volledige SummaryJSON zijn exact gelijk
aan de rode basis. De late native tenant-actions-1440.png en
sportlink-summary-1440.png zijn eveneens bytegelijk vóór/na. De vroege initial-
PNGs verschillen en blijven ruw bewaard; er is geen volledige pixelclaim of
bewezen verklaring voor dat rasterverschil. De zes gerichte groene native
390/1440-beelden zijn bekeken voor deze taak, geen volledige visuele ronde.

Runner61731 sluit werkelijk metexit0; Chromium1228/PID1443200 sluit netjes
metexit0. Een directe nieuwe /proc-scan inclusief chrome-headless-shell vindt
Chrome[]. Het slot is daarna teruggegeven; dat zegt niets over later gestarte
onafhankelijke browsers. Alle twaalf dependencylinks en de ene assetslink zijn
exact verwijderd; alle16assethashes zijn gelijk. Geen Nextbuild/runtime,
databaseactie, installatie of productcommand.

Scoped ESLint, strikte specTypeScript, diffcheck en de echte drie-page
SSR-compile waren vóór browser groen. Een eerste uitsluitend Node-preflight-
wrapper had een dubbele require-declaratie; de log blijft bewaard. Dit was
geen browser- of productfout. De test gebruikt nu fixtureRequire.

## Begrensde integratie en bewijs

De groene browserbron heeft SHA256
`d2a453c5cc6c58ddc8c02bb6fbcaeda307dc0162d5e6090630476d34f4210432`.
Root heeft daarna uitsluitend package.json-/lockhashes uit de permanente
testguard naar externe pre/postproof verplaatst: een legitieme latere expliciete
S250-dependencytaak mag de presentatiecase niet blokkeren. Vijftien writer-,
security-, Source- en componentguards blijven permanent; alle17 oorspronkelijke
bestandschecks blijven extern bewezen. De volledige fixture- en behaviorbody
buiten die twee hashentries is bytegelijk. Scoped ESLint, strikte specTypeScript
en diffcheck zijn opnieuw groen. Geen browserherhaling of assertionversoepeling.
Finale specSHA256
`f699aaec8398b8a9572f617b64e511729ad37863c4cf6509e53fc1262c66ef0e`.

RoodlogSHA256
`973640e85d773e911f70f0abd94661935e90c1ccf7720f9255bcadaf90901ed6`,
groenlogSHA256
`fe1f4e4db1c76b22ebfb720ec44cf3638c84c08f975782ced3b3d652ec036652`.
Reverse-invarianten behouden alle oorspronkelijke CSSbytes buiten de toegevoegde
mobiele platformregels en de ene lokale layoutdeclaratie. Finale proof/freeze
staan onder `/dev/shm/veyocast-s251-platform-mobile/`. Root heeft de drie
mobiele nativebeelden zelf bekeken en de resultaatreview goedgekeurd. Gewone
commit, push en eigen draftPR naar S244 zijn na freeze geautoriseerd; root
integreert normaal. Geen mainmerge of deployment door deze writer.

Een volledige foundation wordt op deze sparse checkout niet geclaimd. Volledige
gecombineerde foundation/CI, finale capture, vijf volledige ronden en
staging/productie blijven afzonderlijke rootgates. Geen algemene AA-, live
Auth/RLS-, provider-, volledige V1- of pixelacceptatie.
