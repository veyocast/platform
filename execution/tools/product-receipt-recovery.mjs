import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

assert.equal(process.env.VEYOCAST_S226_LOCAL_ACCEPTANCE, "1");
assert.equal(process.cwd(), "/home/codex/repos/castivo-s226");
const configFile = "/tmp/veyocast-s226-local-status.json";
const stateFile = "/tmp/veyocast-s226-qa-auth-state.json";
for (const file of [configFile, stateFile]) assert.equal(statSync(file).mode & 0o777, 0o600);
const config = JSON.parse(readFileSync(configFile, "utf8"));
const state = JSON.parse(readFileSync(stateFile, "utf8"));
assert.equal(new URL(config.API_URL).origin, "http://127.0.0.1:57621");
assert.equal(new URL(config.DB_URL).port, "57622");
const container = "supabase_db_veyocast-s226";
assert.equal(execFileSync("docker", ["inspect", "--format", '{{.Name}} {{ index .Config.Labels "com.supabase.cli.project" }}', container], {encoding: "utf8"}).trim(), "/supabase_db_veyocast-s226 veyocast-s226");
const require = createRequire(`${process.cwd()}/apps/control/package.json`);
const { createServerClient } = require("@supabase/ssr");
const tenant = "19170000-0000-4000-8000-000000000010";
const user = "19170000-0000-4000-8000-000000000001";
const source = randomUUID(), key = randomUUID();
let loseResponse = false, droppedReceipt = null, droppedCount = 0;
function client() {
  const cookies = new Map(state.cookies.map(c => [c.name, c]));
  return createServerClient(config.API_URL, config.ANON_KEY, {
    cookies: {getAll: () => [...cookies.values()], setAll: values => values.forEach(c => cookies.set(c.name, c))},
    global: {async fetch(input, init) {
      const url = new URL(typeof input === "string" ? input : input.url ?? String(input));
      assert.equal(url.origin, "http://127.0.0.1:57621");
      const response = await fetch(input, {...init, signal: AbortSignal.timeout(15000)});
      if (loseResponse && url.pathname.endsWith("/manage_tenant_product_v2") && JSON.parse(init.body).p_idempotency_key === key) {
        loseResponse = false;
        assert.equal(response.status, 200);
        droppedReceipt = await response.json();
        droppedCount++;
        throw new TypeError("Deliberately withheld a real committed local response");
      }
      return response;
    }}
  });
}
const first = client(), second = client();
const identity = await first.auth.getUser();
assert.equal(identity.data.user?.id, user);
assert.equal((await first.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel, "aal2");
// Only fixture setup uses the disposable DB owner. Every product command below
// is sent through actual authenticated PostgREST with the real tenant context.
execFileSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], {
  input: `insert into public.dynamic_data_sources(id,tenant_id,kind,name,status) values('${source}','${tenant}','manual_products','S226 lokale retryproef','active');`,
  stdio: ["pipe", "pipe", "pipe"]
});
const values = {name: "S226 product ontvangstbewijs", description: null, category: "Dranken", priceCents: 235, vatRate: 9, unit: "glas", barcode: null, externalId: "S226-retry", active: true};
const creation = await first.rpc("manage_tenant_product_v2", {p_tenant_id: tenant, p_product_id: null, p_data_source_id: source, p_expected_revision: 0, p_action: "create", p_values: values, p_idempotency_key: randomUUID()}).retry(false);
assert.equal(creation.error, null);
assert.equal(creation.data.outcome, "created");
const product = creation.data.productId;
const attempt = {p_tenant_id: tenant, p_product_id: product, p_data_source_id: null, p_expected_revision: 1, p_action: "update", p_values: {...values, active: false}, p_idempotency_key: key};
loseResponse = true;
const lost = await first.rpc("manage_tenant_product_v2", attempt).retry(false);
assert.ok(lost.error);
assert.equal(droppedCount, 1);
assert.equal(droppedReceipt.revision, 2);
async function read() {
  const r = await first.from("tenant_products").select("id,name,price_cents,active,revision").eq("tenant_id", tenant).eq("id", product).single();
  assert.equal(r.error, null); return r.data;
}
const afterLoss = await read();
assert.equal(afterLoss.active, false); assert.equal(afterLoss.revision, 2);
const changed = await second.rpc("manage_tenant_product_v2", {...attempt, p_expected_revision: 2, p_idempotency_key: randomUUID(), p_values: {...attempt.p_values, name: "Bewaard door tweede sessie", priceCents: 275}}).retry(false);
assert.equal(changed.error, null); assert.equal(changed.data.revision, 3);
const replay = await first.rpc("manage_tenant_product_v2", attempt).retry(false);
assert.equal(replay.error, null); assert.deepEqual(replay.data, droppedReceipt);
const afterReplay = await read();
assert.deepEqual(afterReplay, {id: product, name: "Bewaard door tweede sessie", price_cents: 275, active: false, revision: 3});
const evidence = {status: "PASS", environment: "disposable local Supabase", transport: "actual authenticated AAL2 PostgREST; one real response withheld after commit", tenant, product, droppedResponseCount: droppedCount, afterLoss, concurrentRevision: changed.data.revision, recoveredReceipt: replay.data, afterReplay, conclusion: "Original receipt recovered without overwriting a later edit or incrementing the revision; no browser or hosted acceptance claim"};
writeFileSync("execution/evidence/product-receipt-recovery.json", JSON.stringify(evidence, null, 2) + "\n");
process.stdout.write(JSON.stringify({status: "PASS", droppedResponseCount: droppedCount, recoveredRevision: replay.data.revision, preservedCurrentRevision: afterReplay.revision}) + "\n");
