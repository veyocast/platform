export type MediaPreviewOrientation =
  | "landscape"
  | "portrait"
  | "square"
  | "unknown";

export function resolveMediaPreviewGeometry(
  width: number | null | undefined,
  height: number | null | undefined
) {
  const hasDimensions =
    typeof width === "number" &&
    width > 0 &&
    typeof height === "number" &&
    height > 0;

  if (!hasDimensions) {
    return {
      aspectRatio: undefined,
      label: null,
      orientation: "unknown" as const
    };
  }

  const orientation: Exclude<MediaPreviewOrientation, "unknown"> =
    height > width ? "portrait" : width > height ? "landscape" : "square";

  return {
    aspectRatio: `${width} / ${height}`,
    label: `${width} × ${height} · ${
      orientation === "portrait"
        ? "Staand"
        : orientation === "landscape"
          ? "Liggend"
          : "Vierkant"
    }`,
    orientation
  };
}
