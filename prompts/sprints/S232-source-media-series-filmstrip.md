# S232 — Echte rawmediareeksen en Source-filmstrip

De volledige startprompt en de herhaalde expliciete Source-afkeuring door de
gebruiker blijven leidend. S231 heeft onafhankelijke mediaframes/immutable
versies geleverd maar mist de oorspronkelijke reeks- en filmstripinteracties.
Dit vervolg is één afzonderlijke branch/worktree/PR:
`veyocast/s232-media-series-filmstrip`, `/home/codex/repos/castivo-s232`.
Root heeft de schone branch normaal naar S231-mainmerge
`46da925b6f0ff5047484c83620fab3e42a11e6a0` fastforwarded. Geen nieuwe integratie
naar main tijdens de lopende S231-productiepromotie.

Lees eerst de normale README/PLANS/TASK_LEDGER/technische/design/Publisher/
security/offlinecanons, het S231-sprintprompt en zijn mediaframedocumentatie.
Daarna zijn het bewaarde `/tmp/veyocast-s232-db-contract-plan.json` en §8 van
`/tmp/veyocast-s232-media-series-ui-plan.md` de door root vastgezette API.
De oorspronkelijke `Content.tsx` van Source
`8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a` blijft bytegelijk.

## Vastgezette betekenis

- De filmstrip toont de volledige niet-gearchiveerde contentbibliotheek;
  uitsluitend reeksmembers tonen is een andere flow. Geen nep-Studio-IDs voor
  rawmedia; bestaande content_key/hrefs en echte verified previews gebruiken.
- Source `seriesTitle` hoort bij ieder lid. De header krijgt uitsluitend
  identiteit/revisie/teller, geen gedeelde titel. Eén lid bewaren verandert
  nooit ongemerkt de labels van andere leden.
- Lege titel is geldig en maakt een bestaande binding niet los. Bij append
  wordt trim(seriesTitle) of de genormaliseerde settings.name uitsluitend op
  het huidige en nieuwe lid toegepast; overige leden blijven bytegelijk.
- Geen van Studio geleende20limiet: elk append maakt precies één logische
  kopie. Een gelockte geïndexeerde tellervolgorde bewaakt integeroverloop;
  minimaal21leden moet betekenisvol slagen.
- Bewaar de huidige vuile frame-invoer en maak de volgende kopie in dezelfde
  transactie. Geen media-bytecopy, nieuw playbackkind, oude ID-herschrijving,
  providerfetch, GET-write, mutable versie/release of versimpeld offlinegedrag.

## Databaseownership

Na afsluiting van de huidige S234-providerrecoveryfix bezit `media_db`
uitsluitend één nieuwe forwardmigratie
`supabase/migrations/20261019000000_sync_media_frame_series.sql` en één nieuwe
pgTAP-file `supabase/tests/rls_sync_media_frame_series.sql` in deze worktree.
Geen andere SQL, seed, databasepackage, gegenereerde types, dependencies,
workflows, Sourcebestanden, Control of Player wijzigen. S231-migratie
`20261018200500_sync_media_frames.sql` blijft exact SHA256
`304429f3ba27dfa8b297aa7ecc41f85c841c938a1206e897aaaf320895d887c5`.
Andere noodzakelijke paden eerst stop-and-report; geen commit/push/deploy.

De twee tenanttabellen en hun types/keys/indexen staan exact in het frozen
JSONplan: header `media_frame_series`, membership `media_frame_series_items`.
Tenant NOT NULL, default-deny RLS, tenant-aware composite FKs, SELECT uitsluitend
bestaande leesrechten, uitsluitend guarded bestaande auteurrechten muteren.
Alle publieke RPC-grants expliciet; helperfuncties private en `search_path=''`.

`mutate_media_frame_series_v1` heeft de acht frozen argumenten voor tenant,
frame/CAS,series/CAS,operation,payload,nonce. Alleen save_series/append_series.
De oorspronkelijke volledige opdracht/receipt is authority vóór mutable CAS;
actuele actor/tenant/actieve status en dezelfde bestaande mediamutex blijven
leidend. Hergebruik de bestaande publieke S231-create/savefuncties binnen
dezelfde transactie met private afgeleide innernonces. Append heeft
`isPrimary=false`. Nieuw lid of eerdere create kan niet half gecommit worden.

Het payload heeft uitsluitend de frozen sourceAssetId/settings/expectedSources/
seriesTitle en bij append newFrameId. De uitkomst is het huidige frame-DTO plus
series-DTO en bij append nieuw frame-DTO. Eén atomair begrensd
`get_media_frame_series_v1` levert de binding zonder samengestelde races.
Ongebonden+leeg bewaren blijft ongebonden; nieuwe groep start op rev1 en ieder
volgend boundcommand verhoogt de groepsrevisie exact eenmaal.

## Gates en expliciete omgevingsgrens

