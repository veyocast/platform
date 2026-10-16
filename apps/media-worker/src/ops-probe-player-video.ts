import{readFile}from"node:fs/promises";
import{createConfiguredMediaWorkerClient}from"./worker-backend";
import{inspectPublishedPlayerVideo,validatePlayerVideoProbeScope}from"./player-video-probe";
async function main(){
 const[tenantId,screenId,assetId,releaseSha,environment]=process.argv.slice(2);const scope={tenantId:tenantId??"",screenId:screenId??"",assetId:assetId??"",releaseSha:releaseSha??"",environment:environment??""};
 const runtime=JSON.parse(await readFile("/tmp/veyocast-media-worker-ready.json","utf8"));
 validatePlayerVideoProbeScope(scope,runtime);
 if(process.env.DEPLOYMENT_SHA!==scope.releaseSha||process.env.VEYOCAST_ENVIRONMENT!==scope.environment)throw Error("PROBE_SCOPE_INVALID");
 const client=createConfiguredMediaWorkerClient();
 const tenant=await client.from("tenants").select("id,status").eq("id",scope.tenantId).eq("status","active").single();if(tenant.error)throw Error("TENANT_READ_FAILED");
 const device=await client.from("player_devices").select("id,desired_release_id").eq("tenant_id",scope.tenantId).eq("screen_id",scope.screenId).eq("status","paired").single();if(device.error||!device.data.desired_release_id)throw Error("DEVICE_READ_FAILED");
 const releaseId=device.data.desired_release_id as string;
 const item=await client.from("playlist_release_items").select("tenant_id,media_asset_id,file_size_bytes,storage_bucket,storage_path,checksum_sha256,mime_type,width,height").eq("tenant_id",scope.tenantId).eq("release_id",releaseId).eq("media_asset_id",scope.assetId).eq("asset_kind","video").single();if(item.error)throw Error("VIDEO_ITEM_READ_FAILED");
 const result=await inspectPublishedPlayerVideo({scope,releaseId,asset:item.data,download:async(bucket,path)=>{const read=await client.storage.from(bucket).download(path);if(read.error||!read.data)throw Error("ASSET_DOWNLOAD_FAILED");return read.data;}});
 const latest=await client.from("player_devices").select("desired_release_id").eq("tenant_id",scope.tenantId).eq("id",device.data.id).single();if(latest.error||latest.data.desired_release_id!==releaseId)throw Error("PROBE_TARGET_CHANGED");
 console.info(JSON.stringify(result));
}
main().catch((error:unknown)=>{const code=error instanceof Error&&/^[A-Z_]{3,80}$/.test(error.message)?error.message:"VIDEO_PROBE_FAILED";console.error(JSON.stringify({event:"published_player_video_probe_failed",code}));process.exitCode=1;});
