/** Inspect only the trusted renderer subtree. The surrounding scene may still
 * be hidden while preparation runs; requiring that parent would deadlock the
 * handoff. For v9 a painted background alone is not visible Source content. */
export function hasVisibleSyncDomFrame(root:ParentNode|null,rendererVersion:string):boolean{
 const frame=root?.querySelector<HTMLElement>('.vc-slide-preview'),box=frame?.getBoundingClientRect(),animated=root?.querySelector<HTMLElement>('.sync-slide-animated');
 if(!frame||!box?.width||!box.height||getComputedStyle(frame).visibility!=='visible'||Number(getComputedStyle(frame).opacity)===0||animated&&Number(getComputedStyle(animated).opacity)===0)return false;
 if(rendererVersion==='sync-onzetrots-v9'){
  const screen=frame.querySelector<HTMLElement>('.screen');if(!screen||Number(getComputedStyle(screen,'::before').opacity)===0)return false;
  const content=screen.querySelectorAll<HTMLElement>('.slide-content .panel,.slide-content .photo-panel,.slide-content .pitch,.slide-content .goal-scene,.slide-content .video-layout');
  if(!content.length){
   // An authorized empty birthday/activity selection deliberately has six
   // invisible slots. Its visible approved heading is the complete empty frame.
   const header=screen.querySelector<HTMLElement>('.slide-header-container');
   return Boolean(screen.querySelector('.fixed-six-grid[data-filled-count="0"]')&&header?.textContent?.trim()&&Number(getComputedStyle(header).opacity)>0);
  }
  if([...content].some(element=>Number(getComputedStyle(element).opacity)===0))return false;
 }
 return true;
}
