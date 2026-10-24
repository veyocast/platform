import { z } from "zod";
import { syncContentFamilies } from "./sync-content-families";
import { syncSystemAssets } from "./sync-system-assets";
import { syncBackgroundAssetForRef } from "./sync-background-catalog";
import {syncOnzeTrotsSystemAssets,syncOnzeTrotsCssAssetPaths} from './sync-onzetrots-assets';
import {createSyncOnzeTrotsRichSchema,syncOnzeTrotsRendererVersion,syncOnzeTrotsSourceRevision,syncOnzeTrotsVisualSchema} from "./sync-onzetrots-presentation";
import {syncOnzeTrotsV9RendererVersion,syncOnzeTrotsV9SourceRevision,syncOnzeTrotsV9AuthoringSchema} from './sync-onzetrots-v9';
export * from './sync-onzetrots-v9';
import {syncOnzeTrotsV9SystemAssets,syncOnzeTrotsV9CssAssetPaths} from './sync-onzetrots-v9-assets';
export * from './sync-onzetrots-v9-assets';
export {syncOnzeTrotsRendererVersion,syncOnzeTrotsSourceRevision} from "./sync-onzetrots-presentation";
export {syncOnzeTrotsMatchdayContextSchema,syncOnzeTrotsSourceScopeSchema} from './sync-onzetrots-presentation';
export {syncOnzeTrotsSystemAssets,syncOnzeTrotsCssAssetPaths} from './sync-onzetrots-assets';

/** Additive identity: legacy Sites documents and release decoders stay unchanged. */
export const syncSlideRendererVersion = "sync-v1" as const;
export const syncSlideSourceRevision =
  "8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a" as const;
const text = z.string().max(400);
const color = z.string().regex(/^#[a-f0-9]{6}$/i);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const legacySystemImagePaths = new Map(
  syncSystemAssets
    .filter((asset) => asset.mimeType.startsWith("image/"))
    .map((asset) => [asset.path as string, asset.sha256 as string]),
);
const systemImagePaths=new Map([...legacySystemImagePaths,...syncOnzeTrotsSystemAssets.filter(asset=>asset.mimeType.startsWith('image/')).map(asset=>[asset.path as string,asset.sha256 as string] as const)]);

const syncSlideAssetReferenceSchema = z
  .discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("system"),
        path: z.string(),
        checksumSha256: sha256,
      })
      .strict(),
    z
      .object({
        kind: z.literal("tenant"),
        mediaAssetId: z.string().uuid(),
        checksumSha256: sha256,
      })
      .strict(),
  ]);
export const syncSlideAssetSchema = syncSlideAssetReferenceSchema.superRefine((asset, context) => {
    if (
      asset.kind === "system" &&
      systemImagePaths.get(asset.path) !== asset.checksumSha256
    ) {
      context.addIssue({
        code: "custom",
        message: "Dit beeld ontbreekt in het geverifieerde Sync-assetmanifest.",
      });
    }
  });
export type SyncSlideAsset = z.infer<typeof syncSlideAssetSchema>;
/** Photographs may be selected as a background; they never become club logos. */
const syncSlideBackgroundAssetSchema = syncSlideAssetReferenceSchema.superRefine((asset, context) => {
  if (asset.kind === "system" && systemImagePaths.get(asset.path) !== asset.checksumSha256 && !syncBackgroundAssetForRef(asset)) {
    context.addIssue({ code: "custom", message: "Kies een geverifieerde achtergrondafbeelding." });
  }
});

const publicUrl = z
  .string()
  .max(2_048)
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Gebruik een publieke HTTPS-link zonder aanmeldgegevens.");
const club = z
  .object({
    name: text,
    team: text.default(""),
    logo: syncSlideAssetSchema.optional(),
  })
  .strict();

