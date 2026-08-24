import { expect, test } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("player starts in unpaired pairing mode", async ({ page }) => {
  await page.setViewportSize({ height: 1080, width: 1920 });
  await page.goto(playerURL);

  await expect(
    page.getByRole("heading", { name: "Koppel dit scherm aan VeyoCast" })
  ).toBeVisible();
  await expect(page.getByLabel("Pairingcode")).toContainText("VYO 482");
  await expect(page.getByRole("img", { name: "QR-code met tijdelijke VeyoCast-koppelcode" })).toBeVisible();
  await expect(page.getByLabel("Device setupstatus")).toContainText("Wachten op VeyoCast Control");
  const logo = page.getByRole("img", { exact: true, name: "VeyoCast" });
  await expect(logo).toBeVisible();
  const logoBox = await logo.boundingBox();
  expect(logoBox?.height).toBeGreaterThanOrEqual(64);
  await expect(page.locator(".pairing-brand-scene img")).toBeVisible();
  await expect(page.getByLabel("Device setupstatus")).toContainText("Web Player");
  await expect(page.getByLabel("Device setupstatus")).not.toContainText("Code geldig");
  await expect(page.getByLabel("Device setupstatus")).not.toContainText("Geen Supabase Auth-user");
});

test("LG pairing uses the legacy transport and ignores a false browser offline hint", async ({
  page
}) => {
  const requestTypes: Record<string, string[]> = {
    installation: [],
    pairing: []
  };
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false
    });
  });
  await page.route("**/api/player/installation", (route) => {
    requestTypes.installation.push(route.request().resourceType());
    return route.fulfill({
      contentType: "application/json",
      json: {
        bound: false,
        installationCredential: "i".repeat(43),
        live: true,
        ok: true
      }
    });
  });
  await page.route("**/api/player/pairing", (route) => {
    requestTypes.pairing.push(route.request().resourceType());
    return route.fulfill({
      contentType: "application/json",
      json: {
        deviceToken: "p".repeat(43),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        live: true,
        pairingCode: "LGX 234"
      }
    });
  });
  await page.route("**/api/player/heartbeat", (route) => route.fulfill({
    contentType: "application/json",
    json: { ok: false },
    status: 403
  }));

  await page.goto(`${playerURL}/lg`);

  await expect(page.getByLabel("Pairingcode")).toContainText("LGX 234");
  await expect(page.getByLabel("Device setupstatus")).toContainText("Verbonden");
  await expect(
    page.getByText("Geen internetverbinding", { exact: true })
  ).toHaveCount(0);
  expect(requestTypes).toEqual({
    installation: ["xhr"],
    pairing: ["xhr"]
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const diagnostics = JSON.parse(
          localStorage.getItem(
            "veyocast.player.transportDiagnostics.v1"
          ) ?? "[]"
        ) as Array<{
          onlineHint?: boolean;
          path?: string;
          status?: number;
          transport?: string;
        }>;
        return diagnostics.find(
          (entry) => entry.path === "/api/player/pairing"
        );
      })
    )
    .toMatchObject({
      onlineHint: false,
      status: 200,
      transport: "xhr"
    });
});

test("pairing stays completely inside a short Android TV viewport", async ({
  page
}) => {
  await page.setViewportSize({ height: 540, width: 960 });
  await page.goto(playerURL);

  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /width=device-width/
  );
  await expect(page.getByLabel("Pairingcode")).toBeVisible();
  await expect(page.getByLabel("Device setupstatus")).toBeVisible();

  const viewportFit = await page.evaluate(() => {
    const selectors = [
      ".pairing-stage",
      ".pairing-logo",
      ".pairing-heading",
      ".pairing-code-group",
      ".pairing-stage__status",
      ".player-diagnostics"
    ];
    const tolerance = 1;
    const outsideViewport = selectors.filter((selector) => {
      const element = document.querySelector(selector);
      if (!element) return true;
      const box = element.getBoundingClientRect();
      return box.left < -tolerance || box.top < -tolerance ||
        box.right > window.innerWidth + tolerance ||
        box.bottom > window.innerHeight + tolerance;
    });

    return {
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      outsideViewport,
      verticalOverflow: document.documentElement.scrollHeight > window.innerHeight
    };
  });

  expect(viewportFit).toEqual({
    horizontalOverflow: false,
    outsideViewport: [],
    verticalOverflow: false
  });
});

