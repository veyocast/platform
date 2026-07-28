import "server-only";

import {
  createSafeActionError,
  mobileApiVersion,
  type SafeActionErrorCode
} from "@veyocast/contracts";
import { NextResponse } from "next/server";

import { MobileApiContextError } from "./context";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization, X-VeyoCast-Tenant-Id"
} as const;

export function mobileData<T>(data: T, requestId: string, status = 200) {
  return NextResponse.json(
    {
      data,
      meta: { requestId, version: mobileApiVersion }
    },
    { headers: noStoreHeaders, status }
  );
}

export function mobileFailure(
  input: Readonly<{
    code: SafeActionErrorCode;
    message: string;
    recovery: string;
    requestId: string;
    status: number;
  }>
) {
  return NextResponse.json(
    {
      error: createSafeActionError({
        code: input.code,
        message: input.message,
        recovery: input.recovery,
        requestId: input.requestId
      }),
      meta: { requestId: input.requestId, version: mobileApiVersion }
    },
    { headers: noStoreHeaders, status: input.status }
  );
}

export function mobileContextFailure(error: unknown) {
  if (error instanceof MobileApiContextError) {
    return mobileFailure({
      code: error.code,
      message: error.message,
      recovery: error.recovery,
      requestId: error.requestId,
      status: error.status
    });
  }
  const requestId = crypto.randomUUID();
  console.error("Mobile API request failed", { error, requestId });
  return mobileFailure({
    code: "INTERNAL",
    message: "Deze mobiele actie kon niet veilig worden uitgevoerd.",
    recovery: "Probeer het opnieuw. Blijft dit gebeuren, deel dan de aanvraagcode met support.",
    requestId,
    status: 500
  });
}
