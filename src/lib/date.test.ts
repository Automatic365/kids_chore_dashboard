import { describe, expect, it } from "vitest";

import { clamp, toLocalDateString } from "@/lib/date";

describe("date helpers", () => {
  it("formats a local date string", () => {
    const value = toLocalDateString(new Date("2026-03-04T12:00:00.000Z"), "UTC");
    expect(value).toBe("2026-03-04");
  });

  it("clamps values inside boundaries", () => {
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
  });
});
