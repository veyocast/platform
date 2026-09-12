import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playGoalIntroVideo } from "./goal-video-runtime";

class Video extends EventTarget {
  currentTime = 0;
  src = "";
  muted = false;
  defaultMuted = false;
  autoplay = false;
  playsInline = false;
  controls = true;
  preload = "";
  attributes = new Map<string, string>();
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); if (name === "src") this.src = ""; }
  play = vi.fn<() => Promise<void> | void>(() => Promise.resolve());
  pause = vi.fn();
  load = vi.fn();
}
describe("shared native goal decoder lifecycle", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("window", globalThis); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  function start(video = new Video()) {
    const handlers = { onPlaying: vi.fn(), onComplete: vi.fn(), onFailure: vi.fn() };
    const cleanup = playGoalIntroVideo(video as unknown as HTMLVideoElement, "blob:cached-intro", handlers);
    return { video, cleanup, ...handlers };
  }
  it("uses muted inline autoplay and requires the real ended event", () => {
    const run = start();
    expect(run.video).toMatchObject({ muted: true, defaultMuted: true, autoplay: true, playsInline: true, controls: false, preload: "auto" });
    run.video.dispatchEvent(new Event("playing"));
    for (let second = 1; second <= 20; second++) { run.video.currentTime = second; vi.advanceTimersByTime(1000); }
    expect(run.onComplete).not.toHaveBeenCalled();
    run.video.dispatchEvent(new Event("ended"));
    run.video.dispatchEvent(new Event("ended"));
    expect(run.onComplete).toHaveBeenCalledTimes(1);
    expect(run.onFailure).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    run.cleanup();
  });
  it("accepts a webOS-style void play result", () => {
    const video = new Video(); video.play.mockReturnValue(undefined);
    const run = start(video);
    video.dispatchEvent(new Event("playing"));
    video.dispatchEvent(new Event("ended"));
    expect(run.onComplete).toHaveBeenCalledTimes(1);
    expect(run.onFailure).not.toHaveBeenCalled();
    run.cleanup();
  });
  it("reports rejected autoplay once and releases its watchdog", async () => {
    const video = new Video(); video.play.mockRejectedValue(new Error("NotAllowedError"));
    const run = start(video); await Promise.resolve();
    expect(run.onFailure).toHaveBeenCalledWith("GOAL_VIDEO_PLAY_REJECTED");
    video.dispatchEvent(new Event("error"));
    expect(run.onFailure).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0); run.cleanup();
  });
  it.each([false, true])("reports native errors before/after playing (%s)", (playing) => {
    const run = start(); if (playing) run.video.dispatchEvent(new Event("playing"));
    run.video.dispatchEvent(new Event("error"));
    expect(run.onFailure).toHaveBeenCalledWith(playing ? "GOAL_VIDEO_PLAYBACK_ERROR" : "GOAL_VIDEO_LOAD_ERROR");
    expect(run.onComplete).not.toHaveBeenCalled(); run.cleanup();
  });
  it("recovers from a decoder that never starts", () => {
    const run = start(); vi.advanceTimersByTime(8000);
    expect(run.onFailure).toHaveBeenCalledWith("GOAL_VIDEO_START_TIMEOUT");
    expect(run.onComplete).not.toHaveBeenCalled(); run.cleanup();
  });
  it("cleans all callbacks and native resources on unmount/restart", () => {
    const run = start(); run.cleanup(); run.cleanup();
    run.video.dispatchEvent(new Event("playing")); run.video.dispatchEvent(new Event("ended"));
    vi.advanceTimersByTime(30000);
    expect(run.onPlaying).not.toHaveBeenCalled(); expect(run.onComplete).not.toHaveBeenCalled();
    expect(run.onFailure).not.toHaveBeenCalled(); expect(run.video.src).toBe("");
    expect(run.video.pause).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });
});
