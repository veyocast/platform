# S235 — Thema-instellingen voor nieuwe ontwerpen

De thema-catalogus opent een echte Sync-instellingenflow met zeven velden:
accent, lettertype, lichte/donkere weergave, tekstschaal, achtergrond, beweging
en logo. De opgeslagen waarden worden alleen op nieuw aangemaakte ontwerpen
toegepast. Bestaande ontwerpen, immutable snapshots/releases, de globale
standaardthemakeuze en de bestaande thema-uitrol blijven afzonderlijk beheerd.
De catalogus toont nu echte Source-renderers met de opgeslagen instellingen;
de oude oranje mockpreview en onleesbare tekst zijn verwijderd.

## Contract en beveiliging

De additieve migratie `20261019010000_sync_theme_creation_defaults.sql`
voegt uitsluitend twee profielkolommen en begrensde RPC's toe. Opslaan vereist
een verse actor, actieve tenant, `settings.manage`, onafhankelijke
profielrevisioncontrole en een idempotencyreceipt vóór CAS. Een verloren
antwoord kan met exact dezelfde payload en nonce worden herhaald. De bestaande
profieltrigger mag `updated_at` bijwerken; overige oude profielvelden blijven
behouden. Service-role-DML blijft de bestaande vertrouwde servergrens; de
nieuwe RPC's geven deze rol geen execute. Authenticated directe DML blijft
geweigerd. Er is geen destructieve downmigratie; applicatierollback laat de
compatibele nieuwe kolommen en functies bestaan.

De beginwaarden komen uit de gekozen Source: FieldFlow `#006D83`, OnzeTrots
`#1268e8`, Manrope, licht, 100%, clubkleur, rustige beweging en zichtbaar logo.
Niet ingestelde SQL-profielen blijven expliciet null/revision0. Nieuwe
ontwerpen bevriezen hun eigen instellingen; later aanpassen van defaults
wijzigt die ontwerpen niet.

## Uitgevoerd bewijs

- Verse disposable database op 57721/57722: 197 migraties, 132 RLS-bestanden,
  3.930 assertions PASS, waarvan 156 nieuw; tien racechecks inclusief acht
  daadwerkelijk geblokkeerde sessieparen; database-lint nul errors. De echte
  QA op 57621/57622 is daarbij nooit gereset. Bewijs:
  `/tmp/veyocast-s235-db-final-proof.json`.
- Echte lokale QA heeft één gecontroleerde forward ontvangen, history178→179,
  met alle oude rijen in 162 tenanttabellen behouden. De negentien historische
  trackinggaten zijn niet aangepast. De migratie wordt niet opnieuw uitgevoerd.
- Echte AAL2-browserjourney: defaults opslaan, handmatig ontwerp maken en
  gekoppeld RSS-ontwerp maken. Bij elk van de drie opdrachten is het antwoord
  na commit verloren en daarna dezelfde Flight-body/nonce herhaald, telkens
  met één receipt. Na opnieuw openen staan de opgeslagen stijlvelden exact in
  beide ontwerpen. Oude gegevens en de andere thema-profielrij zijn gelijk;
  alleen de twee nieuwe velden en de gedocumenteerde `updated_at` veranderden.
- De eerste journey eindigde na de geslaagde defaults-/manual-opdracht op een
  verkeerde harnessverwachting voor de eerlijke melding `Opgeslagen bronpreview`.
  De aparte vervolgjourney gebruikt die echte cached-previewstatus en bewaart
  het oorspronkelijke rode verslag. Geen bronactualiteit wordt verzonnen.
- Definitief werkelijk acceptancebewijs:
  `/home/codex/.local/state/veyocast-s226/release-evidence/s235-actual-acceptance-final.json`
  SHA-256 `24c15c2481e2b6df92a965c853be5f258f65ff82742775eb34a624c1e394ec1e`.
- De volledige themes-pagina had vóór de cataloguscorrectie een echte
  contrastfout; de gecorrigeerde pagina heeft nul aXe-overtredingen. Eerdere
  rode captures/logs, resource-timeout, locatorfout en koude SSR-fout blijven
  afzonderlijk bewaard.
- Gerichte server-/contract-/state-/UI-units en zeven dialogbrowsercases,
  plus twee nieuwe wizardcases, zijn groen. De actuele volledige lint/typecheck/testfoundation heeft68/68PASS,
  waarvan42cached; werkelijke Control-suite1508PASS/34bestaandeSKIP. Log
  `/tmp/veyocast-s235-current-foundation.log`. Integratie met S234, hosted CI
  en deployment worden afzonderlijk vastgelegd.

## Open grenzen

De eerste koude lokale SSR500/PGRST303 is niet verklaard. Latere vier SDK-
GETs en twee echte Next-GETs zijn200 met dezelfde geldige actor; dit bewijst
geen algemene authreparatie. Het nieuwe defaults-readcontract ondersteunt
custom capabilities, maar de bestaande wizardroute/createaction heeft nog
zijn oude aanvullende overview-admission; geen sluitingsclaim daarvoor.

Dit is lokaal werkelijk write-/replay-/databehoudbewijs, geen productie-
accountacceptatie, vijf volledige audit­ronden, algemene pixelpariteit of
volledige V1-acceptatie. Fysieke apparaten/24u en de door de gebruiker
uitgestelde externe diensten blijven apart.

## Normale dependencyintegratie
S234 is met gewone merge geïntegreerd. Alleen de imports van de eigen
wizardspec zijn samengevoegd met de nieuwe gedeelde fixture; twee nieuwe en
elf bestaande cases blijven behouden. Alle20wizard-/defaultscases zijn op
de geïntegreerde versie groen (44,8s,1worker,0retry/0skip), rapport
`/tmp/veyocast-s235-wizard-integrated.json`. Een overgenomen lege EOFregel
in de helper is verwijderd voor de whitespacegate, zonder JavaScriptdelta.
Gecombineerde foundation en hosted databasegates volgen op deze exacte merge.

De geïntegreerde volledige foundation is groen:68/68taken,57cached; Control
1.637PASS/34bestaandeSKIP. Log `/tmp/veyocast-s235-integrated-foundation.log`.
Dit omvat de normale S234/S232/S236-dependencymerge. Hosted exact-head CI en
staging/productie blijven afzonderlijke releasegates.
