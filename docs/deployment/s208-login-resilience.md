# S208 — aanmelden bij onbeschikbare Auth-/rolgegevens

## Bewezen aanleiding

De gebruiker meldt een vastgelopen production-login. Onauthenticated GET `/login` en publieke health200 op13okt01:53:22UTC namen195–226ms en bevestigden alleen runtime18e53d89. Zij bewijzen geen geslaagde aanmelding of leesbare rollen.

De aangeleverde CSV (SHA25657240879074c49952c4b12647d11373717e2d2a82878d37c69ed108d56960124) is een selectie van1000 errorrecords van00:06:28.922–01:50:15.813UTC. Daarin staan negen POST `/auth/v1/token` met504; vijf liggen om01:43:26,01:44:14,01:44:53,01:45:33 en01:46:09UTC. Verder bevat hij301 PostgreSQL57014-annuleringen:297statementtimeout,3usercancel en1autovacuumcancel. Deze selectie bevat geen uitgevoerde querytekst, CPU/RAM/I/O of afzonderlijke Auth-serverlogs.

Een afzonderlijke livecheck om01:55:10UTC laadde de echte loginpagina en controleerde daarna uitsluitend één passwordgrant met een willekeurig niet-bestaand example.invalid-account. Geen echte gebruikerscredentials, accountaanmaak of berichten. De passwordgrantfase gaf geen antwoord binnen10.234s. Een eerdere10sdiagnostic had geen fasemarker en blijft daarom minder specifiek bewijs.

De laatste productiondeploy38332061336 faalde vóór dry-run/DDL: connecting01:44:38.761UTC, PgClient-connectfailure01:44:53.926UTC, oude worker hersteld01:44:54.686UTC. Staging793efc46 was volledig succesvol. Production bleef18e. De Control-logtail bevat AuthRetryableFetchError504, maar de Dockerlogcapturetijden zijn geen oorspronkelijke eventtijden. Oudere57014 bij indexopbouw is een afzonderlijk voorval. Geen bewijs dat de uitrol de eerder bestaande storing veroorzaakte.

## Concrete broncodegaten

- Passwordgrant en daaropvolgende verplichte rollen-/MFA/contextlezingen missen een eigen begrensde requestlifecycle.
- De bestaande SSR-client wordt terecht hergebruikt na aanmelden; cookies mogen niet via een tweede gedeeltelijk gechunkte client worden geïnterpreteerd.
- Verplichte rollezingen kunnen buiten de veilige loginfoutafhandeling gooien.
- Middleware kan bij een bestaande/verlopen sessie op Auth wachten voordat de loginpagina renderbaar wordt.
- Het formulier heeft geen pendingfeedback; de bestaande shell-errorboundary vangt fouten van haar eigen bovenliggende layout niet.

## Herstelcontract

Eén15sbudget omvat passwordgrant en autoritatieve sessiecontrole met dezelfde SSR-client. Native requests en responsebodies volgen de scope. Middleware-Auth en zelfstandige read-only sessieresolutie krijgen afzonderlijk begrensde scopes. Standaard authoring-/publishclients behouden hun eigen contract.

De pinned Auth-SDK vertaalt transport/bodyfouten naar retrybare fouten en kan verlopen sessies opnieuw proberen. Daarom moet scoped Auth bij beschikbaarheidsfalen terminal worden zonder nieuwe netwerkpoging, met een expliciet interne uitkomst die geen echte providerstatus of Authsuccess claimt. Deadline-/availability-time cookies mogen een bestaande sessie niet wissen. Credentials400, gewone cookieforwarding, MFA, tenantstatus/context, capabilities/RLS en demo-/livegrenzen blijven geldig.

De UI toont pending en een vaste veilige herstelmelding zonder raw SDK-/DBdetails. Het systeem geeft nooit toegang op basis van gedeeltelijk geladen rollen. Een veilige rootboundary maakt beschermde layoutfouten herstelbaar.

## Validatie en grenzen

De daadwerkelijke serveraction gebruikt nu één SSR-client en één 15s-scope voor passwordgrant, verplichte sessiecontrole en de landingkeuze. Zelfstandige serverlezingen hebben eveneens 15s; middleware-refresh heeft 5s. De gewone mutatieclient krijgt geen login-scope. Native fetch combineert caller-, Request- en init-signalen, begrenst responsebodies tot 1 MiB en stopt echte IO. De interne Auth-499-uitkomst voorkomt de retries van de gepinde SDK; deze code is geen gemeten providerstatus. Een geannuleerde refresh wist bestaande sessiecookies niet. Server-side rollen, MFA, tenantstatus en capabilities blijven verplicht.

