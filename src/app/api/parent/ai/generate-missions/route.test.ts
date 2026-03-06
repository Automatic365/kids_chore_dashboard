import { beforeEach, describe, expect, it, vi } from "vitest";

const isParentAuthenticatedMock = vi.hoisted(() => vi.fn());
const verifyParentPinMock = vi.hoisted(() => vi.fn());
const generateMissionsFromTasksMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({
  isParentAuthenticated: isParentAuthenticatedMock,
}));

vi.mock("@/lib/server/repository", () => ({
  getRepository: () => ({
    verifyParentPin: verifyParentPinMock,
  }),
}));

vi.mock("@/lib/server/ai-missions", () => ({
  generateMissionsFromTasks: generateMissionsFromTasksMock,
}));

import { POST } from "./route";

describe("POST /api/parent/ai/generate-missions", () => {
  beforeEach(() => {
    isParentAuthenticatedMock.mockReset();
    verifyParentPinMock.mockReset();
    generateMissionsFromTasksMock.mockReset();
  });

  it("returns 400 for invalid payload", async () => {
    const request = new Request("http://localhost/api/parent/ai/generate-missions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tasks: [] }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid request");
    expect(generateMissionsFromTasksMock).not.toHaveBeenCalled();
  });

  it("returns 401 when parent is unauthenticated and no parent pin is provided", async () => {
    isParentAuthenticatedMock.mockResolvedValue(false);

    const request = new Request("http://localhost/api/parent/ai/generate-missions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tasks: ["Brush teeth"] }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
    expect(verifyParentPinMock).not.toHaveBeenCalled();
    expect(generateMissionsFromTasksMock).not.toHaveBeenCalled();
  });

  it("returns 401 when fallback parent pin is invalid", async () => {
    isParentAuthenticatedMock.mockResolvedValue(false);
    verifyParentPinMock.mockResolvedValue(false);

    const request = new Request("http://localhost/api/parent/ai/generate-missions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tasks: ["Brush teeth"], parentPin: "1234" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
    expect(verifyParentPinMock).toHaveBeenCalledWith("1234");
    expect(generateMissionsFromTasksMock).not.toHaveBeenCalled();
  });

  it("returns generated missions for authenticated parent session", async () => {
    isParentAuthenticatedMock.mockResolvedValue(true);
    generateMissionsFromTasksMock.mockResolvedValue([
      {
        title: "Operation Sparkle Smile",
        instructions: "Brush all your teeth for two minutes.",
        powerValue: 10,
      },
    ]);

    const request = new Request("http://localhost/api/parent/ai/generate-missions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tasks: ["Brush teeth"],
        profileName: "Captain Alpha",
        uiMode: "text",
        provider: "openai",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      missions: Array<{ title: string }>;
    };

    expect(response.status).toBe(200);
    expect(payload.missions).toHaveLength(1);
    expect(payload.missions[0]?.title).toBe("Operation Sparkle Smile");
    expect(generateMissionsFromTasksMock).toHaveBeenCalledWith({
      tasks: ["Brush teeth"],
      profileName: "Captain Alpha",
      uiMode: "text",
      provider: "openai",
    });
  });
});
