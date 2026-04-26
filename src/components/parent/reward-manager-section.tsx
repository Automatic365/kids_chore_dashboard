"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createReward as createRewardRequest,
  deleteReward as deleteRewardRequest,
  fetchParentSummary,
  updateReward as updateRewardRequest,
} from "@/lib/client-api";
import { useHeroDialog } from "@/hooks/use-hero-dialog";
import { ANALYTICS_START_DATE } from "@/lib/analytics-config";
import { STARTER_REWARD_PRESETS } from "@/lib/reward-presets";
import { compareRewardsByCost } from "@/lib/reward-order";
import { getRewardPricingPace, getSuggestedRewardPrice } from "@/lib/reward-pricing";
import { MissionWithState, ParentSummaryData, Profile, Reward } from "@/lib/types/domain";

interface RewardManagerSectionProps {
  profiles: Profile[];
  missions: MissionWithState[];
  rewards: Reward[];
  onRefresh: () => Promise<void>;
  pushToast: (type: "success" | "error", text: string) => void;
}

interface RewardDraft {
  id: string;
  title: string;
  description: string;
  pointCost: number;
  targetDaysToEarn: number | null;
  minDaysBetweenClaims: number | null;
  isActive: boolean;
  sortOrder: number;
}

function toDraft(reward: Reward): RewardDraft {
  return { ...reward };
}

function formatTargetDays(value: number | null): string {
  return value === null ? "" : String(value);
}

function parseTargetDays(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.min(30, Math.max(1, Math.round(parsed)));
}

function formatCooldownDays(value: number | null): string {
  return value === null ? "" : String(value);
}

function parseCooldownDays(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.min(365, Math.max(1, Math.round(parsed)));
}

