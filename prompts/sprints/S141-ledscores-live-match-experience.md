# S141 — LED Scores live wedstrijdervaring

## Doel

Bouw LED Scores uit tot één samenhangende wedstrijdervaring. De laatst bekende
stand, wedstrijdklok en het wedstrijdverloop zijn een echte dynamische slide in
de playlist. Goal, thuis-/uitopstelling, wedstrijdstart, rust en wedstrijdeinde
zijn tijdelijke animatie-overlays boven de actieve last-known-good release.

## Ownership

- `packages/contracts/src/dynamic-content.ts`;
- `packages/integrations/src/ledscores.ts` en gerichte tests;
- `apps/media-worker/src/ledscores-*` en gerichte tests;
- `apps/control/app/(shell)/dashboard/studio/led-scores/**`;
- `apps/player/**` voor moderne en statische LG/webOS-runtime;
- één forward-only S141-migratie en gerichte pgTAP-test;
- LED Scores- en S141-documentatie.

## Product- en datacontract

- `scoreboard.scored.id` is een scoreknop-ID en nooit een speler-ID;
- een scorer wordt laat en deterministisch gekoppeld via de providerlijst bij
  de resulterende score; een goal mag eerst zonder speler worden getoond;
- stabiele speleridentiteit bestaat uit verbinding, providerteam en
  providerspeler; naam, rugnummer en foto zijn verrijkbare eigenschappen;
- providerfoto's worden uitsluitend server-side van de vaste allowlisted host
  opgehaald, gevalideerd en naar private `provider-assets` gekopieerd;
- Players en tenantbrowsers ontvangen geen provider-URL en verbinden nooit
  rechtstreeks met LED Scores;
- een eerste status na start, matchwissel of reconnect is baseline en speelt
  geen historische animaties opnieuw af;
- alle semantische events hebben een canonieke idempotencykey;
- `displayTeam=home|away` start of wisselt een opstelling; leeg wist haar;
- de live tussenstand bewaart alleen een begrensde actuele toestand. Het
  slideontwerp en de fallbackposter blijven immutable releaseprovenance;
- Realtime publiceert uitsluitend de eigen publieke, RLS-beveiligde live-
  statustabel; het `realtime`-schema zelf wordt niet gewijzigd.

## UX-contract

- Studio heeft twee duidelijke producten: `Wedstrijdanimaties` en
  `Live tussenstand`;
- wedstrijdanimaties gebruiken een responsive vijfstappenwizard met momenten,
  databinding/vormgeving, veilige mediafallback, doelgroepen en controle;
- thuisopstelling en uitopstelling zijn afzonderlijk vormgegeven; uit is
  optioneel en nooit nodig om het thuisteam goed te laten werken;
- goal gebruikt automatisch naam, rugnummer en gevalideerde foto zodra de
  speler bekend is; een late spelerselectie verrijkt dezelfde actieve overlay;
- live tussenstand vraagt expliciet liggend of staand, een compacte stijlkeuze,
  klok, tijdlijnlimiet en gedrag buiten een actieve wedstrijd;
- iedere fout noemt oorzaak, gevolg en herstelactie;
- mobiel is een sequentiële flow zonder horizontale overflow of mini-desktop;
- desktop toont een live preview naast de relevante instellingen; reduced
  motion en leesbaarheid op afstand blijven leidend.

## Playercontract

- prioriteit is goal/scorerverrijking boven wedstrijdfase/opstelling boven de
  live slide en gewone playlist;
- moderne Player en Legacy LG/webOS verwerken hetzelfde gesaneerde contract;
- overlays blijven boven de bestaande last-known-good release en maken geen
  mutable release, zwart frame of providerverbinding;
- de live slide gebruikt de laatst ontvangen status, bevriest herkenbaar bij
  stale data en valt offline terug op de immutable snapshot;
- portrait en landscape gebruiken dezelfde semantiek maar een eigen responsive
  compositie; ontbrekende spelersfoto's krijgen een nette grafische fallback;
- de bestaande duurzame terminale acknowledgement-outbox blijft voor iedere
  delivery het bewijs van `received` plus één terminale uitkomst.

## Gates

Verse database-reset en database-lint; gerichte S141-pgTAP; volledige RLS;
integrations-, worker-, Control- en Player-unit; workspace lint/typecheck/test
en build; a11y en Chromium E2E; Player en offline; webOS-compatibiliteitsguard;
immutable VPS-build, staging-readback en promotie van exact dezelfde images
naar productie.
