import { getMobileRequestContext } from "../../../../../lib/mobile-api/context";
import {
  mobileContextFailure,
  mobileData
} from "../../../../../lib/mobile-api/response";

export async function GET(request: Request) {
  try {
    const context = await getMobileRequestContext(request);
    return mobileData(
      {
        assuranceLevel: context.assuranceLevel,
        email: context.email,
        tenants: context.tenants.map((tenant) => ({
          capabilities: tenant.capabilities,
          id: tenant.id,
          name: tenant.name,
          roleLabel: tenant.roleLabel,
          slug: tenant.slug,
          status: tenant.status
        })),
        userId: context.userId,
        userName: context.userName
      },
      context.requestId
    );
  } catch (error) {
    return mobileContextFailure(error);
  }
}
