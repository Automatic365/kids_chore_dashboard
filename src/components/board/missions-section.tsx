"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { MissionWithState, Profile } from "@/lib/types/domain";

interface MissionsSectionProps {
  missions: MissionWithState[];
  profile: Profile;
  effectText: string | null;
  boardEditMode: boolean;
  updatingMissionById: Record<string, boolean>;
  savedMissionById: Record<string, boolean>;
  onComplete: (mission: MissionWithState) => void | Promise<void>;
  onUndo: (mission: MissionWithState) => void | Promise<void>;
  onDelete: (mission: MissionWithState) => void | Promise<void>;
  onUpdate: (
    mission: MissionWithState,
    next: {
      title: string;
      instructions: string;
      powerValue: number;
      recurringDaily: boolean;
    },
  ) => void | Promise<void>;
}

export function MissionsSection({
  missions,
  profile,
  effectText,
  boardEditMode,
  updatingMissionById,
  savedMissionById,
  onComplete,
  onUndo,
  onDelete,
  onUpdate,
}: MissionsSectionProps) {
  const [editingMissionId, setEditingMissionId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        title: string;
        instructions: string;
        powerValue: number;
        recurringDaily: boolean;
      }
    >
  >({});
  const [editError, setEditError] = useState<string | null>(null);
  const autosaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const activeMissionIds = useMemo(() => new Set(missions.map((mission) => mission.id)), [missions]);
  const visibleEditingMissionId =
    editingMissionId && activeMissionIds.has(editingMissionId) ? editingMissionId : null;

  useEffect(() => {
    const timers = autosaveTimers.current;
    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  function getDraft(mission: MissionWithState) {
    return (
      drafts[mission.id] ?? {
        title: mission.title,
        instructions: mission.instructions,
        powerValue: mission.powerValue,
        recurringDaily: mission.recurringDaily,
      }
    );
  }

  function startEditing(mission: MissionWithState) {
    setEditError(null);
    setEditingMissionId(mission.id);
    setDrafts((current) => ({
      ...current,
      [mission.id]: getDraft(mission),
    }));
  }

  function stopEditing() {
    setEditingMissionId(null);
    setEditError(null);
  }

  function updateDraft(
    missionId: string,
    field: "title" | "instructions" | "powerValue" | "recurringDaily",
    value: string | number | boolean,
  ) {
    const existing =
      drafts[missionId] ?? {
        title: "",
        instructions: "",
        powerValue: 10,
        recurringDaily: true,
      };
    const nextDraft = {
      ...existing,
      [field]: value,
    };
    setDrafts((current) => ({
      ...current,
      [missionId]: nextDraft,
    }));
    return nextDraft;
  }

  function buildPayload(
    mission: MissionWithState,
    draft = getDraft(mission),
  ): {
    title: string;
    instructions: string;
    powerValue: number;
    recurringDaily: boolean;
  } | null {
    const title = draft.title.trim();
    const instructions = draft.instructions.trim();
    const powerValue = Number.isFinite(draft.powerValue)
      ? Math.max(1, Math.min(100, Math.round(draft.powerValue)))
      : mission.powerValue;

    if (!title || !instructions) {
      return null;
    }

    return {
      title,
      instructions,
      powerValue,
      recurringDaily: draft.recurringDaily,
    };
  }

  function hasMissionChanges(
    mission: MissionWithState,
    payload: {
      title: string;
      instructions: string;
      powerValue: number;
      recurringDaily: boolean;
    },
  ) {
    return (
      payload.title !== mission.title ||
      payload.instructions !== mission.instructions ||
      payload.powerValue !== mission.powerValue ||
      payload.recurringDaily !== mission.recurringDaily
    );
  }

  async function saveMission(
    mission: MissionWithState,
    options?: {
      immediate?: boolean;
      draft?: {
        title: string;
        instructions: string;
        powerValue: number;
        recurringDaily: boolean;
      };
    },
  ) {
    const draft = options?.draft ?? getDraft(mission);
    const payload = buildPayload(mission, draft);
    if (!payload) {
      setEditError("Title and instructions are required.");
      return;
    }
    if (!hasMissionChanges(mission, payload)) {
      setEditError(null);
      return;
    }

    try {
      setEditError(null);
      if (options?.immediate) {
        const existing = autosaveTimers.current[mission.id];
        if (existing) {
          clearTimeout(existing);
          delete autosaveTimers.current[mission.id];
        }
      }
      await onUpdate(mission, payload);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Mission update failed");
    }
  }

  function scheduleAutosave(
    mission: MissionWithState,
    draft: {
      title: string;
      instructions: string;
      powerValue: number;
      recurringDaily: boolean;
    },
  ) {
    const payload = buildPayload(mission, draft);
    if (!payload || !hasMissionChanges(mission, payload)) {
      return;
    }

    const existing = autosaveTimers.current[mission.id];
    if (existing) {
      clearTimeout(existing);
    }

    autosaveTimers.current[mission.id] = setTimeout(() => {
      void saveMission(mission, { immediate: true, draft });
    }, 700);
  }

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
            {boardEditMode ? (
              <div className="absolute top-2 left-2 z-20 flex gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (visibleEditingMissionId === mission.id) {
                      stopEditing();
                      return;
                    }
                    startEditing(mission);
                  }}
                  className="status-chip bg-white text-black"
                >
                  {visibleEditingMissionId === mission.id ? "Close" : "Edit"}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void onDelete(mission);
                  }}
                  className="status-chip bg-[var(--hero-red)] text-white"
                >
                  Trash
                </button>
              </div>
            ) : null}

            {visibleEditingMissionId === mission.id && boardEditMode ? (
              <div className="flex min-h-[190px] flex-col gap-3 p-4">
                <span className="status-chip absolute top-2 right-2 z-10 bg-[var(--hero-yellow)] text-black">
                  {mission.recurringDaily ? "Daily" : "Bonus"}
                </span>
                <label className="text-xs font-black uppercase text-white">
                  Mission Name
                  <input
                    type="text"
                    value={getDraft(mission).title}
                    onChange={(event) => {
                      const nextDraft = updateDraft(mission.id, "title", event.target.value);
                      scheduleAutosave(mission, nextDraft);
                    }}
                    onBlur={() => void saveMission(mission, { immediate: true })}
                    className="mt-1 w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-bold text-black"
                  />
                </label>
                <label className="text-xs font-black uppercase text-white">
                  What The Kid Should Do
                  <textarea
                    value={getDraft(mission).instructions}
                    onChange={(event) => {
                      const nextDraft = updateDraft(
                        mission.id,
                        "instructions",
                        event.target.value,
                      );
                      scheduleAutosave(mission, nextDraft);
                    }}
                    onBlur={() => void saveMission(mission, { immediate: true })}
                    rows={4}
                    className="mt-1 w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-bold text-black"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-black uppercase text-white">
                    Power
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={getDraft(mission).powerValue}
                      onChange={(event) => {
                        const nextDraft = updateDraft(
                          mission.id,
                          "powerValue",
                          Number.parseInt(event.target.value || "0", 10),
                        );
                        scheduleAutosave(mission, nextDraft);
                      }}
                      onBlur={() => void saveMission(mission, { immediate: true })}
                      className="mt-1 w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-bold text-black"
                    />
                  </label>
                  <label className="mt-6 flex items-center gap-2 text-sm font-black uppercase text-white">
                    <input
                      type="checkbox"
                      checked={getDraft(mission).recurringDaily}
                      onChange={(event) => {
                        const nextDraft = updateDraft(
                          mission.id,
                          "recurringDaily",
                          event.target.checked,
                        );
                        void saveMission(mission, { immediate: true, draft: nextDraft });
                      }}
                      className="h-4 w-4 accent-[var(--hero-yellow)]"
                    />
                    Repeat Daily
                  </label>
                </div>
                {editError ? (
                  <p className="text-xs font-black text-[var(--hero-yellow)]">{editError}</p>
                ) : null}
                <div className="mt-auto flex gap-2">
                  <div className="flex flex-1 items-center rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-black uppercase text-black">
                    {updatingMissionById[mission.id]
                      ? "Saving..."
                      : savedMissionById[mission.id]
                        ? "Saved"
                        : "Autosaves"}
                  </div>
                  <button
                    type="button"
                    onClick={stopEditing}
                    className="touch-target rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-black uppercase text-black"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={mission.completedToday || boardEditMode}
                onClick={() => void onComplete(mission)}
                className="w-full text-left disabled:cursor-default"
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
            )}

            {mission.completedToday && !boardEditMode ? (
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