test("LG hervat een opgeslagen pairing met PostgreSQL-microseconden zonder nieuwe code", async ({
  page
}) => {
  let pairingRequests = 0;
  await page.addInitScript(() => {
    const base = new Date(Date.now() + 60_000).toISOString();
    const postgresTimestamp =
      base.slice(0, -1).replace(/(\.\d{3})$/, "$1" + "456") + "+00:00";
    localStorage.setItem("veyocast.player.deviceToken", "m".repeat(43));
    localStorage.setItem("veyocast.player.pairingCode", "MIC 123");
    localStorage.setItem(
      "veyocast.player.pairingExpiresAt",
      postgresTimestamp
    );
  });
  await page.route("**/api/player/pairing", async (route) => {
    pairingRequests += 1;
    await route.fulfill({
      contentType: "application/json",
      json: {
        deviceToken: "unexpected-replacement-token",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        live: true,
        pairingCode: "BAD 429"
      }
    });
  });
  await page.route("**/api/player/heartbeat", (route) =>
    route.fulfill({
      contentType: "application/json",
      json: { error: { code: "PAIRING_PENDING" }, ok: false },
      status: 409
    })
  );

  await page.goto(`${playerURL}/lg`);

  await expect(page.getByLabel("Pairingcode")).toContainText("MIC 123");
  expect(pairingRequests).toBe(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("veyocast.player.deviceToken")
    )
  ).toBe("m".repeat(43));
});

test("pairing uses compact TV density on a 720p display", async ({ page }) => {
  await page.setViewportSize({ height: 720, width: 1280 });
  await page.goto(playerURL);
  await expect(page.getByLabel("Pairingcode")).toBeVisible();
  await expect(page.getByLabel("Device setupstatus")).toBeVisible();

  const layout = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(".pairing-stage");
    const logo = document.querySelector<HTMLElement>(".pairing-logo");
    const title = document.querySelector<HTMLElement>(".runtime-title");
    const code = document.querySelector<HTMLElement>(".player-pairing-code");
    if (!stage || !logo || !title || !code) return null;

    const stageBox = stage.getBoundingClientRect();
    return {
      codeFontSize: Number.parseFloat(getComputedStyle(code).fontSize),
      logoWidth: logo.getBoundingClientRect().width,
      stageHeight: stageBox.height,
      stageWidth: stageBox.width,
      titleFontSize: Number.parseFloat(getComputedStyle(title).fontSize)
    };
  });

  expect(layout).not.toBeNull();
  expect(layout?.stageWidth).toBeLessThanOrEqual(1180);
  expect(layout?.stageHeight).toBeLessThanOrEqual(640);
  expect(layout?.logoWidth).toBeLessThanOrEqual(180);
  expect(layout?.titleFontSize).toBeLessThanOrEqual(44);
  expect(layout?.codeFontSize).toBeLessThanOrEqual(68);
});

test("player pairing becomes static when reduced motion is requested", async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(playerURL);

  const brandIcon = page.locator(".pairing-brand-scene img");
  await expect(brandIcon).toBeVisible();
  await expect(brandIcon).toHaveCSS("animation-name", "none");
  await expect(page.locator(".pairing-brand-accent--orange")).toHaveCSS(
    "animation-name",
    "none"
  );
});

