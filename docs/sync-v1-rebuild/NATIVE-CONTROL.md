# S227 · Native Sync Control

De native cockpit en vier hoofdingangen volgen de gekozen Sync-structuur.
Native Studio leest en bewaart volledige Sync-documenten via een aparte
`/api/mobile/v3/studio`-route. De bestaande v1/v2-responses, account-/tenant-/
project-ID's, SecureStore, biometrische app-lock, notificatievoorkeuren en
releaseworkflows blijven de basis. Eén expliciete Studio-workspacedependency
geeft native een smalle V3-export zonder desktop-rendererimports.

De server valideert de volledige opdracht, 512KiB-grens, tenantrechten en AAL2
vóór de bestaande atomische RPCs. Lijsten bevatten maximaal acht projecten;
alleen het geopende ontwerp krijgt maximaal twintig reeksleden en de nieuwste
renderjob. Een uitvoer is pas gereed na actuele draftrevision, ready media,
private tenantprefix, positieve bytes en export/variant-SHA-overeenkomst.

SQLite bewaart invoer en de volledige onzekere opdracht met dezelfde nonce per
actor, tenant en project voordat verzending begint. Tenantwissels behouden die
journals; accountwissels en uitloggen wissen voorafgaande accountdata. Een
mislukte purge houdt de volgende account afgeschermd. Gedeelde opslagqueues
voorkomen dat oude mounts een nieuw journal overschrijven. Onbekende uitkomsten
blijven pending; bevestigde conflicts bieden expliciet de actuele versie.
Renderpolling stopt bij verborgen scherm, lokale invoer, pending of na twee
minuten. Bevestigd toevoegen aan een playlist gebruikt de bestaande publicatieketen.

Verse passwordlogin vereist een echte authenticatorbevestiging. Bestaande TOTP
gebruikt challenge/verify; een eerste instelling start uitsluitend na de knop en
bewijst de eerste code. Instelsleutels blijven in paginageheugen. Alleen een
onafgeronde factor kan na verse accountstatus bewust worden verwijderd.
Accountwissels en MFA delen één sessiequeue; de huidige token wordt aan de
SDK-assurancereadback doorgegeven. Stateless serververificatie gebruikt dezelfde
geverifieerde bearertoken voor de AAL2-bepaling.

Werkelijke lokale bewijzen:

- Create, save met verloren HTTP-antwoord, dezelfde nonce/revisieherstel, echte
  worker-PNG en geverifieerde private preview; vreemde tenant geweigerd.
- Reeks add/duplicate/remove met verloren antwoord, detail404 na archiveren,
  oorspronkelijk receipt hersteld en geen dubbele projecten.
- Verse AAL1-passwordsessie: writer403; echte authenticatorcode naar AAL2;
  exact dezelfde createopdracht200 en replay met hetzelfde project-ID.
- Concurrente motionwijziging: oude PNG-aanvraag krijgt conflict binnen281ms,
  geen nieuwe job of publicatie. Alleen definitief23514 plus bevestigde andere
  revision krijgt die afhandeling; onzekere fouten blijven pending.
- Foundation lint/type/unit elk30/30; native58, Studio39, Control810 met34
  bestaande opt-inskips; Control-productiebuild/authgrens/clientbundelscan groen.
- Android/Hermes-export3945modules/35assets; alle32gewijzigde productiebronnen
  matchen de sourcemap. Bundel-SHA en loghashes staan in
  `execution/evidence/native-control-verification.json`.

De huidige gebruiker had alleen Player en website geïnstalleerd. Er is geen
historische Control-handtekening om te zoeken of te vervangen. Eerste Control-
storeinrichting/signing/Play blijft een afzonderlijke open configuratiegate;
de Hermes-export is geen gesigneerd installeerbaar artifact. Fysieke Android/
TV/LG/24u-acceptatie is uitgesteld. Dit bewijs claimt geen OS-biometrie-, camera-
of notificatie-uitvoering en geen volledige fysieke schermpariteit.

S227 krijgt een eigen PR/CI en integreert na de gezonde S226-webrelease. De
bestaande main→staging→exact-dezelfde-images-productieflow blijft verplicht.
Rollback herstelt de vorige webimages; v1/v2 blijven werken en lokale nieuwe
journals worden niet stilzwijgend in oudere documentformaten omgezet.

Aanvullende echte V1-acceptatie sluit templates, support met vreemdtenantweigering,
gekoppelde Player zonder contentcache en driezonecompositie met koud offline
browserproces af. Individuele conclusies staan in de148-scenariomatrix en
`execution/evidence/*-real-services-final.json`; de Venue-pilot blijft bewaakt uit.
De sponsorvier-ogenproef vond een onzichtbare ServerAction-foutredirect. Alleen
de approvalform gebruikt nu een gewone POST/303 met dezelfde authenticated RPC,
capability-/lifecycle-/CSRFgrenzen en het bestaande AALbeleid. De gevalideerde
browserorigin blijft behouden bij een afwijkende Next-listenhostname. Echte
weigering én tweede-actor-goedkeuring tonen hun bestaande fout/succesbanner.
Dezelfde editorcontrole herstelt de mobiele semantische labeltypografie en het
Licht-keuzelabelcontrast met de locked InkBlack-token; werkelijk Axe0 en geen
overflow. Overige bekende geometrieverschillen zijn expliciet verklaard in
`studio-editor-geometry-notes.json`, geen algemene pixelpariteitsclaim.

De aanvullende Interactiecontrole vond ontbrekende runtimeconfiguratie en te
vroege after_close-resultaten. De server-only keyresolver behoudt een expliciete
Engage-key bytegelijk; alleen bij afwezigheid leidt HMAC-SHA256 een aparte key af
uit de bestaande persistente serveractions-root met vaste Engage-context.
Ontbrekende/korte root of expliciet ongeldige override blijft fail-closed.
Rootrotatie verandert fallback-stemidentiteiten; behoud die root tijdens een
actieve campagne, of gebruik een stabiele aparte Engage-key. Er worden geen
nieuwe GitHubsettings of credentials vereist.

Forwardmigratie `20261018162300_sync_engage_result_privacy.sql` begrenst de
bestaande private payload centraal: after_close verbergt boolean, totaal en
optietellingen tot closed, ook in stemreceipts en identity-reads. Geen data-,
RPCsignature-, ACL- of immutable releasewijziging. Een webrollback kan deze
compatibele privacyfix behouden; terugzetten van de lekkende functie is geen
vereiste voor herstel. Een late stem na sluiting krijgt HTTP409.

De planningswizard laat de gecontroleerde definitieve submit direct naar de
bestaande serveractie gaan. Zo wordt met één klik opgeslagen; de expliciete
overlapbevestiging en serverrechten/CAS/nonce blijven dezelfde. De responsive
Source-harness wacht begrensd op toepassing van zijn bestaande mobiele
tegenmetings-CSS; ruwe productiemetingen, Source en toleranties blijven intact.
