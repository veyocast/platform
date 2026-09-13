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
  style = { objectFit: "", objectPosition: "" };
  error: { code: number } | null = null;
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
    expect(run.video).toMatchObject({ muted: true, defaultMuted: true, autoplay: true, playsInline: true, controls: false, preload: "auto", style: { objectFit: "contain", objectPosition: "50% 50%" } });
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
  it("recovers a rejected native Blob through the same published HTTPS asset and ignores the old play rejection", async () => {
    const video = new Video();
    let rejectBlob: (error: Error) => void = () => {};
    video.play.mockImplementationOnce(() => new Promise<void>((_, reject) => { rejectBlob = reject; }));
    const handlers = { onPlaying: vi.fn(), onComplete: vi.fn(), onFailure: vi.fn(), onFallback: vi.fn(), fallbackUrl: "https://media.example/immutable.mp4" };
    const cleanup = playGoalIntroVideo(video as unknown as HTMLVideoElement, "blob:verified", handlers);
    video.error = { code: 4 }; video.dispatchEvent(new Event("error"));
    expect(handlers.onFallback).toHaveBeenCalledWith("GOAL_VIDEO_LOAD_ERROR", 4);
    expect(video.src).toBe(handlers.fallbackUrl);
    rejectBlob(new Error("replaced source")); await Promise.resolve();
    expect(handlers.onFailure).not.toHaveBeenCalled();
    video.error = null; video.dispatchEvent(new Event("playing"));
    expect(handlers.onComplete).not.toHaveBeenCalled();
    video.dispatchEvent(new Event("ended"));
    expect(handlers.onComplete).toHaveBeenCalledTimes(1);
    cleanup(); expect(vi.getTimerCount()).toBe(0);
  });
  it("limits HTTPS recovery to one attempt and still releases the overlay on failure", () => {
    const video = new Video();
    const handlers = { onPlaying: vi.fn(), onComplete: vi.fn(), onFailure: vi.fn(), onFallback: vi.fn(), fallbackUrl: "https://media.example/immutable.mp4" };
    const cleanup = playGoalIntroVideo(video as unknown as HTMLVideoElement, "blob:verified", handlers);
    video.dispatchEvent(new Event("error")); video.dispatchEvent(new Event("error")); video.dispatchEvent(new Event("error"));
    expect(handlers.onFallback).toHaveBeenCalledTimes(1);
    expect(handlers.onFailure).toHaveBeenCalledTimes(1);
    expect(handlers.onComplete).not.toHaveBeenCalled(); cleanup();
  });
  it.each([undefined, "http://media.example/intro.mp4", "file:///intro.mp4"])("does not use an absent/offline or non-HTTPS fallback (%s)", (fallbackUrl) => {
    const video = new Video();
    const handlers = { onPlaying: vi.fn(), onComplete: vi.fn(), onFailure: vi.fn(), onFallback: vi.fn(), fallbackUrl };
    const cleanup = playGoalIntroVideo(video as unknown as HTMLVideoElement, "blob:verified", handlers);
    video.dispatchEvent(new Event("error"));
    expect(handlers.onFallback).not.toHaveBeenCalled(); expect(handlers.onFailure).toHaveBeenCalledTimes(1); cleanup();
  });
  it("does not restart from HTTPS after playback has begun", () => {
    const video = new Video();
    const handlers = { onPlaying: vi.fn(), onComplete: vi.fn(), onFailure: vi.fn(), onFallback: vi.fn(), fallbackUrl: "https://media.example/immutable.mp4" };
    const cleanup = playGoalIntroVideo(video as unknown as HTMLVideoElement, "blob:verified", handlers);
    video.dispatchEvent(new Event("playing")); video.dispatchEvent(new Event("error"));
    expect(handlers.onFallback).not.toHaveBeenCalled(); expect(handlers.onFailure).toHaveBeenCalledWith("GOAL_VIDEO_PLAYBACK_ERROR"); cleanup();
  });
  it("bounds two non-starting sources and cannot call back after cleanup during recovery", () => {
    for (const cancelDuringRecovery of [false, true]) {
      const video = new Video();
      const handlers = { onPlaying: vi.fn(), onComplete: vi.fn(), onFailure: vi.fn(), onFallback: vi.fn(), fallbackUrl: "https://media.example/immutable.mp4" };
      const cleanup = playGoalIntroVideo(video as unknown as HTMLVideoElement, "blob:verified", handlers);
      vi.advanceTimersByTime(8000);
      expect(handlers.onFallback).toHaveBeenCalledTimes(1);
      if (cancelDuringRecovery) cleanup();
      vi.advanceTimersByTime(8000);
      expect(handlers.onFailure).toHaveBeenCalledTimes(cancelDuringRecovery ? 0 : 1);
      cleanup(); video.dispatchEvent(new Event("playing")); video.dispatchEvent(new Event("ended"));
      expect(handlers.onPlaying).not.toHaveBeenCalled(); expect(handlers.onComplete).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    }
  });
});
