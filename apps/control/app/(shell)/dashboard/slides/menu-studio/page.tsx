import { redirect } from "next/navigation";
import { requireTenantControlSession } from "../../../../../lib/control-session";
import { contentLibraryHref, parseContentLibraryQuery } from "../../content/content-library";

/** Index only: editor, new-menu and version URLs retain their original handlers. */
export default async function MenuStudioPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  await requireTenantControlSession("tenant.dynamic_slide.read");
  const params = await searchParams;
  const page = Math.min(200, Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1));
  redirect(contentLibraryHref(parseContentLibraryQuery({ filter: "menus", page: String(page), pageSize: "24" })));
}
