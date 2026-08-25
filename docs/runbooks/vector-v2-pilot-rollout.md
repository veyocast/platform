# Vector v2 pilot rollout

Dit runbook activeert of deactiveert de zichtbare Vector v2-ervaring als één
geauditeerd tenantprofiel. Het wijzigt geen tenantrollen, Player-contracten of
content. YouTube blijft afzonderlijk gated totdat de officiële providerconfiguratie
en fallback zijn gevalideerd.

## Voorwaarden

- De geteste release staat op `main` en draait al op de doelomgeving.
- Migratie `20260825174328_s124_vector_pilot_rollout.sql` is toegepast.
- De GitHub-environment heeft `SUPABASE_DB_URL` en de bestaande deployment approvals.
- De operator kent de exacte zichtbare tenantnaam; de workflow weigert nul of
  meerdere matches en een niet-actieve tenant.

## Activeren

Start **Vector v2 pilot rollout** vanaf `main` met:

- `target_environment`: eerst `staging`, daarna `production`;
- `tenant_name`: exacte naam, voor de huidige pilot `Duindorp SV`;
- `action`: `enable`;
- `release_sha`: volledige SHA die de health-endpoint teruggeeft;
- `reason`: concrete auditreden;
- `confirmation`: `VECTOR PILOT`.

De workflow verifieert de release, activeert zeven productieklare flags atomisch
en leest dezelfde toestand rechtstreeks terug. Een identieke retry verandert
niets en schrijft geen extra auditmutatie.

## Controleren

Na een geslaagde workflow:

1. open Control opnieuw voor de pilottenant;
2. controleer de donkere Vector-rail en `Living Venue OS` in de shell;
3. controleer System Pulse op `/dashboard`;
4. open `/dashboard/screens` en controleer de zichtbare tabs **Venue Twin** en
   **Gezondheid**;
5. controleer dat Venue Twin zonder venue een eerlijke setupstaat toont en geen
   fictieve locatie;
6. controleer de auditactie `vector.pilot_profile.updated` via het bestaande
   platformauditoverzicht.

## Kill switch

Voer dezelfde workflow uit met `action: disable`. Alle zeven profielen worden
atomisch uitgezet. Opgeslagen venue- en Engage-data blijft behouden, maar wordt
niet meer als pilotervaring aangeboden. De bestaande Control-ervaring blijft
beschikbaar.

## Profiel

Het profiel bevat:

- `vector_v2_design_system`;
- `vector_v2_control_shell`;
- `unified_resource_picker`;
- `unified_filter_dock`;
- `venue_twin`;
- `screen_health_view`;
- `engage`.

`youtube_integration` valt bewust buiten dit profiel.
