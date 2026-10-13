# S208 — begrensd en herstelbaar aanmelden

## Aanleiding en doel

De gebruiker blijft op production `/login` staan zonder vervolg. De pagina en publieke healthroutes antwoorden200 op de oude18e-runtime, maar productie-uitrol38332061336 kon geen databaseverbinding maken en Control-logtails bevatten AuthRetryableFetchError504. De precieze fase van de gebruikersaanvraag is niet bewezen. Broncode toont wel onbegrensde Auth-/rollezingen, een loginformulier zonder pendingfeedback en ongevangen fouten na geslaagde Auth. Herstel deze concrete resiliencegaten zonder een infrastructurele oorzaak of succesvolle productieaanmelding te claimen.

## Ownership

Implementatieagent: uitsluitend apps/control/app/login/{actions.ts,page.tsx,login-submit.tsx,login-flow.ts,login-flow.test.ts}, apps/control/lib/supabase/{server.ts,request-deadline.ts,request-deadline.test.ts}, apps/control/lib/control-session.ts, apps/control/middleware.ts, apps/control/app/error.tsx en apps/control/lib/control-auth-boundary.test.ts. Nieuwe genoemde files mogen alleen wanneer ze het echte gedrag toetsbaar maken; geen mock-only alternatieve flow. Root bezit dit prompt, docs/deployment/s208-login-resilience.md en TASK_LEDGER.md. Geen edits buiten deze lijst zonder gewijzigde expliciete ownership.

## Vereisten

- Behoud één SSR-client vanaf passwordgrant tot sessiecontrole; cookies, MFA, context, tenantstatus en server-side capabilities/RLS blijven gelijk. Geen fallbackdemo, toestemming zonder rollezing, tokenparsing als authenticatie of cached autorisatie.
- Eén expliciete beperkte aanmeldbudgetscope moet echte fetchrequests en responsebodyconsumptie stoppen bij Auth/rollen die blijven hangen. Combineer caller-/Request-/init-signalen correct. Ruim timers/listeners op bij alle terminalpaden; geen retries, extra Auth-aanvragen of achtergrondrequests. Een budget voor login mag niet ongemerkt langlopende authoring-/publishmutaties wijzigen. Beoordeel optionele sessielezingen en eventuele clients die na resolverreturn verder gebruikt worden.
- Behandel infrastructuur-/sessieleesfouten als een vaste veilige herstelmelding, onderscheid ze van ongeldige gegevens zonder accountenumeratie of ruwe SDK-/databasefouten. Next redirect/controlflow mag niet worden ingeslikt. Een fout geeft geen authenticated landing of gedeeltelijke capabilities.
- Pendingfeedback is toegankelijk en voorkomt dubbele submits. Nederlandse tekst beschrijft oorzaak/gevolg/herstelactie. Behoud huidige canonieke authlayout/tokens/brand en demoform.
- Middleware-auth bij bestaande/verlopen cookies krijgt eveneens een begrensde lifecycle, met hetzelfde cookieforwardingcontract. Alle echte beschermde serverroutes blijven fail-closed. Een root errorboundary mag de bestaande shelllayout-rolfout veilig herstelbaar tonen; geen raw errors, tokens of automatische retrylus.
- Tests moeten de werkelijk gebruikte flow raken: geslaagde Auth gevolgd door vastgehouden rolresponse; expliciete vereiste-rolfout; gewone credentialreject; succes met dezelfde client en correcte MFA/contextlanding; cleanup/abort van werkelijk vastgehouden native responsebody; callerabort/headers/body/timergrenzen. Gebruik geen echte accounts, messaging of productiecredentials.
- Auth504, databaseconnectfailure en geen gemeten CPU/RAM/I/O blijven afzonderlijke feiten. Dit is geen bewijs van herstel van de Supabase-infrastructuur.

## Gates en vervolg

Rootintegratie: combineer de twaalf bevroren Auth-paths met de zes afzonderlijk toegestane en gevalideerde S209 logo-/SQL-paths via een normale siblingmerge; behoud beide taakrecords en alle bronhashes. Alleen root bezit deze integratie en eventuele documentaire conflictresolutie. De implementatieagenten krijgen hierdoor geen bredere editownership. Het gezamenlijke PR234 is de finale herstelrelease; eigen workspace- en volledige CI-gates blijven verplicht, historische failures blijven bewaard.

Lees de canon volgens AGENTS.md en dit prompt. Gerichte regressies, scopedlint/type en workspace lint/typecheck/test; relevante bestaande Control-a11y/Chromium en volledige bestaande PR/Sites-gates behouden. Geen dependency-/lockfile-/workflow-/database-/migrationwijzigingen. Geen commit/push/remote-mutatie door implementatieagent. Root reviewt en integreert na concrete terminalbewijzen. Finale staging/production, loginwerkzaamheid, providerdata, opruiming en twee gewone synccycli blijven vereist.
