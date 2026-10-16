import {inspectGoalMedia}from"./goal-media-probe";
export type PlayerVideoProbeScope={tenantId:string;screenId:string;assetId:string;releaseSha:string;environment:string};
export function validatePlayerVideoProbeScope(scope:PlayerVideoProbeScope,runtime:{revision:string;environment:string;lastPollAt:number},now=Date.now()){
 const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
 if(!uuid.test(scope.tenantId)||!uuid.test(scope.screenId)||!uuid.test(scope.assetId)||!/^[0-9a-f]{40}$/.test(scope.releaseSha)||!["staging","production"].includes(scope.environment)||runtime.revision!==scope.releaseSha||runtime.environment!==scope.environment||!Number.isFinite(runtime.lastPollAt)||now-runtime.lastPollAt>75000||runtime.lastPollAt>now+5000)throw Error("PROBE_SCOPE_INVALID");
}
export async function inspectPublishedPlayerVideo({scope,releaseId,asset,download,inspect=inspectGoalMedia}:{scope:PlayerVideoProbeScope;releaseId:string;asset:{tenant_id:string;media_asset_id:string;file_size_bytes:number;storage_bucket:string;storage_path:string;checksum_sha256:string;mime_type:string;width:number;height:number};download:(bucket:string,path:string)=>Promise<Blob>;inspect?:typeof inspectGoalMedia}){
 if(asset.tenant_id!==scope.tenantId||asset.media_asset_id!==scope.assetId||!Number.isSafeInteger(asset.file_size_bytes)||asset.file_size_bytes<1||asset.file_size_bytes>128*1024*1024||asset.mime_type!=="video/mp4")throw Error("VIDEO_PROBE_ASSET_INVALID");
 const inspection=await inspect({tenantId:scope.tenantId,assetId:scope.assetId,asset,orientation:asset.height>asset.width?"portrait":"landscape",download});
 return{event:"published_player_video_probe",tenantId:scope.tenantId,screenId:scope.screenId,assetId:scope.assetId,releaseId,releaseSha:scope.releaseSha,...inspection};
}
