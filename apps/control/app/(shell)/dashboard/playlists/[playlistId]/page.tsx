import {getSupabasePublicConfig}from"../../../../../lib/supabase/config";
import { notFound } from "next/navigation";

import { hasCapability } from "@veyocast/auth";

import { requireControlSession } from "../../../../../lib/control-session";
import {SitesPlaylistWorkspace}from"../_components/sites/sites-playlist-workspace";
import {loadSitesPlaylistEditor}from"../sites-editor-data";
import { loadPlaylistStudio } from "../data";

type PlaylistStudioPageProps = {
  params: Promise<{ playlistId: string }>;
  searchParams: Promise<{
    advanced?: string;
    add?: string;
    actual?: string;
    conflict?: string;
    expected?: string;
    fout?: string;
    operation?: string;
    succes?: string;
  }>;
};

export default async function PlaylistStudioPage({
  params,
  searchParams
}: PlaylistStudioPageProps) {
  const session = await requireControlSession();
  const { playlistId } = await params;
  const query = await searchParams;
  const data =
    session.isLive && session.tenantId
      ? await loadPlaylistStudio(session.tenantId, playlistId)
      : {
          assets: [],
          dynamicSlides: [],
          engageCampaigns: [],
          error: null,
          items: [],
          playlist: null,
          readiness: null,
          releases: [],
          sections: [],
          screens: [],
          youtubeSources: []
        };
  if (session.isLive && !data.playlist && !data.error) notFound();

  const publicConfig=getSupabasePublicConfig();
  const playlist = data.playlist;
  const tenantIsMutable =
    session.isLive &&
    session.tenantStatus === "active" &&
    playlist?.status !== "archived";
  const canWrite = Boolean(
    tenantIsMutable &&
      hasCapability(session.capabilities, "tenant.playlist.write")
  );
  let sitesData:Awaited<ReturnType<typeof loadSitesPlaylistEditor>>|null=null;
  let sitesError:string|null=null;
  if(playlist&&session.tenantId){try{sitesData=await loadSitesPlaylistEditor(session.tenantId,data,{media:hasCapability(session.capabilities,'tenant.media.read'),studio:hasCapability(session.capabilities,'tenant.studio.read'),dynamic:hasCapability(session.capabilities,'tenant.dynamic_slide.read')});}catch{sitesError='De inhoudkiezer kon niet volledig worden geladen. Je playlist blijft bewaard; vernieuw de pagina om opnieuw te laden.';}}
  return (
    <>
      {query.fout ? (
        <p className="notice notice--critical" role="alert">
          <strong>Actie mislukt.</strong> {query.fout}
        </p>
      ) : null}
      {query.succes ? (
        <p className="notice notice--success" role="status">
          {query.succes}
        </p>
      ) : null}
      {data.error ? (
        <p className="notice notice--critical" role="alert">
          <strong>Playlisteditor niet volledig geladen.</strong> {data.error}
        </p>
      ) : null}
      {!session.isLive ? (
        <p className="notice notice--warning" role="status">
          De playlisteditor gebruikt alleen live tenantdata. Configureer Supabase
          en log opnieuw in.
        </p>
      ) : null}
      {sitesError?<p className="notice notice--critical"role="alert">{sitesError}</p>:null}
      {sitesData?<>{sitesData.warnings.map((warning,index)=><p key={index}className="notice notice--warning"role="status">{warning}</p>)}<SitesPlaylistWorkspace tenantName={session.tenant} initial={sitesData.playlist}revision={sitesData.revision}inventory={sitesData.inventory}groups={sitesData.groups}media={sitesData.media}designs={sitesData.designs}projects={sitesData.projects}canWrite={canWrite}canPublish={tenantIsMutable&&hasCapability(session.capabilities,'tenant.playlist.publish')}startAdding={query.add==='1'}videoUploadConfig={publicConfig&&hasCapability(session.capabilities,'tenant.media.write')?{anonKey:publicConfig.anonKey,supabaseUrl:publicConfig.url}:undefined}/></>:<p><a href={`/dashboard/playlists/${playlistId}`}>Playlist opnieuw laden</a></p>}
    </>
  );
}
