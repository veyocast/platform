const supabaseUrl = required("SUPABASE_URL").replace(/\/+$/, "");
const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
const apply = process.env.RETENTION_ENFORCEMENT_ENABLED === "true";

const response = await fetch(
  `${supabaseUrl}/rest/v1/rpc/run_retention_maintenance_v1`,
  {
    body: JSON.stringify({ p_apply: apply }),
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json"
    },
    method: "POST"
  }
);
if (!response.ok) {
  console.error(`Retention-run geweigerd (${response.status}).`);
  process.exit(1);
}
const result = await response.json();
console.log(JSON.stringify(result));

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} ontbreekt.`);
  return value;
}

