# S209 — logo-opslag en nieuwste clublogo

## Broncodebevindingen

Zowel actieve18e als c13 uploadt in `SupabaseSportlinkSyncBackend.complete` elk optioneel club-/teamlogo met `upsert:true`, voordat ingest wordt bevestigd. Er is geen vergelijking met een reeds opgeslagen object. De opgeslagen objectnaam is rol+genormaliseerdeSHA; de assetUUID bevat tevens de externe entiteit. Verschillende teams met dezelfdebytes schrijven daarom hetzelfde object herhaaldelijk. Een succesvollePOST bewijst geen nieuw logo. De bestaande previousTeamLogos-fallback wordt pas na een opslagfout geraadpleegd.

Eigen clubprofiel/logo wordt dagelijks server-side opgehaald. Nieuwebytes op dezelfde bronURL leveren door normalisatie een nieuweSHA/UUID op. De huidige v4-completion vernieuwt de providerpointer; een oudere completion vulde echter een legacy `sports_clubs.logo_media_asset_id`. Bestaande projectie kan de legacywaarde vóór de nieuwsteproviderpointer kiezen. Dit is een concrete broncodefout; de actuele tenantpointer en de daadwerkelijke nieuwe providerbytes zijn nog niet live vastgesteld.

Studio-/tenantbranding die expliciet is gekozen blijft leidend. De fix mag geen gebruikerlogo vervangen door een algemene automatische providerkeuze.

## Herstelcontract

Bewijs eerst veilig de identiteit en bytes van het gedeelde opgeslagen object. Binnen een batch wordt één objectverificatie/nieuweupload gedeeld door gelijke bucket/rol/pad/SHA/bytes/MIME/afmetingen. Elke externe teamidentiteit blijft wel een afzonderlijke correcte completionpayload krijgen. Bestaande ongewijzigdebytes veroorzaken geenPOST. Alleen ontbrekende/gewijzigdebytes worden opgeslagen; een concurrerende duplicate-create geldt pas als succesvol na verificatie.

Opslag-/lookupfouten behouden de optionele-logocircuit, last-known-good en gewone broningest. Persoonsfoto's blijven afzonderlijk fail-closed. Alle native requests/bodies volgen bestaande lifecycleabort, grootte- en SSRF-grenzen. Slides gebruiken uitsluitend opgeslagen gegevens; brondatawijziging maakt geen authoring- of playlistversie.

Een nieuwe forwardmigratie herstelt uitsluitend de logo-prioriteit in concrete canonieke brand- en Menu-v2-projecties. Voor dezelfde brongebonden club krijgt het nieuwsteproviderlogo voorrang op een oudelegacywaarde; expliciete Studio-/tenantcustombranding blijft behouden. Oude migraties blijven bytegelijk. Revisionvolgorde en transactionele refresh moeten met echte PostgreSQLfixtures worden getoetst vóór een aanvullende wijziging.

## Validatie en grenzen

De worker controleert nu eerst het opgeslagen object met een begrensde native stream en SHA/bytevergelijking. Gelijke objecten veroorzaken geen POST; gelijke logo's van afzonderlijke teams delen één verificatie/upload binnen de batch, terwijl hun database-identiteiten apart blijven. Alleen een bewezen ontbrekend object wordt immutable met `upsert:false` opgeslagen. Een concurrerende duplicate-create wordt pas geaccepteerd na onafhankelijke byteverificatie. Nieuwe bytes op dezelfde URL leveren een nieuwe inhoudsidentiteit op. De gepinde Storage-SDK geeft ook de gedocumenteerde legacy HTTP400/object-not-found-vorm door; willekeurige 4xx, ontbrekende buckets en providerfouten worden niet als ontbrekend logo behandeld.

Elke logo-operatie heeft een immutable clientclosure met hetzelfde gezamenlijke GET/POST-signaal. Ook een late ontbrekend-object-GET gevolgd door een vastgehouden POST stopt binnen het bestaande gezamenlijke budget. Andere RPC's en persoonsfoto's behouden hun eigen clientcontract; de optionele logocircuit en last-known-good blijven geldig.

De nieuwe forwardmigratie verandert alleen de logo-prioriteit in de twee concrete bestaande private projectoraliases. De actuele providerpointer krijgt voorrang op oude provider-owned legacy-media; expliciete Studio-branding blijft leidend. Geen historische migratie, authoringversie, playlistrelease of snapshot wordt herschreven. SQL rollback is transactioneel; na toepassing vergt herstel een expliciete nieuwe forwardmigratie.

128 gerichte workerchecks slagen zonder SKIP; de volledige worker-suite heeft 328 PASS en 250 bestaande conditionele SKIP. Native gepinde-SDK-tests toetsen bestaande bytes zonder POST over opeenvolgende runs, gelijke bytes voor aparte teams, gewijzigde bytes, conflicten, corruption, legacy foutcodes en echte body/connectionabort. Scoped lint/typecheck en diffcheck slagen. Workspace lint/typecheck/test slagen elk voor 30 taken, met respectievelijk 29/29/28 cachehits. Root heeft alle zes bevroren bronhashes en de 21 private logbestanden op bytes/hash/rechten gecontroleerd.

Root heeft uitsluitend het eigen geïsoleerde S206-databaseproject hergebruikt: reset met 161 exacte migraties, gerichte S209 pgTAP 31 PASS en de volledige RLS-suite 104 bestanden/2985 assertions PASS. De CLI-samenvatting inventariseert bestaande individuele conditionele skips niet afzonderlijk. De eerste native fixture faalde op een lowercase secundaire kleur die de bestaande uppercase constraint schond; alleen die testwaarde is hersteld en het oorspronkelijke failurelog blijft behouden. Alle 160 eerdere migraties zijn bytegelijk, alle 265 SQL-bestanden zijn gelijk aan de testmirror, en de eigen fixture-users/tenants/provider-versies zijn na rollback aantoonbaar afwezig.

De echte completion-v4-fixture ververst de providerpointer tweemaal en controleert canonieke Sportlink-/Menu-logo's, customoverride, tenant- en bronkeuze, private ACL's en stabiele authoring/release/snapshot-aantallen. Root heeft de concrete migratie en callerketen beoordeeld; afzonderlijke onafhankelijke SQL- en finale workerreviews vinden geen blocker. Volledige exacte CI volgt. Deze branch omvat S206 als expliciete voorganger; diens oorspronkelijke rode Source-run wordt niet als groen voorgesteld.

Geen gemeten bijdrage van de herhaalde uploads aan de gehele infrastructuurstoring. De1000regels-errorCSV bevat slechtsdrie mislukte teamlogoStoragePOSTs en geen clublogoPOST; succesvolleuploads ontbreken in die selectie. Productieacceptatie vereist de werkelijke opgeslagenbytes, juistepointer en projectie. Finale deployment en twee gewone succesvolle synccycli blijven open.
