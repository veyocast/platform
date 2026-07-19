import { createPlayerHealthResponse } from "../_lib/runtime-health";

export function GET() {
  return createPlayerHealthResponse();
}
