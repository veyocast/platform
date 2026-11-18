type RefreshDocument = Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
type RefreshWindow = Pick<Window, 'setTimeout' | 'clearTimeout' | 'addEventListener' | 'removeEventListener'> & {
  navigator: Pick<Navigator, 'onLine'>;
};

export function watchVisibleRouteRefresh({ document, window, intervalMs, refresh }: {
  document: RefreshDocument;
  window: RefreshWindow;
  intervalMs: number;
  refresh: () => void;
}) {
  let timer: number | undefined;
  let requested = false;
  let stopped = false;
  const ready = () => document.visibilityState === 'visible' && window.navigator.onLine !== false;
  const clear = () => { if (timer !== undefined) window.clearTimeout(timer); timer = undefined; };
  const request = () => {
    clear();
    if (stopped || requested || !ready()) return;
    requested = true;
    refresh();
  };
  const resume = () => { clear(); if (ready()) request(); };
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('online', resume);
  window.addEventListener('offline', clear);
  if (ready()) timer = window.setTimeout(request, intervalMs);
  return () => {
    stopped = true;
    clear();
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('online', resume);
    window.removeEventListener('offline', clear);
  };
}
