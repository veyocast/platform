import assert from "node:assert/strict";

import { getConfig } from "@expo/config";

const projectRoot = new URL("..", import.meta.url).pathname;
const { exp } = getConfig(projectRoot, { skipSDKVersionRequirement: false });

assert.equal(exp.name, "VeyoCast Control");
assert.equal(exp.slug, "veyocast-control");
assert.equal(exp.scheme, "veyocast-control");
assert.equal(exp.android?.package, "nl.veyocast.control");
assert.equal(exp.android?.allowBackup, false);
assert.ok(
  (exp.android?.versionCode ?? 0) >= 300_000_000 &&
    (exp.android?.versionCode ?? 0) <= 399_999_999,
  "Control Mobile moet de eigen versionCode-range gebruiken."
);

const permissions = new Set(exp.android?.permissions ?? []);
assert.ok(permissions.has("android.permission.CAMERA"));
assert.ok(permissions.has("android.permission.POST_NOTIFICATIONS"));
assert.ok(!permissions.has("android.permission.ACCESS_FINE_LOCATION"));

const blocked = new Set(exp.android?.blockedPermissions ?? []);
for (const permission of [
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.RECORD_AUDIO",
  "com.google.android.gms.permission.AD_ID"
]) {
  assert.ok(blocked.has(permission), `${permission} moet geblokkeerd zijn.`);
}

assert.deepEqual(exp.android?.intentFilters, [
  {
    action: "VIEW",
    autoVerify: true,
    data: [
      {
        scheme: "https",
        host: "control.veyocast.nl",
        pathPrefix: "/mobile"
      }
    ],
    category: ["BROWSABLE", "DEFAULT"]
  }
]);

console.log(
  `VeyoCast Control-config gevalideerd: ${exp.android.package} v${exp.android.versionCode}`
);
