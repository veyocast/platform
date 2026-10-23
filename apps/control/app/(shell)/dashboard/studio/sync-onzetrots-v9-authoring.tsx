'use client';

import { Button } from '@veyocast/ui';
import { syncOnzeTrotsHeaderSubtitle, syncOnzeTrotsHeaderText, type SyncOnzeTrotsV9Presentation } from '@veyocast/contracts';
import styles from './sync-onzetrots-v9-authoring.module.css';

/** The same saved fields are edited by manual and connected designs. Neither
 * a refresh nor switching families replaces another family's authored text. */
export function SyncOnzeTrotsV9Authoring({ presentation, onChange, disabled = false }: {
  presentation: SyncOnzeTrotsV9Presentation;
  onChange: (authoring: SyncOnzeTrotsV9Presentation['authoring']) => void;
  disabled?: boolean;
}) {
  return <div className={styles.fields}>
    <span className={styles.caption}>SLIDEHEADER</span>
    <label className={styles.header}>
      <span>Subtitel boven de kop</span>
      <input aria-label="Subtitel van deze slide" value={syncOnzeTrotsHeaderSubtitle(presentation)} maxLength={120} disabled={disabled}
        onChange={event => onChange({ ...presentation.authoring, headerSubtitles: { ...presentation.authoring.headerSubtitles, [presentation.family]: event.target.value } })}/>
    </label>
    <label className={styles.header}>
      <span>Headertekst</span>
      <input aria-label="Headertekst van deze slide" value={syncOnzeTrotsHeaderText(presentation)} maxLength={120} disabled={disabled}
        onChange={event => onChange({ ...presentation.authoring, headerTexts: { ...presentation.authoring.headerTexts, [presentation.family]: event.target.value } })}/>
    </label>
    <Button variant="secondary" size="sm" disabled={disabled} onClick={() => {
      const headerTexts = { ...presentation.authoring.headerTexts };
      const headerSubtitles = { ...presentation.authoring.headerSubtitles };
      delete headerTexts[presentation.family];
      delete headerSubtitles[presentation.family];
      onChange({ ...presentation.authoring, headerTexts, headerSubtitles });
    }}>Standaard herstellen</Button>
    {['visitors', 'welcome'].includes(presentation.family) && <label className={styles.scale}>
      <span>WELKOMSBLOK <output>{presentation.authoring.welcomeScalePercent}%</output></span>
      <input type="range" aria-label="Grootte bezoekerslogo en welkomstekst" min={100} max={200} step={5}
        value={presentation.authoring.welcomeScalePercent} disabled={disabled}
        onChange={event => onChange({ ...presentation.authoring, welcomeScalePercent: Number(event.target.value) })}/>
    </label>}
  </div>;
}