/** Only confirmed, policy-filtered poll data belongs in the renderer. No demo store. */
const pollOption = z.object({
  id: z.string().uuid(),
  label: text,
  votes: z.number().int().min(0).max(1_000_000_000),
}).strict();
const pollFields = {
    id: z.string().uuid(),
    title: text,
    status: z.enum(["draft", "scheduled", "live", "closed", "archived"]),
    visibility: z.enum(["live", "after_vote", "after_close"]),
    publicUrl: publicUrl.optional(),
    options: z.array(pollOption).min(2).max(12),
};
/** Unmarked immutable polls keep their original single-page timing. Every new
 * selected campaign freezes four readable choices per page, without dropping
 * any of the campaign's twenty-four possible answers. */
const poll = z.union([
  z.object(pollFields).strict(),
  z.object({
    ...pollFields,
    optionsPerPage: z.literal(4),
    options: z.array(pollOption.extend({ label: z.string().max(160) })).min(2).max(24),
  }).strict(),
])
  .superRefine((value, context) => {
    const visible =
      (value.visibility === "live" &&
        ["live", "closed", "archived"].includes(value.status)) ||
      (["closed", "archived"].includes(value.status) &&
        value.visibility === "after_close");
    if (!visible && value.options.some((option) => option.votes !== 0))
      context.addIssue({
        code: "custom",
        message:
          "Niet-publieke stemmen mogen niet in het schermdocument staan.",
      });
    if (
      new Set(value.options.map((option) => option.id.toLowerCase())).size !==
      value.options.length
    )
      context.addIssue({
        code: "custom",
        message: "Antwoord-ID’s moeten uniek zijn.",
      });
  });
export const syncSlidePollSchema=poll;

/** The Source's visual model, independent of authoring and provider transport. */
const syncSlideBaseSchema = z
  .object({
    schemaVersion: z.literal(1),
    rendererVersion: z.literal(syncSlideRendererVersion),
    sourceRevision: z.literal(syncSlideSourceRevision),
    family: z.enum(syncContentFamilies.map((family) => family.id)),
    orientation: z.enum(["landscape", "portrait"]),
    theme: z.enum(["fieldflow", "onzetrots-tv"]),
    name: text,
    club: z
      .object({
        name: text,
        tagline: text.default(""),
        logo: syncSlideAssetSchema.optional(),
      })
      .strict(),
    title: text,
    headline: text.default(""),
    body: z.string().max(4_000).default(""),
    subtitle: text.default(""),
    topLabel: text.default("CLUB TV"),
    footer: text.default(""),
    footerRight: text.default(""),
    home: club.optional(),
    away: club.optional(),
    match: z
      .object({
        homeScore: z.string().max(10).default(""),
        awayScore: z.string().max(10).default(""),
        clock: z.string().max(40).default(""),
        date: text.default(""),
        time: z.string().max(40).default(""),
      })
      .strict()
      .optional(),
    rows: z
      .array(z.tuple([text, text, text, text]))
      .max(200)
      .default([]),
    rowsPerPage: z.number().int().min(1).max(8).default(4),
    ownRowIndexes: z
      .array(z.number().int().min(0).max(199))
      .max(200)
      .default([]),
    category: text.default(""),
    subline: text.default(""),
    special: z
      .object({
        label: text,
        title: text,
        priceCents: z.number().int().min(0).max(100_000_000),
      })
      .strict()
      .optional(),
    lineup: z
      .array(z.array(z.number().int().min(1).max(99)).min(1).max(11))
      .max(11)
      .default([]),
    news: z
      .array(
        z
          .object({
            title: text,
            intro: z.string().max(4_000),
            source: text,
            url: publicUrl.optional(),
          })
          .strict(),
      )
      .max(50)
      .default([]),
    imageCaption: text.default(""),
    youtubeUrl: publicUrl
      .refine((value) => {
        const url = new URL(value);
        return (
          ["youtube.com", "www.youtube.com", "youtu.be"].includes(
            url.hostname,
          ) && !url.port
        );
      }, "Gebruik een YouTube-link.")
      .optional(),
    poll: poll.optional(),
    state: z.enum(["ready", "empty", "error"]).default("ready"),
    style: z
      .object({
        motion: z.enum(["rustig","dynamisch","geen"]).optional(),
        background: z
          .enum(["stadium", "gradient", "stripes", "clubmuur", "light", "photo"])
          .default("stadium"),
        backgroundAsset: syncSlideBackgroundAssetSchema.optional(),
        backgroundPosition: z
          .enum(["center", "top", "bottom", "left", "right"])
          .default("center"),
        font: z
          .enum([
            "Inter, sans-serif",
            "Inter",
            "Manrope",
            "Arial",
            "Brush",
            "Condensed",
            "Serif",
          ])
          .default("Inter, sans-serif"),
        fontChanged: z.boolean().default(false),
        accent: color.default("#1763ed"),
        alignment: z.enum(["left", "center", "right"]).default("left"),
        scale: z.number().min(50).max(150).default(100),
        safeMargin: z.number().min(2).max(15).default(5),
        showLogo: z.boolean().default(true),
        showFooter: z.boolean().default(true),
      })
      .strict(),
  })
  .strict();

