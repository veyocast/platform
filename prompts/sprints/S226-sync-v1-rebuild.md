# S226 · exacte Sync V1 rebuild

Voer de door de gebruiker aangeleverde startprompt en volledige overdracht uit.
Lees `execution/PLAN.md`, `docs/sync-v1-rebuild/handoff/START-HIER.md` en de
daarin genoemde canons. De expliciete gebruikersopdracht omvat staging én
productie; behoud de bestaande gates en handmatige productiepromotie.

Root is de enige writer. Ownership omvat de genoemde V1-domeinen, alle drie
webapps, native apps, gedeelde packages, benodigde forward-only migraties,
tests, assets, execution/archive, canon/ledger en uitsluitend noodzakelijke
deploymentpad-/runtimeconfiguratie. Geen history rewrite, branchdelete,
operationele datareset of nieuwe incasso-/restrictieactivatie.

Begin vanaf actuele origin/main, behoud later werk en registreer ieder
onbewezen scenario expliciet. Een geslaagde componenttest sluit geen hardware-
of provideracceptatie. Gebruik de bestaande PR- en releaseflow.
