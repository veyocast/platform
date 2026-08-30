# S137 — Sportlink verjaardagsnormalisatie

## Productieoorzaak

Een privacyveilige providercontrole leverde 18 verjaardagsrecords binnen de
gevraagde 21 dagen. Alle datums gebruikten een dag plus Nederlandse
drielettermaand. De parser accepteerde wel volledige maandnamen en numerieke
datums, maar niet deze providervorm. Daardoor normaliseerden 18 records naar nul
en kon de bestaande completion-RPC de lege lijst als geslaagde sync opslaan.

## Herstel

- De parser ondersteunt de vaste Nederlandse maandafkortingen, met en zonder
  afsluitende punt.
- De worker vergelijkt het veilige providerrecordaantal met de genormaliseerde
  verjaardagen. Een niet-lege respons die volledig wegvalt, stopt vóór
  teamverrijking en databasecompletion met
  `SPORTLINK_BIRTHDAY_NORMALIZATION_EMPTY`.
- Omdat completion dan niet wordt aangeroepen, blijven eerder opgeslagen
  verjaardagen als last-known-good snapshot behouden.
- Een providerrespons met werkelijk nul records blijft geldig; nul is voor een
  bepaalde 21-dagenperiode een mogelijke uitkomst.

Er zijn geen migrations, RLS-policies, browserbundels, Playercontracten,
immutable releases of offlinepaden gewijzigd.

## Bewijs

- Gerichte integratiepackage: 9 testbestanden en 100 tests groen.
- Gerichte media-workerpackage: 20 testbestanden en 97 tests groen.
- Privacyveilige live contractcheck na de parserfix: 18 providerrecords en 18
  genormaliseerde verjaardagen. Namen, datums en Client ID zijn niet gelogd.
- Workspace lint, typecheck en unit: ieder 30/30 taken groen.
- Productiebuild: 18/18 taken groen.
- Verse database-reset: groen; volledige RLS-suite: 65 bestanden en 1.404 tests
  groen.
- `scripts/validate-vps-deployment.sh`: groen.

De immutable staging- en productionpromotie volgt uitsluitend na merge van de
geteste commit naar de actuele `main`-SHA.
