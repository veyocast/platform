# Gecontroleerde VeyoCast-bronbasis

| Referentie | Gegevens |
|---|---|
| Repository | [veyocast/platform](https://github.com/veyocast/platform) |
| Opgehaalde standaardbranch | `main` |
| Gebruikte broncommit | `4f44bbdd68d22ca2aca42f01a8d68dbe1a120770` |
| Vorige bronbasis van de Sites-kopie | `4cb895c363c69bf754184902e804fda2792ac85c`, volgens het bronmanifest van de bestaande kopie |
| Bestaande privéprototype | [VeyoCast — exacte productiekopie](https://veyocast-production-exact-20261027.dgwebserv.chatgpt.site) |

De broncommit is de opgehaalde stand van `main`. Een productie-uitrol van die commit vereist eigen bevestiging via de releaseworkflow. De eigenaarstoegang van Sites en het geïsoleerde prototype horen bij de visuele demonstratie. Beoordeel productieopslag, redactierechten, servercredentials en publicatietaken tegen de doelrepositories en de acceptatietests.

## Marketing

- `apps/marketing` is de publieke Next.js App Router-app. `apps/marketing/app/page.tsx` rendert de bestaande homepage uit `_sync/Marketing.tsx`. In het gedeelde Sites-prototype is `/website` bedoeld om die marketinghome naast Control te kunnen bekijken. In productie is de marketinghome `/`.
- `apps/marketing/app/[...slug]/page.tsx` vangt de huidige generieke `/blog` op vanuit `_content/pages.ts`. Gebruik een specifieke `blog/page.tsx` voor het nieuwe overzicht. `_content/pages.test.ts` legt de huidige lege toestand en afwezigheid van `/blog` in de sitemap vast. Werk die verwachtingen bij voor de expliciete route en gepubliceerde inhoud.
- `apps/marketing/app/blog/[slug]/page.tsx` is het detailskelet. `_content/published-details.ts` bevat een lege `publishedBlogPosts`-lijst. De route heeft `dynamicParams = false` en genereert de parameters uit die lijst. Gebruik een runtimebron en routing die nieuw gepubliceerde slugs zonder rebuild kan afhandelen. Houd bestaande cases en overige statische marketingroutes buiten die wijziging.
- `apps/marketing/app/layout.tsx` laadt Inter/Manrope en monteert `_sync/chrome.tsx`. De chrome gebruikt `SyncMarketingHeader` en `SyncMarketingFooter` uit `_sync/Marketing.tsx` voor pagina’s zonder eigen Sync-shell. Hergebruik de shell eenmalig per pagina en werk de marketingnavigatie in dezelfde merkstijl bij.
- `apps/marketing/app/sitemap.ts` verzamelt vaste pagina's met een vaste datum. Voeg canonieke gepubliceerde blogroutes met werkelijke revisiedatums toe. `apps/marketing/app/robots.ts` schermt crawlers op niet-productieomgevingen af. Behoud de omgevingsexpliciete indexering.
- `apps/marketing/app/_lib/site-config.ts` gebruikt `https://veyocast.nl` voor productiecanonicals en leest de omgevingsorigin uit `NEXT_PUBLIC_APP_URL`. De lokale dev-port van Marketing is 3002. De standaard stagingworkflow biedt geen publieke Marketing-app. De marketingservice heeft in `infra/vps/compose.yaml` profiel `production`, en `docs/deployment/github-environments.md` sluit `MARKETING_HOST` en `MARKETING_BIND_PORT` uit voor staging. Voer de ketenproef uit met de lokale Marketing-app en een testadapter, of op een apart ingerichte marketingtesthost. Gebruik daar de geconfigureerde testorigin in de nieuwe blogmetadata en publicatierespons, met indexering uit. Laat productiecanonicals en bestaande overige routes hun bestaande oorsprong volgen.
- De lockfile op deze commit resolveert Next.js `15.5.20` en React `19.2.7` voor Marketing. Controleer runtimecache en revalidatie tegen de in de doelbranch vastgezette versies. Verifieer na publicatie de ruwe HTML en sitemap op de bedoelde website-origin.

## Control en data

- `apps/control` is de beheerapp en start lokaal op poort 3000. De Sites-editor kan onder de bestaande Control-shell worden gedemonstreerd. Gebruik voor het platformbrede marketingblog de bevoegde platformredactie en handhaaf die autorisatie in de route, servermutaties, previews en mediadiensten.
- `apps/control/app/(shell)/platform/layout.tsx` gebruikt `requireControlCapability("platform.system.read")` en `apps/control/lib/control-session.ts` beheert de server-side sessie- en capabilitycontroles. De dashboardlayout controleert een tenantsessie. Geef blogschrijfacties en publicatie eigen nauw begrensde redactionele rechten binnen de bestaande capabilitystructuur. De bestaande platformwebsite-ingang staat bij `/platform/requests`. Houd route en navigatie consistent met de platformscope.
- `apps/control/app/(shell)/dashboard/media/` bevat de huidige Control-uploadinterface en mediadiensten. Inspecteer de serverpaden en tenantgrenzen voordat je ze hergebruikt voor platformassets. Ontwerp opslag en toegang volgens het bestaande security- en RLS-canon en houd conceptmedia afgeschermd.
- Gebruik de bestaande Supabase-opzet met `supabase/config.toml`, `supabase/migrations/` en `packages/database/`. Maak site- en omgevingsscope expliciet. Houd marketingcontent platformbreed en bescherm eventuele tenantgebonden mediareferenties volgens de repo-regels.
- Een zoekactie op de opgehaalde VeyoCast-commit leverde geen bestaande SocialHero-vermelding op. Inspecteer de SocialHero-repository nog op een passend publicatiecontract voordat je een nieuwe adapter vastlegt.

## Release en test

- `.github/workflows/deploy.yml` bouwt de release en zet die via het VPS-traject uit. `docs/deployment/github-environments.md` beschrijft staging en productie vanaf `main`. Productie vereist in die workflow de productie-dispatch en een gezonde staginguitrol.
- `scripts/deploy-vps.sh` voert `scripts/migrate-supabase.sh` uit in dry-run- en apply-modus. `docs/deployment/vps-deployment.md` beschrijft historiecontrole en forward-only migraties. Houd de migratie compatibel met de vorige applicatierelease zodat terugrollen van de app mogelijk blijft.
- Gebruik `pnpm --filter @veyocast/marketing dev` en `pnpm --filter @veyocast/control dev` voor de gescheiden lokale apps. Voor de normale gates zie `AGENTS.md`: lint, typecheck en tests. Voor databasewerk zijn `pnpm db:reset` en `pnpm test:rls` opgenomen. Voor UI-werk zijn `pnpm test:a11y` en `pnpm test:e2e -- --project=chromium` opgenomen.
