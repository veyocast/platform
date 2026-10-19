// Presentation guidance only. The existing command rechecks permissions and targets.
export type ScreenAssignmentContext = { requested: boolean; ids: string[]; invalid: boolean };
type ScreenState = { screen: { id: string; status: string }; preflight: { status: string } };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseScreenAssignmentContext(value: unknown): ScreenAssignmentContext {
  if (value === undefined || value === null) return { requested: false, ids: [], invalid: false };
  const invalid = { requested: true, ids: [], invalid: true };
  if (typeof value !== "string" || !value || value.length > 3_699) return invalid;
  const ids = value.split(",");
  if (ids.length > 100 || ids.some(id => !uuid.test(id))) return invalid;
  return { requested: true, ids: [...new Set(ids.map(id => id.toLowerCase()))], invalid: false };
}

export function resolveScreenAssignmentContext(context: ScreenAssignmentContext, states: readonly ScreenState[]) {
  const eligible = new Set(states.filter(state => state.screen.status !== "disabled" && state.preflight.status !== "blocked").map(state => state.screen.id));
  const ids = context.invalid ? [] : context.ids.filter(id => eligible.has(id));
  return { ...context, ids, rejected: context.requested && (context.invalid || ids.length !== context.ids.length) };
}

export function screenAssignmentReviewHref(releaseId: string, screenId: string) {
  if (!uuid.test(releaseId) || !uuid.test(screenId)) return null;
  return `/dashboard/publications/${releaseId}?screens=${screenId}#opnieuw-toewijzen`;
}

export function withScreenAssignmentContext(href: string, context: ScreenAssignmentContext) {
  if (!context.requested) return href;
  return `${href}&screens=${encodeURIComponent(context.invalid ? "" : context.ids.join(","))}#opnieuw-toewijzen`;
}
