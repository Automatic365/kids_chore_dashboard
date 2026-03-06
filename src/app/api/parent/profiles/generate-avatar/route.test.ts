import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const isParentAuthenticatedMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  isParentAuthenticated: isParentAuthenticatedMock,
}));

import { POST } from "./route";

describe("POST /api/parent/profiles/generate-avatar", () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    isParentAuthenticatedMock.mockReset();
    delete process.env.OPENAI_API_KEY;
  });

  afterAll(() => {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  });

  it("returns 401 when parent is not authenticated", async () => {
    isParentAuthenticatedMock.mockResolvedValue(false);

    const request = new Request("http://localhost/api/parent/profiles/generate-avatar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ heroName: "Captain Alpha" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid payload", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);

    const request = new Request("http://localhost/api/parent/profiles/generate-avatar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ heroName: "A" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error: string; details: unknown };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid payload");
    expect(payload.details).toBeDefined();
  });

  it("returns deterministic emoji fallback when OpenAI key is unavailable", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);

    const request = new Request("http://localhost/api/parent/profiles/generate-avatar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ heroName: "Alpha" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { avatarDataUrl: string };

    expect(response.status).toBe(200);
    expect(payload.avatarDataUrl).toBe("🔥");
  });
});
