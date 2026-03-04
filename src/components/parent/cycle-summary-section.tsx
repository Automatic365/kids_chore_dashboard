"use client";

import { useEffect, useState } from "react";

import { fetchParentSummary, ParentSummaryData } from "@/lib/client-api";

interface CycleSummarySectionProps {
  pushToast: (type: "success" | "error", text: string) => void;
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
          pushToast("error", "Failed to load cycle summary.");
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
      <h2 className="text-xl font-black uppercase text-white">Cycle Summary</h2>
      {loading ? <p className="mt-3 text-sm text-white/80">Loading summary...</p> : null}
      {!loading && !summary ? (
        <p className="mt-3 text-sm text-white/80">No summary data available.</p>
      ) : null}
      {summary ? (
        <div className="mt-3 grid gap-3">
          {summary.heroes.map((hero) => (
            <article
              key={hero.profileId}
              className="rounded-xl border-2 border-black bg-white p-3 text-black"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-lg font-black uppercase">{hero.heroName}</p>
                <p className="text-sm font-bold uppercase text-zinc-600">
                  Today {hero.todayCompleted}/{hero.todayTotal}
                </p>
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1">
                {hero.daily.map((day) => (
                  <div
                    key={`${hero.profileId}-${day.date}`}
                    className="rounded border border-zinc-300 bg-zinc-50 p-1 text-center"
                  >
                    <p className="text-[10px] font-bold uppercase text-zinc-500">
                      {day.date.slice(5)}
                    </p>
                    <p className="text-sm font-black">{day.completed}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
