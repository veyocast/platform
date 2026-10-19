import { describe, expect, it } from "vitest";
import { syncContentFamilies, syncSlidePageCount, syncSlidePresentationSchema } from "@veyocast/contracts";
import {
  createSyncStudioStarter,
  createSyncStudioDocument,
  updateSyncStudioDocument,
  parseStudioDocument,
  studioDocumentAssetIds,
  studioSitesSystemTemplates,
  createEmptyStudioDocument,
} from "../src/index";

describe("additive Sync Studio documents", () => {
  it("exports selected motion as video and can explicitly return a single-page design to PNG",()=>{
    const animated=createSyncStudioStarter({family:'free',tenantName:'Club A'});
    expect(animated.motion.enabled).toBe(true);
    expect(()=>parseStudioDocument({...animated,motion:{...animated.motion,enabled:false}})).toThrow(/video/);
    const still=updateSyncStudioDocument(animated,{...animated.syncPresentation!,style:{...animated.syncPresentation!.style,motion:'geen'}});
    expect(still.motion.enabled).toBe(false);
    const legacy={...still.syncPresentation!,style:{...still.syncPresentation!.style}};delete legacy.style.motion;
    expect(createSyncStudioDocument(legacy).motion.enabled).toBe(false);
  });
  it("refuses names that cannot be saved as a Studio project",()=>{
    const document=createSyncStudioStarter({family:"free",tenantName:"Club A"});
    for(const name of [" ","a".repeat(121)])expect(()=>parseStudioDocument({...document,syncPresentation:{...document.syncPresentation!,name}})).toThrow();
  });
  it("creates all Source families without adopting prototype facts or a fabricated badge", () => {
    for (const family of syncContentFamilies)
      for (const orientation of ["landscape", "portrait"] as const)
        for (const theme of ["fieldflow", "onzetrots-tv"] as const) {
          const document = createSyncStudioStarter({
            family: family.id,
            orientation,
            theme,
            tenantName: "Club A",
          });
          expect(parseStudioDocument(document)).toEqual(document);
          expect(document.artboard.orientation).toBe(orientation);
          expect(document.syncPresentation).toMatchObject({
            family: family.id,
            club: { name: "Club A" },
            rows: [],
            news: [],
            footer: "",
            footerRight: "",
          });
          expect(JSON.stringify(document)).not.toMatch(
            /Duindorp|Houtrust|1950|2,20/,
          );
          expect(document.sitesPresentation).toBeUndefined();
        }
  });
  it("keeps historical documents valid and refuses mixed renderers or free layers", () => {
    for (const template of studioSitesSystemTemplates)
      expect(parseStudioDocument(template.document)).toEqual(template.document);
    const document = createSyncStudioStarter({
      family: "free",
      tenantName: "Club A",
    });
    expect(() =>
      parseStudioDocument({
        ...document,
        sitesPresentation:
          studioSitesSystemTemplates[0]!.document.sitesPresentation,
      }),
    ).toThrow();
    expect(() =>
      parseStudioDocument({ ...document, elements: [{ id: "bad" }] }),
    ).toThrow();
    expect(() =>
      parseStudioDocument({
        ...document,
        artboard: { ...document.artboard, orientation: "portrait" },
      }),
    ).toThrow();
  });
  it("uses every page in the bounded export duration, and never silently drops rows", () => {
    const original = createSyncStudioStarter({
        family: "fixtures",
        tenantName: "Club A",
      }),
      slide = {
        ...original.syncPresentation!,
        rows: Array.from(
          { length: 17 },
          (_, i): [string, string, string, string] => [
            `Team ${i}`,
            "Club B",
            "11:00",
            "2",
          ],
        ),
      };
    const document = createSyncStudioDocument(slide, 12);
    expect(syncSlidePageCount(slide)).toBe(5);
    expect(document.motion).toMatchObject({ enabled: true, durationMs: 60000 });
    expect(() => createSyncStudioDocument(slide, 25)).toThrow(/120/);
    expect(() => createSyncStudioDocument(slide, 2)).toThrow();
    expect(() =>
      parseStudioDocument({
        ...document,
        motion: { ...document.motion, durationMs: 10000 },
      }),
    ).toThrow();
    expect(() =>
      parseStudioDocument({
        ...createEmptyStudioDocument(),
        motion: { enabled: false, durationMs: 60000, fps: 30 },
      }),
    ).toThrow();
  });
  it("retains metadata, the Source identity and every unique tenant asset across edits", () => {
    const asset = {
        kind: "tenant" as const,
        mediaAssetId: "22600000-0000-4000-8000-000000000001",
        checksumSha256: "a".repeat(64),
      },
      document = createSyncStudioStarter({
        family: "welcome",
        tenantName: "Club A",
        logo: asset,
      });
    const updated = updateSyncStudioDocument(
      {
        ...document,
        metadata: { ...document.metadata, tenantBrandApplied: true },
      },
      {
        ...document.syncPresentation!,
        title: "Een nieuwe titel",
        home: { name: "Club A", team: "", logo: asset },
      },
    );
    expect(studioDocumentAssetIds(updated)).toEqual([asset.mediaAssetId]);
    expect(updated.metadata.tenantBrandApplied).toBe(true);
    expect(updated.syncPresentation?.rendererVersion).toBe("sync-v1");
    expect(updated.syncPresentation?.title).toBe("Een nieuwe titel");
    expect(() =>
      updateSyncStudioDocument(
        createEmptyStudioDocument(),
        document.syncPresentation!,
      ),
    ).toThrow();
  });
});

it("keeps historical Engage binaries unchanged and requires a complete video for all twenty-four paged answers",()=>{
 const starter=createSyncStudioStarter({family:"engage",tenantName:"Club A"}).syncPresentation!;
 const options=(count:number)=>Array.from({length:count},(_,i)=>({id:`26200000-0000-4000-8000-${String(i).padStart(12,"0")}`,label:`Speler ${i+1}`,votes:0}));
 const poll={id:"26200000-0000-4000-8000-000000000100",title:"Wie was de beste speler?",status:"live" as const,visibility:"after_close" as const};
 const legacy=syncSlidePresentationSchema.parse({...starter,poll:{...poll,options:options(12)},style:{...starter.style,motion:"geen"}});
 const original=createSyncStudioDocument(legacy,3);
 expect(original.motion).toMatchObject({enabled:false,durationMs:3000});
 expect(parseStudioDocument(original)).toEqual(original);
 expect(updateSyncStudioDocument(original,legacy).motion).toEqual(original.motion);
 const paged=syncSlidePresentationSchema.parse({...legacy,poll:{...poll,optionsPerPage:4,options:options(24)}}),complete=createSyncStudioDocument(paged,12);
 expect(complete.motion).toMatchObject({enabled:true,durationMs:72000});
 expect(complete.syncPresentation?.poll?.options).toEqual(options(24));
 expect(()=>createSyncStudioDocument(paged,21)).toThrow(/120/);
 expect(()=>parseStudioDocument({...complete,motion:{...complete.motion,durationMs:17999}})).toThrow(/drie/);
 expect(()=>parseStudioDocument({...complete,motion:{...complete.motion,enabled:false}})).toThrow(/video/);
});
