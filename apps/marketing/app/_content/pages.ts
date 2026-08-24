import type { MarketingImageId } from "./images";

export type ContentCard = {
  body: string;
  title: string;
};

export type ContentLink = {
  href: string;
  label: string;
};

export type MarketingPageKind =
  | "article"
  | "contact"
  | "demo"
  | "feature"
  | "index"
  | "integration"
  | "legal"
  | "pricing"
  | "product"
  | "sector"
  | "support";

export type MarketingPageDefinition = {
  benefits: ContentCard[];
  description: string;
  eyebrow: string;
  examples: string[];
  faqs: ContentCard[];
  imageId?: MarketingImageId;
  index: boolean;
  kind: MarketingPageKind;
  lead: string;
  pathname: string;
  primaryCta?: ContentLink;
  related: ContentLink[];
  secondaryCta?: ContentLink;
  steps: ContentCard[];
  summary: string;
  title: string;
};

const demoCta = { href: "/demo", label: "Plan een demo" } as const;
const productCta = { href: "/product", label: "Ontdek het platform" } as const;

function featurePage(input: {
  benefits: ContentCard[];
  description: string;
  examples: string[];
  imageId: MarketingImageId;
  lead: string;
  pathname: string;
  related: ContentLink[];
  summary: string;
  title: string;
}): MarketingPageDefinition {
  const subject = input.title.replace(/\.$/, "").toLowerCase();

  return {
    ...input,
    eyebrow: "VeyoCast functies",
    faqs: [
      {
        title: `Voor wie is ${subject} bedoeld?`,
        body:
          "Voor beheerders en redacteuren die club- of organisatiecontent actueel willen houden zonder per scherm losse bestanden te beheren."
      },
      {
        title: "Wat gebeurt er bij tijdelijk internetverlies?",
        body:
          "De actieve, volledig gecontroleerde release blijft lokaal spelen. Nieuwe wijzigingen wachten tot de Player opnieuw veilig kan synchroniseren."
      },
      {
        title: "Wie mag wijzigingen publiceren?",
        body:
          "Rechten worden per rol en organisatie bepaald en bij iedere serveractie opnieuw gecontroleerd. Zichtbaarheid in de interface is nooit de enige beveiliging."
      }
    ],
    index: true,
    kind: "feature",
    primaryCta: demoCta,
    secondaryCta: { href: "/prijzen", label: "Bekijk prijsopbouw" },
    steps: [
      {
        title: "Bereid je inhoud voor",
        body: `Open VeyoCast Publisher en verzamel precies wat voor ${subject} nodig is.`
      },
      {
        title: "Controleer het resultaat",
        body:
          "Bekijk status, volgorde en gevolgen voordat je een nieuwe release maakt."
      },
      {
        title: "Publiceer gecontroleerd",
        body:
          "De Player downloadt en verifieert de release en wisselt pas op een veilig moment."
      }
    ]
  };
}

function sectorPage(input: {
  benefits: ContentCard[];
  description: string;
  examples: string[];
  imageId?: MarketingImageId;
  lead: string;
  pathname: string;
  related: ContentLink[];
  summary: string;
  title: string;
}): MarketingPageDefinition {
  const sector = input.title.replace(/^Narrowcasting voor |^ClubTV voor /, "").toLowerCase();

  return {
    ...input,
    eyebrow: "Oplossingen",
    faqs: [
      {
        title: `Welke content werkt goed voor ${sector}?`,
        body:
          `Kies informatie die op locatie direct waarde heeft. De voorbeelden op deze pagina zijn zelf te publiceren contenttypen, geen belofte van een automatische externe koppeling.`
      },
      {
        title: "Kan één beheerder meerdere schermen bijhouden?",
        body:
          "Ja. Schermen, playlists en releases worden centraal beheerd. Per scherm blijft zichtbaar welke release gewenst en daadwerkelijk actief is."
      },
      {
        title: "Blijft de content zichtbaar zonder internet?",
        body:
          "Een gekoppelde Player bewaart een geldige release lokaal en blijft die bij een tijdelijke onderbreking afspelen."
      }
    ],
    index: true,
    kind: "sector",
    primaryCta: demoCta,
    secondaryCta: { href: "/clubtv", label: "Bekijk ClubTV" },
    steps: [
      {
        title: "Breng locaties in kaart",
        body:
          "Bepaal waar bezoekers, leden of medewerkers wachten en welke informatie daar echt relevant is."
      },
      {
        title: "Maak een herkenbaar ritme",
        body:
          "Combineer vaste informatie met actuele items in een rustige, leesbare playlist."
      },
      {
        title: "Publiceer per scherm",
        body:
          "Wijs de juiste release toe en controleer op afstand of ieder scherm actueel is."
      }
    ]
  };
}

function integrationDetailPage(input: {
  benefits: ContentCard[];
  description: string;
  examples: string[];
  faqs: ContentCard[];
  index: boolean;
  lead: string;
  pathname: string;
  status: string;
  steps: ContentCard[];
  summary: string;
  title: string;
}): MarketingPageDefinition {
  return {
    benefits: input.benefits,
    description: input.description,
    eyebrow: `Integratie · ${input.status}`,
    examples: input.examples,
    faqs: input.faqs,
    imageId: "product-publisher-desktop",
    index: input.index,
    kind: "integration",
    lead: input.lead,
    pathname: input.pathname,
    primaryCta: input.index ? demoCta : { href: "/contact", label: "Vraag naar de status" },
    related: [
      { href: "/integraties", label: "Alle integraties" },
      { href: "/prijzen", label: "Prijs per scherm" }
    ],
    secondaryCta: { href: "/product", label: "Bekijk het platform" },
    steps: input.steps,
    summary: input.summary,
    title: input.title
  };
}

const integrationDetailPages = [
  integrationDetailPage({
    benefits: [
      { title: "Bestaande providergrens", body: "Sync, tenantcontext en providercredentials blijven in de bestaande server-only integratiemodule." },
      { title: "Dynamische sportslides", body: "Programma, uitslagen, standen en bezoekersinformatie gebruiken versioned ontwerpconfiguratie met actuele snapshots." },
      { title: "Last-known-good", body: "Tijdelijke provideruitval maakt een geldige actieve Playerrelease niet zwart of incompleet." }
    ],
    description: "Gebruik de bestaande VeyoCast Sportlink-module voor teams, competities, programma, uitslagen, standen en bezoekersinformatie op clubschermen.",
    examples: ["Programma vandaag en week", "Uitslagen en poulestand", "Bezoekers welkom", "Teams en competitiecontext"],
    faqs: [
      { title: "Is Sportlink geïntegreerd?", body: "Ja. De module gebruikt de bestaande server-side sync- en sportslidecontracten en toont uitsluitend data die voor de tenant beschikbaar is." },
      { title: "Blijft providerdata actueel?", body: "Datasynchronisatie vernieuwt snapshots zonder daarvoor iedere keer een nieuwe slideversie te maken." },
      { title: "Wat gebeurt er zonder wedstrijddata?", body: "De slide toont een passende lege of skipstate; onbekende scores worden niet als 0–0 ingevuld." }
    ],
    index: true,
    lead: "Maak wedstrijd- en bezoekersinformatie zichtbaar zonder providerjargon in de editor en zonder live requests vanuit de Player.",
    pathname: "/integraties/sportlink",
    status: "Beschikbaar",
    steps: [
      { title: "Verbind Sportlink", body: "Een bevoegde beheerder activeert de tenantmodule en controleert de syncstatus." },
      { title: "Kies de context", body: "Selecteer teams, slidetype, competitie, fase of poule met menselijke labels." },
      { title: "Publiceer", body: "Preview de slide en neem de concrete versie op in een onveranderlijke release." }
    ],
    summary: "Sportlink-data blijft dynamisch terwijl thema, layout en competitiecontext versioned en reproduceerbaar blijven.",
    title: "Sportlink op ieder relevant clubscherm"
  }),
  integrationDetailPage({
    benefits: [
      { title: "Normale .xlsx", body: "De launchflow gebruikt een gewone export en import; er wordt geen live Twelve-API beloofd." },
      { title: "Mapping en validatie", body: "Kolommen, categorieën, prijzen en beschikbaarheid worden vóór import gecontroleerd en gepreviewd." },
      { title: "Bronversie behouden", body: "Herkomst en importversie blijven immutable traceerbaar bij latere updates." }
    ],
    description: "Importeer een normale Twelve .xlsx-export in VeyoCast met kolommapping, validatie, prijslijstpreview en traceerbare broninformatie.",
    examples: ["Productnaam en omschrijving", "Categorie en beschikbaarheid", "Prijs in hele centen", "Herimport met preview"],
    faqs: [
      { title: "Is dit een live API-koppeling?", body: "Nee. Bij launch is dit bewust een gecontroleerde normale .xlsx-export en -import." },
      { title: "Worden fouten direct gepubliceerd?", body: "Nee. Mapping en validatie tonen problemen vóór producten of slides worden bijgewerkt." },
      { title: "Kan ik opnieuw importeren?", body: "Ja. Een herimport krijgt opnieuw validatie en preview en bewaart de broninformatie." }
    ],
    index: true,
    lead: "Werk prijslijsten bij vanuit een herkenbaar bestand zonder een niet-bestaande live API of oncontroleerbare achtergrondmutaties.",
    pathname: "/integraties/twelve-xlsx",
    status: "Beschikbaar als import",
    steps: [
      { title: "Exporteer", body: "Maak in Twelve een normale .xlsx-export volgens de ondersteunde kolommen." },
      { title: "Map en controleer", body: "Koppel kolommen en beoordeel fouten, waarschuwingen en de prijslijstpreview." },
      { title: "Importeer", body: "Bevestig de gevalideerde bronversie en gebruik producten daarna in Menu Studio." }
    ],
    summary: "Twelve XLSX is een beheerste importjourney met expliciete validatie, geen pseudo-live integratie.",
    title: "Twelve-prijslijsten via gecontroleerde XLSX-import"
  }),
  integrationDetailPage({
    benefits: [
      { title: "Bronstatus", body: "Laatste refresh, stale data en verwerkingsfouten blijven zichtbaar voor beheerders." },
      { title: "Veilige verwerking", body: "Feedcontent wordt server-side begrensd, genormaliseerd en naar een snapshot vertaald." },
      { title: "Twee oriëntaties", body: "Nieuwsoutput ondersteunt zowel landscape als portrait zonder de Player van de feed afhankelijk te maken." }
    ],
    description: "Toon RSS- en nieuwsfeeds op VeyoCast met bronstatus, mapping, veilige verwerking, stale-indicatie en landscape- of portraitoutput.",
    examples: ["Clubnieuws", "Gemeentenieuws", "Branchefeed", "Portrait en landscape"],
    faqs: [
      { title: "Wat gebeurt er bij een feedfout?", body: "De bron krijgt een fout- of stalestatus en de Player gebruikt waar mogelijk de laatst geldige snapshot." },
      { title: "Wordt alle HTML uit een feed getoond?", body: "Nee. Content wordt server-side beperkt en genormaliseerd volgens de bestaande nieuwsverwerking." },
      { title: "Kan nieuws op een staand scherm?", body: "Ja. De bestaande output ondersteunt expliciet landscape en portrait." }
    ],
    index: true,
    lead: "Laat actuele berichten zien met een begrijpelijke bronstatus en een fallback wanneer de feed tijdelijk niet ververst.",
    pathname: "/integraties/rss-nieuws",
    status: "Beschikbaar",
    steps: [
      { title: "Voeg de bron toe", body: "Configureer de feed server-side en controleer de eerste verwerking." },
      { title: "Kies de weergave", body: "Selecteer relevante velden, thema en landscape- of portraitlayout." },
      { title: "Bewaak actualiteit", body: "Gebruik syncstatus en stale-indicatie om een fout gericht te herstellen." }
    ],
    summary: "RSS/nieuws combineert actuele verwerking met Player-continuïteit en een expliciete stale- en fouttoestand.",
    title: "RSS en nieuws met zichtbare bronstatus"
  }),
  integrationDetailPage({
    benefits: [
      { title: "Alleen officiële playback", body: "Het ontwerp voorziet uitsluitend de officiële YouTube IFrame Player; downloaden of transcoderen is uitgesloten." },
      { title: "Online-only preflight", body: "Content moet vóór publicatie als online-only herkenbaar zijn met capabilitycheck en fallback." },
      { title: "Releasegate", body: "De module blijft uit tot API-, quota-, Terms-, privacy- en Playercontinuïteit aantoonbaar zijn gevalideerd." }
    ],
    description: "Bekijk de eerlijke voorbereidingsstatus van de toekomstige VeyoCast YouTube-integratie met officiële online-only playback, preflight en fallback.",
    examples: ["Officiële IFrame Player", "Online-only label", "Capability preflight", "Veilige fallback"],
    faqs: [
      { title: "Kan ik YouTube nu activeren?", body: "Nog niet als vrijgegeven productie-integratie. De feature flag blijft gesloten tot de releasegates groen zijn." },
      { title: "Slaat VeyoCast video's offline op?", body: "Nee. YouTube-content wordt niet gedownload, getranscodeerd of gecachet." },
      { title: "Wat gebeurt er zonder internet?", body: "De uiteindelijke flow moet een vooraf gekozen fallback gebruiken en mag last-known-good tenantcontent niet onderbreken." }
    ],
    index: false,
    lead: "YouTube blijft een afzonderlijk, online-only integratiespoor en wordt niet als beschikbaar verkocht voordat de officiële contracten en fallback bewezen zijn.",
    pathname: "/integraties/youtube",
    status: "In voorbereiding",
    steps: [
      { title: "Valideer officiële API's", body: "Controleer IFrame Player, Data API, quota en actuele Terms via primaire bronnen." },
      { title: "Bouw preflight en fallback", body: "Maak online-only capability en herstelgedrag zichtbaar vóór publicatie." },
      { title: "Open gecontroleerd", body: "Activeer pas na tests op Playercontinuïteit, privacy, quota en rollback." }
    ],
    summary: "De architectuurrichting is vastgelegd, maar productiegebruik blijft bewust geblokkeerd tot externe en technische gates zijn afgerond.",
    title: "YouTube in VeyoCast: online-only en in voorbereiding"
  }),
  integrationDetailPage({
    benefits: [
      { title: "Sponsorprofielen", body: "Beheer assets en sponsorcontext binnen dezelfde tenantgrens als campagnes en plaatsingen." },
      { title: "Gecontroleerde campagnes", body: "Rotatie, placements en approvals gebruiken de bestaande Sponsor Hub-contracten." },
      { title: "Bewijs van vertoning", body: "Proof of Play maakt aantoonbaar welke plaatsing volgens het plan is uitgevoerd." }
    ],
    description: "Beheer sponsors, campagnes, rotatie, plaatsingen, approvals en bewijs van vertoning met de bestaande VeyoCast Sponsor Hub.",
    examples: ["Sponsorprofielen", "Campagnes en rotatie", "Placements", "Proof of Play"],
    faqs: [
      { title: "Is Sponsor Hub beschikbaar?", body: "Ja, volgens de bestaande tenant- en vier-ogencontracten waar de module voor de tenant is geactiveerd." },
      { title: "Is een vertoning hetzelfde als een factuur?", body: "Nee. Proof of Play is operationeel bewijs; financiële afspraken blijven een apart contract." },
      { title: "Kunnen sponsors zelf publiceren?", body: "Alleen wanneer bestaande rollen, approvals en server-side capabilities dat expliciet toestaan." }
    ],
    index: true,
    lead: "Maak sponsorzichtbaarheid planbaar en controleerbaar zonder approvals, tenantrechten of publicatiehistorie te omzeilen.",
    pathname: "/sponsor-hub",
    status: "Beschikbaar",
    steps: [
      { title: "Leg sponsors vast", body: "Voeg goedgekeurde sponsorassets en context tenantveilig toe." },
      { title: "Plan plaatsingen", body: "Maak campagne, rotatie en plaatsingen met de vereiste approvals." },
      { title: "Controleer vertoning", body: "Gebruik Proof of Play en auditinformatie voor operationele rapportage." }
    ],
    summary: "Sponsor Hub verbindt sponsorbeheer met gecontroleerde publicatie en bewijs van vertoning.",
    title: "Sponsor Hub voor campagnes en zichtbaarheid"
  }),
  integrationDetailPage({
    benefits: [
      { title: "Publiek mobile-first", body: "De voorgestelde stemervaring gebruikt een korte QR-route zonder beheeraccount voor bezoekers." },
      { title: "Abusebegrenzing", body: "Rate limiting, lifecycle, privacy en misbruikdetectie zijn releasevoorwaarden, geen latere polish." },
      { title: "Schermresultaat", body: "Realtime tussenstand en eindresultaat krijgen een eigen tenantveilige dynamische slide." }
    ],
    description: "Bekijk de voorbereidingsstatus van VeyoCast Engage voor polls, Man of the Match, QR-deeplinks, live schermresultaten en privacyveilige analytics.",
    examples: ["Publieksvraag", "Man of the Match", "QR-deeplink", "Live resultaat"],
    faqs: [
      { title: "Kan ik Engage al kopen?", body: "Nee. Engage wordt pas verkocht nadat tenantisolatie, abusepreventie, privacy, lifecycle en Playeroutput productie-groen zijn." },
      { title: "Moeten bezoekers inloggen?", body: "De voorgestelde publieke flow is mobile-first en begrensd; het definitieve anti-abusecontract bepaalt welke verificatie passend is." },
      { title: "Worden persoonsgegevens gebruikt?", body: "Het ontwerp minimaliseert persoonsgegevens en vereist expliciete privacy- en bewaartermijnvalidatie vóór vrijgave." }
    ],
    index: false,
    lead: "Engage is een premium subproduct in voorbereiding en wordt niet als live functie gepresenteerd voordat privacy- en abusegates aantoonbaar groen zijn.",
    pathname: "/engage",
    status: "In voorbereiding",
    steps: [
      { title: "Maak een campagne", body: "Definieer poll of Man of the Match met start-, sluit- en resultaatmoment." },
      { title: "Deel veilig", body: "Toon een tenantveilige QR-deeplink met rate limiting en abusebegrenzing." },
      { title: "Toon het resultaat", body: "Publiceer realtime status en eindresultaat als gecontroleerde schermslide." }
    ],
    summary: "De productgrens en releasevoorwaarden zijn duidelijk; de route blijft noindex tot de implementatie en productiegates afgerond zijn.",
    title: "VeyoCast Engage voor interactie op locatie"
  })
] as const;

