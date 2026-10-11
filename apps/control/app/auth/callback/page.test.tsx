import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({ runtime: vi.fn(), session: vi.fn(), landing: vi.fn() }));
vi.stubGlobal("React", React);
vi.mock("../../../lib/control-session", () => ({ getControlSession: f.session, getControlLandingPath: f.landing }));
vi.mock("../../../lib/supabase/config", () => ({ getControlRuntimeMode: f.runtime }));
import Page from "./page";

beforeEach(() => { vi.resetAllMocks(); f.runtime.mockReturnValue("live"); f.landing.mockReturnValue("/context"); });
describe("Callback bevestigt alleen een daadwerkelijk gecontroleerde livesessie", () => {
  it("geeft ontbrekende liveactor geen successtatus, naam of dashboardbevestiging", async () => {
    for (const value of [null, { isLive: false, userId: "demo" }, { isLive: true, userId: "" }]) { f.session.mockResolvedValue(value); const html = renderToStaticMarkup(await Page()); expect(html).toContain("Geen aangemelde sessie"); expect(html).toContain("Er is geen toegang bevestigd"); expect(html).toContain('href="/login"'); expect(html).not.toMatch(/Callback gereed|Sessie gecontroleerd|status-pill--success|Je bent aangemeld/); }
    expect(f.landing).not.toHaveBeenCalled();
  });
  it("houdt werkelijke livesessie en bestaande guarded landing intact", async () => {
    const session = { isLive: true, userId: "19170000-0000-4000-8000-000000000001", email: "sites-qa@veyocast.test" }; f.session.mockResolvedValue(session); const html = renderToStaticMarkup(await Page()); expect(html).toContain("Callback gereed"); expect(html).toContain("Sessie gecontroleerd"); expect(html).toContain('href="/context"'); expect(f.landing).toHaveBeenCalledExactlyOnceWith(session);
  });
  it("houdt expliciete demomodus voorbereid en unavailable fail-closed", async () => {
    f.runtime.mockReturnValue("demo"); let html = renderToStaticMarkup(await Page()); expect(html).toContain("Callback voorbereid"); expect(html).toContain("Sessiecontrole voorbereid"); expect(html).not.toContain("status-pill--success");
    f.runtime.mockReturnValue("unavailable"); html = renderToStaticMarkup(await Page()); expect(html).toContain("Sessie niet beschikbaar"); expect(html).toContain('href="/login"'); expect(f.session).not.toHaveBeenCalled();
  });
});