export function RewardManagerSection({
  profiles,
  missions,
  rewards,
  onRefresh,
  pushToast,
}: RewardManagerSectionProps) {
  const { confirm, dialogNode } = useHeroDialog();
  const [summary, setSummary] = useState<ParentSummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, RewardDraft>>({});
  const [savingById, setSavingById] = useState<Record<string, boolean>>({});
  const [deletingById, setDeletingById] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [seedingStarterRewards, setSeedingStarterRewards] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPointCost, setNewPointCost] = useState(25);
  const [newTargetDaysToEarn, setNewTargetDaysToEarn] = useState<string>("3");
  const [newMinDaysBetweenClaims, setNewMinDaysBetweenClaims] = useState<string>("");
  const autosaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    setDrafts(Object.fromEntries(rewards.map((reward) => [reward.id, toDraft(reward)])));
  }, [rewards]);

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    void fetchParentSummary()
      .then((data) => {
        if (!cancelled) {
          setSummary(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          pushToast("error", "Failed to load reward pricing analytics.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSummaryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pushToast]);

  useEffect(() => {
    const timers = autosaveTimers.current;
    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const averageRewardPointsPerHeroPerDay =
    summary?.household.averageRewardPointsPerHeroPerDay ?? 0;
  const currentRecurringDailyCapacityPerHero = useMemo(() => {
    const heroCount = Math.max(1, profiles.length);
    const recurringPoints = missions
      .filter((mission) => mission.isActive && mission.recurringDaily && mission.deletedAt === null)
      .reduce((sum, mission) => sum + mission.powerValue, 0);
    return recurringPoints / heroCount;
  }, [missions, profiles.length]);
  const pricingBaselinePerHeroPerDay = getRewardPricingPace({
    averageRewardPointsPerHeroPerDay,
    currentRecurringDailyCapacityPerHero,
  });

  const rewardDrafts = useMemo(
    () =>
      Object.values(drafts).sort((a, b) =>
        compareRewardsByCost(
          {
            id: a.id,
            title: a.title,
            description: a.description,
            pointCost: a.pointCost,
            targetDaysToEarn: a.targetDaysToEarn,
            minDaysBetweenClaims: a.minDaysBetweenClaims,
            isActive: a.isActive,
            sortOrder: a.sortOrder,
          },
          {
            id: b.id,
            title: b.title,
            description: b.description,
            pointCost: b.pointCost,
            targetDaysToEarn: b.targetDaysToEarn,
            minDaysBetweenClaims: b.minDaysBetweenClaims,
            isActive: b.isActive,
            sortOrder: b.sortOrder,
          },
        ),
      ),
    [drafts],
  );

  const persistDraft = useCallback(
    async (draft: RewardDraft): Promise<boolean> => {
      setSavingById((current) => ({ ...current, [draft.id]: true }));
      try {
        await updateRewardRequest(draft.id, {
          title: draft.title,
          description: draft.description,
          pointCost: draft.pointCost,
          targetDaysToEarn: draft.targetDaysToEarn,
          minDaysBetweenClaims: draft.minDaysBetweenClaims,
          isActive: draft.isActive,
          sortOrder: draft.sortOrder,
        });
        return true;
      } catch {
        pushToast("error", "Reward autosave failed.");
        return false;
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
    const ok = await confirm({
      title: "Delete Reward",
      description: `Delete reward "${reward.title}"?`,
      confirmLabel: "Delete",
    });
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

  async function handleApplySuggestedPrice(reward: RewardDraft, suggestedPrice: number) {
    const next = { ...reward, pointCost: suggestedPrice };
    setDrafts((current) => ({ ...current, [reward.id]: next }));
    const saved = await persistDraft(next);
    if (saved) {
      pushToast("success", `Updated "${reward.title}" to ${suggestedPrice} points.`);
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
        targetDaysToEarn: parseTargetDays(newTargetDaysToEarn),
        minDaysBetweenClaims: parseCooldownDays(newMinDaysBetweenClaims),
        isActive: true,
      });
      setNewTitle("");
      setNewDescription("");
      setNewPointCost(25);
      setNewTargetDaysToEarn("3");
      setNewMinDaysBetweenClaims("");
      pushToast("success", "Reward created.");
      await onRefresh();
    } catch {
      pushToast("error", "Failed to create reward.");
    } finally {
      setCreating(false);
    }
  }

  async function handleLoadStarterRewards() {
    const existingTitles = new Set(rewards.map((reward) => reward.title.toLowerCase()));
    const missingRewards = STARTER_REWARD_PRESETS.filter(
      (reward) => !existingTitles.has(reward.title.toLowerCase()),
    );

    if (missingRewards.length === 0) {
      pushToast("success", "Starter rewards are already loaded.");
      return;
    }

    setSeedingStarterRewards(true);
    try {
      await Promise.all(
        missingRewards.map((reward) =>
          createRewardRequest({
            title: reward.title,
            description: reward.description,
            pointCost: reward.pointCost,
            targetDaysToEarn: reward.targetDaysToEarn ?? null,
            minDaysBetweenClaims: reward.minDaysBetweenClaims ?? null,
            isActive: reward.isActive,
            sortOrder: reward.sortOrder,
          }),
        ),
      );
      pushToast("success", `Added ${missingRewards.length} starter rewards.`);
      await onRefresh();
    } catch {
      pushToast("error", "Failed to load starter rewards.");
    } finally {
      setSeedingStarterRewards(false);
    }
  }

  return (
    <section className="comic-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black uppercase text-white">Rewards</h2>
          <p className="text-sm text-white/80">
            Pricing suggestions are based on reward points earned since {ANALYTICS_START_DATE}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleLoadStarterRewards()}
          disabled={seedingStarterRewards}
          className="rounded-xl border-2 border-black bg-[var(--hero-yellow)] px-4 py-2 text-sm font-black uppercase text-black disabled:opacity-60"
        >
          {seedingStarterRewards ? "Loading…" : "Load Starter Rewards"}
        </button>
      </div>

      <div className="mt-3 rounded-xl border-2 border-black bg-black/20 px-3 py-2 text-sm text-white/90">
        {summaryLoading ? (
          <span>Loading pricing analytics…</span>
        ) : (
          <span>
            Price suggestions use <strong>{pricingBaselinePerHeroPerDay.toFixed(1)}</strong>{" "}
            reward points per hero per day
            <span className="ml-1 text-white/70">
              (max of recent average {averageRewardPointsPerHeroPerDay.toFixed(1)} and current
              recurring mission board {currentRecurringDailyCapacityPerHero.toFixed(1)})
            </span>
          </span>
        )}
      </div>

      <div className="mt-3 grid gap-3">
        {rewardDrafts.map((reward, index) => {
          const suggestedPrice = getSuggestedRewardPrice(
            pricingBaselinePerHeroPerDay,
            reward.targetDaysToEarn,
          );
          const hasSuggestion =
            suggestedPrice !== null && suggestedPrice !== reward.pointCost;

          return (
            <article
              key={reward.id}
              className="rounded-xl border-2 border-black bg-white p-3 text-black"
            >
              <div className="grid gap-3">
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
                    className="w-24 rounded-lg border-2 border-black px-2 py-2"
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

                <div className="grid gap-3 rounded-xl border-2 border-black bg-zinc-50 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="grid gap-2">
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="grid gap-1 text-xs font-black uppercase text-zinc-700">
                        <span>Current Price</span>
                        <span className="rounded-lg border-2 border-black bg-white px-3 py-2 text-base text-black">
                          {reward.pointCost} pts
                        </span>
                      </label>
                      <label className="grid gap-1 text-xs font-black uppercase text-zinc-700">
                        <span>Target Days To Earn</span>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={formatTargetDays(reward.targetDaysToEarn)}
                          onChange={(event) =>
                            update({
                              ...reward,
                              targetDaysToEarn: parseTargetDays(event.target.value),
                            })
                          }
                          placeholder="Manual"
                          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-base font-bold text-black"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black uppercase text-zinc-700">
                        <span>Suggested Price</span>
                        <span className="rounded-lg border-2 border-dashed border-black bg-white px-3 py-2 text-base text-black">
                          {suggestedPrice === null ? "Manual pricing" : `${suggestedPrice} pts`}
                        </span>
                      </label>
                      <label className="grid gap-1 text-xs font-black uppercase text-zinc-700">
                        <span>Claim Cooldown Days</span>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={formatCooldownDays(reward.minDaysBetweenClaims)}
                          onChange={(event) =>
                            update({
                              ...reward,
                              minDaysBetweenClaims: parseCooldownDays(event.target.value),
                            })
                          }
                          placeholder="No cooldown"
                          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-base font-bold text-black"
                        />
                      </label>
                    </div>

                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={!hasSuggestion || savingById[reward.id]}
                      onClick={() =>
                        suggestedPrice !== null
                          ? void handleApplySuggestedPrice(reward, suggestedPrice)
                          : undefined
                      }
                      className="rounded-xl border-2 border-black bg-[var(--hero-yellow)] px-4 py-2 text-sm font-black uppercase text-black disabled:opacity-40"
                    >
                      Apply Suggested Price
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
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
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            type="number"
            value={newPointCost}
            onChange={(event) => setNewPointCost(Number(event.target.value) || 1)}
            min={1}
            max={1000}
            className="w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
            required
          />
          <input
            type="number"
            value={newTargetDaysToEarn}
            onChange={(event) => setNewTargetDaysToEarn(event.target.value)}
            min={1}
            max={30}
            className="w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
            placeholder="Target days to earn"
          />
          <input
            type="number"
            value={newMinDaysBetweenClaims}
            onChange={(event) => setNewMinDaysBetweenClaims(event.target.value)}
            min={1}
            max={365}
            className="w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
            placeholder="Cooldown days"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="submit"
            disabled={creating}
            className="rounded-xl border-2 border-black bg-[var(--hero-yellow)] px-4 py-2 text-sm font-black uppercase text-black disabled:opacity-60"
          >
            {creating ? "Creating…" : "Create Reward"}
          </button>
        </div>
      </form>
      {dialogNode}
    </section>
  );
}
