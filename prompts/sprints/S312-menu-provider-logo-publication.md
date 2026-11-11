# S312 — Werkelijke Menu-publicatiefout met providerlogo

De gebruiker meldt na S311 een echte `dynamic_complete_failed` in de gedeelde
versiegeschiedenis. Onderzoek de productietaak en daadwerkelijke PostgreSQL-fout,
herstel de oorzaak en rol uit via de bestaande normale gates en immutable
staging-/productieflow. De eerdere commit/push/deployautorisatie blijft gelden.

Root bezit één forwardmigration voor de private Menu DOM-validator, gerichte
aanvullingen op `supabase/tests/s292_menu_dom_contract.sql`, deze prompt, een
eigen bewijsdocument en de eigen plan-/ledgerregels. Geen applicatie-, Player-,
dependency-, workflow-, secret-, environment- of bestaande migrationwijziging.

Een geldige, immutable providerlogo-versie uit de bevroren snapshotbrand moet
slagen zonder kopie naar tenant Media. Exacte UUID/checksum/beeldtype en de
bestaande tenant-/document-/configuratieautorisatie blijven verplicht. Wijs een
ander providerlogo, checksumwisseling en cross-tenant Media af. Bewijs de echte
leasegebonden completion en activering van dezelfde versie, plus idempotentie.

Een echte productietaak mag niet als geslaagd worden aangemerkt op basis van
alleen API-/containerhealth. Houd mislukte snapshots immutable. Geen bulkpublicatie
van concepten of losse slide-identiteit. Vraag vóór een gerichte klant-retry om
identificatie/toestemming als de getoonde slide niet ondubbelzinnig vaststaat.
De bestaande vorige werkende release blijft beschermd. Rapporteer werkelijke
SQL-/CI-/uitrol- en klantpublicatiebewijzen afzonderlijk.
