# Capability gaps

Deze audit voorkomt dat een bestaand datamodel als een af product wordt
gepresenteerd. Status `PARTIAL` betekent dat alleen de genoemde deelstroom mag
worden getoond. `BLOCKED` betekent: geen CRUD, knop of claim zonder eerst een
guarded servercontract, RLS/ACL en tests toe te voegen.

## Mediaorganisatie — PARTIAL

- Schema: `media_folders`, `media_tags`, `media_asset_tags` in S25 en
  `media_collections`, `media_collection_items` in S123.
- Backend: `mutate_media_organization_v1`, `mutate_media_collection_v1`,
  `bulk_organize_media_assets_v1` en `list_publisher_media_assets_v2`.
- UI: create folder/tag/collection en asset move/tag/favorite/membership.
- Gap: update/delete folder/tag en update/archive collection zijn niet als
  serveractions/UI ontsloten; lifecycle-E2E is onvolledig.
- Besluit: bestaande stromen migreren. Nieuwe backend-gedekte acties pas met
  pgTAP plus live E2E; collection alleen archiveren, nooit hard-deleten.

## Sponsorcontacten — BLOCKED

`sponsor_contacts` bestaat in S115 met leespolicy, maar zonder write-RPC,
serveraction, UI of specifieke RLS-test. Geen contact-CRUD of nepknop in S144.
Een latere forward migration moet `tenant.sponsor.write`, audit en isolatietests
als één eenheid leveren.

## Sponsorovereenkomsten — BLOCKED

`sponsor_agreements` bestaat, maar heeft geen publiek commandcontract, action,
UI of lifecycletest. `create_sponsor_campaign_v1` kan een agreement niet veilig
koppelen. Juridische statusovergangen en permissions zijn onbeslist. Niet als
af product tonen.

## Sponsortaken en -kansen — PARTIAL READ-ONLY

`sponsor_tasks` en `sponsor_opportunities` worden gelezen voor open aantallen en
stage-aggregaten. Mutatiecommands, details en lifecycle-RLS-tests ontbreken.
S144 behoudt uitsluitend de eerlijke aggregaten.

## Creative sets, families en contextbindings — PARTIAL

De bestaande campaignflow maakt impliciet één standaardset en een family per
asset. Plaatsing maakt geen contextbinding; zelfstandig set-/familybeheer en
een contextpicker missen ownership en guarded contracts. S144 behoudt en labelt
de impliciete flow, zonder volledige creative-libraryclaim.

## Retentiebeleid en runs — PARTIAL READ-ONLY

`retention_policies`, `retention_runs`, `run_retention_maintenance_v1`, de
service-role job en het runbook bestaan. Alle policies starten met
`legal_review_required`; owner-read, policy approval en runcontrole hebben geen
complete UI/testketen. Een platformoppervlak mag hooguit feitelijke read-only
status tonen. Geen automatische enforcementclaim of editable beleid.

## Verwijderverzoeken — PARTIAL; EXECUTION BLOCKED

Account-/tenantintake en AAL2 platformreview-RPC bestaan; Control Mobile biedt
accountintake/status. Tenant-Control, governance-inbox en uitvoering ontbreken.
Het runbook verbiedt terecht een handmatige status `executed`. S144 behoudt de
mobiele intake en bouwt geen uitvoering of misleidende reviewactie.

## Platform custom roles — PARTIAL, SUPPORT-ONLY

De zogenaamde custom roles bevatten uitsluitend `platform.ticket.*` en zijn
supportwerkrollen. Create/assign vereist `platform_owner` plus AAL2;
update/archive/delete/unassign en complete testdekking ontbreken. Dit is niet de
vaste platformrolenum. S144 noemt ze `supportwerkrollen`, toont owner-only forms
alleen aan de owner en claimt geen platformbrede RBAC.

## Supportnotificaties en routing — PARTIAL

Departments, role mappings en notificationrecords bestaan; routing gebeurt bij
create. Update/archive/reroute, notificationconsumer en mark-read ontbreken.
S144 behoudt departmentlabels en inbox, maar presenteert geen volledig
notificatiecentrum of af routingproduct.

## Vereiste volgorde voor ieder vervolg

1. Domeinowner en capability vastleggen.
2. Guarded command/RPC met AAL2, reden en audit waar impactvol.
3. Default-deny RLS/ACL plus tenant-A/tenant-B- en rolematrix-pgTAP.
4. Serveraction met herauth, concurrency en foutvertaling.
5. Alle empty/loading/error/permission/conflict/successstates.
6. E2E, toegankelijkheid, visual QA, docs en rollback.
