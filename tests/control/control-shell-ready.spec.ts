import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

// Actual ControlShell SSR, with the same narrow Next/action transport boundary
// as the interactive account fixture. No effects or browser hydration run here.
const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });

for (const platform of [false, true]) {
  test(`server account button waits for actual shell interactivity (${platform ? "platform" : "tenant"})`, async ({ page }) => {
    const entry = `import React from'react';import{renderToString}from'react-dom/server';import{ControlShell}from'./apps/control/app/(shell)/_components/control-shell';import{getNavigationGroupsForRoles}from'./apps/control/app/(shell)/_lib/control-navigation';
const platform=${platform},capabilities=platform?['platform.system.read']:['tenant.media.read'];
const session={assuranceLevel:'aal2',nextAssuranceLevel:'aal2',capabilities,email:'eigen.account@veyocast.test',isLive:true,organization:'VeyoCast platform',roles:platform?['platform_owner']:['tenant_viewer'],tenant:platform?'Geen vereniging':'Eigen QA-club',tenantContextReason:'selected',tenantId:platform?null:'23400000-0000-4000-8000-000000000001',tenantMemberships:[],tenantRoleLabel:platform?null:'Clubredactie',tenantSlug:platform?null:'eigen-qa-club',tenantStatus:platform?null:'active',timezoneName:'Europe/Amsterdam',userId:'23400000-0000-4000-8000-000000000003',userName:'Eigen Account'};
process.stdout.write(renderToString(<ControlShell session={session} navigationGroups={getNavigationGroupsForRoles(capabilities,!platform)} uploadQueue={[]} visualQaEnabled={false}><h1>Opstartcontrole</h1></ControlShell>));`;
    const navigation = `export const usePathname=()=>${JSON.stringify(platform ? "/platform" : "/dashboard/media")};export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push(){},refresh(){}});`;
    const link = "import React from'react';export default function Link({onClick,...props}){return React.createElement('a',props)}";
    const image = "import React from'react';export default function Image({fill,unoptimized,priority,...props}){return React.createElement('img',props)}";
    const script = `const{build}=require(${JSON.stringify(compiler)});(async()=>{const result=await build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'fixture.js',platform:'node',format:'cjs',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'controlled-ssr-transport',setup(b){b.onResolve({filter:/^next\\/(navigation|link|image)$/},a=>({path:a.path,namespace:'next'}));b.onLoad({filter:/.*/,namespace:'next'},a=>({contents:a.path.endsWith('navigation')?${JSON.stringify(navigation)}:a.path.endsWith('image')?${JSON.stringify(image)}:${JSON.stringify(link)},resolveDir:process.cwd(),loader:'js'}));b.onResolve({filter:/actions$/},a=>({path:a.path,namespace:'actions'}));b.onLoad({filter:/.*/,namespace:'actions'},()=>({contents:'export async function switchTenantContext(){throw Error("SSR must not issue commands")};export async function signOut(){throw Error("SSR must not issue commands")}',loader:'js'}));}}]});process.stdout.write(result.outputFiles.find(f=>f.path.endsWith('.js')).text)})().catch(error=>{console.error(error);process.exitCode=1});`;
    const compiled = execFileSync(process.execPath, ["-e", script], { encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024 });
    const html = execFileSync(process.execPath, ["--input-type=commonjs"], { input: compiled, encoding: "utf8", timeout: 10_000, maxBuffer: 4 * 1024 * 1024 });
    await page.route("**/*", route => route.abort());
    await page.setContent(`<!doctype html><html lang="nl"><head><title>Control opstart</title></head><body>${html}</body></html>`);
    await expect(page.getByRole("button", { name: "Snel naar een onderdeel", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Accountmenu openen", exact: true })).toBeDisabled();
    await expect(page.getByRole("dialog", { name: "Mijn werkplek", exact: true })).toHaveCount(0);
  });
}
