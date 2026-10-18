# Beperkt sponsoroverzicht en auditfilters — S229

De bestaande sponsorpagina laadde kansen en taken, maar toonde alleen
faseaantallen en een totaalaantal open taken. Het canonieke scenario
`sponsors.crm` vraagt om de bestaande records te filteren en te openen.
`Pipeline en taken` toont nu de bestaande naam/titel, fase/status, vastgelegde
waarde en opvolgdatum. Een read-only detailSheet opent dezelfde geladen regel.
Dit is de beperkte weergave uit L25; nieuwe CRM-CRUD en providers horen hier
niet bij.

De primaire Sync-campagnekaarten en bestaande sponsor-, goedkeurings- en
publicatiebediening blijven behouden. De aanvullende weergave staat onder
het bestaande `#kansen`-doel in het sponsorbeheer. De gekozen Source-stijl
gebruikt dezelfde semantische oppervlakken, teksten en bediening; alleen de
ontbrekende taak wordt toegevoegd. Eén gedeelde FilterBar bundelt naamzoeken,
kansfase en taakstatus. Mobiel worden dit opeenvolgende rijen en een Sheet,
met 44px acties en terugfocus op de geopende regel. Een gemeten contrastfout
van de algemene successpill (4,32:1) is uitsluitend binnen deze nieuwe
weergave opgelost met bestaande tekst-/oppervlaktetokens, zonder gedeelde CSS
of tokens te veranderen.

## Gegevens- en permissiongrens

De route vereist de bestaande `tenant.sponsor.read`-capability. De nieuwe
loader gebruikt de normale authenticated Supabase-client, expliciete
`tenant_id` op beide tabellen en de bestaande RLS. Zoeken en fase/status
worden op de server toegepast; kansen en taken hebben afzonderlijke pagina's
van 25 regels en exacte gefilterde totalen. Een stabiele tweede sortering op
`id` voorkomt willekeurige volgorde bij gelijke datums. Een filteraanpassing
begint op pagina één; paginalinks bewaren de andere lijstfilters.

Ontbrekende bedragen/datums blijven onbekend. Een fout in één query maakt
het overzicht zichtbaar onbeschikbaar in plaats van gedeeltelijk succes te
claimen. Een handmatig ongeldige pagina buiten de actuele resultaatverzameling
wordt door de bestaande PostgREST-rangegrens geweigerd; opnieuw toepassen van
de filters start vanaf de eerste pagina. De twee queries bevatten geen
schrijfopdracht, nieuwe tabel, service-role of providerconfiguratie.

## Letterlijke auditzoektekst

De eigen rolacceptatie vond een concrete oude filterfout: `_` en `%` werden
uit de invoer verwijderd. `tenant.custom_role` en `tenant_custom_roles`
vonden daardoor nul bestaande rolgebeurtenissen. Bovendien interpreteert
PostgREST `*` als een ILIKE-wildcardalias.

De twee auditfilters gebruiken nu `imatch` met volledig escaped letterlijke
regextekst. Dit bewaart hoofdletterongevoelig substringzoeken; `_`, `%`, `*`,
backslash en regex-/filtertekens verbreden de query niet. De tenantpredicate,
bestaande range 50, sortering en foutafhandeling zijn gelijk gebleven.
De nieuwe sponsorzoekfilters gebruiken dezelfde letterlijke patternsemantiek
binnen hun eigen afgebakende helper.

## Bewijs en begrenzing

- Workspace lint, typecheck en unit: elk 30/30 tasks groen; Control 852 tests
  groen en 34 bestaande conditionele skips. Sponsorfilters/read-boundary:
  11 tests; audit: 18 gedragscases, waarvan 17 eerst rood op de oude code.
- `tests/control/sites-screens-sponsors-crm.spec.ts`: werkelijke
  productiecomponent met gecontroleerde HTTP-data; gevulde lijst, filters,
  read-only detail, Escape/terugfocus, paginering, leeg/fout, reflow op
  320/390/1440 en axe WCAG2.2AA: 5/5 groen. Samen met de bestaande
  Engage-/sponsorcomponentgates is de finale gerichte browserrun 15/15 groen.
  De finale concrete CI-resultaten staan bij de PR.
- Echte bestaande AAL2-gebruiker → daadwerkelijke nieuwe CRM-loader → lokale
  PostgREST: zes GET's, beide expliciete tenantfilters/range25, ongefilterd,
  letterlijk speciale tekens en fase/status. De werkelijke tenant heeft nul
  kans-/taakrecords; dit bewijst de echte lege dienstgrens, geen gevulde
  live-CRM-journey. Geschoonde lokale readback:
  `/tmp/veyocast-s229-crm-real-readback.json`.
- [Custom rol en auditfilters](../../execution/evidence/custom-role-final.json):
  eigen ongebonden rol werkelijk maken/heropenen/bijwerken/heropenen/archiveren;
  drie echte actor-/objectgebonden auditregels. Exacte underscorefilters
  vóór correctie nul, na correctie drie via de productie-loader en echte
  PostgREST. Speciale tekens blijven beperkt, met positieve SELECT-only
  PostgreSQL-constantechecks. De bestaande RLS-tests bewijzen afzonderlijk
  effectief toegewezen-gebruikerrechten; deze QA wijzigde geen actorrollen.
- [Media archiveren/herstellen](../../execution/evidence/media-archive-restore-final.json):
  één nieuwe eigen ongebruikte PNG, echte upload/archive/Archief/restore,
  dezelfde asset-ID en private bytes. De 17 eerdere assets, 46 varianten,
  zeven releases en flags bleven gelijk. Gebruikte-objectimpact en vreemde
  tenants blijven afzonderlijke SQL-grenzen.

Reproduceer de gerichte gates met:

```sh
pnpm lint
pnpm typecheck
pnpm test
PLAYWRIGHT_EXTERNAL_SERVERS=1 PLAYWRIGHT_APPS=control CONTROL_PORT=3369 \
  pnpm exec playwright test tests/control/sites-screens-sponsors-crm.spec.ts \
  tests/control/sites-engage-sponsors-workflows.spec.ts --project=chromium
```

Die browsercomponenttests onderscheppen uitsluitend hun eigen test-URL en
hebben geen QA- of productieauth nodig. Er is geen lokale volledige Next-build
uitgevoerd wegens beperkte schijfruimte; de normale CI bouwt het definitieve
artifact. Deze aanvulling is geen verklaring dat alle V1-scenario's, gevulde
Sourcepixels, eerste Control-storebootstrap, providers of fysieke apparaten
volledig zijn geaccepteerd. Alleen root beheert integratie en de bestaande
geautoriseerde staging-/productieflow.