function refineSyncSlide(slide:Pick<z.infer<typeof syncSlideBaseSchema>,"style"|"ownRowIndexes"|"rows"|"family"|"poll">,context:z.RefinementCtx){
    if (syncBackgroundAssetForRef(slide.style.backgroundAsset) && slide.style.background !== "photo")
      context.addIssue({
        code: "custom",
        path: ["style", "background"],
        message: "Gebruik de fotoachtergrond bij deze afbeelding.",
      });
    if (slide.style.background === "photo" && !slide.style.backgroundAsset)
      context.addIssue({
        code: "custom",
        path: ["style", "backgroundAsset"],
        message: "Kies een geverifieerde achtergrondafbeelding.",
      });
    if (slide.ownRowIndexes.some((index) => index >= slide.rows.length))
      context.addIssue({
        code: "custom",
        path: ["ownRowIndexes"],
        message: "De gemarkeerde rij bestaat niet.",
      });
    if (slide.family !== "engage" && slide.poll)
      context.addIssue({
        code: "custom",
        path: ["poll"],
        message: "Publieksacties horen bij hun eigen slidefamilie.",
      });
}
export const syncLegacySlidePresentationSchema=syncSlideBaseSchema.superRefine((slide,context)=>{
 refineSyncSlide(slide,context);
 for(const asset of [slide.club.logo,slide.home?.logo,slide.away?.logo,slide.style.backgroundAsset]){
  if(asset?.kind==='system'&&!legacySystemImagePaths.has(asset.path)&&!syncBackgroundAssetForRef(asset))
   context.addIssue({code:'custom',message:'Gebruik de geverifieerde assets van de oorspronkelijke renderer.'});
 }
});
const syncOnzeTrotsSlideBaseSchema=syncSlideBaseSchema.extend({
 rendererVersion:z.literal(syncOnzeTrotsRendererVersion),sourceRevision:z.literal(syncOnzeTrotsSourceRevision),
 theme:z.literal("onzetrots-tv"),visual:syncOnzeTrotsVisualSchema,
 rowsPerPage:z.number().int().min(1).max(8).default(6),
 rich:createSyncOnzeTrotsRichSchema(syncSlideAssetSchema).optional(),
});
function refineSyncOnzeTrotsSlide(slide:Omit<z.infer<typeof syncOnzeTrotsSlideBaseSchema>,"rendererVersion"|"sourceRevision">,context:z.RefinementCtx){
 refineSyncSlide(slide,context);
 const arrays=[slide.rich?.standings?.rows,slide.rich?.fixtures,slide.rich?.birthdays,slide.rich?.activities,slide.rich?.news,slide.rich?.sponsors,slide.rich?.infoRows,slide.rich?.matchday?.results,slide.rich?.matchday?.standings.rows,slide.rich?.matchday?.fixtures];
 for(const rows of arrays){if(rows&&new Set(rows.map(row=>row.id)).size!==rows.length)context.addIssue({code:"custom",path:["rich"],message:"Bronrecords moeten unieke stabiele identiteiten hebben."});}
 for(const standing of [slide.rich?.standings,slide.rich?.matchday?.standings]){
  const teams=standing?.rows.flatMap(row=>row.teamId?[row.teamId]:[])??[];
  if(new Set(teams).size!==teams.length)context.addIssue({code:'custom',path:['rich'],message:'Een gecontroleerd team mag maar één ranglijstrij hebben.'});
 }
 const assets=new Map<string,string>();
 const inspect=(node:unknown)=>{
  if(!node||typeof node!=='object')return;
  if('kind' in node&&(node.kind==='system'||node.kind==='tenant')&&'checksumSha256' in node){
   const ref=node as SyncSlideAsset,key=ref.kind==='system'?`system:${ref.path}`:`tenant:${ref.mediaAssetId}`,before=assets.get(key);
   if(before&&before!==ref.checksumSha256)context.addIssue({code:'custom',path:['rich'],message:'Dezelfde afbeelding heeft conflicterende controlesommen.'});
   assets.set(key,ref.checksumSha256);return;
  }
  for(const value of Object.values(node))inspect(value);
 };inspect(slide);
}
export const syncOnzeTrotsSlidePresentationSchema=syncOnzeTrotsSlideBaseSchema.superRefine(refineSyncOnzeTrotsSlide);
export const syncOnzeTrotsV9SlidePresentationSchema=syncOnzeTrotsSlideBaseSchema.extend({
 rendererVersion:z.literal(syncOnzeTrotsV9RendererVersion),sourceRevision:z.literal(syncOnzeTrotsV9SourceRevision),
 authoring:syncOnzeTrotsV9AuthoringSchema.default({schemaVersion:1,headerSubtitles:{},headerTexts:{},welcomeScalePercent:150}),
}).superRefine(refineSyncOnzeTrotsSlide);
export const syncSlidePresentationSchema=z.discriminatedUnion("rendererVersion",[syncLegacySlidePresentationSchema,syncOnzeTrotsSlidePresentationSchema,syncOnzeTrotsV9SlidePresentationSchema]);
export type SyncSlidePresentation = z.infer<typeof syncSlidePresentationSchema>;
export type SyncOnzeTrotsV9Presentation=z.infer<typeof syncOnzeTrotsV9SlidePresentationSchema>;
export type SyncOnzeTrotsPresentation=z.infer<typeof syncOnzeTrotsSlidePresentationSchema>|SyncOnzeTrotsV9Presentation;
export function isSyncOnzeTrotsPresentation(slide:Pick<SyncSlidePresentation,'rendererVersion'>|null|undefined):slide is SyncOnzeTrotsPresentation{
 return slide?.rendererVersion===syncOnzeTrotsRendererVersion||slide?.rendererVersion===syncOnzeTrotsV9RendererVersion;
}
export function syncOnzeTrotsHeaderSubtitle(slide:SyncOnzeTrotsV9Presentation):string{
 return slide.authoring.headerSubtitles[slide.family]??`${slide.club.name} · ${syncContentFamilies.find(family=>family.id===slide.family)?.group??''}`.slice(0,120);
}
export function syncOnzeTrotsHeaderText(slide:SyncOnzeTrotsV9Presentation):string{
 const label=syncContentFamilies.find(family=>family.id===slide.family)!.label;
 return slide.authoring.headerTexts[slide.family]??label.replaceAll('DUINDORP SV',slide.club.name.toUpperCase()).replaceAll('HOUTRUST',slide.club.name.toUpperCase()).slice(0,120);
}
export type SyncOnzeTrotsRich=NonNullable<SyncOnzeTrotsPresentation['rich']>;

