# S276 — Leesbare mobiele synchronisatiestatus

Root is de enige writer op `veyocast/s276-screen-health-summary` in
`/home/codex/repos/castivo-s276`. De echte AAL2-capture op8e03 toont in
`?tab=health` vier kolommen van ongeveer79px: publicatienamen, opslag en
PLAYING breken letter voor letter. Het oorspronkelijke beeld blijft behouden:
`7cd659db-5d07-4ed4-acf8-fe8bdb44892e/13-query-2-y-675.png`.

Exclusieve ownership: de bestaande lokale
`apps/control/app/(shell)/dashboard/screens/sync-screen-detail.module.css`,
dit prompt, `docs/s276-screen-health-summary.md` en uitsluitend de eigen
`TASK_LEDGER.md`-regel. Alleen de bestaande Synchronisatiestatus-strip in
dit schermdetail krijgt een leesbare tweekoloms mobiele indeling,
inhoudsgerichte waardetekst en ruimte tot de volgende sectie. Desktop behoudt
vier kolommen. Geen component-, data-, tekst-, command-, Source-, renderer-,
token-, dependency- of Playerwijziging.

Vergelijk de werkelijke gebouwde AAL2-pagina met de exacte tijdelijke CSS bij
390/1440, light/dark en beide bestaande schermen. Meet de kolomindeling,
documentoverflow, volledige tekst/URL-invariant en exact herstel na verwijderen
van de CSS; bekijk oorspronkelijke en gecorrigeerde beelden. Dit is een
native CSS-tegenproef, geen nieuwe appbuild of algemene AA-/providerclaim.
De gebruikelijke exacte CI blijft vereist. Geen implementatiespiegeltest voor
deze lokale omkeerbare CSS-wijziging. Bewaar alle oorspronkelijke failures.

De donkere kandidaatcontrole toont tevens werkelijk onleesbare koppen van de
behouden synchronisatiesecties en direct tegen elkaar geplaatste panelen.
Dezelfde lokale CSS-scope mag daarom vóór commit ook de bestaande
`workspace-section__title` in de donkere retained oppervlakken aan `--vc-text`
koppelen en20px tussen directe opeenvolgende retained secties zetten. Geen
nieuwe panels of nieuwe inhoud; de Source-header en preview blijven gelijk.
Breid de native tegenproef uit met werkelijke solid-backgroundcontrastmetingen
van juist deze koppen en de bestaande tekst-/herstelasserties.
