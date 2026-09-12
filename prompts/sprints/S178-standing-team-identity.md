# S178 — Werkelijke Sportlink-standidentiteit en synchronisatieduur

## Analyse

Productie-readback na S177 toont de juiste beker-/jeugdpoule, maar nul rijen.
`poulestand` laat `teamcode` weg; de bestaande mapper maakt SHA-256 van
`standing-team` + NUL + exacte teamnaam. De selectie vergelijkt die tijdelijke
rij-ID uitsluitend met de numerieke ID uit `teams`. Daardoor wordt openbare
standdata ten onrechte als ontbrekend behandeld. Dit raakt ook bestaande cache.

De nieuwe completiondiagnostiek toont SQLSTATE 57014. De bronupdate bouwt alle
latest-slides binnen dezelfde RPC. Tien clubprogrammaslides kosten in productie
3,37 seconden. De oude wrapperketen en queryplannen worden lokaal geprofileerd
voordat de verwerking wordt aangepast.

## Plan en ownership

- Bestaande tenant-/bron-/pouleresolver behouden; een interne identiteitshelper
  accepteert provider-ID of de bewezen mapper-ID plus exacte unieke actieve
  teamnaam in dezelfde bron. Geen fuzzy naamkoppeling of nieuwe teamtabel.
- Forward-migratie in `supabase/migrations/*s178*` herstelt resolver, standbuilder
  en alleen aantoonbaar onnodig werk in de bestaande snapshot/completionketen.
- `supabase/tests/rls_s178*` test echte naamgebaseerde bronrijen, expliciete
  afwijkende IDs, ambiguïteit, tenant/bron/poule/fase, actuele beker en jeugd,
  snapshotpariteit en verwerking op productieomvang. Mappercontracttest in
  `packages/integrations/test/sportlink.test.ts`.
- Docs: dit promptbestand, `docs/integrations/dynamic-slide-management.md`,
  `TASK_LEDGER.md`. Geen applicatie-/UI-/Player-/dependencywijziging voorzien.
- Alleen opvolgende snapshots van gepubliceerde latest-versies queue-en;
  bestaande drafts, snapshots, releases en LKG niet herschrijven.

## Verificatie en uitrol

Lint, typecheck, unit, verse lokale database-reset, volledige RLS en relevante
build. Lokale profielmeting vóór/na; production-readback van echte standrijen
én succesvolle nieuwe synchronisatie. Commit/PR, CI, staging en expliciet
reeds geautoriseerde productiepromotie via de bestaande immutable VPS-workflow.

## Implementatiebesluit

De profiletrace bevestigt 18.530 databasecontroles voor tien snapshots met 1.000
kandidaatwedstrijden. S153-refill en S158-projectie gebruiken nu dezelfde vooraf
opgehaalde actieve tenant-/bronteamselectie. De rijpredicate is puur en behoudt
de oude helper als pariteitsreferentie. Geen timeoutverhoging, nieuwe queue of
verruimde autorisatie. Lokale complete snapshotbouw: 2,60 → 0,40 s.
