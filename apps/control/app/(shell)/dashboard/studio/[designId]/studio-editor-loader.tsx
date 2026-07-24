"use client";

import dynamic from "next/dynamic";

import type {
  StudioEditorPermissions,
  StudioMediaAsset,
  StudioProjectDetail,
  StudioRenderJob,
  StudioRevision
} from "../types";
import styles from "../studio.module.css";

const StudioEditorWorkspace = dynamic(
  () =>
    import("./studio-editor-workspace").then(
      (module) => module.StudioEditorWorkspace
    ),
  {
    loading: () => (
      <div aria-busy="true" className={styles.editorLoading}>
        <span />
        <strong>Studio voorbereiden</strong>
        <p>Canvas, lettertypen en veilige ontwerptools worden geladen.</p>
      </div>
    ),
    ssr: false
  }
);

export function StudioEditorLoader(props: {
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
  return <StudioEditorWorkspace {...props} />;
}