const featurePages = [
  featurePage({
    benefits: [
      {
        title: "Volgorde die je begrijpt",
        body: "Sleep items, gebruik toetsenbordacties en zie direct welke positie ieder onderdeel krijgt."
      },
      {
        title: "Duur per item",
        body: "Gebruik de gevalideerde videoduur als startpunt of pas de zichtduur bewust aan."
      },
      {
        title: "Concept blijft concept",
        body: "Opslaan verandert nooit stilzwijgend wat al op een scherm speelt."
      },
      {
        title: "Publiceren met controle",
        body: "Controleer assets, schermdoelen en wijzigingen voordat een immutable release ontstaat."
      }
    ],
    description:
      "Bouw VeyoCast-playlists met drag-and-drop, iteminstellingen, preview en een gecontroleerde publicatieflow voor ieder beheerd scherm.",
    examples: ["Clubnieuws en wedstrijdinformatie", "Sponsor- en partneritems", "Kantinemenu en activiteiten", "Afbeeldingen en MP4-video"],
    imageId: "product-publisher-desktop",
    lead:
      "Zet afbeeldingen en video in een logische volgorde, bepaal de weergave en publiceer pas wanneer alles gereed is.",
    pathname: "/functies/playlists",
    related: [
      { href: "/functies/media", label: "Mediabibliotheek" },
      { href: "/functies/planning", label: "Content plannen" },
      { href: "/oplossingen/sportverenigingen", label: "Voor sportverenigingen" }
    ],
    summary:
      "VeyoCast Playlist Studio houdt bewerken, bekijken en publiceren uit elkaar. Zo weet je altijd of je aan een concept werkt of een nieuwe release voor schermen klaarmaakt.",
    title: "Bouw overzichtelijke playlists met drag-and-drop"
  }),
  featurePage({
    benefits: [
      {
        title: "Eén schermvloot",
        body: "Bekijk naam, locatie, verbinding, actieve release en laatste contact in één rustige lijst."
      },
      {
        title: "Veilig koppelen",
        body: "Een Player krijgt een tijdelijke code en na bevestiging een intrekbare devicesessie."
      },
      {
        title: "Gericht herstellen",
        body: "Open diagnostiek en herstelcontext zonder technische details over publieke content te tonen."
      },
      {
        title: "Beheerde lifecycle",
        body: "Deactiveer een scherm eerst en verwijder het daarna logisch met behoud van auditbewijs."
      }
    ],
    description:
      "Beheer en koppel al jouw narrowcastingschermen centraal, met zicht op verbinding, actieve release, synchronisatie en herstelacties.",
    examples: ["Kantinehoofdscherm", "Entree en ontvangst", "Sponsorwand", "Bestuurs- of teamruimte"],
    imageId: "product-screen-status",
    lead:
      "Zie welke schermen online zijn, wat ze werkelijk afspelen en waar een concrete beheeractie nodig is.",
    pathname: "/functies/schermen",
    related: [
      { href: "/functies/monitoring", label: "Status en monitoring" },
      { href: "/functies/offline-afspelen", label: "Offline afspelen" },
      { href: "/product", label: "Platformoverzicht" }
    ],
    summary:
      "VeyoCast behandelt een Player als device, niet als gebruiker. Pairing, sessies en releases blijven daardoor gescheiden van persoonlijke accounts.",
    title: "Beheer al jouw schermen vanuit één omgeving"
  }),
  featurePage({
    benefits: [
      {
        title: "Bibliotheek eerst",
        body: "Zoek en filter op type, status en gebruik zonder dat uploadtechniek de pagina overneemt."
      },
      {
        title: "Veilige verwerking",
        body: "Uploads worden gecontroleerd, gehasht en pas na verwerking beschikbaar voor publicatie."
      },
      {
        title: "Gebruik zichtbaar",
        body: "De inspector laat zien in welke concepten, releases en schermen een asset voorkomt."
      },
      {
        title: "Hervatbare video-upload",
        body: "Grote MP4-bestanden kunnen binnen dezelfde uploadintentie veilig worden hervat."
      }
    ],
    description:
      "Organiseer afbeeldingen en video voor narrowcasting in één tenantgebonden bibliotheek met veilige upload, verwerking en gebruiksinzicht.",
    examples: ["JPG, PNG en WebP-afbeeldingen", "MP4-video voor Player", "Club- en sponsorassets", "Publicatieklare varianten"],
    imageId: "product-media-library",
    lead:
      "Vind snel het juiste beeld, volg de verwerking en zie vóór verwijderen welke playlists en schermen geraakt worden.",
    pathname: "/functies/media",
    related: [
      { href: "/functies/playlists", label: "Playlists bouwen" },
      { href: "/functies/templates", label: "Templates gebruiken" },
      { href: "/kennisbank/contentkalender-sportclub", label: "Contentkalender maken" }
    ],
    summary:
      "Media staat privé per organisatie opgeslagen. VeyoCast maakt geen asset gereed voordat type, metadata en Player-variant veilig zijn vastgesteld.",
    title: "Organiseer al jouw schermmedia op één centrale plek"
  }),
  featurePage({
    benefits: [
      {
        title: "Publiceer op het juiste moment",
        body: "Bereid content vooruit voor zonder de actieve release direct te veranderen."
      },
      {
        title: "Overzicht per periode",
        body: "Orden campagne-, wedstrijd- en clubmomenten in een begrijpelijke tijdlijn."
      },
      {
        title: "Schermen bewust kiezen",
        body: "Plan voor de juiste bestemming in plaats van één wijziging overal af te dwingen."
      },
      {
        title: "Offline-safe uitgangspunt",
        body: "Planning resulteert in controleerbare releases die Players lokaal kunnen bewaren."
      }
    ],
    description:
      "Plan narrowcastingcontent rond wedstrijden, acties en clubmomenten en publiceer gecontroleerde releases naar de juiste schermen.",
    examples: ["Wedstrijddag en programma", "Tijdelijke kantineactie", "Evenement of vrijwilligersoproep", "Sponsorcampagne"],
    imageId: "product-publisher-desktop",
    lead:
      "Bereid terugkerende en tijdelijke communicatie vooruit voor, terwijl je altijd ziet wat nu actief is.",
    pathname: "/functies/planning",
    related: [
      { href: "/functies/playlists", label: "Playlist Studio" },
      { href: "/oplossingen/sportverenigingen", label: "Sportverenigingen" },
      { href: "/kennisbank/contentkalender-sportclub", label: "Praktische contentkalender" }
    ],
    summary:
      "Planning blijft gekoppeld aan het releaseprincipe: een concept is bewerkbaar, een gepubliceerde versie niet. Zo blijft de scherminhoud herleidbaar.",
    title: "Plan content op het juiste scherm en moment"
  }),
  featurePage({
    benefits: [
      {
        title: "Last-known-good",
        body: "De Player start waar mogelijk direct met de laatst volledig gecontroleerde release."
      },
      {
        title: "Download op de achtergrond",
        body: "Nieuwe assets komen binnen terwijl de actieve playlist gewoon blijft spelen."
      },
      {
        title: "Eerst verifiëren",
        body: "Een pending release wordt pas actief als alle benodigde bestanden compleet en correct zijn."
      },
      {
        title: "Automatisch herstellen",
        body: "Na terugkeer van de verbinding hervat synchronisatie zonder de lokale release te vernietigen."
      }
    ],
    description:
      "Laat VeyoCast-content betrouwbaar lokaal doorlopen wanneer internet tijdelijk hapert, met geverifieerde releases en automatisch herstel.",
    examples: ["Korte netwerkonderbreking", "Herstart van de Player", "Nieuwe release tijdens playback", "Onvolledige of corrupte download"],
    imageId: "product-publisher-desktop",
    lead:
      "Een tijdelijke storing hoeft geen zwart scherm te betekenen. De geldige lokale playlist blijft leidend.",
    pathname: "/functies/offline-afspelen",
    related: [
      { href: "/functies/monitoring", label: "Synchronisatie volgen" },
      { href: "/functies/schermen", label: "Schermbeheer" },
      { href: "/kennisbank/wat-is-narrowcasting", label: "Wat is narrowcasting?" }
    ],
    summary:
      "VeyoCast activeert nooit een incomplete release. Eerst downloaden en verifiëren, daarna wisselen op een veilige item- of loopgrens.",
    title: "Laat content doorlopen, ook bij een haperende verbinding"
  }),
  featurePage({
    benefits: [
      {
        title: "Actueel of onbekend",
        body: "Recente telemetry is bewijs; verouderde informatie wordt nooit als gezonde status gepresenteerd."
      },
      {
        title: "Gewenst versus actief",
        body: "Zie per scherm welke release is toegewezen, gedownload, gecontroleerd en daadwerkelijk actief."
      },
      {
        title: "Actie boven cijfers",
        body: "De vloot sorteert op wat eerst aandacht vraagt in plaats van op decoratieve metrics."
      },
      {
        title: "Herstelcontext",
        body: "Een detailweergave benoemt oorzaak, effect en de veiligste volgende stap."
      }
    ],
    description:
      "Volg online status, releasevoortgang en synchronisatie van VeyoCast-schermen zonder verouderde telemetry als zekerheid te presenteren.",
    examples: ["Laatste heartbeat", "Actieve en gewenste release", "Download- en verificatiefase", "Opslag en Player-versie"],
    imageId: "product-screen-status",
    lead:
      "Zie direct welke schermen actueel zijn, waar informatie ontbreekt en welke herstelactie echt nodig is.",
    pathname: "/functies/monitoring",
    related: [
      { href: "/functies/schermen", label: "Schermvloot beheren" },
      { href: "/functies/offline-afspelen", label: "Offline playback" },
      { href: "/support", label: "Ondersteuning" }
    ],
    summary:
      "Monitoring ondersteunt beheerbeslissingen, maar onderbreekt nooit geldige lokale playback. Diagnostiek blijft uit beeld tijdens normale vertoning.",
    title: "Zie direct welke schermen online en actueel zijn"
  }),
  featurePage({
    benefits: [
      {
        title: "Bewerkbaar vertrekpunt",
        body: "Maak een tenant-eigen template en pas naam, type en ontwerpinstellingen gecontroleerd aan."
      },
      {
        title: "Consistente zones",
        body: "Veilige marges, leesbare typografie en vaste inhoudsgebieden geven ieder scherm rust."
      },
      {
        title: "Landscape en portrait",
        body: "Een staand ontwerp is een eigen compositie en geen ongecontroleerde crop van 16:9."
      },
      {
        title: "Herbruikbare clubstijl",
        body: "Gebruik clubkleuren en goedgekeurde assets zonder de beheerinterface zelf over te nemen."
      }
    ],
    description:
      "Maak consistente ClubTV-content met bewerkbare VeyoCast-templates voor wedstrijdinformatie, sponsors, agenda en kantine.",
    examples: ["Matchday en programma", "Uitslagen", "Sponsor of partner", "Kantine, agenda en welkom"],
    imageId: "product-templates",
    lead:
      "Begin met een heldere compositie en pas inhoud en clubstijl aan zonder leesbaarheid of veilige schermzones te verliezen.",
    pathname: "/functies/templates",
    related: [
      { href: "/clubtv", label: "ClubTV" },
      { href: "/functies/media", label: "Media organiseren" },
      { href: "/oplossingen/sportverenigingen", label: "Voor sportverenigingen" }
    ],
    summary:
      "Templates versnellen terugkerende clubcommunicatie. De organisatie beheert de eigen varianten; gepubliceerde releases blijven onveranderlijk.",
    title: "Maak sneller consistente content met VeyoCast-templates"
  })
] as const;

