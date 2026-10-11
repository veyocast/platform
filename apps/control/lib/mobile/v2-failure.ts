import "server-only";
import {MobileApiContextError} from "../mobile-api/context";
import {mobileContextFailure,mobileFailure} from "../mobile-api/response";
/** Provider/database messages and authoring content are never sent or logged as an error. */
export function mobileV2Failure(error:unknown){if(error instanceof MobileApiContextError)return mobileContextFailure(error);return mobileFailure({code:"TEMPORARILY_UNAVAILABLE",message:"De server heeft deze mobiele actie niet veilig bevestigd.",recovery:"Je lokale concept blijft behouden. Controleer de serverstatus en probeer dezelfde handeling opnieuw.",requestId:crypto.randomUUID(),status:503});}