/** Source Studio's 400 ms page entrance, shared by editor, export and Player. */
export function syncSlideTransition(slide:SyncSlidePresentation){
  return slide.rendererVersion===syncOnzeTrotsV9RendererVersion||!slide.style.motion||slide.style.motion==='geen'?null:{durationMs:400,offsetPx:slide.style.motion==='dynamisch'?14:5,easing:'ease-out' as const};
}

/** A useful poster must include the complete v7 content, not the background
 * gap immediately before the header. Historical poster timing is unchanged. */
export function syncSlidePosterTimeMs(slide:SyncSlidePresentation,durationMs:number){
 const firstPageMs=durationMs/syncSlidePageCount(slide);
 return slide.rendererVersion===syncOnzeTrotsV9RendererVersion?Math.min(4000,Math.max(0,firstPageMs-1)):Math.min(1200,Math.max(0,durationMs-1));
}

/** Logical geometry from the approved cascade. This is a duration bound, not a
 * substitute for measuring the actual browser viewport for frame projection. */
export function syncSlideInternalMotion(slide:SyncSlidePresentation){
 if(!isSyncOnzeTrotsPresentation(slide))return {enabled:false,minimumMs:3000};
 const phased=slide.rendererVersion===syncOnzeTrotsV9RendererVersion&&slide.style.motion!=='geen',introMinimum=phased?4000:3000;
 if(slide.family==='goal')return {enabled:true,minimumMs:introMinimum};
 const dashboard=slide.family==='matchday',rank=dashboard||['standings','period-standings'].includes(slide.family);
 if(!rank)return {enabled:phased,minimumMs:introMinimum};
 const portrait=slide.orientation==='portrait';
 const count=dashboard?slide.rich?.matchday?.standings.rows.length??0:slide.rich?.standings?.rows.length??slide.rows.length;
 const rowHeight=dashboard?(portrait?78:67):(portrait?100:72);
 const viewport=slide.rendererVersion===syncOnzeTrotsV9RendererVersion?(dashboard?(portrait?492:385):(portrait?1142:483)):(dashboard?(portrait?646:527):(portrait?1193:524));
 const range=Math.max(0,count*rowHeight-viewport);
 if(!range)return {enabled:phased,minimumMs:introMinimum};
 const speed={slow:19,normal:30,fast:48}[slide.visual.scrollSpeed];
 return {enabled:true,minimumMs:Math.max(introMinimum,Math.ceil(5000+2000*range/speed))};
}

