import { beforeEach, describe, expect, it, vi } from "vitest";

const resetDailyMock = vi.hoisted(() => vi.fn());
const toLocalDateStringMock = vi.hoisted(() => vi.fn(() => "2026-03-05"));

vi.mock("@/lib/env", () => ({
  env: {
    internalCronSecret: "test-secret",
    appTimeZone: "America/Chicago",
  },
}));

vi.mock("@/lib/date", () => ({
  toLocalDateString: toLocalDateStringMock,
}));

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    resetDaily: resetDailyMock,
  }),
}));

import { POST } from "./route";

describe("POST /api/internal/daily-reset", () => {
  beforeEach(() => {
    resetDailyMock.mockReset();
    toLocalDateStringMock.mockClear();
  });

  it("returns 401 for invalid internal secret", async () => {
    const request = new Request("http://localhost/api/internal/daily-reset", {
      method: "POST",
      headers: {
        "x-internal-secret": "wrong-secret",
        "x-request-id": "req-auth-fail",
      },
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      requestId: string;
      error: { code: string; message: string };
    };

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.requestId).toBe("req-auth-fail");
    expect(payload.error.code).toBe("UNAUTHORIZED");
    expect(resetDailyMock).not.toHaveBeenCalled();
  });

  it("resets cycle date when authorized", async () => {
    resetDailyMock.mockResolvedValue({
      squadPowerCurrent: 0,
      squadPowerMax: 100,
      cycleDate: "2026-03-05",
      squadGoal: null,
    });

    const request = new Request("http://localhost/api/internal/daily-reset", {
      method: "POST",
      headers: {
        "x-internal-secret": "test-secret",
        "x-request-id": "req-reset-ok",
      },
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      requestId: string;
      cycleDate: string;
      squad: { cycleDate: string };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.requestId).toBe("req-reset-ok");
    expect(payload.cycleDate).toBe("2026-03-05");
    expect(payload.squad.cycleDate).toBe("2026-03-05");
    expect(resetDailyMock).toHaveBeenCalledWith("2026-03-05");
  });

  it("returns 500 with request id on reset failure", async () => {
    resetDailyMock.mockRejectedValue(new Error("db unavailable"));

    const request = new Request("http://localhost/api/internal/daily-reset", {
      method: "POST",
      headers: {
        "x-internal-secret": "test-secret",
        "x-request-id": "req-reset-fail",
      },
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      requestId: string;
      error: { code: string; message: string };
    };

    expect(response.status).toBe(500);
    expect(payload.ok).toBe(false);
    expect(payload.requestId).toBe("req-reset-fail");
    expect(payload.error.code).toBe("RESET_FAILED");
    expect(payload.error.message).toContain("db unavailable");
  });
});