Alleen de bestaande disposable gatesomgeving
`supabase_db_veyocast-s226-gates`, CLIprojectlabel `veyocast-s226-gates`,
API57721/DB57722 mag na rootbevestiging van haar exacte CLIworkdir worden
gereset/gebruikt. Werkelijke QA57621/57622, profielen/auth, uploads, staging en
productie nooit resetten of historisch repareren. Geen credentials afdrukken.
Geen generieke `db push`, historyrepair of `--include-all` tegen bestaande QA.
Root levert de geverifieerde disposable-resetroute afzonderlijk; schrijf de
twee afgebakende bestanden alvast maar voer tot die bevestiging geen SQL uit.

Betekenisvolle tests: anon/viewer/custom/cross-tenant denies; onbekende/malforme
payload; create/save/append met vuile instellingen atomair; rollback bij één
ongeldige kopie; originele nonce/replay vóór CAS; changed-body rejection;
stale frame/group CAS en echte parallelle sessies; per-member labels/blanke
titel/fallback; geen20limiet; archived/restored membership behouden; bytes,
bestaande pinned plaatsingen, versies en releases onaangeroerd. Daarna verse
reset door alle migraties en volledige RLS-suite plus database-lint, met rood
bewijs behouden. Alleen exact deze gate-DB mag muteren.

Root bezit latere Control/contracts/reader/writer/recovery/integratie en docs.
UIjournal v2 omhult de bestaande framecommands zonder ze om te zetten en
bewaart seriecommands apart; oude v1pendingcommands blijven oorspronkelijke
opdrachten. Geen UIwrites door deze databaseopdracht vóór aanvullende scope.

## Definitieve Controlgrens en opgelost voorstelverschil

Het frozen databaseplan is leidend voor de acht RPCargumenten: ongebonden
betekent `seriesId=null` en `expectedSeriesRevision=null`, niet een client-UUID
met revisie0. De server reserveert de nieuwe header binnen dezelfde transactie;
het parentreceipt bewaart haar identiteit ook bij een verloren antwoord. Dit
vervangt uitsluitend het preallocatievoorstel in §8 van het tijdelijke UIplan.
Een seriescommand heeft geen los `isPrimary`: revisie0 is uitsluitend de nieuwe
primary; een bestaande primary/kopie wordt door de database opgezocht.

Root bezit nieuw `content/media-frames/media-frame-series-types.ts` en zet daar
eerst de gedeelde DTOs/commandinterface neer. Daarna bezit `scenario_audit`
uitsluitend: nieuw `media-frame-series-contract.ts`/`.test.ts`,
`media-frame-series-actions.ts`/`.test.ts`, `media-frame-filmstrip-data.server.ts`
en `.test.ts` in die map; de bestaande `media-frame-data.server.ts` met gerichte
`media-frame-data.test.ts`, `media-frame-types.ts`, beide mediaeditor-page.tsx
routes, en `content/page.tsx` uitsluitend voor extractie van de bestaande
Contentreadmapper naar nieuw `content/content-data.server.ts` en eigen tests.
De gedeelde types blijven rootownership. Geen UI-, SQL-, Player-, contractpackage-,
lock-, workflow- of globale CSSwijziging. `mutateMediaFrameSeriesAction` ontvangt
unknown+expectedActorScope en geeft het vastgezette result terug.
`readContentFilmstripAction` ontvangt tenantId/offset+expectedActorScope en geeft
ok+page of okfalse+message. Exacte oude Contentkeys/hrefs/signing behouden.

Na rootGO bezit `release_audit` uitsluitend de bestaande
`media-frame-editor.tsx`, zijn lokale moduleCSS, nieuw
`media-frame-series-state.ts`/`.test.ts`, `media-frame-filmstrip.tsx` en lokale
moduleCSS, de additieve optionele slots in `studio/sync-studio-frame.tsx`, plus
nieuw `tests/control/sync-media-series-filmstrip.spec.ts`. Geen andere shared
renderer/Source CSS. Servertypes/readers/actions blijven bij scenario/root.
Geen eigen browser/run/install/reset/commit/push. Eerst code/statics en freeze;
browser uitsluitend na rootGO.

Root breidt vóór writes de UIownership uitsluitend uit met de bestaande
`tests/control/sync-media-frame-editor.spec.ts` voor zijn esbuild-actionboundary:
onderschep ook de nieuw ingevoerde `media-frame-series-actions` en geef zijn
twee nieuwe exports expliciete onverwachte-call-afwijzingen. De oude15gevallen
hebben geen mediaSeriesprops en mogen die acties niet aanroepen. Geen fixture,
assertie, aantal, deadline of skip aanpassen. Een werkelijk noodzakelijk
beforeunload-accept alleen bij de eigen expliciete reloadactie en eerst met
behouden rood bewijs; geen generieke dialog dismissal die fouten verbergt.
# Rootdelegatie daadwerkelijke acceptatie na freezes

Alle drie productscopes zijn bevroren en lokaal getoetst. De exacte SQL is al
eenmalig op de eigen QA57622 toegepast:178historyrows,19oude trackinggaten
ongewijzigd,15oude tenanttabellen bytegelijk. NOOIT opnieuw resetten of dit
forwardscript opnieuw uitvoeren. Root delegeert `media_db` uitsluitend echte
lokale AAL2-browseracceptatie met beschermde /tmp-harness en bewijs onder
`/home/codex/.local/state/veyocast-s226/release-evidence/s232-*`.
Geen productwrites, producthashes frozen. Geen eigen commit/push/deploy.

