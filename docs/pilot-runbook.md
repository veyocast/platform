# Lokale Pilot Runbook

## Doel en grens

Dit runbook valideert de huidige Castivo lokale MVP als controleerbare
demonstratie: de publieke route, Control-workflow, player-startstatus en
gecachete playback draaien naast elkaar op een lokale machine.

Het is nadrukkelijk geen procedure voor een productiepilot. De huidige Control
routes gebruiken vaste demodata en placeholderrechten. Upload, publiceren en
pairing zijn nog niet doorlopend gekoppeld aan de Player. Gebruik daarom geen
echte persoonsgegevens, klantmedia of productiecredentials.

## Doelomgeving

- Gecertificeerde playertarget: Chrome of Edge PWA op een Windows- of Linux
  mini-pc.
- Node 24 en pnpm 11.
- Docker Desktop met WSL-integratie en de lokale Supabase CLI.
- FFmpeg op `PATH` voordat een pilot echte media verwerkt.
- Een eigen, lokaal browserprofiel voor de Player, zodat de device-token en
  IndexedDB-cache niet met andere tests worden gedeeld.

De actuele lokale poorten staan in `docs/local-runtime.md`: Control `3000`,
Player `3001`, Marketing `3002` en lokale Supabase API `54321`.

## Voorbereiden

Voer de volgende opdrachten vanuit de repository-root uit:

```powershell
pnpm install --frozen-lockfile
pnpm db:start
pnpm db:reset
pnpm test:rls
```

Open daarna drie PowerShell-vensters en start de applicaties afzonderlijk:

```powershell
pnpm --filter @castivo/control exec next dev --port 3000 --hostname 127.0.0.1
pnpm --filter @castivo/player exec next dev --port 3001 --hostname 127.0.0.1
pnpm --filter @castivo/marketing exec next dev --port 3002 --hostname 127.0.0.1
```

Gebruik uitsluitend lokale `.env`-waarden. De meegeleverde `.env.example` bevat
bewust placeholders en mag niet met echte sleutels worden aangevuld voor deze
demo.

## Pilotroute

1. Open `http://127.0.0.1:3002`. De marketingpagina moet het Pilotpad en de
   vier productstappen tonen.
2. Open `http://127.0.0.1:3000/login`. Vul een test-e-mailadres in en kies
   **Doorgaan**. De callback meldt dat de sessiecontrole is voorbereid; kies
   vervolgens **Naar dashboard**.
3. Controleer in Control achtereenvolgens **Media**, **Playlists** en
   **Schermen**. Verwachte demo-signalen zijn `Private bucket: tenant-media`,
   `Publicatiereview actief` en de playerdiagnostiek met lokale cache.
4. Controleer op **Schermen** de pairingcode `CTV 482`. Dit bevestigt alleen
   de getoonde demo-flow. De melding `Pairing is in deze demo read-only`
   betekent dat geen Control-actie aan een echte device-sessie is gekoppeld.
5. Open in een schoon Player-profiel
   `http://127.0.0.1:3001/?deviceToken=demo-online`. De player moet
   `Zomerroute v3` en de diagnostische status `PLAYING` tonen.
6. Open de Player zonder `deviceToken`. De setup toont `UNPAIRED`, de code
   `CTV 482` en geen Supabase Auth-user. Dit valideert de ongekoppelde
   startstatus, niet het feitelijke claimen van een apparaat.
7. Laat de online player eerst volledig laden. Schakel daarna tijdelijk netwerk
   uit en vernieuw de pagina. Bij een aanwezige last-known-good release moet de
   player `OFFLINE_PLAYING` kunnen tonen. Herstel netwerk na de controle.

## Geautomatiseerde rooktest

De onderstaande test start geisoleerde devservers op de Playwright-poorten en
doorloopt dezelfde traceerbare demostappen. Sluit lokale devservers op die
poorten eerst af.

```powershell
$env:CI = "1"
pnpm test:e2e -- tests/e2e/pilot-readiness.spec.ts --project=chromium
Remove-Item Env:CI
```

De test valideert bewust de zichtbare demo-grens bij Control pairing. Een groen
resultaat bewijst dus niet dat Control live een Player kan koppelen, media kan
verwerken of een release naar een apparaat kan publiceren.

## Herstel en stopcriteria

- Stopt een app tijdens de demo, herstel alleen de betreffende lokale
  devserver; wis Player-opslag uitsluitend wanneer een schone pairingtest nodig
  is.
- Faalt een database- of RLS-gate, stop de pilot. Voer geen handmatige
  beleidswijziging in Studio door als workaround.
- Ontbreekt FFmpeg, toon of verwerk geen nieuwe media. De media-worker is dan
  geen pilotwaardige verwerkingsroute.
- Faalt offline playback, houd het apparaat uit de demonstratie totdat de
  last-known-good cache en hersteltest opnieuw slagen.
- Zolang auth, upload, publish en pairing read-only/statisch zijn, blijft dit
  een lokale MVP-demonstratie en geen klantpilot met operationele content.

## Bewijs vastleggen

Noteer voor elke uitvoering datum, commit, gebruikte browserversie, gebruikte
Player-target, uitkomst van de quality gates en eventuele afwijking. Leg geen
device-tokens, credentials of klantmedia in het bewijs vast.
