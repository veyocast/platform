export type SyncStudioSeriesCommand={projectId:string;draftRevision:number;seriesId:string|null;seriesRevision:number|null;operation:'add'|'duplicate'|'remove'|'reorder'|'rename';name:string|null;memberIds:string[]|null;idempotencyKey:string};
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export function parseSyncStudioSeriesCommand(value:unknown):SyncStudioSeriesCommand|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;const item=value as Record<string,unknown>;
 const fields=['projectId','draftRevision','seriesId','seriesRevision','operation','name','memberIds','idempotencyKey'];
 if(Object.keys(item).length!==fields.length||Object.keys(item).some(key=>!fields.includes(key))||typeof item.projectId!=='string'||!uuid.test(item.projectId)||typeof item.idempotencyKey!=='string'||!uuid.test(item.idempotencyKey)||!Number.isSafeInteger(item.draftRevision)||Number(item.draftRevision)<0||item.seriesId!==null&&(typeof item.seriesId!=='string'||!uuid.test(item.seriesId))||item.seriesRevision!==null&&(!Number.isSafeInteger(item.seriesRevision)||Number(item.seriesRevision)<1)||(item.seriesId===null)!==(item.seriesRevision===null)||!['add','duplicate','remove','reorder','rename'].includes(String(item.operation))||item.name!==null&&(typeof item.name!=='string'||item.name.length>120)||item.memberIds!==null&&(!Array.isArray(item.memberIds)||item.memberIds.length>20||item.memberIds.some(id=>typeof id!=='string'||!uuid.test(id))))return null;
 return item as SyncStudioSeriesCommand;
}
