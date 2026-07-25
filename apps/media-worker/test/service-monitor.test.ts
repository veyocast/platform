import { describe, expect, it } from "vitest";

import { nextMonitorState } from "../src/service-monitor";

describe("service monitor state", () => {
  it("fires once after three consecutive failed probes", () => {
    let state = {};
    expect(nextMonitorState(state, "control", false).notification).toBeNull();
    state = nextMonitorState(state, "control", false).state;
    state = nextMonitorState(state, "control", false).state;
    const firing = nextMonitorState(state, "control", false);
    expect(firing.notification).toBe("firing");
    expect(nextMonitorState(firing.state, "control", false).notification).toBeNull();
  });

  it("sends one recovery transition after a healthy probe", () => {
    const firing = { control: { failures: 3, firing: true } };
    const recovery = nextMonitorState(firing, "control", true);
    expect(recovery.notification).toBe("recovered");
    expect(recovery.state.control).toEqual({ failures: 0, firing: false });
  });
});
