export function notificationDestination(
  data: Readonly<Record<string, unknown>>
): string | null {
  const screenId =
    typeof data.screenId === "string" && isUuid(data.screenId)
      ? data.screenId
      : null;
  if (screenId) return `/screens/${screenId}`;
  if (data.destination === "content") return "/(tabs)/content";
  if (data.destination === "today") return "/(tabs)/vandaag";
  return null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
