import { beforeEach, describe, expect, it, vi } from "vitest";

const getUnreadNotificationCountMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    getUnreadNotificationCount: getUnreadNotificationCountMock,
  }),
}));

import { GET } from "./route";

describe("GET /api/public/notification-count", () => {
  beforeEach(() => {
    getUnreadNotificationCountMock.mockReset();
  });

  it("returns unread notification count", async () => {
    getUnreadNotificationCountMock.mockResolvedValue(5);

    const response = await GET(
      new Request("http://localhost/api/public/notification-count"),
    );
    const payload = (await response.json()) as {
      ok: boolean;
      unreadCount: number;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.unreadCount).toBe(5);
  });
});
