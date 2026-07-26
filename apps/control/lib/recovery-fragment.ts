export type RecoveryFragmentSession = Readonly<{
  accessToken: string;
  refreshToken: string;
}>;

export function parseRecoveryFragment(
  fragment: string
): RecoveryFragmentSession | null {
  const value = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  const params = new URLSearchParams(value);

  if (params.get("type") !== "recovery") return null;

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;

  return { accessToken, refreshToken };
}
