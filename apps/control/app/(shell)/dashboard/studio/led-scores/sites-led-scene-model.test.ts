import { describe, expect, it } from "vitest";
import { ledScoresCanvasExperienceSchema, ledScoresCanvasMomentKeys } from "@veyocast/contracts";
import { createSitesLedCanvasExperience, buildSitesLedStoredPreview, parseSitesLedStoredState } from "./sites-led-scene-model";
import { createLedScoresCanvasEditorState, ledScoresCanvasEditorReducer, sceneAt } from "./canvas-experience-state";
const stored = { schemaVersion: 1, home: { name: "Werkelijk thuisteam", score: 0 }, away: { name: "Werkelijk uitteam", score: 3 }, sourceUpdatedAt: "2026-10-11T14:00:00.000Z", clock: { anchorSeconds: 3670 }, privateExtra: { personalField: "not selected" } };
describe("LED Sites scenes and stored preview", () => {
 it("creates both screen formats for every moment without provider example scores", () => {
  const experience = createSitesLedCanvasExperience(12_000);
  expect(ledScoresCanvasExperienceSchema.safeParse(experience).success).toBe(true);
  for (const moment of ledScoresCanvasMomentKeys) for (const orientation of ["landscape", "portrait"] as const) expect(experience.scenes[moment][orientation].sitesConfiguration).toMatchObject({ orientation, provider: "led-scores", seconds: 12 });
  expect(buildSitesLedStoredPreview(experience.scenes.goalOwn.landscape.sitesConfiguration!, null)).toBeNull();
 });
 it("projects actual zero scores and a stored clock, leaving extra state fields out", () => {
  const state = parseSitesLedStoredState(stored)!;
  expect(state).not.toHaveProperty("privateExtra");
  const preview = buildSitesLedStoredPreview(createSitesLedCanvasExperience().scenes.goalOwn.landscape.sitesConfiguration!, state);
  expect(preview?.kind === "dynamic" && preview.content.match).toMatchObject({ home: stored.home.name, away: stored.away.name, homeScore: "0", awayScore: "3", clock: "61:10" });
 });
 it("rejects malformed or missing scores instead of inventing a zero score", () => {
  for (const value of [null, {}, { ...stored, home: { name: "Team" } }, { ...stored, away: { name: "Team", score: -1 } }, { ...stored, home: { name: "Team", score: "2" } }, { ...stored, sourceUpdatedAt: "not a date" }]) expect(parseSitesLedStoredState(value)).toBeNull();
 });
 it("does not invent lineup names from scoreboard data", () => {
  const preview = buildSitesLedStoredPreview(createSitesLedCanvasExperience().scenes.lineupHome.landscape.sitesConfiguration!, parseSitesLedStoredState(stored));
  expect(preview?.kind === "dynamic" && preview.content.rows).toEqual([]);
 });
 it("design edits, undo and redo preserve other moments and the independent portrait design", () => {
  const experience = createSitesLedCanvasExperience(); const before = createLedScoresCanvasEditorState(experience);
  const scene = sceneAt(experience, "goalOwn", "landscape");
  const edited = ledScoresCanvasEditorReducer(before, { type: "replace-scene", moment: "goalOwn", orientation: "landscape", scene: { ...scene, sitesConfiguration: { ...scene.sitesConfiguration!, title: "Nieuwe kop", themeId: "onzetrots-tv" } } });
  expect(edited.experience.scenes.goalOwn.portrait).toEqual(experience.scenes.goalOwn.portrait);
  expect(edited.experience.scenes.halfTime).toEqual(experience.scenes.halfTime);
  const undone = ledScoresCanvasEditorReducer(edited, { type: "undo" }); expect(undone.experience).toEqual(experience);
  expect(ledScoresCanvasEditorReducer(undone, { type: "redo" }).experience).toEqual(edited.experience);
 });
});
