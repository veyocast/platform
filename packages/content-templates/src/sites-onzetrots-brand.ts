import { ONZETROTS_FONT_FACE_CSS, ONZETROTS_HEADER_FONT_FAMILY, ONZETROTS_PRIMARY } from "./onzetrots-brand";

const headerRoles=["h1","h2","h3","h4",".uc-header-brand",".vm-menu-slogan",".ucc-menu-foot strong",".ucc-welcome-values strong",".ucs-empty strong"];
const brandRoots=['.uc-slide[data-theme="onzetrots-tv"]',".onzetrots-tv",".vm-approved",'.s191-led-slide-slide[data-brand-theme="onzetrots-tv"]'];
const headerSelector=brandRoots.flatMap(scope=>headerRoles.map(role=>`${scope} ${role}`)).join(",");
const semanticHeaders=".onzetrots-tv .nc-broadcast-brand strong,.onzetrots-tv .nc-broadcast-brand span,.onzetrots-tv .nc-broadcast-footer>span:not(.nc-brush-wordmark),.s191-led-slide-slide[data-brand-theme=onzetrots-tv] .s191-led-slide-signature";

/** Runtime brand policy also covers presentations saved before the policy existed.
 * Frozen renderer/source bytes and stored authoring choices remain untouched. */
export const sitesOnzeTrotsBrandCss = ONZETROTS_FONT_FACE_CSS + `
.uc-slide[data-theme=onzetrots-tv]{--uc-blue:${ONZETROTS_PRIMARY};--uc-accent:${ONZETROTS_PRIMARY}}
.vm-frame[data-brand-theme=onzetrots-tv]{--vm-accent:${ONZETROTS_PRIMARY}!important;--vm-accent-ink:#fff!important}
.vm-approved .screen{--blue:${ONZETROTS_PRIMARY}!important;--ot-accent-ink:${ONZETROTS_PRIMARY}}
.vm-approved .screen[data-theme=dark]{--ot-accent-ink:#f1f5ff}
.vm-approved .vm-widget h2,.vm-approved .vm-menu-slogan,.vm-approved .vm-product>b{color:var(--ot-accent-ink)}
.onzetrots-tv{--otv-accent:${ONZETROTS_PRIMARY}!important}
.s191-led-slide-slide[data-brand-theme=onzetrots-tv]{--led-accent:${ONZETROTS_PRIMARY}!important}
${headerSelector},${semanticHeaders}{font-family:${ONZETROTS_HEADER_FONT_FAMILY},cursive!important;font-weight:400!important;font-style:normal!important;font-synthesis:none!important}
.uc-slide[data-theme=onzetrots-tv] .uc-slide-title{line-height:1.15}
`;

const brandRoot=brandRoots.join(",");

/** Require the real local face before acknowledging an OnzeTrots visible frame. */
export async function loadSitesOnzeTrotsHeaderFont(root: ParentNode | null): Promise<void> {
  // Nonbrand previews keep their existing post-body-font measurement boundary.
  await document.fonts.ready;
  if (!root) return;
  const element=root as ParentNode & {matches?:(selector:string)=>boolean};
  if (!element.matches?.(brandRoot) && !root.querySelector(brandRoot)) return;
  const faces = await document.fonts.load(`400 24px ${ONZETROTS_HEADER_FONT_FAMILY}`);
  if (!faces.length || faces.some(face => face.status !== "loaded")) throw Error("ONZETROTS_HEADER_FONT_UNAVAILABLE");
  await document.fonts.ready;
}

/** Standalone DOM adapter: the same function is serialized into the Worker page.
 * Per-node original sizes make repeated fit passes stable without module state. */
export function fitSitesOnzeTrotsHeaders(root: ParentNode = document): void {
  const scopes=['.uc-slide[data-theme="onzetrots-tv"]',".onzetrots-tv",".vm-approved",'.s191-led-slide-slide[data-brand-theme="onzetrots-tv"]'];
  const roles=["h1","h2","h3","h4",".uc-header-brand",".vm-menu-slogan",".ucc-menu-foot strong",".ucc-welcome-values strong",".ucs-empty strong"];
  const selector=scopes.flatMap(scope=>roles.map(role=>`${scope} ${role}`)).concat([".onzetrots-tv .nc-broadcast-brand strong",".onzetrots-tv .nc-broadcast-brand span",".onzetrots-tv .nc-broadcast-footer>span:not(.nc-brush-wordmark)",'.s191-led-slide-slide[data-brand-theme="onzetrots-tv"] .s191-led-slide-signature']).join(",");
  const headings=Array.from(root.querySelectorAll<HTMLElement>(selector)) as Array<HTMLElement & {onzeTrotsHeaderFit?:{original:string;applied:string}}>;
  for(const heading of headings){
    const previous = heading.onzeTrotsHeaderFit;
    const original = previous && heading.style.fontSize === previous.applied ? previous.original : heading.style.fontSize;
    heading.style.fontSize = original;
    heading.onzeTrotsHeaderFit={original,applied:original};
  }
  // Fit the main title before its smaller brand caption. Otherwise a first
  // oversized title can shrink that caption differently on later fit passes.
  headings.sort((a,b)=>Number(a.matches(".uc-header-brand,.nc-broadcast-brand strong"))-Number(b.matches(".uc-header-brand,.nc-broadcast-brand strong")));
  for (const heading of headings) {
    const original=heading.onzeTrotsHeaderFit!.original;
    const style = getComputedStyle(heading);
    let size = parseFloat(style.fontSize);
    if (!Number.isFinite(size) || size <= 0) continue;
    const base = size;
    const fixed = heading.closest<HTMLElement>(".uc-header,.slide-header-container,.nc-broadcast-header,.nk-heading,.ns-heading");
    const ownMax = parseFloat(style.maxHeight);
    for (let attempt = 0; attempt < 80 && size > base * .15; attempt++) {
      let fits=heading.scrollWidth<=heading.clientWidth+1&&(!Number.isFinite(ownMax)||heading.scrollHeight<=ownMax+1);
      if(fixed){
        const rect=heading.getBoundingClientRect(),clip=fixed.getBoundingClientRect(),computed=getComputedStyle(fixed),scale=clip.height/Math.max(1,fixed.offsetHeight);
        fits=fits&&rect.top>=clip.top+parseFloat(computed.paddingTop)*scale-1&&rect.bottom<=clip.bottom-parseFloat(computed.paddingBottom)*scale+1;
      }
      if(fits)break;
      size *= .94;
      heading.style.fontSize = `${size}px`;
    }
    heading.onzeTrotsHeaderFit={original,applied:heading.style.fontSize};
  }
}