export function syncSlideMinimumDurationMs(slide:SyncSlidePresentation){
 const pages=syncSlidePageCount(slide);
 return pages*Math.ceil(Math.max(3000,syncSlideInternalMotion(slide).minimumMs)/1000)*1000;
}

export function syncSlideDurationMs(slide:SyncSlidePresentation,secondsPerPage:number){
 return Math.max(syncSlidePageCount(slide)*secondsPerPage*1000,syncSlideMinimumDurationMs(slide));
}

/** Local form recovery only. Incomplete URLs and photo selections remain editable.
 * Never use this schema at a writer, renderer, publication or provider boundary. */
const syncLegacySlideDraftInputSchema = z
  .object({
    ...syncLegacySlidePresentationSchema.shape,
    youtubeUrl: z.string().max(2048).optional(),
    news: z
      .array(
        z
          .object({
            ...syncLegacySlidePresentationSchema.shape.news.unwrap().element.shape,
            url: z.string().max(2048).optional(),
          })
          .strict(),
      )
      .max(50)
      .default([]),
  })
  .strict();

export const syncSlideDraftInputSchema=z.discriminatedUnion("rendererVersion",[
 syncLegacySlideDraftInputSchema,
 z.object({...syncOnzeTrotsSlidePresentationSchema.shape,youtubeUrl:z.string().max(2048).optional(),news:syncLegacySlideDraftInputSchema.shape.news}).strict(),
 z.object({...syncOnzeTrotsV9SlidePresentationSchema.shape,youtubeUrl:z.string().max(2048).optional(),news:syncLegacySlideDraftInputSchema.shape.news}).strict(),
]);

/** Editors may hold incomplete URL text, but can never mix renderer/source
 * identities through a spread of union-shaped patches. */
