# S313 — Uitrol- en provisioningaudit

Deze controle is uitsluitend lezend uitgevoerd na de gebruikersinstructie om alles te deployen. Merge en workflowdispatch blijven bij de bovenliggende release-uitvoering. Dit document verleent geen afzonderlijke runtime- of databasebevoegdheid.

Het concrete activeringsrunbook en de later voorbereide standalone operatorclient staan in [ACTIVEREN.md](ACTIVEREN.md). Die client gebruikt uitsluitend de hieronder beschreven bestaande menselijke Auth-/MFA-/RPC-rechten en is niet tegen live Auth of production uitgevoerd. De audit hieronder beschrijft de gemeten toestand vóór de software-uitrol; latere readbacks worden afzonderlijk opgenomen.

## Gecontroleerde bron en CI

VeyoCast PR343 had head `f69706cdfc42d5aa37493574a6d1557cc561ef07`, basis `4f44bbdd68d22ca2aca42f01a8d68dbe1a120770`. De GitHub-connector bevestigde alle vijf getriggerde workflows als `success`:

| Workflow | Run |
|---|---|
| PR Gates | [43448259559](https://github.com/veyocast/platform/actions/runs/43448259559) |
| Database and RLS Gates | [43448259201](https://github.com/veyocast/platform/actions/runs/43448259201) |
| Sites reference gates | [43448259522](https://github.com/veyocast/platform/actions/runs/43448259522) |
| VeyoCast Control Mobile CI | [43448259519](https://github.com/veyocast/platform/actions/runs/43448259519) |
| LG webOS Signage IPK | [43448260446](https://github.com/veyocast/platform/actions/runs/43448260446) |

De PR Gates-jobs bevestigden foundation, Control/Marketing/cross-browser, fixturevoorbereiding, alle vier Player-shards en volledige closure. De PR had op het auditmoment geen reviews of reviewthreads. De actuele `main`-branch was volgens GitHub niet beschermd; dit vermindert de verplichte repositorygates niet. Beide deployment-Environments hebben uitsluitend een custom branchpolicy voor `main`, zonder required reviewer. De expliciete productieopdracht voldoet aan de handmatige autorisatiegrens; een extra toestemmingsvraag is daarvoor niet nodig. Exacte metadata staan in [pre-deploy-audit.json](pre-deploy-audit.json).

## Actuele bestemmingen vóór de uitrol

| Omgeving | Werkelijk Supabase-project | Publieke applicaties |
|---|---|---|
| staging | `jibbtdicrptsyftobavq` | `https://staging-control.veyocast.nl`, `https://staging-player.veyocast.nl` |
| production | `gjmdqsukjfhmmblnmhqd` | `https://control.veyocast.nl`, `https://player.veyocast.nl`, `https://veyocast.nl` |

De productieproject-ref is de schone cutoverbestemming. De oudere project-ref uit `production-control-bootstrap.md` is geen actueel release-doel. GitHub Environment-metadata en de Supabase-projectinventaris zijn vergeleken; er zijn geen credentialwaarden opgehaald.

Beide actuele databases hadden vóór deze uitrol 224 migraties, laatste `20261111161700`. De nieuwe blogtabel en beide provisioning-RPC's ontbraken nog. Dit is expliciet met `BEGIN READ ONLY`, catalogus-/migratie-SELECT en `COMMIT` gecontroleerd via de gekoppelde Supabase-account. Er zijn geen Auth- of tokengegevens gelezen. Alle vijf bestaande publieke healthroutes waren gezond op `4f44bbdd…`; het nieuwe publieke capabilitiesendpoint gaf 404. Zie [health-before.json](health-before.json).

Staging heeft bewust geen Marketing-service, Marketing-host of Marketing-poort. De preflight en Compose-validator verbieden die stagingwaarden. Er is daarom nog geen bestaande externe stagingblogbestemming die veilig als werkend kan worden aangemerkt. Het configureren van een fictieve of productieorigin in de stagingdatabase lost dat niet op.

## Bestaand migratie- en releasepad

`.github/workflows/deploy.yml` bouwt de actuele gereviewde main-SHA eenmaal op staging, voert de workspacegates en immutable imagecontroles uit en bewaart de vier image-ID's. `deploy-staging` voert via `scripts/migrate-supabase.sh` de historie-/volgordecontrole, `supabase db push --dry-run` en forward apply uit, gevolgd door lokale/publieke health en de bestaande pairing-/recovery-smoke. Production start alleen door een handmatige dispatch met `deploy_target=production`, na staging. Hij controleert opnieuw de actuele main-SHA en dezelfde vier image-ID's en bouwt niet opnieuw. Credentials worden door Environment-injectie op de runner gehouden; de audit leest ze niet uit.

De S313-migratie moet via dit pad als versie `20261113124946` op beide eigen projecten verschijnen. De approllback behoudt die additieve migratie en gebruikt geen downmigration of database-reset. De volledige lokale fresh-reset-/RLS-gates staan al in het [definitieve databasebewijs](../database/final/README.md); de hosted Database and RLS Gates zijn daarnaast groen.

## Blogconfiguratie in de release

Productie-Marketing krijgt `VEYOCAST_BLOG_PUBLIC_ORIGIN=https://${MARKETING_HOST}` uit Compose. Productie-Control valt zonder expliciete override terug op `https://veyocast.nl`. De standaard site-ID is `veyocast`; locale is `nl-NL`.

Er waren geen GitHub Environment-variabelen voor `VEYOCAST_BLOG_SITE_ID` of `VEYOCAST_BLOG_PUBLIC_ORIGIN`. Control-Compose kent een optionele origin, maar `create_candidate_env()` in het bestaande deployscript schrijft die origin niet naar het runtimebestand en de workflow injecteert haar niet. Voor production werkt de bestaande originfallback. Voor staging vereist de blogconfiguratie een echte ingerichte marketingorigin plus een expliciete runtimeconfiguratieroute. Zie [environment-metadata-before.json](environment-metadata-before.json).

## Voorkeursroute voor site en credential

De bestaande databaserechten zijn doelbewust beperkt:

- `blog_configure_site(site, environment, public_origin)` is uitsluitend uitvoerbaar door `authenticated`; de functie verlangt een actuele platform owner/admin en AAL2.
- `blog_manage_token(...)` heeft dezelfde actorgrens; create/rotate/revoke vereisen AAL2. Er wordt alleen een SHA-256-hash opgeslagen, met site, omgeving, scopes en vervaldatum van maximaal 366 dagen. De functie geeft geen plaintext terug.
- Service-role heeft voor deze twee RPC's geen uitvoerrecht en heeft geen directe schrijfrechten op de blogsite- of tokentabel. `private.audit_event` accepteert voor deze menselijke acties geen ontbrekende actor.
- De nieuwe media-attestatiefunctie is uitsluitend voor het bestaande, actor- en fingerprintgebonden mediareceipt; zij kan geen site of credential provisionen.

Er is in de geleverde Control-UI, API of serveracties geen setup-/tokenbeheeractie die deze twee RPC's aanroept. Daarom is alleen inloggen op `/platform/blog` nog geen uitvoerbare provisioningflow.

De voorkeursuitvoering is een echte owner/admin-sessie die via de bestaande Supabase Auth-MFA-flow AAL2 bevestigt, gevolgd door een beperkte Control-setupactie of een beveiligde operatorclient. Die client gebruikt de normale menselijke JWT en roept de twee bestaande RPC's aan; hij gebruikt geen service-role of vervalste claims. Het laten toevoegen van zo'n setupactie vereist afzonderlijke implementatie en tests, maar geen verruiming van de huidige RPC-rechten.

Voor production moeten de concrete waarden zijn: site `veyocast`, omgeving `production`, origin `https://veyocast.nl`; credentialscopes `capabilities:read`, `posts:read`, `media:write`, `posts:write`, `posts:publish`, met een expliciete beperkte geldigheidsduur. Genereer de plaintextcredential uitsluitend in de beveiligde server/operatorcontext, registreer de hash via de echte sessie en geef de plaintext eenmalig aan de bestaande SocialHero-servervault. Neem haar niet op in logs, chat, bewijsbestanden of campagneconfiguratie. Een andere omgeving krijgt een afzonderlijke credential en origin.

## Bestaand systeemactorpatroon

De repository heeft een eerder gereviewd owner-only DB-operationspatroon: `private.set_menu_studio_pilot_flag_v1` en `.github/workflows/menu-studio-pilot-rollout.yml`. Die private helper heeft geen uitvoerrechten voor Data API-rollen. De beschermde Environment-workflow injecteert alleen de databaseverbinding en bindt de operatie aan een exacte target, actieve release, `github:<actor>`, reden en workflow-URL. Hij schrijft een expliciet systeemaudit met `actor_user_id = NULL` en bovenstaande metadata. Publicatiemaintenance kent eveneens domeingebonden operatorvelden.

Dit is een bruikbaar ontwerppatroon, geen bestaande algemene provisioningbevoegdheid. Geen van die helpers of workflows kan blogsites of blogcredentials aanmaken. Hergebruik van een diagnostische SQL-workflow als vrije writeshell, handmatige JWT-claiminjectie of het toekennen van een menselijke identiteit aan een systeemoperatie is niet toegestaan.

Een toekomstige blog-opsbootstrap zou een eigen beperkte owner-only helper en beschermde workflow vereisen, met exacte project-/site-/omgeving-/origin-/releasebinding, systeemactor en audit, begrensde scopes/expiry, idempotente hervatting en veilige overdracht naar SocialHero's vault. Dat is een nieuwe geprivilegieerde operatie en moet eerst expliciet worden geïmplementeerd, gereviewd en getest. Er bestaat nu geen dergelijke route die zonder codewijziging kan worden uitgevoerd.

## Precieze nog benodigde gebruikershandeling

Wanneer geen nieuwe systeemopsroute wordt toegevoegd: een bestaande platform owner/admin voert zelf de echte login en authenticatorchallenge uit met de beperkte operatorclient uit [ACTIVEREN.md](ACTIVEREN.md). De client gebruikt die nieuwe AAL2-sessie om de site en hashcredential aan te maken. Vooraf inloggen in de Control-browser is geen technische voorwaarde voor die client; de normale Control-login en `/auth/mfa` blijven beschikbaar voor redactie of een alternatieve bestaande sessieroute. Daarna voert dezelfde bevoegde beheerder de eenmalige credential in de SocialHero-verbindingswizard in; SocialHero bewaart haar server-side en controleert capabilities en de exacte bestemming. Wachtwoorden, JWT's, TOTP-codes en credentialwaarden hoeven hiervoor niet naar Codex of chat te worden gestuurd.

Zolang de setupactie/operatorclient ontbreekt of die echte sessie niet beschikbaar is, kan software normaal worden uitgerold maar mag de verbinding niet als gekoppeld worden gerapporteerd. Een 401 zonder credential bewijst alleen dat de API-authgrens actief is. Werkende koppeling vereist een geslaagde geauthenticeerde capabilitiescontrole en daarna de echte afgescheiden media-/concept-/publicatie-/URL-verificatie.

## Auditcommando's en uitkomst

De GitHub-connector is gebruikt voor PR-metadata, workflowruns, jobs, reviews en threads. Voor niet door die connector aangeboden Environment-instellingen is uitsluitend de GitHub CLI-API gebruikt:

```text
gh api repos/veyocast/platform/branches/main
gh api repos/veyocast/platform/branches/main/protection
gh api repos/veyocast/platform/environments/<environment>
gh api repos/veyocast/platform/environments/<environment>/deployment-branch-policies
gh api repos/veyocast/platform/environments/<environment>/variables/<allowed-name>
gh api repos/veyocast/platform/environments/<environment>/secrets --jq '[.secrets[].name]'
```

Uitkomst: main was niet beschermd (protection-API 404); beide Environments main-only; de hierboven genoemde configuratie aanwezig/afwezig; uitsluitend secretnamen gelezen. De toegestane variabelenamen en exacte catalogusquery staan in de JSON-bestanden. HTTPS-probes waren niet geauthenticeerd en hadden een deadline van acht seconden. Deze audit heeft geen merge, dispatch, databasewrite, credentialaanvraag, gebruikersaanmaak, Auth-claimwijziging of infrastructuurmutatie uitgevoerd.
