# Acceptatie S313

Doelomgeving: lokaal, site `veyocast`, `development`, Marketing
`http://127.0.0.1:9313`, contractversie `1`. Er is geen staging- of
productieactivatie uitgevoerd. Bronversies en configuratie staan in [het
uitvoeringsdossier](README.md). Het overdrachtspakket is onder `reference/`
uitsluitend als ontwerp- en acceptatiereferentie opgenomen.

De lokale integratie gebruikt `s313-local-postgres-test-adapter`: een eigen
database `s313_blog_acceptance` op PostgreSQL15.8, echte SQL/RLS, synthetische
Auth-JWT's en een bestandgebaseerde Storage-HTTP-adapter. De Next-app en
SocialHero-client zijn werkelijk uitgevoerd. Dit bewijst geen werking van een
externe Supabase Auth-/Storage-installatie of uitgerolde website.

| Controle uit ACCEPTATIE.md | Bewijs en huidige grens |
|---|---|
| Bronbasis | Groen: VeyoCast `4f44`, SocialHero `6ddc`, prototype `68cadf`; aparte werkbomen, bestaande routes en deployflows. SocialHero definitief `8e2cf198`, PR1 en CI groen. |
| UI-overname | Groen: dezelfde drie prototypeartikelen, fonts en 1440/390/320px; openbare main-screenshots identiek. Native Control-shell/baseline en editor ook vergeleken. Twee editorcontrasttokens doelbewust voor toegankelijkheid gecorrigeerd. |
| TipTap | Groen: typen en plakken, koppen/lijsten/taken/quote/tabel/beeld, tabelbewerkingen, undo/redo, save/reopen met identiek JSON+HTML, veilige en schadelijke paste. Browser gebruikt expliciet fixturetransport. |
| Redactie | Groen: capability/sessie/AAL2/origin, afgeschermde preview/media en herhaalbare save/publicatie gericht getoetst. Echte geauthenticeerde Supabase-browserflow blijft open. |
| SEO en sociale metadata | Groen: ruwe openbare head door echte SocialHero-verifier, canonical/ID/revisie, aparte OG en portretfallback met echte dimensies, JSON-LD, lijst/detail/sitemap en noindex. Na productiebuild en Next-herstart vier publicaties opnieuw geverifieerd. |
| Bevoegdheid | Groen: SQL/RLS en HTTP; ontbrekend/verkeerd/verlopen/ingetrokken/verkeerde omgeving en read-only scopes. Alleen server-side hash/vault; geen credential in browserconfig of bewijs. |
| Upload | Groen: 15 decode-/integriteitsproeven plus echte multipartketen; dimensies, gescheiden OG, spoof/corrupt/te groot, rate429 en readback. Malformed multipart geeft422 in plaats van een retrybare503. |
| End-to-end | Groen: reguliere SocialHero-goedkeuring, UTCplanning, twee uploads, concept, publicatie en echte HTMLverify in drie afzonderlijke workerprocessen. Gecontroleerde afhankelijkheid vóór social; geen echte socialprovider aanwezig. |
| Idempotentie | Groen: drie HTTP-after-COMMIT/socket-drop/procesherstarts voor media/concept/publicatie; dezelfde bytes/keys, één logisch resultaat. Gewijzigde inhoud geeft409. |
| Gelijktijdigheid | Groen: acht echte PostgreSQL-twee-sessieraces en gelijktijdige HTTP-revisiewrites; één schrijver wint en verouderde revisie wordt geweigerd. |
| Revisie en URL | Groen: oude live-inhoud blijft tijdens conceptwijziging; expliciete slugwijziging wordt gepubliceerd; elke oude slug geeft een directe308 naar actueel canoniek. |
| Herstel | Groen: worker heropent SQLite en exact uploadsnapshot; pauze/onbereikbaarheid blokkeert vervolg. Na verloren lokale completion verifieert een nieuw proces dezelfde publicatie en bewaart één receipt. |
| Cache en deploy | Groen lokaal:225 migraties+ seed vanaf nul,159 RLS-bestanden/5607 assertions, build/secretgates en zichtbaarheid na herstart. Staging-/productieactivatie is niet uitgevoerd. |