const sectorPages = [
  sectorPage({
    benefits: [
      { title: "Clubnieuws", body: "Maak trainingen, activiteiten en mededelingen zichtbaar waar leden samenkomen." },
      { title: "Wedstrijddag", body: "Publiceer programma, ontvangstinformatie en uitslagen in een herkenbaar ritme." },
      { title: "Sponsoren", body: "Geef goedgekeurde partnercontent een vaste, verzorgde plek in de playlist." },
      { title: "Vrijwilligers", body: "Breng praktische oproepen en clubtaken terug tot één duidelijke boodschap." }
    ],
    description:
      "Narrowcasting voor sportverenigingen: beheer ClubTV-content, sponsors, wedstrijden en clubnieuws centraal en betrouwbaar.",
    examples: ["Programma en uitslagen", "Clubagenda en vrijwilligers", "Sponsor van de week", "Kantinemenu en evenementen"],
    imageId: "product-templates",
    lead:
      "Breng alles wat binnen de vereniging speelt samen op schermen die beheerders ook op drukke clubdagen eenvoudig kunnen bijhouden.",
    pathname: "/oplossingen/sportverenigingen",
    related: [
      { href: "/clubtv", label: "ClubTV software" },
      { href: "/functies/playlists", label: "Playlists" },
      { href: "/kennisbank/narrowcasting-sportvereniging", label: "Implementatiegids" }
    ],
    summary:
      "Van kantine tot entree: VeyoCast maakt contentbeheer voorspelbaar, laat publicaties controleren en houdt een geldige release lokaal beschikbaar.",
    title: "Narrowcasting voor sportverenigingen"
  }),
  sectorPage({
    benefits: [
      { title: "Programma", body: "Toon de wedstrijden van vandaag met tijd, team en veld in een leesbare opbouw." },
      { title: "Kleedkamers", body: "Publiceer praktische indeling als beheerde content zonder losse papiertjes te vervangen." },
      { title: "Uitslagen", body: "Werk wedstrijdresultaten bij vanuit één concept en publiceer een nieuwe release." },
      { title: "Kantine", body: "Combineer menu, acties en clubactiviteiten met de wedstrijdcommunicatie." }
    ],
    description:
      "ClubTV en narrowcasting voor voetbalclubs met programma, uitslagen, kleedkamerinformatie, sponsors en kantinecontent.",
    examples: ["Thuisprogramma", "Kleedkamerindeling", "Wedstrijduitslagen", "Sponsor- en kantinecontent"],
    imageId: "product-templates",
    lead:
      "Laat spelers, ouders, supporters en vrijwilligers bij binnenkomst meteen zien wat er vandaag op de club gebeurt.",
    pathname: "/oplossingen/voetbalclubs",
    related: [
      { href: "/clubtv", label: "Ontdek ClubTV" },
      { href: "/functies/templates", label: "Matchday-templates" },
      { href: "/kennisbank/contentkalender-sportclub", label: "Contentkalender" }
    ],
    summary:
      "Een voetbalzaterdag verandert snel. VeyoCast geeft beheerders één plek om de zichtbare informatie ordelijk bij te werken.",
    title: "Narrowcasting voor voetbalclubs"
  }),
  sectorPage({
    benefits: [
      { title: "Wedstrijdblokken", body: "Orden thuiswedstrijden, tijden en ontvangstinformatie per logisch moment." },
      { title: "Teaminformatie", body: "Maak praktische team- en clubberichten zichtbaar zonder een overvolle slide." },
      { title: "Vrijwilligers", body: "Herhaal een gerichte oproep tussen wedstrijd- en sponsoritems." },
      { title: "Sponsoren", body: "Plan partnercontent rondom wedstrijddagen en clubactiviteiten." }
    ],
    description:
      "ClubTV voor hockeyclubs met wedstrijdinformatie, teamnieuws, vrijwilligersoproepen en verzorgde sponsorcontent.",
    examples: ["Thuiswedstrijden en tijden", "Team- en clubnieuws", "Vrijwilligersdiensten", "Sponsors en evenementen"],
    imageId: "product-templates",
    lead:
      "Geef de dynamiek van een hockeydag een rustige informatiebasis, van eerste ontvangst tot laatste wedstrijd.",
    pathname: "/oplossingen/hockeyclubs",
    related: [
      { href: "/functies/planning", label: "Slim plannen" },
      { href: "/functies/templates", label: "Clubtemplates" },
      { href: "/demo", label: "Plan een demo" }
    ],
    summary:
      "VeyoCast helpt hockeyclubs om veel wisselende informatie te bundelen in korte, herkenbare schermmomenten.",
    title: "ClubTV voor hockeyclubs, van wedstrijdinfo tot sponsors"
  }),
  sectorPage({
    benefits: [
      { title: "Baaninformatie", body: "Publiceer praktische baan- of locatie-informatie als beheerde clubcontent." },
      { title: "Toernooien", body: "Maak speeldagen, activiteiten en ontvangstboodschappen zichtbaar." },
      { title: "Clubagenda", body: "Plan lessen, events en vrijwilligersmomenten in een rustig format." },
      { title: "Horeca", body: "Combineer clubnieuws met menu, aanbod en openingstijden." }
    ],
    description:
      "Narrowcasting voor tennis- en padelverenigingen met baaninformatie, toernooien, clubactiviteiten en horeca.",
    examples: ["Baan- en locatieinformatie", "Toernooi of ladder", "Clubagenda", "Horeca-aanbod"],
    imageId: "product-publisher-desktop",
    lead:
      "Houd leden en bezoekers op de hoogte in clubhuis, hal of horeca, zonder per scherm handmatig bestanden te vervangen.",
    pathname: "/oplossingen/tennis-en-padel",
    related: [
      { href: "/functies/planning", label: "Content plannen" },
      { href: "/functies/schermen", label: "Meerdere schermen" },
      { href: "/prijzen", label: "Prijsopbouw" }
    ],
    summary:
      "VeyoCast brengt losse mededelingen, activiteiten en horeca-informatie samen in één beheerde playlist.",
    title: "Narrowcasting voor tennis- en padelverenigingen"
  }),
  sectorPage({
    benefits: [
      { title: "Lestijden", body: "Zet actuele blokken voor lessen en trainingen overzichtelijk op scherm." },
      { title: "Baanindeling", body: "Publiceer praktische indeling als clubcontent, afgestemd op de locatie." },
      { title: "Evenementen", body: "Breng wedstrijden, diplomazwemmen en clubmomenten onder de aandacht." },
      { title: "Entree-informatie", body: "Geef bezoekers direct context voordat zij de accommodatie in gaan." }
    ],
    description:
      "Narrowcasting voor zwemverenigingen en zwembaden met lestijden, baaninformatie, evenementen en bezoekerscommunicatie.",
    examples: ["Lestijden en trainingen", "Baanindeling", "Club- en zwemevenementen", "Entree- en bezoekersinformatie"],
    imageId: "product-screen-status",
    lead:
      "Maak veranderlijke informatie rondom bad, entree en clubruimte zichtbaar in een vorm die vanaf afstand te begrijpen is.",
    pathname: "/oplossingen/zwemverenigingen",
    related: [
      { href: "/functies/templates", label: "Bewerkbare templates" },
      { href: "/functies/monitoring", label: "Schermstatus" },
      { href: "/contact", label: "Bespreek jouw locatie" }
    ],
    summary:
      "Beheerders publiceren per scherm een gecontroleerde release en houden zicht op wat daadwerkelijk actief is.",
    title: "Houd leden en bezoekers op de hoogte rond ieder bad"
  }),
  sectorPage({
    benefits: [
      { title: "Groepslessen", body: "Maak het actuele lesaanbod zichtbaar op entree- en trainingsschermen." },
      { title: "Rooster", body: "Publiceer een helder dag- of weekoverzicht zonder onleesbare details." },
      { title: "Acties", body: "Wissel praktische informatie af met tijdelijke campagnes." },
      { title: "Community", body: "Geef trainers, ledenverhalen en evenementen een herkenbare plek." }
    ],
    description:
      "Narrowcasting voor sportscholen met groepslessen, roosters, acties en communitycontent op één of meerdere schermen.",
    examples: ["Groepslesrooster", "Trainer of les in beeld", "Tijdelijke actie", "Community en evenementen"],
    imageId: "product-publisher-mobile",
    lead:
      "Houd schermcontent in receptie, lounge en trainingszone actueel vanuit één eenvoudige beheeromgeving.",
    pathname: "/oplossingen/sportscholen",
    related: [
      { href: "/functies/media", label: "Media beheren" },
      { href: "/functies/planning", label: "Acties plannen" },
      { href: "/demo", label: "Bekijk VeyoCast" }
    ],
    summary:
      "Combineer vaste merkcontent met veranderlijke les- en ledeninformatie en publiceer per zone de juiste playlist.",
    title: "Schermcontent voor sportscholen en fitnesslocaties"
  }),
  sectorPage({
    benefits: [
      { title: "Menu", body: "Presenteer aanbod en prijzen in een leesbare, gecontroleerde opmaak." },
      { title: "Acties", body: "Plan tijdelijke aanbiedingen en haal ze weer uit de actieve release." },
      { title: "Evenementen", body: "Combineer horeca-informatie met wedstrijd- en locatieactiviteiten." },
      { title: "Wachttijdinformatie", body: "Publiceer een praktische boodschap wanneer de organisatie die data zelf beheert." }
    ],
    description:
      "Narrowcasting voor horeca en sportkantines met digitale menu’s, acties, evenementen en praktische bezoekersinformatie.",
    examples: ["Digitaal menu", "Dagactie", "Evenement of thema-avond", "Praktische serviceboodschap"],
    imageId: "product-templates",
    lead:
      "Werk menu en locatiecommunicatie bij zonder USB-sticks of losse posters, terwijl de laatst geldige release blijft spelen.",
    pathname: "/oplossingen/horeca-en-kantines",
    related: [
      { href: "/functies/templates", label: "Kantinetemplates" },
      { href: "/functies/planning", label: "Tijdelijk aanbod plannen" },
      { href: "/clubtv", label: "ClubTV voor de kantine" }
    ],
    summary:
      "VeyoCast houdt horeca- en verenigingscontent in één centrale workflow, met duidelijke schermtoewijzing.",
    title: "Menukaarten, acties en informatie op ieder scherm"
  }),
  sectorPage({
    benefits: [
      { title: "Interne mededelingen", body: "Maak korte, actuele berichten zichtbaar op de werkvloer." },
      { title: "Veiligheidsinformatie", body: "Publiceer goedgekeurde instructies als onderdeel van een beheerde playlist." },
      { title: "Bezoekers", body: "Geef ontvangst, route of evenementcontext op de juiste locatie." },
      { title: "Meerdere vestigingen", body: "Beheer schermen per organisatie en locatie zonder de context te vermengen." }
    ],
    description:
      "Narrowcasting voor bedrijven met interne communicatie, bezoekersinformatie en centraal beheerde schermcontent.",
    examples: ["Werkvloerupdates", "Veiligheidsboodschap", "Bezoekersontvangst", "Evenement of mijlpaal"],
    imageId: "product-screen-status",
    lead:
      "Breng operationele communicatie naar plekken waar medewerkers en bezoekers haar werkelijk zien.",
    pathname: "/oplossingen/bedrijven",
    related: [
      { href: "/product", label: "Platformoverzicht" },
      { href: "/functies/schermen", label: "Schermen beheren" },
      { href: "/contact", label: "Neem contact op" }
    ],
    summary:
      "Rollen, organisaties en schermen blijven gescheiden. Zo kan een beheerteam content publiceren zonder brede platformtoegang.",
    title: "Interne communicatie zichtbaar op de werkvloer"
  }),
  sectorPage({
    benefits: [
      { title: "Roosters", body: "Publiceer locatie- of daginformatie in een compact, leesbaar format." },
      { title: "Nieuws", body: "Maak mededelingen zichtbaar in entree, aula of personeelsruimte." },
      { title: "Evenementen", body: "Plan open dagen, bijeenkomsten en activiteiten vooruit." },
      { title: "Routes", body: "Gebruik schermen voor praktische wayfinding wanneer de inhoud door de instelling wordt beheerd." }
    ],
    description:
      "Narrowcasting voor onderwijsomgevingen met roosters, nieuws, evenementen en praktische route-informatie.",
    examples: ["Dagrooster", "Schoolnieuws", "Evenement of open dag", "Route- en ontvangstinformatie"],
    imageId: "product-publisher-desktop",
    lead:
      "Houd leerlingen, studenten, medewerkers en bezoekers op de juiste plek op de hoogte vanuit één beheeromgeving.",
    pathname: "/oplossingen/onderwijs",
    related: [
      { href: "/functies/playlists", label: "Playlists samenstellen" },
      { href: "/functies/monitoring", label: "Schermen volgen" },
      { href: "/demo", label: "Plan een demonstratie" }
    ],
    summary:
      "VeyoCast maakt lokaal beheer overzichtelijk en houdt iedere publicatie herleidbaar als aparte release.",
    title: "Actuele informatie op schermen binnen jouw onderwijsomgeving"
  }),
  sectorPage({
    benefits: [
      { title: "Campagnes", body: "Publiceer een gecontroleerde beeld- of videoreeks per winkellocatie." },
      { title: "Acties", body: "Bereid tijdelijke communicatie vooruit en vervang haar met een nieuwe release." },
      { title: "Productinformatie", body: "Maak compacte, zelf beheerde productboodschappen zichtbaar bij de klantreis." },
      { title: "Locaties", body: "Volg status en actieve content per gekoppeld scherm." }
    ],
    description:
      "Narrowcasting voor retail met centraal beheerde campagnes, acties en productinformatie per scherm en locatie.",
    examples: ["Campagnebeeld", "Tijdelijke winkelactie", "Productuitleg", "Service- en openingstijden"],
    imageId: "product-media-library",
    lead:
      "Houd winkelcontent actueel en zichtbaar zonder ieder scherm afzonderlijk bij te werken.",
    pathname: "/oplossingen/retail",
    related: [
      { href: "/functies/media", label: "Mediabibliotheek" },
      { href: "/functies/planning", label: "Campagnes plannen" },
      { href: "/prijzen", label: "Vraag een voorstel aan" }
    ],
    summary:
      "Van asset tot actieve release blijft zichtbaar welke versie voor welke locatie is bedoeld.",
    title: "Houd winkelcontent actueel vanuit één omgeving"
  })
] as const;

