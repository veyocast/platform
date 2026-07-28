# S51 — Fixed dynamic slides

## Goal

Deliver the first vertical dynamic-content MVP: platform-owned fixed
templates, tenant product/RSS sources, immutable server-rendered snapshots,
Publisher playlist insertion and unchanged offline-safe Player playback.

## Invariants

- Follow `docs/dynamic-slides-canon.md`.
- Do not invent Twelve endpoints, fields or authentication.
- No Player provider calls or template execution.
- Published releases remain immutable.
- A provider failure retains the last good normalized data and snapshot.
- Template source has no arbitrary JavaScript, external URLs or unbounded
  loops.
- Secrets remain server-side and are stored only through references.
- Tenant data has forced RLS and server-side capabilities.
- Do not deploy production from this sprint.

## User flow

`Nieuwe slide → Dynamische slide → Categorie → Slidetype → Kies template →
Kies databron → Configureer inhoud → Voorbeeld → Opslaan als slide →
Beschikbaar in playlistmaker`

## Required outputs

- Four landscape/portrait menu/news reference templates.
- Platform template list/editor with preview, manifests and versions.
- Tenant data source workspace with Twelve file-source honesty, manual
  products and safe RSS.
- Dynamic slide list, guided creation, detail, refresh and playlist action.
- Canonical contracts, safe renderer and periodic RSS worker.
- Immutable PNG output through existing Media/release/Player cache.
- RLS, unit, worker, Control, a11y and end-to-end regression tests.
- Architecture, security, provider and operations documentation.
