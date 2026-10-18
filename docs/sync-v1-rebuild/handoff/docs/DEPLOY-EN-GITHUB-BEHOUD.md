# Deploy- en GitHub-behoud voor V1 Rebuild

Status: read-only broncontrole op 17 oktober 2026. Dit document beschrijft de opdracht voor de uitvoerende Codex-agent; er zijn bij het samenstellen geen branches, serverbestanden, workflows, secrets of variabelen gewijzigd.

## 1. Wat vaststaat

De nieuwe gebruikersafspraak is leidend: bouwen op de bestaande development server; oude overbodige VeyoCast/Castivo-bronmappen en bestanden mogen worden verwijderd. De huidige Sites Sync-interface is de visuele autoriteit. Bestaande werkende logica, appidentiteiten en deploymentcontracten blijven intact.

De oudere `reference/legacy-baseline/deploy/baseline/docs/deployment-local-canon.md` zegt nog “Local first” met WSL2. Dat is historisch bronmateriaal, geen geldige beperking voor deze rebuild. Pas de documentatie in de werkrepository aan de nieuwe development-serverafspraak aan.

| Bewijs | Gecontroleerde toestand |
|---|---|
| Repository | `veyocast/platform` |
| Gelezen main-head | `20729be35d38dc8eb67b836160632ac7c3ea5153` |
| Branchinventaris | 178 branches; volledige REST-paginering 100 + 78 |
| Bestandboom main | 4.180 entries; GitHub meldde `truncated: false` |
| Workflows main | 25 bestanden, alle exact in `reference/legacy-baseline/deploy/baseline/.github/workflows/` |
| Hoofdworkflow | `.github/workflows/deploy.yml`, Git blob `2570d0608d1d4fd41a5355d46e5b3c1dc143ff11` |

`reference/legacy-baseline/deploy/baseline-manifest.json` bevat alle branchnamen en heads, bron-URL's en Git-blobhashes van de geselecteerde bestanden. `reference/legacy-baseline/deploy/repository-tree.csv` bevat de volledige padinventaris van deze main-head. Dit zijn startmomentopnames: vernieuw de inventaris vóór uitvoering en respecteer tussentijdse wijzigingen.

De 178 branches zijn niet afzonderlijk inhoudelijk als overbodig beoordeeld. Een oude naam of sprintnummer bewijst geen verwijderbaarheid. Het veld `protected_flag` is alleen de gerapporteerde branchvlag; het vervangt geen audit van rulesets of environmentbescherming.

## 2. Bestaand webdeploycontract behouden

`.github/workflows/deploy.yml` heet **Deploy VeyoCast**. De vaste keten is:

1. `preflight`: vertrouwde main-workflow uitchecken, volledige release-SHA autoriseren.
2. `build-release`: één immutable release bouwen en image-IDs vastleggen.
3. `deploy-staging`: precies die release uitrollen en controleren.
4. `deploy-production`: uitsluitend handmatige dispatch met `deploy_target=production`, na succesvolle staging; dezelfde image-IDs promoveren.

Een push naar `main` triggert staging. Production is geen automatische consequentie van een push. De handmatige inputs blijven `deploy_target` (staging/production), `mode` (release/rollback), `release_sha` en `rollback_confirmation`. Een normale release moet actuele main zijn; rollback vereist een oudere SHA in main-historie en de bestaande `ROLLBACK`-bevestiging. Verwijder deze operationele controles niet.

| Contract | Behouden |
|---|---|
| Rechten hoofdworkflow | `contents: read` |
| Serialisatie | `concurrency.group: deploy-veyocast-main`; `cancel-in-progress: false` |
| Staging runnerlabels | `self-hosted, linux, x64, veyocast, staging` |
| Production runnerlabels | `self-hosted, linux, x64, veyocast, production` |
| Environmentnamen | `staging`, `production` |
| Hoofdscript | `scripts/deploy-vps.sh` |
| Web Compose | `infra/vps/compose.yaml` |
| Afzonderlijke worker Compose | `infra/vps/worker.compose.yaml` |
| Buildcontract | `infra/production/Dockerfile`, `.nvmrc`, `pnpm-workspace.yaml`, package scripts en lockfile |
| Smoke na uitrol | `scripts/smoke-player-pairing-recovery.sh` |
| Toegangsmodel | Host-Caddy → vaste localhostpoorten; Rootless Docker |

