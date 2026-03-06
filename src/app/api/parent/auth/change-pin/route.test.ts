import { beforeEach, describe, expect, it, vi } from "vitest";

const isParentAuthenticatedMock = vi.hoisted(() => vi.fn());
const changeParentPinMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  isParentAuthenticated: isParentAuthenticatedMock,
}));

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    changeParentPin: changeParentPinMock,
  }),
}));

import { POST } from "./route";

describe("POST /api/parent/auth/change-pin", () => {
  beforeEach(() => {
    isParentAuthenticatedMock.mockReset();
    changeParentPinMock.mockReset();
  });

  it("returns 401 when parent is not authenticated", async () => {
    isParentAuthenticatedMock.mockResolvedValue(false);

    const request = new Request("http://localhost/api/parent/auth/change-pin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newPin: "5678" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
    expect(changeParentPinMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid pin payload", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);

    const request = new Request("http://localhost/api/parent/auth/change-pin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newPin: "12ab" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error: string; details: unknown };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid PIN");
    expect(payload.details).toBeDefined();
    expect(changeParentPinMock).not.toHaveBeenCalled();
  });

  it("returns 500 when repository throws", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    changeParentPinMock.mockRejectedValue(new Error("pin update failed"));

    const request = new Request("http://localhost/api/parent/auth/change-pin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newPin: "5678" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(payload.error).toContain("pin update failed");
  });

  it("returns 200 for valid pin change", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    changeParentPinMock.mockResolvedValue(undefined);

    const request = new Request("http://localhost/api/parent/auth/change-pin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newPin: "5678" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(changeParentPinMock).toHaveBeenCalledWith("5678");
  });
});
