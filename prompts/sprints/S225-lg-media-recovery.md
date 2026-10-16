# S225 — LG-mediapublicaties na afspeelfouten

De gebruiker meldt dat Android afbeeldingen/video toont en synchroniseert,
terwijl LG alleen menu-HTML toont. Productie draait 49c916cc op beide runtimes.
De LG heeft afbeelding Droog volledig geverifieerd maar sinds 16:31 UTC geen
itemgrens of eerste frame bevestigd; de voorgaande videofout is media code 4.
Onderzoek afzonderlijk de vastgelopen publicatiewissel en de decoderroute.

Ownership: apps/player/app/_lib/lg-legacy-page.ts en indien daadwerkelijk nodig
lg-probe-page.ts; uitsluitend bijpassende Player-regressies; dit sprintprompt,
docs/s225-lg-media-recovery.md, PLANS.md en TASK_LEDGER.md. Alleen read-only
tenantgebonden productiecontrole en bestaande beschermde diagnostiek. Stop en
rapporteer vóór uitbreiding naar andere bronpaden, schema, workflows of keys.
Geen dependency-, merkasset-, provider- of contentmutaties.

Reproduceer de verloren overgang na een geweigerde video vóór herstel.
Een volledig geverifieerde nieuwe publicatie mag na terminale afspeelfout verder,
zonder gezonde video, gepauzeerde goal-overlay of compositiegrens te onderbreken.
Bewaar immutable releases, generatiecontrole, zichtbare framebevestiging en
werkelijke offline last-known-good. Claim geen fysieke decoderreparatie zonder
nieuwe deviceproef. Test, commit, push en rol beschermd uit binnen bestaande
gebruikersautorisatie.
