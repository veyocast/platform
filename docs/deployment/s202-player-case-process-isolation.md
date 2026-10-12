# S202: iedere Player-case in een eigen proces

S201 PR38312145852 faalde op één native Chromiumcrash tijdens
`browser.newContext`, vóór de pagefixture en testbody van de derde welkomcase.
Alle90 specs en50 batches zijn uitgevoerd:555PASS,579 bestaandeSKIP en1FAIL.
De oorspronkelijke logs en artifactmetadata blijven bewaard. Vergelijkbare
native offsets kwamen voor in eerdere specs en runs. Dat bewijst een
terugkerende foutlocatie, niet de onderliggende Chromiumfunctie of oorzaak.

Een proces per spec deelt nog steeds de browser tussen cases. De aangepaste
runner ontdekt daarom de volledige Player-caseverzameling en voert iedere
case één keer in een eigen pnpm/Playwright/browserproces uit. De bestaande
geordende specvolgorde en declaratievolgorde binnen iedere spec blijven
behouden. De gepinde Playwright1.61.1-reporter levert de werkelijke IDs,
project-, bestands- en titelidentiteiten. De selectie moet vooraf precies één
originele case matchen; ambigue prefixes, duplicaten en delimiters worden
afgewezen. Nieuwe geldige specs/cases worden ontdekt, zonder hardcoded limiet.

Voor iedere daadwerkelijke uitvoering worden selectie, identiteit,
processuitkomst en reporteruitkomst bewaard. Een ontbrekende case, onverwachte
fixture/assertion/processfout of native crash blijft fataal. Er zijn geen
retries, extra skips of aangepaste snapshots. Chromium, workers en bestaande
timeouts blijven gelijk. De andere applicatiegroepen houden hun bestaande
groepsuitvoering. Optionele oorspronkelijke Sites-hooks behouden hun bodies
en krijgen bij inschakeling een afzonderlijk bewijsdirectory per case.

De oorspronkelijke scope telt253 Player-cases in47 specs, waaronder15
bestaande skips. Meer aparte processen kosten extra tijd; het eerdere gate
duurde15m33s. De geschatte extra startup is ongeveer10minuten, nog geen
bewijs dat de volledige nieuwe gate binnen haar bestaande45minutengrens
past. De nieuwe gate moet daadwerkelijk slagen; een mock of vijfcaserun
vervangt de volledige CI niet.

## Afzonderlijke productiestoring

De S201-contextprobe38314503543 mat om22:05UTC SQL_READY3347ms en
REST_TIMEOUT10002ms. De huidige onderzochte rollen hadden geen lock- of
I/O-wacht en de heartbeat-tabel geen locks/indexprogress. De bekende index
en migratiehistorieversie20261012190000 waren afzonderlijk afwezig. De
snapshot bewijst geen historische oorzaak, CPU/geheugen of huidige UI.

De daaropvolgende uitsluitend diagnostische S200-run38315266610 mat om
22:13:28.829UTC DATABASE_READY voor dezelfde actieve productietenant op
runtime18e: SQL15451ms en service-role REST HTTP2005979ms. Het resultaat
DATABASE_API_ALREADY_READY bevat notificationCount0/NOT_REQUIRED. Er is geen
NOTIFY gestuurd, geen herstelactie uitgevoerd en geen nieuwe applicatie
geactiveerd. Dat geeft een geslaagde vaste lezing op dat tijdstip, met hoge
latentie; de onderliggende tijdelijke API-storing blijft onbewezen.

Inventarisatie38315523047 faalde op EXACT_ACTIVE_TENANT_REQUIRED nadat root
`Duindorp sv` invoerde. De eerdere bewaarde, geautoriseerde invoer is
`Duindorp SV`. Dit is een afzonderlijke invoerfout, geen bewijs van een
databasefout. De gecorrigeerde read-only inventarisatie38315851281 bevestigde tenant_lookup6752ms en schema_presence1267ms, maar inventory_report stopte na60007ms met PUBLICATION_DATABASE_PROCESS_TIMEOUT. Er zijn geen before/after-artifacts. De ongewijzigde commandgrens was60000ms; er wordt geen langere uitvoering of geslaagde baseline aangenomen.

## Validatie en resterend werk

De daadwerkelijke ontdekking van253 oorspronkelijke cases en47 specs is
afzonderlijk vastgelegd. Alle20 gerichte regressies slagen zonder skips. De
vijf oorspronkelijke welkomcases slagen elk één keer in een afzonderlijk
proces, met complete closure en retry0, in totaal30.606s. ScopeESLint, gepinde
Actionlint/ShellCheck en diffcheck slagen. Workspace lint/typecheck/test
slagen elk30/30; lint/typecheck gebruiken30 gecachte resultaten, test29
gecachte resultaten. De Player is lokaal opnieuw gebouwd met de bestaande
secret-bundle- en webOS-controles. De onafhankelijke review bevestigt de
daadwerkelijke gepinde selectiesemantiek, identity/order/closure, fataal
gedrag en originele skips; de volledige exacte CI blijft nog vereist. Deze
taak wijzigt geen applicatie-, provider-, database-, migratie-, dependency-,
release- of authoringdata. De bestaande productie-uitrol en oorspronkelijke
sync/opruimacceptatie blijven vereist; beschikbaarheid wordt afzonderlijk
met echte databaselezingen en relevante schermflows vastgesteld.
