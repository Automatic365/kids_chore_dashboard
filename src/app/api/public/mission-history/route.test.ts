import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getMissionHistoryMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    getMissionHistory: getMissionHistoryMock,
  }),
}));

import { GET } from "./route";

describe("GET /api/public/mission-history", () => {
  beforeEach(() => {
    getMissionHistoryMock.mockReset();
  });

  it("returns 400 when profileId is missing", async () => {
    const request = new NextRequest("http://localhost/api/public/mission-history");

    const response = await GET(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("profileId is required");
    expect(getMissionHistoryMock).not.toHaveBeenCalled();
  });

  it("clamps days query to 30 max and returns history", async () => {
    getMissionHistoryMock.mockResolvedValue([
      {
        date: "2026-03-06",
        missions: [{ title: "Operation: Brush Teeth", powerAwarded: 10 }],
      },
    ]);

    const request = new NextRequest(
      "http://localhost/api/public/mission-history?profileId=captain-alpha&days=100",
    );
    const response = await GET(request);
    const payload = (await response.json()) as {
      history: Array<{ date: string; missions: Array<{ title: string }> }>;
    };

    expect(response.status).toBe(200);
    expect(payload.history).toHaveLength(1);
    expect(payload.history[0]?.date).toBe("2026-03-06");
    expect(getMissionHistoryMock).toHaveBeenCalledWith("captain-alpha", 30);
  });

  it("uses default 7 days when days is not numeric", async () => {
    getMissionHistoryMock.mockResolvedValue([]);

    const request = new NextRequest(
      "http://localhost/api/public/mission-history?profileId=captain-alpha&days=abc",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(getMissionHistoryMock).toHaveBeenCalledWith("captain-alpha", 7);
  });
});
