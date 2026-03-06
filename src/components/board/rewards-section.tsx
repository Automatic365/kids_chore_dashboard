"use client";

import { Profile, Reward } from "@/lib/types/domain";

interface RewardsSectionProps {
  rewards: Reward[];
  profile: Profile;
  onClaim: (reward: Reward) => void | Promise<void>;
}

export function RewardsSection({
  rewards,
  profile,
  onClaim,
}: RewardsSectionProps) {
  const activeRewards = rewards.filter((reward) => reward.isActive);
  if (activeRewards.length === 0) {
    return null;
  }

  return (
    <section className="mt-4 rounded-2xl border-4 border-black bg-[var(--hero-blue)]/80 p-4 shadow-[6px_6px_0_#000]">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-black uppercase">Rewards</h2>
        <p className="text-xs font-bold uppercase text-white/80">
          Spend Power Points
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {activeRewards.map((reward) => (
          <article
            key={reward.id}
            className="rounded-xl border-2 border-black bg-white p-3 text-black"
          >
            <p className="text-lg font-black uppercase">{reward.title}</p>
            <p className="mt-1 text-sm">{reward.description}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="rounded-full border-2 border-black bg-[var(--hero-yellow)] px-2 py-1 text-xs font-black uppercase">
                {reward.pointCost} Power
              </span>
              <button
                type="button"
                onClick={() => void onClaim(reward)}
                disabled={profile.powerLevel < reward.pointCost}
                className="rounded-lg border-2 border-black bg-[var(--hero-red)] px-3 py-1 text-xs font-black uppercase text-white disabled:opacity-50"
              >
                Claim
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
