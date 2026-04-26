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

  it("blocks undo when mission points have already been spent on rewards", async () => {
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

    const claim = await store.claimReward({
      profileId: "captain-alpha",
      rewardId: "r1",
    });
    expect(claim.claimed).toBe(true);
    expect(claim.newRewardPoints).toBe(10);
    expect(claim.newXpPoints).toBe(30);
    expect(claim.newPowerLevel).toBe(30);

    const undo = store.uncompleteMission({
      missionId: "m2",
      profileId: "captain-alpha",
    });

    expect(undo.undone).toBe(false);
    expect(undo.wasCompleted).toBe(true);
    expect(undo.insufficientUnspentPoints).toBe(true);
    expect(undo.pointsRequiredToUndo).toBe(12);
    expect(undo.profileRewardPoints).toBe(10);
    expect(undo.profileXpPoints).toBe(30);
    expect(undo.profilePowerLevel).toBe(30);
  });

  it("allows parent force undo even when unspent points are insufficient", async () => {
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
    await store.claimReward({
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
    expect(undo.profileRewardPoints).toBe(0);
    expect(undo.profileXpPoints).toBe(18);
    expect(undo.profilePowerLevel).toBe(18);
  });

  it("allows undo after giving back a claimed reward", async () => {
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

    const claim = await store.claimReward({
      profileId: "captain-alpha",
      rewardId: "r1",
    });
    expect(claim.claimed).toBe(true);
    expect(claim.newRewardPoints).toBe(10);
    expect(claim.newXpPoints).toBe(30);
    expect(claim.newPowerLevel).toBe(30);

    const claims = store.getRewardClaims("captain-alpha");
    const returned = store.returnReward({
      profileId: "captain-alpha",
      rewardClaimId: claims[0]!.id,
    });
    expect(returned.returned).toBe(true);
    expect(returned.newRewardPoints).toBe(30);
    expect(returned.newXpPoints).toBe(30);
    expect(returned.newPowerLevel).toBe(30);

    const undo = store.uncompleteMission({
      missionId: "m2",
      profileId: "captain-alpha",
    });
    expect(undo.undone).toBe(true);
    expect(undo.profileRewardPoints).toBe(18);
    expect(undo.profileXpPoints).toBe(18);
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

  it("creates mission backfill for past date without marking today complete", () => {
    resetLocalStoreForTests();
    const store = getLocalStore();

    store.resetDaily("2099-01-03");
    const result = store.createMissionBackfill({
      profileId: "captain-alpha",
      missionId: "m1",
      localDate: "2099-01-02",
    });

    expect(result.entry.localDate).toBe("2099-01-02");
    expect(result.profileRewardPoints).toBe(10);
    expect(result.profileXpPoints).toBe(10);

    const missionToday = store
      .getMissions("captain-alpha")
      .find((mission) => mission.id === "m1");
    expect(missionToday?.completedToday).toBe(false);
  });

  it("rejects duplicate mission backfills for same mission and date", () => {
    resetLocalStoreForTests();
    const store = getLocalStore();

    store.resetDaily("2099-01-03");
    store.createMissionBackfill({
      profileId: "captain-alpha",
      missionId: "m1",
      localDate: "2099-01-02",
    });

    expect(() =>
      store.createMissionBackfill({
        profileId: "captain-alpha",
        missionId: "m1",
        localDate: "2099-01-02",
      }),
    ).toThrow(/already exists/i);
  });

  it("recomputes streak after backfill add/remove and reverses points", () => {
    resetLocalStoreForTests();
    const store = getLocalStore();

    store.resetDaily("2099-01-03");
    const first = store.createMissionBackfill({
      profileId: "captain-alpha",
      missionId: "m1",
      localDate: "2099-01-01",
    });
    const second = store.createMissionBackfill({
      profileId: "captain-alpha",
      missionId: "m2",
      localDate: "2099-01-02",
    });

    let profile = store.getProfiles().find((item) => item.id === "captain-alpha");
    expect(profile?.currentStreak).toBe(2);
    expect(profile?.lastStreakDate).toBe("2099-01-02");

    const removed = store.deleteMissionBackfill(second.entry.id);
    expect(removed.removed).toBe(true);
    expect(removed.profileRewardPoints).toBe(first.profileRewardPoints);
    expect(removed.profileXpPoints).toBe(first.profileXpPoints);

    profile = store.getProfiles().find((item) => item.id === "captain-alpha");
    expect(profile?.currentStreak).toBe(1);
    expect(profile?.lastStreakDate).toBe("2099-01-01");
  });

  it("claims rewards only when profile has enough power", async () => {
    resetLocalStoreForTests();
    const store = getLocalStore();

    const fail = await store.claimReward({
      profileId: "captain-alpha",
      rewardId: "r1",
    });
    expect(fail.claimed).toBe(false);
    expect(fail.insufficientPoints).toBe(true);
    expect(fail.cooldownActive).toBe(false);

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

    const success = await store.claimReward({
      profileId: "captain-alpha",
      rewardId: "r1",
    });
    expect(success.claimed).toBe(true);
    expect(success.insufficientPoints).toBe(false);
    expect(success.cooldownActive).toBe(false);
    expect(success.newPowerLevel).toBeGreaterThanOrEqual(0);

    const claims = store.getRewardClaims("captain-alpha");
    expect(claims.length).toBe(1);
    expect(claims[0]?.title).toBe("10 Extra Minutes of TV");
    expect(claims[0]?.imageUrl?.startsWith("data:image/svg+xml")).toBe(true);
  });

  it("allows claiming the same reward more than once", async () => {
    resetLocalStoreForTests();
    const store = getLocalStore();
    store.updateReward("r1", { minDaysBetweenClaims: null });

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

    const first = await store.claimReward({
      profileId: "captain-alpha",
      rewardId: "r1",
    });
    const second = await store.claimReward({
      profileId: "captain-alpha",
      rewardId: "r1",
    });

    expect(first.claimed).toBe(true);
    expect(second.claimed).toBe(true);
    expect(second.alreadyClaimed).toBe(false);

    const claims = store.getRewardClaims("captain-alpha");
    expect(claims.length).toBe(2);
  });

  it("blocks reward claims while the reward cooldown is active", async () => {
    resetLocalStoreForTests();
    const store = getLocalStore();

    store.updateReward("r1", { pointCost: 10, minDaysBetweenClaims: 10 });

    store.completeMission({
      missionId: "m1",
      profileId: "captain-alpha",
      clientRequestId: "req-cooldown-1",
      clientCompletedAt: new Date().toISOString(),
    });

    const first = await store.claimReward({
      profileId: "captain-alpha",
      rewardId: "r1",
    });
    const second = await store.claimReward({
      profileId: "captain-alpha",
      rewardId: "r1",
    });

    expect(first.claimed).toBe(true);
    expect(second.claimed).toBe(false);
    expect(second.cooldownActive).toBe(true);
    expect(second.cooldownDaysRemaining).toBe(10);
    expect(second.nextClaimDate).toBeTruthy();
  });

  it("generates unique sticker concepts per hero until the pool is exhausted", async () => {
    resetLocalStoreForTests();
    const store = getLocalStore();

    for (let day = 1; day <= 3; day += 1) {
      store.resetDaily(`2099-01-0${day}`);
      store.completeMission({
        missionId: "m1",
        profileId: "captain-alpha",
        clientRequestId: `req-sticker-${day}-1`,
        clientCompletedAt: new Date().toISOString(),
      });
      store.completeMission({
        missionId: "m2",
        profileId: "captain-alpha",
        clientRequestId: `req-sticker-${day}-2`,
        clientCompletedAt: new Date().toISOString(),
      });
      store.completeMission({
        missionId: "m3",
        profileId: "captain-alpha",
        clientRequestId: `req-sticker-${day}-3`,
        clientCompletedAt: new Date().toISOString(),
      });
    }

    await store.claimReward({
      profileId: "captain-alpha",
      rewardId: "r6",
    });
    await store.claimReward({
      profileId: "captain-alpha",
      rewardId: "r6",
    });

    const claims = store.getRewardClaims("captain-alpha");
    expect(claims).toHaveLength(2);
    expect(claims[0]?.stickerConceptId).toBeTruthy();
    expect(claims[1]?.stickerConceptId).toBeTruthy();
    expect(claims[0]?.stickerConceptId).not.toBe(claims[1]?.stickerConceptId);
    expect(["vehicle", "companion"]).toContain(claims[0]?.stickerType);
    expect(["vehicle", "companion"]).toContain(claims[1]?.stickerType);
  });

  it("defaults hero card focal point to center and updates it", () => {
    resetLocalStoreForTests();
    const store = getLocalStore();

    const created = store.createProfile({
      heroName: "Captain Focus",
      avatarUrl: "/avatars/captain.svg",
      uiMode: "text",
    });
    expect(created.heroCardObjectPosition).toBe("center");

    const updated = store.updateProfile(created.id, {
      heroCardObjectPosition: "bottom-right",
    });
    expect(updated.heroCardObjectPosition).toBe("bottom-right");
  });

  it("marks notifications read and clears unread count", () => {
    resetLocalStoreForTests();
    const store = getLocalStore();

    store.completeMission({
      missionId: "m1",
      profileId: "captain-alpha",
      clientRequestId: "req-note-1",
      clientCompletedAt: new Date().toISOString(),
    });

    expect(store.getUnreadNotificationCount()).toBe(1);
    const notifications = store.getNotifications();
    expect(notifications[0]?.readAt).toBeNull();

    const marked = store.markNotificationsRead();
    expect(marked.markedCount).toBe(1);
    expect(store.getUnreadNotificationCount()).toBe(0);
  });
});
