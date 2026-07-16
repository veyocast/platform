# Integrations Canon

## MVP stance

Sportlink and Twelve are prepared architecturally but not production-connected in the core MVP.

## Rule

Players never call external providers directly.

```text
Provider -> Castivo integration adapter -> normalized data -> widget snapshot -> playlist release -> player cache
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
