import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(realpathSync(join(root, "apps/marketing/node_modules/next/package.json")));
const postcss = require("postcss");
const source = join(root, "docs/sync-v1-rebuild/handoff/reference/sites-sync/src");
const accessibility = JSON.parse(readFileSync(join(root, "docs/sync-v1-rebuild/accessibility-overrides.json"), "utf8"));
const overrides = accessibility.colors;

function scopedCss(filename, scope) {
  const tree = postcss.parse(readFileSync(join(source, filename), "utf8"));
  tree.walkAtRules("layer", rule => { if (rule.nodes) rule.replaceWith(...rule.nodes); else rule.remove(); });
  tree.walkRules(rule => {
    if (rule.parent.type === "atrule" && rule.parent.name.includes("keyframes")) return;
    rule.selectors = rule.selectors.map(selector => {
      if (selector === ":root" || selector === "body") return scope;
      if (selector === ".app-shell") return `${scope}.app-shell`;
      // Marketing already contains .mk-site selectors. A zero-specificity
      // boundary preserves their priority relative to the unscoped source
      // rules (notably the mobile h2 scale).
      const boundary = scope === ".mk-site" ? ":where(.mk-site)" : scope;
      return selector.startsWith(scope) ? selector : `${boundary} ${selector}`;
    });
    if (scope === ".sync-control") {
      const links = rule.selectors.filter(selector => selector.includes(".ad-ticket-list") && selector.includes("button")).map(selector => selector.replaceAll("button", "a.sync-ticket-row"));
      const contentLinks = rule.selectors.filter(selector => /\.vc-(filter-tabs|content-card-title|card-actions|filmstrip-heading)\b/.test(selector) && selector.includes("button")).map(selector => selector.replaceAll("button", "a"));
      const studioHeadings = rule.selectors.filter(selector => selector.includes(".vc-properties-heading h3")).map(selector => selector.replace(".vc-properties-heading h3", ".vc-properties-heading h2"));
      // Reuse the exact Source button declarations for existing semantic UI
      // primitives, including their pseudo/focus/disabled and mobile rules.
      const variants = {primary:"primary",secondary:"secondary",ghost:"ghost",danger:"destructive",sm:"sm",lg:"lg"};
      const sharedButtons = rule.selectors.filter(selector => /\.btn(?:\b|-)/.test(selector)).map(selector => selector.replace(/\.btn(?:-([a-z]+))?(?![\w-])/g, (match, variant) => variant ? variants[variant] ? `.vc-button.vc-button--${variants[variant]}` : match : ".vc-button").replace(".sync-control", ".sync-control.app-shell"));
      const studioButtons=rule.selectors.filter(selector=>selector.endsWith('.vc-studio-top-actions button')).map(selector=>selector.replace('.sync-control','.sync-control.app-shell').replace(/button$/,'.vc-button'));
      const accountAvatars=rule.selectors.filter(selector=>selector==='.sync-control .avatar-button').map(()=>'.sync-control .vx-account .avatar-button');
      const workspaceAvatars=rule.selectors.filter(selector=>selector==='.sync-control .workspace-avatar').map(()=>'.sync-control .vx-tenant .workspace-avatar');
      const semanticEmptyHeadings=rule.selectors.filter(selector=>selector==='.sync-control h3').map(()=>'.sync-control .vc-content-empty__title');
      const canonicalEmptyHeadings=rule.selectors.flatMap(selector=>{
        if(selector==='.sync-control h3'||selector.includes('.admin-page h3'))return ['sync-empty-title','sync-ticket-title','sync-source-name'].map(name=>selector==='.sync-control h3'?`.sync-control .admin-page .${name}`:selector.replace('h3','.'+name));
        if(selector.includes('.empty h3'))return [selector.replace('h3','.sync-empty-title')];
        if(selector.includes('.ad-ticket-list h3'))return ['sync-empty-title','sync-ticket-title'].map(name=>selector.replace('h3','.'+name));
        if(selector.includes('.ad-source h3'))return [selector.replace('h3','.sync-source-name')];
        return [];
      });
      const overviewButtons=rule.selectors.filter(selector=>selector==='.sync-control .ov-page button'||selector==='.sync-control .ov-page button:focus-visible').map(selector=>selector.replace('button','a:where(.btn)'));
      const planningLinks=rule.selectors.filter(selector=>selector.includes('.px-view-toggle')&&selector.includes('button')).map(selector=>selector.replaceAll('button','a'));
      const planningHeadings=rule.selectors.filter(selector=>selector.includes('.px-calendar-toolbar h3')).map(selector=>selector.replace('h3','h2:where(.sync-period-title)'));
      // Source navigates with a button; Next uses a real link. Preserve the
      // measured Chromium button inset (1px 6px) on that semantic equivalent.
      if(rule.selectors.some(selector=>selector.endsWith('.vc-filmstrip-heading>button'))&&!rule.nodes.some(node=>node.type==='decl'&&node.prop==='padding'))rule.append({prop:'padding',value:'1px 6px'});
      if(rule.selectors.some(selector=>selector.endsWith('.vc-back-button'))&&!rule.nodes.some(node=>node.type==='decl'&&node.prop==='padding'))rule.append({prop:'padding',value:'1px 6px'});
      rule.selectors = [...new Set([...rule.selectors, ...links, ...contentLinks, ...studioHeadings, ...sharedButtons,...studioButtons,...accountAvatars,...workspaceAvatars,...semanticEmptyHeadings,...canonicalEmptyHeadings,...overviewButtons,...planningLinks,...planningHeadings])];
    }
  });
  if (scope === ".mk-site") tree.walkDecls(declaration => {
    if (declaration.prop !== "color" && declaration.prop !== "--mk-muted") return;
    const original = declaration.value.toLowerCase();
    if (overrides[original]) declaration.value = overrides[original];
  });
  if (scope === ".sync-control") tree.walkDecls(declaration => {
    if (declaration.prop !== "color" && declaration.prop !== "--muted") return;
    const original = declaration.value.toLowerCase();
    if (accessibility.controlColors?.[original]) declaration.value = accessibility.controlColors[original];
  });
  return tree.toString();
}

writeFileSync(join(root, "apps/marketing/app/_sync/runtime.css"), "/* Generated from the immutable Sync source by scripts/build-sync-css.mjs. */\n" + scopedCss("styles.css", ".mk-site") + "\n" + scopedCss("marketing.css", ".mk-site") + "\n.mk-site svg{display:inline;vertical-align:baseline}\n.sync-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}\n");
writeFileSync(join(root, "apps/control/app/sync-source.css"), "/* Generated from the immutable Sync source by scripts/build-sync-css.mjs. */\n" + scopedCss("styles.css", ".sync-control") + "\n" + ["content", "overview", "playlists", "players", "admin"].map(name => scopedCss(`modules/${name}.css`, ".sync-control")).join("\n"));
