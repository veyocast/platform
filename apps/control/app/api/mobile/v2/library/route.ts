import {mobileLibraryFilterV2Schema} from "@veyocast/contracts";
import {getMobileRequestContext,requireMobileTenant} from "../../../../../lib/mobile-api/context";
import {mobileFailure} from "../../../../../lib/mobile-api/response";
import {mobileV2Failure} from "../../../../../lib/mobile/v2-failure";
import {mobileV2Data} from "../../../../../lib/mobile/v2-response";
import {loadMobileLibraryV2} from "../../../../../lib/mobile/library-v2";
export async function GET(request:Request){try{const context=await getMobileRequestContext(request);const parsed=mobileLibraryFilterV2Schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!parsed.success)return mobileFailure({code:"VALIDATION",message:"De bibliotheekfilters zijn ongeldig.",recovery:"Open de bibliotheek opnieuw.",requestId:context.requestId,status:422});const {tab,offset,search}=parsed.data;const tenant=requireMobileTenant(request,context,tab==="media"?"tenant.media.read":tab==="studio"?"tenant.studio.read":"tenant.dynamic_slide.read");return mobileV2Data(await loadMobileLibraryV2(context,tenant,tab,offset,search),context.requestId);}catch(error){return mobileV2Failure(error);}}
