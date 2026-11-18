import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchVisibleRouteRefresh } from './visible-route-refresh';

function fixture() {
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState });
  const window = Object.assign(new EventTarget(), { navigator: { onLine: true },
    setTimeout: ((callback: () => void, milliseconds: number) => globalThis.setTimeout(callback, milliseconds)) as unknown as Window['setTimeout'],
    clearTimeout: ((timer: number) => globalThis.clearTimeout(timer)) as Window['clearTimeout'] });
  const refresh = vi.fn();
  return { document, window, refresh, intervalMs: 3_000 };
}
afterEach(() => vi.useRealTimers());
describe('visible online route refresh', () => {
  it('issues one request per transition and never overlaps a slow route response', () => {
    vi.useFakeTimers();const value = fixture();const stop = watchVisibleRouteRefresh(value);
    vi.advanceTimersByTime(30_000);expect(value.refresh).toHaveBeenCalledTimes(1);
    value.window.dispatchEvent(new Event('online'));value.document.dispatchEvent(new Event('visibilitychange'));
    expect(value.refresh).toHaveBeenCalledTimes(1);stop();
    const next = watchVisibleRouteRefresh(value);vi.advanceTimersByTime(3_000);
    expect(value.refresh).toHaveBeenCalledTimes(2);next();
  });
  it('makes no hidden-tab requests and catches up immediately on return', () => {
    vi.useFakeTimers();const value = fixture();value.document.visibilityState = 'hidden';
    const stop = watchVisibleRouteRefresh(value);vi.advanceTimersByTime(60_000);
    expect(value.refresh).not.toHaveBeenCalled();value.document.visibilityState = 'visible';
    value.document.dispatchEvent(new Event('visibilitychange'));expect(value.refresh).toHaveBeenCalledOnce();stop();
  });
  it('cancels the visible timer on hide or network loss', () => {
    vi.useFakeTimers();const value = fixture();const stop = watchVisibleRouteRefresh(value);
    value.document.visibilityState = 'hidden';value.document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(10_000);expect(value.refresh).not.toHaveBeenCalled();
    value.window.navigator.onLine = false;value.document.visibilityState = 'visible';value.document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(10_000);expect(value.refresh).not.toHaveBeenCalled();
    value.window.navigator.onLine = true;value.window.dispatchEvent(new Event('online'));expect(value.refresh).toHaveBeenCalledOnce();stop();
  });
  it('cannot refresh after unmount, including late callbacks or browser events', () => {
    vi.useFakeTimers();const value = fixture();const stop = watchVisibleRouteRefresh(value);stop();
    vi.advanceTimersByTime(30_000);value.window.dispatchEvent(new Event('online'));
    value.document.dispatchEvent(new Event('visibilitychange'));expect(value.refresh).not.toHaveBeenCalled();
  });
});
