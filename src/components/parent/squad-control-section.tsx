"use client";

import { useState } from "react";

import {
  awardSquadPower as awardSquadPowerRequest,
  redeemSquadGoal as redeemSquadGoalRequest,
  setSquadGoal as setSquadGoalRequest,
} from "@/lib/client-api";
import { SquadState } from "@/lib/types/domain";

interface SquadControlSectionProps {
  squad: SquadState;
  onRefresh: () => Promise<void>;
  pushToast: (type: "success" | "error", text: string) => void;
  onLogout: () => void;
  cycleDate: string;
}

export function SquadControlSection({
  squad,
  onRefresh,
  pushToast,
  onLogout,
  cycleDate,
}: SquadControlSectionProps) {
  const [awardDelta, setAwardDelta] = useState(5);
  const [goalTitle, setGoalTitle] = useState<string | null>(null);
  const [goalTargetPower, setGoalTargetPower] = useState<number | null>(null);
  const [goalRewardDescription, setGoalRewardDescription] = useState<string | null>(null);

  async function handleAward() {
    try {
      await awardSquadPowerRequest({ delta: awardDelta, note: "Manual parent award" });
      pushToast("success", "Squad power awarded.");
      await onRefresh();
    } catch {
      pushToast("error", "Failed to award squad power.");
    }
  }

  async function handleSetGoal() {
    const resolvedTitle = (goalTitle ?? squad.squadGoal?.title ?? "").trim();
    const resolvedRewardDescription = (
      goalRewardDescription ?? squad.squadGoal?.rewardDescription ?? ""
    ).trim();
    const resolvedTargetPower =
      goalTargetPower ?? squad.squadGoal?.targetPower ?? squad.squadPowerMax;

    if (!resolvedTitle || !resolvedRewardDescription) {
      pushToast("error", "Goal title and reward are required.");
      return;
    }

    try {
      await setSquadGoalRequest({
        title: resolvedTitle,
        targetPower: Math.max(1, resolvedTargetPower),
        rewardDescription: resolvedRewardDescription,
      });
      pushToast("success", "Squad goal updated.");
      setGoalTitle(null);
      setGoalTargetPower(null);
      setGoalRewardDescription(null);
      await onRefresh();
    } catch {
      pushToast("error", "Failed to set squad goal.");
    }
  }

  async function handleRedeem() {
    try {
      await redeemSquadGoalRequest();
      pushToast("success", "Reward redeemed! Squad power reset to zero.");
      await onRefresh();
    } catch {
      pushToast("error", "Failed to redeem reward.");
    }
  }

  async function handleClearGoal() {
    try {
      await setSquadGoalRequest(null);
      pushToast("success", "Squad goal cleared.");
      setGoalTitle(null);
      setGoalTargetPower(null);
      setGoalRewardDescription(null);
      await onRefresh();
    } catch {
      pushToast("error", "Failed to clear squad goal.");
    }
  }

  const pct = Math.round(
    (squad.squadPowerCurrent / Math.max(1, squad.squadPowerMax)) * 100,
  );

  return (
    <header className="comic-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black uppercase text-white">Mission Command</h1>
          <p className="text-sm uppercase text-white/75">Cycle Date: {cycleDate}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-xl border-2 border-black bg-white px-4 py-2 text-sm font-black uppercase text-black"
        >
          Log Out
        </button>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-sm font-bold uppercase text-white/80">Squad Meter</p>
        <div className="meter-wrap bg-white/20">
          <div className="meter-fill bg-[var(--hero-yellow)]" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-sm font-bold uppercase text-white">
          {squad.squadPowerCurrent}/{squad.squadPowerMax}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="number"
            value={awardDelta}
            onChange={(e) => setAwardDelta(Number(e.target.value))}
            className="w-24 rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
          />
          <button
            type="button"
            onClick={() => void handleAward()}
            className="rounded-xl border-2 border-black bg-[var(--hero-yellow)] px-4 py-2 text-sm font-black uppercase text-black"
          >
            Award Squad Power
          </button>
        </div>

        <div className="mt-4 grid gap-2 rounded-xl border-2 border-black bg-white p-3 text-black">
          <p className="text-sm font-black uppercase">Squad Goal</p>
          {squad.squadGoal ? (
            <p className="text-xs font-bold uppercase text-zinc-600">
              Current: {squad.squadGoal.title} ({squad.squadGoal.targetPower}) -{" "}
              {squad.squadGoal.rewardDescription}
            </p>
          ) : (
            <p className="text-xs font-bold uppercase text-zinc-600">No goal set</p>
          )}
          <input
            value={goalTitle ?? squad.squadGoal?.title ?? ""}
            onChange={(event) => setGoalTitle(event.target.value)}
            placeholder="Goal title"
            className="rounded-lg border-2 border-black px-3 py-2"
            maxLength={120}
          />
          <input
            type="number"
            value={goalTargetPower ?? squad.squadGoal?.targetPower ?? squad.squadPowerMax}
            onChange={(event) => setGoalTargetPower(Number(event.target.value) || 1)}
            min={1}
            max={2000}
            className="w-40 rounded-lg border-2 border-black px-3 py-2"
          />
          <textarea
            value={goalRewardDescription ?? squad.squadGoal?.rewardDescription ?? ""}
            onChange={(event) => setGoalRewardDescription(event.target.value)}
            placeholder="Reward description"
            className="rounded-lg border-2 border-black px-3 py-2 text-sm"
            rows={2}
            maxLength={500}
          />
          {squad.squadGoal &&
          squad.squadPowerCurrent >= squad.squadGoal.targetPower ? (
            <button
              type="button"
              onClick={() => void handleRedeem()}
              className="rounded-xl border-2 border-black bg-green-400 px-4 py-2 text-sm font-black uppercase text-black"
            >
              ★ Redeem Reward
            </button>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleSetGoal()}
              className="rounded-xl border-2 border-black bg-[var(--hero-yellow)] px-4 py-2 text-sm font-black uppercase text-black"
            >
              Set Goal
            </button>
            <button
              type="button"
              onClick={() => void handleClearGoal()}
              className="rounded-xl border-2 border-black bg-zinc-100 px-4 py-2 text-sm font-black uppercase text-black"
            >
              Clear Goal
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
