/* eslint-disable @next/next/no-img-element -- These transient URLs resolve frozen tenant media, including native image/video display. */
import { mediaFrameBackgroundStyle } from "../../../../../../../packages/content-templates/src/media-frame-background";
import type { ContentItem } from "../model";

export function MediaFrameCardPreview({ value, title }: { value: NonNullable<ContentItem["mediaFramePreview"]>; title: string }) {
  const { settings, sourceUrl, backgroundUrl, kind } = value, background = settings.appearance.background;
  if (background.kind === "image" && (!backgroundUrl || !value.backgroundChecksumSha256)) return <span>Voorbeeld niet beschikbaar</span>;
  const style = mediaFrameBackgroundStyle({ schemaVersion: 1, themeId: settings.appearance.themeId, accentColor: settings.appearance.accentColor, background: background.kind === "preset" ? background : { ...background, checksumSha256: value.backgroundChecksumSha256! } }, { image: backgroundUrl, clubmuur: "/assets/clubmuur-wall.webp" });
  const mediaStyle = { width: "100%", height: "100%", objectFit: settings.fitMode, objectPosition: settings.focus };
  return <div style={{ ...style, width: "100%", height: "100%", overflow: "hidden" }}>
    {kind === "image" ? <img src={sourceUrl} alt={title} style={mediaStyle} /> : <video src={sourceUrl} muted playsInline preload="metadata" aria-label={title} style={mediaStyle} />}
  </div>;
}
