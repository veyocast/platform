# Design Implementation Canon

## Source order

1. Approved logo/icon master assets, once supplied.
2. `docs/design-canon/v1/veyocast-design-tokens.json`.
3. `docs/design-canon/v1/VEYOCAST_PUBLISHER_BACKOFFICE_CANON_v1.0.md`
   for tenant-Control, Publisher and the mobile management PWA.
4. `docs/design-canon/v1/VEYOCAST_DESIGN_CANON_v2.0.md`.
5. Shared component library.
6. Product-specific implementation.

The Publisher canon is scope-specific: its information hierarchy, dark tenant
sidebar, editor composition and mobile flow are binding in tenant-Control.
Reference images do not override locked assets, canonical token values,
contrast, accessibility, RLS, immutable releases or player/offline contracts.

The VeyoCast Bold Design & Product Canon v2.1.1 is versioned in
`docs/design-canon/v1/`. Its Markdown source, W3C-format tokens, Tailwind
preset, component inventory, page-template inventory and asset checksums are
one governed package. The root `tokens/` files
are the existing runtime-compatible projection of that source: its semantic
values are contract-tested against the canonical package while preserving the
variable names and spacing API already used by the applications.

## Environments

- Marketing: expressive, dark editorial, conversion-oriented.
- Control: calm, operational, information-rich.
- Player: clubcontent-first, met tijdens normale playback uitsluitend de locked
  VeyoCast-lock-up linksonder op 40% opacity als goedgekeurde system mark.

Control is an operational SaaS application. It uses a 248 px desktop sidebar,
64 px topbar, 32 px desktop gutter, visible tenant or platform context, a
single clear primary action per page and resource-oriented tables. It does not
use marketing-style hero sections, soft dashboard card mosaics, decorative
charts or technical implementation copy as primary interface content.

## Officiële merkassets

De door Danny Goldenbelt ontworpen en goedgekeurde VeyoCast SVG-masters staan
byte-ongewijzigd in `assets/brand/`. De v1.0-set bevat uitsluitend de masters en
technische afgeleiden die daar in `README.md` zijn beschreven. Masters worden
ongewijzigd naar app-publicmappen gekopieerd; ze worden nooit opnieuw getekend,
gerecolourd, uitgesneden of gereconstrueerd. Nieuwe varianten vereisen expliciete
goedkeuring van de merkeigenaar. Logo-animatie vereist eveneens expliciete
goedkeuring per concrete toepassing. Alleen het volledige, locked asset mag dan
als één geheel bewegen; morphing, recolouring, uitsnijden en nieuw getekende
tussenframes blijven verboden. Een lichte rotatie van maximaal 4 graden en een
subtiele zachte glow zijn ook zonder afzonderlijke goedkeuring toegestaan,
zolang kleur en herkenbaarheid intact blijven. `prefers-reduced-motion` toont
een statische variant.

## Tokens

Do not hardcode brand colors in components. Use CSS variables and Tailwind tokens.

## Component rules

- Build primitives first.
- Use semantic props.
- Avoid local forks.
- Storybook must show light/dark, responsive and states.
- Every important pattern has loading, empty, ready, error and permission states.
- Status has a text label and a non-colour cue.
- Tables expose meaningful column headers, named actions and a mobile card
  transformation where a horizontal table stops being legible.
- Dense data belongs in a table, list or inspector; a card is reserved for a
  repeated item, modal or genuinely framed tool.
- Gebruik de gedeelde `MultiSelectDropdown` voor compacte meervoudige keuzes
  uit gewone entiteiten. Houd per-optie preflight, permissions, volgorde en
  tabelbulk zichtbaar wanneer verbergen operationele of securitycontext zou
  kosten; de server valideert verzonden waarden altijd opnieuw.
- Mobile is a task flow with its own hierarchy, not a shrunken desktop shell.

## Control calmness patterns

- Een paginaheader bevat standaard breadcrumb/context, één titel, één korte
  uitleg en maximaal één primaire actie. Toon een status alleen wanneer die
  afwijkt, blokkeert of herstel vraagt.
- Concrete acties staan vóór samenvattende cijfers. Een dashboardactie is een
  compacte regel; oorzaak, effect en herstel horen in een `Sheet`.
