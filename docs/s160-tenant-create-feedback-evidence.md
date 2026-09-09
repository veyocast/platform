# S160 — Betrouwbare terugkoppeling bij verenigingsaanmaak

Status: `READY_FOR_INTEGRATION`

Datum: 9 september 2026

Branch: `veyocast/s160-tenant-create-feedback`

Baseline: `5bd5fdde1d0dbb3f86c05ca904447a970f40bac7`

## Diagnose

De gemelde klik heeft de backendopdracht aantoonbaar volledig uitgevoerd. De
stagingreadback toont één actieve vereniging met provisioningstatus `ready`, de
expliciet gekozen tenant-owner-toegang, een pending eigenaaruitnodiging met
deliverystatus `sent` en succesvolle provisioning- en delivery-auditevents.
De AAL2- en platformrolcontroles zijn daarmee eveneens gepasseerd.

Het functionele gebrek zat in de browserterugkoppeling: de submit had geen
pendingstatus terwijl de action op e-maildelivery wacht, een verloren
navigatierespons liet geen veilige hersteltekst zien en foutredirects richtten
het viewport op het formulier terwijl de foutmelding erboven stond. De
transactionele provisioning-RPC en relatieve succesredirect zijn niet de bron
van een `localhost`-URL.

## Correctie

- Een kleine clientgrens leest `useFormStatus`, schakelt de submit tijdens de
  request uit en verandert het label zonder layout- of commandowijziging.
- Na acht seconden verschijnt een rustige live status die vraagt eerst te
  vernieuwen en de definitieve status te controleren voordat opnieuw wordt
  geklikt.
- Bekende fouten staan nu binnen `#nieuwe-tenant`, zodat de bestaande
  fail-redirect oorzaak, gevolg en herstel zichtbaar maakt.
- AAL1 houdt alle server- en databasegrenzen intact, maar krijgt op de plek van
  de submit een directe MFA-herstelactie.
- De headerlink is voortaan een secundaire `Naar formulier`-actie; de echte
  creatie blijft de enige primaire mutatie.

## Veiligheidsgrenzen

Er is geen database- of migratiewijziging. De bestaande capabilitycheck,
server-side AAL2-eis, database-AAL2-guard, idempotency key, RLS,
invitationtokenbinding en audit blijven byte-ongewijzigd. De al aangemaakte
stagingvereniging is niet opnieuw aangemaakt of gemuteerd.

## Verificatie

- Control unit: `67` bestanden en `388` tests groen, inclusief de gerichte
  componenttest `3/3`.
- Workspace lint, typecheck en unit: elk `30/30` taken groen.
- Control productionbuild en auth-/client-secretgrenzen: groen.
- Gerichte tenantbeheer-a11y, inclusief de fragmentgebonden foutstatus: groen.
- Desktop- en mobiele readback: foutmelding en formulierfragment zichtbaar,
  semantische tokens behouden en geen horizontale overflow geïntroduceerd.
- De brede browsermatrix wordt na integratie met de aansluitende opdracht
  opnieuw op de uiteindelijke releasepatch uitgevoerd; PR/CI en exact-SHA
  deploymentreadback volgen daarna.

## Afzonderlijke operationele bevinding

De eerder gemelde mobiele `localhost`-pagina hoort bij de ontvangen
Supabase-uitnodigingslink en niet bij de create-submit. Hosted staging moet
`https://staging-control.veyocast.nl` als Site URL gebruiken,
`https://staging-control.veyocast.nl/auth/confirm` toelaten en de repository-
invite-template voeren. Die hosted Auth-instelling valt buiten deze codepatch.