const corePages: MarketingPageDefinition[] = [
  {
    benefits: [
      { title: "Publisher", body: "Beheer media, playlists, releases en schermen in één rustige werkruimte." },
      { title: "Player", body: "Speel geverifieerde releases fullscreen en offline-first af." },
      { title: "Veilige publicatie", body: "Maak een nieuwe immutable versie zonder de actieve content stilzwijgend te wijzigen." },
      { title: "Zicht op status", body: "Zie het verschil tussen gewenst, gedownload, geverifieerd en werkelijk actief." }
    ],
    description:
      "Ontdek het VeyoCast narrowcastingplatform voor centraal contentbeheer, betrouwbare Players en schermstatus voor sportclubs en organisaties.",
    eyebrow: "Het VeyoCast-platform",
    examples: ["Media uploaden en controleren", "Playlists als concept beheren", "Releases veilig publiceren", "Schermen koppelen en volgen"],
    faqs: [
      { title: "Wat heb ik nodig om te starten?", body: "Een VeyoCast-organisatie, minimaal één ondersteund afspeelapparaat en een scherm met internet voor registratie en synchronisatie." },
      { title: "Is de Player een gebruikersaccount?", body: "Nee. De Player gebruikt een aparte, intrekbare devicesessie en krijgt alleen toegang tot de toegewezen release en assets." },
      { title: "Kan ik met één scherm beginnen?", body: "De beheerflow ondersteunt één of meerdere gekoppelde schermen. Definitieve pakketten en prijzen worden per voorstel bevestigd." }
    ],
    imageId: "product-publisher-desktop",
    index: true,
    kind: "product",
    lead:
      "Van eerste upload tot actieve release: ieder onderdeel werkt samen zonder de eenvoud voor de beheerder te verliezen.",
    pathname: "/product",
    primaryCta: demoCta,
    related: [
      { href: "/publisher", label: "VeyoCast Publisher" },
      { href: "/functies", label: "Alle functies" },
      { href: "/clubtv", label: "ClubTV" }
    ],
    secondaryCta: { href: "/functies", label: "Bekijk alle functies" },
    steps: [
      { title: "Maak content", body: "Upload gecontroleerde afbeeldingen en video’s of begin met een bewerkbaar template." },
      { title: "Bouw een playlist", body: "Bepaal volgorde, zichtduur en weergave in een apart concept." },
      { title: "Publiceer een release", body: "Controleer wijzigingen en doelen voordat VeyoCast een onveranderlijke versie maakt." },
      { title: "Volg je schermen", body: "Players downloaden, verifiëren en activeren de nieuwe release op een veilige grens." }
    ],
    summary:
      "VeyoCast combineert een beheeromgeving en een offline-first Player. Daardoor blijft de operatie begrijpelijk en de content op locatie betrouwbaar.",
    title: "Alles voor narrowcasting in één gebruiksvriendelijk platform"
  },
  {
    benefits: [
      { title: "Bibliotheekgerichte media", body: "Zoeken, filteren, verwerken en gebruik controleren vanuit één overzicht." },
      { title: "Playlist Studio", body: "Orden content en bewerk iteminstellingen zonder publicatie en opslag te verwarren." },
      { title: "Release Center", body: "Vergelijk versies, beoordeel impact en publiceer naar gekozen schermen." },
      { title: "Actiegerichte schermvloot", body: "Open eerst wat aandacht vraagt en inspecteer details pas wanneer dat nodig is." }
    ],
    description:
      "Beheer narrowcastingcontent sneller met VeyoCast Publisher: media, playlists, publicaties, schermen en teamrechten in één omgeving.",
    eyebrow: "VeyoCast Publisher",
    examples: ["Content voorbereiden", "Samenwerken met rollen", "Publicatie-impact controleren", "Schermen beheren vanaf mobiel of desktop"],
    faqs: [
      { title: "Werkt Publisher ook op mobiel?", body: "Ja. Kernjourneys zijn als mobiele taakflow ontworpen, met sheets en dialogen in plaats van een verkleinde desktop." },
      { title: "Wordt een concept automatisch live?", body: "Nee. Opslaan en publiceren zijn bewust gescheiden; live content verandert alleen via een nieuwe release." },
      { title: "Kan een organisatie eigen rollen maken?", body: "Ja. Tenantbeheerders kunnen werkrollen samenstellen bovenop beschermde server-side capabilities." }
    ],
    imageId: "product-publisher-desktop",
    index: true,
    kind: "product",
    lead:
      "Een kalme beheeromgeving voor vrijwilligers en professionals die snel willen zien wat er speelt en wat hun volgende actie is.",
    pathname: "/publisher",
    primaryCta: demoCta,
    related: [
      { href: "/functies/media", label: "Mediabibliotheek" },
      { href: "/functies/playlists", label: "Playlist Studio" },
      { href: "/functies/schermen", label: "Schermvloot" }
    ],
    secondaryCta: { href: "/product", label: "Platformoverzicht" },
    steps: [
      { title: "Kies je organisatie", body: "De actieve context bepaalt welke data, navigatie en bevoegdheden beschikbaar zijn." },
      { title: "Werk aan content", body: "Open Media, Playlists of Templates en voer één duidelijke taak tegelijk uit." },
      { title: "Controleer gevolgen", body: "Readiness en release-impact maken zichtbaar wat publicatie voor ieder scherm betekent." },
      { title: "Blijf operationeel", body: "Dashboard en schermvloot zetten concrete aandachtspunten vóór losse cijfers." }
    ],
    summary:
      "Publisher brengt dagelijkse contenttaken en operationele status samen zonder dashboardruis of technische implementatietaal.",
    title: "Beheer schermcontent sneller met VeyoCast Publisher"
  },
  {
    benefits: featurePages.slice(0, 4).map((page) => ({
      body: page.lead,
      title: page.title
    })),
    description:
      "Bekijk alle VeyoCast-functies voor media, playlists, planning, schermbeheer, monitoring, offline playback en templates.",
    eyebrow: "Functieoverzicht",
    examples: ["Media en verwerking", "Playlists en releases", "Schermen en monitoring", "Planning en templates"],
    faqs: [
      { title: "Welke functies zitten in een pakket?", body: "Definitieve pakketgrenzen worden in een voorstel bevestigd. Deze pagina beschrijft de functionele productbasis, niet een prijsgarantie." },
      { title: "Kan ik functies eerst bekijken?", body: "Ja. Plan een demo; we lopen de relevante journey door op basis van jouw locaties en beheervraag." },
      { title: "Komen er integraties bij?", body: "Het platform is voorbereid op server-side adapters. Een specifieke provider wordt pas als beschikbaar genoemd na aantoonbare validatie." }
    ],
    imageId: "product-publisher-desktop",
    index: true,
    kind: "index",
    lead:
      "Alles wat je nodig hebt om schermcontent te organiseren, veilig te publiceren en op locatie betrouwbaar te laten spelen.",
    pathname: "/functies",
    primaryCta: demoCta,
    related: featurePages.map((page) => ({
      href: page.pathname,
      label: page.title
    })),
    secondaryCta: { href: "/product", label: "Bekijk het platform" },
    steps: [
      { title: "Media", body: "Bereid veilige Player-varianten voor in de bibliotheek." },
      { title: "Playlist", body: "Orden inhoud en controleer iteminstellingen." },
      { title: "Publicatie", body: "Maak een immutable release voor gekozen schermen." },
      { title: "Player", body: "Download, verifieer en speel online of vanaf lokale cache." }
    ],
    summary:
      "De functies volgen één systeem: Media → Playlist → Publicatie → Schermen. Daardoor blijft elke wijziging herleidbaar.",
    title: "Alle functies voor slim en centraal schermbeheer"
  },
  {
    benefits: [
      { title: "Wedstrijden", body: "Programma, ontvangst en uitslagen krijgen een afstandsleesbare plek." },
      { title: "Clubnieuws", body: "Maak activiteiten, mededelingen en vrijwilligersvragen zichtbaar." },
      { title: "Sponsoren", body: "Plan goedgekeurde partnercontent naast de clubmomenten die ertoe doen." },
      { title: "Kantine", body: "Combineer menu en aanbod met praktische locatie-informatie." }
    ],
    description:
      "ClubTV-software van VeyoCast brengt wedstrijden, clubnieuws, sponsors en kantinecontent betrouwbaar naar ieder beheerd scherm.",
    eyebrow: "ClubTV",
    examples: ["Matchday", "Programma en uitslagen", "Sponsor van de week", "Kantinemenu en clubagenda"],
    faqs: [
      { title: "Wat is het verschil tussen ClubTV en gewone narrowcasting?", body: "ClubTV gebruikt dezelfde beheer- en Playerbasis, maar de content en templates volgen het ritme van een sportvereniging." },
      { title: "Moet ieder scherm dezelfde playlist tonen?", body: "Nee. Een beheerder kiest per scherm of schermgroep welke release gewenst is." },
      { title: "Zijn sportdatakoppelingen inbegrepen?", body: "Niet automatisch. Specifieke providers krijgen alleen een beschikbare status nadat techniek en afspraken aantoonbaar zijn gevalideerd." }
    ],
    imageId: "product-templates",
    index: true,
    kind: "sector",
    lead:
      "Geef jouw clubhuis een actuele, herkenbare informatieplek die beheerders eenvoudig kunnen bijhouden.",
    pathname: "/clubtv",
    primaryCta: demoCta,
    related: [
      { href: "/oplossingen/sportverenigingen", label: "Voor sportverenigingen" },
      { href: "/functies/templates", label: "ClubTV-templates" },
      { href: "/kennisbank/wat-is-clubtv", label: "Wat is ClubTV?" }
    ],
    secondaryCta: { href: "/kennisbank/wat-is-clubtv", label: "Lees wat ClubTV is" },
    steps: [
      { title: "Kies de clubmomenten", body: "Bepaal welke informatie voor leden en bezoekers op locatie relevant is." },
      { title: "Bouw het ritme", body: "Wissel nieuws, wedstrijden, sponsors en horeca af in een leesbare playlist." },
      { title: "Publiceer naar locaties", body: "Wijs een gecontroleerde release toe aan kantine, entree of sponsorwand." }
    ],
    summary:
      "ClubTV van VeyoCast is geen los videokanaal, maar een beheerde contentflow met betrouwbare lokale playback.",
    title: "ClubTV die jouw vereniging iedere dag laat leven"
  },
  {
    benefits: sectorPages.slice(0, 4).map((page) => ({
      body: page.lead,
      title: page.title
    })),
    description:
      "Bekijk VeyoCast-oplossingen voor sportverenigingen, kantines, sportscholen, bedrijven, onderwijs en retail.",
    eyebrow: "Oplossingen",
    examples: ["Sportverenigingen", "Horeca en kantines", "Sportscholen", "Bedrijven, onderwijs en retail"],
    faqs: [
      { title: "Is VeyoCast alleen voor sportclubs?", body: "Sportverenigingen zijn de primaire markt, maar dezelfde beheer- en Playerbasis past ook bij andere locaties met terugkerende schermcommunicatie." },
      { title: "Kan iedere locatie andere content tonen?", body: "Ja. Playlists en releases kunnen bewust aan gekozen schermen worden toegewezen." },
      { title: "Hoe kies ik de juiste opzet?", body: "Begin met locaties, publieksmomenten en beheerders. Tijdens een demo vertalen we dat naar een eenvoudige eerste flow." }
    ],
    imageId: "product-screen-status",
    index: true,
    kind: "index",
    lead:
      "Iedere locatie heeft een ander ritme. VeyoCast geeft beheerders één betrouwbare basis en laat de content daarop aansluiten.",
    pathname: "/oplossingen",
    primaryCta: demoCta,
    related: sectorPages.map((page) => ({
      href: page.pathname,
      label: page.title
    })),
    secondaryCta: { href: "/clubtv", label: "Ontdek ClubTV" },
    steps: [
      { title: "Locatie", body: "Bepaal waar schermcommunicatie werkelijk helpt." },
      { title: "Inhoud", body: "Kies terugkerende en actuele contenttypen." },
      { title: "Beheer", body: "Leg vast wie mag maken, publiceren en controleren." },
      { title: "Uitrol", body: "Koppel Players en publiceer per scherm de juiste release." }
    ],
    summary:
      "De sectorpagina’s geven concrete voorbeelden van zelf beheerde content. Ze doen geen onbewezen belofte over externe databronnen.",
    title: "VeyoCast voor iedere locatie met een verhaal"
  },
  {
    benefits: [
      { title: "Sportlink", body: "Teams, competities, programma, uitslagen, standen en bezoekersinformatie worden via de bestaande sync- en snapshotarchitectuur gebruikt." },
      { title: "Twelve XLSX", body: "Een normale .xlsx-export wordt gecontroleerd geïmporteerd met mapping, validatie, preview en onveranderlijke broninformatie." },
      { title: "RSS & nieuws", body: "Nieuwsbronnen tonen syncstatus, fouten en stale data en leveren landschap- en portretoutput." },
      { title: "Sponsors", body: "Sponsor Hub beheert sponsors, campagnes, plaatsingen en rotatie binnen de tenantcontext." }
    ],
    description:
      "Koppel Sportlink, Twelve XLSX, RSS/nieuws en sponsors aan VeyoCast en zie helder welke bron beschikbaar, verouderd of in voorbereiding is.",
    eyebrow: "Integraties",
    examples: ["Sportlink — geïntegreerd", "Twelve — gecontroleerde XLSX-import", "RSS & nieuws — geïntegreerd", "YouTube — in voorbereiding"],
    faqs: [
      { title: "Is Sportlink beschikbaar?", body: "Ja, binnen de bestaande Sportlink-module en de voor de tenant beschikbare providerdata. De interface toont syncstatus, laatste synchronisatie en ontbrekende context expliciet." },
      { title: "Hoe werkt Twelve?", body: "Bij launch via een normale .xlsx-export en -import met kolommapping, validatie en preview. VeyoCast claimt geen live Twelve-API." },
      { title: "Is YouTube al beschikbaar?", body: "Nog niet als vrijgegeven productie-integratie. Officiële online-only playback, quota, preflight en fallback worden eerst aantoonbaar gevalideerd." }
    ],
    imageId: "product-publisher-desktop",
    index: true,
    kind: "integration",
    lead:
      "Gebruik bestaande bronnen zonder hun status te verbergen. VeyoCast houdt providercredentials server-side en bewaakt sync, snapshots en Player-continuïteit.",
    pathname: "/integraties",
    primaryCta: { href: "/contact", label: "Bespreek een databron" },
    related: [
      { href: "/product", label: "Platformarchitectuur" },
      { href: "/functies/offline-afspelen", label: "Offline afspelen" },
      { href: "/oplossingen/sportverenigingen", label: "Sportverenigingen" }
    ],
    secondaryCta: { href: "/contact", label: "Neem contact op" },
    steps: [
      { title: "Verbind de bron", body: "Een bevoegde beheerder configureert de beschikbare tenantmodule; geheimen blijven server-side." },
      { title: "Controleer de sync", body: "Bekijk laatste synchronisatie, fouten en stale status voordat content wordt gebruikt." },
      { title: "Kies de output", body: "Maak een dynamische slide of beheerde import met de juiste broncontext en preview." },
      { title: "Publiceer veilig", body: "De Player blijft op last-known-good wanneer actuele brondata tijdelijk niet bereikbaar is." }
    ],
    summary:
      "Beschikbare modules en bronnen worden feitelijk benoemd. Nieuwe sporen zoals YouTube blijven zichtbaar in voorbereiding tot hun releasegates groen zijn.",
    title: "Koppel VeyoCast aan informatie die je al gebruikt"
  },
  ...integrationDetailPages,
  {
    benefits: [
      { title: "14 dagen gratis", body: "De proefperiode duurt 14 × 24 uur vanaf de eerste succesvolle billable schermactivatie na acceptatie." },
      { title: "Per actief scherm", body: "Je betaalt € 5,95 inclusief btw per actief scherm per maand; inactieve schermrecords tellen niet als actief scherm." },
      { title: "Bedragen in hele centen", body: "Prijsberekeningen gebruiken integer cents, zodat totalen voorspelbaar en controleerbaar blijven." }
    ],
    description:
      "Bereken de VeyoCast-maandprijs op basis van € 5,95 inclusief btw per actief scherm, na 14 dagen gratis proberen.",
    eyebrow: "Prijzen",
    examples: ["1 scherm: € 5,95 per maand", "2 schermen: € 11,90 per maand", "6 schermen: € 35,70 per maand", "14 dagen gratis proberen"],
    faqs: [
      { title: "Wat kost VeyoCast?", body: "€ 5,95 inclusief btw per actief scherm per maand, na een proefperiode van 14 dagen." },
      { title: "Wanneer begint de proefperiode?", body: "Bij de eerste succesvolle activering van een billable scherm nadat de voorwaarden zijn geaccepteerd. Een juridische billingaccount krijgt één proefperiode." },
      { title: "Kan btw afwijken?", body: "Voor Nederland rekent de calculator met 21% btw. Afwijkende grensoverschrijdende fiscale behandeling wordt vóór contractering bevestigd." }
    ],
    imageId: "product-screen-status",
    index: true,
    kind: "pricing",
    lead:
      "Eén transparant tarief per actief scherm. Kies het aantal schermen en zie direct het bruto maandbedrag na de proefperiode.",
    pathname: "/prijzen",
    primaryCta: { href: "/demo", label: "Plan een demo" },
    related: [
      { href: "/product", label: "Wat VeyoCast biedt" },
      { href: "/veelgestelde-vragen", label: "Veelgestelde vragen" },
      { href: "/contact", label: "Vraag een voorstel aan" }
    ],
    secondaryCta: { href: "/#opstelling", label: "Bouw je opstelling" },
    steps: [
      { title: "Start je proefperiode", body: "Accepteer de voorwaarden en activeer het eerste billable scherm; vanaf dat moment loopt 14 × 24 uur." },
      { title: "Activeer alleen wat je gebruikt", body: "De facturatie volgt het aantal billable actieve schermen en maakt de ingangsdatum per scherm inzichtelijk." },
      { title: "Betaal per maand", body: "Na de proefperiode wordt € 5,95 inclusief btw per actief scherm per maand berekend." }
    ],
    summary:
      "De prijs groeit lineair mee met het aantal actieve schermen. Bestaande billing- en entitlementgates bepalen wanneer een scherm billable wordt.",
    title: "Duidelijke prijzen voor ieder scherm"
  },
  {
    benefits: [
      { title: "Jouw use case", body: "De demo volgt de schermen, locaties en content die voor jouw organisatie relevant zijn." },
      { title: "Echte productflow", body: "Bekijk media, playlists, publicatie en schermstatus als samenhangende journey." },
      { title: "Eerlijke status", body: "Roadmap, integraties en beperkingen worden niet als afgeronde functie gepresenteerd." },
      { title: "Concrete vervolgstap", body: "Na de demo weet je welke eerste opzet realistisch is en welke keuzes nog openstaan." }
    ],
    description:
      "Plan een VeyoCast-demo voor jouw sportclub of organisatie en bekijk media, playlists, schermbeheer en offline playback in samenhang.",
    eyebrow: "Plan een demonstratie",
    examples: ["Sportvereniging of clubhuis", "Eén of meerdere locaties", "Content- en beheerteam", "Gewenste schermjourney"],
    faqs: [
      { title: "Hoe lang duurt een demo?", body: "De duur wordt bij de afspraak afgestemd. De website belooft geen vaste reactietijd zolang de contactafhandeling nog niet geautomatiseerd is." },
      { title: "Heb ik al hardware nodig?", body: "Nee. Beschrijf de huidige situatie; ondersteunde apparaten en fysieke acceptatietests worden daarna concreet besproken." },
      { title: "Worden mijn gegevens direct verzonden?", body: "Alleen wanneer een deliveryprovider is geconfigureerd. Tot die tijd toont het formulier eerlijk dat je per e-mail contact moet opnemen." }
    ],
    imageId: "product-publisher-desktop",
    index: true,
    kind: "demo",
    lead:
      "Vertel kort wat je wilt laten zien en beheren. Dan kunnen we de demo richten op jouw praktijk.",
    pathname: "/demo",
    primaryCta: { href: "mailto:support@veyocast.nl?subject=VeyoCast%20demo", label: "Mail over een demo" },
    related: [
      { href: "/product", label: "Bekijk het platform" },
      { href: "/prijzen", label: "Prijsopbouw" },
      { href: "/privacy", label: "Privacyverklaring" }
    ],
    secondaryCta: { href: "/product", label: "Eerst het platform bekijken" },
    steps: [
      { title: "Deel je situatie", body: "Organisatie, type locatie en een schatting van het aantal schermen zijn voldoende." },
      { title: "Kies de focus", body: "We richten de demonstratie op contentbeheer, schermoperatie of beide." },
      { title: "Bepaal de volgende stap", body: "Na afloop bespreken we alleen een voorstel wanneer de functionele basis past." }
    ],
    summary:
      "Het demoformulier valideert invoer server-side en doet geen vals afleveringssucces voor zolang een e-mailprovider ontbreekt.",
    title: "Bekijk hoe VeyoCast voor jouw organisatie werkt"
  },
  {
    benefits: [
      { title: "Praktisch productdenken", body: "De beheerder ziet toestand, gevolg en volgende stap zonder infrastructuurjargon." },
      { title: "Offline-first betrouwbaarheid", body: "De Player houdt een geldige lokale release beschikbaar en activeert geen incomplete update." },
      { title: "Veilige tenantgrenzen", body: "Organisaties, rollen en resources worden server-side gescheiden en gecontroleerd." },
      { title: "Nederlands merk", body: "VeyoCast wordt ontwikkeld door DG Webservices in Den Haag." }
    ],
    description:
      "Lees waarom VeyoCast professionele narrowcasting en ClubTV bereikbaar maakt voor sportverenigingen en andere organisaties.",
    eyebrow: "Over VeyoCast",
    examples: ["Rust voor beheerders", "Zichtbaarheid voor clubcontent", "Controleerbare publicaties", "Eerlijke productclaims"],
    faqs: [
      { title: "Wie ontwikkelt VeyoCast?", body: "VeyoCast is een product van DG Webservices, gevestigd in Den Haag en ingeschreven bij de Kamer van Koophandel onder nummer 88135713." },
      { title: "Voor wie wordt VeyoCast gebouwd?", body: "Primair voor Nederlandse sportverenigingen, met een platformbasis die ook bij andere beheerde schermlocaties past." },
      { title: "Waar staat het product nu?", body: "De kernjourneys zijn gebouwd. Fysieke hardwarevalidatie, brede pilotbewijslast en enkele commerciële keuzes blijven expliciete gates." }
    ],
    imageId: "product-publisher-mobile",
    index: true,
    kind: "product",
    lead:
      "Professionele schermcommunicatie hoort begrijpelijk te zijn voor vrijwilligers én betrouwbaar genoeg voor dagelijks gebruik.",
    pathname: "/over-ons",
    primaryCta: demoCta,
    related: [
      { href: "/product", label: "Het product" },
      { href: "/privacy", label: "Privacy" },
      { href: "/contact", label: "Contact" }
    ],
    secondaryCta: { href: "/contact", label: "Neem contact op" },
    steps: [
      { title: "Zichtbaar probleem", body: "Losse USB-sticks, verouderde slides en onduidelijke schermstatus kosten aandacht." },
      { title: "Eenvoudige beheerflow", body: "VeyoCast brengt media, playlists, releases en schermen in één begrijpelijk systeem." },
      { title: "Bewijs vóór belofte", body: "Claims over providers, hardware en prestaties volgen pas na aantoonbare validatie." }
    ],
    summary:
      "VeyoCast kiest voor krachtige vormgeving, rustige bediening en een productmodel waarin betrouwbaarheid zichtbaar is.",
    title: "Professionele schermcommunicatie bereikbaar maken"
  },
  {
    benefits: [
      { title: "Productvraag", body: "Vraag naar functies, schermopzet of de beste eerste journey." },
      { title: "Support", body: "Beschrijf het scherm, het zichtbare gevolg en de laatste veilige actie." },
      { title: "Privacy", body: "Gebruik privacy@veyocast.nl voor inzage, correctie of verwijdering." },
      { title: "Zakelijk contact", body: "VeyoCast is een product van DG Webservices in Den Haag." }
    ],
    description:
      "Neem contact op met VeyoCast voor een productvraag, demo, ondersteuning of privacyverzoek rond jouw schermomgeving.",
    eyebrow: "Contact",
    examples: ["Demo of voorstel", "Product- en hardwarevraag", "Ondersteuning", "Privacyverzoek"],
    faqs: [
      { title: "Welk e-mailadres gebruik ik?", body: "Gebruik support@veyocast.nl voor product en ondersteuning, en privacy@veyocast.nl voor privacyrechten." },
      { title: "Kan ik gevoelige tokens meesturen?", body: "Nee. Stuur nooit wachtwoorden, pairingcodes, sessietokens of volledige signed media-URL’s per e-mail." },
      { title: "Is het formulier al gekoppeld?", body: "Nog niet. Het formulier valideert veilig maar meldt eerlijk dat aflevering pas werkt na keuze en configuratie van een provider." }
    ],
    index: true,
    kind: "contact",
    lead:
      "Vertel kort waar je hulp bij nodig hebt. Deel geen wachtwoorden, pairingtokens of andere geheime gegevens.",
    pathname: "/contact",
    primaryCta: { href: "mailto:support@veyocast.nl", label: "Mail VeyoCast" },
    related: [
      { href: "/demo", label: "Plan een demo" },
      { href: "/support", label: "Ondersteuning" },
      { href: "/privacy", label: "Privacy" }
    ],
    secondaryCta: { href: "/support", label: "Bekijk ondersteuning" },
    steps: [
      { title: "Kies het onderwerp", body: "Een duidelijke categorie helpt om jouw vraag veilig te beoordelen." },
      { title: "Beschrijf het gevolg", body: "Vertel wat je verwachtte en wat er zichtbaar gebeurde, zonder secrets te delen." },
      { title: "Gebruik e-mail", body: "Tot formulierdelivery is ingericht, loopt contact rechtstreeks via de gepubliceerde mailbox." }
    ],
    summary:
      "Publieke contactgegevens: DG Webservices, Markenseplein 1, 2583 KR Den Haag, KvK 88135713.",
    title: "Neem contact op met VeyoCast"
  }
];

