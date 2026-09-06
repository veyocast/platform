import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import {
  slideResourceStatus,
  type SlideResourceFilter
} from "./slide-resource";

export const slideResourcePageSize = 25;

export type SlidePlaylistOption = {
  id: string;
  name: string;
};

export type SlideResourceRow = {
  createdAt: string;
  currentVersionNumber: number | null;
  dataLabel: string;
  editHref: string;
  id: string;
  itemCount: number;
  name: string;
  orientationLabel: string;
  resourceStatus: "active" | "concept" | "inactive";
  selectionLabel: string;
  slideTypeLabel: string;
  technicalStatus: string;
  updatedAt: string;
};

export type SlideResourceData = {
  counts: {
    active: number;
    concept: number;
    inactive: number;
    total: number;
  };
  error: string | null;
  page: number;
  pageCount: number;
  playlists: SlidePlaylistOption[];
  rows: SlideResourceRow[];
  total: number;
};

type SlideRow = {
  active_draft_version_id: string | null;
  configuration_json: unknown;
  created_at: string;
  current_published_version_id: string | null;
  current_snapshot_id: string | null;
  id: string;
  last_error_code: string | null;
  name: string;
  orientation: string;
  selection_mode: string;
  slide_type: string;
  status: string;
  updated_at: string;
};

