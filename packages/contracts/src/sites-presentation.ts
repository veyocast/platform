import { z } from "zod";

/** Frozen, trusted renderer identities. Source data remains database-owned. */
export const sitesLegacyPresentationVersion = "sites-v11" as const;
export const sitesLegacyPresentationSourceRevision = "b1cae899af19fc39908217253094c5240d7359fc" as const;
export const sitesPresentationVersion = sitesLegacyPresentationVersion;
export const sitesPresentationSourceRevision = sitesLegacyPresentationSourceRevision;
export const sitesCurrentPresentationVersion = "sites-v17" as const;
export const sitesCurrentPresentationSourceRevision = "6800bc858436ba0843eaea89b682cd5b43c3521d" as const;
export const sitesPresentationIdentities = [
  { rendererVersion: sitesLegacyPresentationVersion, sourceRevision: sitesLegacyPresentationSourceRevision },
  { rendererVersion: sitesCurrentPresentationVersion, sourceRevision: sitesCurrentPresentationSourceRevision }
] as const;
export const sitesScreenThemeIds = ["fieldflow", "onzetrots-tv"] as const;
export const sitesUnifiedKinds = ["agenda", "competitie", "rss", "uitslagen", "programma", "matchday", "verjaardagen", "trainingen", "vacatures", "kantine", "partners", "welkom", "bezoekers", "led", "sportlink-extra", "vrij"] as const;

