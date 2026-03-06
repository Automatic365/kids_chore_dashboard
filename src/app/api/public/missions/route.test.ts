import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getMissionsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    getMissions: getMissionsMock,
  }),
}));

import { GET } from "./route";

describe("GET /api/public/missions", () => {
  beforeEach(() => {
    getMissionsMock.mockReset();
  });

  it("passes profileId query to repository", async () => {
    getMissionsMock.mockResolvedValue([
      {
        id: "m1",
        profileId: "captain-alpha",
        title: "Operation: Brush Teeth",
      },
    ]);

    const request = new NextRequest(
      "http://localhost/api/public/missions?profileId=captain-alpha",
    );
    const response = await GET(request);
    const payload = (await response.json()) as { missions: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(payload.missions).toHaveLength(1);
    expect(payload.missions[0]?.id).toBe("m1");
    expect(getMissionsMock).toHaveBeenCalledWith("captain-alpha");
  });

  it("passes undefined profileId when query is absent", async () => {
    getMissionsMock.mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/public/missions");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(getMissionsMock).toHaveBeenCalledWith(undefined);
  });
});
