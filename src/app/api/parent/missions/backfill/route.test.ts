import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const isParentAuthenticatedMock = vi.hoisted(() => vi.fn());
const getMissionBackfillsMock = vi.hoisted(() => vi.fn());
const createMissionBackfillMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  isParentAuthenticated: isParentAuthenticatedMock,
}));

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    getMissionBackfills: getMissionBackfillsMock,
    createMissionBackfill: createMissionBackfillMock,
  }),
}));

import { GET, POST } from "./route";

describe("/api/parent/missions/backfill", () => {
  beforeEach(() => {
    isParentAuthenticatedMock.mockReset();
    getMissionBackfillsMock.mockReset();
    createMissionBackfillMock.mockReset();
  });

  it("GET returns 401 when parent is not authenticated", async () => {
    isParentAuthenticatedMock.mockResolvedValue(false);
    const request = new NextRequest(
      "http://localhost/api/parent/missions/backfill?profileId=captain-alpha",
    );

    const response = await GET(request);
    const payload = (await response.json()) as { ok: boolean; error: { code: string } };

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("UNAUTHORIZED");
    expect(getMissionBackfillsMock).not.toHaveBeenCalled();
  });

  it("GET returns 400 when profileId is missing", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    const request = new NextRequest("http://localhost/api/parent/missions/backfill");

    const response = await GET(request);
    const payload = (await response.json()) as { ok: boolean; error: { code: string } };

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("INVALID_REQUEST");
    expect(getMissionBackfillsMock).not.toHaveBeenCalled();
  });

  it("GET returns backfill entries", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    getMissionBackfillsMock.mockResolvedValue([
      {
        id: "bf1",
        profileId: "captain-alpha",
        missionId: "m1",
        missionTitle: "Operation: Brush Teeth",
        localDate: "2026-03-20",
        pointsAwarded: 10,
        createdAt: "2026-03-21T01:00:00.000Z",
      },
    ]);
    const request = new NextRequest(
      "http://localhost/api/parent/missions/backfill?profileId=captain-alpha",
    );

    const response = await GET(request);
    const payload = (await response.json()) as {
      ok: boolean;
      backfills: Array<{ id: string }>;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.backfills).toHaveLength(1);
    expect(getMissionBackfillsMock).toHaveBeenCalledWith("captain-alpha");
  });

  it("POST returns 400 for invalid payload", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    const request = new Request("http://localhost/api/parent/missions/backfill", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId: "captain-alpha", missionId: "m1" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { ok: boolean; error: { code: string } };

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("INVALID_REQUEST");
    expect(createMissionBackfillMock).not.toHaveBeenCalled();
  });

  it("POST creates a mission backfill", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    createMissionBackfillMock.mockResolvedValue({
      entry: {
        id: "bf1",
        profileId: "captain-alpha",
        missionId: "m1",
        missionTitle: "Operation: Brush Teeth",
        localDate: "2026-03-20",
        pointsAwarded: 10,
        createdAt: "2026-03-21T01:00:00.000Z",
      },
      profileRewardPoints: 50,
      profileXpPoints: 120,
      profilePowerLevel: 120,
      squadPowerCurrent: 95,
      squadPowerMax: 1000,
    });

    const request = new Request("http://localhost/api/parent/missions/backfill", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        profileId: "captain-alpha",
        missionId: "m1",
        localDate: "2026-03-20",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      result: { entry: { id: string } };
    };

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.result.entry.id).toBe("bf1");
    expect(createMissionBackfillMock).toHaveBeenCalledWith({
      profileId: "captain-alpha",
      missionId: "m1",
      localDate: "2026-03-20",
    });
  });
});
