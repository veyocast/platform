import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL } from "node:url";
import { prepareUbuntuCiMirrors, signatureConfig, ubuntuCiMirrors, verifyUbuntuRelease } from "./prepare-ubuntu-ci-mirrors.mjs";

const sourcesPath = "/etc/apt/sources.list.d/ubuntu.sources";
const mirrorPath = "/etc/apt/apt-mirrors.txt";
const originalSources = "Types: deb\nURIs: mirror+file:/etc/apt/apt-mirrors.txt\nSuites: resolute resolute-updates resolute-backports resolute-security\nComponents: main restricted universe multiverse\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n";

function fixture({ rejected = [], invalidSignature = [], wrongSuite = false, wrongOrigin = false, wrongCodename = false } = {}) {
  const files = new Map([
    ["/etc/os-release", 'ID=ubuntu\nVERSION_CODENAME="resolute"\n'],
    [sourcesPath, originalSources],
    [mirrorPath, "http://azure.archive.ubuntu.com/ubuntu\nhttps://security.ubuntu.com/ubuntu\n"],
    ["/etc/apt/sources.list.d/microsoft.sources", "URIs: https://packages.microsoft.com/ubuntu/26.04/prod\nSigned-By: /usr/share/keyrings/microsoft.gpg\n"]
  ]);
  const trace = [];
  const context = { env: { GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: "veyocast/platform", RUNNER_ENVIRONMENT: "github-hosted", RUNNER_OS: "Linux" },
    read: path => files.get(path), exists: path => files.has(path),
    list: path => path.endsWith("sources.list.d") ? ["ubuntu.sources", "microsoft.sources", "../../unsafe.sources"] : ["apt-mirrors.txt"],
    run(command, args, options = {}) {
      trace.push({ command, args, input: options.input });
      if (command === "curl") {
        const url = args.at(-1);
        if (rejected.some(base => url.startsWith(base))) return { status: 6 };
        return { status: 0, stdout: `-----BEGIN PGP SIGNED MESSAGE-----\n${url}` };
      }
      if (command === "gpgv") {
        if (invalidSignature.some(base => options.input.includes(base))) return { status: 1 };
        const suite = /\/dists\/([^/]+)\/InRelease/.exec(options.input)?.[1];
        return { status: 0, stdout: `Origin: ${wrongOrigin ? "Other" : "Ubuntu"}\nSuite: ${wrongSuite ? "noble" : suite}\nCodename: ${wrongCodename ? "noble" : "resolute"}\n` };
      }
      if (command === "sudo") { files.set(args.at(-1), options.input); return { status: 0 }; }
      throw new Error("UNEXPECTED_COMMAND");
    }
  };
  return { context, files, trace };
}

test("healthy canonical transport preserves suites, components, keyrings and non-Ubuntu repositories", () => {
  const state = fixture();
  const result = prepareUbuntuCiMirrors(state.context);
  assert.equal(result.fallback, false);
  assert.equal(result.mirror, ubuntuCiMirrors[0]);
  assert.equal(state.files.get(sourcesPath), originalSources);
  assert.equal(state.files.get(mirrorPath), `${ubuntuCiMirrors[0]}\n${ubuntuCiMirrors[0]}\n`);
  assert.equal(state.files.get("/etc/apt/sources.list.d/microsoft.sources"), "URIs: https://packages.microsoft.com/ubuntu/26.04/prod\nSigned-By: /usr/share/keyrings/microsoft.gpg\n");
  assert.equal(state.trace.filter(call => call.command === "gpgv").length, 4);
  assert.equal(state.files.get("/etc/apt/apt.conf.d/99-veyocast-ci-signatures"), signatureConfig);
});

test("DNS failure selects a bounded HTTPS fallback only after all four real suites verify", () => {
  const state = fixture({ rejected: [ubuntuCiMirrors[0]] });
  const result = prepareUbuntuCiMirrors(state.context);
  assert.equal(result.mirror, ubuntuCiMirrors[1]);
  assert.equal(result.fallback, true);
  const firstWrite = state.trace.findIndex(call => call.command === "sudo");
  assert.equal(state.trace.slice(0, firstWrite).filter(call => call.command === "gpgv").length, 4);
  for (const call of state.trace.filter(call => call.command === "curl")) {
    assert.ok(call.args.includes("--disable"));
    assert.ok(call.args.includes("--max-time"));
    assert.ok(call.args.includes("=https"));
    assert.ok(call.args.includes("2097152"));
  }
  assert.doesNotMatch(JSON.stringify(state.trace), /insecure|resolv\.conf|only-shell|install-deps|apt-get/);
});

test("an invalidly signed reachable mirror is rejected in favor of the next verified mirror", () => {
  const state = fixture({ rejected: [ubuntuCiMirrors[0]], invalidSignature: [ubuntuCiMirrors[1]] });
  assert.equal(prepareUbuntuCiMirrors(state.context).mirror, ubuntuCiMirrors[2]);
});

