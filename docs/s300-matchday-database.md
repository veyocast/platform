# S300 databasebewijs

De definitieve forwardmigratie `20261109130824_s300_matchday_runbook_operations.sql` is opnieuw opgebouwd vanuit de geïntegreerde bron in uitsluitend de geïsoleerde lokale database op poort 64432. De migratie-SHA256 is `469bc9c75c125dae256f59b7a7fdf366be010681e87f549a1aa6d680ac90b190`; de eigen SQL-test heeft SHA256 `bdf1263cddf75b36f13620835b98085d4a1a18ccb0c3696e4fcf44d02ceffd27`.

- 218 migraties vers toegepast, inclusief de echte S299/S298/S296/S301-afhankelijkheden.
- 154 gerichte assertions geslaagd in 4 seconden.
- Alle 154 SQL/RLS-bestanden, 5308 assertions, geslaagd in 120 seconden.
- SQL-lint voor `public,private`: 0 fouten. Beveiligings- en prestatieadviseurs op foutniveau: 0 fouten.

Het machineleesbare bewijs en alle loghashes staan in [het bewijsbestand](evidence/s300-matchday-database.json). De assembly bevat dezelfde SQL-bytes als de huidige bron: ook de vijf historische compatibiliteitsgevallen staan nu in de echte testbestanden. Er zijn geen tijdelijke testpatches en geen overgeslagen assertions.

## Afzonderlijke bevestigingstijd na herstel

De laatste gerichte correctie voegt uitsluitend `confirmedAt` toe aan de deliveryprojectie. Zonder bevestigd release-ID blijft die tijd leeg; bij herstel hoort hij bij `restored_at`, anders bij `rendered_at`. De oorspronkelijke `renderedAt` blijft beschikbaar als historische frametijd. Daardoor krijgt een herstelde publicatie B niet meer de oude frametijd van A als eigen bevestigingstijd.

Dezelfde nieuwe test op de vorige migratie faalde uitsluitend in de twee nieuwe gevallen 71 en 91; alle 152 overige assertions slaagden. Na de correctie slagen alle 154. De gevallen gebruiken de werkelijke workspace-RPC na herstel van een overlay en na een tijdelijke publicatieperiode, inclusief een eerder werkelijk aangeboden fallback nadat de gewone planning is veranderd.

De nieuwe genormaliseerde export bevat 18 echte RPC-DTOs, met conceptwerkplek en preflight op dezelfde revisie 1, plus publicatie, concrete acties, beperkte vrijwilligersprojectie, apparaatopdracht en ontvangstbewijzen. Export: `/tmp/s300-actual-rpc-confirmed-at-final.json`, SHA256 `d796a8c0963b85cc8cba108985de3a127f1ceb205edab566cc6c856e257c7ab5`. Twee extra werkplekprojecties na het werkelijke herstel staan in `/tmp/s300-restored-confirmation-rpc.json`, SHA256 `815c34c8ba349271f8943775eb84f85bb7a11931041aaa17194ce1361cd9c8e4`. De capture voert 113 assertions uit en rolt daarna alle testgegevens terug.

## Eerdere bewijsronde en grenzen

De eerdere ronde met 152 gerichte assertions en 154 bestanden/5306 assertions blijft volledig bewaard onder `previousValidation` in het bewijsbestand. Die eerdere database is na export en identiteitsregistratie verwijderd op opdracht van ROOT. De huidige nieuwe database en assembly blijven beschikbaar tot ROOT de bronbinding en DTO-validatie heeft afgerond.

De oorspronkelijke volledige ronde kende twee falende historische introspectieassertions: zij zochten de bestaande catchup-volgorde in de publieke functie, terwijl die onveranderd achter de S300-uitleverguard staat. De echte publieke catchup-proeven slaagden. De geïntegreerde bron bevat nu drie expliciete S301-compatibiliteitsgevallen voor de aanwezige runbookadapter en twee verwijzingen naar de bewaarde oorspronkelijke LED-functiebody. Alle checks blijven actief; de eerste foutlogs en exacte toenmalige patch blijven als eerdere bewijsronde bewaard.

De menu- en mediarecords zijn expliciete toelatingsfixtures. Deze SQL-proeven bewijzen transactie-, tenant-, rechten-, catalogus- en immutable-publicatiegrenzen. Ze bewijzen geen fysieke beeldweergave of echte providerwaarnemingen. Browser-, hosted staging- en hardwarebewijs worden afzonderlijk verzameld.

## Lokale herhaling

De huidige assembly is `/tmp/veyocast-s300-confirmed-at-final`; haar `supabase/config.toml` bindt uitsluitend de lokale poorten 64430–64436 en project `veyocast-s295-verify`. Zij bevat ook de ongewijzigde `supabase/templates` waar de config naar verwijst. Het volledige SQL-bronmanifest staat in `/tmp/s300-confirmed-at-final-inputs.json`. Gebruik de frozen workspace-CLI; er zijn geen hosted secrets nodig.

```bash
pnpm exec supabase --workdir /tmp/veyocast-s300-confirmed-at-final --network-id supabase_network_veyocast-s291 db start
pnpm exec supabase --workdir /tmp/veyocast-s300-confirmed-at-final --network-id supabase_network_veyocast-s291 db reset
PGPASSWORD=postgres psql -X -h127.0.0.1 -p64432 -Upostgres -dpostgres -vON_ERROR_STOP=1 -c 'create extension if not exists pgtap with schema extensions'
docker run --rm --network host -e PGPASSWORD=postgres -v /tmp/veyocast-s300-confirmed-at-final:/repo:ro public.ecr.aws/supabase/pg_prove:3.36 pg_prove --host 127.0.0.1 --port 64432 --username postgres --dbname postgres --ext .sql --recurse /repo/supabase/tests
pnpm exec supabase --workdir /tmp/veyocast-s300-confirmed-at-final --network-id supabase_network_veyocast-s291 db lint --local --schema public,private --level error
pnpm exec supabase --workdir /tmp/veyocast-s300-confirmed-at-final --network-id supabase_network_veyocast-s291 db advisors --local --type all --level error --fail-on error
```

De lokale container-, volume-, migratie- en functie-identiteit staan in `/tmp/s300-confirmed-at-docker-certificate.json` en `/tmp/s300-confirmed-at-installed-certificate.json`. Zij bevatten geen omgevingvariabelen, credentials, devicetokens of providerpayloads. Alleen de eigen geïsoleerde database is herstart; hosted databases en andere containers of volumes zijn niet gewijzigd.
