import { createMarketingHealthResponse } from "../../_lib/runtime-health";

export function GET() {
  return createMarketingHealthResponse();
}
