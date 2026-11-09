const contentRoutes = ["#/dashboard/media", "#/dashboard/studio"];
const contentTypes = ["Alles", "Media", "Ontwerpen", "Automatische slides", "Menu’s", "Reeksen"];
const contentFilters = ["all", "media", "designs", "automatic", "menus", "series"];
const contentStatuses = ["Actief", "In bewerking", "Archief"];
const controlChanges = {
  ".section-header": ["height"], ".section-header :is(.btn,.vc-button)": ["y"],
  ".vc-library-toolbar": ["y", "height"], ".vc-filter-tabs": ["y", "width", "height", "gap"],
  ".vc-library-search": ["y"], ".vc-library-search button": ["y"], ".vc-library-search input": ["y"]
};
export const isS297ContentRoute = route => contentRoutes.includes(route);
export const isS297ControlChange = difference => controlChanges[difference.selector]?.includes(difference.property) === true;
export const isS297HeadingChange = difference => difference.index === 0 && difference.property === "width" || difference.index === 1 && difference.property === "y";

/** A2 changes this region's function. Keep original deltas; require the actual
 * replacement controls instead of claiming Source pixel or geometry parity. */
export function verifyS297ContentChange(change, route) {
  const filter = route === "#/dashboard/media" ? "media" : "designs";
  const controls = change?.controls;
  const expectedContext = filter === "media" ? "/dashboard/media" : "/dashboard/studio?advanced=1";
  if (!isS297ContentRoute(route) || change?.contract !== "S297_CONTENT_A2" || change.pixelParity !== false
    || change.filter !== filter || !controls || !Array.isArray(controls.types) || !Array.isArray(controls.statuses)
    || !Array.isArray(controls.context) || controls.context.length !== 1 || controls.context[0].href !== expectedContext
    || JSON.stringify(controls.types.map(item => item.label)) !== JSON.stringify(contentTypes)
    || JSON.stringify(controls.statuses.map(item => item.label)) !== JSON.stringify(contentStatuses)
    || change.search?.filter !== filter || change.search?.status !== "active" || change.search?.pageSize !== "48"
    || change.accessibility !== true || change.noHorizontalOverflow !== true) return false;
  const all = [...controls.types, ...controls.statuses, ...controls.context];
  if (all.some(item => !(item.height >= 44 && item.width >= 44 && item.fontSize >= 14)
    || item.scrollWidth > item.clientWidth || item.scrollHeight > item.clientHeight)) return false;
  return controls.types.every((item, index) => {
    if (typeof item.href !== "string" || !item.href.startsWith("/") || item.href.startsWith("//")) return false;
    const url = new globalThis.URL(item.href, "http://localhost");
    return url.origin === "http://localhost" && url.pathname === "/dashboard/content" && url.searchParams.get("filter") === contentFilters[index]
      && url.searchParams.get("status") === "active" && url.searchParams.get("page") === "1";
  }) && controls.statuses.every((item, index) => {
    if (typeof item.href !== "string" || !item.href.startsWith("/") || item.href.startsWith("//")) return false;
    const url = new globalThis.URL(item.href, "http://localhost");
    return url.origin === "http://localhost" && url.pathname === "/dashboard/content" && url.searchParams.get("filter") === filter
      && url.searchParams.get("status") === ["active", "attention", "archive"][index] && url.searchParams.get("page") === "1";
  });
}