export const sitesSystemImageChecksums = {
  "/favicon.svg": "e6d2e59b7b5bbb0342e0fb496dfc262decbfe4426bbb7b047aec8d467d1dc6f7",
  "/fieldflow/photos/FF-PHOTO-01-clubhouse-exterior-3840x2160-web.webp": "5115506847b4e78a4ea51618be9fd1c04202ced1564b00a47961e56a6941fe1a",
  "/fieldflow/photos/FF-PHOTO-04-matchday-live-3840x2160-web.webp": "b7fce5339c8c865ee5ae86693c349d5f3a724b5235c9c7b80dcea2d688dfecb0",
  "/fieldflow/photos/FF-PHOTO-05-sponsor-hub-3840x2160-web.webp": "cc94973585c9248d11b9b4bb871416ab49a413904e7bd928132cd0e9a3d1d2ef",
  "/fieldflow/photos/FF-PHOTO-06-community-3840x2560-web.webp": "03dc11dbd5daa87e84d6e8f21b8ec51b54f271537fd24af57dbf4ea9911a254c",
  "/file.svg": "1e0ae4d1a1ddfa36752988647b731e4abf150c414d069ec83c96fb0aaeff0307",
  "/globe.svg": "d051a8c47936990a9085693d307bb7cea1bc1b6d7ed956bcbaacf674f4ec96b9",
  "/onzetrots/brush/brush-frame.png": "4b002d67496adcc267160f002cedd117c8f1b13d619de0404f026647bfd7b9f7",
  "/onzetrots/brush/clubhuis.svg": "8bb77aef3580efc3883cd43c2b10c42c85be0b7a1230a773a72dc377382f5f3b",
  "/onzetrots/brush/duindorp-luchtfoto.svg": "f4c08b3cb5e713d1e317e5e62e1b1ddb3265d5c3442cedab0dc814b07d536e50",
  "/onzetrots/brush/havenlicht.svg": "de9b50862e815400d9544b373fd59d19d844a8e6f635b27fa13109ba6de1f394",
  "/onzetrots/brush/historische-poort.svg": "b6a6b3f19b27270ae610bf383ae79d177ea09f2faa146a0c8419a5e745fb280a",
  "/onzetrots/brush/kerk.svg": "6e7531ea29a64f99b8c2da53f0209ceeb5bef43546246ecc55728379ca01ddf8",
  "/onzetrots/duindorp-logo.png": "832c642ea9735b87452a6508ae5525f4f87fe528408efc58ad0f86f1a456a930",
  "/onzetrots/houtrust-brush.webp": "4e654df31f432c922a44b1670f6bf8d64af3361d40645f410de0a4d696d46171",
  "/onzetrots/originals/clubhuis.jpg": "59f2c6f69fe0550cb261fe9fb67a46d08038dce890a3d03681d6a8121aec0b1c",
  "/onzetrots/originals/duindorp-luchtfoto.jpg": "c4f9b1a26cff9cc9517cb5392ec684378914c6561d4b1fcb32c23bd107dd23e2",
  "/onzetrots/originals/havenlicht.jpg": "70794084caa404e23e8215e4a33783e094e4210911d49553eeeca45a40945cd8",
  "/onzetrots/originals/historische-poort.jpg": "5065f77c59a6b57dadf458bbc11674bece0cb4563ae65979139ec9b91c2f854c",
  "/onzetrots/originals/kerk.jpg": "36c51d7c7dec84a79336fb176d37ed7fdbb6eadcc7854b5eccf351f4fbcdcbe7",
  "/onzetrots/paint-wall.webp": "fccf75c498bc84ea4c8d3febafa1645e065be047f470ba66671cfb6a51517310",
  "/onzetrots/premium/clubhuis.png": "7942a36dd34c06c4b576e122d52acc8f970e9a10af78d2e15861d0893da63efd",
  "/onzetrots/premium/duindorp-luchtfoto.png": "a11606f1cc19a5f5885c506b265d654ac888d449afba1099ebb34a8f59695c60",
  "/onzetrots/premium/havenlicht.png": "0a1009d093fce5d96f8e697624f2509e779acb0b7c36f3f7fac366333dc6db3e",
  "/onzetrots/premium/historische-poort.png": "1776fefafb9f4845c67f1148c7971682b58be68c0f9f2ff2b4545355eac2d5d7",
  "/onzetrots/premium/kerk.png": "0a2b23aaa9a3caddb6b7a6f36f5bfc2ed83c2f64ba32438a63023905d62ee7ec",
  "/onzetrots/readability-brush.svg": "f42dba3e394f6c87a1381a55214c6998ba8e80ee17709702ab537e969a17dfbb",
  "/onzetrots/type-distress.svg": "eebad54e89c5bccd0854f9db7c0a39549709454386271acea7263d06386c5107",
  "/onzetrots/website-brush/aan-zee-portrait-941.webp": "446eeeaa84b0e032d34fa6aac10615716d4927917bf9258d245ddad0ebc347d6",
  "/onzetrots/website-brush/aan-zee-wide-1672.webp": "ab1df0dd01e1f5ed768e099897377e12b92b85c2856eb80c48c7a06416ece3ae",
  "/onzetrots/website-brush/de-wijk-portrait-941.webp": "a9aab1cb20cbd4abcf92ed90463d8e50a2a67c4cf1637bd2cdeb55dbd265ae70",
  "/onzetrots/website-brush/de-wijk-wide-1672.webp": "d7198cf38780978b142c15c6cbc33f196afe1d77016582495438daf903c4234e",
  "/onzetrots/website-brush/houtrust-portrait-941.webp": "e96a079d1a96f3ca75305329431065d2c61b7f3548735f48811bb57d34be4a14",
  "/onzetrots/website-brush/houtrust-wide-1672.webp": "4e654df31f432c922a44b1670f6bf8d64af3361d40645f410de0a4d696d46171",
  "/onzetrots-tv/assets/clubmuur-lettering.webp": "c4bf31d7c6331f76f6e4db9bbac59052a01ad9c6f6ae3abe497925f90e15bf32",
  "/onzetrots-tv/assets/clubmuur-players/trio-1280.webp": "543bb88be5c642cac8ed64c3f0f1f8e38608d8640fe5f41623a6477d62b89291",
  "/onzetrots-tv/assets/clubmuur-portraits-v14/05-juichen-1280.webp": "a7519a49d43abe4e0bdc786780ad7d377528114085801c5de2592c38140a3dbb",
  "/onzetrots-tv/assets/clubmuur-portraits-v14/07-walking-1280.webp": "6e5926d26fbf048d3a5e0ef091de8dc3b895df12ebd11e4e2a42c53a53907bfc",
  "/onzetrots-tv/assets/clubmuur-portraits-v17/10-strijd-1280.webp": "16a4d2f6e372ec0deccd0f435506c15351fd54033d486b9b28c44b0cd557d433",
  "/onzetrots-tv/assets/clubmuur-wall.webp": "fccf75c498bc84ea4c8d3febafa1645e065be047f470ba66671cfb6a51517310",
  "/onzetrots-tv/assets/logo.png": "832c642ea9735b87452a6508ae5525f4f87fe528408efc58ad0f86f1a456a930",
  "/onzetrots-tv/assets/sponsors/bnu.svg": "44f2ccd12438bcfb292e1283ecac9ef7f5758d4cb77b14e65835260181285504",
  "/onzetrots-tv/assets/sponsors/deelman-daktechniek.svg": "555ca80ae9e1b9e60cf9179092ac0201e4adaf4032b0d53be979dc6d328e23b1",
  "/onzetrots-tv/assets/sponsors/dg-webservices.svg": "dbe2716900d7137fe74250b2ef0708d668fdc8596161c07474006aed56d1c031",
  "/onzetrots-tv/assets/sponsors/kwaliteit-kozijnen-holland.svg": "9eac38ab31bae0373a516e88724a246841c14a3efa5bfc61ca40b2537b224f68",
  "/onzetrots-tv/assets/sponsors/proto-tegelzetbedrijf.svg": "337a0308cef2a2b7b68d89d0f2afcb789467aaaaf7651803e92e8a4e04321d01",
  "/onzetrots-tv/assets/sponsors/rw-repair.png": "2698a951c6f595bdc3b08cd0ec891575b3122d891cd0b783a8e22515080f866d",
  "/onzetrots-tv/assets/type-distress.svg": "eebad54e89c5bccd0854f9db7c0a39549709454386271acea7263d06386c5107",
  "/window.svg": "decf1cf7bb22b5c99c4857cfcd5718ce5465c4454166317589c83fc73df74b66"
} as const;

