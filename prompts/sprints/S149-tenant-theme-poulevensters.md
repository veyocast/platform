# S149 — Centrale tenantstijl en volledige poulevensters

## Doel

Herstel twee productcontracten:

1. kleuren worden centraal per tenant en authorable theme beheerd, nooit per
   slide;
2. teamgebonden pouleprogramma- en pouleuitslagslides tonen in het komende of
   afgelopen zeven-dagenvenster zowel eigen thuis- en uitwedstrijden als de
   wedstrijden van andere teams uit dezelfde poule.

## Scope

- Eén FieldFlow light/dark-kleureneditor onder tenantinstellingen.
- Een strict, versionable `theme_color_overrides`-contract per theme.
- Server-side preview- en create-authority; geen vertrouwde themevelden uit een
  slideformulier.
- Nieuwe `latest`-snapshots volgen tenantwijzigingen zonder historische
  snapshots of gepubliceerde releases te muteren.
- Sportlink-unie van pouleprogramma en pouleuitslagen voor
  `eigenwedstrijden=NEE` en `JA`, aangevuld met de algemene clubfeed.
- Positieve `teamcode`/`lokaleteamcode`-matching en veldbehoudende deduplicatie
  op wedstrijdcode.
- Contracts-, Control-, worker-, pgTAP-, a11y-, E2E-, Player- en offlinegates.

## Niet in scope

- Nieuwe authorable theme-ID's.
- Per-slide kleur-, font- of merkoverrides.
- Mutatie van immutable snapshots of playlistreleases.
- Wijziging van Player-auth, LKG, offlineactivatie, locked logo-assets of de
  Sportlink-host/article-allowlist.

## Acceptatie

- Een tenantbeheerder kan alle 26 semantische FieldFlow-tokens voor light en
  dark op één centrale plek wijzigen en resetten.
- Client en server weigeren incomplete, structureel ongeldige of onvoldoende
  contrastrijke tokenmaps.
- Een slidewizard bevat geen kleur-editor of verborgen kleuroverride.
- Preview en nieuwe snapshots gebruiken uitsluitend de actuele tenant-authority.
- Een bestaande snapshot/release verandert niet na een tenantkleurwijziging.
- De komende week bevat eigen thuis, eigen uit en overige poulewedstrijden.
- De afgelopen week bevat eigen thuis, eigen uit en overige pouleuitslagen.
- Een wedstrijd uit meerdere providerfeeds blijft één regel en verliest geen
  score, poulecontext, logo, locatie of thuis/uitmarkering.
- Alle verplichte releasegates zijn groen vóór commit, push, merge en deploy.
