# S139 — LED Scores feature-rolloutbewijs

## Uitkomst

De zichtbare fout zat vóór Supabase. De tenantdetailpagina presenteerde
`ledscores_realtime`, terwijl `updateTenantFeatureFlag` uitsluitend de
Vector-specifieke `vectorTenantFeatureKeys` accepteerde. Omdat LED Scores niet
in die lijst stond, redirectte iedere geldige aanvraag direct naar de generieke
`featureflag`-fout. Capabilitycontrole, RPC, flag-upsert en audit werden nooit
bereikt.

De ingevulde reden was 359 tekens lang en voldeed dus aan de bestaande grens
van 8–500 tekens. De backend verwacht één tekstveld en geen verborgen
gestructureerd cohortobject. De canonieke sleutel is in UI, database, worker en
Player `ledscores_realtime`; varianten zoals `ledScoresRealtime`,
`ledscoresRealtime` en `led-scores-realtime` zijn ongeldig.

## Bewezen oude requestketen

```text
Control server-rendered form
  -> Next.js Server Action POST met tenantId, flagKey, enabled en reason
  -> lokale Vector-only allowlist weigert ledscores_realtime
  -> frameworkredirect naar ?fout=featureflag
  -> generieke Nederlandse melding
```

Dit is geen losse JSON-API. Het framework transporteert de Server Action via
een POST en rendert de uitkomst na een redirect; er was daarom geen eigen
JSON-responsebody, HTTP-foutstatus of applicatie-trace-ID. De geldige reden zat
wel in het formulier, maar werd vóór authenticatie en databaseaanroep
afgewezen.

Staging en productie draaiden tijdens de reproductie dezelfde immutable SHA
`05995c81a947…`; publieke healthchecks waren groen. Beide omgevingen bevatten
volgens de laatste succesvolle migration dry-run de S132-migratie die de
canonieke LED Scores-sleutel al accepteert. Een verse geauthenticeerde
database-readback was tijdens het onderzoek nog niet mogelijk doordat
Tailscale opnieuw interactieve authenticatie vroeg; daarom is daaruit geen
ongeverifieerde flagstatus afgeleid.

## Hersteld Control-contract

Eén `platformTenantFeatureDefinitions`-catalogus voedt nu zowel de kaart als de
servervalidator. Het formulier verstuurt bovendien:

- exact `yes` of `no`;
- een getrimde reden van 8–500 tekens;
- de actuele flagrevision, waarbij een ontbrekende rij revision `0` is;
- een UUID-request-ID die bij dezelfde browserretry gelijk blijft.

De serveractie roept `set_tenant_feature_flag_v2` aan. Technische fouten worden
alleen gelogd met veilige SQL-/PostgREST-code, featurekey en request-ID. De UI
onderscheidt invoer, rechten, ontbrekende definitie, verwijderde tenant,
revisionconflict, globale noodstop en audit/configuratiefalen. Alleen een
gevalideerde UUID wordt als supportreferentie getoond.

## Database- en securitycontract

De forward-only S139-migratie voegt een revision aan bestaande tenantflags toe
en seedt een private featuredefinitieregistratie. De globale kill switch staat
voor iedere definitie standaard uit. Een private, tenantgebonden receipt-tabel
maakt één request-ID idempotent; de tabel is niet aan browserrollen exposed.

De v2-opdracht:

1. vereist een geauthenticeerde Platform Owner/Admin met AAL2;
2. valideert feature, reden, request-ID en expected revision;
3. lockt request, tenant en tenant-featurebesluit;
4. weigert een ontbrekende definitie, niet-actieve tenant, stale revision of
   actieve globale kill switch;
5. schrijft flag, auditmetadata en receipt in één transactie;
6. retourneert bij een identieke retry hetzelfde resultaat zonder tweede audit;
7. laat RLS, tenant-PK/FK en de bestaande default-uit-resolutie intact.

