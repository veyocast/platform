import type { BlogArticle, BlogNode } from './blog-types';

const photoPath = '/fieldflow/photos/';
const sharePath = '/blog-assets/';
const author = 'VeyoCast';
const locale = 'nl-NL';

function text(value: string): BlogNode {
  return { type: 'text', text: value };
}

function link(label: string, href: string): BlogNode {
  return { type: 'text', text: label, marks: [{ type: 'link', attrs: { href } }] };
}

function paragraph(...value: (BlogNode | string)[]): BlogNode {
  return { type: 'paragraph', content: value.map((entry) => typeof entry === 'string' ? text(entry) : entry) };
}

function heading(value: string): BlogNode {
  return { type: 'heading', attrs: { level: 2 }, content: [text(value)] };
}

function bullets(...value: string[]): BlogNode {
  return { type: 'bulletList', content: value.map((entry) => ({ type: 'listItem', content: [paragraph(entry)] })) };
}

function article(...content: BlogNode[]): BlogNode {
  return { type: 'doc', content };
}

export const blogDemoArticles: BlogArticle[] = [
  {
    id: 'demo-wedstrijddag',
    type: 'blog',
    locale,
    title: 'Zo richt je ClubTV in voor de wedstrijddag',
    slug: 'clubtv-inrichten-wedstrijddag',
    excerpt: 'Wat toon je voor de aftrap, tussen wedstrijden en na afloop? Maak een clubscherm dat de hele zaterdag relevant blijft.',
    seoTitle: 'ClubTV inrichten voor de wedstrijddag | VeyoCast',
    seoDescription: 'Maak een duidelijke ClubTV-afspeellijst voor de wedstrijddag. Kies per tijdvak het programma, actuele uitslagen, kantinenieuws en sponsorvermeldingen.',
    author,
    category: 'clubtv',
    tags: ['ClubTV', 'Wedstrijddag', 'Sportvereniging'],
    hero: {
      src: `${photoPath}FF-PHOTO-04-matchday-live-4x5.webp`,
      alt: 'Bezoekers zitten in een clubkantine met een groot wandbeeldscherm.',
      x: .53,
      y: .44
    },
    socialImage: `${sharePath}clubtv-wedstrijddag-og.jpg`,
    publishedAt: '2026-11-12T09:00:00Z',
    content: article(
      paragraph('Voor de eerste wedstrijd zoeken bezoekers vooral een aanvangstijd en veldnummer. Later op de dag willen ze de uitslagen en het resterende programma zien. Als je je afspeellijst op die momenten inricht, kunnen spelers en bezoekers de informatie in één oogopslag vinden.'),
      heading('Verdeel de dag in drie tijdvakken'),
      bullets(
        'Vóór de aftrap. Toon het eerstvolgende thuisprogramma met tijden, teamnamen en velden. Zet een wijziging bij de betreffende wedstrijd.',
        'Tussen wedstrijden. Houd het resterende programma in beeld en wissel het af met recente uitslagen, kantinemededelingen en sponsorvermeldingen.',
        'Na de laatste wedstrijd. Sluit af met de uitslagen en een korte vooruitblik op de volgende speeldag of clubactiviteit.'
      ),
      heading('Maak het scherm leesbaar vanaf de bar'),
      paragraph('Geef elke slide één onderwerp. Gebruik korte regels, zet de tijd steeds op dezelfde plek en loop tijdens de test naar de verste tafel. Maak de tekst groter als je vanaf daar een teamnaam of veldnummer moet ontcijferen.'),
      heading('Spreek af wie wijzigingen verwerkt'),
      paragraph('Bepaal vóór het weekend wie een last-minute veldwijziging kan plaatsen en wie controleert of een uitslag is bijgewerkt. Laat die vrijwilligers één testwedstrijd doorlopen. Bewaar daarnaast een korte afspeellijst met geldige clubinformatie voor momenten waarop een databron even wegvalt.'),
      paragraph('Voor een tweede scherm in de entree kan een korter programma al genoeg zijn. Lees ook hoe je ', link('je schermopstelling per plek kiest', '/blog/schermen-plaatsen-clubhuis'), '.')
    )
  },
  {
    id: 'demo-sponsoring',
    type: 'blog',
    locale,
    title: 'Geef sponsors een goede plek op je clubscherm',
    slug: 'sponsoren-zichtbaar-op-clubscherm',
    excerpt: 'Plan sponsorvermeldingen rond de momenten waarop leden kijken en leg vast wie welke plek krijgt.',
    seoTitle: 'Sponsors zichtbaar op je clubscherm | VeyoCast',
    seoDescription: 'Plan sponsorvermeldingen op ClubTV met duidelijke afspraken over schermplek, frequentie, vormgeving en een evaluatie die de sponsor begrijpt.',
    author,
    category: 'sponsoring',
    tags: ['Sponsoring', 'ClubTV', 'Afspeellijsten'],
    hero: {
      src: `${photoPath}FF-PHOTO-05-sponsor-hub-4x5.webp`,
      alt: 'Een vrijwilliger bekijkt documenten aan een tafel bij een scherm in het clubhuis.',
      x: .43,
      y: .49
    },
    socialImage: `${sharePath}sponsoren-clubscherm-og.jpg`,
    publishedAt: '2026-11-10T09:00:00Z',
    content: article(
      paragraph('Spreek met een sponsor af op welk scherm en tijdens welke momenten een vermelding verschijnt. Op een drukke zaterdag kan een plek tussen het wedstrijdprogramma en de uitslagen passend zijn. Tijdens een toernooi kan een eigen sponsoruiting bij het ontvangstscherm meer betekenis hebben.'),
      heading('Maak de afspraak concreet'),
      bullets(
        'Leg per sponsor vast welke locatie, tijdvakken en looptijd gelden.',
        'Bepaal of je één logo, een actie of een eigen slide toont. Spreek af wanneer de sponsor nieuw beeldmateriaal kan aanleveren.',
        'Noteer wie de uiting controleert en wie deze verwijdert of vernieuwt aan het einde van de looptijd.'
      ),
      heading('Maak de uiting in één oogopslag duidelijk'),
      paragraph('Laat op een sponsoruiting één naam en één boodschap centraal staan. Gebruik een leesbaar logo en voldoende ruimte rondom het beeld. Zet een QR-code alleen in als bezoekers tijd en ruimte hebben om te scannen, bijvoorbeeld aan een statafel. Test hem op het scherm zelf.'),
      heading('Evalueer met de gegevens die je hebt'),
      paragraph('Leg vast in welke afspeellijst en op welk scherm de uiting stond. Deel beschikbare weergavegegevens alleen met de juiste context. Een geregistreerde weergave zegt iets over wat het scherm toonde, terwijl je voor kijkers of scans afzonderlijke metingen nodig hebt.'),
      paragraph('Sluit de sponsorplanning aan op de ', link('indeling van je ClubTV-wedstrijddag', '/blog/clubtv-inrichten-wedstrijddag'), ' om sponsorvermeldingen en het clubprogramma goed af te wisselen.')
    )
  },
  {
    id: 'demo-opstelling',
    type: 'article',
    locale,
    title: 'Waar hang je een scherm in het clubhuis?',
    slug: 'schermen-plaatsen-clubhuis',
    excerpt: 'Kijk hoe bezoekers door het gebouw bewegen en kies per plek de juiste schermstand en inhoud.',
    seoTitle: 'Schermen plaatsen in het clubhuis | VeyoCast',
    seoDescription: 'Kies de juiste plek voor een clubscherm. Vergelijk entree, kantine en bar op kijkafstand, schermrichting, licht, stroom en netwerk.',
    author,
    category: 'schermen',
    tags: ['Schermbeheer', 'Opstelling', 'Narrowcasting'],
    hero: {
      src: `${photoPath}FF-PHOTO-08-portrait-entrance-4x5.webp`,
      alt: 'Een verticaal scherm hangt naast de glazen ingang van een clubhuis.',
      x: .55,
      y: .46
    },
    socialImage: `${sharePath}schermen-clubhuis-og.jpg`,
    publishedAt: '2026-11-07T09:00:00Z',
    content: article(
      paragraph('Loop op een wedstrijddag eens van de ingang naar de kantine alsof je voor het eerst op de club bent. Noteer waar je stil blijft staan, waar je hulp zou vragen en welke informatie je op die plek nodig hebt. Zo bepaal je eerst wat een scherm moet doen en daarna waar het het best hangt.'),
      heading('Geef elk scherm een eigen functie'),
      bullets(
        'Entree. Kies een korte route, eerstvolgende wedstrijd of gewijzigde kleedkamer. Een verticale opstelling past vaak op een smalle wand.',
        'Kantine. Geef programma, uitslagen en clubnieuws meer ruimte met een breed scherm dat zichtbaar is vanaf meerdere tafels.',
        'Bar. Reserveer het scherm voor een beperkt aantal keuzes, zoals prijzen, dagacties of afhaalinformatie.'
      ),
      heading('Controleer de plek op een druk moment'),
      paragraph('Neem een schermafbeelding op ware grootte mee naar de locatie. Bekijk het oppervlak vanaf de kijkposities die je hebt genoteerd en controleer of binnenvallend licht het beeld onleesbaar maakt. Laat een vakbekwame installateur de bevestiging, kabelroute en bereikbaarheid van stroom en netwerk beoordelen.'),
      heading('Begin met één plek en test de afspeellijst'),
      paragraph('Laat één scherm tijdens een normale clubdag draaien. Vraag een vrijwilliger welke informatie nog vragen oplevert en pas de weergave daarop aan. Gebruik die ervaring als uitgangspunt voor een eventuele tweede plek.'),
      paragraph('Breng de locaties en informatie samen in de ', link('VeyoCast-opstellingstool', '/website/opstelling'), '.')
    )
  }
];
