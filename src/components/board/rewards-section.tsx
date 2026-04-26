"use client";

import { useEffect, useRef, useState } from "react";

import { compareRewardsByCost } from "@/lib/reward-order";
import { Profile, Reward } from "@/lib/types/domain";

interface RewardsSectionProps {
  rewards: Reward[];
  profile: Profile;
  boardEditMode: boolean;
  updatingRewardById: Record<string, boolean>;
  savedRewardById: Record<string, boolean>;
  rewardCooldownById: Record<
    string,
    { cooldownActive: boolean; nextClaimDate: string | null; cooldownDaysRemaining: number | null }
  >;
  onClaim: (reward: Reward) => void | Promise<void>;
  onUpdateCost: (reward: Reward, nextCost: number) => void | Promise<void>;
}

export function RewardsSection({
  rewards,
  profile,
  boardEditMode,
  updatingRewardById,
  savedRewardById,
  rewardCooldownById,
  onClaim,
  onUpdateCost,
}: RewardsSectionProps) {
  const [costDrafts, setCostDrafts] = useState<Record<string, number>>({});
  const autosaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timers = autosaveTimers.current;
    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  function scheduleAutosave(reward: Reward, nextCost: number) {
    const existing = autosaveTimers.current[reward.id];
    if (existing) {
      clearTimeout(existing);
    }

    autosaveTimers.current[reward.id] = setTimeout(() => {
      void onUpdateCost(reward, nextCost);
      delete autosaveTimers.current[reward.id];
    }, 700);
  }

  function saveImmediately(reward: Reward, nextCost: number) {
    const existing = autosaveTimers.current[reward.id];
    if (existing) {
      clearTimeout(existing);
      delete autosaveTimers.current[reward.id];
    }
    void onUpdateCost(reward, nextCost);
  }

  const activeRewards = rewards
    .filter((reward) => reward.isActive)
    .sort(compareRewardsByCost);
  if (activeRewards.length === 0) {
    return null;
  }

  return (
    <section className="mt-4 rounded-2xl border-4 border-black bg-[var(--hero-blue)]/80 p-4 shadow-[6px_6px_0_#000]">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-black uppercase">Rewards</h2>
        <p className="text-xs font-bold uppercase text-white/80">
          {boardEditMode ? "Edit Reward Costs" : "Spend Reward Points"}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {activeRewards.map((reward) => {
          const cooldown = rewardCooldownById[reward.id];
          const cooldownActive = cooldown?.cooldownActive ?? false;
          const cooldownLabel =
            cooldownActive && cooldown?.cooldownDaysRemaining
              ? `Ready in ${cooldown.cooldownDaysRemaining} day${
                  cooldown.cooldownDaysRemaining === 1 ? "" : "s"
                }`
              : cooldownActive
                ? "On cooldown"
                : null;
          return (
          <article
            key={reward.id}
            className="rounded-xl border-2 border-black bg-white p-3 text-black"
          >
            <p className="text-lg font-black uppercase">{reward.title}</p>
            <p className="mt-1 text-sm">{reward.description}</p>
            {!boardEditMode && reward.minDaysBetweenClaims ? (
              <p className="mt-2 text-xs font-bold uppercase text-zinc-600">
                Cooldown: once every {reward.minDaysBetweenClaims} day
                {reward.minDaysBetweenClaims === 1 ? "" : "s"}
              </p>
            ) : null}
            <div className="mt-2 flex items-center justify-between gap-2">
              {boardEditMode ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={costDrafts[reward.id] ?? reward.pointCost}
                    onChange={(event) => {
                      const nextCost = Number(event.target.value) || 1;
                      setCostDrafts((current) => ({
                        ...current,
                        [reward.id]: nextCost,
                      }));
                      scheduleAutosave(reward, nextCost);
                    }}
                    onBlur={() =>
                      saveImmediately(reward, costDrafts[reward.id] ?? reward.pointCost)
                    }
                    className="w-24 rounded-lg border-2 border-black px-2 py-1 text-sm font-black"
                  />
                  <span className="text-xs font-black uppercase text-zinc-700">
                    Reward Points
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-start gap-1">
                  <span className="rounded-full border-2 border-black bg-[var(--hero-yellow)] px-2 py-1 text-xs font-black uppercase">
                    {reward.pointCost} Reward Points
                  </span>
                  {cooldownLabel ? (
                    <span className="text-[11px] font-bold uppercase text-zinc-600">
                      {cooldownLabel}
                    </span>
                  ) : null}
                </div>
              )}

              {boardEditMode ? (
                <span className="text-xs font-black uppercase text-zinc-700">
                  {updatingRewardById[reward.id]
                    ? "Saving..."
                    : savedRewardById[reward.id]
                      ? "Saved"
                      : "Autosaves"}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void onClaim(reward)}
                  disabled={profile.rewardPoints < reward.pointCost || cooldownActive}
                  className="rounded-lg border-2 border-black bg-[var(--hero-red)] px-3 py-1 text-xs font-black uppercase text-white disabled:opacity-50"
                >
                  {cooldownActive ? "Cooldown" : "Claim"}
                </button>
              )}
            </div>
          </article>
          );
        })}
      </div>
    </section>
  );
}
