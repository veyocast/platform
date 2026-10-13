# S212 — Sportlink provider media-type recovery

## Doel

Herstel de Sportlink-datasets die na de schone productiecutover geen data
opslaan doordat de provider geldige JSON met een ontbrekende of onjuiste
`Content-Type`-header teruggeeft.

## Ownership

- `packages/integrations/src/sportlink-client.ts`
- `packages/integrations/test/sportlink.test.ts`
- `prompts/sprints/S212-sportlink-provider-media-type.md`
- `PLANS.md`
- `TASK_LEDGER.md`

## Invarianten

- Alleen server-side aanvragen naar de vaste HTTPS-Sportlinkhost.
- Responses blijven maximaal 2 MB, tijdgebonden en zonder redirects.
- Een body met een afwijkende media-typeheader wordt alleen geaccepteerd
  wanneer volledige JSON-parsing slaagt.
- HTML, tekst en corrupte JSON worden geweigerd met de bestaande veilige
  foutcodes; providerfoutcodes en retryclassificatie blijven gelijk.
- Providerrefreshes schrijven naar de bestaande genormaliseerde tabellen en
  `published_dynamic_data`; zij maken geen slide- of playlistversie.
- Releases en Player-LKG blijven immutable.

## Gates

```bash
pnpm --filter @veyocast/integrations test
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Na groene CI eerst staging controleren, daarna dezelfde immutable SHA naar
productie promoveren. Vraag vervolgens een gewone Sportlink-sync aan en bewijs
dat competities, wedstrijden, standen en vormregels in de database staan.
