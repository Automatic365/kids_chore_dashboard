"use client";

import { useState } from "react";

import { restoreMission as restoreMissionRequest } from "@/lib/client-api";
import { MissionWithState } from "@/lib/types/domain";

interface TrashSectionProps {
  missions: MissionWithState[];
  onRefresh: () => Promise<void>;
  pushToast: (type: "success" | "error", text: string) => void;
}

export function TrashSection({ missions, onRefresh, pushToast }: TrashSectionProps) {
  const [restoringById, setRestoringById] = useState<Record<string, boolean>>({});

  async function handleRestore(id: string, title: string) {
    setRestoringById((c) => ({ ...c, [id]: true }));
    try {
      await restoreMissionRequest(id);
      pushToast("success", `Restored "${title}".`);
      await onRefresh();
    } catch {
      pushToast("error", "Failed to restore mission.");
    } finally {
      setRestoringById((c) => ({ ...c, [id]: false }));
    }
  }

  return (
    <section className="comic-card p-4">
      <h2 className="text-xl font-black uppercase text-white">Trash</h2>
      <p className="mt-1 text-sm text-white/80">Deleted missions stay here until restored.</p>
      {missions.length === 0 ? (
        <p className="mt-3 rounded-lg bg-white/15 px-3 py-2 text-sm font-bold uppercase text-white/90">
          Trash is empty.
        </p>
      ) : (
        <div className="mt-3 grid gap-3">
          {missions.map((mission) => (
            <article
              key={mission.id}
              className="rounded-xl border-2 border-black bg-white p-3 text-black"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-black uppercase">{mission.title}</p>
                  <p className="text-sm">{mission.instructions}</p>
                </div>
                <button
                  type="button"
                  disabled={Boolean(restoringById[mission.id])}
                  onClick={() => void handleRestore(mission.id, mission.title)}
                  className="rounded-lg border-2 border-black bg-[var(--hero-blue)] px-3 py-2 text-xs font-black uppercase text-white disabled:opacity-60"
                >
                  {restoringById[mission.id] ? "Restoring…" : "Restore"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
