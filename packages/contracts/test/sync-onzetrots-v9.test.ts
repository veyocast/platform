import { describe, expect, it } from 'vitest';
import {
  syncContentFamilies, syncDynamicConfigurationSchema, syncOnzeTrotsHeaderText,syncOnzeTrotsHeaderSubtitle,
  syncSlidePresentationSchema, syncSlideTransition, syncSlideMinimumDurationMs,
  syncSlideAssets, syncSlideRendererAssets, syncSlidePosterTimeMs,
} from '../src/index';

const input = {
  schemaVersion: 1, rendererVersion: 'sync-onzetrots-v9',
  sourceRevision: '5ba52a657d6d16ad103ba2fb43b8db18aa83715a',
  family: 'welcome', orientation: 'landscape', theme: 'onzetrots-tv',
  name: 'Eigen ontwerp', title: 'Inhoudelijke kop', club: { name: 'Eigen club' },
  visual: { schemaVersion: 1, mode: 'light' }, style: { motion: 'rustig' },
};
const parse = (value = input) => {
  const slide = syncSlidePresentationSchema.parse(value);
  if (slide.rendererVersion !== 'sync-onzetrots-v9') throw Error('v9 required');
  return slide;
};

describe('versioned v9 authoring boundary', () => {
  it('keeps the source identity strict and old documents free of v9 options', () => {
    expect(parse().authoring).toEqual({ schemaVersion: 1, headerSubtitles: {}, headerTexts: {}, welcomeScalePercent: 150 });
    expect(syncSlidePresentationSchema.safeParse({ ...input, sourceRevision: 'ae83f2b4312408eacae9f29177d3c743e104185b' }).success).toBe(false);
    expect(syncSlidePresentationSchema.safeParse({ ...input, rendererVersion: 'sync-onzetrots-v1', sourceRevision: 'ae83f2b4312408eacae9f29177d3c743e104185b', authoring: parse().authoring }).success).toBe(false);
  });

  it('keeps independent headers through family changes, empty text and reset', () => {
    const before = parse();
    const authoring = { ...before.authoring, headerTexts: { visitors: 'Onze gasten & vrienden', welcome: '' } };
    const welcome = syncSlidePresentationSchema.parse({ ...before, authoring });
    const visitors = syncSlidePresentationSchema.parse({ ...welcome, family: 'visitors' });
    if (welcome.rendererVersion !== 'sync-onzetrots-v9' || visitors.rendererVersion !== 'sync-onzetrots-v9') throw Error('v9 required');
    expect(syncOnzeTrotsHeaderText(welcome)).toBe('');
    expect(syncOnzeTrotsHeaderText(visitors)).toBe('Onze gasten & vrienden');
    const reset = syncSlidePresentationSchema.parse({ ...welcome, authoring: { ...authoring, headerTexts: { visitors: authoring.headerTexts.visitors } } });
    if (reset.rendererVersion !== 'sync-onzetrots-v9') throw Error('v9 required');
    expect(syncOnzeTrotsHeaderText(reset)).toBe(syncContentFamilies.find(f => f.id === 'welcome')!.label);
    expect(reset.authoring.headerTexts.visitors).toBe('Onze gasten & vrienden');
  });

  it('bounds text and requested scale without interpreting text as facts or markup', () => {
    const before = parse(), text = '<img src=x onerror=alert(1)> & "<header>"';
    for (const header of ['', text, 'x'.repeat(120)]) {
      const slide = syncSlidePresentationSchema.parse({ ...before, authoring: { ...before.authoring, headerTexts: { welcome: header } } });
      if (slide.rendererVersion !== 'sync-onzetrots-v9') throw Error('v9 required');
      expect(syncOnzeTrotsHeaderText(slide)).toBe(header);
    }
    expect(syncSlidePresentationSchema.safeParse({ ...before, authoring: { ...before.authoring, headerTexts: { welcome: 'x'.repeat(121) } } }).success).toBe(false);
    expect(syncSlidePresentationSchema.safeParse({ ...before, authoring: { ...before.authoring, headerTexts: { unknown: 'forbidden' } } }).success).toBe(false);
    for (const value of [100, 125, 150, 175, 200]) expect(syncSlidePresentationSchema.safeParse({ ...before, authoring: { ...before.authoring, welcomeScalePercent: value } }).success).toBe(true);
    for (const value of [95, 101, 149.5, 205, NaN, Infinity]) expect(syncSlidePresentationSchema.safeParse({ ...before, authoring: { ...before.authoring, welcomeScalePercent: value } }).success).toBe(false);
  });

  it('retains authoring at the dynamic boundary while rejecting copied source facts', () => {
    const seed = parse();
    const config = { schemaVersion: 1, kind: 'dynamic', rendererVersion: seed.rendererVersion, sourceRevision: seed.sourceRevision, slideType: 'sport_visitor_arrivals', seed, secondsPerPage: 12 };
    expect(syncDynamicConfigurationSchema.parse(config).seed).toEqual(seed);
    expect(syncDynamicConfigurationSchema.safeParse({ ...config, seed: { ...seed, rich: { fixtures: [] } } }).success).toBe(false);
    expect(syncDynamicConfigurationSchema.safeParse({ ...config, seed: { ...seed, rows: [['fake', 'facts', '', '']] } }).success).toBe(false);
  });

  it('uses the internal phased entrance and retains audited renderer assets', () => {
    const slide = parse();
    expect(syncSlideTransition(slide)).toBeNull();
    expect(syncSlideMinimumDurationMs(slide)).toBeGreaterThanOrEqual(3600);
    expect(syncSlideAssets(slide)).toEqual([]);
    expect(syncSlideRendererAssets(slide).some(asset => asset.path.includes('RubikDistressed-Regular.ttf'))).toBe(true);
    expect(syncSlideRendererAssets(slide).some(asset => asset.path.includes('clubmuur-lettering.webp'))).toBe(true);
  });
  it('samples the completed first page rather than the next page intro at the four-second boundary',()=>{
    const slide=syncSlidePresentationSchema.parse({...input,family:'birthdays',rows:Array.from({length:7},(_,i)=>['24','oktober',`Eigen ${i}`,'Eigen team'])});
    const minimum=syncSlideMinimumDurationMs(slide);
    expect(minimum).toBe(8000);expect(syncSlidePosterTimeMs(slide,minimum)).toBe(3999);
    expect(syncSlideMinimumDurationMs(syncSlidePresentationSchema.parse({...input,family:'goal'}))).toBe(4000);
  });

  it('uses the actual club instead of carrying prototype club or venue labels into another tenant',()=>{
    for(const family of ['visitors','team-arrivals']){
      const slide=syncSlidePresentationSchema.parse({...input,family});if(slide.rendererVersion!=='sync-onzetrots-v9')throw Error('v9');
      expect(syncOnzeTrotsHeaderText(slide)).toContain('EIGEN CLUB');
      expect(syncOnzeTrotsHeaderText(slide)).not.toMatch(/DUINDORP|HOUTRUST/);
      expect(syncOnzeTrotsHeaderSubtitle(slide)).toBe('Eigen club · Sport');
    }
  });

});
