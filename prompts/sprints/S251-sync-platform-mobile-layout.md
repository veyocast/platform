# S251 — Leesbare mobiele platformindeling

Root heeft drie actuele bevindingen op de gesloten gebouwde bf458bee/PTC4-
cohort geautoriseerd. Aparte sparse worktree `/home/codex/repos/castivo-s251`,
branch `veyocast/s251-sync-platform-mobile-layout`, basis
`bf458beeeab68f066d7ce5eaf6aa7101a93205b8`. Lees README, PLANS, ledger,
technische/design/Publisher/security/offlinecanons. De gekozen Sync-opdracht
gaat voor de historische algemene Orange-presentatieregel.

## Ownership en bescherming

Uitsluitend:

- `apps/control/app/(shell)/platform/sites-platform.module.css`.
- `apps/control/app/(shell)/dashboard/support/support.module.css`.
- `tests/control/sync-platform-mobile-layout.spec.ts`.
- `docs/s251-sync-platform-mobile-layout.md`.
- Dit sprintprompt.
- Alleen de eigen S251-regel in `TASK_LEDGER.md`.

Geen handlers, formulieren, beveiliging, gedeelde UI/Source, dependencies,
lockfile, configuratie of andere paths wijzigen. Geen install, eigen
Nextbuild/runtime, DB of browser vóór afzonderlijke rootqueue-GO. S250 heeft
tijdens voorbereiding de browserqueue. Geen commit/push vóór rootreview.
Sparse checkout maximaal20MiB, vooraf minstens100MiB diskreserve. Alleen
geverifieerde bestaande dependency-/assetslinks als lokale infrastructuur;
pathguard, exact unlinken na uitvoering en geen ignoretrucs/staging daarvan.
Root heeft de ongewijzigde deps/assets/config/producttree van zijn latere
S249-integratiehead2c4d2c2b expliciet als linkdoel toegestaan.

## Werkelijke triggers en begrensde oplossing

1. `/platform/tenants`390: native sticky-form-actions valt over slughelp,
   eigenaar-email en schermlimiet. Alleen≤760px en binnen PlatformLayout maakt
   de echte tenantformulieractie deel uit van de gewone documentflow, ná alle
   velden. Desktop houdt de bestaande stickybediening.
2. `/platform/integrations/sportlink`390: vier smalle SummaryStripkolommen
   knippen labels en breken Standaard uit middenin woorden. Alleen binnen de
   mobiele platformscope twee kolommen/twee rijen; labels, waarden en
   privacydetail blijven volledig zichtbaar, zonder ellipsis of woordbreuk.
   Desktop houdt vier kolommen en bestaande presentatie.
3. `/platform/support/settings`390: werkrollen- en afdelingskaarten raken
   elkaar. De bestaande lokale layoutklasse krijgt grid en minstens24px gap;
   de bestaande verticale kaartvolgorde en desktopbreedtes blijven behouden.

De originele native beelden0192/0177/0182 en computedbestanden uit cohort
160ab88c blijven ongewijzigd. Alleen bron-/fixturevoorbereiding vóór browserGO.
Bewaar een eerste rode twee-case-uitvoering met ongewijzigde productCSS en
voer na uitsluitend de gerichte CSSdelta dezelfde twee gevallen groen uit.

## Betekenisvolle acceptatie

Twee gevallen390/1440 lopen uitsluitend de drie echte async pagina's met de
echte PlatformLayout én ControlShellSSR, alle actuele styles en fonts. Alleen
de session/readmodel-, Next-host- en commandtransportgrens is gecontroleerd;
geen live Auth/RLS-/database-/writeracceptatieclaim. Gebruik de canonieke pure
platform-ownercapabilities en controleer dat de pagina's hun echte capability-
en AAL2-verzoeken doen. Alle commandtransporten blokkeren onverwacht schrijven.

Meet werkelijke vx-main/vx-content/documentbreedtes, native inner-scroll en
elementFromPointhit-tests van ieder relevant tenantveld, de slughelp en CTA;
geen submit. CTA volgt alle velden mobiel, keyboardfocus en complete FormData
blijven behouden. Summaryteksten worden volledig getoetst, inclusief echte
word-rangegeometrie en privacydetail;2x2 mobiel/vierkoloms desktop. Supportgap
minstens24px, verticale volgorde, formulieren en controls blijven bereikbaar.
Een echte gedeelde SummaryStrip buiten PlatformLayout behoudt exact zijn
stijlen en relatieve geometrie bij laden van de lokale modules. Hashguards
behouden echte pagina's, layout, writers/security en gedeelde componenten.

Eén worker, nul retries/skips en geen deadline-/tolerantieverruiming. Native
schermafbeeldingen en metingen in eigen RAMmap; daadwerkelijke browserexit en
Chromeclosure melden. Scoped lint en strikte specTypeScript; een onvolledige
sparse workspace is geen volledige foundation-PASS. Root verzorgt gecombineerde
gates, finale volledige capturecohort, vijf reviewronden en normale uitrol.

## Gerichte verificatie afgerond

OrigineelCSS: dezelfde2cases2FAIL/0SKIP7,934s; echte CTAhit-overlap,
afgebroken summarywoorden/verborgen privacydetail en kaartgap0 behouden.
Exact vooraf gereviewde candidate99149560… op alleen de twee CSSpaden maakt
dezelfde2cases2PASS/0SKIP5,386s (opdracht5,985s),1worker/0retry. Mobiele CTA
16px na allefields, negenhits bereikbaar,2x2 leesbaar en kaartgap24 op beide
breedtes. Desktopflow/SummaryJSON en twee late native PNGs exact; vroege
initialrasterafwijking blijft onverklaard en ongeclaimd. Zes gerichte native
groenbeelden bekeken, geen volledige reviewronde.

Runner61731exit0/Chromium1443200 gracefulexit0/verseChrome[] vóór overdracht;
alle eigenlinks verwijderd/16assethashes gelijk. Ruwe rood-/groen-/eerste
Node-preflightlogs behouden. Geen eigen Next/DB/install/foundation. Root heeft
voor integratie expliciet uitsluitend package.json en pnpm-lock.yaml uit de
permanente testhashlijst laten verplaatsen naar externe pre/postproof:
15permanente writer/security/Source/componentguards +17externechecks, alle
overige fixture-/behaviorbytes exact. Finale specf699aaec…; delta lint/strict
specTSC/diff opnieuw groen zonder browserherhaling. Doc/proof geven volledige
hashes en dekkingsgrenzen. Root heeft de drie mobiele nativebeelden zelf bekeken
en resultaatreview/releaseprep goedgekeurd: na externe17proof, permanente15,
delta-statics en freeze gewone commit/push/eigen draftPR naar S244. Geen nieuwe
browser, volledige foundation op sparse tree, mainmerge of deployment.
