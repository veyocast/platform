# S114 Menu Studio rollout-CLI bewijs

De production-run `32536924919` stopte fail-closed met exitcode 127 omdat
`psql` niet op de runner aanwezig is. De fout trad op bij de eerste
databasecontrole; de owner-only mutatiefunctie is niet aangeroepen en geen flag
is door deze run gewijzigd.

S114 checkt de dispatch-SHA uit, installeert de workspace-gelockte Supabase CLI
en gebruikt `supabase db query`. Workflowteksten worden eerst als base64
gecodeerd en uitsluitend met PostgreSQL `decode` plus `convert_from` terug naar
UTF-8 vertaald. Migratiecontrole, guarded functieroep en exacte readback staan
in één `DO`-statement. Iedere exception draait daarmee de gehele statementmutatie
terug.

Lokale verificatie op 22 augustus 2026:

- de exacte atomische SQL-vorm is tegen de lokale Supabase-database uitgevoerd;
- de `read`-flag en bijbehorende audit zijn toegepast en daarna gecontroleerd
  teruggedraaid;
- de bestaande execute-ACL en dependencyvolgorde blijven in de S113-migratie en
  30 gerichte pgTAP-assertions afgedwongen;
- GitHub Actions/actionlint, workflow-securitycheck en diffcheck zijn groen.

Na merge wordt de nieuwe main-SHA opnieuw naar staging en production
gedeployed. Pas daarna wordt de production-rollout voor Duindorp SV vanaf
`read` hervat.
