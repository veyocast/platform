import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {URL} from "node:url";
import {describe,expect,it} from "vitest";
type FontProvenance={sourceSha256:string;fonts:Array<{path:string;weight:number;sha256:string;bytes:number;glyphCount:number}>};
const provenance:FontProvenance=JSON.parse(readFileSync(new URL("../../assets/fonts/sites-font-provenance.json",import.meta.url),"utf8"));
describe("audited Sites Inter fonts for Android and iOS",()=>{
 it("derives only from the approved Sites font and ships every native UI weight",()=>{const source=readFileSync(new URL("../../../player/public/fonts/inter.woff2",import.meta.url));expect(createHash("sha256").update(source).digest("hex")).toBe(provenance.sourceSha256);expect(provenance.sourceSha256).toBe("3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62");expect(provenance.fonts.map(font=>font.weight)).toEqual([400,500,600,700]);});
 it("verifies native TrueType bytes and the unchanged glyph count for each weight",()=>{for(const font of provenance.fonts){const bytes=readFileSync(new URL(`../../assets/fonts/${font.path}`,import.meta.url));expect(bytes.length).toBe(font.bytes);expect(createHash("sha256").update(bytes).digest("hex")).toBe(font.sha256);expect(bytes.readUInt32BE(0)).toBe(0x00010000);const count=bytes.readUInt16BE(4);const tables=Array.from({length:count},(_,index)=>{const offset=12+index*16;return{tag:bytes.toString("ascii",offset,offset+4),offset:bytes.readUInt32BE(offset+8)};});const maxp=tables.find(table=>table.tag==="maxp");expect(maxp).toBeDefined();expect(bytes.readUInt16BE(maxp!.offset+4)).toBe(font.glyphCount);expect(font.glyphCount).toBe(518);}});
});
