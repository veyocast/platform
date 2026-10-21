# S268 — Correcte miniatuur voor Stadion

De daadwerkelijke S244-Vormgevingcapture toont bij `Stadion` het VeyoCast-
marketingbeeld. De gekozen Sync-bron heeft daar een herhaald blauw patroon.
De picker verwijst nu naar hetzelfde oorspronkelijke CSS-patroon; de onjuiste
inlineverwijzing naar de hero is verwijderd. De marketinghero zelf blijft
ongewijzigd beschikbaar voor zijn bestaande marketing-/opstarttoepassingen.

Dit wijzigt alleen de miniatuur. De achtergrondwaarde, selectiestatus, callbacks,
vijf presetlabels, drie OnzeTrots-scènes met zes oriëntatiebestanden, eigen foto,
rendering, immutable snapshots en Player blijven behouden. De twee patroonkleuren
zijn letterlijk Source-inhoud, geen nieuwe UI-merkkleuren of merkassetvariant.

De gerichte componentlint sloot exit0; de bestaande monorepowaarschuwing over
de ontbrekende `pages`-map blijft zichtbaar. De daadwerkelijke native390/1440-
verificatie en normale gecombineerde CI zijn nog open. Hiervoor wordt geen
nieuwe test geschreven die alleen deze reversibele CSS-declaratie herhaalt.

Baseline: S244 bouwhead `8e03f2b36b0c9f82852a1531c72074a552d18412`, Control-
BUILD_ID `gXTRRqg6q-UKmSqzvs23h`, native B-capture `0292-actual-bc0daf003817`.
De complete bestaande cohort blijft op zijn werkelijke head/build geregistreerd.
De afzonderlijke miniatuurcorrectie krijgt eigen nieuwe bron-/nativebeelden en
wordt niet als heruitvoering of herlabeling van oude pixels gepresenteerd.
Vijf volledige reviewpassen, definitieve integratie en normale staging-/
productie-uitrol blijven bij S244; dit document claimt geen V1-compleet.
