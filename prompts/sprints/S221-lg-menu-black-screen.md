# S221 — Zwart OnzeTrots-menu op LG herstellen

Onderzoek de echte nieuwe publicatie op de gekoppelde LG: opdracht, inhoud,
checksumverificatie, canonieke HTML/CSS en zichtbare frame-activering. Reproduceer
de oorzaak met dezelfde genormaliseerde menuconfiguratie en LG-runtime; herstel
het concrete probleem en voeg een regressie toe. Publicatie-status is geen
bewijs van zichtbaar beeld. Behoud bestaande content en immutable releases.

Ownership: apps/player/app/_lib/lg-sites-runtime.ts, lg-sites-css.ts,
lg-legacy-page.ts en hun tests, player-sites-markup.tsx/tests,
menu-widget-canonical-fixture.ts en een gerichte nieuwe fixture;
tests/player/lg-sites-composition.spec.ts en een gerichte nieuwe LG-menu-spec;
packages/content-templates/src/sites-menu-widgets-* en bijbehorende gerichte
renderer-/browserproeven wanneer de diagnose daarheen leidt;
PLANS.md, TASK_LEDGER.md en docs/s221-lg-menu-black-screen.md.

Geen credentials, device-tokens of service-role-materiaal in fixtures of browser.
Geen wijziging van locked assets, dependencies, migraties, live providers,
LKG-verificatie of immutable publicatie. De bestaande sessieautorisatie voor
herstel, commit, push, PR/merge en staging-/productiedeployment geldt. Alle
vereiste checks moeten groen zijn vóór expliciete merge; gebruik geen auto-merge.
