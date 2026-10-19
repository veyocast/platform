# LED Scores-teamreferenties

De gewone providerontvangst na de S233-uitrol is op 19 oktober 2026 om
00:28:26 UTC met een bestaande read-only diagnose gecontroleerd. Beide
teamvelden hadden de vorm `object { id: number, name: string }`. De oude parser
accepteerde daar uitsluitend primitieve IDs. De veilige projectie bevat geen
waarden, teamnamen of rawbody; deze taak heeft geen providerrequest uitgevoerd.
Het beschermde bewijs `s233-normal-provider-safe-team-types.json` heeft SHA256
`403ab184998fd67695b8d4b2a093ad55e15ddc21eab4c372bc1775ca6a2b4bd8`.

De parser accepteert nu ook een object met dezelfde bestaande IDvalidator en
een verplichte stringnaam van 1–200 tekens. Additieve, ongebruikte objectvelden
worden gestript. Alleen het gevalideerde ID gaat door de bestaande
string-/trim-/lowercase-normalisatie; de providernaam krijgt geen rol in
mapping, canonical IDs, goals of nieuwe telemetrie. Het genormaliseerde status-
en eventcontract en de runnerbron zijn ongewijzigd.

Null, booleans, nested/array-IDs, fracties, negatieve of onveilige numerieke IDs
en ongeldige naamtypen/lengtes blijven afgewezen. De bestaande score-, datum-,
lineup-, scorer- en berichtbytegrenzen blijven intact. De S233-projector voor
begrensde typefouten is bytegelijk.

Twee bestaande rejection-only privacyfixtures bevatten precies een nu geldige
`id`/`name`-referentie. Alleen hun ID is vervangen door een ongeldige boolean,
met overeenkomstig verwacht type `boolean`. Alle afwijzings-, privacy-,
tweerecord-, throttle-, last-known-good- en herstelasserties zijn behouden.
De oorspronkelijke fixtures en bron staan in de normale basiscommit
`b3425842b0702be08f45d8eef3c6b69e160aa7ed` en de beschermde vóórkopie.

De twee nieuwe positieve parserchecks faalden vóór de bronwijziging. De nieuwe
connectorcheck faalde toen op het ontbreken van een geaccepteerde baseline.
Na de wijziging slagen 71 parserchecks en alle 31 connectorcases, inclusief de
30 bestaande. De nieuwe case verwerkt een objectbaseline en een volgende verse
score, levert bij een duplicate precies één gemapte goal, maakt de actuele
score zichtbaar en behoudt de laatst geldige toestand na een ongeldig
vervolgobject. Primitieve en objectreferenties leveren exact dezelfde
canonieke match-, mapping- en goalidentiteit op. Namen en ongebruikte
objectmetadata ontbreken in de gecontroleerde persistente calls.

De volledige lokale suites slagen met 226 integratietests en 372 workertests.
De 324 bestaande conditionele render-/browsercases blijven overgeslagen.
Beide package-lints, beide typechecks en `git diff --check` slagen. Er zijn geen
nieuwe skips, dependencies, SQL-, UI-, Player-, timer- of retrywijzigingen.

De lokale freeze is vastgelegd in het beschermde
`/tmp/veyocast-s236-final-proof.json`, SHA256
`054560a6bc330766ea8738b4ae249c61ae18a9e1497bbc55b4c96c044e3789db`.
De drie bevroren bestanden hebben deze hashes:

| Bestand | SHA256 |
|---|---|
| `packages/integrations/src/ledscores.ts` | `032ea66d01f0cac8984b725a2815a46bfd4496bd2728aa06dc879627b9b5bac2` |
| `packages/integrations/test/ledscores.test.ts` | `a4cbb96ba7c401317ec363b2674e01fc850983e300f911bd54adf163060232d0` |
| `apps/media-worker/test/ledscores-connector-runner.test.ts` | `ab6fe08f3023f0509f0683278dabcafaa0afae5eb988355c20e91fea2bc3f991` |

De ongewijzigde runnerbron heeft SHA256
`965914f5cf8b92c433bad105ccf11d201c97c9c0256846c54da9b80e417e48db`.
De beschermde logs behouden ook de oorspronkelijke rode resultaten:

| Log | SHA256 |
|---|---|
| `parser-before` | `fde901ba7c5582bcca82abbf2ab877699a2d701d49b5d828a13c6636c8e8ee18` |
| `connector-before` | `654536ae46161cbe49b2d86aec742f1bcd7ef0ca8f936ca4d618a10674e4209d` |
| `parser-after` | `a1b297fd58bdbf872bcde688200e0199086d9e31b8f1588a811e932d36a8ce25` |
| `connector-after` | `d5ceb70d0cfa5fedb5ae60b17056d4ef131292f4b337451fca79740b115277dc` |
| `integrations-full` | `b219052a881131576f87a85a706aba5dd99d30b849fc572424d7bada6364b3a6` |
| `worker-full` | `c22e95bfda130b8b52753b029f6c09fe4a26d7e9306e02ce2b1df75e780e66a9` |
| `integrations-lint` | `b543827ce56a63357c629028555ecec2cc964dda33dbbf2a9a2872b1a2ab20f8` |
| `worker-lint` | `b543827ce56a63357c629028555ecec2cc964dda33dbbf2a9a2872b1a2ab20f8` |
| `integrations-typecheck` | `8366207267355d3e3d5bf3bf6e8c94c5f93f6078c34f08973fa2b38cdda6cc92` |
| `worker-typecheck` | `8366207267355d3e3d5bf3bf6e8c94c5f93f6078c34f08973fa2b38cdda6cc92` |

Hosted checks worden op de exacte PR-head gevolgd. Normale staging-/productie-
uitrol en een nieuwe gewone providerontvangst moeten daarna de werkelijke
bronverwerking bevestigen. Deze unit/mockproeven zijn geen productieherstelclaim
of bewijs van fysieke playback. Rollback gebruikt de vorige workerimage;
er is geen datamigratie of dataherstel nodig.
