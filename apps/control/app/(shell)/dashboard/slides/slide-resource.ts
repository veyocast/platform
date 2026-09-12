export const slideTypeFilters = [
  ["all", "Alle typen"], ["sport_program", "Programma"], ["sport_results", "Uitslagen"],
  ["sport_standing", "Standen"], ["sport_visitor_arrivals", "Welkom teams"],
  ["sport_referee_arrivals", "Welkom scheidsrechters"], ["sport_birthdays", "Jarigen"],
  ["news", "Nieuws"], ["price_list", "Menu en prijzen"]
] as const;

export type SlideResourceFilter = {
  kind: string;
  page: number;
  query: string;
  sort: "created-asc" | "name" | "updated-desc";
  status: "active" | "all" | "concept" | "inactive";
};

export type SlideResourceStatus = Exclude<SlideResourceFilter["status"], "all">;

export function parseSlideResourceFilter(params: {
  kind?: string;
  page?: string;
  q?: string;
  sort?: string;
  status?: string;
}): SlideResourceFilter {
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  return {
    kind: slideTypeFilters.some(([kind]) => kind === params.kind) ? params.kind! : "all",
    page: Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    query: params.q?.trim().slice(0, 120) ?? "",
    sort: params.sort === "name" || params.sort === "created-asc"
      ? params.sort
      : "updated-desc",
    status: params.status === "active" || params.status === "concept" || params.status === "inactive"
      ? params.status
      : "all"
  };
}

export function slideResourceStatus(
  status: string,
  hasPublishedVersion = status === "ready"
): SlideResourceStatus {
  if (status === "archived") return "inactive";
  if (hasPublishedVersion) return "active";
  return "concept";
}

export function slideResourceStatusLabel(status: SlideResourceStatus) {
  if (status === "active") return "Gepubliceerd";
  if (status === "inactive") return "Gearchiveerd";
  return "Concept";
}

export function slideResourceStatusTone(status: SlideResourceStatus) {
  if (status === "active") return "success" as const;
  if (status === "inactive") return "neutral" as const;
  return "warning" as const;
}

export function slideFilterCount(filter: SlideResourceFilter) {
  return [
    Boolean(filter.query),
    filter.kind !== "all",
    filter.status !== "all",
    filter.sort !== "updated-desc"
  ].filter(Boolean).length;
}

export function slidePageHref(
  current: { kind?: string; q?: string; sort?: string; status?: string },
  page: number
) {
  const query = new URLSearchParams();
  if (current.kind && current.kind !== "all") query.set("kind", current.kind);
  if (current.q) query.set("q", current.q);
  if (current.status && current.status !== "all") query.set("status", current.status);
  if (current.sort && current.sort !== "updated-desc") query.set("sort", current.sort);
  if (page > 1) query.set("page", String(page));
  const value = query.toString();
  return value ? `/dashboard/slides?${value}` : "/dashboard/slides";
}
