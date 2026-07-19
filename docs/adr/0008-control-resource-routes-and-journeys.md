# ADR 0008 — Control resource routes en cross-resource journeys

## Status

Accepted als doelarchitectuur; UI-integratie volgt in S23-S28.

## Context

Media, Playlists en Screens combineren nu lijst, aanmaken, details en mutaties
op enkele grote routes. Pilotflow dupliceert de technische keten. Dit maakt de
dagelijkse taak upload -> publish -> screen sync moeilijker dan nodig.

## Besluit

- Platform- en tenantcontext krijgen afzonderlijke routehiërarchieën.
- Tenantresources krijgen list- en detailroutes.
- `Releases` wordt een eersteklas resource naast Media, Playlists en Screens.
- `/publish` orkestreert echte drafts/releases als begeleide journey; het maakt
  geen verborgen parallel datamodel.
- `/screens/new` orkestreert create, pairing en eerste heartbeat.
- Expert resourcepagina's blijven bestaan naast guided journeys.
- Pilotflow verdwijnt uit productionnavigatie zodra vervangende live E2E-
  journeys bestaan.
- Mobile flows zijn sequentieel; een grote desktopworkspace wordt niet verkleind.

## Informatiearchitectuur

```text
Overzicht
Content: Media, Playlists, Releases
Distributie: Schermen, Apparaten en synchronisatie
Organisatie: Team, Instellingen, Auditlog
```

## Gevolgen

- globale search zoekt echte resources en respecteert context/capabilities;
- actie-inbox deep-linkt naar resource en herstelactie;
- URLstate draagt filters/selection waar bookmarkbaarheid waarde heeft;
- S23 definieert gedeelde page-, toolbar-, table-, inspector- en statepatronen.