const checksum = z.string().regex(/^[a-f0-9]{64}$/);
const text = z.string().max(1000);
const shortText = z.string().max(240);
const color = z.string().regex(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i);
const scale = z.number().min(70).max(200);
const rendererVersion = z.enum([sitesLegacyPresentationVersion, sitesCurrentPresentationVersion]);
const sourceRevision = z.enum([sitesLegacyPresentationSourceRevision, sitesCurrentPresentationSourceRevision]);
const unifiedKind = z.enum(sitesUnifiedKinds);

const asset = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("system"), path: z.enum(Object.keys(sitesSystemImageChecksums) as [keyof typeof sitesSystemImageChecksums, ...Array<keyof typeof sitesSystemImageChecksums>]), checksumSha256: checksum }).strict(),
  z.object({ kind: z.literal("tenant"), mediaAssetId: z.string().uuid(), checksumSha256: checksum }).strict()
]).superRefine((value, context) => {
  if (value.kind === "system" && sitesSystemImageChecksums[value.path] !== value.checksumSha256) context.addIssue({ code: "custom", path: ["checksumSha256"], message: "System image identity mismatch." });
});
export const sitesAssetReferenceSchema = asset;

const row = z.object({
  id: z.string().min(1).max(100), primary: shortText, secondary: text.optional(), value: shortText.optional(), rank: z.number().int().min(0).max(10000).optional(), image: asset.optional(),
  home: shortText.optional(), away: shortText.optional(), homeImage: asset.optional(), awayImage: asset.optional(), time: shortText.optional(), field: shortText.optional(), tag: shortText.optional(), own: z.boolean().optional(), homeOwn: z.boolean().optional(), awayOwn: z.boolean().optional(),
  homeScore: shortText.optional(), awayScore: shortText.optional(), played: shortText.optional(), won: shortText.optional(), drawn: shortText.optional(), lost: shortText.optional(), difference: shortText.optional(), points: shortText.optional(), form: z.array(z.enum(["W", "G", "V", "U"])).max(5).optional()
}).strict();

const menuWidget = z.object({
  id: z.string().min(1).max(128), type: z.enum(["category", "image", "promo", "text"]),
  column: z.enum(["full", "left", "right"]), columns: z.union([z.literal(1), z.literal(2)]),
  title: shortText, subtitle: text.optional(), image: asset.optional(),
  aspectRatio: z.enum(["16:9", "9:16"]).optional(), fit: z.enum(["cover", "contain", "fill"]).optional(),
  rows: z.array(row.extend({ column: z.union([z.literal(1), z.literal(2)]), secondary: z.string().optional() })).max(100)
}).strict();

