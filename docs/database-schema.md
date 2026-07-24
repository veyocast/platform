# Database Schema Canon

## Identity

- `profiles`
- `platform_memberships`
- `tenants`
- `tenant_memberships`
- `tenant_invitations`

## Media

- `media_assets`
- `media_variants`
- `media_processing_jobs`

## Playlists

- `playlists`
- `playlist_items`
- `playlist_releases`
- `playlist_release_items`

## Screens and devices

- `screens`
- `player_devices`
- `pairing_sessions`
- `screen_assignments`
- `player_heartbeats`
- `player_sync_events`

## Operations

- `audit_events`
- `integration_connections`
- `integration_sync_runs`
- `widget_snapshots` later

## Studio

- `studio_projects`: tenantproject, eigenaar, formaat en lifecycle.
- `studio_project_drafts`: het enige mutable concept met revision guard.
- `studio_revisions`: immutable checkpoints en renderbronnen.
- `studio_revision_assets`: immutable tenant-aware mediareferenties.
- `studio_render_jobs`: service-role queue, lease, voortgang, cancel en retry.
- `studio_exports`: immutable koppeling van revisie, job en media-item.
- `studio_command_receipts`: append-only idempotentiebewijs voor human commands.
- `studio_tenant_brand_kits`: één tenantgebonden logo- en kleurset met alleen
  verwijzingen naar ready media uit dezelfde tenant.

Studio-tabellen gebruiken `tenant_id NOT NULL`, composite foreign keys en
`FORCE ROW LEVEL SECURITY`. Menselijke writes lopen uitsluitend via guarded
RPC’s; queueclaim en completion zijn alleen voor `service_role`. Een voltooide
export wordt een bestaand `media_assets`-record met normale varianten, zodat
Publisher en Player geen Studio-specifiek datamodel nodig hebben.

Een draft blijft mutable en gebruikt optimistic concurrency. Iedere tiende
geslaagde save maakt een immutable `checkpoint`; renderen en herstellen maken
altijd een eigen immutable revisie. Herstellen schrijft nooit terug in een oude
revisie, maar maakt een nieuwe guarded draft/revisiecombinatie.

## Roles

Platform:

- `platform_owner`
- `platform_admin`
- `platform_support`
- `platform_viewer`

Tenant:

- `tenant_owner`
- `tenant_admin`
- `tenant_editor`
- `tenant_viewer`

## Important constraints

- No single `role` on `profiles`.
- A user can belong to multiple tenants.
- Tenant-owned tables have `tenant_id NOT NULL`.
- Cross-tenant references are blocked with composite FK patterns.
- Releases are immutable.
- Audit events are append-only.
