import type { matchdayCommandReceiptSchema } from "@veyocast/contracts";

export type MatchdayFailure = {ok:false;code:string;message:string;recovery:string};
export type MatchdayReceipt = ReturnType<typeof matchdayCommandReceiptSchema.parse>;
export type MatchdayCommandResult = {ok:true;receipt:MatchdayReceipt}|MatchdayFailure;
