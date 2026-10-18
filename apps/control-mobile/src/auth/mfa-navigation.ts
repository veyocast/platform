/** MFA may return only to existing internal native routes. */
export function nativeMfaReturnPath(value: string | undefined): string {
  if (value && (/^\/studio(?:\/(?:legacy|designs\/[a-f0-9-]{36}|[a-f0-9-]{36}))?$/i.test(value) || /^\/content\/playlists\/[a-f0-9-]{36}$/i.test(value) || ["/more/security", "/(tabs)/vandaag", "/(tabs)/ontwerpen", "/(tabs)/meer"].includes(value))) return value;
  return "/(tabs)/vandaag";
}
