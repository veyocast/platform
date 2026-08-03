# S89 Sportlink team- en competitiekeuze

## Uitkomst

De Teams-synchronisatie liep vast wanneer Sportlink hetzelfde `teamcode`
meerdere keren terugstuurde voor bijvoorbeeld de reguliere competitie en de
beker. Eén set-based upsert probeerde daardoor dezelfde unieke teamrij tweemaal
in dezelfde PostgreSQL-opdracht bij te werken. PostgreSQL weigerde de volledige
opdracht; de worker vertaalde die databasefout terecht naar de veilige,
generieke `SPORTLINK_SYNC_INTERNAL_ERROR`.

De keten normaliseert nu:

- één canoniek team per externe teamcode;
- maximaal veertig afzonderlijke competitie-, beker-, fase- en poulecontexten
  per team;
- dubbele match- en activiteitenidentiteiten vóór dezelfde set-based upsert;
- een defensieve tweede normalisatie aan de databasegrens, zodat een oudere
  worker de fout niet opnieuw kan veroorzaken.

De migratie zet uitsluitend eerder intern mislukte, ingeschakelde
Teams-beleidsregels direct opnieuw klaar. Bestaande genormaliseerde data,
snapshots en immutable Playerreleases worden niet verwijderd of gewijzigd.

## Slide-authoring

Programma, uitslagen en de overige wedstrijdgedreven Sportlink-slides bieden
nu twee expliciete keuzes:

1. alle teams of één gesynchroniseerd team;
2. alle contexten of één benoemde combinatie van competitie/beker, naam,
   fase/klasse en poule.

Control laadt teams, wedstrijden en synchronisatiestatus in begrensde batches
zonder query per team. De server action accepteert alleen begrensde externe
identiteiten en de database valideert bron, tenant, team en competitie opnieuw.
De selectie wordt vóór `maxItems` toegepast en samen met de leesbare labels in
de immutable snapshot bevroren. De Playerprovider- en offlinecontracten
veranderen niet.

## Regressiebewijs

- Mapper: één team met competitie- en bekerregel levert één team met twee
  contextopties.
- Database: twee gelijke teamconflicts voltooien succesvol als één rij met twee
  contexten.
- RLS/commandgrens: een onbekend of tenantvreemd team wordt met SQLSTATE
  `23514` geweigerd.
- Snapshot: alleen de gekozen team-/competitiewedstrijd wordt bevroren en de
  geselecteerde identiteiten blijven in de snapshot aantoonbaar.
- Control: competitie-, fase- en poulelabels blijven gekoppeld wanneer
  Sportlink afwijkende wedstrijd- en teamidentiteiten gebruikt.

## Lokale gates

- `pnpm db:reset`: groen op de volledige migratieketen.
- `pnpm test:rls`: 45 bestanden, 869 assertions groen.
- `pnpm lint`: 28/28 workspacetaken groen.
- `pnpm typecheck`: 28/28 workspacetaken groen.
- `pnpm test`: 28/28 workspacetaken groen, waaronder 43 integrations-, 70
  worker- en 134 Control-tests.
- `pnpm build`: 17/17 workspacetaken groen; alleen de reeds bestaande
  autoprefixerwaarschuwingen in schermautomatisatie-CSS bleven zichtbaar.
- `pnpm test:a11y --project=chromium`: 34/34 groen met Control, Marketing en
  Player actief.
- `pnpm test:e2e --project=chromium`: 132 groen en 8 bewust overgeslagen.
  Twee belastinggevoelige Control-shellscenario's time-outten tijdens vier
  parallelle workers en slaagden daarna samen, geïsoleerd en serieel, 2/2.

Conform de opdracht is deze branch niet gepusht of gedeployed.
