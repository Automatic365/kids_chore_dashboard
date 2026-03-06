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

  it("blocks undo when mission points have already been spent on rewards", () => {
    resetLocalStoreForTests();
    const store = getLocalStore();

    store.completeMission({
      missionId: "m1",
      profileId: "captain-alpha",
      clientRequestId: "req-lock-1",
      clientCompletedAt: new Date().toISOString(),
    });
    store.completeMission({
      missionId: "m2",
      profileId: "captain-alpha",
      clientRequestId: "req-lock-2",
      clientCompletedAt: new Date().toISOString(),
    });
    store.completeMission({
      missionId: "m3",
      profileId: "captain-alpha",
      clientRequestId: "req-lock-3",
      clientCompletedAt: new Date().toISOString(),
    });

    const claim = store.claimReward({
      profileId: "captain-alpha",
      rewardId: "r1",
    });
    expect(claim.claimed).toBe(true);
    expect(claim.newPowerLevel).toBe(5);

    const undo = store.uncompleteMission({
      missionId: "m2",
      profileId: "captain-alpha",
    });

    expect(undo.undone).toBe(false);
    expect(undo.wasCompleted).toBe(true);
    expect(undo.insufficientUnspentPoints).toBe(true);
    expect(undo.pointsRequiredToUndo).toBe(12);
    expect(undo.profilePowerLevel).toBe(5);
  });

  it("allows parent force undo even when unspent points are insufficient", () => {
    resetLocalStoreForTests();
    const store = getLocalStore();

    store.completeMission({
      missionId: "m1",
      profileId: "captain-alpha",
      clientRequestId: "req-force-1",
      clientCompletedAt: new Date().toISOString(),
    });
    store.completeMission({
      missionId: "m2",
      profileId: "captain-alpha",
      clientRequestId: "req-force-2",
      clientCompletedAt: new Date().toISOString(),
    });
    store.completeMission({
      missionId: "m3",
      profileId: "captain-alpha",
      clientRequestId: "req-force-3",
      clientCompletedAt: new Date().toISOString(),
    });
    store.claimReward({
      profileId: "captain-alpha",
      rewardId: "r1",
    });

    const undo = store.uncompleteMission({
      missionId: "m2",
      profileId: "captain-alpha",
      force: true,
    });

    expect(undo.undone).toBe(true);
    expect(undo.wasCompleted).toBe(true);
    expect(undo.profilePowerLevel).toBe(0);
  });

  it("allows undo after giving back a claimed reward", () => {
    resetLocalStoreForTests();
    const store = getLocalStore();

    store.completeMission({
      missionId: "m1",
      profileId: "captain-alpha",
      clientRequestId: "req-return-1",
      clientCompletedAt: new Date().toISOString(),
    });
    store.completeMission({
      missionId: "m2",
      profileId: "captain-alpha",
      clientRequestId: "req-return-2",
      clientCompletedAt: new Date().toISOString(),
    });
    store.completeMission({
      missionId: "m3",
      profileId: "captain-alpha",
      clientRequestId: "req-return-3",
      clientCompletedAt: new Date().toISOString(),
    });

    const claim = store.claimReward({
      profileId: "captain-alpha",
      rewardId: "r1",
    });
    expect(claim.claimed).toBe(true);
    expect(claim.newPowerLevel).toBe(5);

    const claims = store.getRewardClaims("captain-alpha");
    const returned = store.returnReward({
      profileId: "captain-alpha",
      rewardClaimId: claims[0]!.id,
    });
    expect(returned.returned).toBe(true);
    expect(returned.newPowerLevel).toBe(30);

    const undo = store.uncompleteMission({
      missionId: "m2",
      profileId: "captain-alpha",
    });
    expect(undo.undone).toBe(true);
    expect(undo.profilePowerLevel).toBe(18);
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

  it("increments streak only on first completion per day", () => {
    resetLocalStoreForTests();
    const store = getLocalStore();

    store.resetDaily("2099-01-01");
    store.completeMission({
      missionId: "m1",
      profileId: "captain-alpha",
      clientRequestId: "req-streak-1",
      clientCompletedAt: new Date().toISOString(),
    });
    store.completeMission({
      missionId: "m2",
      profileId: "captain-alpha",
      clientRequestId: "req-streak-2",
      clientCompletedAt: new Date().toISOString(),
    });

    let profile = store.getProfiles().find((item) => item.id === "captain-alpha");
    expect(profile?.currentStreak).toBe(1);

    store.resetDaily("2099-01-02");
    store.completeMission({
      missionId: "m1",
      profileId: "captain-alpha",
      clientRequestId: "req-streak-3",
      clientCompletedAt: new Date().toISOString(),
    });

    profile = store.getProfiles().find((item) => item.id === "captain-alpha");
    expect(profile?.currentStreak).toBe(2);
    expect(profile?.lastStreakDate).toBe("2099-01-02");
  });

  it("claims rewards only when profile has enough power", () => {
    resetLocalStoreForTests();
    const store = getLocalStore();

    const fail = store.claimReward({
      profileId: "captain-alpha",
      rewardId: "r1",
    });
    expect(fail.claimed).toBe(false);
    expect(fail.insufficientPoints).toBe(true);

    store.completeMission({
      missionId: "m1",
      profileId: "captain-alpha",
      clientRequestId: "req-reward-1",
      clientCompletedAt: new Date().toISOString(),
    });
    store.completeMission({
      missionId: "m2",
      profileId: "captain-alpha",
      clientRequestId: "req-reward-2",
      clientCompletedAt: new Date().toISOString(),
    });
    store.completeMission({
      missionId: "m3",
      profileId: "captain-alpha",
      clientRequestId: "req-reward-3",
      clientCompletedAt: new Date().toISOString(),
    });

    const success = store.claimReward({
      profileId: "captain-alpha",
      rewardId: "r1",
    });
    expect(success.claimed).toBe(true);
    expect(success.insufficientPoints).toBe(false);
    expect(success.newPowerLevel).toBeGreaterThanOrEqual(0);

    const claims = store.getRewardClaims("captain-alpha");
    expect(claims.length).toBe(1);
    expect(claims[0]?.title).toBe("Hero Sticker");
    expect(claims[0]?.imageUrl?.startsWith("data:image/svg+xml")).toBe(true);
  });

  it("allows claiming the same reward more than once", () => {
    resetLocalStoreForTests();
    const store = getLocalStore();

    store.completeMission({
      missionId: "m1",
      profileId: "captain-alpha",
      clientRequestId: "req-repeat-1",
      clientCompletedAt: new Date().toISOString(),
    });
    store.completeMission({
      missionId: "m2",
      profileId: "captain-alpha",
      clientRequestId: "req-repeat-2",
      clientCompletedAt: new Date().toISOString(),
    });
    store.completeMission({
      missionId: "m3",
      profileId: "captain-alpha",
      clientRequestId: "req-repeat-3",
      clientCompletedAt: new Date().toISOString(),
    });
    store.resetDaily("2099-01-02");
    store.completeMission({
      missionId: "m1",
      profileId: "captain-alpha",
      clientRequestId: "req-repeat-4",
      clientCompletedAt: new Date().toISOString(),
    });
    store.completeMission({
      missionId: "m2",
      profileId: "captain-alpha",
      clientRequestId: "req-repeat-5",
      clientCompletedAt: new Date().toISOString(),
    });
    store.completeMission({
      missionId: "m3",
      profileId: "captain-alpha",
      clientRequestId: "req-repeat-6",
      clientCompletedAt: new Date().toISOString(),
    });

    const first = store.claimReward({
      profileId: "captain-alpha",
      rewardId: "r1",
    });
    const second = store.claimReward({
      profileId: "captain-alpha",
      rewardId: "r1",
    });

    expect(first.claimed).toBe(true);
    expect(second.claimed).toBe(true);
    expect(second.alreadyClaimed).toBe(false);

    const claims = store.getRewardClaims("captain-alpha");
    expect(claims.length).toBe(2);
  });
});
