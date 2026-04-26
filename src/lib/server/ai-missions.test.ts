import { describe, expect, it, vi } from "vitest";

import { generateMissionsFromTasks } from "@/lib/server/ai-missions";

describe("generateMissionsFromTasks", () => {
  it("falls back to superhero-themed titles and instructions", async () => {
    const missions = await generateMissionsFromTasks({
      tasks: ["empty the dishwasher"],
      provider: "openai",
    });

    expect(missions).toHaveLength(1);
    expect(missions[0]?.title.toLowerCase()).not.toBe("empty the dishwasher");
    expect(missions[0]?.title).toMatch(/^(Operation|Mission|Power Patrol|Hero Alert|Squad Signal|Mega Rescue):/);
    expect(missions[0]?.instructions.toLowerCase()).toContain("mission command");
  });

  it("rewrites literal ai output into a themed mission", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          missions: [
            {
              title: "Empty the Dishwasher",
              instructions: "Empty the dishwasher",
              powerValue: 10,
              recurringDaily: true,
            },
          ],
        }),
      }),
    });

    const originalFetch = global.fetch;
    const originalKey = process.env.OPENAI_API_KEY;
    const originalModel = process.env.OPENAI_MODEL;
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "gpt-4o-mini";
    global.fetch = fetchMock as typeof fetch;

    try {
      const missions = await generateMissionsFromTasks({
        tasks: ["empty the dishwasher"],
        provider: "openai",
      });

      expect(missions[0]?.title).not.toBe("Empty the Dishwasher");
      expect(missions[0]?.instructions).not.toBe("Empty the dishwasher");
      expect(missions[0]?.instructions.toLowerCase()).toContain("mission command");
    } finally {
      global.fetch = originalFetch;
      process.env.OPENAI_API_KEY = originalKey;
      process.env.OPENAI_MODEL = originalModel;
    }
  });
});