const knowledgePages: MarketingPageDefinition[] = [
  {
    benefits: [
      { title: "Gerichte communicatie", body: "Content verschijnt op een beheerd scherm voor mensen op een specifieke locatie." },
      { title: "Centrale publicatie", body: "Eén beheeromgeving vervangt losse bestandswissels per scherm." },
      { title: "Vaste volgorde", body: "Een playlist bepaalt welke inhoud hoe lang zichtbaar is." },
      { title: "Betrouwbare Player", body: "De Player bewaart een geldige release lokaal voor tijdelijke netwerkuitval." }
    ],
    description:
      "Wat is narrowcasting? Lees hoe gerichte schermcommunicatie, playlists, Players en centraal beheer samen een betrouwbaar systeem vormen.",
    eyebrow: "Kennisbank · uitleg",
    examples: ["Clubhuis en sportkantine", "Bedrijfsentree", "Onderwijsomgeving", "Winkel of sportschool"],
    faqs: [
      { title: "Is narrowcasting hetzelfde als televisie?", body: "Nee. De organisatie stelt zelf doelgerichte content samen voor eigen schermen en locaties." },
      { title: "Is continu internet nodig?", body: "Niet voor het afspelen van een reeds volledig gedownloade VeyoCast-release. Synchronisatie van nieuwe inhoud heeft wel verbinding nodig." },
      { title: "Welke media zijn geschikt?", body: "VeyoCast ondersteunt binnen de huidige kern afbeeldingen en veilige MP4/H.264-video’s die eerst worden gecontroleerd." }
    ],
    imageId: "product-screen-status",
    index: true,
    kind: "article",
    lead:
      "Narrowcasting is doelgerichte communicatie op schermen die een organisatie zelf beheert, op de plek waar de boodschap relevant is.",
    pathname: "/kennisbank/wat-is-narrowcasting",
    primaryCta: productCta,
    related: [
      { href: "/product", label: "VeyoCast-platform" },
      { href: "/functies/playlists", label: "Playlists bouwen" },
      { href: "/oplossingen/sportverenigingen", label: "Narrowcasting voor sportclubs" }
    ],
    secondaryCta: demoCta,
    steps: [
      { title: "Contentbron", body: "Een beheerder maakt of uploadt informatie die op locatie waarde heeft." },
      { title: "Playlist", body: "Items krijgen een volgorde, duur en weergave." },
      { title: "Publicatie", body: "Een gecontroleerde release wordt aan één of meerdere schermen toegewezen." },
      { title: "Playback", body: "De Player downloadt, verifieert en speelt de release fullscreen." }
    ],
    summary:
      "Een goed narrowcastingsysteem maakt niet alleen content zichtbaar; het maakt ook beheer, publicatie en schermstatus controleerbaar.",
    title: "Wat is narrowcasting?"
  },
  {
    benefits: [
      { title: "Clubritme", body: "Wedstrijden, nieuws, sponsors en kantine volgen het dagelijkse verenigingsleven." },
      { title: "Eigen content", body: "De vereniging bepaalt wat er op welk scherm zichtbaar is." },
      { title: "Leesbaar op afstand", body: "Korte boodschappen en templates houden rekening met schermformaat en kijkafstand." },
      { title: "Lokaal beschikbaar", body: "Een geldige release blijft op de Player aanwezig wanneer internet tijdelijk wegvalt." }
    ],
    description:
      "Wat is ClubTV? Ontdek hoe sportverenigingen wedstrijden, clubnieuws, sponsors en kantinecontent centraal op schermen beheren.",
    eyebrow: "Kennisbank · ClubTV",
    examples: ["Welkom en programma", "Uitslagen", "Sponsorcontent", "Clubagenda en kantine"],
    faqs: [
      { title: "Heb ik een televisiezender nodig?", body: "Nee. ClubTV gebruikt beheerde schermen op de eigen locatie en een Player die VeyoCast-content afspeelt." },
      { title: "Kan ieder scherm iets anders tonen?", body: "Ja. Een beheerder kan per scherm een relevante release kiezen." },
      { title: "Wordt wedstrijddata automatisch gevuld?", body: "Alleen wanneer een specifieke integratie aantoonbaar beschikbaar is. Handmatig beheerde content werkt zonder zo’n claim." }
    ],
    imageId: "product-templates",
    index: true,
    kind: "article",
    lead:
      "ClubTV is narrowcasting voor de vereniging: actuele clubcontent op schermen in kantine, entree en andere ontmoetingsplekken.",
    pathname: "/kennisbank/wat-is-clubtv",
    primaryCta: { href: "/clubtv", label: "Ontdek ClubTV" },
    related: [
      { href: "/clubtv", label: "ClubTV van VeyoCast" },
      { href: "/functies/templates", label: "Clubtemplates" },
      { href: "/kennisbank/sponsors-zichtbaar-op-clubtv", label: "Sponsors zichtbaar maken" }
    ],
    secondaryCta: demoCta,
    steps: [
      { title: "Kies locaties", body: "Start waar leden en bezoekers van nature wachten of samenkomen." },
      { title: "Kies vaste rubrieken", body: "Maak een herkenbare mix van nieuws, sport, partners en horeca." },
      { title: "Werk actueel", body: "Bewerk het concept en publiceer een nieuwe versie wanneer de inhoud klopt." }
    ],
    summary:
      "ClubTV werkt het best wanneer ieder item één taak heeft: informeren, activeren of een clubpartner verzorgd zichtbaar maken.",
    title: "Wat is ClubTV?"
  },
  {
    benefits: [
      { title: "Begin klein", body: "Kies één zichtbaar scherm en één beheerder voor de eerste gecontroleerde flow." },
      { title: "Maak rubrieken", body: "Gebruik terugkerende contenttypen zodat actualiseren voorspelbaar wordt." },
      { title: "Leg rechten vast", body: "Bepaal wie media maakt, playlists bewerkt en releases mag publiceren." },
      { title: "Evalueer op locatie", body: "Controleer leesbaarheid, kijkafstand en werkelijke beheerlast na de eerste weken." }
    ],
    description:
      "Praktische gids voor narrowcasting bij een sportvereniging: van locaties en contentritme tot rollen, schermkoppeling en evaluatie.",
    eyebrow: "Kennisbank · implementatie",
    examples: ["Kantine als eerste locatie", "Wekelijkse contentcheck", "Vaste clubrubrieken", "Publicatieverantwoordelijke"],
    faqs: [
      { title: "Met hoeveel schermen moet ik starten?", body: "Start met het kleinste aantal dat de belangrijkste locatie dekt. Schaal pas na een bewezen content- en beheerproces." },
      { title: "Wie houdt de content actueel?", body: "Wijs een eigenaar aan en verdeel voorbereidende taken via rollen; publiceren blijft een bewuste bevoegdheid." },
      { title: "Hoe voorkom ik verouderde slides?", body: "Werk met een contentkalender, vaste reviewmomenten en tijdelijke items die bewust worden vervangen." }
    ],
    imageId: "product-publisher-desktop",
    index: true,
    kind: "article",
    lead:
      "Een goede uitrol begint niet bij veel hardware, maar bij één helder doel, een haalbaar contentritme en duidelijke verantwoordelijkheid.",
    pathname: "/kennisbank/narrowcasting-sportvereniging",
    primaryCta: { href: "/oplossingen/sportverenigingen", label: "Bekijk de sportoplossing" },
    related: [
      { href: "/oplossingen/sportverenigingen", label: "Voor sportverenigingen" },
      { href: "/kennisbank/contentkalender-sportclub", label: "Maak een contentkalender" },
      { href: "/functies/schermen", label: "Schermen beheren" }
    ],
    secondaryCta: demoCta,
    steps: [
      { title: "Doel en locatie", body: "Kies één communicatieprobleem en de plek waar het publiek die informatie nodig heeft." },
      { title: "Content en rollen", body: "Maak een kleine rubriekenset en wijs eigenaar, editor en publiceerder aan." },
      { title: "Techniek en pairing", body: "Koppel het scherm, publiceer een testrelease en controleer lokale playback." },
      { title: "Review en uitbreiding", body: "Meet actualiteit en beheerlast voordat extra schermen worden toegevoegd." }
    ],
    summary:
      "Deze aanpak voorkomt dat narrowcasting een technisch project zonder eigenaar wordt. De contentjourney blijft het vertrekpunt.",
    title: "Narrowcasting voor je sportvereniging invoeren"
  },
  {
    benefits: [
      { title: "Vaste rubrieken", body: "Plan wedstrijd, clubnieuws, sponsors en horeca als herkenbare categorieën." },
      { title: "Eigenaar per item", body: "Leg vast wie informatie aanlevert en wie de release controleert." },
      { title: "Publicatiemoment", body: "Koppel content aan een concreet clubmoment in plaats van aan een vage deadline." },
      { title: "Opschonen", body: "Plan ook wanneer tijdelijke informatie uit de volgende release verdwijnt." }
    ],
    description:
      "Maak een werkbare contentkalender voor jouw sportclub met vaste rubrieken, eigenaren, publicatiemomenten en opschoonafspraken.",
    eyebrow: "Kennisbank · werkvorm",
    examples: ["Maandag: terugblik en uitslagen", "Donderdag: weekendprogramma", "Vrijdag: sponsor en kantine", "Na evenement: tijdelijke content verwijderen"],
    faqs: [
      { title: "Hoe vaak moet de playlist veranderen?", body: "Zo vaak als nodig om zichtbaar actueel te blijven, maar niet vaker dan het beheerteam betrouwbaar kan bijhouden." },
      { title: "Wie beheert de kalender?", body: "Eén inhoudseigenaar bewaakt ritme en deadline; meerdere editors kunnen materiaal voorbereiden." },
      { title: "Moet iedere wijziging direct live?", body: "Nee. Bundel wijzigingen in een gecontroleerde release en publiceer op een logisch moment." }
    ],
    imageId: "product-publisher-mobile",
    index: true,
    kind: "article",
    lead:
      "Een eenvoudige kalender voorkomt last-minute werk en maakt duidelijk wie welke informatie wanneer aanlevert.",
    pathname: "/kennisbank/contentkalender-sportclub",
    primaryCta: { href: "/functies/planning", label: "Bekijk planning" },
    related: [
      { href: "/functies/planning", label: "Content plannen" },
      { href: "/functies/playlists", label: "Playlist Studio" },
      { href: "/kennisbank/narrowcasting-sportvereniging", label: "Implementatiegids" }
    ],
    secondaryCta: demoCta,
    steps: [
      { title: "Kies vier tot zes rubrieken", body: "Beperk de kalender tot content die op locatie aantoonbaar relevant is." },
      { title: "Koppel een eigenaar", body: "Iedere rubriek krijgt één persoon die de bron en actualiteit bewaakt." },
      { title: "Plan review en publicatie", body: "Controleer samenhang en maak daarna bewust een nieuwe release." },
      { title: "Plan de einddatum", body: "Zet tijdelijke informatie niet alleen aan, maar haal haar ook tijdig uit het concept." }
    ],
    summary:
      "De kalender is een redactioneel hulpmiddel. VeyoCast bewaart het verschil tussen de bewerkbare voorbereiding en wat al gepubliceerd is.",
    title: "Maak een haalbare contentkalender voor je sportclub"
  },
  {
    benefits: [
      { title: "Vaste plek", body: "Geef partnercontent een herkenbaar deel van de playlist zonder clubinformatie te verdringen." },
      { title: "Juiste verhouding", body: "Gebruik logo’s ongewijzigd op een rustig contrasterend vlak." },
      { title: "Campagneritme", body: "Wissel meerdere goedgekeurde items af in plaats van alles op één onleesbare slide te zetten." },
      { title: "Actie met context", body: "Combineer QR of korte URL met een duidelijke tekstuele handeling." }
    ],
    description:
      "Maak sponsors verzorgd zichtbaar op ClubTV met leesbare slides, vaste schermmomenten, correcte logo’s en een duidelijke actie.",
    eyebrow: "Kennisbank · sponsors",
    examples: ["Partner van de week", "Wedstrijdsponsor", "Sponsorcarrousel als playlistitems", "QR-actie met tekstalternatief"],
    faqs: [
      { title: "Hoeveel logo’s passen op één slide?", body: "Alleen zoveel als vanaf de echte kijkafstand herkenbaar blijven. Verdeel grotere aantallen over meerdere items." },
      { title: "Mag ik sponsorlogo’s recolouren?", body: "Niet zonder toestemming van de merkeigenaar. Bewaar verhouding en plaats het logo op een passend vlak." },
      { title: "Kan VeyoCast bereik garanderen?", body: "Nee. De website doet geen onbewezen kijk-, bereik- of conversieclaim. Zichtbaarheid begint bij plaatsing en leesbare content." }
    ],
    imageId: "product-templates",
    index: true,
    kind: "article",
    lead:
      "Goede sponsorzichtbaarheid is rustig, herkenbaar en passend bij het moment waarop leden en bezoekers naar het scherm kijken.",
    pathname: "/kennisbank/sponsors-zichtbaar-op-clubtv",
    primaryCta: { href: "/clubtv", label: "Bekijk ClubTV" },
    related: [
      { href: "/clubtv", label: "ClubTV" },
      { href: "/functies/templates", label: "Sponsor-templates" },
      { href: "/oplossingen/sportverenigingen", label: "Voor verenigingen" }
    ],
    secondaryCta: demoCta,
    steps: [
      { title: "Maak afspraken", body: "Leg goedgekeurde assets, boodschap, periode en contactroute vast." },
      { title: "Ontwerp voor afstand", body: "Beperk tekst en geef logo, beeld en CTA voldoende ademruimte." },
      { title: "Plan de rotatie", body: "Bepaal een evenwichtig aantal vertoningen binnen de clubplaylist." },
      { title: "Vervang via release", body: "Wijzig sponsorcontent niet stilzwijgend in een bestaande publicatie." }
    ],
    summary:
      "VeyoCast ondersteunt de publicatieflow; de club en sponsor blijven verantwoordelijk voor toestemming, inhoud en onderlinge afspraken.",
    title: "Maak sponsors zichtbaar op ClubTV"
  }
];

