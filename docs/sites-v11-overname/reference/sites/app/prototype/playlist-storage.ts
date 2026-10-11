/** Persist the related publication records before announcing success to the UI. */
export function writePlaylistState(entries:Record<string,unknown>,storage?:Storage):boolean {
  const previous=new Map<string,string|null>();
  const written:string[]=[];
  let target:Storage|undefined;
  try {
    target=storage??window.localStorage;
    const serialized=Object.entries(entries).map(([key,value])=>[`veyocast-demo-${key}`,JSON.stringify(value)] as const);
    for(const [key] of serialized)previous.set(key,target.getItem(key));
    for(const [key,value] of serialized){target.setItem(key,value);written.push(key)}
    return true;
  } catch {
    for(const key of written.reverse()){
      try {const old=previous.get(key);if(old==null)target?.removeItem(key);else target?.setItem(key,old)} catch { /* The UI reloads persisted state and reports the failure. */ }
    }
    return false;
  }
}
