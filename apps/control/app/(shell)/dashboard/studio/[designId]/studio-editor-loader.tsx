"use client";

import dynamic from "next/dynamic";

import type {
  StudioEditorPermissions,
  StudioMediaAsset,
  StudioProjectDetail,
  StudioRenderJob,
  StudioRevision,
  StudioSeriesDetail
} from "../types";
import {StudioLoadingState} from "../studio-route-states";

const SitesStudioEditor=dynamic(()=>import("./sites-studio-editor").then(module=>module.SitesStudioEditor),{ssr:false,loading:()=> <StudioLoadingState/>});

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
  return props.project.document.sitesPresentation?<SitesStudioEditor key={`${props.project.id}:${props.project.draftRevision}`} {...props}/>:<StudioEditorWorkspace {...props} />;
}
