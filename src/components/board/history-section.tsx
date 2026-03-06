"use client";

import { MissionHistoryEntry } from "@/lib/types/domain";

interface HistorySectionProps {
  history: MissionHistoryEntry[];
  show: boolean;
  loading: boolean;
  onToggle: () => void;
}

export function HistorySection({
  history,
  show,
  loading,
  onToggle,
}: HistorySectionProps) {
  return (
    <section className="mt-4 rounded-2xl border-4 border-black bg-black/45 p-4">
      <button
        type="button"
        onClick={onToggle}
        className="touch-target w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-black uppercase text-black"
      >
        {show ? "Hide Mission Log" : "Show Mission Log"}
      </button>
      {show ? (
        <div className="mt-3 grid gap-3">
          {loading ? (
            <p className="text-sm font-bold text-white/80">Loading mission log...</p>
          ) : history.length === 0 ? (
            <p className="text-sm font-bold text-white/80">No mission history yet.</p>
          ) : (
            history.map((entry) => (
              <article
                key={entry.date}
                className="rounded-xl border-2 border-black bg-white p-3 text-black"
              >
                <p className="text-sm font-black uppercase">{entry.date}</p>
                <ul className="mt-2 grid gap-1">
                  {entry.missions.map((item, index) => (
                    <li
                      key={`${entry.date}-${item.title}-${index}`}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{item.title}</span>
                      <span className="font-black text-[var(--hero-blue)]">
                        +{item.powerAwarded}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
