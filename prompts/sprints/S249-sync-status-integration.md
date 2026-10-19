# S249 — Geïntegreerde neutrale Sync-statusverwachting

Root heeft deze testintegratiecorrectie expliciet geautoriseerd. Werk op
`veyocast/s249-sync-status-integration` in de afzonderlijke sparse worktree
`/home/codex/repos/castivo-s249`, vanaf exact
`bf458beeeab68f066d7ce5eaf6aa7101a93205b8`. Oude worktrees, branches, ruwe
fouten en bewijzen blijven behouden. Lees README, PLANS, ledger en de technische,
design-, Publisher-, security- en offlinecanons. De gekozen Sync-opdracht heeft
voorrang op de historische algemene Orange-presentatieregel.

## Exclusieve ownership

- `tests/control/sync-status-contrast.spec.ts`.
- `docs/s249-sync-status-integration.md`.
- Dit sprintprompt.
- Uitsluitend de eigen S249-regel in `TASK_LEDGER.md`.

Geen product-CSS, Source, tokens, componenten, writers, dependencies, lockfile,
configuratie of andere test wijzigen. Geen reset, force, amend of rebase.
Commit/push/PR pas na rootreview en groene gerichte toetsing; root integreert en
verzorgt de volledige gecombineerde gates en uitrol.

## Aantoonbare botsing

De oorspronkelijke Control-job117908920464 van run39206018717 op PR270 HEAD
`bf458bee` eindigt met **545 PASS / 2 FAIL / 629 bestaande SKIP**. Beide fouten
vallen in de bestaande twee S245-cases390/1440 bij de exacte negativecontrole
van de gedeelde neutrale badge. Die veronderstelt de oude voorgrond, terwijl
S247 de echte neutrale accountstatus terecht naar de vaste Source-rol `--text`
heeft gebracht. De bestaande currentColor-dot volgt die voorgrond.

Bewaar het oorspronkelijke log onveranderd, SHA256
`356e42f6bf4def26f8d98f14cc9ad53bd06acbdf5d67e0859fda87453c2d2c1a`.
Deze taak corrigeert onderling onverenigbare testverwachtingen; zij claimt geen
nieuwe productbugfix en promoveert geen scenario- of releaseacceptatie.

## Vereiste testdelta

Behoud beide bestaande cases, alle andere componenten, de vier amber/success-
targets, contrastdrempel4,5, deadlines, retries en skips. Behoud de exacte
negatieve controles voor andere statuskleuren en buiten Sync, oppervlak,
geschilderde borders, geometrie, fonts, betekenis/labels en dotpresentatie.
Behoud werkelijke opgeslagen Licht/Donker via ControlThemeBootstrap,
voorkeursattributen/localStorage en alle actieve shellmarker-, reduced-motion-,
mobiele Escape-/focus- en nul-write-/pageerrorasserties.

Alleen de gedeelde neutrale badge binnen Sync krijgt een positieve
integratieverwachting: directe tekst gebruikt de daadwerkelijk opgeloste
bestaande Source-rol `--text`, contrast is minstens4,5 in beide voorkeuren,
zijn dot volgt currentColor en behoudt afmetingen/aria-hidden. Achtergrond,
border, overige geometrie, typografie, tekst en status blijven exact gelijk
voor/na. De gehele herstelde neutrale presentatie is gelijk tussen Licht en
Donker. Voeg een echte gedeelde neutrale badge buiten Sync toe als expliciete
negatieve scopecontrole en neem het neutrale Sync-element mee in de bestaande
gerichte aXe-controle zonder incomplete-resultaten.

## Lokale infrastructuur en gates

Een volledige checkout liep tegen ENOSPC; Git ruimde de mislukte worktree zelf
op en de nieuwe branch bleef behouden. Root autoriseert uitsluitend een kleine
no-cone sparse checkout, vooraf minder dan150MiB en minstens100MiB diskreserve.
Geen install. Genegeerde node_moduleslinks mogen naar dezelfde bewezen
dependencies van de bevroren fulltree verwijzen. Alleen tijdens de lokale
toetsing mag een pathguarded assets-symlink naar
`/home/codex/repos/castivo-s235/apps/control/public/assets` bestaan, met
doel-HEAD- en voor/nahashcontrole. Verwijder exact die eigen symlink na de
browsergevallen; nooit stagen of committen.

Eerst patchreview, scoped ESLint en strikte specTypeScript; geen browser,
Nextbuild of DB zonder rootqueue-GO. Daarna exact dezelfde twee Chromiumcases,
390/1440, één worker en nul retries, in een unieke RAMbewijsmap. Bewaar de
oorspronkelijke fouten; meld werkelijke runnerexit en Chromeclosure. Een
onvolledige sparse workspace levert geen volledige foundation-PASS op. De
volledige30/30 foundation en hostedCI blijven gates op de normale geïntegreerde
fulltree/head. Geen algemene AA-, pixel-, volledige V1- of vijfrondenclaim.

## Afsluiting en vrijgegeven releaseprep

Root heeft testpatch en veertien invariantcontroles gereviewd. Scoped ESLint,
strikte specTypeScript en diffcheck zijn groen; dezelfde twee gevallen slagen
2/2 in7,0s (hele opdracht7,619s), één worker, nul retry/skip. Neutraal blijft
in Licht/Donker390/1440 op12,850936:1; vier aXe0violations/0incomplete.
Alle oorspronkelijke andere assertions blijven actief. Runner76350exit0,
Chromium1228/PID1014201 gracefulexit0 en actuele /proc Chrome[]. Alle tijdelijke
dependency-/assetslinks verwijderd en alle16assethashes gelijk.

Oorspronkelijke hosted545/2/629, de pnpm-autoinstallvoorbereidingsabort en de
eerste lokale sparse-fixtureFAIL/1notrun blijven afzonderlijk behouden. Geen
install; de echte beforeAll-compile is vóór de groene browserrun bewezen met
de noodzakelijke bestaande workspace-dependencylinks. TestbronSHA61dc160d…,
groenlogSHA9936a221…; finale eigen doc en RAMproof geven volledige hashes.

Root autoriseert nu uitsluitend een toetsbare gewone commit, push en eigen
draftPR naar `veyocast/s244-integrated-sync-acceptance`, met één korte
artifactattachmentpoging. Geen nieuwe browser/foundationherhaling, mainmerge,
deploy of productwijziging. De Control-producttree blijft exact
`04f1f17b62f02db77e62048f2707fe31ed9f6add`; root neemt de nieuwe head normaal over.
