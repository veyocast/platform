"use client";

import dynamic from "next/dynamic";
import {useRef} from "react";

import type {
  StudioEditorPermissions,
  StudioMediaAsset,
  StudioProjectDetail,
  StudioRenderJob,
  StudioRevision,
  StudioSeriesDetail
} from "../types";
import {StudioLoadingState} from "../studio-route-states";
import type {SyncStudioLibraryProject} from '../../playlists/_components/sites/model';

const SitesStudioEditor=dynamic(()=>import("./sites-studio-editor").then(module=>module.SitesStudioEditor),{ssr:false,loading:()=> <StudioLoadingState/>});
const SyncStudioEditor=dynamic(()=>import("./sync-studio-editor").then(module=>module.SyncStudioEditor),{ssr:false,loading:()=> <StudioLoadingState/>});

const StudioEditorWorkspace = dynamic(
  () =>
    import("./studio-editor-workspace").then(
      (module) => module.StudioEditorWorkspace
    ),
  {
    loading:()=> <StudioLoadingState/>,
    ssr: false
  }
);

export function StudioEditorLoader(props: {
  series?:StudioSeriesDetail|null;
  sourceLibrary?:SyncStudioLibraryProject[];
  assets: StudioMediaAsset[];
  error: string | null;
  initialRenderId: string | null;
  isLive: boolean;
  permissions: StudioEditorPermissions;
  project: StudioProjectDetail;
  renderJobs: StudioRenderJob[];
  revisions: StudioRevision[];
  tenantBrand?: {
    colors: string[];
    logoAssetId?: string;
    name: string;
  } | null;
  tenantId: string;
}) {
  const contextKey=`${props.tenantId}:${props.project.id}`;
  const sourceEditor=useRef({contextKey,selected:Boolean(props.project.document.syncPresentation)});
  if(sourceEditor.current.contextKey!==contextKey)sourceEditor.current={contextKey,selected:Boolean(props.project.document.syncPresentation)};
  // A background read must not unmount a Source form with unconfirmed input.
  // Loading a different canonical format is an explicit action in its controller.
  if(sourceEditor.current.selected)return <SyncStudioEditor key={contextKey} {...props}/>;
  return props.project.document.sitesPresentation?<SitesStudioEditor key={`${props.project.id}:${props.project.draftRevision}`} {...props}/>:<StudioEditorWorkspace {...props} />;
}
