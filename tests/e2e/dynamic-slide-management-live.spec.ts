import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { isLocalSupabaseUrl } from "../helpers/supabase-environment-guard";
import { defaultGoalOverlayConfiguration } from "../../packages/contracts/src/goal-overlay";

const enabled = process.env.VEYOCAST_LIVE_STUDIO_E2E === "1";
const fixtureSuffix = randomUUID().slice(-12);
const tenantId = `10000000-0000-4000-8000-${fixtureSuffix}`;
const fixtureEmail = `s177-owner-${fixtureSuffix}@veyocast.test`;
let seniorId = "";
let youthId = "";

test.describe("Datagedreven slidebeheer met echte tenantsessie", () => {
  test.skip(!enabled, "requires a freshly reset isolated local Supabase stack");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.beforeAll(() => {
    if (!isLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
      throw new Error("This fixture requires local Supabase.");
    }
    const source = readFileSync(resolve("supabase/tests/rls_s177_dynamic_slide_management.sql"), "utf8");
    const setup = source.slice(0, source.indexOf("select is(pg_temp.snapshot('senior')"));
    const draftStart = source.indexOf("create function pg_temp.draft(");
    const draft = source.slice(draftStart, source.indexOf("\n$$;", draftStart) + 4);
    const sql = `${setup}
      ${draft}
      update auth.users set instance_id='00000000-0000-0000-0000-000000000000',
        raw_app_meta_data='{"provider":"email","providers":["email"]}',
        encrypted_password=extensions.crypt('veyocast-local',extensions.gen_salt('bf')),
        confirmation_token='',recovery_token='',email_change_token_new='',email_change='' where email='s177-owner@veyocast.test';
      insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
        select id,id,id::text,jsonb_build_object('sub',id,'email',email),'email',now(),now(),now()
        from auth.users where email='s177-owner@veyocast.test';
      set local role authenticated;
      select set_config('request.jwt.claim.role','authenticated',true);
      select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001771',true);
      select public.create_sportlink_slide_batch_v6(tenant_id,data_source_id,
        jsonb_build_array(pg_temp.draft('Senioren bekerstand'),pg_temp.draft('Jeugd fase 1','youth')),
        '60000000-0000-4000-8000-000000001779') from s177_source;
      reset role;
      insert into public.tenant_feature_flags(tenant_id,flag_key,enabled,rollout_reason,changed_by)
        values ('${tenantId}','ledscores_realtime',true,'S177 local browser fixture','00000000-0000-4000-8000-000000001771');
      insert into public.screen_groups(id,tenant_id,name,created_by,updated_by)
        values ('31000000-0000-4000-8000-${fixtureSuffix}','${tenantId}','Goal testgroep','00000000-0000-4000-8000-000000001771','00000000-0000-4000-8000-000000001771');
      insert into public.ledscores_connections(id,tenant_id,name,club_slug,provider_club_id,provider_club_name)
        values ('71000000-0000-4000-8000-${fixtureSuffix}','${tenantId}','LED Scores test','s177-club','213','Fixtureclub');
      insert into public.ledscores_team_mappings(tenant_id,connection_id,provider_team_key,provider_team_name,scoring_side)
        values ('${tenantId}','71000000-0000-4000-8000-${fixtureSuffix}','29643','Fixtureclub 1','own');
      set local role authenticated;
      select public.save_ledscores_goal_overlay_v2('${tenantId}',null,0,'${JSON.stringify(defaultGoalOverlayConfiguration)}'::jsonb,
        '[{"connectionId":"71000000-0000-4000-8000-${fixtureSuffix}","clubId":"213","teamKey":"29643"}]'::jsonb,
        array['31000000-0000-4000-8000-${fixtureSuffix}']::uuid[]);
      reset role;
      update public.dynamic_slide_snapshots set status='ready',completed_at=now() where tenant_id='${tenantId}';
      update public.dynamic_slides s set status='ready',current_snapshot_id=(select x.id from public.dynamic_slide_snapshots x where x.tenant_id=s.tenant_id and x.dynamic_slide_id=s.id limit 1) where s.tenant_id='${tenantId}';
      select jsonb_object_agg(configuration_json#>>'{context,providerTeamId}',id) from public.dynamic_slides where tenant_id='${tenantId}';
      commit;`.replaceAll("000000001771", fixtureSuffix)
      .replaceAll("s177-owner@veyocast.test", fixtureEmail)
      .replaceAll("s177-tenant", `s177-${fixtureSuffix}`);
    const output = execFileSync("docker", ["exec", "-i", "supabase_db_veyocast-platform", "psql", "-X", "-At", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], { input: sql, encoding: "utf8" });
    const ids = output.split("\n").findLast((line) => line.startsWith('{"youth"') || line.startsWith('{"senior"'));
    if (!ids) throw new Error("Fixture slide IDs were not returned.");
    const parsed = JSON.parse(ids) as { senior: string; youth: string };
    seniorId = parsed.senior;
    youthId = parsed.youth;
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mailadres").fill(fixtureEmail);
    await page.getByLabel("Wachtwoord").fill("veyocast-local");
    await page.getByRole("button", { name: "Doorgaan" }).click();
    await page.waitForURL(/\/context/);
    await page.getByRole("button", { name: "Open vereniging" }).click();
    await page.waitForURL(/\/dashboard$/);
  });

  test("toont actuele inhoud, hernoemt en opent een gepubliceerd onderdeel zonder 404", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/dashboard/slides");
    await expect(page.getByRole("heading", { name: "Datagedreven slides", exact: true })).toBeVisible();
    const row = page.getByRole("row").filter({ has: page.getByText("Senioren bekerstand", { exact: true }) });
    await expect(row).toContainText("Senioren 1");
    await expect(row).toContainText("Gepubliceerd");
    await expect(row).toContainText("Inhoud beschikbaar");
    await row.getByRole("button", { name: "Meer informatie over Senioren bekerstand" }).click();
    const details = page.locator(`#slide-details-${seniorId}`);
    await expect(details).toContainText("bekerfase");
    await expect(details).toContainText("Sportlink · S177");
    await expect(details).not.toContainText("nog niet bepaald");
    await page.screenshot({ path: testInfo.outputPath("slidebeheer-desktop.png"), fullPage: true });
    await expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await row.getByRole("button", { name: "Naam van Senioren bekerstand wijzigen" }).click();
    await page.getByLabel("Naam in bibliotheek").fill("Kantine · Senioren beker");
    await page.getByRole("button", { name: "Naam opslaan" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText("Kantine · Senioren beker", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Kantine · Senioren beker bewerken" }).click();
    await page.waitForURL(new RegExp(`/dashboard/slides/${seniorId}/edit`));
    await expect(page.getByLabel("Titel op de slide")).toBeVisible();
    await page.getByLabel("Titel op de slide").fill("De actuele bekerstand");
    await page.getByRole("button", { name: "Concept opslaan" }).click();
    await expect(page.getByText("Conceptversie opgeslagen.", { exact: true })).toBeVisible();
    await expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.goto("/dashboard/slides?q=Kantine");
    await expect(page.getByText("Kantine · Senioren beker", { exact: true })).toBeVisible();
    await expect(page.getByText("Jeugd fase 1", { exact: true })).not.toBeVisible();
    expect(errors).toEqual([]);
  });

  test("herstelt een oude directe bewerklink met een veilige conceptactie", async ({ page }) => {
    await page.goto(`/dashboard/slides/${youthId}/edit`);
    await expect(page.getByRole("button", { name: "Slide bewerken", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Slide bewerken", exact: true }).click();
    await expect(page.getByLabel("Titel op de slide")).toBeVisible();
    await page.goto(`/dashboard/slides/${youthId}/edit`);
    await expect(page.getByLabel("Titel op de slide")).toBeVisible();
  });

  test("toont bruikbare mobiele rijen, toetsenborddetails en een compacte typekeuze", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/slides?kind=sport_standing");
    const row = page.getByRole("row").filter({ has: page.getByText("Jeugd fase 1", { exact: true }) });
    const more = row.getByRole("button", { name: "Meer informatie over Jeugd fase 1" });
    await more.focus();
    await page.keyboard.press("Enter");
    await expect(more).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(`#slide-details-${youthId}`)).toContainText("Jeugd O16-1");
    await expectNoOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("slidebeheer-mobiel.png"), fullPage: true });
    await expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.goto("/dashboard/studio/sportlink/new");
    await expect(page.getByRole("group", { name: "Programma · club selecteren", exact: true })).toBeVisible();
    await expect(page.getByRole("group", { name: "Programma · club selecteren", exact: true }).getByRole("button")).toHaveCount(2);
    await page.screenshot({ path: testInfo.outputPath("typekeuze-mobiel.png"), fullPage: true });
    await expectNoOverflow(page);
    await expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
  test("geeft een naam vóór aanmaken en verwijst bij een dubbel doel naar de bestaande slide", async ({ page }, testInfo) => {
    await page.goto("/dashboard/studio/sportlink/new");
    await page.getByRole("group", { name: "Stand · poule selecteren", exact: true }).getByRole("button").click();
    await page.getByRole("button", { name: "Volgende", exact: true }).click();
    await page.getByRole("button", { name: /Kies minimaal één team/ }).click();
    await page.getByRole("checkbox", { name: /Senioren 1/ }).check();
    await page.getByRole("button", { name: "Volgende", exact: true }).click();
    await page.getByRole("button", { name: "Volgende", exact: true }).click();
    await page.getByRole("button", { name: /Liggend/ }).click();
    await page.getByRole("button", { name: "Volgende", exact: true }).click();
    await page.getByRole("textbox", { name: /Slidenaam Senioren 1/ }).fill("Kantine · Bekerstand nieuw");
    await page.getByRole("button", { name: "1 slide aanmaken", exact: true }).click();
    await expect(page.getByText(/Voor deze selectie bestaan al slides/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Kantine · Senioren beker.*Bestaat al/ })).toHaveAttribute("href", `/dashboard/slides/${seniorId}/edit`);
    await page.screenshot({ path: testInfo.outputPath("dubbele-selectie.png"), fullPage: true });
    await page.getByRole("button", { name: "Vorige", exact: true }).click();
    await page.getByRole("button", { name: /Staand/ }).click();
    await page.getByRole("button", { name: "Volgende", exact: true }).click();
    await page.getByRole("textbox", { name: /Slidenaam Senioren 1/ }).fill("Entree · Bekerstand portrait");
    await expect(page.getByText("Slides gemaakt.", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "1 slide aanmaken", exact: true }).click();
    await expect(page.getByRole("link", { name: /Entree · Bekerstand portrait/ })).toBeVisible();
    await page.goto("/dashboard/slides?q=Entree");
    await expect(page.getByText("Entree · Bekerstand portrait", { exact: true })).toBeVisible();
  });
  test("bewerkt Goal Overlay-kleuren op mobiel, valideert en bewaart de eigen kleur", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/dashboard/studio/led-scores/goal-overlay");
    await page.getByRole("button", { name: "Design", exact: true }).click();
    const color = page.getByRole("textbox", { name: "Buitenachtergrond · light", exact: true });
    await expect(color).toBeEditable();
    await color.fill("#123");
    await expect(color).toHaveAttribute("aria-invalid", "true");
    await page.getByRole("button", { name: "Timing", exact: true }).click();
    await expect(page.getByRole("button", { name: "Concept opslaan", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Design", exact: true }).click();
    await color.fill("#124567");
    await expect(page.getByLabel("Buitenachtergrond · light kiezen", { exact: true })).toHaveValue("#124567");
    await expect(page.locator(".vc-goal")).toHaveCSS("background-color", "rgb(18, 69, 103)");
    await expectNoOverflow(page);
    await expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("goal-kleuren-mobiel.png"), fullPage: true });
    await page.getByRole("button", { name: "Concept opslaan", exact: true }).click();
    await expect(page.getByText(/Concept opgeslagen\. Publiceer/)).toBeVisible();
    await page.getByRole("button", { name: "Design", exact: true }).click();
    await expect(color).toHaveValue("#124567");
    await page.getByRole("button", { name: "Buitenachtergrond · light automatisch", exact: true }).click();
    await expect(color).toHaveValue("");
    await expect(page.locator(".vc-goal")).toHaveCSS("background-color", "rgb(36, 89, 237)");
    expect(errors).toEqual([]);
  });
});

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}
