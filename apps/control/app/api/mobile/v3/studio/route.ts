import {NextResponse} from "next/server";
import {mobileSyncStudioRequestV3Schema} from "@veyocast/studio";
import {getMobileRequestContext, requireMobileTenant} from "../../../../../lib/mobile-api/context";
import {mobileFailure} from "../../../../../lib/mobile-api/response";
import {mobileV2Failure} from "../../../../../lib/mobile/v2-failure";
import {readMobileV2Body} from "../../../../../lib/mobile/read-v2-body";
import {loadMobileStudioV3, mutateMobileStudioV3} from "../../../../../lib/mobile/studio-v3";
const response = (data: unknown, requestId: string) => NextResponse.json({data, meta: {requestId, version: "3"}}, {headers: {"Cache-Control": "private, no-store, max-age=0", Vary: "Authorization, X-VeyoCast-Tenant-Id"}});
export async function GET(request: Request) {
  try {
    const context = await getMobileRequestContext(request), tenant = requireMobileTenant(request, context, "tenant.studio.read");
    const params = new URL(request.url).searchParams, projectId = params.get("projectId") ?? undefined, offset = Number(params.get("offset") ?? 0);
    if (!Number.isInteger(offset) || offset < 0 || offset > 10000 || projectId && !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(projectId)) return mobileFailure({code: "VALIDATION", message: "De Studio-pagina is ongeldig.", recovery: "Open het ontwerp opnieuw vanuit Studio.", requestId: context.requestId, status: 422});
    return response(await loadMobileStudioV3(context, tenant, projectId, projectId ? 0 : offset), context.requestId);
  } catch (error) {return mobileV2Failure(error);}
}
export async function POST(request: Request) {
  try {
    const context = await getMobileRequestContext(request);
    const parsed = mobileSyncStudioRequestV3Schema.safeParse(await readMobileV2Body(request));
    if (!parsed.success) return mobileFailure({code: "VALIDATION", message: "Dit Sync-concept is ongeldig of te groot.", recovery: "Controleer de velden. Je lokale invoer blijft behouden.", requestId: context.requestId, status: 422});
    const input = parsed.data, tenant = requireMobileTenant(request, context, input.operation === "create" ? "tenant.studio.create" : input.operation === "render" ? "tenant.studio.render" : "tenant.studio.read");
    return response(await mutateMobileStudioV3(context, tenant, input), context.requestId);
  } catch (error) {return mobileV2Failure(error);}
}
