# S300 databasebewijs

De bevroren forwardmigratie `20261109130824_s300_matchday_runbook_operations.sql` is opnieuw opgebouwd in uitsluitend de geïsoleerde lokale database op poort 64432. De migratie-SHA256 is `7de6f7a9d61700024e5babf9d3da4a826194ab63d58e0187e2c7b68e2801405b`; de eigen SQL-test heeft SHA256 `eb50e6b7836117868a02f5cc4869e1c8a7df63c0d620e8c32c846751f56c462f`.

- 218 migraties vers toegepast, inclusief de echte S299/S298/S296/S301-afhankelijkheden.
- 152 gerichte assertions geslaagd in 4 seconden.
- Alle 154 SQL/RLS-bestanden, 5306 assertions, geslaagd in 126 seconden.
- SQL-lint voor `public,private`: 0 fouten. Beveiligings- en prestatieadviseurs op foutniveau: 0 fouten.

Het machineleesbare bewijs en de hashes van oorspronkelijke en definitieve logs staan in [het bewijsbestand](evidence/s300-matchday-database.json). De echte genormaliseerde RPC-export bevat een conceptwerkplek en preflight met dezelfde revisie 1, plus publicatie, concrete acties, beperkte vrijwilligersprojectie, apparaatopdracht en ontvangstbewijzen. Export-SHA256: `1e88f5fc7b5fa04e12f1002a114531c11fa0ecd38f69b8885346fd071d878680`.

De eerste volledige uitvoering behield twee falende historische introspectieassertions: zij zochten de bestaande catchup-volgorde in de publieke functie, terwijl die nu onveranderd achter de S300-uitleverguard staat. De echte publieke catchup-proeven slaagden. De definitieve lokale assembly gebruikt vijf expliciete historische compatibiliteitsgevallen: drie S301-verwachtingen voor de nu aanwezige runbookadapter en twee verwijzingen naar de bewaarde oorspronkelijke LED-functiebody. Alle assertions blijven actief. De exacte tijdelijke patch staat in `/tmp/s300-historical-test-compat.patch`, SHA256 `acc1ac2235dec8f8de590fd265b98703b0bdfa293f43c19d5f7c595de7b80be1`; de geïntegreerde bron bevat deze vijf compatibiliteitsgevallen na de gewone dependencymerge identiek in de echte testbestanden.

De menu- en mediarecords in deze SQL-proef zijn expliciete toelatingsfixtures. Ze bewijzen de transactie-, tenant-, rechten-, catalogus- en immutable-publicatiegrenzen; ze zijn geen bewijs van fysieke beeldweergave of echte providerwaarnemingen. Browser-, hosted staging- en hardwarebewijs worden afzonderlijk verzameld.

## Lokale herhaling

De bewaarde assembly is `/tmp/veyocast-s296-s298-s299-s301-s300-final`; haar `supabase/config.toml` bindt uitsluitend de lokale poorten 64430–64436 en project `veyocast-s295-verify`. Het volledige bronmanifest staat in `/tmp/s300-final-inputs.json`. Gebruik de frozen workspace-CLI; er zijn geen hosted secrets nodig.

```bash
pnpm exec supabase --workdir /tmp/veyocast-s296-s298-s299-s301-s300-final --network-id supabase_network_veyocast-s291 db start
pnpm exec supabase --workdir /tmp/veyocast-s296-s298-s299-s301-s300-final --network-id supabase_network_veyocast-s291 db reset
PGPASSWORD=postgres psql -X -h127.0.0.1 -p64432 -Upostgres -dpostgres -vON_ERROR_STOP=1 -c 'create extension if not exists pgtap with schema extensions'
docker run --rm --network host -e PGPASSWORD=postgres -v /tmp/veyocast-s296-s298-s299-s301-s300-final:/repo:ro public.ecr.aws/supabase/pg_prove:3.36 pg_prove --host 127.0.0.1 --port 64432 --username postgres --dbname postgres --ext .sql --recurse /repo/supabase/tests
pnpm exec supabase --workdir /tmp/veyocast-s296-s298-s299-s301-s300-final --network-id supabase_network_veyocast-s291 db lint --local --schema public,private --level error
pnpm exec supabase --workdir /tmp/veyocast-s296-s298-s299-s301-s300-final --network-id supabase_network_veyocast-s291 db advisors --local --type all --level error --fail-on error
```

Het geteste lokale exemplaar is na export en registratie van container-, volume- en migratie-identiteit op opdracht van ROOT verwijderd om werkruimte vrij te maken. Alleen container `supabase_db_veyocast-s295-verify` en zijn gelijknamige dedicated volume zijn gestopt en verwijderd; beide consumeragents hadden geen databaseafhankelijkheid meer. Het retirementbewijs staat in `/tmp/s300-database-retirement.json`. De tests zijn rollback-only; de herhaalbare bron, genormaliseerde export en loghashes blijven bewaard.