const indexAndSupportPages: MarketingPageDefinition[] = [
  {
    benefits: knowledgePages.slice(0, 4).map((page) => ({ body: page.lead, title: page.title })),
    description:
      "Praktische VeyoCast-kennis over narrowcasting, ClubTV, contentplanning, sportverenigingen en sponsorcommunicatie.",
    eyebrow: "Kennisbank",
    examples: ["Basisbegrippen", "Implementatie", "Contentplanning", "Sponsors en ClubTV"],
    faqs: [
      { title: "Is de kennisbank productdocumentatie?", body: "De artikelen leggen principes en werkvormen uit. Voor account- of schermproblemen gebruik je de supportroute." },
      { title: "Mag ik de stappen binnen mijn club gebruiken?", body: "Ja. Pas ze aan de eigen verantwoordelijkheden, locatie en goedgekeurde content aan." },
      { title: "Waar vind ik productstatus?", body: "Functiepagina’s beschrijven de huidige productbasis. Integratie- en hardwareclaims blijven apart en expliciet." }
    ],
    imageId: "product-publisher-desktop",
    index: true,
    kind: "index",
    lead:
      "Heldere uitleg en praktische werkvormen voor organisaties die schermcommunicatie professioneel willen organiseren.",
    pathname: "/kennisbank",
    primaryCta: productCta,
    related: knowledgePages.map((page) => ({ href: page.pathname, label: page.title })),
    secondaryCta: demoCta,
    steps: [
      { title: "Begrijp de basis", body: "Begin bij narrowcasting of ClubTV." },
      { title: "Maak een plan", body: "Gebruik de implementatiegids en contentkalender." },
      { title: "Verdiep een toepassing", body: "Lees over sponsors, schermen of playlists." }
    ],
    summary:
      "Alle kennisartikelen linken terug naar een relevante functie, oplossing en vervolgstap.",
    title: "Kennis over narrowcasting en ClubTV"
  },
  {
    benefits: [
      { title: "Productnotities", body: "Publiceer alleen redactioneel gecontroleerde updates met een echte datum en inhoud." },
      { title: "Praktijkartikelen", body: "Verbind clubcommunicatie aan concrete werkvormen en productmogelijkheden." },
      { title: "Geen dunne content", body: "Een bericht verschijnt pas wanneer het meer biedt dan een gewijzigde kop." }
    ],
    description:
      "VeyoCast-blog voor toekomstige productnotities en praktijkartikelen over ClubTV, narrowcasting en schermbeheer.",
    eyebrow: "VeyoCast blog",
    examples: ["Productnotities", "Praktijkinzichten", "Betrouwbaarheid", "Clubcommunicatie"],
    faqs: [
      { title: "Waarom staan er nog geen berichten?", body: "Er is nog geen goedgekeurde redactionele publicatieset. VeyoCast vult de pagina niet met fictieve actualiteit." },
      { title: "Waar kan ik nu lezen?", body: "De kennisbank bevat tijdloze uitleg en praktische gidsen die al inhoudelijk zijn gecontroleerd." },
      { title: "Kan ik updates ontvangen?", body: "Er is nog geen nieuwsbriefprovider gekozen. Neem contact op voor een gerichte productvraag." }
    ],
    index: false,
    kind: "index",
    lead:
      "Hier verschijnen straks gecontroleerde productnotities en praktijkartikelen. Tot die tijd verwijzen we naar de complete kennisbank.",
    pathname: "/blog",
    primaryCta: { href: "/kennisbank", label: "Bekijk de kennisbank" },
    related: [
      { href: "/kennisbank", label: "Kennisbank" },
      { href: "/product", label: "Product" },
      { href: "/contact", label: "Contact" }
    ],
    secondaryCta: { href: "/contact", label: "Stel een vraag" },
    steps: [
      { title: "Onderwerp valideren", body: "Een publicatie moet een echte gebruikersvraag beantwoorden." },
      { title: "Claims controleren", body: "Productstatus, bronnen en interne links worden vóór publicatie beoordeeld." },
      { title: "Publiceren met datum", body: "Alleen afgeronde content krijgt metadata, sitemapopname en Article-schema." }
    ],
    summary:
      "De blogindex is gereed, maar toont bewust geen verzonnen nieuws, auteur of publicatiedatum.",
    title: "Productnotities en praktijk uit de VeyoCast-wereld"
  },
  {
    benefits: [
      { title: "Productwerking", body: "Antwoorden over media, playlists, releases en Players." },
      { title: "Starten", body: "Praktische context voor schermen, accounts en eerste publicatie." },
      { title: "Betrouwbaarheid", body: "Uitleg over lokale releases, synchronisatie en tijdelijk offline afspelen." },
      { title: "Commercieel", body: "Eerlijke uitleg over demo, voorstel en nog niet vastgestelde prijzen." }
    ],
    description:
      "Antwoorden op veelgestelde vragen over VeyoCast, ClubTV, schermen, offline playback, accounts, demo en prijzen.",
    eyebrow: "Veelgestelde vragen",
    examples: ["Hoe werkt publiceren?", "Wat gebeurt er offline?", "Welke media kan ik gebruiken?", "Hoe vraag ik een demo aan?"],
    faqs: [
      { title: "Wat is VeyoCast?", body: "Een multi-tenant platform voor narrowcasting en ClubTV met Publisher, een offline-first Player en gecontroleerde media- en releaseverwerking." },
      { title: "Wat speelt een scherm bij tijdelijk internetverlies?", body: "De laatst volledig geverifieerde lokale release, zolang die op het apparaat beschikbaar is." },
      { title: "Kan ik een gepubliceerde release aanpassen?", body: "Nee. Je bewerkt het concept en maakt daarna een nieuwe immutable release." },
      { title: "Welke video wordt ondersteund?", body: "De huidige Playerbasis gebruikt veilig verwerkte MP4 met H.264-video en waar nodig AAC-audio; autoplay staat standaard stil." },
      { title: "Zijn sportintegraties al live?", body: "Er wordt geen specifieke provider als live productie-integratie geclaimd. De actuele status staat op de integratiepagina." },
      { title: "Wat kost VeyoCast?", body: "Definitieve bedragen zijn nog niet publiek vastgesteld. Vraag een voorstel aan op basis van schermen en beheerbehoefte." }
    ],
    index: true,
    kind: "support",
    lead:
      "De belangrijkste antwoorden over contentbeheer, publicatie, schermen, offline gedrag en starten met VeyoCast.",
    pathname: "/veelgestelde-vragen",
    primaryCta: { href: "/support", label: "Bekijk ondersteuning" },
    related: [
      { href: "/kennisbank", label: "Kennisbank" },
      { href: "/product", label: "Product" },
      { href: "/demo", label: "Plan een demo" }
    ],
    secondaryCta: { href: "/contact", label: "Stel een andere vraag" },
    steps: [
      { title: "Zoek het onderwerp", body: "Begin bij product, schermen, betrouwbaarheid of commercieel." },
      { title: "Open verdieping", body: "Gebruik de contextlinks voor een volledige functie- of kennisroute." },
      { title: "Neem veilig contact op", body: "Deel geen tokens of wachtwoorden wanneer je aanvullende hulp vraagt." }
    ],
    summary:
      "Alle vragen en antwoorden zijn zichtbaar op de pagina en worden ook als overeenkomstige FAQ structured data aangeboden.",
    title: "Veelgestelde vragen over VeyoCast"
  },
  {
    benefits: [
      { title: "Begin bij het gevolg", body: "Beschrijf welk scherm of welke beheeractie niet werkt en wat zichtbaar blijft." },
      { title: "Gebruik herstelcontext", body: "Open schermdiagnostiek of de relevante actie voordat je technische gegevens verzamelt." },
      { title: "Deel geen secrets", body: "Pairingcodes, sessietokens en volledige signed URL’s horen niet in een supportmail." },
      { title: "Lokale playback eerst", body: "Onderbreek een geldige actieve release niet onnodig tijdens onderzoek." }
    ],
    description:
      "VeyoCast-ondersteuning voor beheerders: veilige probleembeschrijving, Player-herstel, privacy en contact zonder gevoelige tokens te delen.",
    eyebrow: "Ondersteuning",
    examples: ["Scherm niet recent gezien", "Release synchroniseert niet", "Media blijft verwerken", "Account- of privacyvraag"],
    faqs: [
      { title: "Waar meld ik een probleem?", body: "Mail support@veyocast.nl met organisatie, schermnaam, zichtbaar gevolg en tijdstip. Deel geen geheime gegevens." },
      { title: "Wat doe ik als internet uitvalt?", body: "Laat de Player de geldige lokale release afspelen. Controleer verbinding en wacht op automatisch herstel voordat je appdata wist." },
      { title: "Hoe verwijder ik Playerdata?", body: "Ontkoppel het device in Control en wis daarna lokaal de appopslag; de volledige stappen staan op Data verwijderen." }
    ],
    imageId: "product-screen-status",
    index: true,
    kind: "support",
    lead:
      "Los eerst de veilige volgende stap op en verzamel alleen de informatie die voor herstel nodig is.",
    pathname: "/support",
    primaryCta: { href: "mailto:support@veyocast.nl", label: "Mail ondersteuning" },
    related: [
      { href: "/veelgestelde-vragen", label: "Veelgestelde vragen" },
      { href: "/data-verwijderen", label: "Data verwijderen" },
      { href: "/privacy", label: "Privacy" }
    ],
    secondaryCta: { href: "/veelgestelde-vragen", label: "Bekijk veelgestelde vragen" },
    steps: [
      { title: "Controleer de zichtbare status", body: "Noteer schermnaam, tijdstip en de menselijke foutmelding." },
      { title: "Volg de herstelactie", body: "Gebruik de actie uit Control en laat geldige playback intact." },
      { title: "Vraag ondersteuning", body: "Stuur alleen de noodzakelijke context naar de gepubliceerde mailbox." }
    ],
    summary:
      "VeyoCast publiceert nog geen externe statusprovider. De statusroute blijft daarom een transparante uitleg en geen gefingeerd uptime-dashboard.",
    title: "Hulp bij VeyoCast"
  },
  {
    benefits: [
      { title: "Geen fictieve status", body: "Zonder gekoppelde monitoringprovider wordt geen groen uptimepercentage getoond." },
      { title: "Operationele signalen", body: "Beheerders zien scherm- en publicatiestatus binnen hun eigen afgeschermde Control-context." },
      { title: "Contact bij storing", body: "Support blijft de publieke route zolang externe incidentcommunicatie niet is ingericht." }
    ],
    description:
      "Publieke VeyoCast-statusinformatie en uitleg waar beheerders operationele scherm- en publicatiesignalen veilig terugvinden.",
    eyebrow: "Systeemstatus",
    examples: ["Control health", "Player health", "Mediaverwerking", "Deploymentstatus"],
    faqs: [
      { title: "Is dit een live statuspagina?", body: "Nog niet. Er is geen publieke monitoringprovider gekoppeld en VeyoCast simuleert geen actuele status." },
      { title: "Waar zie ik mijn schermstatus?", body: "In VeyoCast Control binnen de actieve organisatiecontext." },
      { title: "Hoe meld ik een storing?", body: "Mail support@veyocast.nl met het zichtbare gevolg, tijdstip en schermnaam, zonder geheimen." }
    ],
    index: false,
    kind: "support",
    lead:
      "Een publieke statuspagina wordt pas live wanneer monitoring en incidentcommunicatie aantoonbaar zijn aangesloten.",
    pathname: "/status",
    primaryCta: { href: "mailto:support@veyocast.nl", label: "Meld een probleem" },
    related: [
      { href: "/support", label: "Ondersteuning" },
      { href: "/functies/monitoring", label: "Schermmonitoring" },
      { href: "/contact", label: "Contact" }
    ],
    secondaryCta: { href: "/support", label: "Bekijk ondersteuning" },
    steps: [
      { title: "Controleer Control", body: "Gebruik de afgeschermde schermvloot voor jouw operationele status." },
      { title: "Bewaar lokale playback", body: "Laat een geldige release spelen tijdens tijdelijke netwerkproblemen." },
      { title: "Meld het gevolg", body: "Neem contact op wanneer herstel uitblijft." }
    ],
    summary:
      "Deze route is noindex totdat een echte publieke statusprovider en incidentproces zijn ingericht.",
    title: "Status van VeyoCast"
  },
  {
    benefits: [
      { title: "Nog geen openbare cases", body: "Klantnamen, resultaten en logo’s worden pas gepubliceerd na aantoonbare toestemming." },
      { title: "Wel productbewijs", body: "De site laat echte productcaptures en gevalideerde systeemwerking zien." },
      { title: "Case-template gereed", body: "Een toekomstige case krijgt probleem, aanpak, resultaat, toestemming en unieke metadata." }
    ],
    description:
      "VeyoCast-klantcases worden hier gepubliceerd zodra organisaties, resultaten, beeld en toestemming aantoonbaar zijn goedgekeurd.",
    eyebrow: "Klantcases",
    examples: ["Probleem en locatie", "Gekozen VeyoCast-flow", "Aantoonbaar resultaat", "Goedgekeurde klantreactie"],
    faqs: [
      { title: "Waarom zie ik nog geen clubs?", body: "VeyoCast presenteert geen fictieve of niet-goedgekeurde organisaties als klant." },
      { title: "Kan mijn organisatie een case worden?", body: "Dat kan alleen na een gezamenlijke inhouds- en toestemmingsronde met controleerbare resultaten." },
      { title: "Waar zie ik het product nu?", body: "Bekijk Product, Publisher en de functiepagina’s voor echte interfacebeelden en systeemwerking." }
    ],
    imageId: "product-publisher-desktop",
    index: false,
    kind: "index",
    lead:
      "Geen verzonnen logo’s, quotes of resultaten. Deze pagina gaat pas indexeren wanneer de eerste case volledig is goedgekeurd.",
    pathname: "/cases",
    primaryCta: productCta,
    related: [
      { href: "/product", label: "Bekijk het product" },
      { href: "/publisher", label: "VeyoCast Publisher" },
      { href: "/demo", label: "Plan een demo" }
    ],
    secondaryCta: demoCta,
    steps: [
      { title: "Toestemming", body: "Organisatie, personen, logo’s en fotografie worden schriftelijk vrijgegeven." },
      { title: "Bewijs", body: "Resultaten en citaten krijgen een controleerbare bron." },
      { title: "Publicatie", body: "Pas daarna krijgt de detailroute indexeerbare metadata en sitemapopname." }
    ],
    summary:
      "De productievariant toont in plaats van fictieve social proof concrete, technisch onderbouwde producteigenschappen.",
    title: "VeyoCast in de praktijk"
  }
];

