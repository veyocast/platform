import { hasCapability, type Capability } from "@veyocast/auth";

export const contentReadCapabilities = ["tenant.media.read", "tenant.studio.read", "tenant.dynamic_slide.read"] as const;
export const contentCreateCapabilities = ["tenant.studio.create", "tenant.dynamic_slide.write"] as const;
export const contentEntryCapabilities = [...contentReadCapabilities, ...contentCreateCapabilities, "tenant.media.write"] as const;
export const contentFilters = [["all", "Alles"], ["media", "Media"], ["designs", "Ontwerpen"], ["automatic", "Automatische slides"], ["menus", "Menu’s"], ["series", "Reeksen"]] as const;
export const contentStatuses = [["active", "Actief"], ["attention", "In bewerking"], ["archive", "Archief"]] as const;
export type ContentFilter = typeof contentFilters[number][0] | "slides";
export type ContentStatus = typeof contentStatuses[number][0];
export type ContentLibraryQuery = { query: string; filter: ContentFilter; status: ContentStatus; page: number; size: 24 | 48 };
export const attentionStatuses = ["draft", "uploading", "processing", "rendering", "error", "validation_failed", "quarantined"];
export function contentReadableKinds(capabilities: readonly Capability[]) {
  return [
    ...(hasCapability(capabilities, "tenant.media.read") ? ["media"] : []),
    ...(hasCapability(capabilities, "tenant.studio.read") ? ["studio", "series"] : []),
    ...(hasCapability(capabilities, "tenant.dynamic_slide.read") ? ["dynamic"] : []),
  ];
}
export function parseContentLibraryQuery(params: Record<string, string | string[] | undefined>): ContentLibraryQuery {
  const raw = typeof params.filter === "string" ? params.filter : "all";
  // Old bookmarks used status tabs as filters and `slides` for all non-media.
  const filter = contentFilters.some(([id]) => id === raw) || raw === "slides" ? raw as ContentFilter : "all";
  const status = raw === "archive" || raw === "attention" ? raw : contentStatuses.some(([id]) => id === params.status) ? params.status as ContentStatus : "active";
  return { query: typeof params.q === "string" ? params.q.trim().slice(0, 120) : "", filter, status, page: Math.min(100000, Math.max(1, Math.floor(Number(params.page)) || 1)), size: params.pageSize === "24" ? 24 : 48 };
}
export function contentLibraryHref(state: ContentLibraryQuery, changes: Partial<ContentLibraryQuery> = {}) {
  const next = { ...state, ...changes };
  const params = new URLSearchParams({ filter: next.filter, status: next.status, page: String(next.page) });
  if (next.query) params.set("q", next.query);
  if (next.size !== 48) params.set("pageSize", String(next.size));
  return `/dashboard/content?${params}`;
}

/** Keep unsupported advanced Studio intent in its existing workspace. */
export function legacyStudioIndexHref(params: Record<string, string | undefined>) {
  const advancedKeys = ["format", "fout", "kind", "owner", "sort", "succes", "updated", "view", "viewMode"];
  if (advancedKeys.some(key => params[key]) || (params.status && !["active", "archived"].includes(params.status))) {
    const query = new URLSearchParams({ advanced: "1" });
    for (const key of [...advancedKeys, "q", "status"]) if (params[key]) query.set(key, params[key]!.slice(0, 200));
    return `/dashboard/studio?${query}`;
  }
  return contentLibraryHref(parseContentLibraryQuery({ filter: "designs", q: params.q, status: params.status === "archived" ? "archive" : "active" }));
}

export function contentTypeLabel(kind: string, family: string) {
  if (kind === "media") return family === "video" ? "Video" : "Afbeelding";
  if (kind === "series") return "Reeks";
  if (kind === "dynamic") return ["menu", "price_list"].includes(family) ? "Menu" : "Automatische slide";
  return "Ontwerp";
}
export function isContentRoute(pathname: string) {
  return ["content", "studio", "media", "slides"].some(segment => pathname === `/dashboard/${segment}` || pathname.startsWith(`/dashboard/${segment}/`));
}

/** PostgREST rewrites every LIKE `*` to `%`, even after a backslash.
 * A literal regex avoids that alias while retaining the ordinary LIKE path. */
export function contentSearchPattern(query: string): { operator: "ilike" | "imatch"; value: string } {
  return query.includes("*")
    ? { operator: "imatch", value: query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") }
    : { operator: "ilike", value: `%${query.replace(/[\\%_]/g, "\\$&")}%` };
}
