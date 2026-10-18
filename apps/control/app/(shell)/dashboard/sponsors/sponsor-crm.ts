export const opportunityStages = ["lead", "contacted", "proposal", "won", "lost"] as const;
export const taskStatuses = ["open", "done", "dismissed"] as const;
export const sponsorCrmPageSize = 25;

export type SponsorOpportunity = {
  id: string;
  name: string;
  stage: string;
  estimated_value_cents: number | string | null;
  next_action_at: string | null;
};
export type SponsorTask = { id: string; title: string; status: string; due_at: string | null };
export type SponsorCrmParams = {
  crm?: string;
  crmQuery?: string;
  crmStage?: string;
  crmStatus?: string;
  opportunityPage?: string;
  taskPage?: string;
};
export type SponsorCrmFilter = ReturnType<typeof parseSponsorCrmFilter>;
export type SponsorCrmData = {
  error: boolean;
  opportunities: SponsorOpportunity[];
  opportunityCount: number;
  taskCount: number;
  tasks: SponsorTask[];
};

export function parseSponsorCrmFilter(params: SponsorCrmParams) {
  return {
    query: (typeof params.crmQuery === "string" ? params.crmQuery : "").trim().slice(0, 120),
    stage: opportunityStages.find(stage => stage === params.crmStage) ?? "all",
    status: taskStatuses.find(status => status === params.crmStatus) ?? "all",
    opportunityPage: parsePage(params.opportunityPage),
    taskPage: parsePage(params.taskPage)
  };
}

export function sponsorCrmHref(filter: SponsorCrmFilter, change: Partial<SponsorCrmFilter>) {
  const next = { ...filter, ...change };
  const params = new URLSearchParams({ crm: "1" });
  if (next.query) params.set("crmQuery", next.query);
  if (next.stage !== "all") params.set("crmStage", next.stage);
  if (next.status !== "all") params.set("crmStatus", next.status);
  if (next.opportunityPage > 1) params.set("opportunityPage", String(next.opportunityPage));
  if (next.taskPage > 1) params.set("taskPage", String(next.taskPage));
  return `/dashboard/sponsors?${params}#kansen`;
}

export function literalSponsorCrmSearch(value: string) {
  // PostgREST's regex operator does not reinterpret '*' as a LIKE alias.
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePage(value: string | undefined) {
  return typeof value === "string" && /^[1-9]\d{0,5}$/.test(value) ? Number(value) : 1;
}
