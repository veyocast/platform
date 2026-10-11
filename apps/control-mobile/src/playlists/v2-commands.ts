import {playlistBatchCommandSchema,type MobilePlaylistDetailV2,type MobilePlaylistMutationRequest,type MobilePlaylistLibraryV2,type PlaylistBatchCommand,type PlaylistBatchOperation} from "@veyocast/contracts";
/** The v2 patch protocol leaves every unmentioned rich placement field untouched. */
export function mobilePlaylistMutationToV2(playlist:MobilePlaylistDetailV2,input:MobilePlaylistMutationRequest):PlaylistBatchCommand {
 let operation:PlaylistBatchOperation;
 if(input.operation==="add_item")operation={operation:"add_media",clientId:input.idempotencyKey,mediaAssetId:input.mediaAssetId,durationSeconds:15};
 else if(input.operation==="remove_item")operation={operation:"remove",itemId:input.itemId};
 else if(input.operation==="move_item"){const ids=playlist.items.map(item=>item.id);const from=ids.indexOf(input.itemId);if(from<0||input.targetPosition>=ids.length)throw Error("Het item is intussen gewijzigd.");ids.splice(input.targetPosition,0,...ids.splice(from,1));operation={operation:"reorder",itemIds:ids};}
 else operation={operation:"patch",itemId:input.itemId,patch:{durationSeconds:input.durationSeconds,displayTitle:input.displayName,fitMode:input.fitMode,muted:input.muted}};
 return playlistBatchCommandSchema.parse({playlistId:playlist.id,expectedRevision:input.expectedRevision,idempotencyKey:input.idempotencyKey,operations:[operation]});
}
export function mobileLibraryAddOperation(entry:MobilePlaylistLibraryV2["entries"][number],ids:readonly string[],seconds=15):PlaylistBatchOperation {
 const clientId=ids[0];if(!clientId)throw Error("De nieuwe itemidentiteit ontbreekt.");
 if(entry.type==="media"&&entry.mediaAssetId)return{operation:"add_media",clientId,mediaAssetId:entry.mediaAssetId,durationSeconds:seconds};
 if(entry.type==="dynamic"&&entry.snapshotId)return{operation:"add_dynamic",clientId,dynamicSlideId:entry.id,expectedSnapshotId:entry.snapshotId,durationSeconds:seconds};
 if(entry.type==="youtube")return{operation:"add_youtube",clientId,sourceId:entry.id,durationSeconds:seconds};
 if(entry.type==="studio"&&entry.seriesRevision!==null&&entry.memberCount>0&&ids.length===entry.memberCount)return{operation:"add_studio_series",clientId,clientItemIds:[...ids],seriesId:entry.id,expectedSeriesRevision:entry.seriesRevision};
 throw Error("Deze inhoud is nog niet volledig gereed. Ververs de bibliotheek.");
}
