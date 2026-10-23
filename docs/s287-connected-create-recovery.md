# S287 — opslag na geslaagde Sportlink-preview

De productie-wizard voor Clubprogramma toonde echte broninhoud, maar maken
faalde met de algemene bronopdrachtmelding. Dezelfde aanvraag is gereproduceerd
op de volledige migratiebaseline `87b30fa6`: preview gaf een geldig preview-ID;
de echte create-RPC faalde met `23514`, `Sportlink club-wide team selection is
invalid`, vanuit de initial-draft-trigger.

De oudere trigger vereiste ook bij `all` één primair teamcontext. Daarnaast
weigerde hij de getypeerde Sync-teamselectie voor zeven andere bestaande
Sportlink-families. Een read-only productielezing en lokale fixtures zijn geen
toestemming voor directe productie-mutaties; uitrol volgt de gewone workflow.

De nieuwe forward-only migratie onderscheidt strikt gevalideerde Sync-invoer
van historische blueprint-invoer. Alleen Sync `all` zonder expliciete context
heeft geen primair team nodig. Geselecteerde teams en iedere meegegeven context
blijven tegen dezelfde tenant en bron gevalideerd en moeten dezelfde eerste
selectie aanwijzen. Zeven expliciete bestaande Sync-brontypen mogen dezelfde
getypeerde selectie bewaren. Historische configuraties, statuscontroles,
arrival-contracten en het bestaande autorisatiemodel behouden hun controles.
De triggerhelper blijft uitsluitend intern uitvoerbaar.

Bewijs vóór commit:

- Exacte oude preview/create-tegenproef en audit met de werkelijke compiler:
  9 van 17 brontypen faalden eerst; na de correctie 17 van 17 aangemaakt.
- Nieuwe SQL-regressie: 94 assertions, met 17 brontypen plus de gemelde
  club-program-familie in landscape/portrait, echte draft/snapshot/queue,
  zichtbaarheid tijdens verwerking, volledige 14-wedstrijdselectie, exacte
  versieconfiguratie en herhaling van alle 36 oorspronkelijke receipts.
- Negatief bewijs: foreign team/bron/tenant, ongeldige of ontbrekende expliciete
  context, vervalste Sync-identiteit/bronfeiten en vieweropslag blijven geblokkeerd.
- Echte reset van uitsluitend taakproject `veyocast-s287`, 204 migraties plus
  seed; volledige RLS: 139 bestanden / 4.619 assertions groen.
- Workspace lint, typecheck en unit elk 30/30 taken groen; geen dependency- of
  lockfilewijziging. Productiecreatie via de browser wordt niet als lokaal
  uitgevoerd geclaimd. Normale exacte-commit CI en deployment volgen.

Rollback gebeurt met een opvolgmigratie die het vorige triggerlichaam
herstelt. Geen opgeslagen data, snapshots, receipts of publicaties worden
teruggeschreven of verwijderd. Player en offlinegedrag zijn niet gewijzigd.
