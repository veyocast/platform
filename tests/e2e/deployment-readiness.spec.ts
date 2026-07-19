import { expect, test, type APIRequestContext } from "@playwright/test";

const marketingUrl = `http://127.0.0.1:${process.env.MARKETING_PORT ?? 3108}`;
const playerUrl = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

const expectedUnavailableHealth = (service: "control" | "marketing" | "player") => ({
  environment: "unknown",
  revision: "unknown",
  service,
  status: "error"
});

test("Control readiness fails closed without deployment config", async ({ request }) => {
  await expectUnavailableHealth(request, "/api/health", "control");
});

test("Player exposes the canonical unauthenticated health route", async ({ request }) => {
  await expectUnavailableHealth(request, `${playerUrl}/healthz`, "player");
});

test("Marketing readiness fails closed without deployment config", async ({ request }) => {
  await expectUnavailableHealth(request, `${marketingUrl}/api/health`, "marketing");
});

async function expectUnavailableHealth(
  request: APIRequestContext,
  url: string,
  service: "control" | "marketing" | "player"
) {
  const response = await request.get(url);
  expect(response.status()).toBe(503);
  expect(response.headers()["content-type"]).toContain("application/json");
  const body = await response.json();

  expect(body).toEqual(expectedUnavailableHealth(service));
  expect(JSON.stringify(body)).not.toMatch(/key|token|url|secret|supabase/i);
}
