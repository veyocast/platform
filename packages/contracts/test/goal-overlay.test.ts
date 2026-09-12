import { describe, expect, it } from "vitest";
import { chooseGoalIntro, defaultGoalOverlayConfiguration as defaults, goalOverlayConfigurationSchema, transitionGoalPlayback, validGoalTemplate } from "../src/goal-overlay";

describe("central Goal Overlay contract", () => {
  it("starts with club-driven colors and seven seconds without intro", () => {
    expect(defaults).toMatchObject({ themeMode: "auto", overlayDurationMs: 7000, introEnabled: false, lightOuterColor: null, darkOuterColor: null, showPlayerPhoto: true });
  });
  it.each(["GOAL {team}!", "{scorer} SCOORT!", "{home_team} {home_score} — {away_score} {away_team}", "{minute}"])("accepts bounded template %s", (text) => expect(validGoalTemplate(text)).toBe(true));
  it.each(["{unknown}", "{team", "team}", "<script>", "GOAL\n", "{{team}}"])("rejects invalid template %s", (text) => expect(validGoalTemplate(text)).toBe(false));
  it.each(["landscape", "portrait"] as const)("selects and falls back intro for %s", (orientation) => {
    const landscape = "11111111-1111-4111-8111-111111111111";
    const portrait = "22222222-2222-4222-8222-222222222222";
    const c = { ...defaults, introEnabled: true, introLandscapeMediaId: landscape, introPortraitMediaId: portrait };
    expect(chooseGoalIntro(c, orientation)).toBe(orientation === "landscape" ? landscape : portrait);
    expect(chooseGoalIntro({ ...c, introLandscapeMediaId: null }, orientation)).toBe(portrait);
    expect(chooseGoalIntro({ ...c, introPortraitMediaId: null }, orientation)).toBe(landscape);
    expect(chooseGoalIntro({ ...c, introPortraitMediaId: null, introLandscapeMediaId: null }, orientation)).toBeNull();
    expect(chooseGoalIntro({ ...c, introEnabled: false }, orientation)).toBeNull();
  });
  it("requires ended or failure to move from intro to overlay", () => {
    expect(transitionGoalPlayback("IDLE", "start_intro")).toBe("GOAL_INTRO_LOADING");
    expect(transitionGoalPlayback("GOAL_INTRO_LOADING", "intro_playing")).toBe("GOAL_INTRO_PLAYING");
    expect(transitionGoalPlayback("GOAL_INTRO_PLAYING", "duration_elapsed")).toBe("GOAL_INTRO_PLAYING");
    expect(transitionGoalPlayback("GOAL_INTRO_PLAYING", "start_overlay")).toBe("GOAL_INTRO_PLAYING");
    expect(transitionGoalPlayback("GOAL_INTRO_PLAYING", "intro_ended")).toBe("GOAL_OVERLAY_ENTERING");
    expect(transitionGoalPlayback("GOAL_INTRO_LOADING", "intro_failed")).toBe("GOAL_OVERLAY_ENTERING");
    expect(transitionGoalPlayback("GOAL_OVERLAY_VISIBLE", "intro_ended")).toBe("GOAL_OVERLAY_VISIBLE");
    expect(transitionGoalPlayback("GOAL_OVERLAY_EXITING", "exited")).toBe("RESUMING_PLAYLIST");
  });
  it("rejects invalid colors, media references and timing", () => {
    for (const patch of [{ lightOuterColor: "red" }, { darkCardColor: "url(x)" }, { introLandscapeMediaId: "external" }, { overlayDurationMs: 0 }, { transitionDurationMs: 1600 }]) expect(goalOverlayConfigurationSchema.safeParse({ ...defaults, ...patch }).success).toBe(false);
    expect(goalOverlayConfigurationSchema.parse({ ...defaults, lightOuterColor: "#123456" }).lightOuterColor).toBe("#123456");
  });
});
