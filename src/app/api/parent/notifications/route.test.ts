import { beforeEach, describe, expect, it, vi } from "vitest";

const isParentAuthenticatedMock = vi.hoisted(() => vi.fn());
const getNotificationsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  isParentAuthenticated: isParentAuthenticatedMock,
}));

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    getNotifications: getNotificationsMock,
  }),
}));

import { GET } from "./route";

describe("GET /api/parent/notifications", () => {
  beforeEach(() => {
    isParentAuthenticatedMock.mockReset();
    getNotificationsMock.mockReset();
  });

  it("returns 401 when parent is not authenticated", async () => {
    isParentAuthenticatedMock.mockResolvedValue(false);

    const response = await GET(
      new Request("http://localhost/api/parent/notifications?limit=20"),
    );
    expect(response.status).toBe(401);
    expect(getNotificationsMock).not.toHaveBeenCalled();
  });

  it("returns notifications when parent is authenticated", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    getNotificationsMock.mockResolvedValue([
      {
        id: "n1",
        profileId: "p1",
        eventType: "mission_complete",
        title: "Mission Complete",
        message: "Done",
        createdAt: "2026-03-06T10:00:00.000Z",
        readAt: null,
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/parent/notifications?limit=20"),
    );
    const payload = (await response.json()) as {
      ok: boolean;
      notifications: Array<{ id: string }>;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.notifications[0]?.id).toBe("n1");
    expect(getNotificationsMock).toHaveBeenCalledWith(20);
  });
});
