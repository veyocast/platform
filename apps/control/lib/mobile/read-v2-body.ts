/** Enforce the transport limit before JSON decoding or schema validation. */
export async function readMobileV2Body(request:Request,maximumBytes=524288):Promise<unknown>{
 if(Number(request.headers.get("Content-Length"))>maximumBytes||!request.body)return null;
 const reader=request.body.getReader();const chunks:Uint8Array[]=[];let count=0;
 try{for(;;){const part=await reader.read();if(part.done)break;count+=part.value.byteLength;if(count>maximumBytes)return null;chunks.push(part.value);}const bytes=new Uint8Array(count);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return JSON.parse(new TextDecoder().decode(bytes));}catch{return null;}finally{await reader.cancel().catch(()=>undefined);reader.releaseLock();}
}
