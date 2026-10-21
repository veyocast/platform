# S268 — Stadionminiatuur volgt de gekozen Sync-bron

Tijdens de volledige S244-vergelijking toont de echte Vormgevingpagina bij
`Stadion` ten onrechte de marketinghero. De immutable Sync-bron gebruikt voor
deze achtergrondkeuze een herhaald blauw patroon. Herstel uitsluitend deze
miniatuur; de gekozen achtergrondwaarde en daadwerkelijke sliderendering blijven
behouden. Dit is de noodzakelijke verdere uitvoering van de expliciete opdracht
om de UI diepgaand met het prototype te vergelijken en afwijkingen te repareren.

Root is de enige writer. Eigen worktree `/home/codex/repos/castivo-s268`, branch
`veyocast/s268-stadium-picker-preview`, basis `234fb527f1bd946b7db55795a1d8d22107e56f54`.
De actieve S244-productieruntime en bronfreeze worden tijdens die captures niet
gewijzigd. Lees de bestaande S244-instructies en de originele Source-selector
`.vc-background-choices>.stadium` op de bevroren Sync-bron.

Exclusieve ownership:

- `apps/control/app/(shell)/dashboard/studio/sync-background-picker.tsx`
- `apps/control/app/(shell)/dashboard/studio/sync-background-picker.module.css`
- dit prompt, `docs/s268-stadium-picker-preview.md`, eigen ledgerregel.

Verwijder uitsluitend het marketinghero-inlinebeeld voor deze swatch en neem
het oorspronkelijke Source-patroon letterlijk over in de bestaande stadiumklasse.
Geen nieuw merkbeeld, nieuwe kleurkeuze, dependency, command-, renderer-, asset-,
schema-, autorisatie-, Player- of publicatiewijziging. Alle overige opties,
OnzeTrotsfoto's, afmetingen, labels, selectie en callbacks blijven gelijk.

Gebruik passende bestaande wizard-/UI-/foundationgates en visuele verificatie
op390/1440. Geen nieuwe test die alleen deze reversibele CSS-implementatie spiegelt.
Bewaar de oude foutieve beelden als baseline. De bestaande volledige S244-cohort
blijft onder zijn eigen werkelijke head/build geregistreerd; de afzonderlijke
miniatuurcorrectie vereist eigen bron- en native bewijs, geen herlabeling van oude
pixels. Vijf daadwerkelijke volledige reviewpassen en uitrol blijven bij S244.
