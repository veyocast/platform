# S138 — Verjaardagswizard selectie en readiness

## Doel

Maak de Sportlink-verjaardagswizard begrijpelijk en bruikbaar: een compacte,
doorzoekbare meerkeuzeselectie voor teams en personen zonder team, een
expliciete keuze voor liggend of staand, en precieze publicatievoorwaarden die
geen werkende module of ingebouwde vormgeving ten onrechte als ontbrekend
melden.

## Ownership

- de Sportlink-verjaardagswizard en routespecifieke styles/tests in Control;
- het verjaardagconfiguratiecontract en de gedeelde Player-resolver;
- één forward-only snapshotbuildermigratie en gerichte RLS-regressies;
- de live verjaardag-E2E en S138-documentatie.

## Implementatiegrenzen

- `Alle` groeit automatisch mee en omvat standaard ook personen zonder exact
  gekoppeld team;
- `Overige (zonder team)` is afzonderlijk selecteerbaar en combineerbaar met
  één of meer teams;
- team-ID's blijven uitsluitend privacyvrije filtermetadata; `Team tonen`
  bepaalt los daarvan of teamnamen zichtbaar zijn;
- oude configuraties en reeds gepubliceerde snapshots blijven afspeelbaar;
- nul actuele pagina's is geen authoringfout: de levende slide mag bestaan en
  wordt door de Player veilig overgeslagen totdat geldige data beschikbaar is;
- alleen een actieve verbinding, feature, geslaagde synchronisatie en een
  daadwerkelijk gepubliceerde ingebouwde vormgeving blokkeren of ontsluiten de
  create-command;
- historische immutable snapshots en releases worden niet gewijzigd;
- deployment gebruikt één immutable build van de gemergede `main`-SHA, eerst
  staging en daarna productie via de bestaande VPS-runbookroute.

## Gates

Gerichte contract-, Control- en Player-unitregressies, `pnpm db:reset`, de
volledige RLS-suite, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
`pnpm test:a11y`, Chromium E2E, Player- en offlinegates, gevolgd door
staging/production health-, template- en verjaardagstatusreadback.
