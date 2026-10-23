export type SyncOnzeTrotsV9Scene = {
  panelCount: number;
  mode: 'light' | 'dark';
  paused: boolean;
  introFinished: boolean;
  entranceAllowed: boolean;
};
type Transform = { opacity: number; translateY: number; scale: number; blur: number };
export type SyncOnzeTrotsV9Entrance = {
  finished: boolean;
  background: { opacity: number; scale: number };
  header: Transform;
  panels: Transform[];
  footer: Transform;
};

/** CSS cubic-bezier evaluated from elapsed time, rather than from a browser's
 * independent animation clock. All three render paths use these same values. */
function bezierAt(progress: number, x1: number, y1: number, x2: number, y2: number) {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  const cubic = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  let low = 0, high = 1;
  for (let iteration = 0; iteration < 40; iteration++) {
    const middle = (low + high) / 2;
    if (cubic(middle, x1, x2) < progress) low = middle;
    else high = middle;
  }
  return cubic((low + high) / 2, y1, y2);
}

export function projectSyncOnzeTrotsV9Entrance(elapsedMs: number, scene: SyncOnzeTrotsV9Scene, reducedMotion = false): SyncOnzeTrotsV9Entrance {
  const count = Math.max(0, Math.trunc(scene.panelCount));
  const footerStart = 2600 + Math.max(0, count - 1) * 120;
  const time = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  const finished = scene.paused || reducedMotion || scene.introFinished || !scene.entranceAllowed || time >= footerStart + 400;
  const progress = (start: number, duration: number, easing: readonly [number, number, number, number]) => finished ? 1 : bezierAt((time - start) / duration, ...easing);
  const entering = (value: number, y: number, scale: number, blur: number): Transform => ({ opacity: value, translateY: y * (1 - value), scale: scale + (1 - scale) * value, blur: blur * (1 - value) });
  const bg = progress(0, 850, [.2, .65, .25, 1]);
  return {
    finished,
    background: { opacity: bg * (scene.mode === 'light' ? .95 : .6), scale: 1 + .025 * (1 - bg) },
    header: entering(progress(1250, 650, [.16, 1, .3, 1]), -16, 1, 3),
    panels: Array.from({ length: count }, (_, index) => entering(progress(2100 + index * 120, 650, [.16, 1, .3, 1]), 24, .985, 4)),
    footer: entering(progress(footerStart, 400, [.25, .1, .25, 1]), 5, 1, 0),
  };
}

/** Serialization-safe layout adapter. Measurements stay in logical pixels;
 * SVG/output scaling never enters the font or visitor-fit calculations. */
export function measureSyncOnzeTrotsV9Layout(root: ParentNode = document): number {
  const screen = root.querySelector<HTMLElement>('.ot-v9-scope .screen');
  if (!screen) return 0;
  const title = screen.querySelector<HTMLElement>('[data-ot-header-text]');
  const subtitle = screen.querySelector<HTMLElement>('[data-ot-header-subtitle]');
  const copy = screen.querySelector<HTMLElement>('.slide-header-copy');
  if (title && subtitle && copy) {
    const portrait = screen.classList.contains('portrait');
    subtitle.hidden = !subtitle.textContent;
    title.hidden = !title.textContent;
    let subSize = portrait ? 11 : 12;
    subtitle.style.fontSize = `${subSize}px`;
    while (subSize > 9 && subtitle.scrollHeight > 30) subtitle.style.fontSize = `${--subSize}px`;
    let size = portrait ? 38 : 42;
    title.style.fontSize = `${size}px`;
    const available = copy.clientHeight - (subtitle.hidden ? 0 : subtitle.offsetHeight + 7);
    while (size > 14 && title.scrollHeight > available + 1) title.style.fontSize = `${--size}px`;
  }
  const desired = Number(screen.dataset.otWelcomeScale ?? 150) / 100;
  for (const stage of screen.querySelectorAll<HTMLElement>('.visitor-stage')) {
    const identity = stage.querySelector<HTMLElement>('.visitor-spotlight');
    if (!identity) continue;
    // The compact three-card layout has fractional CSS heights. Integer
    // client/offset sizes can round a fit upwards and clip the scaled group.
    // Computed sizes remain untransformed logical pixels in all three paths.
    const identityStyle = getComputedStyle(identity), stageStyle = getComputedStyle(stage);
    const width = Math.max(parseFloat(identityStyle.width), identity.scrollWidth), height = Math.max(parseFloat(identityStyle.height), identity.scrollHeight);
    const fit = Math.max(.1, Math.min(desired, parseFloat(stageStyle.width) / Math.max(1, width), parseFloat(stageStyle.height) / Math.max(1, height)));
    identity.style.setProperty('--welcome-fit', String(fit));
    stage.dataset.effectiveScale = String(Math.round(fit * 100));
  }
  const selector = '.panel,.photo-panel,.pitch,.goal-scene,.video-layout';
  const panels = [...screen.querySelectorAll<HTMLElement>('.slide-content .panel,.slide-content .photo-panel,.slide-content .pitch,.slide-content .goal-scene,.slide-content .video-layout')].filter(panel => !panel.parentElement?.closest(selector));
  for (const panel of panels) panel.dataset.otScenePanel = 'true';
  return panels.length;
}
