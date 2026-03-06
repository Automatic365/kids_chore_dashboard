import { describe, expect, it, vi } from "vitest";

const reportErrorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/monitoring", () => ({
  reportError: reportErrorMock,
}));

import { POST } from "./route";

describe("POST /api/internal/csp-report", () => {
  it("accepts report payload and returns 204", async () => {
    const request = new Request("http://localhost/api/internal/csp-report", {
      method: "POST",
      headers: {
        "content-type": "application/csp-report",
      },
      body: JSON.stringify({
        "csp-report": {
          "blocked-uri": "http://evil.local",
          "violated-directive": "script-src",
        },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(204);
    expect(reportErrorMock).toHaveBeenCalledTimes(1);
  });
});