test("a missing security-suite signature invalidates an otherwise verified candidate before writes", () => {
  const state = fixture();
  const run = state.context.run;
  state.context.run = (command, args, options = {}) => {
    if (command === "gpgv" && options.input.includes(`${ubuntuCiMirrors[0]}/dists/resolute-security/`)) {
      state.trace.push({ command, args, input: options.input });
      return { status: 1 };
    }
    return run(command, args, options);
  };
  assert.equal(prepareUbuntuCiMirrors(state.context).mirror, ubuntuCiMirrors[1]);
  const firstWrite = state.trace.findIndex(call => call.command === "sudo");
  assert.equal(state.trace.slice(0, firstWrite).filter(call => call.command === "gpgv").length, 8);
});

for (const scenario of [{ rejected: ubuntuCiMirrors }, { invalidSignature: ubuntuCiMirrors },
  { wrongSuite: true }, { wrongOrigin: true }, { wrongCodename: true }]) {
  test(`unverifiable transport fails before writes: ${JSON.stringify(scenario)}`, () => {
    const state = fixture(scenario);
    assert.throws(() => prepareUbuntuCiMirrors(state.context), /UBUNTU_CI_NO_VERIFIED_MIRROR/);
    assert.equal(state.trace.some(call => call.command === "sudo"), false);
  });
}

for (const override of [{ RUNNER_ENVIRONMENT: "self-hosted" }, { GITHUB_REPOSITORY: "other/project" },
  { GITHUB_ACTIONS: "false" }, { RUNNER_OS: "Windows" }]) {
  test(`refuses non-owned ephemeral CI scope: ${JSON.stringify(override)}`, () => {
    const state = fixture();
    Object.assign(state.context.env, override);
    assert.throws(() => prepareUbuntuCiMirrors(state.context), /UBUNTU_CI_SCOPE_INVALID/);
    assert.deepEqual(state.trace, []);
  });
}

test("unsupported OS and absent Ubuntu sources fail before any network or privileged command", () => {
  const state = fixture();
  state.files.set("/etc/os-release", "ID=debian\nVERSION_CODENAME=bookworm\n");
  assert.throws(() => prepareUbuntuCiMirrors(state.context), /UBUNTU_CI_RELEASE_INVALID/);
  state.files.set("/etc/os-release", "ID=ubuntu\nVERSION_CODENAME=resolute\n");
  state.files.delete(mirrorPath);
  assert.throws(() => prepareUbuntuCiMirrors(state.context), /UBUNTU_CI_SOURCES_MISSING/);
  assert.deepEqual(state.trace, []);
});

test("repeated fallback is idempotent and returns to canonical transport after recovery", () => {
  const rejected = [ubuntuCiMirrors[0]];
  const state = fixture({ rejected });
  assert.equal(prepareUbuntuCiMirrors(state.context).changedSources, 1);
  assert.equal(prepareUbuntuCiMirrors(state.context).changedSources, 0);
  rejected.length = 0;
  assert.equal(prepareUbuntuCiMirrors(state.context).fallback, false);
  assert.match(state.files.get(mirrorPath), /archive\.ubuntu\.com/);
});

test("a privileged write failure stops before browser installation", () => {
  const state = fixture();
  const run = state.context.run;
  state.context.run = (command, ...args) => command === "sudo" ? { status: 1 } : run(command, ...args);
  assert.throws(() => prepareUbuntuCiMirrors(state.context), /UBUNTU_CI_WRITE_FAILED/);
});

test("unarmored downloads and missing signature verifier never become trusted", () => {
  assert.equal(verifyUbuntuRelease(ubuntuCiMirrors[0], "resolute", "resolute", () => ({ status: 0, stdout: "HTML error" })), false);
  const state = fixture();
  const run = state.context.run;
  assert.equal(verifyUbuntuRelease(ubuntuCiMirrors[0], "resolute", "resolute", (command, ...args) => command === "gpgv" ? { status: null } : run(command, ...args)), false);
});

test("all browser workflows retain complete dependency installation and share the verified transport", () => {
  let installations = 0;
  for (const filename of ["pr-gates.yml", "sites-reference-gates.yml", "database-rls-gates.yml"]) {
    const workflow = readFileSync(new URL(`../.github/workflows/${filename}`, import.meta.url), "utf8");
    const count = (workflow.match(/run: pnpm exec playwright install --with-deps chromium/g) ?? []).length;
    assert.ok(count > 0);
    assert.equal((workflow.match(/run: node scripts\/prepare-ubuntu-ci-mirrors\.mjs/g) ?? []).length, count);
    assert.doesNotMatch(workflow, /playwright install --only-shell|AllowUnauthenticated|trusted=yes/);
    installations += count;
  }
  assert.equal(installations, 6);
});