test("recovers automatically when pairing creation is temporarily rate limited", async ({
  page
}) => {
  let pairingRequests = 0;
  const playerInstances: string[] = [];
  const requestNonces: string[] = [];
  await page.route("**/api/player/pairing", (route) => {
    pairingRequests += 1;
    playerInstances.push(
      route.request().headers()["x-veyocast-player-instance"] ?? ""
    );
    requestNonces.push(
      route.request().headers()["x-veyocast-pairing-request"] ?? ""
    );
    if (pairingRequests === 1) {
      return route.fulfill({
        contentType: "application/json",
        headers: { "Retry-After": "1" },
        json: {
          error: {
            cause: "Er zijn te veel koppelcodes voor deze Player aangevraagd.",
            effect: "De Player kan nu geen veilige tijdelijke koppelcode tonen.",
            recovery: "De Player probeert het automatisch opnieuw."
          },
          retryAfterSeconds: 1
        },
        status: 429
      });
    }
    return route.fulfill({
      contentType: "application/json",
      json: {
        deviceToken: "rate-limit-recovery-token",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        live: true,
        pairingCode: "RTY 234"
      }
    });
  });
  await page.route("**/api/player/heartbeat", (route) => route.fulfill({
    contentType: "application/json",
    json: { ok: false },
    status: 403
  }));

  await page.goto(playerURL);
  await expect(
    page.getByRole("heading", { name: "Nieuwe koppelcode voorbereiden" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Playback wacht" })).toHaveCount(0);
  await expect(page.getByLabel("Pairingcode")).toContainText("RTY 234", {
    timeout: 4_000
  });
  await expect(
    page.getByText("Geen internetverbinding", { exact: true })
  ).toHaveCount(0);
  await expect(page.getByLabel("Device setupstatus")).toContainText("Verbonden");
  expect(pairingRequests).toBe(2);
  expect(playerInstances[0]).toMatch(/^[a-f0-9-]{20,80}$/);
  expect(playerInstances[1]).toBe(playerInstances[0]);
  expect(requestNonces[0]).toMatch(/^[a-f0-9-]{20,80}$/);
  expect(requestNonces[1]).toBe(requestNonces[0]);
});

test("reuses one idempotency key across a temporary pairing outage", async ({
  page
}) => {
  let pairingRequests = 0;
  const requestNonces: string[] = [];
  await page.route("**/api/player/pairing", (route) => {
    pairingRequests += 1;
    requestNonces.push(
      route.request().headers()["x-veyocast-pairing-request"] ?? ""
    );
    if (pairingRequests === 1) {
      return route.fulfill({
        contentType: "application/json",
        json: {
          error: {
            cause: "Koppelservice tijdelijk niet beschikbaar.",
            code: "PAIRING_API_UNAVAILABLE"
          }
        },
        status: 503
      });
    }
    return route.fulfill({
      contentType: "application/json",
      json: {
        deviceToken: "temporary-outage-token",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        live: true,
        pairingCode: "TMP 503"
      }
    });
  });
  await page.route("**/api/player/heartbeat", (route) => route.fulfill({
    contentType: "application/json",
    json: { ok: false },
    status: 403
  }));

  await page.goto(playerURL);
  await expect(page.getByLabel("Pairingcode")).toContainText("TMP 503", {
    timeout: 8_000
  });
  expect(pairingRequests).toBe(2);
  expect(requestNonces[0]).toMatch(/^[a-f0-9-]{20,80}$/);
  expect(requestNonces[1]).toBe(requestNonces[0]);
});

test("coalesces rapid refreshes before requesting another pairing code", async ({
  page
}) => {
  let pairingRequests = 0;
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("pairing-cooldown-seeded")) {
      localStorage.setItem(
        "veyocast.player.pairingProvisionAfter",
        String(Date.now() + 5_000)
      );
      sessionStorage.setItem("pairing-cooldown-seeded", "true");
    }
  });
  await page.route("**/api/player/pairing", (route) => {
    pairingRequests += 1;
    return route.fulfill({
      contentType: "application/json",
      json: {
        deviceToken: "refresh-coalescing-token",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        live: true,
        pairingCode: "RFS 234"
      }
    });
  });
  await page.route("**/api/player/heartbeat", (route) => route.fulfill({
    contentType: "application/json",
    json: { ok: false },
    status: 403
  }));

  await page.goto(playerURL);
  await expect(
    page.getByRole("heading", { name: "Nieuwe koppelcode voorbereiden" })
  ).toBeVisible();
  await page.reload();
  await page.waitForTimeout(500);
  expect(pairingRequests).toBe(0);
  await expect(page.getByLabel("Pairingcode")).toContainText("RFS 234", {
    timeout: 7_000
  });
  expect(pairingRequests).toBe(1);
});