const legalShellPages: MarketingPageDefinition[] = [
  {
    benefits: [
      { title: "Noodzakelijke opslag", body: "VeyoCast gebruikt functionele sessie- en voorkeurenopslag voor Control en Player." },
      { title: "Geen marketingtracking", body: "De publieke website bevat momenteel geen advertentie- of analyticscode." },
      { title: "Lokale Playerdata", body: "IndexedDB en Cache Storage bewaren releases en media voor offline playback." }
    ],
    description:
      "Lees welke cookies en lokale opslag VeyoCast gebruikt voor sessies, voorkeuren, pairing en betrouwbare offline Playerwerking.",
    eyebrow: "Juridisch",
    examples: ["Supabase-authenticatie", "Organisatiecontext", "Interfacevoorkeuren", "Playercache en IndexedDB"],
    faqs: [
      { title: "Gebruikt de website marketingcookies?", body: "Nee, op dit moment niet. Nieuwe tracking of analytics vereist een afzonderlijke provider- en consentkeuze." },
      { title: "Waarom bewaart de Player lokale data?", body: "Voor pairing, de actieve release en media die bij tijdelijke internetuitval moeten blijven spelen." },
      { title: "Hoe wis ik Playerdata?", body: "Volg de stappen op Data verwijderen voor ontkoppelen en lokale appopslag." }
    ],
    index: true,
    kind: "legal",
    lead:
      "Functionele opslag houdt accounts veilig en schermen betrouwbaar. De marketingwebsite vraagt geen trackingtoestemming omdat er geen tracking draait.",
    pathname: "/cookies",
    primaryCta: { href: "/privacy", label: "Lees de privacyverklaring" },
    related: [
      { href: "/privacy", label: "Privacy" },
      { href: "/data-verwijderen", label: "Data verwijderen" },
      { href: "/contact", label: "Contact" }
    ],
    steps: [
      { title: "Website", body: "Publieke pagina’s kunnen zonder tracking worden gelezen." },
      { title: "Control", body: "Noodzakelijke sessie-, context- en voorkeursopslag ondersteunt veilig beheer." },
      { title: "Player", body: "Lokale opslag bewaart devicecontext en geverifieerde content." }
    ],
    summary:
      "Deze uitleg beschrijft de huidige technische situatie en voegt geen nieuw consent- of trackingmechanisme toe.",
    title: "Cookies en lokale opslag"
  },
  {
    benefits: [
      { title: "Nog niet publiek definitief", body: "Er is geen goedgekeurde juridische brontekst voor algemene voorwaarden aangeleverd." },
      { title: "Geen verzonnen bepalingen", body: "Looptijd, aansprakelijkheid en betaling worden niet door de website ingevuld." },
      { title: "Route voorbereid", body: "De definitieve tekst kan zonder wijziging van navigatie en metadata worden geplaatst." }
    ],
    description:
      "De route voor de algemene voorwaarden van VeyoCast is voorbereid; definitieve juridische tekst wordt pas na goedkeuring gepubliceerd.",
    eyebrow: "Juridisch · conceptstatus",
    examples: ["Dienstomschrijving", "Contract en looptijd", "Gebruik en verantwoordelijkheid", "Aansprakelijkheid en beëindiging"],
    faqs: [
      { title: "Zijn dit al de voorwaarden?", body: "Nee. Deze route bevat bewust geen juridisch bindende tekst zonder aangeleverde en gecontroleerde bron." },
      { title: "Welke afspraken gelden nu?", body: "Alleen afspraken die rechtstreeks en aantoonbaar met de betreffende organisatie zijn gemaakt." },
      { title: "Wanneer wordt deze pagina geïndexeerd?", body: "Pas wanneer de definitieve tekst juridisch is gecontroleerd en gepubliceerd." }
    ],
    index: false,
    kind: "legal",
    lead:
      "VeyoCast publiceert hier geen generieke of door software verzonnen voorwaarden. De definitieve tekst blijft een expliciete juridische beslissing.",
    pathname: "/algemene-voorwaarden",
    primaryCta: { href: "/contact", label: "Neem contact op" },
    related: [
      { href: "/privacy", label: "Privacy" },
      { href: "/verwerkersovereenkomst", label: "Verwerkersovereenkomst" },
      { href: "/contact", label: "Contact" }
    ],
    steps: [
      { title: "Bron aanleveren", body: "Een bevoegde juridische bron levert de definitieve bepalingen." },
      { title: "Controle", body: "Productgedrag, privacytekst en contractinhoud worden op elkaar afgestemd." },
      { title: "Publicatie", body: "Daarna volgen indexatie, datum en versiebeheer." }
    ],
    summary:
      "Deze noindex-route is een omkeerbare shell en maakt geen juridische claim.",
    title: "Algemene voorwaarden"
  },
  {
    benefits: [
      { title: "Verantwoordelijkheden", body: "Leg vast wanneer de klant verwerkingsverantwoordelijke en VeyoCast verwerker is." },
      { title: "Beveiligingsafspraken", body: "Koppel maatregelen en incidentafhandeling aan de werkelijke infrastructuur." },
      { title: "Subverwerkers", body: "Publiceer alleen de leveranciers en locaties die production aantoonbaar gebruikt." }
    ],
    description:
      "Informatie over de toekomstige VeyoCast-verwerkersovereenkomst; definitieve juridische tekst en subprocessorlijst volgen na goedkeuring.",
    eyebrow: "Juridisch · conceptstatus",
    examples: ["Rollen en instructies", "Technische maatregelen", "Subverwerkers", "Verwijdering en export"],
    faqs: [
      { title: "Kan ik de overeenkomst downloaden?", body: "Nog niet. Er is geen definitief goedgekeurd document om betrouwbaar aan te bieden." },
      { title: "Is VeyoCast altijd verwerker?", body: "Nee. De rol hangt af van het doel en de gegevensverwerking; de privacyverklaring licht dit onderscheid toe." },
      { title: "Waar stel ik een privacyvraag?", body: "Mail privacy@veyocast.nl zonder gevoelige account- of devicetokens mee te sturen." }
    ],
    index: false,
    kind: "legal",
    lead:
      "De technische privacy-audit is vastgelegd, maar een definitieve overeenkomst vereist afzonderlijke juridische goedkeuring.",
    pathname: "/verwerkersovereenkomst",
    primaryCta: { href: "mailto:privacy@veyocast.nl", label: "Mail privacy" },
    related: [
      { href: "/privacy", label: "Privacyverklaring" },
      { href: "/data-verwijderen", label: "Data verwijderen" },
      { href: "/contact", label: "Contact" }
    ],
    steps: [
      { title: "Rollen vaststellen", body: "Bepaal per verwerking wie doel en middelen bepaalt." },
      { title: "Werkelijkheid auditen", body: "Controleer hosting, leveranciers, bewaartermijnen en verwijderprocessen." },
      { title: "Juridisch goedkeuren", body: "Publiceer pas daarna een definitief downloadbaar document." }
    ],
    summary:
      "Deze route is noindex en toont uitsluitend de veilige voorbereidingsstatus.",
    title: "Verwerkersovereenkomst"
  },
  {
    benefits: [
      { title: "WCAG 2.2 AA als doel", body: "Website en Control richten zich op contrast, semantiek, focus en reflow." },
      { title: "Toetsenbord en touch", body: "Kernacties hebben een logische focusvolgorde en voldoende grote interactiedoelen." },
      { title: "Reduced motion", body: "Niet-essentiële beweging wordt beperkt wanneer de systeemvoorkeur daarom vraagt." },
      { title: "Feedback welkom", body: "Een toegankelijkheidsprobleem kan zonder account via support worden gemeld." }
    ],
    description:
      "Lees hoe VeyoCast werkt aan toegankelijke website-, Control- en Playerervaringen en hoe u een probleem kunt melden.",
    eyebrow: "Toegankelijkheid",
    examples: ["Semantische structuur", "Zichtbare focus", "Contrast en reflow", "Reduced motion"],
    faqs: [
      { title: "Is VeyoCast formeel gecertificeerd?", body: "Nee. De product- en releasegates richten zich op WCAG 2.2 AA, maar deze pagina claimt geen externe certificering." },
      { title: "Hoe meld ik een probleem?", body: "Mail support@veyocast.nl met pagina, handeling, hulpmiddel of browser en het zichtbare gevolg." },
      { title: "Wordt de Player ook getest?", body: "Playercontent kent aanvullende eisen voor kijkafstand, contrast, overscan en fysieke schermomstandigheden." }
    ],
    index: true,
    kind: "legal",
    lead:
      "VeyoCast wil dat beheerders en bezoekers informatie kunnen begrijpen en bedienen, ongeacht viewport, invoermethode of bewegingsvoorkeur.",
    pathname: "/toegankelijkheid",
    primaryCta: { href: "mailto:support@veyocast.nl?subject=Toegankelijkheid", label: "Meld een probleem" },
    related: [
      { href: "/support", label: "Ondersteuning" },
      { href: "/privacy", label: "Privacy" },
      { href: "/contact", label: "Contact" }
    ],
    steps: [
      { title: "Automatische checks", body: "Lint, typecheck en browsertests bewaken semantiek en regressies." },
      { title: "Handmatige controle", body: "Keyboard, zoom, reflow, reduced motion en schermlezergedrag vragen menselijke beoordeling." },
      { title: "Fysieke validatie", body: "Playerleesbaarheid wordt daarnaast op echte schermen en kijkafstanden getoetst." }
    ],
    summary:
      "De verklaring beschrijft doelen en testwijze, niet een ongefundeerde conformiteitsclaim.",
    title: "Toegankelijkheid bij VeyoCast"
  }
];

export const marketingPages = [
  ...corePages,
  ...featurePages,
  ...sectorPages,
  ...knowledgePages,
  ...indexAndSupportPages,
  ...legalShellPages
] as const satisfies readonly MarketingPageDefinition[];

export const marketingPageByPath = new Map(
  marketingPages.map((page) => [page.pathname, page])
);

export const sitemapPages = marketingPages.filter((page) => page.index);

export function getMarketingPage(pathname: string) {
  return marketingPageByPath.get(pathname);
}