- Gebruik `SummaryStrip` voor compacte aantallen en prioriteiten. Grote
  KPI-kaarten mogen de primaire taak niet onder de eerste viewport drukken.
- Gebruik één `FilterBar`; zoeken blijft direct bereikbaar en secundaire
  filters bundelen op compacte breedtes.
- Gebruik `Dialog` voor begrensde creatie of bewerking en `Sheet` voor
  inspectie/context. Beide komen uit `@veyocast/ui`, niet uit lokale forks.
- Tabellen mogen persoonlijke kolomzichtbaarheid en dichtheid lokaal bewaren,
  maar server-side autorisatie en queryscope veranderen daardoor nooit.
- Platformroutes tonen alleen platformnavigatie; tenantroutes tonen alleen
  tenantnavigatie. De actieve context bepaalt de navigatiemodus.
- Control ondersteunt light, dark en system theme met semantische tokens. Een
  inline bootstrap past de opgeslagen voorkeur vóór hydration toe om een
  kleurflits te voorkomen.
- Motion duurt functioneel 140–220 ms voor dialogs, sheets, statuswissels en
  herordening. `prefers-reduced-motion` schakelt niet-essentiële motion uit.
- Instellingen groeperen velden per categorie en tonen een savebar pas nadat
  de actuele waarden afwijken van de geladen waarden.
- Op mobiel komt de primaire taak eerst; samenvatting is één compacte strook
  en filters, inspectie en iteminstellingen openen sequentieel.

## Accessibility

- WCAG 2.2 AA for website and Control.
- Full keyboard flow for dashboard tasks.
- Touch target min 44 px.
- Player readability tested at distance.
- Reduced motion respected.

## Control quality gate

Every Control UI PR must complete
`docs/control-enterprise-ux-checklist.md`, render the relevant desktop and
mobile routes, and include an accessibility test for changed flows. The
checklist is a concise execution guide; the complete canon remains normative.

## FieldFlow v3 delta

FieldFlow v3 is vanaf S144 de semantische productlaag voor marketing, Control,
mobiel beheer en beheerchrome op Playerhosts. Deze delta wijzigt geen locked
merkasset, primaire Electric-Orange/Ink-actie, securitygrens of offlinecontract.

- Surfaces zijn taakgericht en mogen 16–24 px radius gebruiken voor een
  inhoudelijk paneel, herhaald item of begrensde tool. Navigatie, losse labels
  en normale playback krijgen geen decoratieve kaartenlaag.
- De slideachtergrond gebruikt de in het immutable snapshot opgeloste
  semantische light/dark-tokenkaart en mag daardoor de clubhuisstijl volgen.
  FieldFlow-decoratie ontleent kleur aan dezelfde slideaccenten en voegt niet
  zelfstandig een conflicterende petrol- of clubgroentint toe.
- De volledige FieldFlow light/dark-tokenkaart wordt één keer per tenant in
  Instellingen beheerd. Slide-editors mogen geen afzonderlijke kleurwaarden
  opslaan; zij gebruiken voor preview en nieuwe snapshots dezelfde server-side
  tenant-authority. Historische snapshots en releases blijven immutable.
- Slidecanvassen gebruiken een vaste 12-koloms landscape- en 6-koloms
  portrait-safe grid. Copy start linksboven, dense data pagineert en primaire
  tekst blijft boven de familiegebonden minimumramp.
- Manrope is het lokale displayfont, Inter het lokale interface/bodyfont;
  Arial/Helvetica/system sans zijn deterministische LG- en capturefallbacks.
- Light, dark en high contrast zijn expliciete tokensets. Reduced motion maakt
  inhoud direct zichtbaar en schakelt decoratieve transities uit.
- Fullscreenbeeld gebruikt een orientation-specifieke focal point en een
  semantische leesoverlay: voor `fullscreen_gradient` circa 84% aan de
  tekstzijde, 58% midden en 8% aan het beelduiteinde. Sponsorcreative gebruikt
  contain op een rustige plaat en wordt nooit automatisch gerecolourd of
  gecropt.

De gereviewde voorbeelden en reproduceerbare matrix staan in
`docs/redesign/GOLDEN_INDEX.md`; de tokenbron staat in
`tokens/veyocast-fieldflow-v3-tokens.json`.
