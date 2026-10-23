import { describe, expect, it } from 'vitest';
import { projectSyncOnzeTrotsV9Entrance, type SyncOnzeTrotsV9Scene } from '../src/sync-onzetrots-v9-motion';
import { projectSyncOnzeTrotsMotion } from '../src/sync-onzetrots-motion';

const scene: SyncOnzeTrotsV9Scene = { panelCount: 3, mode: 'light', paused: false, introFinished: false, entranceAllowed: true };
const at = (time: number, patch: Partial<SyncOnzeTrotsV9Scene> = {}) => projectSyncOnzeTrotsV9Entrance(time, { ...scene, ...patch });

describe('shared phased v7 scene timeline', () => {
  it('starts with the background and keeps the later phases hidden', () => {
    expect(at(0).background).toEqual({ opacity: 0, scale: 1.025 });
    expect(at(425).background.opacity).toBeGreaterThan(0);
    expect(at(425).background.opacity).toBeLessThan(.95);
    expect(at(850).background).toEqual({ opacity: .95, scale: 1 });
    expect(at(850, { mode: 'dark' }).background.opacity).toBe(.6);
    expect(at(1250).header).toEqual({ opacity: 0, translateY: -16, scale: 1, blur: 3 });
    expect(at(1575).header.opacity).toBeGreaterThan(0);
    expect(at(1900).header).toEqual({ opacity: 1, translateY: -0, scale: 1, blur: 0 });
    expect(at(1900).panels.every(panel => panel.opacity === 0)).toBe(true);
  });

  it.each([0, 1, 2, 3, 4, 5, 6])('uses %i actual top-level panels and the exact footer overlap', count => {
    const patch = { panelCount: count };
    for (let index = 0; index < count; index++) {
      const start = 2100 + index * 120;
      expect(at(start, patch).panels[index]).toEqual({ opacity: 0, translateY: 24, scale: .985, blur: 4 });
      expect(at(start + 325, patch).panels[index]!.opacity).toBeGreaterThan(0);
      expect(at(start + 650, patch).panels[index]).toEqual({ opacity: 1, translateY: 0, scale: 1, blur: 0 });
    }
    const footerStart = 2600 + Math.max(0, count - 1) * 120;
    expect(at(footerStart, patch).footer.opacity).toBe(0);
    expect(at(footerStart + 200, patch).footer.opacity).toBeGreaterThan(0);
    expect(at(footerStart + 400, patch).footer.opacity).toBe(1);
    expect(at(footerStart + 400, patch).finished).toBe(true);
  });

  it.each([0, 425, 1575, 2425, 2840])('finishes the intro when paused at %i ms without resetting data time on resume', time => {
    const paused = at(time, { paused: true });
    expect(paused.finished).toBe(true);
    expect(paused.panels.every(panel => panel.opacity === 1)).toBe(true);
    const resumed = projectSyncOnzeTrotsMotion(7500, [{ range: 300, viewportHeight: 400, rowHeight: 50, ownIndex: 4 }], 'normal', false, { ...scene, introFinished: paused.finished });
    expect(resumed.entrance!.header.opacity).toBe(1);
    expect(resumed.ranks[0]!.scrollTop).toBe(150);
    expect(at(0).header.opacity).toBe(0); // an explicit new scene/replay
  });

  it('shows the complete layout under reduced motion and when entrance is disabled', () => {
    expect(projectSyncOnzeTrotsV9Entrance(0, scene, true)).toEqual(at(0, { paused: true }));
    expect(at(0, { entranceAllowed: false })).toEqual(at(0, { paused: true }));
    const reducedReplay = projectSyncOnzeTrotsV9Entrance(0, { ...scene, introFinished: false }, true);
    expect(reducedReplay.finished).toBe(true);
    expect(reducedReplay.panels.every(panel => panel.opacity === 1)).toBe(true);
  });
});
