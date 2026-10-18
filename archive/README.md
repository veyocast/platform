# VeyoCast · rebuildarchief

De Sync-opdracht van 17 oktober 2026 vervangt voor de gemapte oppervlakken de
zichtbare v11/v17-interface. De originele overdracht staat byte-identiek in
`docs/sync-v1-rebuild/handoff/`; de bijbehorende verifier moet PASS blijven.

`branch-heads-before.json` registreert de actuele remoteheads en unieke commits.
Dit is een inventaris, geen verklaring dat alle branches zijn opgeschoond.
Verwijderingen worden afzonderlijk geregistreerd in `execution/opruimregister.csv`.
Oude bron blijft herstelbaar via Git; dit archief bevat geen duplicaatruntime.

Behouden grenzen:

- Tenant/device/media/playlist/release/provider/payment-ID's en migratiehistorie.
- Eén writer per domein, serverrechten/RLS, immutable publicaties en LKG.
- Gewenst, gedownload, geverifieerd, actief en bevestigd zijn aparte toestanden.
- LG houdt eigen decoder-, cache-, Range- en timerherstel.
- Android `nl.veyocast.player` en Control `nl.veyocast.control` houden signing,
  gegevens en updatekanalen; brondefaults bewijzen geen geïnstalleerde versie.
- Bestaande workflows, secrets/variables, runners en SHA-promotie blijven intact.

Herstelbasis: `20729be35d38dc8eb67b836160632ac7c3ea5153`, succesvol gedeployd
via run `38973162759`. Geen operationele database-reset is geautoriseerd.


Actuele afgebakende cleanup: zestien aantoonbaar ongebruikte ignored caches
(5.602.390.016 bytes) en drie vervangen CSS-modules zonder resterende imports.
Alle178 remoteheads zijn behouden.129 hebben geen graphverschil met de basis;
49 branches bevatten72 commitverwijzingen naar68 unieke SHA's. Graphverschil
bewijst geen ontbrekende patch of verwijderbaarheid. Hieronder vallen onder
meer identity/MFA-, LG-, caching- en deployherstel. Er is geen aanvullende
branch-/bronverwijdering bewezen veilig; geen volledige178-branchcleanupclaim.
