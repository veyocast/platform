# S297 — Eén Content-ingang

Basis: `da3d1242c92beedee3e8d8d8d2c8d35404ab4ae6`. Opdracht: fase A2 uit de overdracht van 9 november 2026, §§ Eén Content-ingang, STU-01–12 en INT-01/02.

Lees AGENTS.md, README, PLANS, TASK_LEDGER, technical canon, designimplementation, designcanonicalv2, publishercanon, security/RLS en Player-offlinecontract. Bestaande gebruikersopdracht is leidend. Root beheert PLANS/TASK_LEDGER.

Lever één navigatie-ingang Content met serverfilters Alles/Media/Ontwerpen/Automatische slides/Menu’s/Reeksen, afzonderlijke status, zoekterm en stabiele paginering in URL. Bundel Uitslagen en Programma vóór scopekeuze. Gebruik bestaande Menu Studio en feature-gated LED-ontwerpeditor. Overzicht Content maken opent dezelfde kiezer. Bewaar bestaande objecten, editor/deeplinkroutes, wizardfamilies, bronselectie, nonce/retry en playlistbindings; behoud geavanceerde lijstfuncties via contextlinks. Behoud taakrechten zonder overview.read en beperk rows/counts/previews tot eigen tenant en leesbare typen.

Geen nieuwe datacontracten, SQL, flags, dependencies, lockfile, workflows, serviceworker of merk-/tokenwijzigingen. Bestaande OnzeTrots/FieldFlow-renderers blijven gelijk. Geen productiegegevens of planningen wijzigen. Bestaande index alleen redirecten waar taken equivalent zijn; menu-index houdt paginaformaat24. Geen editor- of versieredirects.

Verifieer oorspronkelijke route/ID-mapping, typefilter vóór pagination, tied ordering, zoeken/archief, rollen zonder overview en tenant/type-isolatie, scopekeuze/geen schrijfactie bij kiezen, bestaande wizardretry, mobiel320/desktop, toetsenbord/a11y en toepasselijke lint/type/test/build. Documenteer gecontroleerde lokale tests afzonderlijk van staging/physical Playeracceptatie; INT-01/02 zijn pas bewezen met werkelijk verzameld publicatie-/Playerbewijs. Root doet onafhankelijke review en releasegates.

Aanvullende paden: playlist picker gebruikt alleen gedeelde Content-typelabels; de bestaande guarded `onGoStudio`-navigatie wijst naar dezelfde kiezer `/dashboard/studio/new`. Selectie-, voorbereidings-, schrijf- en publicatielogica blijven behouden. Geen toekomstige Wedstrijddag-/seizoensroute vooraf toevoegen.

Gerelateerde bestaande E2E-asserties volgen de nieuwe Content-navigatie, de gebundelde taakcatalogus en de gecontroleerde Studio-indexquerymapping; checks voor oorspronkelijke editors, uploadverwerking, mobiel scrollen en auth blijven behouden. Optionele onafhankelijke Source-componentvergelijking blijft haar eigen ongewijzigde geavanceerde componenten testen.