Behouden betekent werkende workflow, triggers, environments, runners, secrets, variabelen, releasepromotie, rollback en garanties behouden. Vervang niet de pipeline door een nieuwe generieke Sites/Vite-deploy. Waar de rebuild bronpaden wijzigt, werk de bestaande buildcontext en afhankelijke scripts gericht bij met dezelfde werking en aantoonbaar groene gates. Freeze oude modulepaden niet als dat het opruimen onnodig verhindert.

Het bestaande script bouwt Control, Player, Marketing en Media Worker als SHA-images. Het controleert staging-state en image-IDs vóór productionpromotie, doet migration dry-run/apply via de bestaande tooling, healthchecks en gecontroleerd herstel. De Server Actions encryption key moet bij dezelfde gepromoveerde release coherent blijven tussen omgevingen; het script gebruikt daarvoor de opgeslagen fingerprint.

## 3. Serverrollen en paden

De repository beschrijft de development-VPS als bestaand en buiten de staging/productionworkflow. De exacte actuele dev-hostnaam en het actuele bronpad zijn niet uit deze bestanden bewezen. De uitvoerende agent stelt die op de development server vast; verzin geen IP-adres of map.

| Repositorycontract | Staging | Production |
|---|---|---|
| Control-host | `staging-control.veyocast.nl` | `control.veyocast.nl` |
| Player-host | `staging-player.veyocast.nl` | `player.veyocast.nl` |
| Control localhostpoort | 13000 | 23000 |
| Player localhostpoort | 13001 | 23001 |
| Marketing | Niet in dit stagingcontract | `veyocast.nl`, localhost 23002 |
| Compose project | `veyocast-staging` | `veyocast-production` |
| Runtime-state | `/srv/apps/veyocast/staging` | `/srv/apps/veyocast/production` |

De gezamenlijke release-index is `/srv/apps/veyocast/releases/<git-sha>/`. Deze paden zijn geverifieerd in code, niet live op de server. Stel eerst vast welke host welke rol heeft en of development en staging dezelfde fysieke host delen.

Bescherm de actieve operationele inhoud: `.env.runtime`, `REVISION`, `PREVIOUS_REVISION`, `RELEASE_MANIFEST`, `RELEASE_METADATA`, `SERVER_ACTIONS_KEY_FINGERPRINT`, benodigde rollback-images, actieve symlinktargets, datavolumes, uploads, signingmateriaal en hostconfiguratie. Verwijder deze niet op grond van alleen de naam VeyoCast/Castivo.

Dat beschermt de werking en gegevens, niet permanent alle oude code in deze mappen. Oude bron- en buildbestanden op development mogen na inventarisatie en een geverifieerde opvolger verdwijnen. Als een kandidaatpad door een lopend proces, bind mount, symlink of releaseverwijzing wordt gebruikt, vervang die afhankelijkheid eerst gecontroleerd. Behoud host-Caddy, DNS/TLS, SSH, runners en Docker-state voor zover ze de huidige omgeving dragen.

## 4. Secrets en variabelen blijven bestaan

Dit pakket bevat geen echte secretwaarden. De volgende namen zijn uit de actuele workflowbron vastgesteld. Hun daadwerkelijke aanwezigheid, scopes, waarden, reviewers en branch policies in GitHub Settings zijn in deze read-only audit niet live uitgelezen; de connector ondersteunt geen secrets-API. Maak daarom vóór wijzigingen een veilige naam/scope-inventaris in de bestaande GitHub-omgeving, zonder waarden naar rapporten of Git te kopiëren.

### Webdeployment en operatie

Secrets gebruikt door `deploy.yml`:

- `DEVICE_LAB_ACCESS_TOKEN`
- `DEVICE_LAB_SESSION_SECRET`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
- `SUPABASE_DB_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SLACK_ALERT_WEBHOOK_URL`

Variabelen gebruikt door `deploy.yml`:

