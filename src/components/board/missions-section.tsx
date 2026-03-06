"use client";

import { MissionWithState, Profile } from "@/lib/types/domain";

interface MissionsSectionProps {
  missions: MissionWithState[];
  profile: Profile;
  effectText: string | null;
  onComplete: (mission: MissionWithState) => void | Promise<void>;
  onUndo: (mission: MissionWithState) => void | Promise<void>;
}

export function MissionsSection({
  missions,
  profile,
  effectText,
  onComplete,
  onUndo,
}: MissionsSectionProps) {
  return (
    <>
      <section className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {missions.map((mission) => (
          <article
            key={mission.id}
            className={`comic-card comic-card-interactive relative flex min-h-[190px] flex-col overflow-hidden p-0 text-left ${
              mission.completedToday
                ? "cursor-not-allowed saturate-0 opacity-65"
                : "hover:-translate-y-1"
            }`}
          >
            <button
              type="button"
              disabled={mission.completedToday}
              onClick={() => void onComplete(mission)}
              className="w-full text-left"
            >
              {mission.recurringDaily ? (
                <span className="status-chip absolute top-2 right-2 z-10 bg-[var(--hero-yellow)] text-black">
                  Daily
                </span>
              ) : null}

              {profile.uiMode === "picture" ? (
                <div className="flex flex-col">
                  <div className="w-full bg-[#1f2f5c]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mission.imageUrl ?? "/missions/default.svg"}
                      alt={mission.title}
                      className="aspect-[16/10] w-full object-contain p-2 sm:aspect-[4/3]"
                    />
                  </div>
                  <div className="space-y-1 bg-black/70 p-3">
                    <p className="text-base font-black uppercase leading-tight break-words text-white">
                      {mission.title}
                    </p>
                    <p className="text-sm font-black uppercase tracking-wide text-[var(--hero-yellow)]">
                      +{mission.powerValue} Power
                    </p>
                    <p className="text-xs font-bold leading-snug break-words text-white/90">
                      {mission.instructions}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[190px] flex-col gap-2 p-4">
                  <p className="text-xl font-black uppercase leading-tight break-words text-white sm:text-2xl">
                    {mission.title}
                  </p>
                  <p className="text-sm font-bold leading-snug break-words text-white/85">
                    {mission.instructions}
                  </p>
                  <p className="mt-auto text-sm font-bold uppercase text-[var(--hero-yellow)]">
                    +{mission.powerValue} Power
                  </p>
                </div>
              )}
            </button>

            {mission.completedToday ? (
              <div className="absolute inset-0 z-20 grid place-items-center bg-black/60 p-4 text-center">
                <div className="flex flex-col items-center gap-3">
                  <p className="text-2xl font-black uppercase text-[var(--hero-yellow)]">
                    Mission Accomplished!
                  </p>
                  <button
                    type="button"
                    onClick={() => void onUndo(mission)}
                    className="touch-target rounded-xl border-2 border-black bg-white px-4 py-2 text-sm font-black uppercase text-black shadow-[4px_4px_0_#000]"
                  >
                    Undo
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </section>

      {effectText ? (
        <div className="pointer-events-none fixed inset-0 z-30 grid place-items-center">
          <p className="effect-pop text-5xl font-black uppercase text-[var(--hero-yellow)] sm:text-7xl">
            {effectText}
          </p>
        </div>
      ) : null}
    </>
  );
}
