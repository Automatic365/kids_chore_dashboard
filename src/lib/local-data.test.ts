import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as LocalDataModule from "@/lib/local-data";

const memoryStorage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem(key: string) {
      return memoryStorage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      memoryStorage.set(key, value);
    },
    removeItem(key: string) {
      memoryStorage.delete(key);
    },
    clear() {
      memoryStorage.clear();
    },
  },
  configurable: true,
});
if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", {
    value: globalThis.localStorage,
    configurable: true,
  });
}

let localData: typeof LocalDataModule;

describe("local-data mission economy", () => {
  beforeEach(async () => {
    vi.resetModules();
    localData = await import("@/lib/local-data");
    await localData.resetLocalDataForTests();
  });

  it("allows claiming the same reward more than once with enough power", async () => {
    await localData.localLoginParent("1234");
    await localData.localUpdateReward("r1", { minDaysBetweenClaims: null });
    const mission = await localData.localCreateMission({
      profileId: "captain-alpha",
      title: "Power Boost",
      instructions: "Earn big power.",
      powerValue: 60,
      recurringDaily: true,
      isActive: true,
    });
    await localData.localLogoutParent();

    await localData.localCompleteMission({
      missionId: mission.id,
      profileId: "captain-alpha",
      clientRequestId: "ld-repeat-1",
      clientCompletedAt: new Date().toISOString(),
    });

    const first = await localData.localClaimReward({
      profileId: "captain-alpha",
      rewardId: "r1",
    });
    const second = await localData.localClaimReward({
      profileId: "captain-alpha",
      rewardId: "r1",
    });
    const claims = await localData.localGetRewardClaims("captain-alpha");

    expect(first.claimed).toBe(true);
    expect(second.claimed).toBe(true);
    expect(claims.length).toBe(2);
  });

});
