# S233 — Begrensde diagnose van afgewezen LED Scores-teamvelden

Voortzetting van de geautoriseerde V1-rebuild. Basis is main
6b8b914665cb951e8da6a070ebe7a69336b91b0c (normale fast-forward na de
read-only diagnose vanaf7638a844); eigen worktree
`/home/codex/repos/castivo-s233`, branch
`veyocast/s233-ledscores-validation-shape`. Lees de normale repo-canons en dit
prompt vóór code. S231 wordt onafhankelijk getoetst en gepromoveerd.

De bestaande productieconnector ontvangt berichten, maar zijn bestaande
validatie-events geven `invalid_union` voor uitsluitend
`message.teams.away` en `message.teams.home`. Oude events bevatten geen waarden
of typen. De laatst geldige snapshot blijft behouden. Niet aannemen dat een
oude change-driven snapshot transportuitval bewijst.

Voeg uitsluitend privacybeperkte type-/vormmetadata toe aan reeds bestaande
validatiefouten voor die twee exacte paden. Geen providerrequest, nieuwe poll,
extra databasewrite, wijziging van de bestaande 30s-throttle, 45s-startgrens,
transport, parseracceptatie, score-/goalafleiding of last-known-good. Behoud
de oorspronkelijke code/path en alle bestaande negatieve parserasserties.
Maximaal twee records met een eindig type-enum; objectvorm mag uitsluitend een
vaste kleine allowlist van protocolveldnamen en hun primitieve typen bevatten.
Geen waarden, vrije veldnamen, namen van spelers/teams, strings, lengtes,
URL's, berichtbody, nested inhoud of foutmelding uit Zod. Arrays krijgen alleen
het type. Ontbrekend en null blijven te onderscheiden.

`scenario_audit` heeft exclusieve ownership op
`packages/integrations/src/ledscores.ts`,
`packages/integrations/test/ledscores.test.ts` en
`apps/media-worker/test/ledscores-connector-runner.test.ts`.
De bestaande runner geeft de validationIssues al door; geen source-aanpassing
daar tenzij eerst concreet aan root voorgelegd. Betekenisvolle tests bewijzen
privacy, exacte padgrens, tweerecordlimiet, ongewijzigde afwijzing en bestaande
throttle/LKG-persistence. Geen SQL-, workflow-, dependency-, lock-, Player- of
UIwijzigingen. Geen commit/push/deploy door deze writer.

Root bezit dit prompt, documentatie, ledger, gesaniteerde bewijzen en integratie.
Een eventuele diagnosticmappercorrectie of parsercompatibiliteit is nu GEEN
ownership: eerst de veilige metadata van een gewone toekomstige provider-
ontvangst vaststellen na normale uitrol. Geen rawbody achteraf opvragen.
