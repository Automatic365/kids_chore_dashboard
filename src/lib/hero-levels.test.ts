import { describe, expect, it } from "vitest";

import { getHeroLevel, getHeroLevelProgress } from "@/lib/hero-levels";

describe("hero-levels", () => {
  it("maps the named rank thresholds correctly", () => {
    expect(getHeroLevel(0).name).toBe("Recruit");
    expect(getHeroLevel(75).name).toBe("Sidekick");
    expect(getHeroLevel(180).name).toBe("Hero");
    expect(getHeroLevel(340).name).toBe("Super Hero");
    expect(getHeroLevel(575).name).toBe("Champion");
    expect(getHeroLevel(900).name).toBe("Mega Champion");
    expect(getHeroLevel(1325).name).toBe("Legend");
    expect(getHeroLevel(1775).name).toBe("Master Legend");
    expect(getHeroLevel(2200).name).toBe("Superhero Elite");
    expect(getHeroLevel(2500).name).toBe("Legendary Superhero");
  });

  it("adds prestige stars every 1250 xp after the top rank threshold", () => {
    expect(getHeroLevel(2500)).toMatchObject({
      name: "Legendary Superhero",
      prestigeStars: 0,
      displayName: "Legendary Superhero",
      nextPower: 3750,
    });
    expect(getHeroLevel(3750)).toMatchObject({
      prestigeStars: 1,
      displayName: "Legendary Superhero ★",
      nextPower: 5000,
    });
    expect(getHeroLevel(5000)).toMatchObject({
      prestigeStars: 2,
      displayName: "Legendary Superhero ★★",
      nextPower: 6250,
    });
  });

  it("uses the top-rank prestige span for post-max progress", () => {
    expect(getHeroLevelProgress(2499)).toMatchObject({
      currentMinPower: 2200,
      nextPower: 2500,
    });
    expect(getHeroLevelProgress(2500)).toMatchObject({
      currentMinPower: 2500,
      nextPower: 3750,
      progressPercent: 0,
    });
    expect(getHeroLevelProgress(3125)).toMatchObject({
      currentMinPower: 2500,
      nextPower: 3750,
      progressPercent: 50,
    });
    expect(getHeroLevelProgress(3750)).toMatchObject({
      currentMinPower: 3750,
      nextPower: 5000,
      progressPercent: 0,
    });
  });
});
