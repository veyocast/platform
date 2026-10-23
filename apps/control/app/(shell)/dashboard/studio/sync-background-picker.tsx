"use client";
/* eslint-disable @next/next/no-img-element */
import { syncBackgroundScenes, type SyncSlidePresentation } from "@veyocast/contracts";
import { chooseSyncBackground, syncBackgroundPresets } from "../../../../lib/sync-background-choice";
import styles from "./sync-background-picker.module.css";

export function SyncBackgroundPicker({ presentation, onChange, disabled = false }: {
  presentation: SyncSlidePresentation;
  onChange: (patch: Partial<SyncSlidePresentation>) => void;
  disabled?: boolean;
}) {
  const ref = presentation.style.backgroundAsset;
  return <fieldset className={styles.picker} disabled={disabled}>
    <legend>Achtergrond</legend>
    {presentation.rendererVersion==='sync-onzetrots-v1'?<button type="button" aria-pressed={!ref} onClick={()=>onChange({style:{...presentation.style,background:'clubmuur',backgroundAsset:undefined}})}>Standaardachtergrond</button>:<div className={styles.presets}>{syncBackgroundPresets.map(([id, label]) => <button
      type="button" key={id} aria-pressed={presentation.style.background === id}
      onClick={() => onChange(chooseSyncBackground(presentation, id))}
    ><span className={`${styles.swatch} ${styles[id]}`} aria-hidden="true" style={id === "clubmuur" ? { backgroundImage: "url('/assets/clubmuur-wall.webp')" } : undefined} /><span>{label}</span></button>)}</div>}
    <span className={styles.label}>OnzeTrots · club en omgeving</span>
    <div className={styles.scenes}>{syncBackgroundScenes.map(scene => {
      const asset = scene[presentation.orientation];
      return <button type="button" key={scene.id}
        aria-pressed={presentation.style.background === "photo" && ref?.kind === "system" && (ref.path === scene.landscape.path || ref.path === scene.portrait.path)}
        onClick={() => onChange(chooseSyncBackground(presentation, scene.id))}
      ><img alt="" src={asset.path} width={asset.width} height={asset.height} loading="lazy" /><span>{scene.label}</span></button>;
    })}</div>
  </fieldset>;
}
