import { z } from "zod";
import { syncContentFamilies } from "./sync-content-families";
import { syncSystemAssets } from "./sync-system-assets";

/** Additive identity: legacy Sites documents and release decoders stay unchanged. */
export const syncSlideRendererVersion = "sync-v1" as const;
export const syncSlideSourceRevision =
  "8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a" as const;
const text = z.string().max(400);
const color = z.string().regex(/^#[a-f0-9]{6}$/i);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const systemImagePaths = new Map(
  syncSystemAssets
    .filter((asset) => asset.mimeType.startsWith("image/"))
    .map((asset) => [asset.path as string, asset.sha256 as string]),
);

export const syncSlideAssetSchema = z
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
  ])
  .superRefine((asset, context) => {
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
const poll = z
  .object({
    id: z.string().uuid(),
    title: text,
    status: z.enum(["draft", "scheduled", "live", "closed", "archived"]),
    visibility: z.enum(["live", "after_vote", "after_close"]),
    publicUrl: publicUrl.optional(),
    options: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            label: text,
            votes: z.number().int().min(0).max(1_000_000_000),
          })
          .strict(),
      )
      .min(2)
      .max(12),
  })
  .strict()
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

/** The Source's visual model, independent of authoring and provider transport. */
export const syncSlidePresentationSchema = z
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
        backgroundAsset: syncSlideAssetSchema.optional(),
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
  .strict()
  .superRefine((slide, context) => {
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
  });
export type SyncSlidePresentation = z.infer<typeof syncSlidePresentationSchema>;

/** Source Studio's 400 ms page entrance, shared by editor, export and Player. */
export function syncSlideTransition(slide:SyncSlidePresentation){
  return !slide.style.motion||slide.style.motion==='geen'?null:{durationMs:400,offsetPx:slide.style.motion==='dynamisch'?14:5,easing:'ease-out' as const};
}

/** Local form recovery only. Incomplete URLs and photo selections remain editable.
 * Never use this schema at a writer, renderer, publication or provider boundary. */
export const syncSlideDraftInputSchema = z
  .object({
    ...syncSlidePresentationSchema.shape,
    youtubeUrl: z.string().max(2048).optional(),
    news: z
      .array(
        z
          .object({
            ...syncSlidePresentationSchema.shape.news.unwrap().element.shape,
            url: z.string().max(2048).optional(),
          })
          .strict(),
      )
      .max(50)
      .default([]),
  })
  .strict();

export function syncSlidePageCount(slide: SyncSlidePresentation): number {
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
  return [
    ...new Map(
      assets.map((asset) => [
        asset.kind === "system" ? asset.path : asset.mediaAssetId,
        asset,
      ]),
    ).values(),
  ];
}
