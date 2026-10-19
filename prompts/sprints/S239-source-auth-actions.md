# S239 — Auth en resterende primaire acties naar gekozen Sync

Gebruikersopdracht: oude oranje knoppen verwijderen, prototype UI/UX leidend;
volledige uitrol blijft geautoriseerd. Historische generieke Orange-primary-
regel wordt voor deze gekozen Sync UI door de expliciete gebruikersdelta
overtroffen. Locked assets/security/Player-invarianten blijven leidend.

## Ownership
Writer: uitsluitend nieuwe `apps/control/app/sync-auth.css`; import daarvan
in `apps/control/app/layout.tsx`; visuele class/copyaanpassingen in
`apps/control/app/login/page.tsx`, `register/page.tsx`,
`forgot-password/page.tsx`, `accept-invite/page.tsx`,
`auth/reset-password/page.tsx`, `auth/mfa/page.tsx`,
`auth/callback/page.tsx`, `onboarding/page.tsx`,
`(shell)/context/page.tsx` (alle onder apps/control/app);
`apps/control/app/_components/control-pwa-runtime.tsx` en bijbehorende
`.module.css`; `apps/control/app/(shell)/dashboard/media/sites-media-editor.tsx`;
nieuwe `tests/control/sync-auth-surface.spec.ts` en eigen bewijs/docs
`docs/s239-source-auth-actions.md`. Root bezit dit prompt en TASK_LEDGER.md.
Geen actions/session/MFA/fragmentbridge/backend/serviceworker/deps/tokens/
SourceCSS/assets aanpassen; bestaande formulieren/POST/returnTo/guards/
nonce/CAS/capabilitybindingen bytegelijk houden. Buiten ownership stop-report.

## Implementatie en bron
Lees verplichte canons. Authbron: immutable Sync App.tsx login Modal,
login-card en echte Source CSS. Alleen login heeft expliciete Sourceview;
andere echte authvormen volgen dezelfde card/typografie, geen verzonnen
heldenillustratie of democode. Bestaande AuthBrand full-dark.svg210px locked.
Geef auth-shell lokaal `.sync-control.sync-auth` en passende Source
540px/26pxpadding/22pxradius/18pxgap/desktop, viewport20px marge/mobiel18px
padding zonder primaire tekst<14px en zonder verlies van44px/focus/status.
Bestaande brede/context/onboardingtaakflow mag niet naar kleinecard geperst;
maak responsive met dezelfde Sourceafstand/typografie. Lokale groene
accenttoken voor auth-button en retained link/buttonprimary; geen globaal
brandtoken vervangen. Echt liveLogin technische server-side-rollencopy
mag eenvoudig 'Log in om je beveiligde werkplek te openen.' worden.
PWAtoast is buiten shell: lokale gekozen Syncpalette/card/14px/44px
zonder SW/update/offlinehandshakewijziging. Mediaeditor rawdemo-buttonprimary
naar semantische bestaande Button variantprimary; geen writers wijzigen.

## Bewijs
Leg eerst concrete bron→huidige verschillen vast. Bestaande authsecuritytests
blijven; controleer action/forms bytegelijk buiten toegestaneclass/copy.
Scopedlint/TSC en relevante bestaande units; meaningful390/1440 UI/aXe
met echteproductcode/CSS, liveguardsemantiek niet omzeilen. Browser alleen
na expliciete rootGO (1worker); nooit eigen devserver zonder afstemming.
Geen echte auth/mail/prodcredentials nodig. Preserve first red. Geen
algemene pixel-/V1-/vijf-rondenclaim. Geen commit/push/deploy door writer.

Na visuelefreeze vindt writer readonly een feitelijk statuscopydefect in het
eigen PWAcomponent: waitingSW zegt al 'VeyoCast is bijgewerkt' vóór activatie.
Root geeft uitsluitend deze string naar 'Nieuwe versie beschikbaar' en de
bijbehorende echte browserassertie vrij. SW/controllerchange/activatie/reload/
offlinehandshake bytegelijk behouden, finalehashes opnieuw vastleggen.

## Root vervolg peer04: metadata leesbaarheid
Writerfreeze correctgroen/44px maar oude .demo-fieldlabel12/13px en
.metadataDialog.inspectorbutton13px bleven actueel. Root neemt uitsluitend
eigen sync-auth.css en bestaande nieuwe sync-auth-surface.spec.ts over:
lokale retained-media14pxoverride met voldoende specificity voor werkelijke
labels/inputs/save; geenaction/nonce/CAS/mediaCSSglobalwijziging. Bestaande
390/1440metadata-dialogcases toetsen aanvullend computedfonts. Eigenoude
rootstatics/browsers volgen opnieuw; eerderewriterfreeze blijft apartbewijs.

## Root vervolg echte media-browserbevindingen
Root breidt eigen ownership uitsluitend uit met de metadataDialog-regels in
`apps/control/app/(shell)/dashboard/media/sites-media.module.css`. Echte eerste
7cases5PASS2FAIL: twee status-/gebruikteksten onvoldoende contrast op390px;
1440px-hitbox tijdens bestaande enteranimatie43.9548px bij computed44px.
Alleen lokale Source teksttokens en14px/readable detailslink aanpassen;
statuscopy/iconen/softstatusvlakken/commands blijven. Test wacht uitsluitend
op werkelijk afgelopen dialoganimaties vóór geometrie; geen toleranties,
assertieverwijdering of doelvergroting ter maskering. Eerste rood behouden.

## Root normale dependencyintegratie
S234 via gewone merge; root mag uitsluitend één overgenomen lege EOFregel
in `tests/helpers/sync-create-wizard-fixture.ts` verwijderen voor diffcheck.
Geen functionele helper-/casewijziging. Alle eigen19padproducthashes behouden.
