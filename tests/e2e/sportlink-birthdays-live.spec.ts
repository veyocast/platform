import { createHash, randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const enabled = process.env.VEYOCAST_LIVE_BIRTHDAYS_E2E === "1";
const tenantId = "10000000-0000-4000-8000-000000000101";

test.describe("Sportlink-verjaardagen", () => {
  test.skip(!enabled, "requires a freshly reset isolated local Supabase stack");
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anonKey || !serviceRoleKey) {
      throw new Error("Birthday E2E requires the local Supabase configuration.");
    }
    const user = createClient(url, anonKey, { auth: { persistSession: false } });
    const auth = await user.auth.signInWithPassword({
      email: "pilot-admin@veyocast.test", password: "veyocast-local"
    });
    if (auth.error) throw auth.error;
    const connected = await user.rpc("upsert_sportlink_connection_v1", {
      p_client_id_suffix: "E2E1", p_data_source_name: "Sportlink · Verjaardag E2E",
      p_detected_club_name: "VeyoCast United", p_encrypted_client_id: "encrypted-e2e-client",
      p_encryption_iv: "initialization-vector", p_encryption_tag: "authentication-tag",
      p_tenant_id: tenantId
    });
    if (connected.error || typeof connected.data !== "string") {
      throw connected.error ?? new Error("Sportlink connection fixture failed");
    }
    const connectionId = connected.data;
    const activated = await user.rpc("activate_sportlink_birthdays_v1", {
      p_connection_id: connectionId, p_enabled: true
    });
    if (activated.error) throw activated.error;
    const pausedBirthdays = await user.rpc("update_sportlink_sync_policy_v1", {
      p_connection_id: connectionId,
      p_dataset_group: "public_people",
      p_enabled: false,
      p_frequency: "daily"
    });
    if (pausedBirthdays.error) throw pausedBirthdays.error;
    for (const datasetGroup of [
      "club_profile", "teams", "competitions", "matches", "match_details", "activities", "volunteers"
    ]) {
      const disabled = await user.rpc("update_sportlink_sync_policy_v1", {
        p_connection_id: connectionId, p_dataset_group: datasetGroup,
        p_enabled: datasetGroup === "teams",
        p_frequency: datasetGroup === "matches" || datasetGroup === "match_details" ? "hourly" : "daily"
      });
      if (disabled.error) throw disabled.error;
    }

    const service = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
    const run = await service.rpc("claim_due_sportlink_sync_v2", {
      p_lock_timeout_seconds: 900, p_worker_id: "e2e:birthdays"
    });
    const teamClaim = Array.isArray(run.data) ? run.data.find((item) =>
      item.connection_id === connectionId && item.dataset_group === "teams"
    ) : null;
    if (run.error || !teamClaim) {
      throw run.error ?? new Error("Sportlink team run fixture failed");
    }
    const completedTeams = await service.rpc("complete_sportlink_sync_v4", {
      p_activities: [],
      p_club: {},
      p_club_logo: {},
      p_matches: [],
      p_run_id: teamClaim.run_id,
      p_standings: [],
      p_team_logos: [],
      p_teams: [{ externalId: "jo17-1", localExternalId: "-1", name: "JO17-1" }],
      p_worker_id: "e2e:birthdays"
    });
    if (completedTeams.error) throw completedTeams.error;
    const disabledTeams = await user.rpc("update_sportlink_sync_policy_v1", {
      p_connection_id: connectionId,
      p_dataset_group: "teams",
      p_enabled: false,
      p_frequency: "daily"
    });
    if (disabledTeams.error) throw disabledTeams.error;
    const enabledBirthdays = await user.rpc("update_sportlink_sync_policy_v1", {
      p_connection_id: connectionId,
      p_dataset_group: "public_people",
      p_enabled: true,
      p_frequency: "daily"
    });
    if (enabledBirthdays.error) throw enabledBirthdays.error;
    const birthdayRun = await service.rpc("claim_due_sportlink_sync_v2", {
      p_lock_timeout_seconds: 900,
      p_worker_id: "e2e:birthdays"
    });
    const claimed = Array.isArray(birthdayRun.data) ? birthdayRun.data.find((item) =>
      item.connection_id === connectionId && item.dataset_group === "public_people"
    ) : null;
    if (birthdayRun.error || !claimed) {
      throw birthdayRun.error ?? new Error("Birthday run fixture failed");
    }
    const today = tenantDate(0);
    const tomorrow = tenantDate(1);
    const identityKey = createHash("sha256").update("code:M1").digest("hex").slice(0, 40);
    const completed = await service.rpc("complete_sportlink_birthdays_v1", {
      p_birthdays: [{
        day: today.day, displayName: "Aafke van der Meer-Schoonhoven",
        externalId: createHash("sha256").update("birthday:aafke").digest("hex").slice(0, 40),
        matchStatus: "matched", memberIdentityKey: identityKey, month: today.month,
        nextOccurrence: today.iso, normalizedName: "aafke van der meer-schoonhoven",
        role: "Speler", teamAssignments: [{ externalId: "jo17-1", name: "JO17-1" }]
      }, {
        day: tomorrow.day, displayName: "Milan de Jong",
        externalId: createHash("sha256").update("birthday:milan").digest("hex").slice(0, 40),
        matchStatus: "unmatched", month: tomorrow.month, nextOccurrence: tomorrow.iso,
        normalizedName: "milan de jong", role: null, teamAssignments: []
      }],
      p_fetched_at: new Date().toISOString(), p_person_photos: [], p_run_id: claimed.run_id,
      p_team_members: [{
        displayName: "Aafke van der Meer-Schoonhoven", externalMemberCode: "M1",
        identityKey, normalizedName: "aafke van der meer-schoonhoven", role: "Speler",
        teamAssignments: [{ externalId: "jo17-1", name: "JO17-1" }]
      }], p_worker_id: "e2e:birthdays"
    });
    if (completed.error) throw completed.error;
    const imported = await user.rpc("apply_sportlink_birthday_import_v1", {
      p_connection_id: connectionId, p_idempotency_key: randomUUID(),
      p_rows: [{ errors: [], normalized: {
        birthDay: today.day, birthMonth: today.month, birthYear: today.year - 16,
        displayName: "Aafke van der Meer-Schoonhoven", externalMemberCode: "M1",
        normalizedName: "aafke van der meer-schoonhoven", role: "Speler", team: "JO17-1"
      }, rowNumber: 2, status: "valid" }],
      p_source_checksum_sha256: "e".repeat(64), p_source_file_name: "birthdays-e2e.csv",
      p_tenant_id: tenantId
    });
    if (imported.error) throw imported.error;
  });

  test("beheert, previewt en bewaart een echte dynamische verjaardagsslide", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/login");
    await page.getByLabel("E-mailadres").fill("pilot-admin@veyocast.test");
    await page.getByLabel("Wachtwoord").fill("veyocast-local");
    await page.getByRole("button", { name: "Doorgaan" }).click();
    await page.waitForURL(/\/context/, { timeout: 15_000 });
    await page.getByRole("button", { name: "Open vereniging" }).click();
    await page.waitForURL(/\/dashboard$/);

    await page.goto("/dashboard/data-sources/sportlink#verjaardagen");
    const integration = page.locator("#verjaardagen");
    await expect(integration.getByRole("heading", { name: "Verjaardagen" })).toBeVisible();
    await expect(integration).toContainText("Binnen 21 dagen2");
    await expect(integration).toContainText("Bekende leeftijd1");
    await expect(integration).toContainText("Actueel");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      fullPage: true, path: "docs/screenshots/s138-birthday-wizard/integratiestatus.png"
    });

    await page.goto("/dashboard/studio/sportlink/birthdays/new");
    await expect(page.getByRole("heading", { level: 1, name: "Sportlink — Verjaardagen" })).toBeVisible();
    await expect(page.getByText("Actuele genormaliseerde data")).toBeVisible();
    await expect(page.getByText("Aafke van der Meer-Schoonhoven")).toBeVisible();
    await expect(page.getByText("Aafke wordt vandaag 16 jaar")).toBeVisible();
    await page.getByRole("button", { exact: true, name: "Volgende" }).click();
    await expect(page.getByRole("heading", { name: "Selectie en informatie" })).toBeVisible();
    await expect(page.getByText("Leeftijd tonen")).toBeVisible();
    await page.getByRole("button", { name: /Alle teams en overige/ }).click();
    await expect(page.getByRole("heading", { name: "Teams en overige selecteren" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Alle/ })).toBeChecked();
    await page.getByRole("checkbox", { name: /Overige \(zonder team\)/ }).check();
    await page.getByRole("checkbox", { name: /JO17-1/ }).check();
    await expect(page.getByRole("checkbox", { name: /Overige \(zonder team\)/ })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /JO17-1/ })).toBeChecked();
    await page.getByRole("button", { name: "Keuze toepassen" }).click();
    await expect(page.getByRole("button", { name: /2 selecties/ })).toBeVisible();
    await page.setViewportSize({ height: 844, width: 390 });
    await page.getByRole("button", { name: /2 selecties/ }).click();
    await expect(page.getByRole("heading", { name: "Teams en overige selecteren" })).toBeVisible();
    await expect(page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )).resolves.toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "Annuleren" }).click();
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.getByRole("button", { exact: true, name: "Volgende" }).click();
    await expect(page.getByRole("heading", { name: "Vormgeving" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Liggend/ })).toBeChecked();
    await page.getByRole("radio", { name: /Staand/ }).check();
    await expect(page.getByRole("radio", { name: /Staand/ })).toBeChecked();
    await expect(page.getByText(/9:16 · pagina/)).toBeVisible();
    await page.getByRole("button", { exact: true, name: "Volgende" }).click();
    await expect(page.getByRole("heading", { name: "Preview en publiceren" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Staand/ })).toBeChecked();
    await expect(page.getByText("Duur automatisch aanpassen is actief.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Slide aanmaken" })).toBeEnabled();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      fullPage: true, path: "docs/screenshots/s138-birthday-wizard/wizard.png"
    });

    await page.setViewportSize({ height: 844, width: 390 });
    await expect(page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )).resolves.toBe(true);
    await page.screenshot({
      fullPage: true, path: "docs/screenshots/s138-birthday-wizard/wizard-mobile.png"
    });
    await page.getByRole("button", { name: "Slide aanmaken" }).click();
    await page.waitForURL(/\/dashboard\/slides\?succes=/, { timeout: 20_000 });
    await expect(page.getByRole("status")).toContainText("De verjaardagsslide is aangemaakt");
    await expect(page.getByRole("heading", { level: 3, name: "Verjaardagen" }).first()).toBeVisible();
  });
});

function tenantDate(offsetDays: number) {
  const value = new Date(Date.now() + offsetDays * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit", month: "2-digit", timeZone: "Europe/Amsterdam", year: "numeric"
  }).formatToParts(value);
  const number = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const year = number("year"); const month = number("month"); const day = number("day");
  return { day, iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, month, year };
}
