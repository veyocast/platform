# S244 — Geïntegreerde Sync-acceptatie en normale uitrol

Dit is de integratie en eindcontrole binnen de oorspronkelijke expliciete
gebruikersopdracht: voer de startprompt volledig uit, deploy staging/productie,
vergelijk diepgaand met gekozen prototype1/Sync, verwijder oude oranje
bediening, herstel OnzeTrots-achtergronden en verminder massale geneste vakken.
De gevraagde vijf volledige vergelijkingsronden blijven een echte open gate;
vijf viewports of losse tests worden niet als vijf volledige ronden geteld.
Fysieke apparaat-/24u-tests, SendGrid-accountconfiguratie, YouTube en Mollie
zijn door de gebruiker uitgesteld. Nieuwe betaal-/retentieactivatie valt hier
niet onder. Geen nieuwe gebruikerstoestemming nodig voor de al opgedragen uitrol.

## Branch, worktree en writer

Root is de enige integratiewriter. Hergebruik het schone gemergde
`/home/codex/repos/castivo-s235` op nieuwe branch
`veyocast/s244-integrated-sync-acceptance`, basis
`c3a5ca493fb22b11bd5aac3abd96fa20742c0bff`. De oude S235-branch,
commits, runtime-output en bewijs blijven behouden. Een taak/branch/worktree/PR.
Lees README, PLANS, ledger, technische/design/Publisher/security/offlinecanon
en de relevante S234–S243-prompts. De laatste gebruikersdelta voor gekozen
Sync-primary gaat boven de historische algemene Orange-regel.

## Exclusieve ownership

- Gewone Git-integratie van de exacte bevroren S237, S238, S239, S240, S241,
  S242 en S243 featureheads. Geen force, amend, rebase of branchverwijdering.
  Alle oorspronkelijke PRs, rode resultaten en lokale/hosted bewijzen behouden.
- Expliciet afgebakende vervolgcorrecties S245/S246 normaal integreren na hun
  afzonderlijke rootreview. S245 gebruikt vaste officiële on-surface-kleuren
  voor twee werkelijk te lichte statusvoorgronden en herstelt uitsluitend de
  ontbrekende Source-actiefmarkering. S246 vervangt uitsluitend de bewezen
  oranje LED-editorbediening en geselecteerde UI-vlakken binnen Sync; de
  inhoudspaletten, canvaspixels en configuratiecontracten blijven behouden.
  Iedere correctie heeft eigen branch/worktree/PR, rood-groenbewijs en prompt.
- De verdere concrete auditbevindingen S247/S248 volgen dezelfde aparte
  reviewgrens. S247 raakt uitsluitend audit-/thema-editorbediening in de
  lokale Sync-scope. S248 groepeert de bestaande extra LED-taken met native
  disclosures en behoudt alle formulieren, permissions, keys, anchors en
  fout-/editretouren. Geen writer of inhoudscontract wordt vervangen.
- De afzonderlijk gereviewde vervolgheads S249–S252 normaal integreren.
  S249 corrigeert alleen de combinatie van bestaande statusverwachtingen.
  S250 is een expliciete dependency-taak: exact Next15.5.20, één SSR-optin
  en een twintigregelige pnpm-patch in twee vendored Schedulerbestanden;
  alleen hiervoor zijn patchregistratie en de mechanische lockdelta toegestaan.
  De originele packageversies, manifests, integrities en peergraph blijven gelijk.
  S251 herstelt drie werkelijk gereproduceerde mobiele indelingsdefecten.
  S252 herstelt lokale clubkleur-swatches en de behouden doelpunteditorpreview;
  canonical renderer, exports, commands en Player blijven behouden.
- S253 als afzonderlijke noodzakelijke CI-correctie integreren: uitsluitend
  de te brede LG-patchban in de bestaande workflow/test vervangen door één
  gedeelde canonical-mapguard voor de officiële webOSCLI. Dezelfde echte
  versie-, header-, ares-, wrapper-, hosted- en artifactchecks blijven behouden.
  Geen packager-, versie-, dependency-, IPK- of deploymentcontractwijziging.
