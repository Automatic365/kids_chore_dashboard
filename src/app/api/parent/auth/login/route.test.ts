import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyParentPinMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    verifyParentPin: verifyParentPinMock,
  }),
}));

import { POST } from "./route";

describe("POST /api/parent/auth/login", () => {
  beforeEach(() => {
    verifyParentPinMock.mockReset();
  });

  it("returns 400 for invalid pin format", async () => {
    const request = new Request("http://localhost/api/parent/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin: "12ab" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid PIN format");
    expect(verifyParentPinMock).not.toHaveBeenCalled();
  });

  it("returns 401 for invalid pin", async () => {
    verifyParentPinMock.mockResolvedValue(false);

    const request = new Request("http://localhost/api/parent/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin: "1234" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Invalid PIN");
    expect(verifyParentPinMock).toHaveBeenCalledWith("1234");
  });

  it("returns 200 and sets a session cookie for valid pin", async () => {
    verifyParentPinMock.mockResolvedValue(true);

    const request = new Request("http://localhost/api/parent/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin: "1234" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { ok: boolean };
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(setCookie).toContain("herohabits_parent_session=");
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(verifyParentPinMock).toHaveBeenCalledWith("1234");
  });
});
