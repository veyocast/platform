# S196: optionele Sportlink-media en gegevenssynchronisatie

De echte productieprobe38271637503 op3dfa75ca toont dat de nieuwste competitiesrun
faalt met SPORTLINK_MEDIA_UPLOAD_FAILED. Het completionpad stopt alle opgehaalde
gegevens bij één mislukte optionele upload. Extern niet beschikbare teamlogo's
hebben al een toegestane initialenfallback; opslagfalen mag actuele gegevens niet
onnodig blokkeren. De aparte query_canceled57014 wordt nog onderzocht; dit werk
claimt geen oplossing van een onbewezen SQL- of netwerkoorzaak.

Ownership: aangewezen worker-agent schrijft uitsluitend
apps/media-worker/src/sportlink-sync-runner.ts en bijbehorende test. Root schrijft
dit sprintprompt, docs/deployment/s196-sportlink-media-resilience.md en TASK_LEDGER.md.
Extra files/schema/dependencies eerst melden; geen andere agentwijzigingen in
deze worktree. Root is de enige schrijver van gedeelde governancepaden.

Bewaar worker→database→published-data, deadlines, tenantpermissions, privacy,
consent en immutable ontwerp-/releaseversies. Registreer alleen aantoonbaar
opgeslagen media; geen nieuwe databaseverwijzing naar een mislukte upload.
Gebruik bestaande geldige media of de bestaande fallback waar het contract dat
toelaat. Annulering en echte ingestfouten mogen niet stilzwijgend succes worden.
Maak media-uitval zichtbaar via veilige vaste diagnostiek zonder persoonsgegevens,
providerpayloads, storagepaden of rauwe driverfouten.

Verifieer uploadfalen met echte SDK-contracttests en controleer de RPC-payload:
actuele gegevens blijven aanwezig, mislukte media niet. Succesvolle uploads,
club-/team-/persoonmedia, tenant- en consentgrenzen blijven gedekt. Vereiste lint,
typecheck en tests moeten groen zijn; geen API- of schemawijziging zonder bewijs.
Na groene PR commit/push en staging-/production-uitrol zoals door gebruiker
geautoriseerd. Nacontrole bewijst twee gewone cycli en stabiele ontwerpversies;
losse unit- of diagnostiekPASS bewijst geen volledige productieherstelacceptance.
