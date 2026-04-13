import { describe, expect, it } from "vitest";

import { buildDashboardStatus } from "./dashboardSummary";

describe("buildDashboardStatus", () => {
  it("returns missing tone when DB is not configured", () => {
    const status = buildDashboardStatus({
      hasDb: false,
      dbError: null,
      totalEvents: 0,
    });
    expect(status.tone).toBe("missing");
    expect(status.message).toContain("DATABASE_URL");
  });

  it("returns error tone when query fails", () => {
    const status = buildDashboardStatus({
      hasDb: true,
      dbError: "relation pipeline_events does not exist",
      totalEvents: 0,
    });
    expect(status.tone).toBe("error");
    expect(status.message).toContain("pipeline_events");
  });

  it("returns ok tone with total events", () => {
    const status = buildDashboardStatus({
      hasDb: true,
      dbError: null,
      totalEvents: 42,
    });
    expect(status.tone).toBe("ok");
    expect(status.message).toContain("42");
  });
});
