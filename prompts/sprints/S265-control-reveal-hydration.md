# S265 — Control wacht ook op gestreamde invoegingen

Dependency-correctie binnen de door de gebruiker gevraagde volledige rebuild.
Basis `177e5d02e5bf953e70676ee7db3fcb9e696c6d04`, eigen branch/worktree
`veyocast/s265-control-reveal-hydration` / `/home/codex/repos/castivo-s265`.

## Ownership

Uitsluitend `patches/next@15.5.20.patch`, `pnpm-lock.yaml`,
`tests/control/control-document-ready.spec.ts`,
`docs/s265-control-reveal-hydration.md`, deze prompt en de eigen S265-ledgerregel.
De patch- en lockwijziging horen expliciet bij deze dependency-taak; packageversies,
integrities en alle overige dependencyrelaties blijven gelijk.

De normale actuele routecontrole reproduceerde zeven React418-fouten. Een apart
gedeclareerde throw-siteproef behield de oorspronkelijke fout en zag bij de throw
een verwachte `div`, een Suspense-commentcursor en twee nog niet ingevoegde
Fizz-nodes terwijl de parser al interactive was. Deze diagnose wijzigde alleen
drie tijdelijke browserresponses en is geen bewijs van een ongewijzigde build.
Alle product-, build-, dependency-, sessie- en 162/Storage/historyguards bleven gelijk.

## Correctie en grenzen

Deze taak breidt de parser-only grens van S250 gericht uit: voor het reeds
gemarkeerde Control-document mag dezelfde gepinde Scheduler daarnaast alleen
lezen of de native Fizz-array `window.$RB` nog entries bevat. De bestaande
8ms-herplanning blijft behouden. Geen queue/cursor veranderen, geen errorfilter,
geen parser/RAF/timer-API vervangen en geen fail-open deadline toevoegen.
Node en ongemarkeerde Marketing/Player-documenten behouden de bestaande bypass.
De twee Schedulerbestanden zijn de enige gewijzigde Next-payloads.

Test de publieke productie- en development-Scheduler deterministisch met een
reeds interactive document en een eindige queue die op een native Node-hostturn
wordt vrijgegeven. De huidige parser-only versie moet de nieuwe contracttest
laten falen; de kandidaat moet slagen. Behoud de vier bestaande echte
SSR/Suspense/browsercases, waaronder een echte mismatch die fout blijft melden.
Een Node-documentstub bewijst de callbackgrens, geen volledige Next-routeacceptatie.

Gebruik een geïsoleerde volledige Next-copy voor de kandidaat. Bestaande
rootdependencies blijven onaangeraakt. Tijdelijke dependencylinks mogen uitsluitend
met exacte readlinkguards worden gemaakt en verwijderd. Geen pnpm run/exec met
automatische installatie via die links. Lock-only gebeurt apart met bytegelijke
manifests en offline/ignore-scripts; alleen patchmetadata/hashnormalisatie mag
de graph gelijk maken. Eén eigen browserworker, nul retries, CPU4,5, heap1024,
eigen RAM-output en de bestaande geheugenondergrens.

Scoped red/green, lint/typecheck, exacte patch-/lock-/payloadreview en gesloten
processen gaan vooraf aan commit. Normale CI, de normale daadwerkelijke installatie,
foundation, productiebuilds en volledige niet-geïnstrumenteerde routes moeten
daarna op de geïntegreerde bron worden uitgevoerd. De vijf complete visuele
rondes en staging/productie blijven open tot die echte gates groen zijn.