export function patchSyncSlideDraft(slide:SyncSlidePresentation,patch:Partial<SyncSlidePresentation>):SyncSlidePresentation{
 return syncSlideDraftInputSchema.parse({...slide,...patch,rendererVersion:slide.rendererVersion,sourceRevision:slide.sourceRevision});
}

/** A playlist override cannot reinterpret a version-bound rich document.
 * Its verified binary/original presentation remains the visible authority. */
export function syncSlidePlacementTheme(slide:SyncSlidePresentation,theme:SyncSlidePresentation['theme']|undefined):SyncSlidePresentation{
 return isSyncOnzeTrotsPresentation(slide)?slide:{...slide,theme:theme??slide.theme};
}

export function syncSlidePageCount(slide: SyncSlidePresentation): number {
  if(isSyncOnzeTrotsPresentation(slide)){
    if(["standings","period-standings","matchday","visitors","welcome"].includes(slide.family))return 1;
    if(slide.family==="birthdays")return Math.max(1,Math.ceil((slide.rich?.birthdays?.length??slide.rows.length)/6));
    if(["activities","agenda"].includes(slide.family))return Math.max(1,Math.ceil((slide.rich?.activities?.length??slide.rows.length)/6));
    if(["rss","club-story"].includes(slide.family)&&slide.rich?.news)return Math.max(1,slide.rich.news.length);
    if(slide.family==="menu")return Math.max(1,Math.ceil(slide.rows.length/10));
    if(slide.family==="sponsors")return Math.max(1,Math.ceil((slide.rich?.sponsors?.length??slide.rows.length)/6));
    if(['fixtures','club-program','team-program','pool-program','results','club-results','team-results','pool-results'].includes(slide.family))return Math.max(1,Math.ceil((slide.rich?.fixtures?.length??slide.rows.length)/(slide.orientation==='portrait'?5:6)));
    if(slide.rich?.infoRows)return Math.max(1,Math.ceil(slide.rich.infoRows.length/slide.rowsPerPage));
    if(slide.rich?.fixtures)return Math.max(1,Math.ceil(slide.rich.fixtures.length/(slide.orientation==="portrait"?5:6)));
  }
  if (slide.family === "engage" && slide.poll && "optionsPerPage" in slide.poll)
    return Math.max(1, Math.ceil(slide.poll.options.length / slide.poll.optionsPerPage));
  return slide.family === "rss"
    ? Math.max(1, slide.news.length)
    : Math.max(1, Math.ceil(slide.rows.length / slide.rowsPerPage));
}

export function syncSlideAssets(
  slide: SyncSlidePresentation,
): SyncSlideAsset[] {
  const assets = [
    slide.club.logo,
    slide.home?.logo,
    slide.away?.logo,
    slide.style.backgroundAsset,
  ].filter((asset): asset is SyncSlideAsset => Boolean(asset));
  if(isSyncOnzeTrotsPresentation(slide)&&slide.rich){
    const visit=(value:unknown)=>{
      if(!value||typeof value!=="object")return;
      if("kind" in value&&(value.kind==="tenant"||value.kind==="system")){assets.push(syncSlideAssetSchema.parse(value));return;}
      for(const child of Object.values(value))visit(child);
    };
    visit(slide.rich);
  }
  return [
    ...new Map(
      assets.map((asset) => [
        asset.kind === "system" ? asset.path : asset.mediaAssetId,
        asset,
      ]),
    ).values(),
  ];
}

/** Renderer bytes and content references form one version-bound dependency set.
 * Historical documents retain the exact original eleven renderer assets. */
