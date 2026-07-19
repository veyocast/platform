import { createControlHealthResponse } from "../../../lib/runtime-health";

export function GET() {
  return createControlHealthResponse();
}
