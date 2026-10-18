# S229 — Resterende rebuildacceptatie: sponsoroverzicht en letterlijke auditfilters

## Opdracht en basis

De volledige Sync V1-startopdracht vraagt dat bestaande beperkte sponsor-
kansen/taken kunnen worden gefilterd en geopend. De huidige pagina laadt die
tenantgegevens maar toont alleen aantallen. Basis is exact S227 `dc50b77062f3ee54233315234dba3c667be2aecf`;
S227 blijft ongewijzigd. Eén branch/worktree/PR: `veyocast/s229-sponsor-crm-overzicht`.

De echte eigen custom-roleacceptatie vond bovendien dat de auditzoekhelper
letterlijke underscores verwijdert. Herstel die specifieke filtergrens zonder
tenantfilter, querylimiet of RLS te wijzigen. Neem het geschoonde eigen
media-archive/restore- en custom-rolebewijs mee.

## Normatieve aansluiting

- Leesvolgorde uit AGENTS.md, officiële design-/Publishercanons en
  `docs/sync-v1-rebuild/handoff/docs/V1-REBUILD-CANON.md`.
- `LOGICA-PARITEITSMATRIX.md`, L25 / `sponsors.crm`: bestaande kansen/taken
  filteren/openen, expliciet een beperkt overzicht; geen nieuw volledig CRM.
- Behoud de gekozen Sync Source-stijl en de bestaande campagnekaarten;
  vervolgbediening blijft onder `#kansen` in het behouden sponsorbeheer.
- Eén compacte zoek-/filterbalk, tekststatussen, named open-acties en de
  gedeelde Sheet voor read-only inspectie. Op mobiel sequentiële rijen met
  minimaal 44px bediening, geen mini-desktoptabel. Alleen semantische tokens.

## Exclusieve ownership vóór code

`release_audit` schrijft uitsluitend:

- `apps/control/app/(shell)/dashboard/sponsors/**`;
- `tests/control/sites-screens-sponsors*.spec.ts` en passende sponsor-unitfixture/tests;
- dit sprintprompt;
- `docs/sync-v1-rebuild/SPONSOR-CRM.md`;
- `TASK_LEDGER.md`, uitsluitend de eigen S229-entry;
- `execution/scenario-acceptatie.csv`, uitsluitend `sponsors.crm`, `content.archive`
  en de relevante `team.roles`-regel;
- `execution/evidence/media-archive-restore-final.json` en
  `execution/evidence/custom-role-final.json`, uitsluitend geschoonde bewijzen.

`binary_review` schrijft exclusief, zonder eigen commit:

- `apps/control/lib/control-overview.ts`, uitsluitend `escapeAuditLike` en
  noodzakelijke `loadTenantAuditEvents`-filteraanroepen;
- nieuw `apps/control/lib/audit-filter.test.ts`.

Geen package/lock/database/workflow/token/shared-CSS-wijzigingen. De hoofdagent
doet één frozen install; geen parallelle installs. Stop/report bij ruimere scope.

## Functionele grenzen

- Gebruik uitsluitend de bestaande geauthenticeerde `sponsor_opportunities` en
  `sponsor_tasks`-query onder `tenant.sponsor.read` en expliciete tenant_id.
- Toon bestaande naam/titel, status/fase, geregistreerde waarde en datum;
  ontbrekende waarden blijven onbekend. Geen verzonnen records, omzetclaims,
  CRM-provider, CRUD, wijzigingen aan bestaande rijen of nieuwe tabellen.
- Zoek en filter de geladen, begrensde gegevens eerlijk; een onvolledige
  serverlijst moet als zodanig zichtbaar zijn. Geen stil verlies boven limieten.
- Auditfilters behandelen `%`, `_`, backslash en PostgREST `*` als letterlijke
  invoer, met behoud van substringzoeken, tenant/RLS en bestaande range 50.
- QA gebruikt bestaande lokale diensten/readbacks, uitsluitend eigen records;
  geen mail/uitnodigingen, actorroltoewijzingen, flagwijziging of productionactie.

## Gates en integratie

Gerichte regressie voor werkelijke componenten: zoeken/fase-/taakstatusfilter,
details openen/sluiten/toetsenbord, leeg/fout/read-only, mobiel/desktopreflow en
a11y. Auditregressie én echte lokale PostgREST-readback met literal wildcards.
Workspace lint/typecheck/unit; relevante browser/a11ygates. Geen lokale volledige
productiebuild wegens schijfruimte: volledige build en brede gates via CI.

Normale toetsbare commit/push; geen force-push, rebase/amend of eigen merge.
Volgens roots laatste timinginstructie mag de draft-PR na groene lokale gates
gestapeld worden aangemaakt met base `veyocast/s227-native-sync-studio`, daarna
PR attachen. Root zet de base na de normale S227-mainmerge om en verifieert de
merge-tree; geen eigen merge/rebase/amend of automatische bewijshergebruikclaim.
Root beheert merge en geautoriseerde staging/productie. Geen volledige V1-,
provider-, store- of hardwareacceptatie afleiden uit deze beperkte gates.
