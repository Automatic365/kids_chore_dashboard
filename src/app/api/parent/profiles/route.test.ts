import { beforeEach, describe, expect, it, vi } from "vitest";

const isParentAuthenticatedMock = vi.hoisted(() => vi.fn());
const createProfileMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  isParentAuthenticated: isParentAuthenticatedMock,
}));

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    createProfile: createProfileMock,
  }),
}));

import { POST } from "./route";

describe("POST /api/parent/profiles", () => {
  beforeEach(() => {
    isParentAuthenticatedMock.mockReset();
    createProfileMock.mockReset();
  });

  it("returns 401 when parent is not authenticated", async () => {
    isParentAuthenticatedMock.mockResolvedValue(false);

    const request = new Request("http://localhost/api/parent/profiles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("UNAUTHORIZED");
    expect(createProfileMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid payload", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);

    const request = new Request("http://localhost/api/parent/profiles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ heroName: "A" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("INVALID_REQUEST");
  });

  it("passes hero card focal point through on valid payload", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    createProfileMock.mockResolvedValue({
      id: "p1",
      heroName: "Captain Focus",
      avatarUrl: "/avatars/captain.svg",
      uiMode: "text",
      heroCardObjectPosition: "top-right",
      powerLevel: 0,
      currentStreak: 0,
      lastStreakDate: null,
    });

    const request = new Request("http://localhost/api/parent/profiles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        heroName: "Captain Focus",
        avatarUrl: "/avatars/captain.svg",
        uiMode: "text",
        heroCardObjectPosition: "top-right",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      profile: { heroCardObjectPosition: string };
    };

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.profile.heroCardObjectPosition).toBe("top-right");
    expect(createProfileMock).toHaveBeenCalledWith({
      heroName: "Captain Focus",
      avatarUrl: "/avatars/captain.svg",
      uiMode: "text",
      heroCardObjectPosition: "top-right",
    });
  });
});
