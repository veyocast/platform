import Link from "next/link";
import {redirect} from "next/navigation";

import { hasCapability } from "@veyocast/auth";
import { Button } from "@veyocast/ui";

import { requireControlSession } from "../../../../lib/control-session";
import {SitesPlaylistLibraryWorkspace}from"./_components/sites/sites-playlist-library-workspace";
import {loadSitesPlaylistList}from"./sites-library-data";
import type { loadPlaylistList, PlaylistListFilter } from "./data";

type PlaylistsPageProps = {
  searchParams: Promise<{
    advanced?:string;
    assignment?: string;
    fout?: string;
    page?: string;
    q?: string;
    sort?: string;
    status?: string;
    succes?: string;
    view?: string;
  }>;
};

export default async function PlaylistsPage({ searchParams }: PlaylistsPageProps) {
  const session = await requireControlSession();
  const params = await searchParams;
  if(params.advanced){const next=new URLSearchParams();for(const [key,value] of Object.entries(params))if(key!=="advanced"&&value)next.set(key,value);redirect(`/dashboard/playlists${next.size?`?${next}`:""}`);}
  const filter = parseFilter(params);
  let data:Awaited<ReturnType<typeof loadPlaylistList>>={error:null,page:1,pageCount:1,rows:[],total:0};
  if(session.isLive&&session.tenantId){try{data=await loadSitesPlaylistList(session.tenantId,filter);}catch{data={...data,error:'De vernieuwde playlistbibliotheek kon niet volledig worden geladen. Vernieuw de pagina om opnieuw te proberen.'};}}

  const tenantIsMutable = session.isLive && session.tenantStatus === "active";
  const canWrite = tenantIsMutable && hasCapability(session.capabilities, "tenant.playlist.write");
  return (
    <>
      <h1 className="sr-only">Playlists</h1>
      {params.fout ? <p className="notice notice--critical" role="alert"><strong>Actie mislukt.</strong> {params.fout}</p> : null}
      {params.succes ? <p className="notice notice--success" role="status">{params.succes}</p> : null}
      {data.error ? <p className="notice notice--critical" role="alert"><strong>Playlists niet geladen.</strong> {data.error}</p> : null}
      {!session.isLive ? <p className="notice notice--warning" role="status">Configureer Supabase en log in om echte playlists te maken en bewerken.</p> : null}

      <SitesPlaylistLibraryWorkspace rows={data.rows}total={data.total}canWrite={canWrite}canManage={tenantIsMutable&&hasCapability(session.capabilities,'tenant.playlist.archive')}query={filter.query??''}status={filter.status??'all'}sort={filter.sort??'updated'}/>{data.pageCount>1?<nav aria-label="Playlistpagina's"className="pagination"><PaginationLink disabled={data.page<=1}href={pageHref(params,data.page-1)}label="Vorige pagina"/><span>Pagina {data.page} van {data.pageCount}</span><PaginationLink disabled={data.page>=data.pageCount}href={pageHref(params,data.page+1)}label="Volgende pagina"/></nav>:null}
    </>
  );
}

function parseFilter(params: Awaited<PlaylistsPageProps["searchParams"]>): PlaylistListFilter {
  return {
    assignment: params.assignment === "assigned" || params.assignment === "unassigned" ? params.assignment : "all",
    page: Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1),
    query: params.q?.trim() ?? "",
    sort: params.sort === "name" ? "name" : params.sort === "items" ? "items" : "updated",
    status: params.status === "draft" || params.status === "published" || params.status === "archived" ? params.status : "all"
  };
}

function pageHref(params: Awaited<PlaylistsPageProps["searchParams"]>, page: number) {
  const next = new URLSearchParams();
  for (const key of ["q", "status", "assignment", "sort"] as const) if (params[key]) next.set(key, params[key]);
  next.set("page", String(page));
  return `/dashboard/playlists?${next.toString()}`;
}

function PaginationLink({ disabled, href, label }: { disabled: boolean; href: string; label: string }) {
  return disabled
    ? <Button aria-disabled="true" disabled variant="secondary">{label}</Button>
    : <Button asChild variant="secondary"><Link href={href}>{label}</Link></Button>;
}