export function syncSlideRendererAssets(slide:SyncSlidePresentation):ReadonlyArray<{path:string;sha256:string;bytes:number;mimeType:string}>{
 if(!isSyncOnzeTrotsPresentation(slide))return syncSystemAssets;
 const manifest=slide.rendererVersion===syncOnzeTrotsV9RendererVersion?syncOnzeTrotsV9SystemAssets:syncOnzeTrotsSystemAssets;
 const selected=new Set<string>(slide.rendererVersion===syncOnzeTrotsV9RendererVersion?syncOnzeTrotsV9CssAssetPaths:syncOnzeTrotsCssAssetPaths);
 for(const asset of syncSlideAssets(slide))if(asset.kind==='system')selected.add(asset.path);
 // The approved backdrop is also required when a hand-authored document has
 // not selected an explicit gallery image yet.
 if(!slide.style.backgroundAsset)selected.add(`/onzetrots-approved-v1/assets/clubmuur-brush-v25/houtrust-${slide.orientation==='portrait'?'portrait-941':'wide-1672'}.webp`);
 const background=syncBackgroundAssetForRef(slide.style.backgroundAsset);
 const marker=slide.rendererVersion===syncOnzeTrotsV9RendererVersion&&slide.style.fontChanged&&slide.style.font==='Brush'?syncOnzeTrotsSystemAssets.filter(asset=>asset.path==='/onzetrots-approved-v1/assets/fonts/club-font-9.ttf'):[];
 return [...manifest.filter(asset=>selected.has(asset.path)),...syncSystemAssets.filter(asset=>selected.has(asset.path)),...marker,...(background?[background]:[])];
}

/** Explicit unsaved authoring upgrade. Never apply to immutable playback input. */
export function syncOnzeTrotsMarkerDraft(slide:SyncSlidePresentation):SyncSlidePresentation{
 return slide.rendererVersion===syncOnzeTrotsV9RendererVersion?{...slide,authoring:{...slide.authoring,visualRevision:'onzetrots-20261024'},style:{...slide.style,font:'Brush',fontChanged:true}}:slide;
}

/** One semantic visual contract across authoring, capture and playback. */
export function isSyncOnzeTrotsCurrent(slide:Pick<SyncSlidePresentation,'rendererVersion'> & {authoring?:{visualRevision?:string|undefined}|undefined}):boolean {
 return slide.rendererVersion===syncOnzeTrotsV9RendererVersion&&slide.authoring?.visualRevision==='onzetrots-20261024';
}

/** Same controlled sport records in preview, capture and device manifests. */
export function collectSyncSportMediaAssetIds(snapshot:Record<string,unknown>):string[]{
 const ids=new Set<string>();
 const record=(value:unknown):value is Record<string,unknown>=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
 const sport=record(snapshot.sport)?snapshot.sport:{};
 const matchday=record(sport.matchday)?sport.matchday:{};
 for(const part of [sport,...['results','standings','fixtures'].map(key=>matchday[key])]){
  if(!record(part)||!Array.isArray(part.items))continue;
  for(const row of part.items.slice(0,200))if(record(row))for(const key of ['logoMediaAssetId','homeLogoMediaAssetId','awayLogoMediaAssetId','photoMediaAssetId']){
   const value=row[key];if(typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value))ids.add(value);
  }
 }
 return [...ids];
}

/** Empty controlled welcome content is ineligible, including an offline
 * kickoff that has passed since the snapshot was prepared. */
export function syncOnzeTrotsWelcomeShouldSkip(slide:SyncSlidePresentation|undefined,at=Date.now()):boolean{
 if(!slide||!isSyncOnzeTrotsCurrent(slide)||!['welcome','visitors'].includes(slide.family)||!isSyncOnzeTrotsPresentation(slide))return false;
 const selection=slide.rich?.visitorsSelection;if(!selection)return true;
 return !(slide.rich?.fixtures??[]).some(fixture=>{
  const kickoff=Date.parse(fixture.kickoffAt??'');
  return fixture.status==='scheduled'&&fixture.home.clubId===selection.ownClubId&&fixture.home.teamId!==null
   &&selection.ownTeamIds.includes(fixture.home.teamId)&&kickoff>at
   &&(selection.windowMinutes===undefined||kickoff<=at+selection.windowMinutes*60000);
 });
}
