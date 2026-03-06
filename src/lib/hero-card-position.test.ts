import { describe, expect, it } from "vitest";

import {
  heroCardPositionToCssObjectPosition,
  toHeroCardObjectPosition,
} from "@/lib/hero-card-position";

describe("hero card object-position mapping", () => {
  it("maps all presets to css object-position values", () => {
    expect(heroCardPositionToCssObjectPosition("top-left")).toBe("0% 0%");
    expect(heroCardPositionToCssObjectPosition("top-center")).toBe("50% 0%");
    expect(heroCardPositionToCssObjectPosition("top-right")).toBe("100% 0%");
    expect(heroCardPositionToCssObjectPosition("center-left")).toBe("0% 50%");
    expect(heroCardPositionToCssObjectPosition("center")).toBe("50% 50%");
    expect(heroCardPositionToCssObjectPosition("center-right")).toBe("100% 50%");
    expect(heroCardPositionToCssObjectPosition("bottom-left")).toBe("0% 100%");
    expect(heroCardPositionToCssObjectPosition("bottom-center")).toBe("50% 100%");
    expect(heroCardPositionToCssObjectPosition("bottom-right")).toBe("100% 100%");
  });

  it("normalizes invalid or missing values to center", () => {
    expect(toHeroCardObjectPosition(undefined)).toBe("center");
    expect(toHeroCardObjectPosition(null)).toBe("center");
    expect(toHeroCardObjectPosition("nope")).toBe("center");
  });
});