export const sitesTvContentSchema = z.object({
  menuPages: z.array(z.object({ id: z.string().min(1).max(128), columns: z.union([z.literal(1), z.literal(2)]), widgets: z.array(menuWidget).max(100) }).strict()).min(1).max(200).optional(),
  kind: z.enum(["wedstrijd", "programma", "uitslagen", "stand", "kantine", "clubnieuws", "partners", "welkom", "score", "goal", "lineup", "generic"]), title: shortText, subtitle: text.optional(), eyebrow: shortText.optional(), clubName: shortText.optional(), logo: asset.optional(), brandLogo: asset.optional(),
  background: asset.optional(), heroImage: asset.optional(), time: shortText.optional(), location: shortText.optional(), footer: shortText.optional(), rows: z.array(row).max(200), values: z.array(shortText).max(12).optional(),
  combo: z.object({ name: shortText, price: shortText, note: shortText.optional() }).strict().optional(),
  match: z.object({ home: shortText, away: shortText, homeScore: shortText.optional(), awayScore: shortText.optional(), homeLogo: asset.optional(), awayLogo: asset.optional(), homeOwn: z.boolean().optional(), awayOwn: z.boolean().optional(), clock: shortText.optional(), label: shortText.optional(), homeLabel: shortText.optional(), awayLabel: shortText.optional() }).strict().optional(),
  standingColumns: z.array(z.enum(["played", "won", "drawn", "lost", "difference", "points", "form"])).max(7).optional(), page: z.number().int().min(0).max(199).optional(), pages: z.number().int().min(1).max(200).optional(), scale: scale.optional(), overlay: z.number().min(0).max(95).optional(), align: z.enum(["left", "center", "right"]).optional(), safeArea: z.number().min(0).max(12).optional(), accent: color.optional(),
  titleScale: scale.optional(), scoreScale: scale.optional(), logoScale: scale.optional(), teamScale: scale.optional(), showBranding: z.boolean().optional(), backgroundFit: z.enum(["cover", "contain"]).optional(), showSceneLabel: z.boolean().optional(), timeline: z.array(row).max(30).optional(), layout: z.enum(["full", "split", "sidebar"]).optional()
}).strict();

const v17Options = {
  unifiedKind: unifiedKind.optional(), paintTone: z.enum(["white", "blue"]).default("white"), photoMotion: z.boolean().default(true), rssLayout: z.enum(["accordion", "fullscreen", "split"]).default("accordion"), menuLayout: z.enum(["columns", "tiles", "list", "featured"]).default("columns"),
  showPrices: z.boolean().default(true), showCategories: z.boolean().default(true), currency: z.string().trim().min(3).max(3).default("EUR"), extraType: shortText.default("periodestand"), arrivalCards: z.number().int().min(1).max(4).default(4), arrivalBefore: z.number().int().min(0).max(1440).default(180), arrivalAfter: z.number().int().min(0).max(1440).default(120), arrivalShowLogo: z.boolean().default(true), arrivalShowKickoff: z.boolean().default(true), qrUrl: z.string().url().max(1024).default("https://veyocast.nl"), body: text.default(""), vacancyContact: shortText.default(""), welcomeImage: asset.optional()
} as const;

export const sitesStudioSlideSchema = z.object({
  id: z.string().min(1).max(100), name: shortText, title: shortText, time: shortText, subtitle: text, location: shortText, photo: asset.optional(), duration: z.number().int().min(3).max(120), color, background: color, bold: z.boolean(), italic: z.boolean(), align: z.enum(["left", "center", "right"]), size: z.number().min(20).max(180), context: z.boolean(), showLocation: z.boolean(), animation: z.enum(["Geen", "Flow in", "Vervagen", "Omhoog", "Zoom"]), transition: z.enum(["Rustig", "Lineair", "Versnellen", "Vloeiend"]), orientation: z.enum(["landscape", "portrait"]), layout: z.enum(["split", "image-left", "full", "bottom"]).optional(), photoPosition: z.enum(["center", "top", "bottom", "left", "right"]).optional(), overlay: z.number().min(0).max(95).optional(), clubName: shortText.optional(), logo: asset.optional(), themeId: z.enum(sitesScreenThemeIds), tv: sitesTvContentSchema.optional(),
  ...v17Options
}).strict().superRefine((slide, context) => {
  if (slide.themeId === "onzetrots-tv" && !slide.tv) context.addIssue({ code: "custom", path: ["tv"], message: "OnzeTrots TV content is required." });
  if (slide.themeId === "onzetrots-tv" && slide.tv?.scale !== undefined && (slide.tv.scale < 75 || slide.tv.scale > 140)) context.addIssue({ code: "custom", path: ["tv", "scale"], message: "Studio TV scale must be between 75 and 140." });
});