- `CONTROL_BIND_PORT`, `CONTROL_HOST`
- `PLAYER_BIND_PORT`, `PLAYER_HOST`
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_PROJECT_REF`
- `MARKETING_BIND_PORT`, `MARKETING_HOST` (production)

Andere bestaande operationele referenties: `SUPABASE_RESTORE_DRILL_DB_URL` voor staging-recoverydrill; `RETENTION_ENFORCEMENT_ENABLED` voor production-retention. Laat bestaande enable/disable-waarden staan. Bronopruiming is geen autorisatie voor database-retention of reset van tenantdata.

### Android Player en Google TV

Environment `android-tv-internal`; workflows `android-tv-play-internal.yml` en `android-google-tv-play-internal.yml`.

Secrets:

- `ANDROID_TV_UPLOAD_KEYSTORE_BASE64`
- `ANDROID_TV_UPLOAD_KEYSTORE_PASSWORD`
- `ANDROID_TV_UPLOAD_KEY_ALIAS`
- `ANDROID_TV_UPLOAD_KEY_PASSWORD`

Variabelen:

- `GOOGLE_WORKLOAD_IDENTITY_PROVIDER`
- `GOOGLE_PLAY_SERVICE_ACCOUNT`

Beide releaseworkflows blijven handmatige main-only workflows met `id-token: write` voor bestaande federatieve authenticatie. Verander geen signingidentiteit, Play-appidentiteit of Workload Identity-koppeling om een nieuwe interface te kunnen uitrollen.

### Android Control Mobile

Environment `android-control-internal`; workflow `control-mobile-play-internal.yml`.

Secrets:

- `ANDROID_CONTROL_UPLOAD_KEYSTORE_BASE64`
- `ANDROID_CONTROL_UPLOAD_KEYSTORE_PASSWORD`
- `ANDROID_CONTROL_UPLOAD_KEY_ALIAS`
- `ANDROID_CONTROL_UPLOAD_KEY_PASSWORD`
- `ANDROID_CONTROL_GOOGLE_SERVICES_JSON_BASE64`

Variabelen:

- `GOOGLE_WORKLOAD_IDENTITY_PROVIDER`
- `GOOGLE_PLAY_CONTROL_SERVICE_ACCOUNT`
- `ANDROID_CONTROL_UPLOAD_CERT_SHA256`
- `CONTROL_MOBILE_PUBLIC_ORIGIN`
- `CONTROL_MOBILE_PUBLIC_SUPABASE_URL`
- `CONTROL_MOBILE_PUBLIC_SUPABASE_ANON_KEY`

Environment `android-control-production`; workflow `control-mobile-play-production.yml` promoveert een reeds geteste internal-release zonder rebuild. Behoud de bestaande inputcontrole op internal run/artifact/versionCode en rolloutfractie (0,05–0,10 in deze bron), evenals `GOOGLE_WORKLOAD_IDENTITY_PROVIDER` en `GOOGLE_PLAY_CONTROL_SERVICE_ACCOUNT`.

### LG-release

Environment `lg-webos-signage-release`; workflow `lg-webos-signage-ipk.yml`. Behoud secret `LG_WEBOS_DISTRIBUTION_BEARER_TOKEN` en variable `LG_WEBOS_DISTRIBUTION_BASE_URL`, zodat de nieuwe opstartinterface niet de bestaande LG-distributie breekt.

## 5. Concrete opruimprocedure

De gebruiker heeft opruiming van oude development-mappen en overbodige bestanden in GitHub-branches al toegestaan. Voer die uit zodra de afhankelijkheden zijn vastgelegd; vraag daarvoor niet opnieuw algemeen toestemming. Deze opdracht omvat geen verwijdering van repositoryhistorie, complete branches, operationele data, environments, secrets, variabelen of signingidentiteiten.

1. **Inventariseer de actuele toestand.** Noteer op development de echte rootpaden, git-heads/worktrees, niet-gecommitteerd werk, processen, services, cronjobs, containers, bind mounts, volumes, symlinks en benodigde configuratielocaties. Noteer van iedere GitHub-branch de huidige head en betekenis: actieve rebuild, gedeelde integratie, operationele release, historische werkbranch of nog onbekend.
2. **Leg de behoudsgrens vast.** Maak een manifest per kandidaatpad met type, huidige afhankelijkheden, noodzakelijke logica, opvolger, herstelreferentie en beslissing. Behoud API-/DB-contracten, migratiehistorie, playerdecoders, runtimefixes en releaseconfig tot de vervangende implementatie en compatibiliteit bewezen zijn. Leg unieke commits op oude branches vast vóór bronopruiming; ze zijn niet automatisch in main aanwezig.
3. **Maak een compacte `archive/`-map.** Bewaar README, canonbesluiten, protocol-/schemamapping, incidentlessen, branch-headmanifest en cleanupmanifest. Verwijs naar bestaande Git-history of een herstelbare snapshot voor oude bron. Zet niet elk verwijderd bestand als kopie in het archief; dan is het opschonen inhoudsloos.
4. **Werk op development aan één rebuildlijn.** Neem de actuele Sites-bron exact als visuele referentie. Breng de noodzakelijke bestaande logica via concrete modules/adapters over en behoud het deploymentcontract. Verifieer vóór verwijderen dat het nieuwe bronpad de gebruikte imports, buildcontext en runtimekoppelingen vervangt.
5. **Verwijder overbodige bron in normale commits.** Eerst de rebuildwerkbranch, daarna relevante actieve branches via de normale merge/cherry-pickroute. Voor historische branches: classificeer hun doel en unieke historie; wijzig alleen de overbodige bestanden waarvan dat doel en de afhankelijkheden vaststaan. Geen force-push, reset van geschiedenis of branchdelete als sluiproute. Een branchnaam met Castivo/VeyoCast is geen verwijderlijst.
6. **Ruim development-paden expliciet op.** Gebruik opgeloste absolute paden uit het manifest, controleer symlink- en mountgrenzen, bewaar benodigd niet-gecommitteerd werk en operationele configuratie buiten het bronafval. Geen generiek `rm -rf *veyocast*`, geen `docker system prune --volumes`, geen serverbrede cleanup. Geen nieuwe toestemming nodig voor de geverifieerde oude dev-bronpaden in deze scope.
7. **Controleer het resultaat.** Geen imports naar verwijderde modules, geen gebroken workflow-scriptpaden, nieuwe app werkt via bestaande devservices; bestaande stagingbuild en deploymentvalidatie blijven groen. Vergelijk naam/scope-inventaris van secrets/vars en workflowcontracten vóór/na. Leg per verwijderd pad de commit en vervanging of reden vast.

Een ontbrekend bewijs is een gerichte te verifiëren afhankelijkheid, geen reden om de rest van de geautoriseerde rebuild stil te leggen. Als alleen een actieve signingkey of onbekend datavolume in een oude map achterblijft, bescherm dat onderdeel en ruim de reeds beoordeelde bron op.

## 6. Minimaal te behouden bronafhankelijkheden

Het pakket bevat exacte bron van de 25 workflows, hoofddeployscript, Compose-configuraties, productie-Dockerfile, preflight/security/healthvalidatie en relevante deploymentdocumentatie. `reference/legacy-baseline/deploy/workflow-contracts.json` bevat namen en scopes uit alle workflows; `reference/legacy-baseline/deploy/workflow-dependencies.txt` bevat letterlijk herkende bestandverwijzingen. Die lijst is een startpunt, geen complete transitive importanalyse.

Behoud ook indirect aangeroepen migratie- en veiligheidsmodules, lockfile en relevante package scripts in de werkrepository. Een workflow die blijft bestaan maar naar een verwijderd script verwijst, voldoet niet aan “deploy workflow behouden”. Verwijder een inmiddels overbodige eenmalige operationele workflow alleen als zijn gebruik en opvolger aantoonbaar zijn; raak deployment, release, recovery en noodzakelijke gates niet ongemotiveerd kwijt.

## 7. Nog live te verifiëren bij uitvoering

- Werkelijk development-hostadres, rootpad, datavolumes en relaties met staging.
- Huidige naam/scope-inventaris van GitHub environments, secrets en variabelen, inclusief aanvullende niet-in-code gebruikte waarden.
- Actuele branchbescherming/rulesets, environment branch policies en reviewers.
- Actuele runnerregistraties, labels en toegang tot dezelfde bedoelde Rootless Docker-daemon.
- Laatste succesvolle release-SHA, runtime manifesten, rollback-artifacts en actieve pairing-/appidentiteiten.
- Unieke nog benodigde commits en bestanden op alle 178 branches; deze audit claimt niet dat alles daar overbodig is.
- Groene echte stagingdeploy, fysieke app-updatetest en productionpromotie zijn niet uitgevoerd tijdens het samenstellen van dit pakket.

De bestanden onder `reference/legacy-baseline/deploy/baseline/` zijn bewijsmateriaal van de genoemde SHA. Voer meegeleverde rollout-, herstel- of resetworkflows niet uit omdat ze in het archief staan. De nieuwe hoofdcanon en actuele gebruikersopdracht bepalen de rebuild; historische bronnen helpen werkende contracten te behouden.

