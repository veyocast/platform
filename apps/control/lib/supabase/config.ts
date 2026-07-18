const placeholderMarker = "replace-local";

export type SupabasePublicConfig = {
  anonKey: string;
  url: string;
};

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (
    !url ||
    !anonKey ||
    url.includes(placeholderMarker) ||
    anonKey.includes(placeholderMarker)
  ) {
    return null;
  }

  return { anonKey, url };
}

export function isLiveSupabaseConfigured() {
  return getSupabasePublicConfig() !== null;
}