test("discards a stale pairing cooldown after the device clock changes", async ({
  page
}) => {
  let pairingRequests = 0;
  await page.addInitScript(() => {
    localStorage.setItem(
      "veyocast.player.pairingProvisionAfter",
      String(Date.now() + 24 * 60 * 60_000)
    );
  });
  await page.route("**/api/player/pairing", (route) => {
    pairingRequests += 1;
    return route.fulfill({
      contentType: "application/json",
      json: {
        deviceToken: "clock-recovery-token",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        live: true,
        pairingCode: "CLK 234"
      }
    });
  });
  await page.route("**/api/player/heartbeat", (route) => route.fulfill({
    contentType: "application/json",
    json: { ok: false },
    status: 403
  }));

  await page.goto(playerURL);
  await expect(page.getByLabel("Pairingcode")).toContainText("CLK 234", {
    timeout: 3_000
  });
  expect(pairingRequests).toBe(1);
});

test("live pairing completes before content exists and keeps reporting readiness", async ({
  page
}) => {
  const demoManifest = await page.request
    .get(`${playerURL}/api/player/manifest?deviceToken=demo-online`)
    .then((response) => response.json());
  let heartbeatAttempts = 0;
  let manifestRequests = 0;
  await page.route("**/api/player/pairing", (route) => route.fulfill({
    contentType: "application/json",
    json: {
      deviceToken: "pending-live-device-token",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      live: true,
      pairingCode: "ABC 234"
    }
  }));
  await page.route("**/api/player/heartbeat", (route) => {
    heartbeatAttempts += 1;
    return route.fulfill({
      contentType: "application/json",
      json: { ok: heartbeatAttempts >= 2 },
      status: heartbeatAttempts >= 2 ? 200 : 403
    });
  });
  await page.route("**/api/player/manifest", (route) => {
    manifestRequests += 1;
    return route.fulfill({
      contentType: "application/json",
      json: manifestRequests === 1 ? waitingContentEnvelope() : demoManifest
    });
  });

  await page.goto(playerURL);
  await expect(page.getByLabel("Pairingcode")).toContainText("ABC 234");
  await expect(page.getByRole("heading", { name: "Wachten op content" })).toBeVisible({
    timeout: 8_000
  });
  await expect(page.getByRole("status")).toContainText("online en gereed");
  expect(heartbeatAttempts).toBeGreaterThanOrEqual(2);
  await expect(page.getByLabel("Pairingcode")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("veyocast.player.deviceToken")))
    .toBe("pending-live-device-token");
  expect(await page.evaluate(() => localStorage.getItem("veyocast.player.pairingCode")))
    .toBeNull();
  await expect(page.getByRole("img", { name: "Clubhuis entree" })).toBeVisible({
    timeout: 10_000
  });
  expect(manifestRequests).toBeGreaterThanOrEqual(2);
});

test("expired pairing rotates automatically to a fresh live code", async ({
  page
}) => {
  let pairingRequests = 0;
  await page.route("**/api/player/pairing", (route) => {
    pairingRequests += 1;
    const firstRequest = pairingRequests === 1;
    return route.fulfill({
      contentType: "application/json",
      json: {
        deviceToken: firstRequest ? "expiring-device-token" : "fresh-device-token",
        expiresAt: new Date(Date.now() + (firstRequest ? 1_500 : 60_000)).toISOString(),
        live: true,
        pairingCode: firstRequest ? "ABC 234" : "DEF 678"
      }
    });
  });
  await page.route("**/api/player/heartbeat", (route) => route.fulfill({
    contentType: "application/json",
    json: { ok: false },
    status: 403
  }));

  await page.goto(playerURL);
  await expect(page.getByLabel("Pairingcode")).toContainText("ABC 234");
  await expect(page.getByLabel("Pairingcode")).toContainText("DEF 678", {
    timeout: 6_000
  });
  expect(pairingRequests).toBe(2);
});