Een auditexception rolt hierdoor flag én receipt terug. De effectieve LED
Scores-helper vereist daarnaast een actieve tenant, een enabled tenantflag, een
aanwezige definitie én een uitgeschakelde globale noodstop. Geen gewone
playlist, immutable release of last-known-good Playercache wordt geraakt.

De legacy v1-opdracht blijft beschikbaar voor bestaande Control-clients, maar
controleert Platform Owner/Admin en AAL2 nu vóórdat zij locks neemt en delegeert
het besluit daarna aan v2. Een database-invariant verhoogt de revision ook voor
de bestaande beschermde Vector-pilotworkflow; daardoor kan geen tweede
schrijver een zichtbare flag wijzigen zonder een stale formulierconflict te
veroorzaken. De nieuwe effectieve-state-RPC rapporteert uitsluitend voor LED
Scores zowel het opgeslagen tenantbesluit als de werkelijk effectieve status.
Platformrollen mogen die tenantgericht lezen; een tenantlid uitsluitend voor de
eigen tenant. De LED Scores-beheer- en Studiopagina's baseren hun controls op
die effectieve status en sluiten daardoor ook bij de globale noodstop fail-closed.

## Veilige foutmapping

| Interne code | UI-uitkomst |
|---|---|
| `42501` | vereiste platformrol/AAL2 ontbreekt |
| `23514` | formulier of rolloutinput ongeldig |
| `42704` / `PGRST202` | featuredefinitie of hosted migratie ontbreekt |
| `P0002` | tenant ontbreekt |
| `PT409` / legacy `40001` / `23505` | stale revision of conflicterend request |
| `55000` | globale kill switch blokkeert vrijgave |
| `PT500` / legacy `23503` | auditregistratie faalde; de transactie is teruggedraaid |
| overige / ontbrekende response | uitkomst onzeker; eerst verversen en de actuele status controleren |

Raw databaseberichten, stacktraces, tenant-ID's, actor-ID's en credentials
worden niet aan de gebruiker of in deze evidence opgenomen.

## Verificatie en release

De definitieve gate- en deploymentuitslagen worden vóór promotie in deze tabel
vastgelegd.

| Gate | Status |
|---|---|
| Control unit, lint, typecheck en productiebuild | groen; 49 bestanden / 264 tests en server-only bundelcontroles |
| Verse database-reset en gerichte pgTAP | groen; S139 67/67, Vector-pilot 18/18, Venue/v1 25/25 en bestaand LED 54/54 |
| Volledige workspace lint/typecheck/test/build | groen; 30/30, 30/30, 30/30 en 18/18 |
| Volledige RLS | groen; 67 bestanden / 1.481 assertions |
| A11y | groen; 36 geslaagd, 1 conditionele live-skip |
| Live Control-rolloutjourney | groen; login, AAL2, redenvalidatie, HTTP 409-conflict, vrijgave, platformreadback en tenant-eigen beheerreadback in Chromium |
| Volledige Chromium-E2E | 179 geslaagd, 21 bewuste live/visual-skips; één algemene mobiele test time-outte tijdens een automatische Next-devserverherstart en slaagde direct geïsoleerd 1/1 |
| Immutable VPS staging en smoke | nog uit te voeren |
| Immutable VPS productie en smoke | nog uit te voeren |
| Duindorp SV vrijgave en tenantisolatie-readback | nog uit te voeren |

## Rollback

De operationele rollback is dezelfde geauditeerde Control-actie met een nieuwe
reden en actuele revision: `Tenant uitschakelen`. Daardoor stoppen nieuwe
workerclaims en Player-bootstrapdata tenantgebonden, terwijl bestaande
last-known-good playback intact blijft. Bij een applicatieregressie wordt de
vorige immutable VPS-release teruggezet; de additieve tabellen en revisionkolom
blijven staan zodat audit- en idempotencybewijs niet verloren gaat. Een
destructieve downmigratie is geen normale rollback.
