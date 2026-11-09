# S300 — Wedstrijddag-werkplek

Basis main da3d1242c92beedee3e8d8d8d2c8d35404ab4ae6; branch veyocast/s300-wedstrijddag. Volledige werkstroom04 / WDG-01..14 en INT-06/07/10 uit de overdracht van9november2026. Dit is een operationeel draaiboek, los van de bestaande Onze wedstrijddag-slide.

De gekozen exacte Sportlink-wedstrijdcontext, vier optionele rollen, concrete doelschermen en gepubliceerde releases worden per bevestigde versie bevroren. Geen impliciete alle-schermenkeuze; overlappende groepen en incompatibele doelen moeten vóór bevestiging zichtbaar worden opgelost. Draft/CAS, publicatie, ontvangst en daadwerkelijk framebewijs zijn afzonderlijk. Gebruik bestaande planningresolver/voorrang, targetsnapshots, immutable releases en LED Scores/Goal Overlay; geen nieuwe provider of catalogus/prijs/providerwrite.

Vrijwilligers krijgen uitsluitend een expliciete object-/actie-/doeldelegatie binnen één publicatie en tijdvenster. Alle commands zijn tenantgebonden, CAS-geguard, idempotent en geaudit. Geen globale publicatierechten via snelle acties. Alleen passende playercredential+actie+revisie+hash kan een werkelijk frame bevestigen. Publiek geen fysieke-paneelclaim.

Verval is opt-in: bestaande generic scheduled releases hebben geen lokaal vervalcontract. S300 mag uitsluitend matchday-expiry-v1 doelen toelaten nadat tijdelijke en herstelrelease volledig zijn voorbereid en geverifieerd. Koude offline startup kiest geen verlopen tijdelijke inhoud. Herstel gebruikt de huidige resolver wanneer online, anders vooraf geverifieerde passende fallback; de gewone afspeelgrens blijft gelden. LG/oudere profielen zonder deze capability worden voor zulke opdrachten expliciet geblokkeerd; bestaande TTL-goals blijven intact. Een uitgeput menu vereist ondersteunde exacte plaatsing of vooraf geconfigureerde compatibele fallback, anders blokkeren.

Ownership player_refresh: nieuwe packages/contracts/src/matchday-runbook.ts en dedicated tests; nieuwe packages/domain/src/matchday-runbook.ts en tests; nieuwe Control /dashboard/matchday routes, API/servicehelpers, component/CSS en eigen browser/unitbewijzen; benodigde nieuwe Player matchday-helper/overlay plus begrensde opt-in wijzigingen in player-manifest.ts, player-release-envelope.ts, player-cache.ts, player-runtime.tsx, sync-player-capabilities.ts en manifestroute + gerichte tests. Geen serviceworker-, dependency- of bestaande assignment-/expirysemantiekwijzigingen. Root schrijft gedeelde barrel-exportregels en globale PLANS/TASK_LEDGER. Overview/Planning/navigatiehunks worden vooraf met root/S297 afgestemd. Alle SQL/migraties/database/generatedtypes/seed blijven exclusief database_matchday na root-lockvrijgave.

Gates: frozen install eigen worktree, relevante canons, volledige lint/typecheck/test/build, geïsoleerde database/RLS via DBwriter, betekenisvolle route/API/CAS/autorisatie- en Playertests. Bewijs320px, desktop,16:9/9:16 en exacte legacyblokkeergrens; geen hardwarebewijs verzinnen. Geen productie- of Duindorp-fixturemutatie. Root reviewt, merget en promoveert exacte artefacten via normale staging/productionflow onder bestaande gebruikersvrijgave.
Runtimeuitbreiding: alleen voor het opt-in `matchday-expiry-v1`-venster krijgt `PlaybackScene`, `ScreenCompositionZone` en `VerifiedEmptyZone` een optionele eerste-framecontrole. Een nog nooit vertoond tijdelijk frame mag na zijn monotone eindgrens niet zichtbaar worden; bestaande gewone beelden en reeds vertoonde beelden behouden hun natuurlijke wisselgrens. Geen serviceworker- of generieke TTL-wijziging.

Gerichte compositiecorrectie, expliciet door root geautoriseerd na echt framebewijs: bestaande Player main/side/bottom-wrappers krijgen alleen bij compositie een lokale player-playback.module.css-class die .playback-media op 100% van de zone begrenst. De globale 100vw-regel voor gewone fullscreen media blijft ongewijzigd. Beide oriëntaties, echte decoded video en fullscreenbreedte worden met bounds geverifieerd; geen fixturetypografie-aanpassing als workaround.

Bewezen bestaande originstatusrace, root geautoriseerd: na een geldige conditionele 304 kan een latere echte heartbeat-transportfout de compacte offlinestatus wijzigen terwijl runtime PLAYING/online achterblijft. Alleen bestaande geverifieerde-origin-events worden bij false naar OFFLINE_PLAYING afgeleid; een centrale runtimecommitcontrole voorkomt dat asynchrone assetvoorbereiding daarna oude online-status terugschrijft. True-event alleen activeert geen herstel; de bestaande manifestcontrole blijft leidend. Geen browserhint als autoriteit, geen afspeelreset of annulering van voorbereiding.

Root neemt de volledige bron na onafhankelijke review over voor gewone
integratiemerges. Behoud de exacte vijf historische testcompatcases uit het
gehashte tijdelijke DB-assemblypatch: drie S301adapterverwachtingen conditioneel
aan werkelijk geïnstalleerde integratie en twee bestaande LED-introspecties op
de bytebewaarde originele bootstrap achter de guard. Geen assertions overslaan
of historische migraties wijzigen. De uiteindelijke gecombineerde SHA vereist
alle normale CI-gates en stagingbewijs; productie is direct door de gebruiker
geautoriseerd. Default-off blijft voor klantverenigingen behouden.
