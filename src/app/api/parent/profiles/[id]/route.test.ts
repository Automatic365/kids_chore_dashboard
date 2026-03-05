import { beforeEach, describe, expect, it, vi } from "vitest";

const isParentAuthenticatedMock = vi.hoisted(() => vi.fn());
const updateProfileMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  isParentAuthenticated: isParentAuthenticatedMock,
}));

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    updateProfile: updateProfileMock,
    deleteProfile: vi.fn(),
  }),
}));

import { PATCH } from "./route";

describe("PATCH /api/parent/profiles/[id]", () => {
  beforeEach(() => {
    isParentAuthenticatedMock.mockReset();
    updateProfileMock.mockReset();
  });

  it("returns 401 when parent is not authenticated", async () => {
    isParentAuthenticatedMock.mockResolvedValue(false);

    const request = new Request("http://localhost/api/parent/profiles/p1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ heroName: "Captain Nova" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "p1" }) });
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("UNAUTHORIZED");
  });
});