Het werkelijke formulier toont een toegankelijke pendingstatus en blokkeert dubbele submits. Beschikbaarheidsfalen geeft een vaste herstelmelding; een rootboundary vangt ook beschermde layoutfouten. Er worden geen SDK-details of tokens getoond.

41 gerichte regressies slagen zonder skips. Ze gebruiken de echte gepinde Auth-/SSR-SDK en native HTTP voor vastgehouden headers/bodies, directe 504, transport- en malformed-bodyfouten, verlopen cookies, cookiebehoud, expliciet herstel, dezelfde-client-success, verplichte rollen, MFA/contextlanding en abortcleanup. Een ongeldige middleware-clientconstructor ruimt de timer eveneens op. De volledige Control-suite rapporteert 700 PASS en 34 bestaande conditionele SKIP. Workspace lint/typecheck/test slagen elk voor 30 taken, met respectievelijk 29/29/28 cachehits. Scoped lint/typecheck en diffcheck slagen. Root heeft alle twaalf bevroren bronhashes onafhankelijk geverifieerd; twee afzonderlijke agentreviews vinden geen concrete blocker.

Een echte Chromiumproef gebruikt een private kopie van de huidige Control-app en een eigen native HTTP-Auth-fixture op tijdelijke lokale poorten 3376/3377. Geen productiecredentials, externe accounts/berichten of databasewijzigingen. De twaalf inhoudelijke checks zijn samengesteld uit de hoofdcase en de afzonderlijk afgeronde cookiecase: werkelijk serveraction/pending/disabled, één passwordgrant, native held-body-abort na 14.989s, 303 naar de volledige dienstmelding, een expliciete nieuwe login-scope met gewone credentialreject, desktop/mobile en behoud van dezelfde expired cookie. Zes echte axe-runs hebben nul violations. Vier middleware-nativebodies sluiten na 4.981–5.007s; twee latere PWA-backgroundrequests zijn pas bij eigen teardown gesloten en tellen niet als deadlinebewijs. Twee eerdere private harnessfouten (een route-announcer met dezelfde alertrole en een onjuiste globale één-refreshverwachting bij meerdere PWA-aanvragen) blijven bewaard; geen productassertions/budgets of broncode zijn hierdoor aangepast. Beide lokale servers zijn gestopt. Dit bewijst geen geslaagde geauthenticeerde productieaanmelding; normale succes/MFA/context zijn afzonderlijk in de echte SDK-unitflow getoetst.

Deze branch bouwt op S206. Bij een PR naar main omvat hij ook de eerder afzonderlijk geteste forwardmigratie die één redundante volledige projectorcall verwijdert. De oorspronkelijke S206 Source-run blijft als rode run bewaard: één glyph met 625 afwijkende pixels; een afzonderlijke originele lokale capture heeft nul verschil. De nieuwe inhoudelijke head moet alle ongewijzigde PR-, database- en Source-gates doorlopen. Geen screenshotreferenties, assertions, browsers of drempels worden aangepast.

## Gezamenlijke herstelrelease

Root integreert de exacte S209-commit 67a3c29115fb0bda583f369219c9ce83c3164e1c via een gewone merge in de S208-branch. De twaalf Auth-bronbestanden en zes logo-/SQL-bestanden blijven byte-identiek aan hun afzonderlijk geteste en gereviewde versies. Alleen de twee task-ledgerregels conflicteerden; beide zijn behouden. Geen migratieconflict, force-push, rebase of amend. PR234 bevat hierdoor de login, het hergebruik van logo-objecten en de actuele providerlogo-prioriteit als één uiteindelijke herstelrelease. S209-specificaties en native bewijs staan in de afzonderlijke deploymentdoc. Root heeft vóór de mergecommit alle achttien bronhashes en opnieuw workspace lint/typecheck/test gecontroleerd: elk exit0. De gecombineerde head vereist eigen volledige ongewijzigde CI. Afzonderlijke eerdere runs blijven bewaard; pending of door concurrency geannuleerde runs zijn geen groene acceptatie.

Auth- en databasestoring blijven actueel te onderzoeken. Geen gemeten CPU/RAM/disk-I/O of historische hoofdoorzaak. Productionlogin, finale deployment, providerdata, opruiming en twee gewone succesvolle synccycli zijn nog niet aangetoond.
