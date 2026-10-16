# S224 — Werkelijke LG-videofout na geslaagde S223-uitrol

S223 staat op staging en productie (156bbdc). De online LG draait die versie
maar weigert de toegewezen video Narrow met LEGACY_VIDEO_ERROR; een zichtbaar
nieuw frame blijft onbevestigd. Onderzoek de decoder-/bronroute en herstel die.
Het LED-voorbeeld en de daadwerkelijke sync-ontvangstbevestiging blijven behouden.

Ownership: LG cache-/media-/herstelruntime en bijbehorende ES5-helper; begrensde
gesaniteerde videodiagnostiek in heartbeat-contract/API; bestaande Player
service-workerregistratie/geverifieerde Range-cache, `apps/player/public/sw.js`
en de bijbehorende shell-cacheproeven uitsluitend waar nodig;
gerichte Player/browser/offline/a11yregressies; eventueel een strikt read-only
tenant-/assetgebonden workerdiagnose met beschermde operatorworkflow; docs,
prompt, PLANS en TASK_LEDGER. Geen schema-, credential-, merkasset- of
dependencywijziging zonder afzonderlijke bevinding en stop-and-report.

Baseer compatibiliteit op werkelijke decoder-/bronproeven. Geen rechtstreekse
providerimports, cachewissen of ongeverifieerde HTTP-stream als normale playback.
Behoud tenantpermissions, volledige assetverificatie, immutable releases,
zichtbare framebevestiging en werkelijke offline last-known-good. Een afspeelfout
mag de laatst werkende zichtbare inhoud niet vervangen door een zwart scherm.
Alle toepasselijke gates en bestaande geautoriseerde commit/push/uitrol volgen.
