# S187 — Sportlijsthoogte en Royal Current portrait-pariteit

Gebruikersopdracht 23 september 2026: herstel de S180-interpretatie van
schermvullende sportlijsten. Bereken de paginacapaciteit uit inhoudshoogte,
minimumrijhoogte en gap en gebruik daarna één vaste rijhoogte, onafhankelijk van
het actuele aantal zichtbare records. Korte lijsten mogen vrije ruimte overlaten;
pas boven de capaciteit wordt gepagineerd.

Breng daarnaast Royal Current portrait inhoudelijk en visueel op dezelfde grens
als landscape. De informatiehiërarchie blijft volledig: clublogo, context, titel,
clubnaam, datum/tijd, footer en paginering. Reflow en schaal zijn toegestaan,
inhoudsverlies en een aparte vereenvoudigde portraitstijl niet. Verwijder voor de
prijslijst de blauwe sideband en alle gereserveerde railruimte uit React, Static
LG en de Studio-systeemtemplate. Oude Editorial Arena-prijslijstregels mogen
Royal Current niet meer verbergen of overschrijven.

Ownership: `packages/content-templates`, de Static LG-renderer in
`apps/player/app/_lib/lg-legacy-page.ts`, Royal Current Studio-systeemtemplates,
de bijbehorende unit-/Playwrighttests, goldens, screenshots en task ledger. Geen
database-, dependency-, serviceworker-, locked-brand-, tenant-specifieke CSS-,
historische snapshot-, immutable release- of Player-LKG-wijziging.

Verifieer programma, uitslagen, afgelastingen, kleedkamers, officials en standen
voor React en Static LG; bewijs 1, 2, 3, volle pagina en overflow/paginering.
Audit portrait en landscape voor `price_list`, `sport_program`, `sport_results`,
`sport_standing`, `news`, `birthdays` en `arrivals`. Minimaal lint, typecheck,
unit, build, Player, Player-offline, relevante a11y/E2E en de gerichte visuele
matrix. Commit en push alleen met groene lokale gates; uitrol gebruikt de
bestaande beschermde staging- en productieflow.
