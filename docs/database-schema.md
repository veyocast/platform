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
