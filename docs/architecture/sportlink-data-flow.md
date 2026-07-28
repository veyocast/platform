# Sportlink data flow

```text
Club.Dataservice
→ allowlisted server client
→ per-article validation and privacy filter
→ canonical sport contracts
→ tenant-scoped normalized tables
→ immutable dynamic_slide_snapshot
→ safe-template-v1 SVG
→ existing PNG media worker
→ normal playlist item/release
→ existing Player checksum cache
```

Players never receive a Client ID, provider URL, raw response or template
source. A provider failure retains normalized data, current snapshot, PNG,
release and last-known-good Player cache. IDs are unique per tenant, connection
and external ID. Teams and current-window matches are only soft-deactivated
after three non-empty successful snapshots omit them; an empty provider response
never triggers bulk deletion.

The article registry is the only network allowlist. It binds capability,
sensitivity, argument schema, mapper and sync group. Adding an article requires
official `/list` evidence, a bounded argument schema, privacy classification,
canonical mapper, fixture and contract test.