## Commandobewijs

In deze gedeelde werkhost gebruikt pnpm `COREPACK_HOME=/dev/shm/s313-corepack`
en `pnpm_config_verify_deps_before_run=warn`. Dit voorkomt een automatische
dependencyinstallatie bij het hergebruik van aanwezige dependencies. De
manifest-/lockfilecombinatie is afzonderlijk met frozen-lockfile gevalideerd.

| Commando | Uitkomst |
|---|---|
| `pnpm lint --concurrency=1 --output-logs=errors-only` |32/32 succesvol,30 gecachet;10,304s |
| `pnpm typecheck --concurrency=1 --output-logs=errors-only` |32/32 succesvol,30 gecachet;29,364s |
| `pnpm test --concurrency=1 --output-logs=errors-only` |32/32 succesvol,29 gecachet;18,725s |
| `pnpm install --frozen-lockfile --lockfile-only --ignore-scripts` | Groen op de definitieve dependencydeclaraties; bestaande versies behouden |
| `pnpm db:reset` / `pnpm test:rls` met vaste lokale finaledatabase |225 migraties+ seed;159 bestanden/5607 assertions groen; exacte veilige commandoregels onder `evidence/database/final/` |
| `bash scripts/validate-vps-deployment.sh` | Exit0; onder meer 254 bestaande veiligheids-/deployproeven groen |
| `PLAYWRIGHT_APPS=marketing PLAYWRIGHT_EXTERNAL_SERVERS=1 MARKETING_PORT=9313 pnpm test:a11y --config /tmp/s313-marketing-a11y.config.ts --project=chromium` |3/3 groen;8,2s; bestaande home/privacy/data-verwijderen |

De tijdelijke a11yconfig importeert de oorspronkelijke `playwright.config.ts`,
zet een absoluut `testDir`, selecteert uitsluitend de twee bestaande
Marketing-specs en gebruikt de aanwezige Chromium headless shell 1254. De eerste
start faalde vóór browseruitvoering doordat de gedeelde Playwright-versie een
andere browserbinary verwachtte. Een eerste tijdelijke config zonder absoluut
`testDir` vond geen tests. Beide oorzaken zijn gecorrigeerd; geen testassertie is
aangepast. De 26 bestaande Control-shellcases zijn aanvullend allemaal groen: tien
in de brede run, vijftien na serverherstart en de laatste warme themacase
met de bestaande CI-timeout van 60s. De eerste run tegen een productiebuild
zonder testsessie kreeg terecht loginredirects; de suite verwacht de bestaande
developmentdemo. De daaropvolgende developmentserver bereikte zijn standaard
heaplimiet na tien geslaagde cases. De herstart gebruikte 6GiB serverheap.
Eén van de zestien herhaalde cases overschreed koud de lokale 30s tijdens axe;
de ongewijzigde warme case slaagde in 6,3s met de bestaande CI 60s. Geen assertie
is gewijzigd. De overige Control-/Player-browsersuites zijn niet als uitgevoerd
geclaimd.

Aanvullende exacte commando's, waarnemingen en screenshots staan per proef onder
`evidence/`. Tests met mocks of componentfixtures staan daar expliciet als
zodanig vermeld. Privé runtimeconfiguratie en tijdelijke credentials worden
niet opgenomen; configuratievoorbeelden bevatten uitsluitend voorbeeldwaarden.


## Resterende externe controles

Een echte Supabase Auth-/Storage-gateway, een geauthenticeerde SocialHero-wizard
in de browser en een extern ingerichte marketingtesthost zijn niet bewezen door
de lokale adapters. De bestaande socialprovider ontbreekt; de hosted queueguard
is lokaal met een expliciete omgevingsinjectie getoetst en geeft na websiteverify
terecht `PROVIDER_NOT_CONFIGURED`. Geen echte socialpost of externe deploy is
uitgevoerd. De ontbrekende staging-Marketing-service vereist een expliciete host
voordat de bestaande activatieflow kan worden gebruikt.
