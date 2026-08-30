# Integrations Canon

## MVP stance

Sportlink and Twelve are prepared architecturally but not production-connected in the core MVP.

## Rule

Players never call external providers directly.

```text
Provider -> VeyoCast integration adapter -> normalized data -> widget snapshot -> playlist release -> player cache
```

## Adapter interface

```ts
export interface IntegrationAdapter {
  testConnection(): Promise<ConnectionTestResult>;
  sync(): Promise<SyncResult>;
  normalize(): Promise<NormalizedDataset>;
  disconnect(): Promise<void>;
}
```

## Provider status labels

- Beschikbaar
- Pilot
- Gepland
- Neem contact op

Do not claim availability without implemented and approved integration.

## Realtime event overlays

Een provider-event dat niet zinvol in een playlisttijdlijn past, mag uitsluitend
via een expliciet gecanoniseerd eventoverlaycontract worden geleverd:

```text
Provider -> server-only leased adapter -> canonical event -> screen-scoped delivery -> Player overlay
```

Ook dan gelden de hoofdgrenzen: de Player praat nooit met de provider, ontwerp
en media zijn immutable gepubliceerd, credentials blijven server-only, targeting
is tenantgebonden en last-known-good playback wordt niet vervangen. S132 LED
Scores is de eerste implementatie; zie
[`integrations/ledscores-realtime-goal-alert.md`](integrations/ledscores-realtime-goal-alert.md).
