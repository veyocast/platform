import { expect, test } from "@playwright/test";

const playerUrl = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("Control readiness is secret-free and fails closed without live config", async ({
  request
}) => {
  const response = await request.get("/api/health");
  expect([200, 503]).toContain(response.status());
  const body = await response.json();

  expect(body).toMatchObject({ app: "control" });
  expect(["ready", "misconfigured"]).toContain(body.status);
  expect(JSON.stringify(body)).not.toMatch(/service.role|anon.key|secret/i);
});

test("Player readiness reports whether pairing can start", async ({ request }) => {
  const response = await request.get(`${playerUrl}/api/health`);
  expect([200, 503]).toContain(response.status());
  const body = await response.json();

  expect(body).toMatchObject({ app: "player" });
  expect(["ready", "unavailable"]).toContain(body.pairing);
  expect(JSON.stringify(body)).not.toMatch(/service.role|anon.key|secret/i);
});
