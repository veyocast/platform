# Sportlink template contracts

The seeded fixed templates use a deliberately small, provider-independent
presentation view:

```text
sport.title
sport.items[].id
sport.items[].primary
sport.items[].secondary
sport.items[].meta
sport.items[].status
```

The normalization/snapshot boundary derives those fields from canonical
`match.homeTeam`, `match.awayTeam`, `match.startsAt`, `match.venue`,
`standing.rows` and `activity` contracts. Sportlink Dutch source fields never
appear in a published manifest. Platform
templates are fixed, versioned `veyocast-safe-template-v1` sources. Tenant users
select filters, maximum items, empty-state behavior, duration and transition;
they cannot inject HTML, CSS or JavaScript.

To add a template, create landscape and portrait drafts, declare only canonical
allowed fields, validate representative empty/long/missing-logo fixtures,
publish with AAL2 and render both orientations. The output remains a normal
immutable PNG media asset.
