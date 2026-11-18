# S316 — Thema’s en expliciete Media-achtergronden

De eerste onafhankelijke opdracht uit de bijlage van 18 november uitvoeren.
Main vooraf bevestigd op 67d8470198acec4272c47c4c7979b6071a915c4b. Deze branch
volgt de afzonderlijke S315-performancefix; AI-agent en platforminstellingen
worden apart onder S317 ontwikkeld en zijn geen onderdeel van deze UI-fix.

Root bezit uitsluitend de nieuwe gedeelde MediaBackgroundPicker/CSS/unittest,
SitesSourceDesignControls, SyncCreateWizard, SyncStudioFrame, de bestaande
sync-create-wizard-browserproeven en eigen prompt/doc/plan/ledger. Geen andere
writer, migratie, cache-/Player-/renderer-/publicatie-/dependency-/secret- of
deploymentworkflowwijziging. Dezelfde reguliere UI werkt met AI uit.

Onderzoek alle hergebruikers: Sportlink, bulk, Menu/Twelve, LED Scores, RSS,
normale Sync-aanmaak/bewerking en generieke editor. Een upload is Media, geen
thema. Alleen expliciete selectie mag de slideachtergrond wijzigen. Openen,
annuleren, nieuwe Media en hun sorteervolgorde veranderen geen clubstijl of
opgeslagen ontwerp. Bewuste historische fotoverwijzingen blijven gelijk.

Bevestig de oorzaak vóór herstel met een echte browsertegenproef. Geen
historische databasecorrectie zonder aangetoonde classificatiefout. Test
gekozen IDs/checksums, beide oriëntaties, reload, verloren-save-replay, toetsenbord,
44px, focus en axe, plus foundation en normale CI/buildgates. Staging en
productie uitsluitend via de bestaande exacte-SHA-releaseprocedure.