test("revoked identity automatically returns to a fresh pairing session", async ({
  page
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("revoked-seed-applied")) {
      localStorage.setItem("veyocast.player.deviceToken", "revoked-device-token");
      sessionStorage.setItem("revoked-seed-applied", "true");
    }
  });
  await page.route("**/api/player/manifest", (route) => route.fulfill({
    contentType: "application/json",
    json: {
      error: {
        cause: "Het device is ingetrokken.",
        code: "DEVICE_REVOKED",
        effect: "Online toegang is beëindigd.",
        recovery: "Koppel de Player opnieuw."
      },
      state: "UNPAIRED"
    },
    status: 401
  }));
  await page.route("**/api/player/pairing", (route) => route.fulfill({
    contentType: "application/json",
    json: {
      deviceToken: "replacement-device-token",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      live: true,
      pairingCode: "GHJ 789"
    }
  }));
  await page.route("**/api/player/heartbeat", (route) => route.fulfill({
    contentType: "application/json",
    json: { ok: false },
    status: 403
  }));

  await page.goto(playerURL);
  await expect(page.getByLabel("Pairingcode")).toContainText("GHJ 789", {
    timeout: 6_000
  });
  expect(await page.evaluate(() => localStorage.getItem("veyocast.player.deviceToken")))
    .toBe("replacement-device-token");
});

test("tijdelijke 503 verwijdert geen geldige schermcredential", async ({
  page
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "veyocast.player.deviceToken",
      "still-valid-device-token"
    );
  });
  await page.route("**/api/player/manifest", (route) => route.fulfill({
    contentType: "application/json",
    json: {
      error: {
        cause: "De Player-API is tijdelijk niet beschikbaar.",
        code: "PLAYER_API_UNAVAILABLE",
        effect: "Online synchronisatie wacht.",
        recovery: "De Player probeert automatisch opnieuw."
      },
      state: "ERROR_RECOVERABLE"
    },
    status: 503
  }));

  await page.goto(playerURL);
  await expect(page.getByText("Foutcode:")).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("veyocast.player.deviceToken")
    )
  ).toBe("still-valid-device-token");
});

test("definitieve 410 binding expired start automatisch herpairing", async ({
  page
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "veyocast.player.deviceToken",
      "expired-binding-device-token"
    );
  });
  await page.route("**/api/player/manifest", (route) => route.fulfill({
    contentType: "application/json",
    json: {
      error: {
        cause: "De schermbinding is verlopen.",
        code: "BINDING_EXPIRED",
        effect: "De oude credential werkt niet meer.",
        recovery: "De Player vraagt automatisch een nieuwe code aan."
      },
      state: "UNPAIRED"
    },
    status: 410
  }));
  await page.route("**/api/player/pairing", (route) => route.fulfill({
    contentType: "application/json",
    json: {
      deviceToken: "repaired-binding-device-token",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      live: true,
      pairingCode: "KLM 246"
    }
  }));

  await page.goto(playerURL);
  await expect(page.getByLabel("Pairingcode")).toContainText("KLM 246");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("veyocast.player.deviceToken")
    )
  ).toBe("repaired-binding-device-token");
});

function waitingContentEnvelope() {
  const fetchedAt = new Date().toISOString();
  return {
    device: {
      activeReleaseId: null,
      desiredReleaseId: null,
      id: "55555555-5555-4555-8555-555555555555",
      screenId: "44444444-4444-4444-8444-444444444444",
      screenName: "Kantine hoofdscherm"
    },
    diagnostics: {
      lastSuccessfulSyncAt: fetchedAt,
      nextSyncReason: "waiting for first release",
      syncStatus: "online"
    },
    fetchedAt,
    state: "READY"
  };
}
