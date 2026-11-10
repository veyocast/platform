export const DEPLOYMENT_CONCURRENCY_GROUP = "deploy-veyocast-main-20261110";

const writerGroups = Object.freeze({
  "deploy.yml": DEPLOYMENT_CONCURRENCY_GROUP,
  "runner-disk-maintenance.yml": DEPLOYMENT_CONCURRENCY_GROUP,
  "recover-data-api.yml": DEPLOYMENT_CONCURRENCY_GROUP,
  "probe-publication-runtime.yml": `\${{ inputs.quiesce_worker && '${DEPLOYMENT_CONCURRENCY_GROUP}' || format('probe-publication-runtime-{0}-{1}', inputs.target_environment, inputs.tenant_id) }}`,
  "probe-runtime-database.yml": `\${{ inputs.quiesce_worker && '${DEPLOYMENT_CONCURRENCY_GROUP}' || format('probe-runtime-database-{0}-{1}', inputs.target_environment, inputs.tenant_id) }}`
});

const deploymentNamespace = "deploy-veyocast-";
const deploymentPrefix = /deploy-veyocast-/i;
const indirectConcurrency = /(?:^|[\s:{,])[*&][A-Za-z0-9_-]+|(?:^|\s)<<\s*:/m;
const concurrencyKey = /^([ \t]*)(?:concurrency|"concurrency"|'concurrency'):\s*(.*)$/;
const flowConcurrency = /[{,]\s*(?:concurrency|"concurrency"|'concurrency')\s*:/m;
const quotedMappingKey = /(?:^|[{,])[ \t]*("(?:[^"\\]|\\[\s\S])*"|'(?:[^']|'')*')\s*:/gm;

function fail(code) {
  throw new Error(`DEPLOYMENT_CONCURRENCY_${code}`);
}

function hasOpaqueMappingKeys(source) {
  if (/^[ \t]*\?(?:[ \t]|$)/m.test(source)) return true;
  return [...source.matchAll(quotedMappingKey)].some((match) => match[1].includes("\\") || /[\r\n]/.test(match[0]));
}

function concurrencyBlocks(source) {
  const lines = source.split(/\r?\n/);
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(concurrencyKey);
    if (!match) continue;
    const indent = match[1].length;
    const body = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      const line = lines[next];
      if (!line.trim() || /^\s*#/.test(line)) continue;
      if (line.match(/^\s*/)[0].length <= indent) break;
      body.push(line.trimEnd());
    }
    blocks.push({ indent, header: lines[index], inline: match[2], body });
  }
  return blocks;
}

function hasIndependentLiteralPrefix(block) {
  const groups = block.body.map((line) => line.match(/^\s*(?:group|"group"|'group'):\s*(.*)$/)).filter(Boolean);
  if (block.inline ? block.body.length !== 0 : groups.length !== 1) return false;
  let value = block.inline || groups[0][1];
  if (/^["']/.test(value)) {
    if (value.at(-1) !== value[0]) return false;
    value = value.slice(1, -1);
  }
  // Do not interpret YAML escapes, aliases, tags, flow maps or block scalars.
  // Their resolved prefix cannot be established by this source-only policy.
  if (!value || value !== value.trim() || value.includes("\\") || "[]{}>|!&*#".includes(value[0])) return false;
  const expression = value.indexOf("${{");
  const prefix = (expression < 0 ? value : value.slice(0, expression)).toLowerCase();
  if (expression >= 0 && (!prefix || deploymentNamespace.startsWith(prefix))) return false;
  return !prefix.startsWith(deploymentNamespace);
}

/**
 * Validate all workflow sources together, keyed by their .github/workflows
 * basenames. This is a source contract, not a YAML parser or a runtime lock.
 * Actionlint separately validates YAML; imports and validation perform no IO.
 */
export function validateDeploymentConcurrency(workflowsByName) {
  if (!workflowsByName || typeof workflowsByName !== "object" || Array.isArray(workflowsByName)) {
    fail("INPUT_INVALID");
  }
  for (const name of Object.keys(writerGroups)) {
    if (!Object.hasOwn(workflowsByName, name)) fail("MEMBER_MISSING");
  }
  for (const [name, source] of Object.entries(workflowsByName)) {
    if (typeof source !== "string") fail("SOURCE_INVALID");
    const readableSource = source.split(/\r?\n/).filter((line) => !/^\s*#/.test(line)).join("\n");
    // Escaped/complex YAML keys can hide concurrency from a literal registry.
    // Require readable mapping keys rather than interpreting YAML semantics.
    if (hasOpaqueMappingKeys(readableSource)) fail("OPAQUE_KEY");
    const blocks = concurrencyBlocks(source);
    const hasFlowConcurrency = flowConcurrency.test(readableSource);
    if (!Object.hasOwn(writerGroups, name)) {
      if (hasFlowConcurrency || blocks.some((block) => {
        const configuration = [block.inline, ...block.body].join("\n");
        // A hidden alias cannot establish that an unregistered workflow uses
        // an independent group; require its concurrency to remain explicit.
        return deploymentPrefix.test(configuration) || indirectConcurrency.test(configuration) || !hasIndependentLiteralPrefix(block);
      })) {
        fail("UNREGISTERED_WRITER");
      }
      continue;
    }
    if (hasFlowConcurrency || blocks.some((block) => block.indent !== 0)) fail("JOB_OVERRIDE");
    if (blocks.length !== 1 || blocks[0].header !== "concurrency:") fail("ROOT_INVALID");
    const expected = [
      `  group: ${writerGroups[name]}`,
      "  cancel-in-progress: false"
    ];
    if (blocks[0].body.length !== expected.length || blocks[0].body.some((line, index) => line !== expected[index])) {
      fail("GROUP_INVALID");
    }
  }
  return true;
}
