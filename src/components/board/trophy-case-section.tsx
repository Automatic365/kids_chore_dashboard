"use client";

import { useState } from "react";

import { AvatarDisplay } from "@/components/avatar-display";
import { RewardClaimEntry } from "@/lib/types/domain";

interface TrophyCaseSectionProps {
  rewardClaims: RewardClaimEntry[];
  show: boolean;
  loading: boolean;
  onToggle: () => void;
  onReturn: (claim: RewardClaimEntry) => void | Promise<void>;
  returningClaimById: Record<string, boolean>;
}

export function TrophyCaseSection({
  rewardClaims,
  show,
  loading,
  onToggle,
  onReturn,
  returningClaimById,
}: TrophyCaseSectionProps) {
  const [selectedClaim, setSelectedClaim] = useState<RewardClaimEntry | null>(null);

  return (
    <section className="mt-4 rounded-2xl border-4 border-black bg-[var(--hero-blue)] p-4 text-white shadow-[6px_6px_0_#000]">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="rounded-md bg-black/40 px-2 py-1 text-lg font-black uppercase text-[var(--hero-yellow)]">
          Trophy Case
        </h2>
        <p className="text-xs font-bold uppercase text-white/90">
          {rewardClaims.length} Claimed
        </p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="touch-target w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-black uppercase text-black"
      >
        {show ? "Hide Trophy Case" : "Show Trophy Case"}
      </button>
      {show ? (
        loading ? (
          <p className="mt-3 text-sm font-bold text-white/90">Loading trophies...</p>
        ) : rewardClaims.length === 0 ? (
          <p className="mt-3 text-sm font-bold text-white/90">
            Claim rewards to fill your trophy case.
          </p>
        ) : (
          <div className="mx-auto mt-3 grid w-full max-w-[560px] grid-cols-3 gap-2 md:grid-cols-4">
            {rewardClaims.map((claim) => (
              <article
                key={claim.id}
                className="cursor-pointer rounded-lg border-2 border-black bg-white p-1.5 text-black transition-transform hover:-translate-y-0.5"
                onClick={() => setSelectedClaim(claim)}
              >
                <AvatarDisplay
                  avatarUrl={claim.imageUrl ?? ""}
                  alt={`${claim.title} sticker`}
                  className="mb-1 grid h-14 w-full place-items-center rounded-md border-2 border-black bg-[var(--hero-blue)]/20 object-cover text-lg"
                />
                <p className="line-clamp-1 text-[11px] font-black uppercase leading-tight">
                  {claim.title}
                </p>
                <p className="mt-0.5 text-[9px] font-black uppercase text-zinc-600">
                  {new Date(claim.claimedAt).toLocaleDateString()}
                </p>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onReturn(claim);
                  }}
                  disabled={Boolean(returningClaimById[claim.id])}
                  className="touch-target mt-1 w-full rounded-md border-2 border-black bg-amber-300 px-1 py-1 text-[9px] font-black uppercase text-black disabled:opacity-60"
                >
                  {returningClaimById[claim.id] ? "Returning..." : "Give Back"}
                </button>
              </article>
            ))}
          </div>
        )
      ) : null}
      {selectedClaim ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelectedClaim(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border-4 border-black bg-[var(--hero-panel)] p-4 text-white shadow-[10px_10px_0_#000]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black uppercase text-[var(--hero-yellow)]">
                  {selectedClaim.title}
                </h3>
                <p className="mt-1 text-xs font-bold uppercase text-white/80">
                  Claimed {new Date(selectedClaim.claimedAt).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClaim(null)}
                className="touch-target rounded-xl border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase text-black"
              >
                Close
              </button>
            </div>
            <div className="mt-4 rounded-2xl border-4 border-black bg-white p-3">
              <AvatarDisplay
                avatarUrl={selectedClaim.imageUrl ?? ""}
                alt={`${selectedClaim.title} full sticker`}
                className="mx-auto aspect-[11/13] w-full max-w-[320px] rounded-2xl border-4 border-black bg-[var(--hero-blue)]/10 object-contain"
              />
            </div>
            <p className="mt-3 text-sm font-bold text-white/90">
              Tap outside this card to close.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