export async function loadSlideResources(
  tenantId: string,
  filter: SlideResourceFilter
): Promise<SlideResourceData> {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return emptySlideResourceData("De beveiligde datasessie ontbreekt. Log opnieuw in en laad de slides opnieuw.");

  let totalRequest = supabase
    .from("dynamic_slides")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  const escapedQuery = filter.query.replace(/[\\%_]/g, (value) => `\\${value}`);
  if (filter.query) totalRequest = totalRequest.ilike("name", `%${escapedQuery}%`);
  if (filter.status === "active") totalRequest = totalRequest
    .neq("status", "archived")
    .not("current_published_version_id", "is", null);
  if (filter.status === "inactive") totalRequest = totalRequest.eq("status", "archived");
  if (filter.status === "concept") totalRequest = totalRequest
    .neq("status", "archived")
    .is("current_published_version_id", null);
  const [totalResult, activeResult, conceptResult, inactiveResult, playlistsResult] = await Promise.all([
    totalRequest,
    supabase.from("dynamic_slides").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).neq("status", "archived").not("current_published_version_id", "is", null),
    supabase.from("dynamic_slides").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).neq("status", "archived").is("current_published_version_id", null),
    supabase.from("dynamic_slides").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "archived"),
    supabase
      .from("playlists")
      .select("id,name")
      .eq("tenant_id", tenantId)
      .neq("status", "archived")
      .order("name")
      .limit(250)
  ]);
  if (totalResult.error || activeResult.error || conceptResult.error || inactiveResult.error || playlistsResult.error) {
    console.error("Slide-resourceoverzicht laden mislukt", {
      code: totalResult.error?.code ?? activeResult.error?.code ?? conceptResult.error?.code ?? inactiveResult.error?.code ?? playlistsResult.error?.code
    });
    return emptySlideResourceData(
      "De slides konden niet volledig worden gelezen. Er is niets gewijzigd; vernieuw de pagina of log opnieuw in."
    );
  }

  const total = totalResult.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / slideResourcePageSize));
  const page = Math.min(filter.page, pageCount);
  let rowsQuery = supabase
    .from("dynamic_slides")
    .select("id,name,slide_type,orientation,selection_mode,status,current_snapshot_id,current_published_version_id,active_draft_version_id,last_error_code,configuration_json,created_at,updated_at")
    .eq("tenant_id", tenantId);
  if (filter.query) rowsQuery = rowsQuery.ilike("name", `%${escapedQuery}%`);
  if (filter.status === "active") rowsQuery = rowsQuery
    .neq("status", "archived")
    .not("current_published_version_id", "is", null);
  if (filter.status === "inactive") rowsQuery = rowsQuery.eq("status", "archived");
  if (filter.status === "concept") rowsQuery = rowsQuery
    .neq("status", "archived")
    .is("current_published_version_id", null);
  if (filter.sort === "name") {
    rowsQuery = rowsQuery.order("name").order("id");
  } else if (filter.sort === "created-asc") {
    rowsQuery = rowsQuery.order("created_at").order("id");
  } else {
    rowsQuery = rowsQuery.order("updated_at", { ascending: false }).order("id");
  }
  const rowResult = await rowsQuery.range(
    (page - 1) * slideResourcePageSize,
    page * slideResourcePageSize - 1
  );
  if (rowResult.error) {
    console.error("Gepagineerde slides laden mislukt", { code: rowResult.error.code });
    return emptySlideResourceData(
      "Deze slidepagina kon niet worden geladen. Er is niets gewijzigd; pas de filters aan of probeer opnieuw."
    );
  }

  const slideRows = (rowResult.data ?? []) as SlideRow[];
  const versionIds = slideRows.flatMap((slide) =>
    slide.current_published_version_id ? [slide.current_published_version_id] : []
  );
  const snapshotIds = slideRows.flatMap((slide) =>
    slide.current_snapshot_id ? [slide.current_snapshot_id] : []
  );
  const [versionsResult, snapshotsResult] = await Promise.all([
    versionIds.length
      ? supabase
        .from("dynamic_slide_versions")
        .select("id,version_number,name,slide_type,orientation,selection_mode,configuration_json")
        .eq("tenant_id", tenantId)
        .in("id", versionIds)
      : Promise.resolve({ data: [], error: null }),
    snapshotIds.length
      ? supabase
        .from("dynamic_slide_snapshots")
        .select("id,snapshot_data_json,status,error_code,created_at")
        .eq("tenant_id", tenantId)
        .in("id", snapshotIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (versionsResult.error || snapshotsResult.error) {
    console.error("Slideversies of snapshots laden mislukt", {
      code: versionsResult.error?.code ?? snapshotsResult.error?.code
    });
  }
  const versionById = new Map((versionsResult.data ?? []).map((version) => [version.id, version]));
  const snapshotById = new Map((snapshotsResult.data ?? []).map((snapshot) => [snapshot.id, snapshot]));

  return {
    counts: {
      active: activeResult.count ?? 0,
      concept: conceptResult.count ?? 0,
      inactive: inactiveResult.count ?? 0,
      total: (activeResult.count ?? 0) + (conceptResult.count ?? 0) + (inactiveResult.count ?? 0)
    },
    error: versionsResult.error || snapshotsResult.error
      ? "De lijst is geladen, maar één of meer snapshotdetails ontbreken. Open de slide voor de volledige status en probeer de preview opnieuw."
      : null,
    page,
    pageCount,
    playlists: (playlistsResult.data ?? []).map((playlist) => ({
      id: playlist.id,
      name: playlist.name
    })),
    rows: slideRows.map((slide) => {
      const version = slide.current_published_version_id
        ? versionById.get(slide.current_published_version_id)
        : null;
      const snapshot = slide.current_snapshot_id
        ? snapshotById.get(slide.current_snapshot_id)
        : null;
      const visible = version ? {
        configuration_json: version.configuration_json,
        name: version.name,
        orientation: version.orientation,
        selection_mode: version.selection_mode,
        slide_type: version.slide_type
      } : slide;
      return {
        createdAt: slide.created_at,
        currentVersionNumber: version ? Number(version.version_number) : null,
        dataLabel: slideDataLabel(slide, snapshot),
        editHref: editorHref(slide.id, visible.slide_type, visible.configuration_json),
        id: slide.id,
        itemCount: snapshotItemCount(snapshot?.snapshot_data_json),
        name: visible.name,
        orientationLabel: visible.orientation === "portrait" ? "Staand" : "Liggend",
        resourceStatus: slideResourceStatus(
          slide.status,
          Boolean(slide.current_published_version_id)
        ),
        selectionLabel: visible.selection_mode === "latest" ? "Volgt nieuwste snapshot" : "Vastgezet",
        slideTypeLabel: humanSlideType(visible.slide_type),
        technicalStatus: slide.status,
        updatedAt: slide.updated_at
      };
    }),
    total
  };
}

function slideDataLabel(
  slide: { last_error_code: string | null; status: string },
  snapshot: { error_code: string | null; snapshot_data_json: unknown; status: string } | null | undefined
) {
  if (slide.status === "archived") return "Herstelbaar archief";
  if (slide.last_error_code || snapshot?.error_code || slide.status === "error") return "Herstel nodig";
  if (slide.status === "rendering" || snapshot?.status === "rendering" || snapshot?.status === "queued") return "Wordt verwerkt";
  const count = snapshotItemCount(snapshot?.snapshot_data_json);
  if (!count) return "Geen inhoud";
  return `${count} ${count === 1 ? "item" : "items"}`;
}

function editorHref(slideId: string, slideType: string, configuration: unknown) {
  if (record(configuration)?.schemaVersion === "menu-document.v2") {
    return `/dashboard/slides/menu-studio/${slideId}`;
  }
  if (slideType.startsWith("sport_")) return `/dashboard/slides/${slideId}/edit`;
  return `/dashboard/slides/${slideId}`;
}

function snapshotItemCount(value: unknown) {
  const snapshot = record(value);
  const sport = record(snapshot?.sport);
  if (Array.isArray(sport?.items)) return sport.items.length;
  const menu = record(snapshot?.menu);
  if (Array.isArray(menu?.products)) return menu.products.length;
  const menuDocument = record(snapshot?.menuDocument);
  if (Array.isArray(menuDocument?.pages)) {
    return menuDocument.pages.reduce((total, pageValue) => {
      const page = record(pageValue);
      return total + (Array.isArray(page?.blocks) ? page.blocks.reduce((pageTotal, blockValue) => {
        const block = record(blockValue);
        return pageTotal + (block?.type === "product-group" ? 1 : Array.isArray(block?.productNodes) ? block.productNodes.length : 0);
      }, 0) : 0);
    }, 0);
  }
  const priceList = record(snapshot?.priceList);
  if (Array.isArray(priceList?.sections)) {
    return priceList.sections.reduce((total, section) => {
      const products = record(section)?.products;
      return total + (Array.isArray(products) ? products.length : 0);
    }, 0);
  }
  const news = record(snapshot?.news);
  return Array.isArray(news?.articles) ? news.articles.length : 0;
}

function humanSlideType(value: string) {
  const labels: Record<string, string> = {
    menu: "Menubord",
    news: "Nieuws",
    price_list: "Prijslijst",
    sport_activities: "Clubagenda",
    sport_cancellations: "Afgelastingen",
    sport_dressing_rooms: "Veld- en kleedkamerindeling",
    sport_match_of_the_day: "Wedstrijd van de dag",
    sport_next_match: "Volgende wedstrijd",
    sport_officials: "Scheidsrechtersaanstellingen",
    sport_period_standing: "Periodestand",
    sport_program: "Programma",
    sport_results: "Uitslagen",
    sport_standing: "Competitiestand"
  };
  return labels[value] ?? value.replace(/^sport_/, "").replaceAll("_", " ");
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function emptySlideResourceData(error: string): SlideResourceData {
  return {
    counts: { active: 0, concept: 0, inactive: 0, total: 0 },
    error,
    page: 1,
    pageCount: 1,
    playlists: [],
    rows: [],
    total: 0
  };
}
