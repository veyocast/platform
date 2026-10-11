export type SitesSourceDestinationOptions = {
  canPublish: boolean; unavailable: boolean;
  playlists: Array<{ id: string; name: string; revision: number }>;
  screens: Array<{ id: string; name: string; orientation: string }>;
  groups: Array<{ id: string; name: string; screenIds: string[] }>;
};
export type SitesSourceDestination = { mode: "save" | "publish"; playlistId: string; expectedRevision: number; screenIds: string[] };
export const emptySitesSourceDestinationOptions: SitesSourceDestinationOptions = { canPublish: false, unavailable: false, playlists: [], screens: [], groups: [] };
export const initialSitesSourceDestination: SitesSourceDestination = { mode: "save", playlistId: "", expectedRevision: 0, screenIds: [] };
export function validSitesSourceDestination(value: SitesSourceDestination, options: SitesSourceDestinationOptions) {
  return value.mode === "save" || (options.canPublish && !options.unavailable && options.playlists.some(playlist => playlist.id === value.playlistId && playlist.revision === value.expectedRevision) && value.screenIds.length > 0 && value.screenIds.length <= 100 && new Set(value.screenIds).size === value.screenIds.length && value.screenIds.every(id => options.screens.some(screen => screen.id === id)));
}
export function toggleSitesSourceDestinationScreens(current: string[], selected: string[], enabled: boolean) {
  return enabled ? [...new Set([...current, ...selected])].slice(0, 100) : current.filter(id => !selected.includes(id));
}
