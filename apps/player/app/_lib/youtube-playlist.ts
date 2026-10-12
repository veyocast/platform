/** Official order is preserved, including repeated occurrences. */
export function nextYouTubePlaylistIndex({videos,current,unavailable,repeat,boundaryRequested}:{videos:readonly string[];current:number;unavailable:ReadonlySet<string>;repeat:boolean;boundaryRequested:boolean}):number|null{
 if(boundaryRequested)return null;
 for(let offset=1;offset<=videos.length;offset++){
  const candidate=current+offset;
  if(candidate>=videos.length&&!repeat)return null;
  const index=candidate%videos.length;
  if(videos[index]&&!unavailable.has(videos[index]!))return index;
 }
 return null;
}
