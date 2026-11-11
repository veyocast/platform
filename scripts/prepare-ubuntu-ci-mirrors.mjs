import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const ubuntuCiMirrors = [
  "https://archive.ubuntu.com/ubuntu",
  "https://mirror.netcologne.de/ubuntu",
  "https://mirrors.edge.kernel.org/ubuntu"
];
const keyring = "/usr/share/keyrings/ubuntu-archive-keyring.gpg";
const signatureConfigPath = "/etc/apt/apt.conf.d/99-veyocast-ci-signatures";
export const signatureConfig = 'Acquire::AllowInsecureRepositories "false";\n'
  + 'Acquire::AllowDowngradeToInsecureRepositories "false";\n'
  + 'APT::Get::AllowUnauthenticated "false";\n'
  + 'Acquire::Check-Valid-Until "true";\n';
const knownBases = /https?:\/\/(?:(?:azure\.archive|archive|security)\.ubuntu\.com\/ubuntu|mirror\.netcologne\.de\/ubuntu|mirrors\.edge\.kernel\.org\/ubuntu)(?=[/\s]|$)/g;

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, { encoding: "utf8", timeout: 15000, maxBuffer: 2097152, ...options });
}

export function verifyUbuntuRelease(base, codename, suite, run = runCommand) {
  const download = run("curl", ["--disable", "--fail", "--silent", "--show-error", "--proto", "=https",
    "--proto-redir", "=https", "--location", "--max-redirs", "3", "--connect-timeout", "3",
    "--max-time", "8", "--max-filesize", "2097152", `${base}/dists/${suite}/InRelease`]);
  if (download.status !== 0 || typeof download.stdout !== "string"
    || !download.stdout.startsWith("-----BEGIN PGP SIGNED MESSAGE-----")) return false;
  const verified = run("gpgv", ["--keyring", keyring, "--output", "-", "-"], { input: download.stdout });
  if (verified.status !== 0 || typeof verified.stdout !== "string") return false;
  const fields = new Map(verified.stdout.split(/\r?\n/).map(line => {
    const match = /^([A-Za-z-]+): (.*)$/.exec(line);
    return match ? [match[1], match[2]] : [];
  }).filter(field => field.length === 2));
  return fields.get("Origin") === "Ubuntu" && fields.get("Suite") === suite && fields.get("Codename") === codename;
}

export function prepareUbuntuCiMirrors({ env = process.env, read = path => readFileSync(path, "utf8"),
  exists = existsSync, list = readdirSync, run = runCommand } = {}) {
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REPOSITORY !== "veyocast/platform"
    || env.RUNNER_ENVIRONMENT !== "github-hosted" || env.RUNNER_OS !== "Linux") throw new Error("UBUNTU_CI_SCOPE_INVALID");
  const release = read("/etc/os-release");
  const id = /^ID=["']?([a-z0-9]+)["']?$/m.exec(release)?.[1];
  const codename = /^VERSION_CODENAME=["']?([a-z]+)["']?$/m.exec(release)?.[1];
  if (id !== "ubuntu" || !codename) throw new Error("UBUNTU_CI_RELEASE_INVALID");
  const paths = new Set(["/etc/apt/sources.list"]);
  for (const filename of list("/etc/apt/sources.list.d")) {
    if (/^[A-Za-z0-9_.-]+\.(?:sources|list)$/.test(filename)) paths.add(`/etc/apt/sources.list.d/${filename}`);
  }
  for (const filename of list("/etc/apt")) {
    if (/^apt-mirrors[A-Za-z0-9_.-]*\.txt$/.test(filename)) paths.add(`/etc/apt/${filename}`);
  }
  const sources = [...paths].filter(exists).map(path => ({ path, content: read(path) }));
  if (!sources.some(source => new RegExp(knownBases).test(source.content))) throw new Error("UBUNTU_CI_SOURCES_MISSING");
  const suites = [codename, `${codename}-updates`, `${codename}-backports`, `${codename}-security`];
  const selected = ubuntuCiMirrors.find(base => suites.every(suite => verifyUbuntuRelease(base, codename, suite, run)));
  if (!selected) throw new Error("UBUNTU_CI_NO_VERIFIED_MIRROR");
  const write = (path, content) => {
    if (run("sudo", ["tee", "--", path], { input: content }).status !== 0) throw new Error("UBUNTU_CI_WRITE_FAILED");
  };
  write(signatureConfigPath, signatureConfig);
  let changedSources = 0;
  for (const source of sources) {
    const updated = source.content.replace(knownBases, selected);
    if (updated !== source.content) { write(source.path, updated); changedSources += 1; }
  }
  return { event: "ubuntu_ci_verified_mirror", mirror: selected, fallback: selected !== ubuntuCiMirrors[0],
    codename, suites, changedSources, signaturesRequired: true, packageInstallationUnchanged: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.stdout.write(`${JSON.stringify(prepareUbuntuCiMirrors())}\n`); }
  catch (error) {
    const code = error instanceof Error && /^UBUNTU_CI_[A-Z_]+$/.test(error.message) ? error.message : "UBUNTU_CI_PREPARATION_FAILED";
    process.stderr.write(`${JSON.stringify({ event: "ubuntu_ci_mirror_failure", code })}\n`);
    process.exitCode = 1;
  }
}