De echte applicatie draait localhost3398, eigen lokale Supabase57621/57622,
tenant19170000-0000-4000-8000-000000000010 en actor
19170000-0000-4000-8000-000000000001. Beschermde bestaande auth-state/config
alleen in geheugen lezen; nooit cookies/keys/bodygeheimen printen.
Alleen nieuwe expliciet als S232-acceptatie benoemde eigen frames/series/receipts
maken via de normale UI/canonieke serveractie. Bestaande frames/assets/
playlists/releases/schermen/configuratie blijven onveranderd. Bronimage
93a6ab57-fb91-4da0-87cc-36b93a714a22 heeft geen primary; eigen eerdere QAimage
e8856e6c-eec6-4c90-812e-e33e4d7162f0 mag private achtergrond worden zonder
zijn bytes of bestaande metadata te veranderen. Geen source/upload/provider-
sync/publicatie/invite/flag/accountwijziging en geen productieverbinding.

Maak één atomic append met eigen titel en per-memberlabel via de nieuwe
echte reeksbediening, laat de server committen, bewijs parentreceipt+2frames
en verlies daarna gecontroleerd uitsluitend het eigen eerste antwoord.
Reload bewaart de volledige originele JSONbody/nonce; bevestig dezelfde
opdracht opnieuw. Toon exact één reeks/2leden/2frames en één parentreceipt,
zonder dubbele bytes of writes. Test daarna dirtyfilmstripnavigatie en
herstel zonder impliciet opslaan, per-memberlabels en lege titel zonder
detach, Sourcegeometrie/44px/aXe390/1440 en preservation-guards. Gebruik
nieuwe eigen rijen voor eventuele vervolgsaves; geen oude rijen herstellen.

Browser uitsluitend afzonderlijk rootGO, één worker. Bewaar eerste fouten
en stop bij nieuwe echte productfout voor gericht ownership. Herstel geen
harnas door asserties te schrappen. Root beoordeelt echte proof en de open
compatibiliteits-/Source-/releasegrenzen voordat integratie verdergaat.


Root delegeert na actualAAL2PASS aan nieuwe agent `series_release` uitsluitend
nieuw docs/s232-source-media-series-filmstrip.md, eigen S232-ledgerrij en
bewijssupplement in dit prompt. Alle productfiles blijven frozen; oude writer
is gestopt na capacityfout. Verifieer hashes/alle passende gates en maak na
groen normale commit/push/DRAFTPR naar main, altijd artifact-attach proberen.
Geen merge/deploy, reset/historyrepair, prodcredentials of force/amend/rebase.
Root doet integratie en normale staging/productiepromotie afzonderlijk.

## Bewijssupplement releasevoorbereiding — 19 oktober 2026

Alle 24 product-/testpaden matchen de finale SQL-, server- en UIwriterhashes.
Releasevoorbereiding heeft uitsluitend de toegestane docs, eigen ledgerrij en
dit supplement geschreven. Geen reset of tweede QAforward uitgevoerd.
`pnpm lint --concurrency=2`, `pnpm typecheck --concurrency=2` en
`pnpm test --concurrency=2` zijn serieel elk30/30 groen, met29/29/28 cachehits;
Control1194PASS/34bestaandeSKIP. Het foundationmanifest staat in
`/tmp/veyocast-s232-release-foundation.json`, SHA256
`111f4069145fe9bb2028d4804a65ab8c1e462a98d5e418212e78a2d19dc75d6d`.

Finale eerdere gates: disposable197migraties, RLS132files/3876asserties waarvan
102nieuw,7echte sessieraces en error-level lint0; server119units; UI18nieuwe
state+28presenterunits en24browsercases(15oude+9nieuwe),aXe0/44px390/1440.
De werkelijke AAL2acceptatie bevestigt atomicappend vóór antwoordverlies,
dezelfde Flightbody/nonce na reload en exact1reeks/2frames/2leden/1parentreceipt;
dirtyfilmstrip zonderwrite en afzonderlijke/lege lidtitel met behouden binding.
Alle oude rijen162tenanttabellen behouden,155tabellen volledig exact,
Storage/history/producthashes gelijk. Het finale acceptatiemanifest is
`/tmp/veyocast-s232-actual-acceptance-final.json`, SHA256
`c17554894a5912b957de680effce21e1a7be443459622295fe0aa2ea59633832`.

De eerste koudeSSR500/PGRST303 vóór enig command blijft onverklaard en bewaard.
Twee onafhankelijke read-only200 en de nieuwe geslaagde journey vormen geen
algemeen SSRherstelbewijs. Volledige bewijsreferenties, oude mislukte pogingen,
forward-/rollbackpad en precieze beperkingen staan in
`docs/s232-source-media-series-filmstrip.md`. Eigen hosted exactheadCI en
rootintegratie/staging/productie volgen de bestaande flow; geen algemene
Sourcepixel-/V1-/provider-/hardwareclaim.
