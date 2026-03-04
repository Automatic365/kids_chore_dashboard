"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createReward as createRewardRequest,
  deleteReward as deleteRewardRequest,
  updateReward as updateRewardRequest,
} from "@/lib/client-api";
import { Reward } from "@/lib/types/domain";

interface RewardManagerSectionProps {
  rewards: Reward[];
  onRefresh: () => Promise<void>;
  pushToast: (type: "success" | "error", text: string) => void;
}

interface RewardDraft {
  id: string;
  title: string;
  description: string;
  pointCost: number;
  isActive: boolean;
  sortOrder: number;
}

function toDraft(reward: Reward): RewardDraft {
  return { ...reward };
}

export function RewardManagerSection({
  rewards,
  onRefresh,
  pushToast,
}: RewardManagerSectionProps) {
  const [drafts, setDrafts] = useState<Record<string, RewardDraft>>({});
  const [savingById, setSavingById] = useState<Record<string, boolean>>({});
  const [deletingById, setDeletingById] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPointCost, setNewPointCost] = useState(25);
  const autosaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    setDrafts(Object.fromEntries(rewards.map((reward) => [reward.id, toDraft(reward)])));
  }, [rewards]);

  useEffect(() => {
    const timers = autosaveTimers.current;
    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const rewardDrafts = useMemo(
    () => Object.values(drafts).sort((a, b) => a.sortOrder - b.sortOrder),
    [drafts],
  );

  const persistDraft = useCallback(
    async (draft: RewardDraft) => {
      setSavingById((current) => ({ ...current, [draft.id]: true }));
      try {
        await updateRewardRequest(draft.id, {
          title: draft.title,
          description: draft.description,
          pointCost: draft.pointCost,
          isActive: draft.isActive,
          sortOrder: draft.sortOrder,
        });
      } catch {
        pushToast("error", "Reward autosave failed.");
      } finally {
        setSavingById((current) => ({ ...current, [draft.id]: false }));
      }
    },
    [pushToast],
  );

  const scheduleAutosave = useCallback(
    (draft: RewardDraft) => {
      const existing = autosaveTimers.current[draft.id];
      if (existing) clearTimeout(existing);
      autosaveTimers.current[draft.id] = setTimeout(() => {
        void persistDraft(draft);
        delete autosaveTimers.current[draft.id];
      }, 700);
    },
    [persistDraft],
  );

  function update(next: RewardDraft) {
    setDrafts((current) => ({ ...current, [next.id]: next }));
    scheduleAutosave(next);
  }

  function updateImmediate(next: RewardDraft) {
    setDrafts((current) => ({ ...current, [next.id]: next }));
    void persistDraft(next);
  }

  async function reorder(reward: RewardDraft, direction: "up" | "down") {
    const index = rewardDrafts.findIndex((item) => item.id === reward.id);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rewardDrafts.length) {
      return;
    }

    const other = rewardDrafts[targetIndex];
    const updatedA = { ...reward, sortOrder: other.sortOrder };
    const updatedB = { ...other, sortOrder: reward.sortOrder };
    setDrafts((current) => ({
      ...current,
      [updatedA.id]: updatedA,
      [updatedB.id]: updatedB,
    }));

    try {
      await Promise.all([
        updateRewardRequest(updatedA.id, { sortOrder: updatedA.sortOrder }),
        updateRewardRequest(updatedB.id, { sortOrder: updatedB.sortOrder }),
      ]);
      await onRefresh();
    } catch {
      pushToast("error", "Reward reorder failed.");
      await onRefresh();
    }
  }

  async function handleDelete(reward: RewardDraft) {
    const ok = window.confirm(`Delete reward "${reward.title}"?`);
    if (!ok) return;

    setDeletingById((current) => ({ ...current, [reward.id]: true }));
    try {
      await deleteRewardRequest(reward.id);
      pushToast("success", `Deleted "${reward.title}".`);
      await onRefresh();
    } catch {
      pushToast("error", "Reward delete failed.");
    } finally {
      setDeletingById((current) => ({ ...current, [reward.id]: false }));
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) return;
    setCreating(true);
    try {
      await createRewardRequest({
        title: newTitle.trim(),
        description: newDescription.trim(),
        pointCost: Math.max(1, newPointCost),
        isActive: true,
      });
      setNewTitle("");
      setNewDescription("");
      setNewPointCost(25);
      pushToast("success", "Reward created.");
      await onRefresh();
    } catch {
      pushToast("error", "Failed to create reward.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="comic-card p-4">
      <h2 className="text-xl font-black uppercase text-white">Rewards</h2>
      <div className="mt-3 grid gap-3">
        {rewardDrafts.map((reward, index) => (
          <article
            key={reward.id}
            className="rounded-xl border-2 border-black bg-white p-3 text-black"
          >
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={reward.title}
                  onChange={(event) => update({ ...reward, title: event.target.value })}
                  className="min-w-0 flex-1 rounded-lg border-2 border-black px-3 py-2"
                  placeholder="Reward title"
                />
                <input
                  type="number"
                  value={reward.pointCost}
                  min={1}
                  max={1000}
                  onChange={(event) =>
                    update({ ...reward, pointCost: Number(event.target.value) || 1 })
                  }
                  className="w-20 rounded-lg border-2 border-black px-2 py-2"
                />
                <label className="inline-flex items-center gap-1 text-xs font-bold uppercase">
                  <input
                    type="checkbox"
                    checked={reward.isActive}
                    onChange={(event) =>
                      updateImmediate({ ...reward, isActive: event.target.checked })
                    }
                  />
                  Active
                </label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => void reorder(reward, "up")}
                    className="rounded border-2 border-black bg-zinc-100 px-2 py-1 text-xs disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={index === rewardDrafts.length - 1}
                    onClick={() => void reorder(reward, "down")}
                    className="rounded border-2 border-black bg-zinc-100 px-2 py-1 text-xs disabled:opacity-30"
                  >
                    ▼
                  </button>
                </div>
                <span className="text-xs font-black uppercase text-[var(--hero-blue)]">
                  {savingById[reward.id] ? "Saving…" : "Autosave"}
                </span>
                <button
                  type="button"
                  disabled={Boolean(deletingById[reward.id])}
                  onClick={() => void handleDelete(reward)}
                  className="rounded-lg border-2 border-black bg-[var(--hero-red)] px-3 py-1 text-xs font-black uppercase text-white disabled:opacity-60"
                >
                  {deletingById[reward.id] ? "Deleting…" : "Delete"}
                </button>
              </div>
              <textarea
                value={reward.description}
                onChange={(event) => update({ ...reward, description: event.target.value })}
                rows={2}
                maxLength={500}
                placeholder="Reward description"
                className="w-full rounded-lg border-2 border-black px-3 py-2 text-sm"
              />
            </div>
          </article>
        ))}
      </div>

      <form onSubmit={(event) => void handleCreate(event)} className="mt-4 grid gap-2">
        <p className="text-sm font-black uppercase text-white/80">Add Reward</p>
        <input
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
          placeholder="Reward title"
          maxLength={120}
          required
        />
        <textarea
          value={newDescription}
          onChange={(event) => setNewDescription(event.target.value)}
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
          placeholder="Reward description"
          maxLength={500}
          rows={2}
          required
        />
        <input
          type="number"
          value={newPointCost}
          onChange={(event) => setNewPointCost(Number(event.target.value) || 1)}
          min={1}
          max={1000}
          className="w-32 rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
          required
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded-xl border-2 border-black bg-[var(--hero-yellow)] px-4 py-2 text-sm font-black uppercase text-black disabled:opacity-60"
        >
          {creating ? "Creating…" : "Create Reward"}
        </button>
      </form>
    </section>
  );
}
