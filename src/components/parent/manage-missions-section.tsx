"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  deleteMission as deleteMissionRequest,
  updateMission as updateMissionRequest,
} from "@/lib/client-api";
import { MissionWithState } from "@/lib/types/domain";
import { ImagePicker } from "@/components/parent/image-picker";

interface MissionDraft {
  id: string;
  profileId: string;
  title: string;
  instructions: string;
  imageUrl: string;
  powerValue: number;
  isActive: boolean;
  recurringDaily: boolean;
  sortOrder: number;
}

function toDraft(mission: MissionWithState): MissionDraft {
  return {
    id: mission.id,
    profileId: mission.profileId,
    title: mission.title,
    instructions: mission.instructions,
    imageUrl: mission.imageUrl ?? "",
    powerValue: mission.powerValue,
    isActive: mission.isActive,
    recurringDaily: mission.recurringDaily,
    sortOrder: mission.sortOrder,
  };
}

interface ManageMissionsSectionProps {
  missions: MissionWithState[];
  onRefresh: () => Promise<void>;
  pushToast: (type: "success" | "error", text: string) => void;
}

export function ManageMissionsSection({
  missions,
  onRefresh,
  pushToast,
}: ManageMissionsSectionProps) {
  const [drafts, setDrafts] = useState<Record<string, MissionDraft>>({});
  const [savingById, setSavingById] = useState<Record<string, boolean>>({});
  const [deletingById, setDeletingById] = useState<Record<string, boolean>>({});
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const autosaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    setDrafts(Object.fromEntries(missions.map((m) => [m.id, toDraft(m)])));
  }, [missions]);

  useEffect(() => {
    const timers = autosaveTimers.current;
    return () => {
      Object.values(timers).forEach((t) => clearTimeout(t));
    };
  }, []);

  const missionDrafts = useMemo(
    () => Object.values(drafts).sort((a, b) => {
      if (a.profileId !== b.profileId) return a.profileId.localeCompare(b.profileId);
      return a.sortOrder - b.sortOrder;
    }),
    [drafts],
  );

  const persistDraft = useCallback(
    async (draft: MissionDraft) => {
      setSavingById((c) => ({ ...c, [draft.id]: true }));
      try {
        await updateMissionRequest(draft.id, {
          title: draft.title,
          instructions: draft.instructions,
          imageUrl: draft.imageUrl || null,
          powerValue: draft.powerValue,
          isActive: draft.isActive,
          recurringDaily: draft.recurringDaily,
          sortOrder: draft.sortOrder,
        });
        setAutosaveError(null);
      } catch {
        setAutosaveError("Autosave failed.");
        pushToast("error", "Autosave failed.");
      } finally {
        setSavingById((c) => ({ ...c, [draft.id]: false }));
      }
    },
    [pushToast],
  );

  const scheduleAutosave = useCallback(
    (draft: MissionDraft) => {
      const existing = autosaveTimers.current[draft.id];
      if (existing) clearTimeout(existing);
      autosaveTimers.current[draft.id] = setTimeout(() => {
        void persistDraft(draft);
        delete autosaveTimers.current[draft.id];
      }, 700);
    },
    [persistDraft],
  );

  const reorder = useCallback(
    async (mission: MissionDraft, direction: "up" | "down") => {
      const siblings = missionDrafts
        .filter((m) => m.profileId === mission.profileId);
      const idx = siblings.findIndex((m) => m.id === mission.id);
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= siblings.length) return;

      const other = siblings[targetIdx];
      const myOrder = mission.sortOrder;
      const otherOrder = other.sortOrder;

      const updatedMission = { ...mission, sortOrder: otherOrder };
      const updatedOther = { ...other, sortOrder: myOrder };

      setDrafts((c) => ({
        ...c,
        [mission.id]: updatedMission,
        [other.id]: updatedOther,
      }));

      try {
        await Promise.all([
          updateMissionRequest(mission.id, { sortOrder: otherOrder }),
          updateMissionRequest(other.id, { sortOrder: myOrder }),
        ]);
        await onRefresh();
      } catch {
        pushToast("error", "Reorder failed.");
        await onRefresh();
      }
    },
    [missionDrafts, onRefresh, pushToast],
  );

  const handleDelete = useCallback(
    async (id: string, title: string) => {
      const ok = window.confirm(`Move "${title}" to trash? You can restore it later.`);
      if (!ok) return;

      const pending = autosaveTimers.current[id];
      if (pending) {
        clearTimeout(pending);
        delete autosaveTimers.current[id];
      }

      setDeletingById((c) => ({ ...c, [id]: true }));
      try {
        await deleteMissionRequest(id);
        pushToast("success", `Moved "${title}" to trash.`);
        await onRefresh();
      } catch {
        pushToast("error", "Delete failed.");
      } finally {
        setDeletingById((c) => ({ ...c, [id]: false }));
      }
    },
    [onRefresh, pushToast],
  );

  function update(next: MissionDraft) {
    setDrafts((c) => ({ ...c, [next.id]: next }));
    scheduleAutosave(next);
  }

  function updateImmediate(next: MissionDraft) {
    setDrafts((c) => ({ ...c, [next.id]: next }));
    void persistDraft(next);
  }

  return (
    <section className="comic-card p-4">
      <h2 className="text-xl font-black uppercase text-white">Manage Missions</h2>
      {autosaveError ? (
        <p className="mt-2 rounded-md bg-red-100 px-3 py-2 text-sm font-bold text-red-700">
          {autosaveError}
        </p>
      ) : null}
      <div className="mt-3 grid gap-4">
        {missionDrafts.map((mission) => {
          const siblings = missionDrafts.filter((m) => m.profileId === mission.profileId);
          const idx = siblings.findIndex((m) => m.id === mission.id);
          const isFirst = idx === 0;
          const isLast = idx === siblings.length - 1;

          return (
            <article
              key={mission.id}
              className="rounded-xl border-2 border-black bg-white p-3 text-black"
            >
              <div className="grid gap-2">
                {/* Row 1: title, power, active, daily, order, save status, delete */}
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={mission.title}
                    onChange={(e) => update({ ...mission, title: e.target.value })}
                    maxLength={120}
                    placeholder="Mission title"
                    className="min-w-0 flex-1 rounded-lg border-2 border-black px-3 py-2"
                  />
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={mission.powerValue}
                    onChange={(e) => update({ ...mission, powerValue: Number(e.target.value) })}
                    className="w-20 rounded-lg border-2 border-black px-2 py-2"
                    title="Power value"
                  />
                  <label className="inline-flex items-center gap-1 text-xs font-bold uppercase">
                    <input
                      type="checkbox"
                      checked={mission.isActive}
                      onChange={(e) => updateImmediate({ ...mission, isActive: e.target.checked })}
                    />
                    Active
                  </label>
                  <label className="inline-flex items-center gap-1 text-xs font-bold uppercase">
                    <input
                      type="checkbox"
                      checked={mission.recurringDaily}
                      onChange={(e) =>
                        updateImmediate({ ...mission, recurringDaily: e.target.checked })
                      }
                    />
                    Daily
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => void reorder(mission, "up")}
                      className="rounded border-2 border-black bg-zinc-100 px-2 py-1 text-xs disabled:opacity-30"
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => void reorder(mission, "down")}
                      className="rounded border-2 border-black bg-zinc-100 px-2 py-1 text-xs disabled:opacity-30"
                      title="Move down"
                    >
                      ▼
                    </button>
                  </div>
                  <span className="text-xs font-black uppercase text-[var(--hero-blue)]">
                    {savingById[mission.id] ? "Saving…" : "Autosave"}
                  </span>
                  <button
                    type="button"
                    disabled={Boolean(deletingById[mission.id])}
                    onClick={() => void handleDelete(mission.id, mission.title)}
                    className="rounded-lg border-2 border-black bg-[var(--hero-red)] px-3 py-1 text-xs font-black uppercase text-white disabled:opacity-60"
                  >
                    {deletingById[mission.id] ? "Trashing…" : "Trash"}
                  </button>
                </div>

                {/* Row 2: instructions */}
                <textarea
                  value={mission.instructions}
                  onChange={(e) => update({ ...mission, instructions: e.target.value })}
                  maxLength={1000}
                  placeholder="Task instructions"
                  rows={2}
                  className="w-full rounded-lg border-2 border-black px-3 py-2 text-sm"
                />

                {/* Row 3: image */}
                <ImagePicker
                  value={mission.imageUrl}
                  onChange={(url) => update({ ...mission, imageUrl: url })}
                  placeholder="Image URL"
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
