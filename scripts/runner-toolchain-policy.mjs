export const isolatedPnpmDestination = "${{ runner.temp }}/veyocast-pnpm-${{ github.run_id }}-${{ github.run_attempt }}-${{ github.job }}";

/** Unknown/dynamic runner labels are treated conservatively as shared hosts. */
export function validateRunnerToolchains(workflows) {
  let checked = 0;
  for (const workflow of workflows) {
    const jobs = workflow.split(/^(?:jobs|["']jobs["']):\s*\n/m)[1] ?? "";
    for (const job of jobs.split(/(?=^ {2}(?:[A-Za-z0-9_-]+|["'][A-Za-z0-9_-]+["']):\s*\n)/m)) {
      const runner = job.match(/^ {4}runs-on:([^\n]*(?:\n {6}- [^\n]*)*)/m)?.[1].trim();
      // GitHub-hosted runners have a fresh filesystem per job. Every other
      // route, including expressions and aliases, needs an isolated install.
      if (/^(?:ubuntu|windows|macos)-(?:latest|[0-9]+(?:\.[0-9]+)?(?:-arm)?)(?:\s+#.*)?$/.test(runner ?? "")) continue;
      for (const step of job.split(/(?=^ {4,6}- ["']?(?:name|uses|run|id|if|shell|env|with|working-directory)["']?:)/m)) {
        if (!/(?:^|\s)(?:uses|["']uses["']):\s*["']?pnpm\/action-setup@/im.test(step)) continue;
        if (!runner || !step.split("\n").some((line) => line === `          dest: ${isolatedPnpmDestination}`)) {
          throw new Error("RUNNER_PNPM_DESTINATION_NOT_ISOLATED");
        }
        checked += 1;
      }
    }
  }
  return checked;
}
