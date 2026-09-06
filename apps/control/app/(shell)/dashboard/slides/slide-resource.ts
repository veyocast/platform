export type SlideResourceFilter = {
  page: number;
  query: string;
  sort: "created-asc" | "name" | "updated-desc";
  status: "active" | "all" | "concept" | "inactive";
};

export type SlideResourceStatus = Exclude<SlideResourceFilter["status"], "all">;

export function parseSlideResourceFilter(params: {
  page?: string;
  q?: string;
  sort?: string;
  status?: string;
}): SlideResourceFilter {
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  return {
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
  if (status === "active") return "Actief";
  if (status === "inactive") return "Inactief";
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
    filter.status !== "all",
    filter.sort !== "updated-desc"
  ].filter(Boolean).length;
}

export function slidePageHref(
  current: { q?: string; sort?: string; status?: string },
  page: number
) {
  const query = new URLSearchParams();
  if (current.q) query.set("q", current.q);
  if (current.status && current.status !== "all") query.set("status", current.status);
  if (current.sort && current.sort !== "updated-desc") query.set("sort", current.sort);
  if (page > 1) query.set("page", String(page));
  const value = query.toString();
  return value ? `/dashboard/slides?${value}` : "/dashboard/slides";
}
