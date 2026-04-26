import { describe, expect, it } from "vitest";

import {
  buildStickerPrompt,
  generateRewardStickerDataUrl,
  isStickerReward,
  selectStickerConcept,
} from "@/lib/reward-art";

describe("reward art helpers", () => {
  it("detects sticker rewards by title", () => {
    expect(
      isStickerReward({
        rewardTitle: "In-App Sticker",
        rewardDescription: "Unlock a trophy-case sticker.",
      }),
    ).toBe(true);
  });

  it("does not classify non-sticker rewards as stickers", () => {
    expect(
      isStickerReward({
        rewardTitle: "Extra Snack",
        rewardDescription: "Pick one snack.",
      }),
    ).toBe(false);
  });

  it("does not repeat sticker concepts for a hero until the pool is exhausted", () => {
    const first = selectStickerConcept({
      heroName: "Captain Comet",
      claimedAt: "2026-03-11T10:00:00.000Z",
      existingStickerConceptIds: [],
    });
    const second = selectStickerConcept({
      heroName: "Captain Comet",
      claimedAt: "2026-03-11T10:05:00.000Z",
      existingStickerConceptIds: [first.stickerConceptId],
    });

    expect(second.stickerConceptId).not.toBe(first.stickerConceptId);
  });

  it("can produce both vehicle and companion selections", () => {
    const types = new Set(
      Array.from({ length: 20 }, (_, index) =>
        selectStickerConcept({
          heroName: "Super Tot",
          claimedAt: `2026-03-11T10:${String(index).padStart(2, "0")}:00.000Z`,
          existingStickerConceptIds: [],
        }).stickerType,
      ),
    );

    expect(types.has("vehicle")).toBe(true);
    expect(types.has("companion")).toBe(true);
  });

  it("builds vehicle and companion themed fallback svg art", () => {
    const vehicle = generateRewardStickerDataUrl({
      rewardTitle: "In-App Sticker",
      heroName: "Captain Comet",
      claimedAt: "2026-03-11T12:00:00.000Z",
      stickerType: "vehicle",
      stickerConceptId: "jet",
      stickerPromptSeed: "cosmic:vehicle:jet",
    });
    const companion = generateRewardStickerDataUrl({
      rewardTitle: "In-App Sticker",
      heroName: "Captain Comet",
      claimedAt: "2026-03-11T12:00:00.000Z",
      stickerType: "companion",
      stickerConceptId: "robo-pup",
      stickerPromptSeed: "cosmic:companion:robo-pup",
    });

    expect(decodeURIComponent(vehicle)).toContain("CAPTAIN COMET");
    expect(vehicle).not.toBe(companion);
  });

  it("gives different concepts noticeably different svg layouts", () => {
    const shieldBear = generateRewardStickerDataUrl({
      rewardTitle: "In-App Sticker",
      heroName: "The Wonderboy",
      claimedAt: "2026-03-12T12:00:00.000Z",
      stickerType: "companion",
      stickerConceptId: "shield-bear",
      stickerPromptSeed: "cosmic:companion:shield-bear",
    });
    const roboPup = generateRewardStickerDataUrl({
      rewardTitle: "In-App Sticker",
      heroName: "The Wonderboy",
      claimedAt: "2026-03-12T12:00:00.000Z",
      stickerType: "companion",
      stickerConceptId: "robo-pup",
      stickerPromptSeed: "cosmic:companion:robo-pup",
    });

    expect(shieldBear).not.toBe(roboPup);
    expect(decodeURIComponent(shieldBear)).toContain("M48 62L78 78");
    expect(decodeURIComponent(roboPup)).toContain("circle cx=\"52\" cy=\"74\"");
  });

  it("builds a sticker prompt that calls for a vehicle or sidekick", () => {
    const prompt = buildStickerPrompt({
      rewardTitle: "In-App Sticker",
      rewardDescription: "Unlock a new trophy sticker.",
      heroName: "Captain Comet",
      selection: {
        stickerType: "companion",
        stickerConceptId: "astro-owl",
        stickerPromptSeed: "cosmic:companion:astro-owl",
      },
    });

    expect(prompt).toContain("sidekick hero companion");
    expect(prompt).toContain("Captain Comet");
    expect(prompt).toContain("astro owl");
  });
});
