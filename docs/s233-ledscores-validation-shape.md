# Diagnose van afgewezen LED Scores-teamvelden

De bestaande productieconnector ontvangt scoreberichten maar wijst twee
teamvelden af met `invalid_union`. Bestaande veilige events bevatten alleen
code en schemapad; daaruit volgen de ontvangen typen niet. Deze wijziging
verrijkt uitsluitend zulke bestaande fouten met maximaal twee vormrecords.

Voor precies `message.teams.away` en `message.teams.home` wordt een eindig
type bewaard. Bij objecten zijn uitsluitend de vaste sleutels `id`, `name`,
`type` en `active` toegestaan met hun primitieve type. Er worden geen waarden,
vrije sleutels, lengtes, URLs, geneste inhoud of providerfoutmeldingen bewaard.
De bestaande runner slaat deze gegevens op binnen hetzelfde event en dezelfde
30-secondenbegrenzing. Er zijn geen extra providerrequests of databasewrites.

Het scoreschema is bytegelijk. De parser blijft alle voorheen ongeldige
berichten afwijzen; transport, 45-seconden-startgrens, leases, goalafleiding
en last-known-good veranderen niet. Alleen een gewone volgende ontvangst na
normale uitrol kan de werkelijke veilige typen aantonen. Een eventuele
compatibiliteitswijziging volgt pas daarna. Dit is geen herstelclaim.

Vóór de bronwijziging faalden zeven gerichte metadata-asserties. Daarna slagen
203 integrations-tests en371 worker-tests;324 bestaande conditionele render- en
browsercases zijn overgeslagen. Alle30 connectorcases en gerichte lint/typechecks
slagen. Bestaande negatieve asserties bleven behouden. Zie
`execution/evidence/s233-led-validation-shape.json`. Volledige gezamenlijke CI
en de bestaande staging/productieflow blijven aparte gates.

Rollback gebruikt de vorige workerimage. De extra optionele detailvelden
vragen geen databasewijziging of dataherstel.
