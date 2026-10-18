import type { ImageUploadApiResult } from "../../../../../../lib/media/image-upload-api";

/** A receipt and a verified library preview are both required before selection. */
export async function uploadBackground(file:File,expectedActorScope?:string):Promise<{assetId:string;previewUrl:string;checksumSha256?:string}> {
  const name=file.name.replace(/\.[^.]+$/,"").trim();
  const form=new FormData();form.set("media",file);form.set("title",name.length>=2?name.slice(0,120):"Nieuwe afbeelding");
  const upload=new AbortController();
  const uploadDeadline=setTimeout(()=>upload.abort(),120000);
  let assetId:string;
  try {
    const response=await fetch("/api/media/images",{method:"POST",body:form,signal:upload.signal,...(expectedActorScope!==undefined?{headers:{"X-VeyoCast-Actor-Scope":expectedActorScope}}:{})});
    let body:ImageUploadApiResult|null;
    try {body=await response.json() as ImageUploadApiResult|null;}
    catch {throw new Error(response.status===413?"Het bestand is te groot voor de uploadservice. Verklein de afbeelding en probeer opnieuw.":"De uploadservice gaf geen bruikbare bevestiging. Controleer de beeldbank voordat je opnieuw uploadt.");}
    if(!response.ok||!body?.ok||!body.data?.assetId){
      const problem=body&&!body.ok?body.error:undefined;
      throw new Error(problem?.message?[problem.message,problem.recovery].filter(Boolean).join(" "):"De upload is niet bevestigd. Controleer de beeldbank en probeer opnieuw.");
    }
    assetId=body.data.assetId;
  } catch(error) {
    if(upload.signal.aborted)throw new Error("De upload is niet op tijd bevestigd. Het bestand is nog niet geselecteerd; controleer de beeldbank voordat je opnieuw uploadt.");
    throw error;
  } finally {clearTimeout(uploadDeadline);}
  const verification=new AbortController();
  const verificationDeadline=setTimeout(()=>verification.abort(),25000);
  try {
    for(let attempt=0;attempt<20&&!verification.signal.aborted;attempt++){
      const preview=await fetch(`/api/publisher/library?tab=media&assetId=${encodeURIComponent(assetId)}`,{cache:"no-store",signal:verification.signal});
      const result=await preview.json()as{media?:Array<{id:string;image:string;checksumSha256?:string}>};
      const asset=result.media?.find(item=>item.id===assetId&&item.image);
      if(preview.ok&&asset)return{assetId,previewUrl:asset.image,checksumSha256:asset.checksumSha256};
      if(!preview.ok)throw new Error("Je upload is opgeslagen, maar de beeldbank kon de beschikbaarheid niet bevestigen. Vernieuw de beeldbank; upload het bestand niet opnieuw.");
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
  } catch {
    if(!verification.signal.aborted)throw new Error("Je upload is opgeslagen, maar de beeldbank kon de beschikbaarheid niet bevestigen. Vernieuw de beeldbank; upload het bestand niet opnieuw.");
  } finally {clearTimeout(verificationDeadline);}
  throw new Error("Je upload is opgeslagen en wordt nog verwerkt. Open de beeldbank om de verwerkingsstatus te controleren.");
}
