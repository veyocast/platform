const exactFieldflowRedirects = Object.freeze({
  "/dashboard/auditlog": "/dashboard/activity",
  "/dashboard/data-sources": "/dashboard/sources",
  "/dashboard/data-sources/led-scores": "/dashboard/sources/led-scores",
  "/dashboard/data-sources/sportlink": "/dashboard/sources/sportlink",
  "/dashboard/integrations": "/dashboard/sources",
  "/dashboard/integrations/twelve-products": "/dashboard/sources/twelve/products",
  "/dashboard/integrations/youtube": "/dashboard/sources/youtube",
  "/dashboard/products": "/dashboard/sources/twelve/products",
  "/dashboard/releases": "/dashboard/publications",
  "/dashboard/screen-groups": "/dashboard/screens/groups",
  "/dashboard/templates": "/dashboard/playlist-templates",
  "/platform/users": "/platform/access/users"
} satisfies Record<string, string>);

const dynamicFieldflowRedirects = [
  {
    from: /^\/dashboard\/integrations\/twelve-products\/imports\/([^/]+)\/?$/,
    to: (match: RegExpMatchArray) => `/dashboard/sources/twelve/imports/${match[1]}`
  },
  {
    from: /^\/dashboard\/products\/imports\/([^/]+)\/?$/,
    to: (match: RegExpMatchArray) => `/dashboard/sources/twelve/imports/${match[1]}`
  },
  {
    from: /^\/dashboard\/releases\/([^/]+)\/?$/,
    to: (match: RegExpMatchArray) => `/dashboard/publications/${match[1]}`
  }
] as const;

export function resolveFieldflowRedirect(pathname: string) {
  const exact = exactFieldflowRedirects[pathname as keyof typeof exactFieldflowRedirects];
  if (exact) return exact;

  for (const redirect of dynamicFieldflowRedirects) {
    const match = pathname.match(redirect.from);
    if (match) return redirect.to(match);
  }
  return null;
}
