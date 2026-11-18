import type { Capability } from "@veyocast/auth";

export const agentResources = {
  screens: { table: "screens", fields: "id,name,location,orientation,status,assigned_playlist_id,assigned_release_id,target_revision,updated_at", capability: "tenant.screen.read", label: "name", href: "/dashboard/screens/" },
  groups: { table: "screen_groups", fields: "id,name,description,status,revision,default_playlist_id,updated_at", capability: "tenant.screen.read", label: "name", href: "/dashboard/screen-groups" },
  media: { table: "media_assets", fields: "id,title,kind,status,width,height,duration_seconds,updated_at", capability: "tenant.media.read", label: "title", href: "/dashboard/media/" },
  playlists: { table: "playlists", fields: "id,name,description,status,revision,updated_at", capability: "tenant.playlist.read", label: "name", href: "/dashboard/playlists/" },
  schedules: { table: "content_schedules", fields: "id,name,target_kind,target_screen_id,target_screen_group_id,playlist_id,release_id,timezone_name,schedule_kind,starts_at,ends_at,enabled,revision,priority,updated_at", capability: "tenant.release.read", label: "name", href: "/dashboard/planning" },
  slides: { table: "dynamic_slides", fields: "id,name,status,orientation,revision,current_published_version_id,active_draft_version_id,data_source_id,updated_at", capability: "tenant.dynamic_slide.read", label: "name", href: "/dashboard/slides/" },
  studio: { table: "studio_projects", fields: "id,name,status,orientation,revision,updated_at", capability: "tenant.studio.read", label: "name", href: "/dashboard/studio/" }
} as const satisfies Record<string, { table: string; fields: string; capability: Capability; label: string; href: string }>;

export const agentCommands = {
  playlist: ["create", "update_details", "add_item", "update_item", "remove_item", "move_item", "archive", "restore", "duplicate", "delete", "update_playlist_defaults", "update_item_presentation", "duplicate_item", "replace_item", "create_section", "update_section", "move_section", "delete_section", "assign_item_section", "add_dynamic_slide", "publish"],
  group: ["create", "update", "archive"],
  media: ["rename", "archive", "restore"],
  screen: ["rename", "groups"],
  schedule: ["create", "update", "enable", "disable", "delete"],
  studio: ["create", "save", "rename", "archive", "restore", "duplicate", "delete"],
  attachment: ["retain"]
} as const;

export type AgentDomain = keyof typeof agentCommands;
export type AgentStep = { domain: AgentDomain; operation: string; args: Record<string, unknown>; commandKey: string; label: string; href: string; affectedScreens: Array<{ id: string; name: string }> };
export type AgentPlan = { schemaVersion: 1; timezone: string; steps: AgentStep[] };
export type AgentProposal = { id: string; conversation_id: string; plan: AgentPlan; plan_hash: string; status: string; receipts: Array<{ step: number; result: Record<string, unknown>; completedAt: string }>; next_step: number; last_error_code: string | null };
export type AgentAttachment = { id: string; title: string; status: string; kind: "image" | "video"; width: number | null; height: number | null; previewUrl: string | null; sourceUrl: string | null; retained: boolean };

export function commandCapability(domain: AgentDomain, operation: string): Capability {
  if (domain === "playlist") return operation === "publish" ? "tenant.playlist.publish" : ["archive", "restore", "delete"].includes(operation) ? "tenant.playlist.archive" : "tenant.playlist.write";
  if (domain === "media" || domain === "attachment") return "tenant.media.write";
  if (domain === "group" || domain === "screen") return "tenant.screen.manage";
  if (domain === "studio") return ["create", "duplicate"].includes(operation) ? "tenant.studio.create" : ["archive", "restore", "delete"].includes(operation) ? "tenant.studio.archive" : "tenant.studio.edit_own";
  return "tenant.playlist.write";
}

export function parseAgentDraft(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Het voorstel heeft geen geldig formaat.");
  const input = value as Record<string, unknown>;
  if (!Array.isArray(input.steps) || input.steps.length < 1 || input.steps.length > 20) throw Error("Kies één tot twintig afzonderlijke stappen voor dit voorstel.");
  return input.steps.map((entry: unknown) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw Error("Een voorstelstap is ongeldig.");
    const step = entry as Record<string, unknown>;
    const domain = String(step.domain) as AgentDomain;
    if (!Object.hasOwn(agentCommands, domain) || !(agentCommands[domain] as readonly string[]).includes(String(step.operation))) throw Error("Deze actie wordt nog niet door de agent ondersteund. Gebruik de gewone editor; er is niets gewijzigd.");
    const args = typeof step.argsJson === "string" ? JSON.parse(step.argsJson) as unknown : step.args;
    if (!args || typeof args !== "object" || Array.isArray(args) || JSON.stringify(args).length > 100000) throw Error("De stapgegevens zijn ongeldig of te groot.");
    return { domain, operation: String(step.operation), args: args as Record<string, unknown> };
  });
}
