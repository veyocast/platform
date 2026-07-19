# S37 - Gecontroleerde researchhorizon

## Entry gate

Een afzonderlijke productvraag en meetbaar probleem zijn vastgesteld. Deze
sprint is discovery; geen track wordt stilzwijgend production scope.

## Doel

Onderzoek latere opties met decision memo's en geïsoleerde prototypes zonder
de kernarchitectuur of launchgates te belasten.

## Verplicht lezen

- standaard AGENTS-leesvolgorde
- `docs/canon-alignment-product-roadmap.md`, sectie S37
- canon behorend bij de gekozen researchtrack

## Mogelijke tracks

- AI-contentassistent met human review en provenance;
- native/managed wrappers na bewezen kioskbeperking;
- LAN relay met contentintegriteit;
- emergency broadcast met expiry/audit/rollback;
- proof-of-play zonder audienceclaim;
- sponsorportal;
- OPFS/chunked media store na gemeten noodzaak.

## Deliverable per track

- probleem, non-goals en meetbare hypothese;
- threat/privacy/operationele analyse;
- prototype achter featureflag of fixtures;
- testresultaten en kosten/risico's;
- expliciete GO/CONDITIONAL-GO/NO-GO;
- bij GO een nieuwe bounded implementatiesprint, niet directe productieuitrol.

## Stop en rapporteer

- wanneer klantdata, productiecredentials of externe claims nodig zijn zonder
  overeenkomst;
- wanneer release-immutability, RLS of last-known-good verzwakt zou worden.
