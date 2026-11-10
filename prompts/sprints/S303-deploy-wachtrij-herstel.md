# S303 — Vastgelopen deploymentwachtrij gecontroleerd verlaten

Bron: bestaande opdracht om staging en productie uit te rollen, de expliciete
opdracht alle deploys te annuleren en opnieuw zonder menselijke approval te
starten, en het op 10 november gesloten Supportticket4979898. Begin bij main
`b623a458b2c711bb7b03e1866e857df10930ff36`, tree
`6d8f77b8b21cdf361154acd944384d5c40ed5f9d`.

Herstel de deploymentorchestratie met één vaste nieuwe concurrencygroep die
door alle vijf muterende workflows wordt gedeeld. Houd cancellation uit;
verander geen releasechecks, productie-dispatchvoorwaarde, immutable images,
migraties, applicatiecode, customerdata of publicaties. Dit is één begrensde
incidentovergang, geen concurrencygroep per run of omgeving.

Vóór merge: de vervangende pending run is werkelijk cancelled; de volledige
oude groepsinventaris bevat alleen push42669988139/bd5 met nul stappen en geen
runner. Bind de oorspronkelijke inlinePreflight aan de actuele ongewijzigde
actuele-maincontrole. Oude handmatige rollback-/onderhouds-/quiesceversies
mogen niet opnieuw worden gestart. Enige huidige collaborator met schrijfrecht
is TIXOCEO; de gebruiker en root starten uitsluitend de actuele main-workflows.
Bij onbekende legacyleden, uitgevoerde mutatiestappen of andere operators
zonder deze afspraak: geen overgang uitvoeren.

Ownership: root wijzigt `.github/workflows/{deploy,runner-disk-maintenance,
recover-data-api,probe-publication-runtime,probe-runtime-database,pr-gates}.yml`,
`scripts/validate-deploy-workflow-security.mjs`, PLANS/TASK_LEDGER, dit prompt,
de eigen S303-doc, actuele deploymentaudit/VPS-doc en het historische
S300-vervolg. available_receipt wijzigt uitsluitend
`scripts/deployment-concurrency-policy.mjs` en `.test.mjs`.
integration_review leest onafhankelijk en schrijft geen source.

Test negatieve groepsafwijkingen bij ieder lid, cancellation/overrides en
onbekende schrijvers. Voer de bestaande echte inlineBash-autorisatie met lokale
gitstub uit voor oude normale pushes, actuele main en bevestigde rollback.
Doorloop normale lint/typecheck/test/build/CI en deploymentvalidators zonder
cases of checks te schrappen. Merge uitsluitend de exacte groene bronboom.
Bewijs daarna apart dat de gewone nieuwe deployrun de runner bereikt, bouwt,+migreert en de gezonde exacte release toont. De oude run wordt daardoor niet
als geannuleerd, voltooid of veilig herstartbaar gerapporteerd.
