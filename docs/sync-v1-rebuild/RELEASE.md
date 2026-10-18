# S226 · Sync V1 release

De gekozen Sync-bron8b1fdf1f en publieke publicatie69461726 zijn geporteerd
naar de bestaande Next/pnpm/Supabase-apps. Marketing heeft negen echte routes
en duurzame aanvraag/inbox/mailstatus. Control verbindt de nieuwe werkplek met
de bestaande tenant-, content-, Studio-, playlist-, bron-, scherm-, planning-,
team-, support- en platformdiensten. Beide contentthemafamilies blijven bestaan.
Player en native shells krijgen de aangeleverde hero/iconen met dezelfde
device-, cache-, release- en signingidentiteiten.

De nieuwe Source-rendering en plaatsingsvarianten gebruiken bestaande queues,
immutable snapshots en geverifieerde private uitvoer. Actuele gegevens kunnen
begrensd verversen zonder releasegeschiedenis te herschrijven. Drie vaste
opslagplaatsen, lease-UUID-bestanden, afzonderlijke schrijversreserveringen en
listing→leasecontrole→exacte verwijderlijst bewaken vertraagde workers en budget.

CSV/XLSX-import is met echte AAL2-diensten en de productiebuild uitgevoerd:
upload→mapping→apply→herladen, daarna merge met dezelfde product-ID's. Gewone
POST303-formulieren vermijden de gereproduceerde vastlopende ServerAction-
paginaovergang; bestaande auth/RLS/RPC- en CSRF-grenzen blijven van kracht.

Lokale validatie staat in `execution/evidence/current-verification.json` en de
148 individuele scenario's. Foundation lint/type/unit30/30, verse RLS129/3596,
gekozen responsive66/66, Next-viewport126, Player/offline en werkelijke lokale
publicatie-/bron-/herstelketens zijn afzonderlijk vastgelegd. Dit is geen
algemene pixel-, externe provider- of fysieke apparaataanvaarding.

Stale commands krijgen aan zeven RPC-grenzen één HTTP409 (`PT409`), met
behoud van auth/RLS en het oorspronkelijke receipt vóór CAS. Dit voorkomt de
werkelijk gereproduceerde PostgREST14-retrystorm bij custom40001. Directe toegang
tot de private bases blijft geweigerd; zie het nonretryable-conflicts-bewijs.

## Uitrol en terugzetten

Alle27 nieuwe forwardmigraties staan met hashes in
`execution/evidence/migration-manifest.json`. De bestaande deploymentflow doet
dry-run/apply vóór de images. Geen operationele reset/backfill of destructieve
downmigratie. Promoveer uitsluitend dezelfde volledig geslaagde staging-SHA en
image-identiteiten naar productie; behoud de bestaande flags en configuratie.

Bij rollback gebruikt de bestaande workflow de bewaarde eerdere SHA/images en
Server Actions-keyidentiteit. Additieve schema's en immutable nieuwe publicaties
blijven staan. Stop nieuwe Sync-authoring en binary-refreshclaims voordat een
oudere worker wordt teruggezet; een oude worker kan het nieuwe profiel niet
verwerken. Herstel geen oude database over bestaande IDs/data. Laat geldige
Player-LKG en vorige uitvoer beschikbaar; onbekende schrijversreserveringen
worden pas vrijgegeven na aantoonbare operator-drain, zie het binary-runbook.

## Afzonderlijke acceptatie

Hardware-upgrade, LG en24uur playback zijn door de gebruiker uitgesteld.
SendGrid-key/geverifieerde afzender/ontvanger volgen later; ontvangst is
duurzaam, mail blijft pending. Native Control heeft geen eerdere installatie
of signingidentiteit om te herstellen; eerste store-inrichting en native
schermacceptatie blijven afzonderlijk. Provider-/gevulde states zonder exact
bewijs blijven als zodanig in de matrix staan. De178 branches zijn behouden;
uitsluitend bewezen overbodige bestanden/caches zijn verwijderd.

PR-, CI-, staging-/productie- en gesigneerde Player-artifacts worden via de
bestaande GitHub-releaseflow op hun concrete SHA/run bijgehouden.
