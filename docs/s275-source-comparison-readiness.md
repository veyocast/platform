# S275 — Bestaande Source-tegenproef pas na computed gereedheid meten

S271CI op e9a2c6d8/fde5539 rapporteerde65PASS/1FAIL: RESP-0059 bij1024×768.
De oorspronkelijke productiebeelden en metingen bleven correct44pxknoppen
bewaren. De bestaande expliciete vergelijkingsstijl moet alleen voor de
tegenproef min-height:0 herstellen naar de oorspronkelijke36,59375px. De
niet-gereedgekomen meting gaf nog56px voor de tabs in plaats van48,59375px en
precies7,40625px verschuiving van de volgende kop. Billingcopy raakt sources
niet. De twee originele foutbeelden en volledige log/artifact zijn behouden.

Alleen vóór de normalizedmeasure wacht de bestaande fixture nu tot alle zes
filterknoppen de reeds bedoelde computed min-height:0 tonen. Dezelfde bestaande
2000ms/25,50,100,250hostpollgrens wordt gebruikt. Geen extra testcase, testretry,
timeoutverruiming, gewijzigde vergelijkingstolerantie, Source-/productwijziging
of filtering van fouten. Raw productiebeelden/metingen en de44pxassert blijven
ongewijzigd. Het eerdere mobiele wachten op header/bottomnav blijft behouden.

Alle66oorspronkelijke cases zijn werkelijk native uitgevoerd:66PASS137,378s,
0skips/retries, inclusief RESP-0059. Iedere oorspronkelijke viewport/route-ID,
assertion en body buiten de ene nieuwe await is bytegelijk via exacte inverse.
ScopedESLint0. Eigen browsergroep gesloten en Rootbron/geïnstalleerde SDK gelijk.
Bewijs: `/dev/shm/veyocast-s275-native-candidate-03eaf90f-24eb-410d-ab24-bf98adcb072e`.
Een eerste private runner werd terecht vóór een browser geweigerd omdat hij de
static-idlecheck gebruikte terwijl de benodigde, exact beheerde appservers
draaiden. De aparte responsive-runner gebruikt nu dezelfde browserqueuegrens als
de eerder bewezen1920supplement met expliciete runtime-PID/readinessbinding.

De echte JSX/CSS gebruikt gecontroleerde lege readmodels plus de bevroren echte
MarketingGET en originele immutable Source. Geen echteAuth/RLS-/provider-,
algemeneAA-/pixel- of volledige visuele reviewronde. Nieuwe exacte-headCI en
normale integratie blijven vereist; de oorspronkelijke S271CI blijft rood.

## Native wizardinvoer na stapfocus

De eerste Control-CI op96df3dd239/synthetische merge8d2366bb sloot
579PASS/1FAIL/629bestaandeSKIP. De volledige originele trace/log/artifact
blijven behouden. Bij het bestaande geval voor tijdelijk onvolledige naam/duur
toont de snapshot vóór Verder nog `Kantinemenu`, ondanks een afgeronde
`fill("")`. De wizard ging vervolgens naar Vormgeving. De test had de naam dus
niet werkelijk leeggemaakt; dit is geen bewijs dat lege namen de validatie
passeren. De uitgestelde kopfocus via requestAnimationFrame is een uit code en
timing afgeleide verklaring; de oorspronkelijke trace bevat geen afzonderlijk
focus-eventlog.

Uitsluitend dit bestaande geval wacht nu na twee stapwissels op de bedoelde
werkelijke kopfocus en bevestigt dat naam en duur werkelijk leeg zijn. Alle
oorspronkelijke validatie-, reload-, herstel- en geen-createasserties blijven
behouden. Geen productcode, transport, testhelper, timeout, retry, skip of
tolerantie verandert. De volledige bestaande wizardspec sloot19PASS53,926s,
0skips/retries: `/dev/shm/veyocast-s275-wizard-native-candidate-6b0e492f-cd77-4769-89d2-95575c3be91b`.
Eigen dependency/publicaliases zijn verwijderd; Rootbron en SDK zijn gelijk.
Een eerdere preflight stopte terecht vóór een browser bij te weinig vrij
geheugen; de3500MiB-grens is niet aangepast. De66 Sourcecases blijven
bytegelijk aan hun genoemde native PASS. Nieuwe exacte CI is vereist.
