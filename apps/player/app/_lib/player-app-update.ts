export const playerVersionHeader = "X-VeyoCast-Player-Version";

export function currentPlayerApplicationVersion() {
  return process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "development";
}

export function shouldReloadPlayerApplication(
  currentVersion: string,
  advertisedVersion: string | null
) {
  const normalizedCurrent = currentVersion.trim();
  const normalizedAdvertised = advertisedVersion?.trim() ?? "";
  return Boolean(
    normalizedAdvertised &&
      normalizedCurrent &&
      normalizedAdvertised !== normalizedCurrent
  );
}