export const sitesDynamicConfigurationSchema = z.object({
  onzeTrotsStyle: z.enum(["v9-marker-light", "v9-marker-dark"]).optional(),
  menuWidgets: z.boolean().optional(),
  schemaVersion: z.literal(1), rendererVersion, sourceRevision, themeId: z.enum(sitesScreenThemeIds), orientation: z.enum(["landscape", "portrait"]), provider: z.enum(["led-scores", "sportlink", "menu"]), title: shortText, subtitle: text.default(""), background: asset.optional(), overlay: z.number().min(0).max(95).default(25), accent: color.default("#03438a"), layout: z.enum(["full", "split", "sidebar"]).default("full"), scale: scale.default(100), align: z.enum(["left", "center", "right"]).default("left"), safeArea: z.number().min(0).max(12).default(4), seconds: z.number().int().min(3).max(120).default(15), rowsPerPage: z.number().int().min(1).max(12).default(8),
  ledTemplate: z.enum(["match-center", "scoreboard"]).default("match-center"), ledTheme: z.enum(["blue", "paper", "fieldflow"]).default("blue"), ledMoment: z.enum(["live", "goal", "lineup", "start", "half", "end"]).default("live"), ledSide: z.enum(["own", "opponent", "unknown"]).default("unknown"), titleScale: scale.default(100), scoreScale: scale.default(100), logoScale: scale.default(100), teamScale: scale.default(100), showBranding: z.boolean().default(true), showSceneLabel: z.boolean().default(true), showClock: z.boolean().default(true), showTimeline: z.boolean().default(true), timelineLimit: z.number().int().min(1).max(10).default(3), backgroundFit: z.enum(["cover", "contain"]).default("contain"), grunge: z.number().min(0).max(100).default(55), animation: z.enum(["none", "fade", "rise", "zoom", "wipe"]).default("rise"),
  ...v17Options
}).strict().superRefine((value, context) => {
  if(value.onzeTrotsStyle !== undefined && (value.provider !== "menu" || !value.menuWidgets))context.addIssue({code:"custom",path:["onzeTrotsStyle"],message:"De actuele OnzeTrots-menustijl vereist menuwidgets."});
  const expectedRevision = value.rendererVersion === sitesCurrentPresentationVersion ? sitesCurrentPresentationSourceRevision : sitesLegacyPresentationSourceRevision;
  if (value.sourceRevision !== expectedRevision) context.addIssue({ code: "custom", path: ["sourceRevision"], message: "Renderer and Source identities must remain paired." });
  if (value.rendererVersion === sitesCurrentPresentationVersion && !value.unifiedKind) context.addIssue({ code: "custom", path: ["unifiedKind"], message: "Sites v17 requires a unified slide family." });
  if(value.menuWidgets !== undefined && value.provider !== "menu")context.addIssue({code:z.ZodIssueCode.custom,path:["menuWidgets"],message:"Menuwidgets vereisen een menubron."});
  if (value.provider === "led-scores" && value.rowsPerPage > 8) context.addIssue({ code: "custom", path: ["rowsPerPage"], message: "LED pages can contain at most eight rows." });
  if (value.provider !== "led-scores" && (value.scale < 70 || value.scale > 140)) context.addIssue({ code: "custom", path: ["scale"], message: "Content scale must be between 70 and 140." });
});

const studioPresentation = z.object({ kind: z.literal("studio"), schemaVersion: z.literal(1), rendererVersion, sourceRevision, slide: sitesStudioSlideSchema }).strict().superRefine((value, context) => {
  const expectedRevision = value.rendererVersion === sitesCurrentPresentationVersion ? sitesCurrentPresentationSourceRevision : sitesLegacyPresentationSourceRevision;
  if (value.sourceRevision !== expectedRevision) context.addIssue({ code: "custom", path: ["sourceRevision"], message: "Renderer and Source identities must remain paired." });
  if (value.rendererVersion === sitesCurrentPresentationVersion && !value.slide.unifiedKind) context.addIssue({ code: "custom", path: ["slide", "unifiedKind"], message: "Sites v17 requires a unified slide family." });
});
export const sitesPresentationSchema = z.union([
  studioPresentation,
  z.object({ kind: z.literal("dynamic"), configuration: sitesDynamicConfigurationSchema, content: sitesTvContentSchema }).strict()
]);

export type SitesAssetReference = z.infer<typeof sitesAssetReferenceSchema>;
export type SitesTvContent = z.infer<typeof sitesTvContentSchema>;
export type SitesStudioSlide = z.infer<typeof sitesStudioSlideSchema>;
export type SitesDynamicConfiguration = z.infer<typeof sitesDynamicConfigurationSchema>;
export type SitesPresentation = z.infer<typeof sitesPresentationSchema>;
export type SitesUnifiedKind = (typeof sitesUnifiedKinds)[number];
