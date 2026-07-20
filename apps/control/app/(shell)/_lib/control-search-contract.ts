export type ControlSearchResult = {
  description: string;
  href: string;
  id: string;
  kind: "media" | "playlist" | "release" | "screen" | "tenant";
  label: string;
};
