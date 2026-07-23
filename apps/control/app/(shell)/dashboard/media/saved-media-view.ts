export type MediaViewState = {
  favorite?: "true";
  folder?: string;
  from?: string;
  q?: string;
  sort?: "name" | "newest" | "oldest" | "size";
  status?: "processing" | "quarantined" | "ready" | "uploading" | "validation_failed";
  tag?: string;
  to?: string;
  type?: "image" | "video";
  usage?: "unused" | "used";
  view?: "grid";
};

type MediaViewStorage = {
  columnJson: readonly string[];
  density: "comfortable";
  filterJson: Record<string, boolean | number | string | null>;
  sortJson: readonly Readonly<{
    direction: "asc" | "desc";
    field: "created_at" | "file_size_bytes" | "title";
  }>[];
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statusValues = new Set<NonNullable<MediaViewState["status"]>>([
  "processing",
  "quarantined",
  "ready",
  "uploading",
  "validation_failed"
]);
const sortValues = new Set<NonNullable<MediaViewState["sort"]>>([
  "name",
  "newest",
  "oldest",
  "size"
]);

export function mediaViewStateFromSearch(
  input: Readonly<Record<string, string | undefined>>
): MediaViewState {
  const state: MediaViewState = {};
  const query = cleanText(input.q, 120);
  if (query) state.q = query;
  if (input.type === "image" || input.type === "video") state.type = input.type;
  if (input.status && statusValues.has(input.status as NonNullable<MediaViewState["status"]>)) {
    state.status = input.status as NonNullable<MediaViewState["status"]>;
  }
  if (input.usage === "used" || input.usage === "unused") state.usage = input.usage;
  if (input.folder === "root" || (input.folder && uuidPattern.test(input.folder))) {
    state.folder = input.folder;
  }
  if (input.tag && uuidPattern.test(input.tag)) state.tag = input.tag;
  if (input.favorite === "true") state.favorite = "true";
  if (isCalendarDate(input.from)) state.from = input.from;
  if (isCalendarDate(input.to)) state.to = input.to;
  if (input.sort && sortValues.has(input.sort as NonNullable<MediaViewState["sort"]>)) {
    if (input.sort !== "newest") {
      state.sort = input.sort as NonNullable<MediaViewState["sort"]>;
    }
  }
  if (input.view === "grid") state.view = "grid";
  return state;
}

export function parseMediaViewStatePayload(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length > 2_000) return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return mediaViewStateFromSearch(
      Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).flatMap(([key, entry]) =>
          typeof entry === "string" ? [[key, entry]] : []
        )
      )
    );
  } catch {
    return null;
  }
}

export function mediaViewStateToStorage(state: MediaViewState): MediaViewStorage {
  const normalized = mediaViewStateFromSearch(state);
  const sort = sortContract(normalized.sort ?? "newest");

  return {
    columnJson: [],
    density: "comfortable",
    filterJson: {
      createdFrom: normalized.from ?? null,
      createdUntil: normalized.to ?? null,
      favoritesOnly: normalized.favorite === "true",
      folderId: normalized.folder && normalized.folder !== "root"
        ? normalized.folder
        : null,
      kind: normalized.type ?? null,
      layout: normalized.view ?? "list",
      query: normalized.q ?? null,
      rootOnly: normalized.folder === "root",
      schemaVersion: 1,
      status: normalized.status ?? null,
      tagId: normalized.tag ?? null,
      usage: normalized.usage ?? "all"
    },
    sortJson: [sort]
  };
}

export function mediaViewStateFromStorage(
  filterJson: unknown,
  sortJson: unknown
): MediaViewState | null {
  if (!filterJson || typeof filterJson !== "object" || Array.isArray(filterJson)) return null;
  const filters = filterJson as Record<string, unknown>;
  if (filters.schemaVersion !== 1) return null;

  const raw: Record<string, string | undefined> = {
    favorite: filters.favoritesOnly === true ? "true" : undefined,
    folder: filters.rootOnly === true
      ? "root"
      : typeof filters.folderId === "string" ? filters.folderId : undefined,
    from: typeof filters.createdFrom === "string" ? filters.createdFrom : undefined,
    q: typeof filters.query === "string" ? filters.query : undefined,
    sort: sortState(sortJson),
    status: typeof filters.status === "string" ? filters.status : undefined,
    tag: typeof filters.tagId === "string" ? filters.tagId : undefined,
    to: typeof filters.createdUntil === "string" ? filters.createdUntil : undefined,
    type: typeof filters.kind === "string" ? filters.kind : undefined,
    usage: typeof filters.usage === "string" ? filters.usage : undefined,
    view: filters.layout === "grid" ? "grid" : undefined
  };
  return mediaViewStateFromSearch(raw);
}

export function mediaViewStateKey(state: MediaViewState) {
  return JSON.stringify(mediaViewStateFromSearch(state));
}

export function mediaViewHref(state: MediaViewState) {
  const normalized = mediaViewStateFromSearch(state);
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(normalized)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/dashboard/media?${query}` : "/dashboard/media";
}

function cleanText(value: string | undefined, maximum: number) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maximum) : undefined;
}

function isCalendarDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function sortContract(sort: NonNullable<MediaViewState["sort"]>) {
  if (sort === "oldest") return { direction: "asc" as const, field: "created_at" as const };
  if (sort === "name") return { direction: "asc" as const, field: "title" as const };
  if (sort === "size") return { direction: "desc" as const, field: "file_size_bytes" as const };
  return { direction: "desc" as const, field: "created_at" as const };
}

function sortState(value: unknown): NonNullable<MediaViewState["sort"]> | undefined {
  if (!Array.isArray(value) || value.length !== 1) return undefined;
  const entry = value[0];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return undefined;
  const { direction, field } = entry as Record<string, unknown>;
  if (field === "created_at" && direction === "asc") return "oldest";
  if (field === "title" && direction === "asc") return "name";
  if (field === "file_size_bytes" && direction === "desc") return "size";
  if (field === "created_at" && direction === "desc") return "newest";
  return undefined;
}
