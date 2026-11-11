import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { syncDynamicConfigurationSchema, syncOnzeTrotsSystemAssets, syncOnzeTrotsV9SystemAssets } from "@veyocast/contracts";
import { createSyncStudioStarter } from "@veyocast/studio";
import { projectSyncDynamicSnapshot } from "@veyocast/content-templates/sync-dynamic-projector";
import { buildMenuWidgetDocument } from "../../apps/control/app/(shell)/dashboard/slides/menu-studio/menu-widget-document";
import { menuDomFixture } from "./menu-dom-fixture";

// Real async route components, saved-data loader, asset loader and renderers.
// Only session/database transport and command boundaries are controlled here;
// this cohort makes no live Auth/RLS, provider, worker or hardware claim.
export const savedPreviewOrigin = "http://127.0.0.1:3394";
export const savedPreviewId = (n: number) => `29510000-0000-4000-8000-${String(n).padStart(12, "0")}`;
type Row = Record<string, unknown>;
let bundle: { js: string; css: string };

export function prepareSavedPreviewFixture() {
  const require = createRequire(join(process.cwd(), "package.json"));
  const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
  const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{DialogPortalProvider}from'./packages/ui/src/components/dialog';import DetailPage from'./apps/control/app/(shell)/dashboard/slides/[slideId]/page';import MenuPage from'./apps/control/app/(shell)/dashboard/slides/menu-studio/[slideId]/page';import{SyncCreateWizard}from'./apps/control/app/(shell)/dashboard/studio/sync-create-wizard';import{SlideLibraryWorkspace}from'./apps/control/app/(shell)/dashboard/slides/slide-library-workspace';const creating=location.pathname==='/__saved/create';const content=location.pathname==='/__saved/library'?<><h1>Slidebibliotheek</h1><SlideLibraryWorkspace canWrite={false} canAddToPlaylist={false} playlists={[]} rows={globalThis.fixture.libraryRows}/></>:creating?<SyncCreateWizard data={globalThis.fixture.wizard}/>:await(location.pathname.includes('/menu-studio/')?MenuPage:DetailPage)({params:Promise.resolve({slideId:globalThis.fixture.slideId}),searchParams:Promise.resolve({})});function App(){const[portal,setPortal]=useState(null);return <div className='sites-control vx-shell app-shell design-sync sync-control' style={{display:'block'}} ref={setPortal}><DialogPortalProvider container={portal}><main className='main-content' id='control-content'>{content}</main></DialogPortalProvider></div>}createRoot(document.getElementById('root')).render(<App/>);`;
  const client = `export function createFixtureClient(){return {rpc(name){globalThis.fixtureWrites.push({kind:'rpc',name});throw Error('Preview attempted RPC '+name)},storage:{from(bucket){return {async createSignedUrl(path){globalThis.fixtureReads.push({table:'storage',bucket,path});return {data:{signedUrl:location.origin+'/__saved/media/'+path.split('/').at(-1)},error:null}},async createSignedUrls(paths){return {data:paths.map(path=>({signedUrl:location.origin+'/__saved/media/'+path.split('/').at(-1)})),error:null}}}}},from(table){let filters=[],orders=[],maximum=Infinity;globalThis.fixtureReads.push({table,filters});function result(single){let rows=(globalThis.fixture.tables[table]||[]).filter(row=>filters.every(([op,key,value])=>op==='eq'?value!==null&&row[key]===value:op==='neq'?row[key]!==value:op==='in'?value.includes(row[key]):op==='is'?row[key]===value:op==='not'?row[key]!==value:true));rows.sort((a,b)=>{for(const[key,ascending]of orders){if(a[key]!==b[key])return(a[key]<b[key]?-1:1)*(ascending?1:-1)}return 0});rows=rows.slice(0,maximum);return {data:single?rows[0]??null:rows,error:null}}const query={select(){return query},eq(key,value){filters.push(['eq',key,value]);return query},neq(key,value){filters.push(['neq',key,value]);return query},in(key,value){filters.push(['in',key,value]);return query},is(key,value){filters.push(['is',key,value]);return query},not(key,operator,value){filters.push(['not',key,value]);return query},or(){return query},order(key,options={}){orders.push([key,options.ascending!==false]);return query},limit(value){maximum=value;return query},async maybeSingle(){return result(true)},then(resolve,reject){return Promise.resolve(result(false)).then(resolve,reject)}};return query}}}`;
  const link = `import React from'react';export default function Link({children,...props}){return React.createElement('a',props,children)}`;
  const image = `import React from'react';export default function Image({fill,unoptimized,priority,...props}){return React.createElement('img',{...props,style:{...props.style,...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{})}})}`;
  const script = `const fs=require('node:fs'),path=require('node:path');const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'esm',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css','.woff2':'dataurl','.woff':'dataurl','.ttf':'dataurl'},plugins:[{name:'controlled-read-session-command-boundaries',setup(b){const mock=(path,contents)=>({path,namespace:'controlled',pluginData:{contents}});
  b.onResolve({filter:/^next\\/(link|navigation|image)$/},a=>mock(a.path,a.path.endsWith('link')?${JSON.stringify(link)}:a.path.endsWith('image')?${JSON.stringify(image)}:'export const notFound=()=>{throw Error("Not found")};const router={refresh(){},push:href=>location.assign(href),replace:href=>location.assign(href)};export const useRouter=()=>router;export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);'));
  b.onResolve({filter:/^\\//},()=>({external:true}));b.onResolve({filter:/^server-only$/},a=>mock(a.path,''));b.onResolve({filter:/^node:crypto$/},a=>mock(a.path,'export const randomUUID=()=>crypto.randomUUID();export const createHash=()=>{throw Error("Unexpected old artifact preview branch")};'));b.onResolve({filter:/^next\\/cache$/},a=>mock(a.path,'export const revalidatePath=()=>{throw Error("Preview attempted cache invalidation")};'));
  b.onResolve({filter:/control-session$/},a=>mock(a.path,'export async function requireTenantControlSession(){return globalThis.fixture.session}'));
  b.onResolve({filter:/supabase\\/(server|admin)$/},a=>mock(a.path,${JSON.stringify(client)}+';export const createControlSupabaseClient=async()=>createFixtureClient();export const createControlAdminClient=()=>createFixtureClient();'));
  b.onResolve({filter:/actions$/},a=>{if(a.path.endsWith('slide-resource-actions'))return;const file=['.ts','.tsx'].map(ext=>path.resolve(a.resolveDir,a.path+ext)).find(p=>fs.existsSync(p));if(!file)return;const source=fs.readFileSync(file,'utf8');const names=[...source.matchAll(/export\\s+(?:async\\s+)?(?:function|const)\\s+(\\w+)/g)].map(m=>m[1]);return mock(file,names.map(name=>'export const '+name+'=(...args)=>fetch("/__saved/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:'+JSON.stringify(name)+',args})}).then(r=>r.json());').join('\\n'));});
  b.onLoad({filter:/.*/,namespace:'controlled'},a=>({contents:a.pluginData.contents,resolveDir:process.cwd(),loader:'js'}));}}]});process.stdout.write(JSON.stringify({js:result.outputFiles.find(f=>f.path.endsWith('.js')).text,css:result.outputFiles.find(f=>f.path.endsWith('.css')).text}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${script}})().catch(error=>{console.error(error);process.exitCode=1})`], { encoding: "utf8", timeout: 30_000, maxBuffer: 32 * 1024 * 1024 }));
}

export function savedPreviewFixture(kind: "rss" | "menu", orientation: "landscape" | "portrait" = "landscape") {
  const id = savedPreviewId, tenant = id(1), slideId = id(2), versionId = id(3), snapshotId = id(4), templateVersionId = id(5), sourceId = id(6), templateId = id(7);
  const now = "2026-11-06T01:00:00.000Z";
  const media = [
    { id: id(10), path: "fieldflow/photos/FF-PHOTO-01-clubhouse-exterior-3840x2160-web.webp", mime: "image/webp" },
    { id: id(11), path: "onzetrots/duindorp-logo.png", mime: "image/png" }
  ].map(asset => { const bytes = readFileSync(join(process.cwd(), "apps/control/public", asset.path)); return { ...asset, bytes: bytes.length, sha: createHash("sha256").update(bytes).digest("hex") }; });
  const seed = { ...createSyncStudioStarter({ family: "rss", tenantName: "Eigen CSS-club", theme: "onzetrots-tv" }).syncPresentation!, orientation, name: "Direct opgeslagen bronontwerp" };
  const cfg = syncDynamicConfigurationSchema.parse({ schemaVersion: 1, kind: "dynamic", rendererVersion: seed.rendererVersion, sourceRevision: seed.sourceRevision, slideType: "news", secondsPerPage: 3, seed });
  const menu = menuDomFixture("twelve_excel", orientation);
  menu.document.tenantId = tenant; menu.document.pages[1]!.blocks[0] = { ...menu.document.pages[1]!.blocks[0]!, type: "text", text: "Tweede echte widgetpagina" } as typeof menu.document.pages[1]["blocks"][number];
  const document = buildMenuWidgetDocument(menu.document, [menu.option], menu.design, []);
  const configuration: Row = kind === "rss" ? { syncConfiguration: cfg } : document;
  const data: Row = kind === "rss" ? { type: "news", syncPlaybackProtocol: 2, syncConfiguration: cfg, generatedAt: now, news: { title: "Eigen verenigingsnieuws", sourceName: "Eigen nieuwsbron", providerLogoMediaAssetId: id(11), secondsPerSlide: 3, articles: [{ id: "saved-canonical-article", title: "Bestaande bronkop direct zichtbaar", intro: "De opgeslagen foto, het bronlogo en de QR staan in de CSS-weergave.", link: "https://example.invalid/canonical-news/1", heroMediaAssetId: id(10), publishedAt: now }] } } : { type: "price_list", syncPlaybackProtocol: 2, menuDocument: document, sitesConfiguration: menu.design, brand: { clubName: "Eigen CSS-club" } };
  const slide = { id: slideId, tenant_id: tenant, name: kind === "rss" ? seed.name : "Direct opgeslagen kantinemenu", library_name: null, slide_type: kind === "rss" ? "news" : "price_list", orientation, selection_mode: "latest", status: "queued", current_snapshot_id: null, current_published_version_id: null, active_draft_version_id: versionId, configuration_json: configuration, template_version_id: templateVersionId, data_source_id: sourceId, menu_document_revision: 1, menu_last_published_revision: null, last_error_code: null };
  const version = { id: versionId, tenant_id: tenant, dynamic_slide_id: slideId, status: "publishing", orientation, slide_type: slide.slide_type, template_version_id: templateVersionId, data_source_id: sourceId, configuration_json: configuration, version_number: 1, created_at: now, published_at: null };
  const snapshot = { id: snapshotId, tenant_id: tenant, dynamic_slide_id: slideId, dynamic_slide_version_id: versionId, template_version_id: templateVersionId, data_source_id: sourceId, source_revision_hash: "a".repeat(64), snapshot_data_json: data, status: "queued", snapshot_sequence: 1, created_at: now };
  const tables: Record<string, Row[]> = {
    dynamic_slides: [slide], dynamic_slide_versions: [version], dynamic_slide_snapshots: [snapshot],
    dynamic_template_versions: [{ id: templateVersionId, template_id: templateId }],
    dynamic_templates: [{ id: templateId, slug: kind === "rss" ? "saved-source-rss" : "saved-menu-widget", orientation, slide_type: slide.slide_type, status: "published", current_published_version_id: templateVersionId, name: "Eigen CSS-template" }],
    dynamic_data_sources: [{ id: sourceId, tenant_id: tenant, kind: kind === "rss" ? "rss" : "twelve_excel", status: "active", name: "Eigen opgeslagen bron" }],
    playlists: [{ id: id(8), tenant_id: tenant, name: "Eigen conceptplaylist", revision: 0, status: "draft" }],
    media_assets: media.map(asset => ({ id: asset.id, tenant_id: tenant, kind: "image", status: "ready", source_kind: "user", title: "Eigen canoniek beeld", mime_type: asset.mime, checksum_sha256: asset.sha, deleted_at: null, created_at: now })),
    media_variants: media.map(asset => ({ asset_id: asset.id, tenant_id: tenant, variant_type: "original", storage_bucket: "tenant-media", storage_path: `tenants/${tenant}/assets/${asset.id}/${asset.id}.${asset.mime === "image/png" ? "png" : "webp"}`, mime_type: asset.mime, file_size_bytes: asset.bytes, checksum_sha256: asset.sha })),
    tenant_products: [{ id: menu.option.id, tenant_id: tenant, active: true, available: true, data_source_id: sourceId, name: "Clubkoffie", description: "", category: "Warme dranken", price_cents: 250, currency: "EUR", revision: 1, sort_order: 0, vat_rate: null, unit: null, custom_fields: {} }],
    tenant_settings: [{ tenant_id: tenant, default_theme_id: "onzetrots-tv", default_theme_version: "11.0.0", menu_document_v2_read_enabled: true, menu_studio_v2_authoring_enabled: true, menu_studio_v2_linked_groups_enabled: true, menu_studio_v2_media_enabled: true, menu_studio_v2_publish_enabled: true, menu_studio_v2_player_enabled: true, theme_accent: "#03438A", theme_support: "#0050FF", theme_mode_policy: { kind: "fixed", mode: "light" }, timezone_name: "Europe/Amsterdam" }],
    tenant_theme_profiles: []
  };
  const libraryRows = [{ id: slideId, name: slide.name, availability: { label: "Inhoud opgeslagen", detail: "De eerste descriptor is nog in de queue.", tone: "warning" }, competitionLabel: "Niet van toepassing", editorKind: kind === "rss" ? "sync" : "menu", libraryRevision: 1, purposeLabel: kind === "rss" ? "Nieuws" : "Menu", sourceLabel: "Eigen opgeslagen bron", teamLabel: "Eigen CSS-club", createdAt: now, currentVersionNumber: null, dataLabel: "Opgeslagen canonieke inhoud", editHref: `/dashboard/slides/${kind === "menu" ? "menu-studio/" : ""}${slideId}`, itemCount: 1, orientationLabel: orientation === "portrait" ? "Staand" : "Liggend", resourceStatus: "concept", selectionLabel: "Nieuwste goede snapshot", slideTypeLabel: kind === "rss" ? "Nieuws" : "Menukaart", technicalStatus: "queued", updatedAt: now, createdLabel: "6 nov 2026", updatedLabel: "6 nov 2026" }];
  return { slideId, tables, media, libraryRows, session: { isLive: true, tenantId: tenant, tenant: "Eigen CSS-club", tenantStatus: "active", capabilities: ["tenant.dynamic_slide.read", "tenant.dynamic_slide.write", "tenant.playlist.write"] }, wizard: { tenantId: tenant, actorScope: tenant + ":" + id(9), tenantName: "Eigen CSS-club", family: "rss", initialPresentation: seed, canCreateManual: false, canCreateConnected: true, initialMode: "connected", initialSourceId: sourceId, slideType: "news", sources: [{ id: sourceId, name: "Eigen opgeslagen bron", kind: "rss", providerStatus: "ready", lastSuccessfulSyncAt: now, lastErrorCode: null }], templates: [{ versionId: templateVersionId, orientation, slug: "saved-source-rss" }], images: [] } };
}
export type SavedPreviewFixture = ReturnType<typeof savedPreviewFixture>;

export async function mountSavedPreview(page: Page, data = savedPreviewFixture("rss"), path = `/dashboard/slides/${data.slideId}`) {
  const errors: string[] = [], commands: Array<{ kind: string; args: unknown[] }> = [], routes: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", dialog => void dialog.accept());
  const css = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css", "apps/control/app/(shell)/dashboard/studio/sync-retained-studio.css", "apps/control/app/sync-auth.css"].map(file => readFileSync(file, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
  const system = new Map([...syncOnzeTrotsSystemAssets, ...syncOnzeTrotsV9SystemAssets].map(asset => [asset.path as string, asset]));
  const assets = Object.fromEntries(data.media.map(asset => [asset.id, { url: `${savedPreviewOrigin}/__saved/media/${asset.id}.${asset.mime === "image/png" ? "png" : "webp"}`, bytes: asset.bytes, mimeType: asset.mime, checksumSha256: asset.sha }]));
  await page.route(savedPreviewOrigin + "/**", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname === "/__saved/action") {
      const input = request.postDataJSON() as { kind: string; args: unknown[] };
      if (input.kind === "readDynamicPublication") {
        expect(input.args[0]).toBe(data.slideId);
        const slide = data.tables.dynamic_slides![0]!;
        const versionId = input.args[1] ?? slide.active_draft_version_id ?? slide.current_published_version_id;
        const version = data.tables.dynamic_slide_versions!.find(row => row.id === versionId)!;
        const snapshot = data.tables.dynamic_slide_snapshots!.find(row => row.dynamic_slide_version_id === versionId)!;
        expect(version.status).toBe("publishing");
        expect(snapshot.status).toBe("queued");
        return route.fulfill({ json: { versionId, revision: version.edit_revision ?? 1, status: version.status, error: null, startedAt: snapshot.created_at } });
      }
      if (input.kind === "previewSyncWizardAction") {
        const value = input.args[0] as { configuration: { syncConfiguration: unknown } };
        const cfg = syncDynamicConfigurationSchema.parse(value.configuration.syncConfiguration);
        const snapshot = { ...data.tables.dynamic_slide_snapshots![0]!.snapshot_data_json as Row, syncConfiguration: cfg };
        const result = projectSyncDynamicSnapshot({ schemaVersion: 1, snapshotId: savedPreviewId(4), snapshotHash: "a".repeat(64), templateVersionId: savedPreviewId(5), templateSlug: "saved-source-rss", orientation: cfg.seed.orientation, slideType: "news", data: snapshot, assets }, cfg.seed);
        if (!result.ok) throw Error("Canonical preview fixture failed: " + result.code);
        return route.fulfill({ json: { ok: true, presentation: result.presentation, assets, source: { providerStatus: "ready", lastSuccessfulSyncAt: "2026-11-06T01:00:00.000Z", lastErrorCode: null } } });
      }
      commands.push(input);
      if (input.kind !== "createSyncDesignWizardAction") throw Error("Unexpected preview mutation: " + input.kind);
      const value = input.args[0] as { kind: string; command: { request: { configuration: Row } } };
      if (value.kind !== "connected") throw Error("Expected actual connected Source create request");
      data.tables.dynamic_slide_versions![0]!.configuration_json = value.command.request.configuration;
      data.tables.dynamic_slides![0]!.configuration_json = value.command.request.configuration;
      (data.tables.dynamic_slide_snapshots![0]!.snapshot_data_json as Row).syncConfiguration = value.command.request.configuration.syncConfiguration;
      return route.fulfill({ json: { ok: true, href: `/dashboard/slides/${data.slideId}` } });
    }
    if (url.pathname.startsWith("/__saved/media/")) {
      const name = url.pathname.split("/").at(-1)!, asset = data.media.find(value => name.startsWith(value.id + "."));
      if (!asset) return route.abort();
      return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public", asset.path)), contentType: asset.mime });
    }
    const approved = system.get(url.pathname);
    if (approved) return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public", approved.path)), contentType: approved.mimeType });
    if (url.pathname.startsWith("/assets/")) {
      const name = url.pathname.split("/").at(-1)!;
      if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return route.abort();
      try { return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public/assets", name)), contentType: name.endsWith("woff2") ? "font/woff2" : name.endsWith("ttf") ? "font/ttf" : "image/webp" }); } catch { return route.abort(); }
    }
    if (request.method() !== "GET" || !(url.pathname.startsWith("/dashboard/slides/") || ["/__saved/create", "/__saved/library"].includes(url.pathname))) return route.abort();
    routes.push(url.pathname);
    return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Direct opgeslagen CSS-voorbeeld</title><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>globalThis.fixture=${JSON.stringify(data).replace(/</g, "\\u003c")};globalThis.fixtureReads=[];globalThis.fixtureWrites=[];</script><script type="module">${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` });
  });
  await page.goto(savedPreviewOrigin + path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return { errors, commands, routes, data };
}
