# S294 — Originele media bij actuele Source-data

Vervolg binnen de geautoriseerde S292-bronherstel-/DOM-/deploymentopdracht.
De echte langdurige stagingcanary toonde na datarevisie 1 dat RSS-foto en
leverancierlogo verdwenen: de live Source-assetcollector verzamelde alleen
Sportlink-/merkmedia, terwijl de initiële descriptor alle RSS-media bevatte.
Stop-and-report buiten de S293-ownership is vóór deze wijzigingen gedaan.

Root is enige writer. Eigen worktree/branch/PR; basis is de geteste S293-head
dd6fd748, zodat S293 normaal kan afronden en zijn legacyfix op staging kan
worden geverifieerd terwijl deze noodzakelijke vervolggates draaien.

Ownership: `apps/player/app/_lib/player-sync-dynamic-payload.ts`, de bestaande
collector in `player-release-envelope.ts` en een eigen pure gedeelde
collectormodule; eigen regressies in dezelfde map en een gericht Player-
browsergeval en gedeelde transportfixture onder `tests/helpers`, eigen docs/bewijs, deze prompt en gerichte PLANS-/TASK_LEDGER-
regels. Hergebruik de bestaande begrensde canonical-assetverzameling voor
initiële én actuele payloads; geen tweede onafhankelijke RSS-regelset.

Behoud tenant-/providerautorisatie, checksums, originele media, schema-v1,
lease-/cache-/offlinegrenzen, immutable configuratie en natuurlijke wissels.
Geen renderer, UI-styling, database, locked asset, dependency, lockfile of
workflow wijzigen. Bewijs vóór/na via werkelijke projector en volledige
manifestvoorbereiding; een handmatig verrijkte browserpresentatie alleen mist
de fout. Test ook nieuwe versus hergebruikte media en offline herstel.

Aanvullende expliciete stop-and-report: dezelfde ruwe datahash kan na herstel
een complete assetset krijgen waar de oude response beelden wegliet. Breid
ownership daarom gericht uit naar `player-screen-composition.ts` en de
bestaande `player-source-data-boundary.test.ts`. Asset-ID/checksum/type/bytes
horen bij de lokale voorbereidingsidentiteit; signed URLs niet. Zo wordt de
herstelde set volledig geverifieerd en pas op de natuurlijke grens geactiveerd,
ook bij dezelfde datahash/revisie. Wijzig geen wirehash of historische release.
De gerichte browserregressie bewijst daarnaast dat een één-item Source-loop
na de eerste grens zijn klok wel reset maar zijn gestopte interval/animatielus
niet herstart. Aanvullende stop-and-report breidt ownership uitsluitend uit
naar de twee effectafhankelijkheden in `sync-studio-media.tsx`: een nieuwe
afspeeliteratie moet beide klokken opnieuw starten. Geen renderer/layout-
wijziging of extra font-/beeldvoorbereiding per ronde.
Workspacegates en relevante Player/offline/buildchecks moeten groen vóór
commit/push. Normale PR/CI/main→staging en vervolgens expliciete productie-
promotie blijven verplicht; productie blijft tot deze fix aangehouden.
