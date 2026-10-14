import Link from "next/link";
import { hasCapability } from "@veyocast/auth";
import { Button, StatusPill } from "@veyocast/ui";
import { requireTenantControlSession } from "../../../../../lib/control-session";
import styles from "./menu-overview.module.css";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
export default async function MenuStudioPage({ searchParams }: {
    searchParams: Promise<{
        pagina?: string;
    }>;
}) {
    const session = await requireTenantControlSession("tenant.dynamic_slide.read");
    const params = await searchParams;
    const page = Math.min(200, Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1));
    const client = session.isLive && session.tenantId ? await createControlSupabaseClient() : null;
    const result = client ? await client.from("dynamic_slides").select("id,name,status,orientation,updated_at", { count: "exact" }).eq("tenant_id", session.tenantId!).in("slide_type", ["menu", "price_list"]).is("archived_at", null).order("updated_at", { ascending: false }).range((page - 1) * 24, page * 24 - 1) : null;
    const error = !result || Boolean(result.error);
    return <section className="work-panel"><h1 className="sr-only">Menu Studio</h1><div className="toolbar"><p>Maak je menu, sla het op en voeg het vanuit de slidebibliotheek aan je playlist toe.</p>{session.tenantStatus === "active" && hasCapability(session.capabilities, "tenant.dynamic_slide.write") && <Button asChild><Link href="/dashboard/slides/menu-studio/new">Nieuw menu</Link></Button>}</div>
 {error ? <p className="notice notice--critical" role="alert">Je menu’s konden niet worden geladen. Er is niets gewijzigd; vernieuw de pagina om opnieuw te proberen.</p> : result.data?.length ? <ul className={styles.list} aria-label="Opgeslagen menu’s">{result.data.map(menu => <li key={menu.id}><div><strong>{menu.name}</strong><p>{menu.orientation === "portrait" ? "Staand · 9:16" : "Liggend · 16:9"}</p></div><StatusPill className={styles.status} label={menu.status === "ready" ? "Gereed" : menu.status === "error" ? "Verwerking mislukt" : "Concept of in verwerking"} tone={menu.status === "ready" ? "success" : menu.status === "error" ? "critical" : "neutral"}/><Button asChild variant="secondary"><Link href={`/dashboard/slides/menu-studio/${menu.id}`} aria-label={`${menu.name} openen`}>Open menu</Link></Button></li>)}</ul> : <p role="status">Je hebt nog geen menu’s. Begin met Nieuw menu; daarna staat het ook in de slidebibliotheek.</p>}
 {!error && (page > 1 || (result.count ?? 0) > page * 24) && <nav className="pagination" aria-label="Menupagina’s">{page > 1 && <Link href={`?pagina=${page - 1}`}>Vorige pagina</Link>}<span>Pagina {page}</span>{(result.count ?? 0) > page * 24 && <Link href={`?pagina=${page + 1}`}>Volgende pagina</Link>}</nav>}
 <p><Link href="/dashboard/playlists">Open je playlists</Link></p></section>;
}