- `TASK_LEDGER.md`, dit prompt, `docs/s244-integrated-sync-acceptance.md`,
  `execution/CURRENT-STATE.md`, `execution/PLAN.md`,
  `execution/scenario-acceptatie.csv`, `execution/opruimregister.csv`,
  `execution/evidence/s244-*` voor waarheidgetrouwe actuele mapping/bewijsindex.
- De exact bevroren S237-testoverdracht: bestaande
  `tests/control/sites-engage-sponsors-workflows.spec.ts` en
  `tests/e2e/control-shell.spec.ts`, plus S237-eigendoc en sprintprompt.
  Uitsluitend de oude Sponsor-fixture/verdwenen disclosure vervangen door de
  echte workspace/tabs/dialogs; alle Engagebodies/transporthelpers en overige
  shellasserties blijven bytegelijk. Eerst de volledige shell op de actuele
  gebouwde S237-producttree sluiten, daarna patch byte-identiek overnemen en
  op de uiteindelijke S244-CI testen. De oorspronkelijke vier hosted failures
  blijven bij PR266; geen afzonderlijke featurepush nodig voor deze testmapping.
- Mergeconflicten in de reeds toegewezen featurepaden uitsluitend oplossen
  door beide bewezen functies en hun bestaande beveiligings-/transportgrenzen
  te behouden. Concreet conflicterende productpaden eerst met hunk en beide
  invarianten documenteren; geen stilzwijgende functionele herbouw.
- Eigen tijdelijke lokale acceptatiescripts, beschermde bewijsbestanden en
  RAM-buildoutput. Werkelijke QA blijft57621/57622; geen reset/backfill.
  Alle drie noodzakelijke forwards zijn afzonderlijk al bewezen; galerijforward
  heeft historie179→180 en alle rijen van162 tenanttabellen exact behouden.

Buiten de afzonderlijk goedgekeurde S250-patch geen nieuwe dependencies of
lockfilemutatie; geen schema, publieke RPC, tokens, Source-assets,
serviceworker, playeractivatiecontract of releaseworkflowmutatie. De reeds
afzonderlijk S238-goedgekeurde CI-fixtureprep wordt normaal geïntegreerd.
Nieuwe werkelijke defecten buiten deze integratie stoppen/melden met concrete
scope; vervolg krijgt eigen taak/branch wanneer nodig.

## Gates en acceptatie

Inventariseer iedere exacte head, merge zonder geschiedenisherschrijving,
bewaar originele lokale/hosted failures, en leg de uiteindelijke tree vast.
Doe passende gecombineerde lint/typecheck/test, UI/aXe/Chromium, Player/offline
en bestaande CI-gates op de uiteindelijke versie. SQL is al gecombineerd met
199 migraties/134 bestanden/4267 assertions en nul lintfouten getoetst; geen
redundante reset van de echte QA-omgeving. Elke nieuwe test moet gedrag bewijzen,
geen ruimere timeout, skip of tolerantie toevoegen om groen te worden.

Één lokale browserwriter tegelijk; alle execsessies moeten echt exit hebben
en eigen browsers afgesloten zijn vóór overdracht. Zware gates uitsluitend
begrensd met twee CPU's/concurrency1 en voldoende MemAvailable; artifacts naar
unieke RAM-mappen met metadata buiten Next-output. Bewijs en oude captures
nooit overschrijven of verwijderen om een mislukking te verbergen.

Vergelijk de samengestelde actuele routes en toestanden met de immutable
Source bij dezelfde data/toestand, desktop/mobiel, en de Player bij16:9/9:16
en beide thema's. Registreer per ronde dekking, afwijking, reparatie en grenzen.
Werkelijke AAL2-services onderscheiden van gecontroleerde transports en
hardware. Onbekende eerste koudeSSR/PGRST303 behouden als bevinding totdat de
oorzaak of begrensde acceptatie echt bewezen is; latere200 is geen oorzaakanalyse.

Na groene exacte gecombineerde PR-gates: normale integratie naar main, volg
auto-staging en verplichte pairing-/LG-recovery-smokes, promoveer uitsluitend
dezelfde immutable release via bestaande handmatige productieworkflow en
normale environmentreview. Verifieer vijf publieke healthversies en relevante
echte gebruikersflows. Geen V1-/pixelpariteit-/vijf-rondenclaim zonder bewijs.
