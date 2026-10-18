// Native imports only the pure document/protocol helpers it uses. The full
// authoring barrel also exposes unrelated desktop geometry/template modules.
export * from "./mobile-control-v3";
export {createSyncStudioStarter, createSyncStudioDocument, updateSyncStudioDocument} from "./sync";
export {parseStudioDocument, type StudioDocument} from "./schema";
