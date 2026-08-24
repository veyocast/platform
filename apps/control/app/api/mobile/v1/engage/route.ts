import {
  mobileEngageTransitionRequestSchema,
  mobileEngageTransitionResultSchema,
  type MobileEngageWorkspace
} from "@veyocast/contracts";

import {
  getMobileRequestContext,
  requireMobileTenant
} from "../../../../../lib/mobile-api/context";
import {
  mobileContextFailure,
  mobileData,
  mobileFailure
} from "../../../../../lib/mobile-api/response";

type EngageMetric = {
  campaign_id: string;
  option_count: number;
  total_votes: number;
};

export async function GET(request: Request) {
  try {
    const context = await getMobileRequestContext(request);
    const tenant = requireMobileTenant(
      request,
      context,
      "tenant.dynamic_slide.read"
    );
    const [flagResult, campaignResult] = await Promise.all([
      context.supabase
        .from("tenant_feature_flags")
        .select("enabled")
        .eq("tenant_id", tenant.id)
        .eq("flag_key", "engage")
        .maybeSingle(),
      context.supabase
        .from("engage_campaigns")
        .select(
          "id, public_id, kind, status, title, question, starts_at, ends_at, updated_at"
        )
        .eq("tenant_id", tenant.id)
        .neq("status", "archived")
        .order("updated_at", { ascending: false })
    ]);
    if (flagResult.error || campaignResult.error) {
      return queryFailure(context.requestId, flagResult.error ?? campaignResult.error);
    }

    const campaignIds = (campaignResult.data ?? []).map((campaign) => campaign.id);
    const metricsResult = campaignIds.length
      ? await context.supabase.rpc("get_engage_campaign_metrics_v1", {
          p_tenant_id: tenant.id
        })
      : { data: [], error: null };
    if (metricsResult.error) {
      return queryFailure(context.requestId, metricsResult.error);
    }

    const metricRows = (metricsResult.data ?? []) as EngageMetric[];
    const metrics = new Map(
      metricRows.map((row) => [row.campaign_id, row] as const)
    );
    const workspace: MobileEngageWorkspace = {
      campaigns: (campaignResult.data ?? []).map((campaign) => ({
        endsAt: campaign.ends_at,
        id: campaign.id,
        kind: campaign.kind as "motm" | "poll",
        optionCount: Number(metrics.get(campaign.id)?.option_count ?? 0),
        publicId: campaign.public_id,
        question: campaign.question,
        startsAt: campaign.starts_at,
        status: campaign.status as MobileEngageWorkspace["campaigns"][number]["status"],
        title: campaign.title,
        totalVotes: Number(metrics.get(campaign.id)?.total_votes ?? 0),
        updatedAt: campaign.updated_at
      })),
      enabled: flagResult.data?.enabled === true
    };
    return mobileData(workspace, context.requestId);
  } catch (error) {
    return mobileContextFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getMobileRequestContext(request);
    const tenant = requireMobileTenant(
      request,
      context,
      "tenant.dynamic_slide.write"
    );
    const parsed = mobileEngageTransitionRequestSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return mobileFailure({
        code: "VALIDATION",
        message: "De Engage-actie is niet geldig.",
        recovery: "Vernieuw de campagne en probeer het opnieuw.",
        requestId: context.requestId,
        status: 422
      });
    }
    const result = await context.supabase.rpc("transition_engage_campaign_v2", {
      p_campaign_id: parsed.data.campaignId,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_target_status: parsed.data.targetStatus,
      p_tenant_id: tenant.id
    });
    if (result.error) {
      console.error("Mobile Engage transition failed", {
        code: result.error.code,
        requestId: context.requestId
      });
      return mobileFailure({
        code:
          result.error.code === "42501" ? "FORBIDDEN" : "CONFLICT",
        message: "De campagnestatus kon niet veilig worden gewijzigd.",
        recovery: "Vernieuw de campagne en controleer of de status al gewijzigd is.",
        requestId: context.requestId,
        status: result.error.code === "42501" ? 403 : 409
      });
    }
    const transition = mobileEngageTransitionResultSchema.safeParse(result.data);
    if (!transition.success) {
      return mobileFailure({
        code: "TEMPORARILY_UNAVAILABLE",
        message: "De campagnestatus is gewijzigd, maar niet bevestigd.",
        recovery: "Vernieuw Engage voordat je de actie opnieuw uitvoert.",
        requestId: context.requestId,
        status: 503
      });
    }
    return mobileData(transition.data, context.requestId);
  } catch (error) {
    return mobileContextFailure(error);
  }
}

function queryFailure(requestId: string, error: { code?: string } | null) {
  console.error("Mobile Engage query failed", { code: error?.code, requestId });
  return mobileFailure({
    code: "TEMPORARILY_UNAVAILABLE",
    message: "Engage kon niet volledig worden bijgewerkt.",
    recovery: "Probeer het opnieuw. Een actieve campagne blijft doorlopen.",
    requestId,
    status: 503
  });
}
