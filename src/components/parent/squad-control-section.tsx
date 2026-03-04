"use client";

import { useState } from "react";

import { awardSquadPower as awardSquadPowerRequest } from "@/lib/client-api";
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

  async function handleAward() {
    try {
      await awardSquadPowerRequest({ delta: awardDelta, note: "Manual parent award" });
      pushToast("success", "Squad power awarded.");
      await onRefresh();
    } catch {
      pushToast("error", "Failed to award squad power.");
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
      </div>
    </header>
  );
}
