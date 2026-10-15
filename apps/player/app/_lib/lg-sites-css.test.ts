import {Script} from "node:vm";
import {describe,expect,it} from "vitest";
import {lgSitesCssScript,normalizeLgSitesCss} from "./lg-sites-css";
import {sitesLedCss,sitesTvCss,sitesStudioCss} from "../../../../packages/content-templates/src/sites-styles";
import {sitesV17Css} from "../../../../packages/content-templates/src/sites-v17-styles";

describe("Sites fixed-canvas CSS for legacy LG",()=>{
 it("resolves container units from the published logical canvas in both orientations",()=>{
  expect(normalizeLgSitesCss("font-size:5cqw;height:3.5cqh;padding:1cqmin 1cqmax",1920,1080)).toBe("font-size:96px;height:37.8px;padding:10.8px 19.2px");
  expect(normalizeLgSitesCss("font-size:5cqw;height:3.5cqh",1080,1920)).toBe("font-size:54px;height:67.2px");
 });
 it("calculates the exact source density and scale math without evaluating JavaScript",()=>{
  expect(normalizeLgSitesCss("calc(27px * max(.8,var(--otv-density)) * min(1.3,var(--otv-scale)))",1920,1080,{"--otv-density":"0.5","--otv-scale":"1.5"})).toBe("28.08px");
  expect(normalizeLgSitesCss("clamp(12px,calc(4cqw * var(--scale)),110px)",1920,1080,{"--scale":"2"})).toBe("110px");
  expect(normalizeLgSitesCss("calc(var(--heading) * min(1.35,var(--scale)))",1920,1080,{"--heading":"97px","--scale":"1.278"})).toBe("123.966px");
 });
 it("preserves relative native calc, unresolved variables and grid minmax instead of guessing units",()=>{
  const css="height:calc(100% - 164px);font-size:calc(20px * var(--missing));grid-template-columns:minmax(0,1fr) minmax(440px,1.1fr)";
  expect(normalizeLgSitesCss(css,1920,1080)).toBe(css);
  expect(normalizeLgSitesCss("calc(4px * 2px);calc(10px / 0);calc(1px + 1em)",1920,1080)).toBe("calc(4px * 2px);calc(10px / 0);calc(1px + 1em)");
 });
 it("resolves fixed verified colors with premultiplied alpha and keeps unknown colors unchanged",()=>{
  expect(normalizeLgSitesCss("color-mix(in srgb,#fff 25%,#000 75%)",1920,1080)).toBe("rgba(64,64,64,1)");
  expect(normalizeLgSitesCss("color-mix(in srgb,var(--accent) 60%,transparent)",1920,1080,{"--accent":"#03438a"})).toBe("rgba(3,67,138,0.6)");
  expect(normalizeLgSitesCss("color-mix(in srgb,currentColor,blue)",1920,1080)).toBe("color-mix(in srgb,currentColor,blue)");
 });
 it("serializes and executes the same pure interpreter without modern JavaScript syntax or globals",()=>{
  const script=lgSitesCssScript(); expect(script).not.toMatch(/\b(?:let|const)\b|=>|\?\.|\?\?/);
  const context={};new Script(script).runInNewContext(context);
  expect(new Script('normalizeLgSitesCss("calc(5cqw * min(2,1.2))",1920,1080)').runInNewContext(context)).toBe("115.2px");
 });
 it("expands trusted heading selector lists for Chromium79 without altering declarations or source bytes",()=>{
  const css='.canvas :is(h1,h2,h3){font-weight:600}.portrait :where(.title,.subtitle) :is(span,strong){color:var(--ink)}.quote{content:":is(h1,h2)"}';
  const normalized=normalizeLgSitesCss(css,1920,1080);
  expect(normalized).toContain('.canvas h1,.canvas h2,.canvas h3{font-weight:600}');
  expect(normalized).toContain('.portrait .title span');expect(normalized).toContain('.portrait .subtitle strong');
  expect(normalized).toContain('content:":is(h1,h2)"');
  expect(normalizeLgSitesCss(sitesStudioCss+sitesLedCss+sitesTvCss,1080,1920)).not.toMatch(/:(?:is|where)\(/);
  const context={};new Script(lgSitesCssScript()).runInNewContext(context);
  expect(new Script('normalizeLgSitesCss(".canvas :is(h1,h2){color:red}",1920,1080)').runInNewContext(context)).toBe('.canvas h1,.canvas h2{color:red}');
 });
 it("normalizes the locked source CSS at runtime while preserving its authoritative source bytes",()=>{
  const original=sitesLedCss+sitesTvCss; const normalized=normalizeLgSitesCss(original,1920,1080);
  expect(original).toContain("cqw"); expect(normalized).not.toMatch(/\d(?:cqw|cqh|cqmin|cqmax)\b/);
  expect(sitesLedCss+sitesTvCss).toBe(original);expect(normalized).toContain("minmax(");
 });
 it("keeps commas and selector-like text inside comments out of expanded surface selectors",()=>{
  const css='/* One panel, rather than cards; :is(example,other). */\n.canvas :is(.panel,.menu){background:var(--surface);content:"/* keep, literal */"}';
  expect(normalizeLgSitesCss(css,1080,1920)).toBe('\n.canvas .panel,\n.canvas .menu{background:var(--surface);content:"/* keep, literal */"}');
  expect(normalizeLgSitesCss('.canvas[data-label="/* keep, literal */"] :is(h1,h2){color:red}',1080,1920)).toContain('[data-label="/* keep, literal */"] h1');
 });
 it("preserves fixed inset geometry and later edge overrides on engines without the shorthand",()=>{
  expect(normalizeLgSitesCss('.photo{inset:0}.slide{inset:0 auto auto 0}.reset{inset:auto!important}.frame{inset:10px 20px 30px;left:40px}',1080,1920)).toBe('.photo{top:0;right:0;bottom:0;left:0}.slide{top:0;right:auto;bottom:auto;left:0}.reset{top:auto!important;right:auto!important;bottom:auto!important;left:auto!important}.frame{top:10px;right:20px;bottom:30px;left:20px;left:40px}');
  expect(normalizeLgSitesCss(sitesV17Css,1080,1920)).not.toMatch(/[;{]\s*inset\s*:/);
 });
});
