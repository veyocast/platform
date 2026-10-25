/** Decode the complete final frame with the existing independent ZXing reader.
 * No DOM crop, renderer, expected QR matrix or provider request is used. */
import{readFileSync}from'node:fs';
import{createRequire}from'node:module';
import{dirname,resolve}from'node:path';
const require=createRequire(new URL('../../apps/media-worker/package.json',import.meta.url));
const sharp=require('sharp');
const{prepareZXingModule,readBarcodes}=require('zxing-wasm/reader');
const wasm=Uint8Array.from(readFileSync(resolve(dirname(require.resolve('zxing-wasm/reader')),'../../reader/zxing_reader.wasm'))).buffer;
prepareZXingModule({overrides:{wasmBinary:wasm}});
const frame=process.argv[2]!;
const image=await sharp(frame).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const results=await readBarcodes({colorSpace:'srgb',data:Uint8ClampedArray.from(image.data),width:image.info.width,height:image.info.height},{formats:['QRCode'],tryHarder:Boolean(process.argv[3])});
const urls=results.map((result:{text:string})=>result.text);
if(JSON.stringify(urls)!==JSON.stringify(process.argv[3]?[process.argv[3]]:[]))throw Error('Final frame QR differs from the displayed article: '+JSON.stringify(urls));
process.stdout.write(JSON.stringify({frame,decoded:urls})+'\n');
