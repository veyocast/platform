import { describe, expect, it } from "vitest";

import {
  mediaViewHref,
  mediaViewStateFromSearch,
  mediaViewStateFromStorage,
  mediaViewStateKey,
  mediaViewStateToStorage,
  parseMediaViewStatePayload
} from "./saved-media-view";

describe("opgeslagen mediaweergaven", () => {
  it("bewaart alleen de ondersteunde, gevalideerde URL-status", () => {
    expect(mediaViewStateFromSearch({
      favorite: "true",
      folder: "10000000-0000-4000-8000-000000000451",
      from: "2026-07-01",
      q: "  Sponsor  ",
      sort: "size",
      status: "ready",
      tag: "not-a-uuid",
      to: "2026-07-31",
      type: "video",
      usage: "used",
      view: "grid"
    })).toEqual({
      favorite: "true",
      folder: "10000000-0000-4000-8000-000000000451",
      from: "2026-07-01",
      q: "Sponsor",
      sort: "size",
      status: "ready",
      to: "2026-07-31",
      type: "video",
      usage: "used",
      view: "grid"
    });
  });

  it("zet de persoonlijke weergave verliesloos om naar het versiecontract", () => {
    const state = mediaViewStateFromSearch({
      favorite: "true",
      folder: "root",
      q: "kantine",
      sort: "oldest",
      view: "grid"
    });
    const stored = mediaViewStateToStorage(state);

    expect(stored.filterJson).toMatchObject({
      favoritesOnly: true,
      layout: "grid",
      query: "kantine",
      rootOnly: true,
      schemaVersion: 1
    });
    expect(stored.sortJson).toEqual([{ direction: "asc", field: "created_at" }]);
    expect(mediaViewStateFromStorage(stored.filterJson, stored.sortJson)).toEqual(state);
  });

  it("weigert onbekende of onveilige opgeslagen contracten", () => {
    expect(mediaViewStateFromStorage({ schemaVersion: 2 }, [])).toBeNull();
    expect(mediaViewStateFromStorage([], [])).toBeNull();
    expect(parseMediaViewStatePayload('{"q":"ok","unexpected":{"nested":true}}')).toEqual({ q: "ok" });
    expect(parseMediaViewStatePayload('{"q":')).toBeNull();
  });

  it("maakt uitsluitend een lokale Media-route en een stabiele vergelijkingssleutel", () => {
    const state = { q: "Sponsor", sort: "name" as const, view: "grid" as const };
    expect(mediaViewHref(state)).toBe("/dashboard/media?q=Sponsor&sort=name&view=grid");
    expect(mediaViewStateKey(state)).toBe(mediaViewStateKey({
      q: " Sponsor ",
      sort: "name",
      view: "grid"
    }));
  });
});
