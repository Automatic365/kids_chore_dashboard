"use client";

import { useEffect, useState } from "react";

import { fetchParentSummary } from "@/lib/client-api";
import { ANALYTICS_START_DATE } from "@/lib/analytics-config";
import { ParentSummaryData } from "@/lib/types/domain";

interface CycleSummarySectionProps {
  pushToast: (type: "success" | "error", text: string) => void;
}

function DailyGrid({
  days,
}: {
  days: Array<{ date: string; completed: number; rewardPoints: number; xpPoints: number }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-10">
      {days.map((day) => (
        <div
          key={day.date}
          className="rounded-lg border border-zinc-300 bg-zinc-50 px-2 py-2 text-center"
        >
          <p className="text-[10px] font-bold uppercase text-zinc-500">{day.date.slice(5)}</p>
          <p className="text-lg font-black text-black">{day.completed}</p>
          <p className="text-[11px] font-semibold text-zinc-600">{day.rewardPoints} pts</p>
        </div>
      ))}
    </div>
  );
}

function TopMissionList({
  missions,
}: {
  missions: Array<{
    title: string;
    completedCount: number;
    totalRewardPoints: number;
  }>;
}) {
  if (missions.length === 0) {
    return <p className="text-sm text-zinc-500">No mission history in this window yet.</p>;
  }

  return (
    <div className="grid gap-2">
      {missions.map((mission, index) => (
        <div
          key={`${mission.title}-${index}`}
          className="flex items-center justify-between gap-3 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-black uppercase text-black">{mission.title}</p>
            <p className="text-xs text-zinc-600">{mission.totalRewardPoints} total points</p>
          </div>
          <p className="shrink-0 text-sm font-black text-[var(--hero-blue)]">
            {mission.completedCount}x
          </p>
        </div>
      ))}
    </div>
  );
}

export function CycleSummarySection({ pushToast }: CycleSummarySectionProps) {
  const [summary, setSummary] = useState<ParentSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void fetchParentSummary()
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        if (!cancelled) {
          pushToast("error", "Failed to load analytics.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pushToast]);

  return (
    <section className="comic-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black uppercase text-white">Analytics</h2>
          <p className="text-sm text-white/80">
            Since launch on {ANALYTICS_START_DATE} ({summary?.windowDays ?? 0} day
            {summary?.windowDays === 1 ? "" : "s"} tracked).
          </p>
        </div>
        {summary ? (
          <p className="text-sm font-bold uppercase text-white/80">
            Cycle Date {summary.cycleDate}
          </p>
        ) : null}
      </div>
      {loading ? <p className="mt-3 text-sm text-white/80">Loading analytics...</p> : null}
      {!loading && !summary ? (
        <p className="mt-3 text-sm text-white/80">No analytics data available.</p>
      ) : null}
      {summary ? (
        <div className="mt-4 grid gap-4">
          <article className="rounded-xl border-2 border-black bg-white p-4 text-black">
            <h3 className="text-lg font-black uppercase">Household Overview</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-3">
                <p className="text-xs font-bold uppercase text-zinc-500">Avg Reward Points / Day</p>
                <p className="mt-1 text-2xl font-black">
                  {summary.household.averageRewardPointsPerDay.toFixed(1)}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-3">
                <p className="text-xs font-bold uppercase text-zinc-500">Avg XP / Day</p>
                <p className="mt-1 text-2xl font-black">
                  {summary.household.averageXpPointsPerDay.toFixed(1)}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-3">
                <p className="text-xs font-bold uppercase text-zinc-500">Total Missions</p>
                <p className="mt-1 text-2xl font-black">{summary.household.totalCompleted}</p>
              </div>
              <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-3">
                <p className="text-xs font-bold uppercase text-zinc-500">
                  Avg Reward Points / Hero / Day
                </p>
                <p className="mt-1 text-2xl font-black">
                  {summary.household.averageRewardPointsPerHeroPerDay.toFixed(1)}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <p className="mb-2 text-sm font-black uppercase text-zinc-700">
                  Since-Launch Household Trend
                </p>
                <DailyGrid days={summary.household.daily} />
              </div>
              <div>
                <p className="mb-2 text-sm font-black uppercase text-zinc-700">
                  Most Completed Missions
                </p>
                <TopMissionList missions={summary.household.topMissions} />
              </div>
            </div>
          </article>

          <div className="grid gap-4 lg:grid-cols-2">
            {summary.heroes.map((hero) => (
              <article
                key={hero.profileId}
                className="rounded-xl border-2 border-black bg-white p-4 text-black"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-black uppercase">{hero.heroName}</h3>
                    <p className="text-sm font-bold uppercase text-zinc-500">
                      Today {hero.todayCompleted}/{hero.todayTotal}
                    </p>
                  </div>
                  <div className="text-right text-sm font-black uppercase text-[var(--hero-blue)]">
                    <p>{hero.averageRewardPointsPerDay.toFixed(1)} pts/day</p>
                    <p>{hero.averageXpPointsPerDay.toFixed(1)} xp/day</p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-sm font-black uppercase text-zinc-700">
                    Most Completed Missions
                  </p>
                  <TopMissionList missions={hero.topMissions} />
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-sm font-black uppercase text-zinc-700">
                    Since-Launch Trend
                  </p>
                  <DailyGrid days={hero.daily} />
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
