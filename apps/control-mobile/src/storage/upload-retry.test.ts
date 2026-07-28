import { describe, expect, it } from "vitest";

import { uploadFailureStatus } from "./upload-retry";

describe("mobile upload retry policy", () => {
  it("keeps network and server failures resumable", () => {
    expect(uploadFailureStatus(new TypeError("Network request failed"))).toBe(
      "pending"
    );
    expect(uploadFailureStatus({ status: 503 })).toBe("pending");
  });

  it("requires user intervention for definitive client failures", () => {
    expect(uploadFailureStatus({ status: 401 })).toBe("failed");
    expect(uploadFailureStatus({ status: 422 })).toBe("failed");
  });
});
