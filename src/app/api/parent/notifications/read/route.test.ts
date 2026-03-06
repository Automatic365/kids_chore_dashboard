import { beforeEach, describe, expect, it, vi } from "vitest";

const isParentAuthenticatedMock = vi.hoisted(() => vi.fn());
const markNotificationsReadMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  isParentAuthenticated: isParentAuthenticatedMock,
}));

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    markNotificationsRead: markNotificationsReadMock,
  }),
}));

import { POST } from "./route";

describe("POST /api/parent/notifications/read", () => {
  beforeEach(() => {
    isParentAuthenticatedMock.mockReset();
    markNotificationsReadMock.mockReset();
  });

  it("returns 401 when parent is not authenticated", async () => {
    isParentAuthenticatedMock.mockResolvedValue(false);
    const response = await POST(
      new Request("http://localhost/api/parent/notifications/read", { method: "POST" }),
    );
    expect(response.status).toBe(401);
    expect(markNotificationsReadMock).not.toHaveBeenCalled();
  });

  it("marks notifications as read for authenticated parent", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    markNotificationsReadMock.mockResolvedValue({ markedCount: 3 });

    const response = await POST(
      new Request("http://localhost/api/parent/notifications/read", { method: "POST" }),
    );
    const payload = (await response.json()) as {
      ok: boolean;
      result: { markedCount: number };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.result.markedCount).toBe(3);
  });
});
