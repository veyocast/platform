# S207 — native testprocessen betrouwbaar opruimen

S204 PR-run `38326095201` had drie echte opeenvolgende native testfouten: de runtime-deadlinetest overschreed zijn 8 seconden, de onresponsive-producertest faalde en vervolgens faalde de echte runtime-CLI-annuleringstest. De Foundationjob bleef daarna hangen tot de bestaande grens van 45 minuten en eindigde als `CANCELLED`. De oorspronkelijke log en het oorspronkelijke bewijsindex blijven behouden; S204 heeft dus geen volledig groene PR-run. De afzonderlijke Sites-run was wel volledig groen. De read-only operationele meting op main is uitgevoerd na de groene relevante lokale opscontroles en onafhankelijke review, vóór deze volledige PR-uitkomst; die uitzondering bewijst geen groen CI-resultaat.

De oude fixture wachtte onbeperkt op het sluiten van top-level childprocessen. Zij registreerde de afzonderlijke SQL-groep bovendien pas na een gereedheidsmarker. Een eerdere assertionfout, ontbrekende marker of testtimeout kon daardoor opruiming missen. Dit is een concrete broncodefout. De bewaarde CI-log bewijst niet welke ontbrekende marker of achtergebleven proces de historische job precies vasthield; gedeelde lockvergiftiging blijft een hypothese.

Alleen `scripts/probe-with-quiesced-worker.test.mjs` verandert. De fixture registreert native subprocessen vóór gereedheidsobservatie, bindt opruiming aan de testcontext, geeft normale helperannulering eerst gelegenheid om dezelfde worker te herstellen en beëindigt daarna uitsluitend aantoonbaar eigen PID/groepen. Linux-startidentiteiten voorkomen een kill na PID-hergebruik. Afzonderlijk geregistreerde SQL-groepen en late descendants worden meegenomen, ook na het verdwijnen van hun leader. Opruiming is begrensd en idempotent, inclusief het werkelijk uitgevoerde geneste fouttestproces. Een verwachte spawnfout kan andere opruiming niet overslaan.

De vier nieuwe regressies voeren echte falende subprocessen uit voor een ontbrekende marker, late marker, contextabort en assertionfout na leader-exit. Elk moet met code 1 en de concrete oorspronkelijke fout eindigen, alle geregistreerde eigen processen stoppen en een onafhankelijk levend proces behouden. De 37 bestaande veiligheidsgevallen blijven behouden: herstel vóór annulering, oorspronkelijke 143/124-uitkomsten, aparte SQL-groep en descendant gestopt, geen latere REST-read, gemaskeerde uitvoer en artifactpariteit. De bestaande 6/8-seconden-tests, observatiegrens en productie-operationele plafonds veranderen niet.

Validatie van de bevroren test SHA-256 `12b2483a9f9b3f2e8e90ccb36628d3d9226fcc103c02d654a9969aa92edb1184`:

- Native fixture: 41 PASS, 0 FAIL, 0 SKIP; gerichte ESLint en diffcheck exit 0.
- Volledige bestaande VPS-validator: 226 PASS, 0 FAIL, 0 SKIP, werkelijk uitgevoerd.
- Workspace lint, typecheck en test: elk 30/30 taken geslaagd; cachehergebruik wordt afzonderlijk in de CI-bewijzen vermeld.
- Geen helper-, app-, database-, dependency-, workflow-, lease- of Playerwijziging.

S205 heeft afzonderlijk volledig groene PR- en Sites-runs `38327029307` en `38327029276` op de exacte geteste mergeboom. Deze testreparatie bewijst geen productieherstel. De productie draait nog de vorige applicatie `18e53d89`; de S198-indexmigratie liep bij de vorige uitrol tegen `57014` aan. Exacte CI, finale staging/productie, opruimreadbacks en twee werkelijk verschuldigde gewone ververscycli blijven vereist.
