import { describe, expect, it } from "vitest";

import { getLocalStore, resetLocalStoreForTests } from "@/lib/server/local-store";

describe("local store completion rules", () => {
  it("awards points once per mission per cycle", () => {
    resetLocalStoreForTests();
    const store = getLocalStore();

    const first = store.completeMission({
      missionId: "m1",
      profileId: "captain-alpha",
      clientRequestId: "req-1",
      clientCompletedAt: new Date().toISOString(),
    });

    const second = store.completeMission({
      missionId: "m1",
      profileId: "captain-alpha",
      clientRequestId: "req-2",
      clientCompletedAt: new Date().toISOString(),
    });

    expect(first.awarded).toBe(true);
    expect(second.alreadyCompleted).toBe(true);
  });

  it("allows completion after daily reset cycle changes", () => {
    resetLocalStoreForTests();
    const store = getLocalStore();

    store.completeMission({
      missionId: "m1",
      profileId: "captain-alpha",
      clientRequestId: "req-3",
      clientCompletedAt: new Date().toISOString(),
    });

    store.resetDaily("2099-01-01");

    const result = store.completeMission({
      missionId: "m1",
      profileId: "captain-alpha",
      clientRequestId: "req-4",
      clientCompletedAt: new Date().toISOString(),
    });

    expect(result.awarded).toBe(true);
  });

  it("undoes a completed mission and reverses awarded points", () => {
    resetLocalStoreForTests();
    const store = getLocalStore();

    const completion = store.completeMission({
      missionId: "m1",
      profileId: "captain-alpha",
      clientRequestId: "req-undo-1",
      clientCompletedAt: new Date().toISOString(),
    });

    const undo = store.uncompleteMission({
      missionId: "m1",
      profileId: "captain-alpha",
    });

    expect(completion.awarded).toBe(true);
    expect(undo.undone).toBe(true);
    expect(undo.profilePowerLevel).toBe(0);
  });

  it("deletes a mission and removes it from parent/kid mission lists", () => {
    resetLocalStoreForTests();
    const store = getLocalStore();

    store.deleteMission("m1");

    const missionIds = store.getMissions().map((mission) => mission.id);
    expect(missionIds).not.toContain("m1");
  });

  it("restores a deleted mission back to mission lists", () => {
    resetLocalStoreForTests();
    const store = getLocalStore();

    store.deleteMission("m1");
    store.restoreMission("m1");

    const missionIds = store.getMissions().map((mission) => mission.id);
    expect(missionIds).toContain("m1");
  });
});
